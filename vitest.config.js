import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/unit/**/*.test.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['api/**/*.js'],
            exclude: ['api/_*.js']
        },
        mockReset: true,
        restoreMocks: true
    }
});
