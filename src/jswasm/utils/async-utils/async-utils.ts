/**
 * Represents an asynchronous loader used to fetch binary content.
 */
export type AsyncLoader = (
  url: string,
  onload: (data: Uint8Array) => void,
  onerror?: () => void,
  noRunDep?: boolean,
) => void;

/**
 * Function used to asynchronously read binary content from a URL.
 */
export type AsyncReadFunction = (url: string) => Promise<ArrayBuffer>;

/**
 * Generates a unique run dependency identifier for tracking asynchronous work.
 */
export type DependencyIdFactory = (label: string) => string;

/**
 * Adds or removes run dependency tokens while asynchronous work is in flight.
 */
export type DependencyTracker = (dependencyId: string) => void;

/**
 * Creates an asynchronous loader that wires Emscripten run dependency tracking into fetches.
 */
export const createAsyncLoad = (
  readAsync: AsyncReadFunction,
  getUniqueRunDependency: DependencyIdFactory,
  addRunDependency: DependencyTracker,
  removeRunDependency: DependencyTracker,
): AsyncLoader => {
  const asyncLoader: AsyncLoader = (url, onload, onerror, noRunDep) => {
    // 1. Input handling - get unique dependency ID if needed
    const dep = !noRunDep ? getUniqueRunDependency(`al ${url}`) : "";

    // 2. Core processing - read async and handle result
    readAsync(url).then(
      (arrayBuffer) => {
        // 2.1. Success path
        onload(new Uint8Array(arrayBuffer));
        if (dep) {
          removeRunDependency(dep);
        }
      },
      (_err) => {
        // 2.2. Error path
        if (onerror) {
          onerror();
        } else {
          throw new Error(`Loading data file "${url}" failed.`);
        }
      },
    );

    // 3. Output handling - add dependency tracking
    if (dep) {
      addRunDependency(dep);
    }
  };

  return asyncLoader;
};
