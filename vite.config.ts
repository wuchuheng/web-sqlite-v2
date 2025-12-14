import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src"),
      name: "WebSqlite",
      fileName: "sqlite3-worker1-promiser-bundler-friendly.mjs",
      formats: ["es"],
    },
    outDir: "dist",
    emptyOutDir: false, // Prevent removing dist directory during build
    rollupOptions: {
      // External dependencies that should not be bundled
      external: [],
      output: {
        // Ensure the output file is named index.js
        entryFileNames: "index.js",
      },
    },
    sourcemap: true,
    minify: false, // Set to true if you want minification
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
