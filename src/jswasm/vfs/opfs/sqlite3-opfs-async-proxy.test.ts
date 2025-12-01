import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { OpfsProxyClient } from "../../../../tests/src/utils/opfs-proxy-client";

describe("OPFS Async Proxy", () => {
  let client: OpfsProxyClient;

  beforeAll(async () => {
    // We need to point to the file path relative to the server root or built assets
    // For raw TS/JS execution in vitest browser, we might need to serve this file.
    // But `import.meta.url` should work if the file is served.
    // However, `sqlite3-opfs-async-proxy.js` is a raw JS file.
    // Let's assume it is available at the same location.

    // Note: Vitest Browser mode serves files.
    client = new OpfsProxyClient(
      new URL("./sqlite3-opfs-async-proxy.js", import.meta.url).href,
    );
    await client.init();
  }, 30000); // Increase timeout for init

  test("should open and close a file", async () => {
    const filename = "/test-file-" + Date.now();
    // SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE (0x40 | 0x02 = 0x42? No, just check create flag in proxy)
    // Proxy checks: state.sq3Codes.SQLITE_OPEN_CREATE & flags
    // We passed SQLITE_OPEN_CREATE: 0x40 in init

    const fid = 1; // Arbitrary FID
    const rcOpen = await client.send("xOpen", [fid, filename, 0x40, 0]);
    expect(rcOpen).toBe(0);

    const rcClose = await client.send("xClose", [fid]);
    expect(rcClose).toBe(0);
  });
});
