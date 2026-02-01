/**
 * Shared test utilities and Supabase mocks
 */
import { vi } from 'vitest';

// ===== MOCK SUPABASE CLIENT =====

export function createMockSupabase() {
    // Create a chainable mock that returns itself for all methods
    const createChainable = (overrides = {}) => {
        const chain = {
            select: vi.fn(() => chain),
            insert: vi.fn(() => chain),
            update: vi.fn(() => chain),
            delete: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            neq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            is: vi.fn(() => chain),
            or: vi.fn(() => chain),
            and: vi.fn(() => chain),
            lt: vi.fn(() => chain),
            gt: vi.fn(() => chain),
            lte: vi.fn(() => chain),
            gte: vi.fn(() => chain),
            order: vi.fn(() => chain),
            limit: vi.fn(() => chain),
            range: vi.fn(() => chain),
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            // Allow overrides and make the chain itself a promise for queries
            then: (resolve) => resolve({ data: null, error: null }),
            ...overrides
        };
        return chain;
    };

    const mockFrom = vi.fn(() => createChainable());

    return {
        from: mockFrom,
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
            signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
            admin: {
                createUser: vi.fn().mockResolvedValue({ data: null, error: null }),
                getUserById: vi.fn().mockResolvedValue({ data: null, error: null }),
            }
        },
        _createChainable: createChainable,
        _mockFrom: mockFrom
    };
}

// ===== MOCK REQUEST/RESPONSE =====

export function createMockRequest(options = {}) {
    return {
        method: options.method || 'GET',
        headers: {
            authorization: options.token ? `Bearer ${options.token}` : undefined,
            origin: options.origin || 'https://cinq-three.vercel.app',
            ...options.headers
        },
        query: options.query || {},
        body: options.body || {}
    };
}

export function createMockResponse() {
    const res = {
        statusCode: 200,
        headers: {},
        body: null,
        status: vi.fn(function(code) {
            this.statusCode = code;
            return this;
        }),
        json: vi.fn(function(data) {
            this.body = data;
            return this;
        }),
        setHeader: vi.fn(function(key, value) {
            this.headers[key] = value;
            return this;
        }),
        end: vi.fn()
    };
    return res;
}

// ===== TEST DATA FIXTURES =====

export const testUsers = {
    user1: {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'user1@test.com',
        display_name: 'User One',
        avatar_url: null
    },
    user2: {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'user2@test.com',
        display_name: 'User Two',
        avatar_url: null
    },
    user3: {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'user3@test.com',
        display_name: 'User Three',
        avatar_url: null
    }
};

export const testGiftCodes = {
    valid: {
        id: 'gift-1',
        code: 'CINQ-TEST-1234',
        status: 'active',
        expires_at: null
    },
    used: {
        id: 'gift-2',
        code: 'CINQ-USED-5678',
        status: 'redeemed',
        expires_at: null
    },
    expired: {
        id: 'gift-3',
        code: 'CINQ-EXPR-9999',
        status: 'active',
        expires_at: '2020-01-01T00:00:00Z'
    }
};

export const testPosts = {
    post1: {
        id: 'aaaaaaaa-1111-1111-1111-111111111111',
        user_id: testUsers.user1.id,
        content: 'Hello world!',
        image_url: null,
        created_at: '2024-01-15T10:00:00Z'
    },
    post2: {
        id: 'bbbbbbbb-2222-2222-2222-222222222222',
        user_id: testUsers.user2.id,
        content: 'Another post',
        image_url: 'https://example.com/image.jpg',
        created_at: '2024-01-15T11:00:00Z'
    }
};

export const testMessages = {
    msg1: {
        id: 'cccccccc-1111-1111-1111-111111111111',
        sender_id: testUsers.user1.id,
        receiver_id: testUsers.user2.id,
        content: 'Hey!',
        is_ping: false,
        created_at: '2024-01-15T10:00:00Z',
        read_at: null
    },
    msg2: {
        id: 'dddddddd-2222-2222-2222-222222222222',
        sender_id: testUsers.user2.id,
        receiver_id: testUsers.user1.id,
        content: '👋',
        is_ping: true,
        created_at: '2024-01-15T10:01:00Z',
        read_at: '2024-01-15T10:02:00Z'
    }
};

export const testContacts = {
    contact1: {
        id: 'eeeeeeee-1111-1111-1111-111111111111',
        user_id: testUsers.user1.id,
        contact_user_id: testUsers.user2.id,
        created_at: '2024-01-01T00:00:00Z'
    }
};

/**
 * Helper to create a mock chain with specific resolved values
 */
export function mockChainResult(result) {
    const chain = {
        select: vi.fn(() => chain),
        insert: vi.fn(() => chain),
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        neq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        is: vi.fn(() => chain),
        or: vi.fn(() => chain),
        and: vi.fn(() => chain),
        lt: vi.fn(() => chain),
        gt: vi.fn(() => chain),
        lte: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        order: vi.fn(() => chain),
        limit: vi.fn(() => chain),
        range: vi.fn(() => chain),
        single: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
        then: (resolve) => resolve(result)
    };
    // Also make the chain itself resolvable
    return Object.assign(Promise.resolve(result), chain);
}
