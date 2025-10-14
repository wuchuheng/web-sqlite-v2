/**
 * Asynchronous utility functions for loading resources
 * Provides async loading with dependency tracking
 */

/**
 * Asynchronously load a resource from a URL
 * Handles dependency tracking and error handling
 * @param {Function} readAsync - Async read function that returns Promise<ArrayBuffer>
 * @param {Function} getUniqueRunDependency - Function to get unique dependency ID
 * @param {Function} addRunDependency - Function to add a run dependency
 * @param {Function} removeRunDependency - Function to remove a run dependency
 * @param {string} url - URL to load from
 * @param {Function} onload - Callback function called with Uint8Array on success
 * @param {Function} onerror - Callback function called on error
 * @param {boolean} noRunDep - If true, don't track as a run dependency
 */
export const createAsyncLoad = (
    readAsync,
    getUniqueRunDependency,
    addRunDependency,
    removeRunDependency
) => {
    return (url, onload, onerror, noRunDep) => {
        // 1. Input handling - get unique dependency ID if needed
        var dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";

        // 2. Core processing - read async and handle result
        readAsync(url).then(
            (arrayBuffer) => {
                // 2.1. Success path
                onload(new Uint8Array(arrayBuffer));
                if (dep) removeRunDependency(dep);
            },
            (_err) => {
                // 2.2. Error path
                if (onerror) {
                    onerror();
                } else {
                    throw `Loading data file "${url}" failed.`;
                }
            }
        );

        // 3. Output handling - add dependency tracking
        if (dep) addRunDependency(dep);
    };
};
