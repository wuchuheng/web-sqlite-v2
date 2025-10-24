import type {
    AsyncLoader,
    AsyncReadFunction,
    DependencyIdFactory,
    DependencyTracker,
} from "./async-utils.d.ts";

/**
 * Asynchronously load a resource from a URL while wiring up run dependency
 * tracking so Emscripten waits for the fetch to resolve before executing the
 * WASM module.
 */
export const createAsyncLoad = (
    readAsync: AsyncReadFunction,
    getUniqueRunDependency: DependencyIdFactory,
    addRunDependency: DependencyTracker,
    removeRunDependency: DependencyTracker
): AsyncLoader => {
    const asyncLoader: AsyncLoader = (url, onload, onerror, noRunDep) => {
        // 1. Input handling - get unique dependency ID if needed
        const dependencyId = !noRunDep
            ? getUniqueRunDependency(`al ${url}`)
            : "";

        // 2. Core processing - read async and handle result
        readAsync(url).then(
            (arrayBuffer) => {
                // 2.1. Success path
                onload(new Uint8Array(arrayBuffer));
                if (dependencyId) {
                    removeRunDependency(dependencyId);
                }
            },
            (_error) => {
                // 2.2. Error path
                if (onerror) {
                    onerror();
                } else {
                    throw new Error(`Loading data file "${url}" failed.`);
                }
            }
        );

        // 3. Output handling - add dependency tracking
        if (dependencyId) {
            addRunDependency(dependencyId);
        }
    };

    return asyncLoader;
};
