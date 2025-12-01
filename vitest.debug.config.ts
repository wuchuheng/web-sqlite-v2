import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  test: {
    include: ["src/jswasm/vfs/opfs/opfs-worker-init.test.ts"],
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
