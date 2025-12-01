/*
  2022-09-16

  The author disclaims copyright to this source code.  In place of a
  legal notice, here is a blessing:

  *   May you do good and not evil.
  *   May you find forgiveness for yourself and forgive others.
  *   May you share freely, never taking more than you give.

  ***********************************************************************

  A Worker which manages asynchronous OPFS handles on behalf of a
  synchronous API which controls it via a combination of Worker
  messages, SharedArrayBuffer, and Atomics. It is the asynchronous
  counterpart of the API defined in sqlite3-vfs-opfs.js.

  This module wires together the sub-components that live in the same
  directory. Each helper attaches itself to `globalThis`, mirroring how
  the original single-file worker behaved when loaded via `importScripts()`.
*/

"use strict";

/* global importScripts, detectEnvironmentIssue, wPost, AsyncProxyWorker */

const baseUrl =
    globalThis.__opfsAsyncProxyBaseUrl ?? new URL("./", self.location.href);
const resolveUrl = (path) => new URL(path, baseUrl).href;

importScripts(
    resolveUrl("environment/environment.js"),
    resolveUrl("logging/logging.js"),
    resolveUrl("serialization-buffer/serialization-buffer.js"),
    resolveUrl("sync-handle-error.mjs"),
    resolveUrl("state.mjs"),
    resolveUrl("async-proxy-worker.mjs"),
);

delete globalThis.__opfsAsyncProxyBaseUrl;

(() => {
    const environmentIssues = detectEnvironmentIssue();
    if (environmentIssues.length) {
        wPost("opfs-unavailable", ...environmentIssues);
        return;
    }

    const worker = new AsyncProxyWorker(wPost);
    worker
        .start()
        .catch((error) => worker.logger.error("Worker start() failed:", error));
})();
