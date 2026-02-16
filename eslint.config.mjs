import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      "dist/",
      "node_modules/",
      "examples/",
      "*.config.*",
      "packages/create-pulsekit/src/sql/",
    ],
  },

  // Base TypeScript rules for all packages
  {
    files: ["packages/*/src/**/*.{ts,tsx}"],
    extends: [tseslint.configs.recommended],
  },

  // Relax rules in test files (mocks legitimately use `any`)
  {
    files: ["packages/*/src/__tests__/**"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },

  // React Hooks rules for next and react packages
  {
    files: ["packages/{next,react}/src/**/*.tsx"],
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },

  // Next.js rules for the next package
  {
    files: ["packages/next/src/**/*"],
    plugins: { "@next/next": nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      "@next/next/no-html-link-for-pages": "off",
    },
  },
);
