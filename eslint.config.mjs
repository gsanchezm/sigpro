// Configuración ESLint compartida (flat config). Cada paquete ejecuta `eslint .` y
// ESLint sube hasta esta raíz para encontrarla.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

const NO_SWITCH = {
  selector: 'SwitchStatement',
  message: 'Usa un mapa de despacho (ReadonlyMap / objeto `as const`) y guard clauses en lugar de switch/case.',
};

// Regla de testabilidad: los data-testid se importan de packages/shared/src/testids.ts.
const NO_LITERAL_TESTID = {
  selector: 'JSXAttribute[name.name="data-testid"] > Literal',
  message: 'No escribas data-testid como string suelto: impórtalo de @sigpro/shared (testids.ts).',
};

// En la app móvil (React Native) el `data-testid` de la web se escribe `testID` y se toma igualmente de testids.ts.
const NO_LITERAL_TEST_ID = {
  selector: 'JSXAttribute[name.name="testID"] > Literal',
  message: 'No escribas testID como string suelto: impórtalo de @sigpro/shared (testids.ts).',
};

export default tseslint.config(
  { ignores: ['**/.expo/**', 'apps/mobile/metro.config.js', '**/dist/**', '**/node_modules/**', '**/.turbo/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**', 'docs/**', 'apps/api/prisma/migrations/**', '**/*.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': ['error', NO_SWITCH],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    extends: [jsxA11y.flatConfigs.recommended],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-syntax': ['error', NO_SWITCH, NO_LITERAL_TESTID],
    },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, __DEV__: 'readonly' } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'no-restricted-syntax': ['error', NO_SWITCH, NO_LITERAL_TEST_ID],
    },
  },
  {
    // Los tests de la web pueden comparar contra literales
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: { 'no-restricted-syntax': ['error', NO_SWITCH] },
  },
);
