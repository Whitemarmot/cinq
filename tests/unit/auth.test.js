/**
 * Unit tests for /api/auth.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRequest, createMockResponse, createMockSupabase, testUsers, testGiftCodes, mockChainResult } from './setup.js';

// Mock the modules before importing handler
const mockSupabase = createMockSupabase();

vi.mock('../../api/_supabase.js', () => ({
    supabase: mockSupabase,
    getUser: vi.fn(),
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
    RATE_LIMITS: { AUTH: { windowMs: 60000, max: 10 } }
}));

vi.mock('../../api/_error-logger.js', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
    createErrorResponse: vi.fn((e) => ({ error: e.message }))
}));

describe('Auth API', () => {
    let handler;
    let req, res;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Reset mock implementations
        mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: null, error: null });
        mockSupabase.auth.admin.createUser.mockResolvedValue({ data: null, error: null });
        mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
        
        // Dynamic import to get fresh module with mocks
        const module = await import('../../api/auth.js');
        handler = module.default;
        
        req = createMockRequest();
        res = createMockResponse();
    });

    describe('Invalid action', () => {
        it('should return 400 for unknown action', async () => {
            req.query.action = 'unknown';
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Action invalide');
        });

        it('should return 400 for missing action', async () => {
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Action invalide');
        });
    });

    describe('Register - Validation', () => {
        beforeEach(() => {
            req.method = 'POST';
            req.query.action = 'register';
        });

        it('should return 400 for missing email', async () => {
            req.body = { password: 'Test1234', giftCode: 'CINQ-TEST-1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Email requis');
            expect(res.body.field).toBe('email');
        });

        it('should return 400 for invalid email format', async () => {
            req.body = { email: 'invalid', password: 'Test1234', giftCode: 'CINQ-TEST-1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format email invalide');
        });

        it('should return 400 for missing password', async () => {
            req.body = { email: 'test@test.com', giftCode: 'CINQ-TEST-1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Mot de passe requis');
        });

        it('should return 400 for password too short', async () => {
            req.body = { email: 'test@test.com', password: 'Ab1', giftCode: 'CINQ-TEST-1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('trop court');
        });

        it('should return 400 for password without number', async () => {
            req.body = { email: 'test@test.com', password: 'Abcdefgh', giftCode: 'CINQ-TEST-1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('lettre et un chiffre');
        });

        it('should return 400 for missing gift code', async () => {
            req.body = { email: 'test@test.com', password: 'Test1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Code cadeau requis');
        });

        it('should return 400 for invalid gift code format', async () => {
            req.body = { email: 'test@test.com', password: 'Test1234', giftCode: 'INVALID' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Format de code invalide');
        });
    });

    describe('Register - Gift Code Validation', () => {
        beforeEach(() => {
            req.method = 'POST';
            req.query.action = 'register';
        });

        it('should return 400 for non-existent gift code', async () => {
            req.body = { 
                email: 'test@test.com', 
                password: 'Test1234', 
                giftCode: 'CINQ-FAKE-CODE' 
            };
            
            // Gift code not found
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: null, error: { code: 'PGRST116' } }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Code cadeau introuvable');
        });

        it('should return 400 for already used gift code', async () => {
            req.body = { 
                email: 'test@test.com', 
                password: 'Test1234', 
                giftCode: testGiftCodes.used.code 
            };
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: testGiftCodes.used, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Code déjà utilisé');
        });

        it('should return 400 for expired gift code', async () => {
            req.body = { 
                email: 'test@test.com', 
                password: 'Test1234', 
                giftCode: testGiftCodes.expired.code 
            };
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ data: testGiftCodes.expired, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Code expiré');
        });
    });

    describe('Register - User Creation', () => {
        beforeEach(() => {
            req.method = 'POST';
            req.query.action = 'register';
        });

        it('should return 409 for existing email', async () => {
            req.body = { 
                email: testUsers.user1.email, 
                password: 'Test1234', 
                giftCode: testGiftCodes.valid.code 
            };
            
            // Gift code valid
            mockSupabase.from
                .mockReturnValueOnce(mockChainResult({ data: testGiftCodes.valid, error: null }))
                // User exists
                .mockReturnValueOnce(mockChainResult({ data: testUsers.user1, error: null }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(409);
            expect(res.body.error).toBe('Cet email est déjà inscrit');
        });

        it('should register user successfully', async () => {
            const newUser = {
                id: 'new-user-id-1234',
                email: 'newuser@test.com'
            };
            
            req.body = { 
                email: newUser.email, 
                password: 'Test1234', 
                giftCode: testGiftCodes.valid.code 
            };
            
            // Gift code valid
            mockSupabase.from
                .mockReturnValueOnce(mockChainResult({ data: testGiftCodes.valid, error: null }))
                // User doesn't exist
                .mockReturnValueOnce(mockChainResult({ data: null, error: { code: 'PGRST116' } }))
                // Update gift code
                .mockReturnValueOnce(mockChainResult({ error: null }))
                // Insert user profile
                .mockReturnValueOnce(mockChainResult({ error: null }));
            
            // Create user success
            mockSupabase.auth.admin.createUser.mockResolvedValueOnce({ 
                data: { user: newUser }, 
                error: null 
            });
            
            // Auto-login success
            mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({ 
                data: { user: newUser, session: { access_token: 'token' } }, 
                error: null 
            });
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Bienvenue');
            expect(res.body.isNewUser).toBe(true);
        });
    });

    describe('Login', () => {
        beforeEach(() => {
            req.method = 'POST';
            req.query.action = 'login';
        });

        it('should return 400 for missing email', async () => {
            req.body = { password: 'Test1234' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Email requis');
        });

        it('should return 400 for missing password', async () => {
            req.body = { email: 'test@test.com' };
            await handler(req, res);
            
            expect(res.statusCode).toBe(400);
            expect(res.body.error).toBe('Mot de passe requis');
        });

        it('should return 401 for invalid credentials', async () => {
            req.body = { email: 'test@test.com', password: 'WrongPass1' };
            
            mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({ 
                data: null, 
                error: { message: 'Invalid credentials' } 
            });
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Email ou mot de passe incorrect');
        });

        it('should login successfully', async () => {
            req.body = { email: testUsers.user1.email, password: 'ValidPass1' };
            
            mockSupabase.auth.signInWithPassword.mockResolvedValueOnce({ 
                data: { 
                    user: testUsers.user1, 
                    session: { access_token: 'valid-token' } 
                }, 
                error: null 
            });
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toBe('Connexion réussie !');
            expect(res.body.user.id).toBe(testUsers.user1.id);
        });
    });

    describe('Me (Current User)', () => {
        beforeEach(() => {
            req.method = 'GET';
            req.query.action = 'me';
        });

        it('should return 401 for missing authorization', async () => {
            req.headers.authorization = undefined;
            await handler(req, res);
            
            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Non authentifié');
        });

        it('should return 401 for invalid token', async () => {
            req.headers.authorization = 'Bearer invalid-token';
            
            mockSupabase.auth.getUser.mockResolvedValueOnce({ 
                data: { user: null }, 
                error: { message: 'Invalid token' } 
            });
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(401);
            expect(res.body.error).toBe('Token invalide');
        });

        it('should return user profile successfully', async () => {
            req.headers.authorization = 'Bearer valid-token';
            
            mockSupabase.auth.getUser.mockResolvedValueOnce({ 
                data: { user: testUsers.user1 }, 
                error: null 
            });
            
            mockSupabase.from.mockReturnValueOnce(mockChainResult({ 
                data: { ...testUsers.user1, bio: 'Hello!' }, 
                error: null 
            }));
            
            await handler(req, res);
            
            expect(res.statusCode).toBe(200);
            expect(res.body.user.id).toBe(testUsers.user1.id);
            expect(res.body.profile).toBeDefined();
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
