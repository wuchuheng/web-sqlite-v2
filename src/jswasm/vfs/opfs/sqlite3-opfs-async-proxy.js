"use strict";

/* global importScripts */

/**
 * Legacy worker entry point maintained for compatibility.
 * Delegates to the modular implementation under ./async-proxy/.
 */
(() => {
  const baseUrl = new URL("./async-proxy/", self.location.href);
  /** @type {import("./sqlite3-opfs-async-proxy.d.ts").AsyncProxyBaseUrl} */
  globalThis.__opfsAsyncProxyBaseUrl = baseUrl;
  importScripts(new URL("index.mjs", baseUrl).href);
})();
