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

  // test("keep browser open for debugging", async () => {
  //   console.log("Browser will stay open for 60 seconds for debugging...");
  //   console.log(
  //     "Check Chrome DevTools Network tab for worker file loading issues",
  //   );
  //   console.log("Possible Worker URLs to try:");
  //   console.log(
  //     "1. Same directory:",
  //     new URL("./sqlite3-opfs-async-proxy.js", import.meta.url).href,
  //   );
  //   console.log(
  //     "2. Parent directory:",
  //     new URL("../sqlite3-opfs-async-proxy.js", import.meta.url).href,
  //   );
  //   console.log(
  //     "3. Absolute path:",
  //     "/src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy.js",
  //   );
  //   console.log("4. Root path:", "/sqlite3-opfs-async-proxy.js");

  //   // Keep browser open for 60 seconds
  //   await new Promise((resolve) => setTimeout(resolve, 60000));

  //   console.log("60 seconds completed, test finishing...");
  // }, 65000);
  // test("create worker and check initialization", async () => {
  //   return new Promise((resolve, reject) => {
  //     const workerPath = new URL("../sqlite3-opfs-async-proxy.js", import.meta.url).href;
  //     console.log("Creating worker from:", workerPath);

  //     try {
  //       const worker = new Worker(workerPath);
  //       console.log("Worker created successfully");

  //       let messageReceived = false;

  //       worker.onmessage = (event) => {
  //         console.log("Worker message:", event.data);
  //         messageReceived = true;
  //         worker.terminate();
  //         resolve(event.data);
  //       };

  //       worker.onerror = (error) => {
  //         console.error("Worker error:", error);
  //         worker.terminate();
  //         reject(error);
  //       };

  //       // Wait up to 10 seconds for a message
  //       setTimeout(() => {
  //         if (!messageReceived) {
  //           worker.terminate();
  //           reject(new Error("No message received from worker after 10 seconds"));
  //         }
  //       }, 10000);

  //     } catch (error) {
  //       console.error("Failed to create worker:", error);
  //       reject(error);
  //     }
  //   });
  // }, 15000);
});
