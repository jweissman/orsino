import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  // 0) Ignore build output, deps, etc.
  {
    ignores: [
      'dist/',
      'build/',
      'coverage/',
      'node_modules/',
      'site/'
    ],
  },

  // 1) Base JS recommended rules
  eslint.configs.recommended,

  // 2) TypeScript recommended (type-checked) rules
  tseslint.configs.recommendedTypeChecked,

  // 3) Global languageOptions + your project rules
  {
    // ⚠️ NOTE: no `files` here – applies to all files that TS config applies to
    languageOptions: {
      parserOptions: {
        // modern way to enable type-aware linting
        projectService: true,
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
    },
    rules: {
            // keep the really important ones as errors
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'no-debugger': 'error',

      // demote noisy ones
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-floating-promises': 'warn',

      // keep game ergonomics
      'no-param-reassign': 'off',
      //
      // General JS / code quality
      // //
      // curly: ['error', 'all'],
      // eqeqeq: ['error', 'always'],
      // 'no-console': ['warn', { allow: ['warn', 'error'] }],
      // 'no-debugger': 'warn',
      // 'no-var': 'error',
      // 'prefer-const': ['error', { destructuring: 'all' }],

      // //
      // // TypeScript-specific
      // //
      // '@typescript-eslint/consistent-type-imports': [
      //   'error',
      //   { prefer: 'type-imports' },
      // ],
      // '@typescript-eslint/no-unused-vars': [
      //   'error',
      //   {
      //     argsIgnorePattern: '^_',
      //     varsIgnorePattern: '^_',
      //     ignoreRestSiblings: true,
      //   },
      // ],
      // '@typescript-eslint/no-explicit-any': 'warn',
      // '@typescript-eslint/no-floating-promises': 'error',
      // '@typescript-eslint/no-non-null-assertion': 'warn',

      // //
      // // Game-dev ergonomics
      // //
      // 'no-param-reassign': 'off',
    },
  },

  // 4) Tests – more relaxed
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]);
