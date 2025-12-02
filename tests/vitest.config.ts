import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["browser/**/*.test.ts"],
    browser: {
      enabled: true,
      provider: "playwright",
      name: "chromium",
      headless: false,
    },
  },
  // Vital for OPFS/SAB support
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
