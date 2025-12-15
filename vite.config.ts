import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
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
