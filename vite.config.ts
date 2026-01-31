import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/services': resolve(__dirname, 'src/services'),
      '@/ui': resolve(__dirname, 'src/ui'),
      '@/utils': resolve(__dirname, 'src/utils'),
      '@/config': resolve(__dirname, 'src/config'),
      '@/types': resolve(__dirname, 'src/types'),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        login: resolve(__dirname, 'login.html'),
        gift: resolve(__dirname, 'gift.html'),
        redeem: resolve(__dirname, 'redeem.html'),
      },
      output: {
        manualChunks: {
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
    sourcemap: true,
    minify: 'esbuild',
  },
  server: {
    port: 3000,
    strictPort: false,
    open: true,
  },
  preview: {
    port: 4173,
  },
});
