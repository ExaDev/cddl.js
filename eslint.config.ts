import { exadevConfig } from "@exadev/eslint-config";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

export default exadevConfig(
  {},
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
      ".turbo",
      "vendor",
      "test/fixtures/generated",
      // Plain JS (not TS), specifically so it never needs Node's native type-stripping to load -- see tsdown.config.js's own comment for why. Nothing here needs type-aware linting.
      "tsdown.config.js",
    ],
  },
  {
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
  },
  {
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
    },
  },
  eslintPluginPrettierRecommended,
);
