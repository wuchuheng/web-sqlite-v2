import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// Vite library build targeting ESM output at dist/index.js
export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist",
    sourcemap: true,
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: {
        // Ensure the entry is exactly dist/index.js
        entryFileNames: "index.js",
      },
    },
  },
  plugins: [
    dts({
      // Generate and copy declaration files alongside the bundle
      entryRoot: "src",
      outDir: "dist",
      include: ["src/index.ts"],
      insertTypesEntry: true,
      copyDtsFiles: true,
      // Keep multiple .d.ts files (do not roll up to a single index.d.ts)
      // rollupTypes: false,
    }),
  ],
});
