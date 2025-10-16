"use strict";

import { detectEnvironmentIssue, wPost } from "./environment.mjs";
import { AsyncProxyWorker } from "./async-proxy-worker.mjs";

/**
 * Entry point executed inside the OPFS worker.
 * Performs capability checks and boots the main worker implementation.
 */
const environmentIssues = detectEnvironmentIssue();
if (environmentIssues.length > 0) {
    wPost("opfs-unavailable", ...environmentIssues);
} else {
    const worker = new AsyncProxyWorker(wPost);
    worker.start().catch((error) => worker.logger.error(error));
}
