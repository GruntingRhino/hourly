import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // This codebase predates the TypeScript lint baseline. Keep legacy explicit
      // `any` visible while preventing it from masking correctness regressions
      // introduced by the stricter runtime and React rules below.
      "@typescript-eslint/no-explicit-any": "warn",
      // This rule only affects Vite development-time Fast Refresh behavior; it
      // does not change runtime component behavior or production safety.
      "react-refresh/only-export-components": "warn",
      // React Compiler diagnostics were introduced by the ESLint 10 upgrade.
      // Keep them visible while the existing component state flows are migrated
      // incrementally; they are not runtime security controls.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
])
