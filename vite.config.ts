import { defineConfig, Plugin } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

const sourceMap = process.env.SOURCE_MAP === "true";
const minify = process.env.MINIFY === "true"; // Disable minify as default value;

const sqliteOptimizePlugin: Plugin = {
  name: "sqlite-optimize",
  transform(code, id) {
    if (id.includes("sqlite3.mjs")) {
      return code;
      // .replace(
      //   /var ENVIRONMENT_IS_NODE =[\s\S]*?;/,
      //   "var ENVIRONMENT_IS_NODE = false;",
      // )
      // .replace(
      //   /var ENVIRONMENT_IS_SHELL =[\s\S]*?;/,
      //   "var ENVIRONMENT_IS_SHELL = false;",
      // );
    }
    return null;
  },
};

export default defineConfig({
  plugins: [
    sqliteOptimizePlugin,
    dts({
      insertTypesEntry: true,
      rollupTypes: true,
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "WebSqlite",
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: true, // Prevent removing dist directory during build
    rollupOptions: {
      // External dependencies that should not be bundled
      external: [],
      output: {
        // Ensure the output file is named index.js
        entryFileNames: "index.js",
        inlineDynamicImports: true,
      },
    },
    sourcemap: sourceMap,
    minify: minify ? "terser" : false,
    terserOptions: {
      compress: {
        dead_code: true,
        passes: 3,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
