import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const globals = {
  console: 'readonly',
  clearInterval: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  GeoJSON: 'readonly',
  process: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
};

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'web-build/**',
      'coverage/**',
      'data/**',
      'supabase/functions/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
