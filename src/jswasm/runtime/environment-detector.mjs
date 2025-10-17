/**
 * Environment detection utilities for WebAssembly module initialization.
 * Detects whether the code is running in a web browser, web worker, or Node.js environment.
 *
 * @module runtime/environment-detector
 */

/**
 * Detects the current JavaScript execution environment.
 *
 * @returns {import("./environment-detector.d.ts").EnvironmentInfo} Environment detection results
 */
export function detectEnvironment() {
    // 1. Detect environment type
    const ENVIRONMENT_IS_WEB = typeof window === "object";
    const ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

    // 2. Determine script directory
    let scriptDirectory = "";

    if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
        if (ENVIRONMENT_IS_WORKER) {
            scriptDirectory = self.location.href;
        } else if (
            typeof document !== "undefined" &&
            document.currentScript
        ) {
            scriptDirectory = document.currentScript.src;
        }

        // Handle blob URLs
        if (scriptDirectory.startsWith("blob:")) {
            scriptDirectory = "";
        } else {
            scriptDirectory = scriptDirectory.substr(
                0,
                scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1
            );
        }
    }

    // 3. Return environment information
    return {
        ENVIRONMENT_IS_WEB,
        ENVIRONMENT_IS_WORKER,
        scriptDirectory,
    };
}

/**
 * Creates functions for reading files asynchronously and synchronously in the browser.
 *
 * @param {boolean} ENVIRONMENT_IS_WORKER - Whether running in a web worker
 * @returns {import("./environment-detector.d.ts").FileReaders} File reading functions
 */
export function createFileReaders(ENVIRONMENT_IS_WORKER) {
    const readers = {};

    // 1. Create synchronous binary reader for workers
    if (ENVIRONMENT_IS_WORKER) {
        readers.readBinary = (url) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response);
        };
    }

    // 2. Create asynchronous reader for all browser environments
    readers.readAsync = (url) => {
        return fetch(url, { credentials: "same-origin" }).then(
            (response) => {
                if (response.ok) {
                    return response.arrayBuffer();
                }
                return Promise.reject(
                    new Error(response.status + " : " + response.url)
                );
            }
        );
    };

    // 3. Return reader functions
    return readers;
}
