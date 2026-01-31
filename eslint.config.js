export default [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        navigator: 'readonly',
        location: 'readonly',
        URL: 'readonly',
        FormData: 'readonly',
        FileReader: 'readonly',
        Blob: 'readonly',
        Image: 'readonly',
        Event: 'readonly',
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        requestAnimationFrame: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        module: 'readonly',
        require: 'readonly',
      }
    },
    rules: {
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-undef': 'off'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '*.min.js',
      'netlify/**',
      'api/**'
    ]
  }
];
