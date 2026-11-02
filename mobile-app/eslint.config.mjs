import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // The mobile API mirrors broad JSON contracts from the existing backend.
      // Keep runtime validation at API boundaries while those contracts migrate to shared types.
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  globalIgnores(['.expo/**', 'dist/**', 'dist-test/**', 'node_modules/**', 'expo-env.d.ts']),
]);
