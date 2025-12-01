import { defineConfig } from "vite";
import { resolve } from "path";

// Vite build config for OPFS Async Proxy
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/jswasm/vfs/opfs/async-proxy/index.ts"),
      formats: ["es"], // Using ES format as it's standard for modern web/workers
      fileName: () => "index.js",
    },
    outDir: resolve(__dirname, "src/jswasm/vfs/opfs/async-proxy"),
    emptyOutDir: false, // Critical: Do not delete the source file in the same directory
    minify: false, // Optional: Keep it readable for debugging, can be changed if needed
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: "index.js",
      },
    },
  },
  plugins: [],
});
