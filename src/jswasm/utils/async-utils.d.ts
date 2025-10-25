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
export declare const createAsyncLoad: (
  readAsync: AsyncReadFunction,
  getUniqueRunDependency: DependencyIdFactory,
  addRunDependency: DependencyTracker,
  removeRunDependency: DependencyTracker,
) => AsyncLoader;
