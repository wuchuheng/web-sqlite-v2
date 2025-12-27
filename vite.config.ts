import { defineConfig, Plugin } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

const sourceMap = process.env.SOURCE_MAP === "true";
const minify = process.env.MINIFY === "true";

/**
 * A tiny plugin to strip the original WASM import from sqlite3.mjs.
 *
 * Why?
 * The vendored sqlite3.mjs has a static 'import' for the 832KB uncompressed WASM.
 * Since we are manually decompressing our own .wasm.gz file in sqlite-ops.ts,
 * we need to prevent Rollup from seeing and bundling the original binary,
 * which would result in code duplication and a much larger bundle.
 */
const stripWasmImportPlugin = (): Plugin => ({
  name: "strip-wasm-import",
  transform(code, id) {
    if (id.includes("sqlite3.mjs")) {
      // Replace the static import with a dummy constant to satisfy internal references
      // without triggering the bundler to pull in the actual .wasm file.
      let newCode = code.replace(
        'import wasmUrl from "./sqlite3.wasm?url";',
        'const wasmUrl = "";',
      );

      // Prevent sqlite3.mjs from overwriting our custom instantiateWasm loader if provided.
      newCode = newCode.replace(
        'Module["instantiateWasm"] = function callee(imports, onSuccess) {',
        'Module["instantiateWasm"] = Module["instantiateWasm"] || function callee(imports, onSuccess) {',
      );

      return {
        code: newCode,
        map: null,
      };
    }
  },
});

export default defineConfig({
  plugins: [
    stripWasmImportPlugin(),
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  define: {
    "globalThis.ENVIRONMENT_IS_NODE": "false",
    "globalThis.ENVIRONMENT_IS_SHELL": "false",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "WebSqlite",
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      external: [],
      output: {
        entryFileNames: "index.js",
      },
    },
    sourcemap: sourceMap,
    minify: minify ? "terser" : false,
    assetsInlineLimit: 1024 * 1024,
    terserOptions: minify
      ? {
          compress: {
            passes: 3,
            drop_console: true,
            pure_funcs: ["console.debug", "console.trace"],
          },
          mangle: {
            toplevel: true,
          },
        }
      : undefined,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
