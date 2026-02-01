/**
 * Unit tests for /api/messages.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockSupabase, testUsers, testMessages, testContacts, mockChainResult } from './setup.js';

const mockSupabase = createMockSupabase();
const mockRequireAuth = vi.fn();

vi.mock('../../api/_supabase.js', () => ({
    supabase: mockSupabase,
    requireAuth: mockRequireAuth,
    handleCors: vi.fn((req, res) => {
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return true;
        }
        return false;
    })
}));

vi.mock('../../api/_push-helper.js', () => ({
    sendPushNotification: vi.fn()
}));

vi.mock('../../api/_rate-limit.js', () => ({
    checkRateLimit: vi.fn(() => true),
    RATE_LIMITS: { READ: {}, CREATE: {} }
}));

vi.mock('../../api/_validation.js', () => ({
    isValidUUID: vi.fn((str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)),
    validateMessageContent: vi.fn((content, opts = {}) => {
        if (!content && opts.required) return { valid: false, error: 'Contenu requis' };
        if (!content) return { valid: true, content: null };
        const clean = content.trim().substring(0, opts.maxLength || 2000);
        if (clean.length === 0 && opts.required) return { valid: false, error: 'Contenu vide' };
        return { valid: true, content: clean };
    })
}));

vi.mock('../../api/_error-logger.js', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    createErrorResponse: vi.fn((e) => ({ error: e.message }))
}));

describe('Messages API', () => {
    let handler;
    let req, res;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Default: authenticated as user1
        mockRequireAuth.mockResolvedValue(testUsers.user1);
        
        const module = await import('../../api/messages.js');
        handler = module.default;
        
        req = createMockRequest({ token: 'valid-token' });
        res = createMockResponse();
    });

    describe('Authentication', () => {
        it('should require authentication', async () => {
            mockRequireAuth.mockImplementationOnce((req, res) => {
                res.status(401).json({ error: 'Non authentifié' });
                return null;
            });
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET - Fetch Messages', () => {
        beforeEach(() => {
            req.method = 'GET';
        });

        it('should return 400 if contact_id missing (without since)', async () => {
            req.query = {};
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('contact_id requis');
        });

        it('should return 400 for invalid contact_id format', async () => {
            req.query.contact_id = 'invalid-uuid';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format contact_id invalide');
        });

        it('should return 403 if not a contact', async () => {
            req.query.contact_id = testUsers.user3.id;
            
            // Contact check fails
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: null, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(403);
            expect(res.body.error).toBe('Pas dans tes contacts');
        });

        it('should fetch messages successfully', async () => {
            req.query.contact_id = testUsers.user2.id;
            
            const messagesData = [testMessages.msg1, testMessages.msg2];
            
            mockSupabase.from
                // Contact verification
                .mockReturnValueOnce(mockChainResult({ data: testContacts.contact1, error: null }))
                // Fetch messages
                .mockReturnValueOnce(mockChainResult({ data: messagesData, error: null }))
                // Mark as read
                .mockReturnValueOnce(mockChainResult({ error: null }));
            
            await handler(req, res);
            
            expect(res.body.messages).toBeDefined();
            expect(Array.isArray(res.body.messages)).toBe(true);
        });

        it('should return unread count with since param', async () => {
            req.query.since = Date.now().toString();
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ count: 3, error: null }));
            
            await handler(req, res);
            
            expect(res.body.success).toBe(true);
            expect(res.body.newCount).toBe(3);
        });

        it('should return 400 for invalid since format', async () => {
            req.query.since = 'invalid';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format since invalide');
        });
    });

    describe('POST - Send Message', () => {
        beforeEach(() => {
            req.method = 'POST';
        });

        it('should return 400 if contact_id missing', async () => {
            req.body = { content: 'Hello!' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('contact_id requis');
        });

        it('should return 400 for invalid contact_id', async () => {
            req.body = { contact_id: 'invalid', content: 'Hello!' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format contact_id invalide');
        });

        it('should return 400 for missing content (non-ping)', async () => {
            req.body = { contact_id: testUsers.user2.id };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Contenu requis');
        });

        it('should return 403 if not a contact', async () => {
            req.body = { contact_id: testUsers.user3.id, content: 'Hello!' };
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: null, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(403);
            expect(res.body.error).toBe('Pas dans tes contacts');
        });

        it('should send message successfully', async () => {
            req.body = { contact_id: testUsers.user2.id, content: 'Hello!' };
            
            const newMessage = {
                id: 'new-msg-id',
                sender_id: testUsers.user1.id,
                receiver_id: testUsers.user2.id,
                content: 'Hello!',
                is_ping: false,
                created_at: new Date().toISOString()
            };
            
            mockSupabase.from
                // Contact verification
                .mockReturnValueOnce(mockChainResult({ data: testContacts.contact1, error: null }))
                // Insert message
                .mockReturnValueOnce(mockChainResult({ data: newMessage, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message.content).toBe('Hello!');
        });

        it('should send ping successfully (no content required)', async () => {
            req.body = { contact_id: testUsers.user2.id, is_ping: true };
            
            const newPing = {
                id: 'new-ping-id',
                sender_id: testUsers.user1.id,
                receiver_id: testUsers.user2.id,
                content: '👋',
                is_ping: true,
                created_at: new Date().toISOString()
            };
            
            mockSupabase.from
                // Contact verification
                .mockReturnValueOnce(mockChainResult({ data: testContacts.contact1, error: null }))
                // Insert ping
                .mockReturnValueOnce(mockChainResult({ data: newPing, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.message.is_ping).toBe(true);
        });
    });

    describe('Method Not Allowed', () => {
        it('should return 405 for unsupported methods', async () => {
            req.method = 'PUT';
            await handler(req, res);
            
            expect(res.statusCode).toBe(405);
            expect(res.body.error).toBe('Method not allowed');
        });

        it('should return 405 for DELETE', async () => {
            req.method = 'DELETE';
            await handler(req, res);
            
            expect(res.statusCode).toBe(405);
        });
    });

    describe('CORS', () => {
        it('should handle OPTIONS preflight', async () => {
            req.method = 'OPTIONS';
            await handler(req, res);
            
            expect(res.statusCode).toBe(200);
        });
    });
});
