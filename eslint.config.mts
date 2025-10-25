import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve repository root for tsconfigRootDir
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig([
    {
        ignores: ["**/*.d.ts"],
    },
    {
        files: ["**/*.{js,mjs,cjs}"],
        plugins: { js },
        extends: ["js/recommended"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2024,
            },
        },
        rules: {
            "no-empty": [
                "error",
                {
                    allowEmptyCatch: true,
                },
            ],
            "no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: ["**/*.{ts,mts,cts}"],
    })),
    {
        files: ["**/*.{ts,mts,cts}"],
        languageOptions: {
            parserOptions: {
                // Disambiguate between root and tests tsconfig directories
                tsconfigRootDir: __dirname,
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2024,
            },
        },
        rules: {
            "no-empty": [
                "error",
                {
                    allowEmptyCatch: true,
                },
            ],
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                },
            ],
        },
    },
]);
