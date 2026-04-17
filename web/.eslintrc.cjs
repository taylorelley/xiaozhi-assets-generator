module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-essential',
  ],
  globals: {
    // Vitest globals (scoped to tests via overrides below)
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-console': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-unused-components': 'warn',
  },
  overrides: [
    {
      files: [
        'tests/**/*.{js,mjs}',
        'src/**/__tests__/**/*.{js,mjs}',
        'src/**/*.{test,spec}.{js,mjs}',
      ],
      env: { node: true },
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        vi: 'readonly',
      },
    },
  ],
}
