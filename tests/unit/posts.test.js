/**
 * Unit tests for /api/posts.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockSupabase, testUsers, testPosts, testContacts, mockChainResult } from './setup.js';

const mockSupabase = createMockSupabase();
const mockRequireAuth = vi.fn();
const mockGetUserInfo = vi.fn();

vi.mock('../../api/_supabase.js', () => ({
    supabase: mockSupabase,
    requireAuth: mockRequireAuth,
    getUserInfo: mockGetUserInfo,
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
    sanitizeText: vi.fn((str, opts = {}) => {
        if (typeof str !== 'string') return '';
        let clean = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
        if (clean.length > (opts.maxLength || 1000)) {
            clean = clean.substring(0, opts.maxLength || 1000);
        }
        return clean;
    })
}));

vi.mock('../../api/_error-logger.js', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    createErrorResponse: vi.fn((e) => ({ error: e.message }))
}));

describe('Posts API', () => {
    let handler;
    let req, res;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Default: authenticated as user1
        mockRequireAuth.mockResolvedValue(testUsers.user1);
        mockGetUserInfo.mockResolvedValue(testUsers.user1);
        
        const module = await import('../../api/posts.js');
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

    describe('GET - Feed', () => {
        beforeEach(() => {
            req.method = 'GET';
        });

        it('should return feed with own posts', async () => {
            const postsData = [testPosts.post1];
            
            mockSupabase.from
                // Get contacts
                .mockReturnValueOnce(mockChainResult({ data: [], error: null }))
                // Get posts
                .mockReturnValueOnce(mockChainResult({ data: postsData, error: null }));
            
            await handler(req, res);
            
            expect(res.body.posts).toBeDefined();
            expect(res.body.contactCount).toBe(0);
        });

        it('should return feed with contacts posts', async () => {
            const contactsData = [{ contact_user_id: testUsers.user2.id }];
            const postsData = [testPosts.post1, testPosts.post2];
            
            mockSupabase.from
                // Get contacts
                .mockReturnValueOnce(mockChainResult({ data: contactsData, error: null }))
                // Get posts
                .mockReturnValueOnce(mockChainResult({ data: postsData, error: null }));
            
            // Mock getUserInfo for each author
            mockGetUserInfo
                .mockResolvedValueOnce(testUsers.user1)
                .mockResolvedValueOnce(testUsers.user2);
            
            await handler(req, res);
            
            expect(res.body.posts).toHaveLength(2);
            expect(res.body.contactCount).toBe(1);
        });

        it('should handle cursor-based pagination', async () => {
            req.query.cursor = '2024-01-15T12:00:00Z';
            req.query.limit = '20';
            
            mockSupabase.from
                .mockReturnValueOnce(mockChainResult({ data: [], error: null }))
                .mockReturnValueOnce(mockChainResult({ data: [], error: null }));
            
            await handler(req, res);
            
            expect(res.body.posts).toEqual([]);
            expect(res.body.hasMore).toBe(false);
        });

        it('should return nextCursor when more posts exist', async () => {
            const postsData = Array(50).fill(null).map((_, i) => ({
                ...testPosts.post1,
                id: `post-${i}`,
                created_at: `2024-01-15T${String(i).padStart(2, '0')}:00:00Z`
            }));
            
            mockSupabase.from
                .mockReturnValueOnce(mockChainResult({ data: [], error: null }))
                .mockReturnValueOnce(mockChainResult({ data: postsData, error: null }));
            
            await handler(req, res);
            
            expect(res.body.hasMore).toBe(true);
            expect(res.body.nextCursor).toBeDefined();
        });
    });

    describe('GET - Specific User Posts', () => {
        beforeEach(() => {
            req.method = 'GET';
        });

        it('should return 400 for invalid user_id', async () => {
            req.query.user_id = 'invalid-uuid';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format user_id invalide');
        });

        it('should return own posts without contact check', async () => {
            req.query.user_id = testUsers.user1.id;
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: [testPosts.post1], error: null }));
            
            await handler(req, res);
            
            expect(res.body.posts).toHaveLength(1);
        });

        it('should return 403 for non-contact user', async () => {
            req.query.user_id = testUsers.user3.id;
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: null, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(403);
            expect(res.body.error).toContain('contacts');
        });

        it('should return contact posts', async () => {
            req.query.user_id = testUsers.user2.id;
            
            mockSupabase.from
                // Contact check
                .mockReturnValueOnce(mockChainResult({ data: testContacts.contact1, error: null }))
                // Get posts
                .mockReturnValueOnce(mockChainResult({ data: [testPosts.post2], error: null }));
            
            await handler(req, res);
            
            expect(res.body.posts).toHaveLength(1);
        });
    });

    describe('POST - Create Post', () => {
        beforeEach(() => {
            req.method = 'POST';
        });

        it('should return 400 for missing content', async () => {
            req.body = {};
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Contenu requis');
        });

        it('should return 400 for non-string content', async () => {
            req.body = { content: 123 };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Contenu requis');
        });

        it('should return 400 for empty content after sanitization', async () => {
            req.body = { content: '   ' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('vide');
        });

        it('should create post successfully', async () => {
            req.body = { content: 'My first post!' };
            
            const newPost = {
                id: 'new-post-id',
                user_id: testUsers.user1.id,
                content: 'My first post!',
                image_url: null,
                created_at: new Date().toISOString()
            };
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: newPost, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.post.content).toBe('My first post!');
        });

        it('should create post with image URL', async () => {
            req.body = { 
                content: 'Post with image', 
                image_url: 'https://example.com/image.jpg' 
            };
            
            const newPost = {
                id: 'new-post-id',
                user_id: testUsers.user1.id,
                content: 'Post with image',
                image_url: 'https://example.com/image.jpg',
                created_at: new Date().toISOString()
            };
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: newPost, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(201);
            expect(res.body.post.image_url).toBe('https://example.com/image.jpg');
        });

        it('should return 400 for invalid image URL protocol', async () => {
            req.body = { 
                content: 'Post', 
                image_url: 'ftp://example.com/image.jpg' 
            };
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('HTTP');
        });

        it('should return 400 for invalid image URL format', async () => {
            req.body = { 
                content: 'Post', 
                image_url: 'not-a-url' 
            };
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('URL');
        });

        it('should truncate long content', async () => {
            const longContent = 'A'.repeat(1500);
            req.body = { content: longContent };
            
            const newPost = {
                id: 'new-post-id',
                user_id: testUsers.user1.id,
                content: 'A'.repeat(1000),
                created_at: new Date().toISOString()
            };
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: newPost, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(201);
        });
    });

    describe('DELETE - Remove Post', () => {
        beforeEach(() => {
            req.method = 'DELETE';
        });

        it('should return 400 for missing id', async () => {
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('id requis');
        });

        it('should return 400 for invalid id format', async () => {
            req.query.id = 'invalid';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format id invalide');
        });

        it('should return 404 for non-existent post', async () => {
            req.query.id = testPosts.post1.id;
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: null, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(404);
            expect(res.body.error).toBe('Post non trouvé');
        });

        it('should return 403 when deleting others post', async () => {
            req.query.id = testPosts.post2.id;
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: testPosts.post2, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(403);
            expect(res.body.error).toContain('propres posts');
        });

        it('should delete own post successfully', async () => {
            req.query.id = testPosts.post1.id;
            
            mockSupabase.from
                // Get post
                .mockReturnValueOnce(mockChainResult({ data: testPosts.post1, error: null }))
                // Delete post
                .mockReturnValueOnce(mockChainResult({ error: null }));
            
            await handler(req, res);
            
            expect(res.body.success).toBe(true);
        });
    });

    describe('Method Not Allowed', () => {
        it('should return 405 for PUT', async () => {
            req.method = 'PUT';
            await handler(req, res);
            
            expect(res.statusCode).toBe(405);
            expect(res.body.error).toBe('Method not allowed');
        });

        it('should return 405 for PATCH', async () => {
            req.method = 'PATCH';
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
