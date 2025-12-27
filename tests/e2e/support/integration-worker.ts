import { openDB } from "../../../src/main";

/**
 * Integration Worker
 *
 * Mimics a user-defined worker (like a Chrome Extension Background Service).
 * It uses the web-sqlite-js library to perform database operations.
 */

self.onmessage = async (e) => {
  if (e.data.type === "RUN_TEST") {
    try {
      const db = await openDB("worker-test-db");

      // Setup
      await db.exec(
        "CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, msg TEXT)",
      );
      await db.exec("INSERT INTO logs (msg) VALUES (?)", ["Worker is running"]);

      // Query
      const rows = await db.query<{ msg: string }>("SELECT msg FROM logs");

      await db.close();

      self.postMessage({
        success: true,
        data: rows,
      });
    } catch (err: unknown) {
      const error = err as Error;
      self.postMessage({
        success: false,
        error: error.message,
      });
    }
  }
};
