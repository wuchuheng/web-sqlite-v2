import sqlite3InitModule from "@wuchuheng/web-sqlite";
import type { SQLite3API } from "@wuchuheng/web-sqlite";
import { createInstallOpfsVfsContext } from "../../src/jswasm/vfs/opfs/installer/installer/index";

type SQLite3WithOpfs = SQLite3API & {
  opfs?: { unlink: (path: string) => Promise<void> };
};

// Worker interface for test execution
self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === "run-opfs-test") {
    try {
      // 1. Initialize SQLite
      const sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });

      // 2. Install OPFS VFS manually if needed
      // (Note: default-bootstrap-state.mjs normally does this, but we want to be sure)
      if (!sqlite3.capi.sqlite3_vfs_find("opfs")) {
        const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3 as any);
        await installOpfsVfs({
          proxyUri:
            "../../../src/jswasm/vfs/opfs/sqlite3-opfs-async-proxy/sqlite3-opfs-async-proxy.js",
        });
      }

      // 3. Run the specific test operation
      // We'll pass the test logic/name in the payload
      const {
        testName: _testName,
        dbFile,
        sql,
        skipCleanup,
        checkEnv,
      } = payload;

      if (checkEnv) {
        const vfs = sqlite3.capi.sqlite3_vfs_find("opfs");
        const envInfo = {
          sqlite3Loaded: !!sqlite3,
          version: sqlite3.version,
          opfsVfsAvailable: !!vfs,
          dbClassAvailable: !!sqlite3.oo1?.DB,
        };
        self.postMessage({ type: "test-success", result: [envInfo] });
        return;
      }

      const dbPath = `file:${dbFile}?vfs=opfs`;
      const db = new sqlite3.oo1.DB(dbPath);

      let result;
      if (sql) {
        result = [];
        db.exec({
          sql,
          rowMode: "object",
          callback: (row) => {
            result.push(row);
          },
        });
      }

      db.close();

      // Cleanup
      // Only delete the file if skipCleanup is NOT true
      const sqlite3WithOpfs = sqlite3 as SQLite3WithOpfs;
      if (sqlite3WithOpfs.opfs && !skipCleanup) {
        await sqlite3WithOpfs.opfs.unlink(dbFile);
      }

      self.postMessage({ type: "test-success", result });
    } catch (err) {
      self.postMessage({ type: "test-failure", error: (err as Error).message });
    }
  }
};
