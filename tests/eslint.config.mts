import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

const config = defineConfig([
    {
        ignores: ["dist/**", "node_modules/**"],
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
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2024,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
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
