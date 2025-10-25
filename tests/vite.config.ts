import { defineConfig } from "vite";

/**
 * Vite configuration for SQLite3 WASM test suite
 *
 * IMPORTANT: This configuration includes mandatory headers for OPFS and SharedArrayBuffer support
 */
export default defineConfig({
  // Development server configuration
  server: {
    port: 3000,
    open: true,
    cors: true,
    headers: {
      // Required for SharedArrayBuffer and OPFS functionality
      // These headers match scripts/http-server.ts configuration
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  },

  // Preview server configuration (for production builds)
  preview: {
    port: 3000,
    cors: true,
    headers: {
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  },

  // Build configuration
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    exclude: ["@wuchuheng/web-sqlite"],
  },

  // Worker configuration
  worker: {
    format: "es",
  },
});
