import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { OpfsProxyClient } from "./opfs-proxy-client.test";

describe("OPFS Async Proxy Tests", () => {
  let client: OpfsProxyClient;
  const workerUrl = new URL("./sqlite3-opfs-async-proxy.js", import.meta.url)
    .href;

  beforeAll(async () => {
    client = new OpfsProxyClient(workerUrl);
    await client.init();
  });

  afterAll(() => {
    if (client) {
      client.terminate();
    }
  });

  test("TC-03: xAccess (File Existence)", async () => {
    const filename = "/test-file-exists-" + Date.now();

    // 1. Check non-existent file
    const rc1 = await client.send("xAccess", [filename]);
    expect(rc1).not.toBe(OpfsProxyClient.SQLITE_OK); // Should fail (probably IOERR or similar, proxy returns IOERR on not found in catch)
    // Wait, proxy xAccess implementation:
    // try { ... getFileHandle ... } catch { rc = SQLITE_IOERR }
    // storeAndNotify("xAccess", rc);
    // So it returns SQLITE_IOERR (10) if file not found.

    // 2. Create file using xOpen with CREATE flag
    const fid = 100;
    const rcOpen = await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    expect(rcOpen).toBe(OpfsProxyClient.SQLITE_OK);

    // 3. Close it to ensure it's written/flushed (though xOpen just creates handle)
    await client.send("xClose", [fid]);

    // 4. Check existence again
    const rc2 = await client.send("xAccess", [filename]);
    expect(rc2).toBe(OpfsProxyClient.SQLITE_OK);

    // Cleanup
    await client.send("xDelete", [filename, 0]);
  });

  test("TC-04: xOpen & xClose", async () => {
    const filename = "/test-open-close-" + Date.now();
    const fid = 101;

    // 1. Open with CREATE
    const rcOpen = await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    expect(rcOpen).toBe(OpfsProxyClient.SQLITE_OK);

    // 2. Close
    const rcClose = await client.send("xClose", [fid]);
    expect(rcClose).toBe(OpfsProxyClient.SQLITE_OK);

    // Cleanup
    await client.send("xDelete", [filename, 0]);
  });

  test("TC-05: xWrite & xRead", async () => {
    const filename = "/test-read-write-" + Date.now();
    const fid = 102;

    // Open file
    await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);

    // Prepare data
    const data = new TextEncoder().encode("Hello, SQLite Proxy!");
    client.setFileBuffer(data);

    // Write
    const rcWrite = await client.send("xWrite", [fid, data.length, 0]);
    expect(rcWrite).toBe(OpfsProxyClient.SQLITE_OK);

    // Read back
    // Clear buffer first to be sure
    client.setFileBuffer(new Uint8Array(data.length));

    const rcRead = await client.send("xRead", [fid, data.length, 0]);
    expect(rcRead).toBe(OpfsProxyClient.SQLITE_OK);

    const readData = client.getFileBuffer(data.length);
    const readStr = new TextDecoder().decode(readData);
    expect(readStr).toBe("Hello, SQLite Proxy!");

    // Partial read
    const rcReadPartial = await client.send("xRead", [fid, 6, 7]); // Read "SQLite" (offset 7)
    expect(rcReadPartial).toBe(OpfsProxyClient.SQLITE_OK);
    const readPartial = new TextDecoder().decode(client.getFileBuffer(6));
    expect(readPartial).toBe("SQLite");

    // Close and Cleanup
    await client.send("xClose", [fid]);
    await client.send("xDelete", [filename, 0]);
  });

  test("TC-06: xFileSize & xTruncate", async () => {
    const filename = "/test-size-" + Date.now();
    const fid = 103;

    // Open
    await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);

    // Write 10 bytes
    const data = new Uint8Array(10).fill(65); // 'A'
    client.setFileBuffer(data);
    await client.send("xWrite", [fid, 10, 0]);

    // Check size
    const resSize = await client.send("xFileSize", [fid]);
    // xFileSize returns { rc, results: [size] }
    expect(resSize.rc).toBe(OpfsProxyClient.SQLITE_OK);
    expect(resSize.results[0]).toBe(10);

    // Truncate to 5
    const rcTrunc = await client.send("xTruncate", [fid, 5]);
    expect(rcTrunc).toBe(OpfsProxyClient.SQLITE_OK);

    // Check size again
    const resSize2 = await client.send("xFileSize", [fid]);
    expect(resSize2.results[0]).toBe(5);

    // Extend (truncate to larger)
    await client.send("xTruncate", [fid, 20]);
    const resSize3 = await client.send("xFileSize", [fid]);
    expect(resSize3.results[0]).toBe(20);

    // Close and Cleanup
    await client.send("xClose", [fid]);
    await client.send("xDelete", [filename, 0]);
  });

  test("TC-07: xLock & xUnlock", async () => {
    const filename = "/test-lock-" + Date.now();
    const fid = 104;

    await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);

    // Lock Shared
    let rc = await client.send("xLock", [
      fid,
      OpfsProxyClient.SQLITE_LOCK_SHARED,
    ]);
    expect(rc).toBe(OpfsProxyClient.SQLITE_OK);

    // Lock Reserved
    rc = await client.send("xLock", [
      fid,
      OpfsProxyClient.SQLITE_LOCK_RESERVED,
    ]);
    expect(rc).toBe(OpfsProxyClient.SQLITE_OK);

    // Unlock to None
    rc = await client.send("xUnlock", [fid, OpfsProxyClient.SQLITE_LOCK_NONE]);
    expect(rc).toBe(OpfsProxyClient.SQLITE_OK);

    // Close and Cleanup
    await client.send("xClose", [fid]);
    await client.send("xDelete", [filename, 0]);
  });

  test("TC-08: xDelete", async () => {
    const filename = "/test-delete-" + Date.now();
    const fid = 105;

    // Create file
    await client.send("xOpen", [
      fid,
      filename,
      OpfsProxyClient.SQLITE_OPEN_CREATE |
        OpfsProxyClient.SQLITE_OPEN_READWRITE,
      0,
    ]);
    await client.send("xClose", [fid]);

    // Verify exists
    let rc = await client.send("xAccess", [filename]);
    expect(rc).toBe(OpfsProxyClient.SQLITE_OK);

    // Delete
    rc = await client.send("xDelete", [filename, 0]);
    expect(rc).toBe(OpfsProxyClient.SQLITE_OK);

    // Verify not exists (xAccess returns error)
    rc = await client.send("xAccess", [filename]);
    expect(rc).not.toBe(OpfsProxyClient.SQLITE_OK);
  });
});
