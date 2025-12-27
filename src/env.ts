/**
 * The name assigned to workers spawned by this library.
 */
export const WORKER_NAME = "web-sqlite-js-worker";

/**
 * Detects if the current script is running inside a Dedicated Worker
 * that was specifically spawned by this library to act as a server.
 *
 * @returns {boolean} True if in the library's dedicated worker context.
 */
export const isLibraryWorker = (): boolean =>
  typeof self !== "undefined" &&
  "WorkerGlobalScope" in self &&
  (self as any).name === WORKER_NAME; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Detects if the current script is running inside any Worker context
 * (Dedicated Worker, Service Worker, etc.)
 *
 * @returns {boolean} True if in any worker global scope.
 */
export const isWorker = (): boolean =>
  typeof self !== "undefined" && "WorkerGlobalScope" in self;

/**
 * Detects if the current script is running inside a Service Worker.
 * Service Workers (like Chrome Extension backgrounds) cannot spawn nested workers.
 *
 * @returns {boolean} True if in a service worker context.
 */
export const isServiceWorker = (): boolean =>
  typeof self !== "undefined" && "ServiceWorkerGlobalScope" in self;

/**
 * Detects if the environment supports the Worker API.
 *
 * @returns {boolean} True if Workers are supported.
 */
export const supportsWorkers = (): boolean => typeof Worker !== "undefined";

/**
 * Determines if the database engine should run in the same thread as the caller.
 *
 * @returns {boolean} True if same-thread execution is required.
 */
export const isSameThreadRequired = (): boolean =>
  isServiceWorker() || !supportsWorkers() || isWorker();
