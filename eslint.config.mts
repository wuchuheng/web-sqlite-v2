import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Resolve repository root for tsconfigRootDir
const __dirname = dirname(fileURLToPath(import.meta.url));

const config = defineConfig([
    {
        ignores: [
            "**/*.d.ts",
            "dist/**",
            "docs/**",
            "docs/.vitepress/cache/**",
            "node_modules/**",
            "tests/node_modules/**",
            "test2/node_modules/**",
            "tests/dist/**",
            "test2/dist/**",
            "tests/**",
            "test2/**",
        ],
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
                project: ["./tsconfig.eslint.json", "./test2/tsconfig.json"],
                // Ensure type-aware lint uses the right tsconfig roots
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
]) as ReturnType<typeof defineConfig>;

export default config;
