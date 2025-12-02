import { describe, test, expect } from "vitest";

describe("OPFS Worker Debug", () => {
  test("check browser environment", () => {
    console.log("Window location:", window.location.href);
    console.log("User agent:", navigator.userAgent);
    console.log(
      "SharedArrayBuffer available:",
      typeof SharedArrayBuffer !== "undefined",
    );
    console.log(
      "OPFS available:",
      "storage" in navigator && "getDirectory" in navigator.storage,
    );
    console.log("Worker available:", typeof Worker !== "undefined");

    expect(typeof Worker).toBe("function");
  });

  test("fetch worker file directly", async () => {
    // Try different possible URLs for the worker file
    const workerUrl = new URL("./sqlite3-opfs-async-proxy.js", import.meta.url)
      .href; // Same directory

    const response = await fetch(workerUrl);
    console.log(`Response status for ${workerUrl}:`, response.status);
    expect(response.ok).toBe(true);

    console.log(`SUCCESS: Worker file found at ${workerUrl}`);
    const text = await response.text();
    console.log("Worker file size:", text.length);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("opfs-async-loaded");
    return; // Exit the test successfully
  });
});
