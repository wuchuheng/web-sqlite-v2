// import { defineConfig } from "vitest/config";

// export default defineConfig({
//   test: {
//     include: ["src/**/*.test.ts"],
//     globals: false,
//     reporters: ["default"],
//   },
// });

import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  test: {
    // include: ["src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.test.ts"],
    include: ["src/**/*.test.ts"],
    browser: {
      enabled: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      provider: playwright(),
      headless: false, // Set to false so you can see the browser and debug
    },
  },
});
