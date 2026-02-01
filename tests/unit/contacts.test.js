/**
 * Unit tests for /api/contacts.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockSupabase, testUsers, testContacts, mockChainResult } from './setup.js';

const mockSupabase = createMockSupabase();
const mockRequireAuth = vi.fn();
const mockGetUserEmail = vi.fn();

vi.mock('../../api/_supabase.js', () => ({
    supabase: mockSupabase,
    requireAuth: mockRequireAuth,
    getUserEmail: mockGetUserEmail,
    getUserProfile: vi.fn().mockResolvedValue({}),
    handleCors: vi.fn((req, res) => {
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return true;
        }
        return false;
    })
}));

vi.mock('../../api/_rate-limit.js', () => ({
    checkRateLimit: vi.fn(() => true),
    RATE_LIMITS: { READ: {}, CREATE: {} }
}));

vi.mock('../../api/_validation.js', () => ({
    isValidUUID: vi.fn((str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)),
    isValidEmail: vi.fn((str) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str?.trim() || ''))
}));

vi.mock('../../api/_error-logger.js', () => ({
    logError: vi.fn(),
    createErrorResponse: vi.fn((e) => ({ error: e.message }))
}));

describe('Contacts API', () => {
    let handler;
    let req, res;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Default: authenticated as user1
        mockRequireAuth.mockResolvedValue(testUsers.user1);
        mockGetUserEmail.mockResolvedValue('user@test.com');
        
        const module = await import('../../api/contacts.js');
        handler = module.default;
        
        req = createMockRequest({ token: 'valid-token' });
        res = createMockResponse();
    });

    describe('Authentication', () => {
        it('should return 401 if not authenticated', async () => {
            mockRequireAuth.mockImplementationOnce((req, res) => {
                res.status(401).json({ error: 'Non authentifié' });
                return null;
            });
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(401);
        });
    });

    describe('GET - List Contacts', () => {
        beforeEach(() => {
            req.method = 'GET';
        });

        it('should return empty contacts list', async () => {
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: [], error: null }));
            
            await handler(req, res);
            
            expect(res.body.contacts).toEqual([]);
            expect(res.body.count).toBe(0);
            expect(res.body.max).toBe(5);
        });

        it('should return contacts with profiles', async () => {
            const contactsData = [testContacts.contact1];
            const profilesData = [testUsers.user2];
            
            mockSupabase.from
                // Get contacts
                .mockReturnValueOnce(mockChainResult({ data: contactsData, error: null }))
                // Get profiles
                .mockReturnValueOnce(mockChainResult({ data: profilesData, error: null }))
                // Get mutual contacts
                .mockReturnValueOnce(mockChainResult({ data: [], error: null }));
            
            await handler(req, res);
            
            expect(res.body.contacts).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
    });

    describe('GET - Search User', () => {
        beforeEach(() => {
            req.method = 'GET';
            req.query.action = 'search';
        });

        it('should return 400 if search param missing', async () => {
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Paramètre search requis');
        });

        it('should return 400 for invalid email format', async () => {
            req.query.search = 'not-an-email';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format email invalide');
        });

        it('should return 400 when searching for self', async () => {
            req.query.search = testUsers.user1.email;
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('toi-même');
        });

        it('should return 404 if user not found', async () => {
            req.query.search = 'unknown@test.com';
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: null, error: { code: 'PGRST116' } }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Utilisateur non trouvé');
        });

        it('should find user and check if already contact', async () => {
            req.query.search = testUsers.user2.email;
            
            mockSupabase.from
                // User found
                .mockReturnValueOnce(mockChainResult({ data: testUsers.user2, error: null }))
                // Check existing contact
                .mockReturnValueOnce(mockChainResult({ data: null, error: null }));
            
            await handler(req, res);
            
            expect(res.body.user.id).toBe(testUsers.user2.id);
            expect(res.body.alreadyContact).toBe(false);
        });
    });

    describe('GET - Followers', () => {
        beforeEach(() => {
            req.method = 'GET';
            req.query.action = 'followers';
        });

        it('should return empty followers list', async () => {
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: [], error: null }));
            
            await handler(req, res);
            
            expect(res.body.followers).toEqual([]);
            expect(res.body.count).toBe(0);
        });

        it('should return followers with profiles', async () => {
            const followerData = [{ id: 'foll-1', user_id: testUsers.user2.id, created_at: new Date().toISOString() }];
            
            mockSupabase.from
                // Get followers
                .mockReturnValueOnce(mockChainResult({ data: followerData, error: null }))
                // Get profiles
                .mockReturnValueOnce(mockChainResult({ data: [testUsers.user2], error: null }))
                // Get reverse contacts
                .mockReturnValueOnce(mockChainResult({ data: [], error: null }));
            
            await handler(req, res);
            
            expect(res.body.followers).toHaveLength(1);
            expect(res.body.count).toBe(1);
        });
    });

    describe('POST - Add Contact', () => {
        beforeEach(() => {
            req.method = 'POST';
        });

        it('should return 400 if no contactId or email', async () => {
            req.body = {};
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('contactId ou email requis');
        });

        it('should return 400 for invalid UUID', async () => {
            req.body = { contactId: 'invalid-uuid' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format contactId invalide');
        });

        it('should return 400 when adding self', async () => {
            req.body = { contactId: testUsers.user1.id };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('toi-même');
        });

        it('should return 404 if user not found', async () => {
            req.body = { contactId: testUsers.user3.id };
            mockGetUserEmail.mockResolvedValueOnce(null);
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Utilisateur non trouvé');
        });

        it('should return 400 when contact limit reached', async () => {
            req.body = { contactId: testUsers.user2.id };
            
            // Count returns 5
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ count: 5, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Limite atteinte');
        });

        it('should return 409 if already a contact', async () => {
            req.body = { contactId: testUsers.user2.id };
            
            mockSupabase.from
                // Count check (under limit)
                .mockReturnValueOnce(mockChainResult({ count: 2, error: null }))
                // Already exists
                .mockReturnValueOnce(mockChainResult({ data: testContacts.contact1, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(409);
            expect(res.body.error).toBe('Déjà dans tes contacts');
        });

        it('should add contact successfully', async () => {
            req.body = { contactId: testUsers.user2.id };
            
            const newContact = {
                id: 'new-contact-id',
                user_id: testUsers.user1.id,
                contact_user_id: testUsers.user2.id
            };
            
            mockSupabase.from
                // Count check
                .mockReturnValueOnce(mockChainResult({ count: 2, error: null }))
                // Not already contact
                .mockReturnValueOnce(mockChainResult({ data: null, error: null }))
                // Insert
                .mockReturnValueOnce(mockChainResult({ data: newContact, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.contact).toBeDefined();
        });
    });

    describe('DELETE - Remove Contact', () => {
        beforeEach(() => {
            req.method = 'DELETE';
        });

        it('should return 400 if id missing', async () => {
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('id requis');
        });

        it('should return 400 for invalid UUID', async () => {
            req.query.id = 'invalid';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format id invalide');
        });

        it('should delete contact successfully', async () => {
            req.query.id = testContacts.contact1.id;
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ error: null }));
            
            await handler(req, res);
            
            expect(res.body.success).toBe(true);
        });
    });

    describe('Method Not Allowed', () => {
        it('should return 405 for PUT method', async () => {
            req.method = 'PUT';
            await handler(req, res);
            
            expect(res.statusCode).toBe(405);
            expect(res.body.error).toBe('Method not allowed');
        });
    });
});
