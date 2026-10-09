import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Import boundaries: shared depends on nothing; frontend and backend never import each other. */
const boundary = (forbidden, message) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: forbidden.map((group) => ({
        group: [`@food-stack/${group}`, `@food-stack/${group}/*`, `**/${group}/src/**`],
        message,
      })),
    },
  ],
});

export default tseslint.config(
  { ignores: ['**/dist/', '**/coverage/', '**/node_modules/'] },

  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  // Tooling config files are not part of any app tsconfig; lint them without type information.
  {
    files: ['*.config.{js,ts}', '*/*.config.{js,ts}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['shared/src/**/*.ts'],
    rules: boundary(['frontend', 'backend'], 'shared must not depend on frontend or backend.'),
  },
  {
    files: ['backend/src/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: boundary(['frontend'], 'The backend must not import frontend code.'),
  },
  {
    files: ['frontend/src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'warn',
      ...boundary(['backend'], 'The frontend must only reach the backend over HTTP (/api).'),
    },
  },
);
