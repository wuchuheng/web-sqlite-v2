import type {
  WhWasmHelperTarget,
  WhWasmInstaller,
  WhWasmValue,
} from "../installer-context/installer-context";

/**
 * Configuration object accepted by the yawl() loader helper.
 */
export interface YawlLoaderConfig {
  /** WebAssembly URI used when fetching the module. */
  uri: string;
  /** Optional imports object forwarded to instantiate. */
  imports?: WebAssembly.Imports;
  /** Optional loader callback invoked after instantiation. */
  onload?: (
    result: WebAssembly.WebAssemblyInstantiatedSource,
    options: YawlLoaderConfig,
  ) => void;
  /** Optional flag or callback disabling instantiateStreaming. */
  noStreaming?: boolean | (() => boolean);
  /** Target object that receives the wh-wasm helpers. */
  wasmUtilTarget?: WhWasmHelperTarget;
}

/**
 * Loader factory produced by the yawl() helper.
 */
export type YawlLoaderFactory = (
  config?: Partial<YawlLoaderConfig>,
) => () => Promise<WebAssembly.WebAssemblyInstantiatedSource>;

type NormalizedYawlConfig = Partial<YawlLoaderConfig>;
type YawlExports = WebAssembly.Exports & {
  memory?: WebAssembly.Memory;
  malloc?: (size: number) => number;
  free?: (ptr: number) => void;
};

/**
 * Builds the yawl() loader helper that orchestrates WASM instantiation.
 *
 * @param install Installer returned by createWhWasmUtilInstaller.
 * @returns Factory returning a function that loads and instantiates the WASM module.
 */
export function createYawlLoader(install: WhWasmInstaller): YawlLoaderFactory {
  return (config?: NormalizedYawlConfig) => {
    // 1. Input handling - normalize options and set up fetch helper.
    const options = normalizeConfig(config);
    const fetchWasm = () =>
      fetch(options.uri as RequestInfo, { credentials: "same-origin" });

    // 2. Core processing - build finalize handler and instantiate thunk.
    const finalize = (
      result: WebAssembly.WebAssemblyInstantiatedSource,
    ): WebAssembly.WebAssemblyInstantiatedSource => {
      if (options.wasmUtilTarget) {
        prepareTarget(options, result, install);
      }
      if (options.onload) {
        options.onload(result, options as YawlLoaderConfig);
      }
      return result;
    };

    const instantiate = () => {
      if (
        typeof WebAssembly.instantiateStreaming === "function" &&
        !shouldSkipStreaming(options.noStreaming)
      ) {
        return WebAssembly.instantiateStreaming(
          fetchWasm(),
          options.imports || {},
        ).then(finalize);
      }

      return fetchWasm()
        .then((response) => response.arrayBuffer())
        .then((bytes) => WebAssembly.instantiate(bytes, options.imports || {}))
        .then(finalize);
    };

    // 3. Output handling - return the instantiate thunk.
    return instantiate;
  };
}

function normalizeConfig(config?: NormalizedYawlConfig): NormalizedYawlConfig {
  return config && typeof config === "object" ? config : {};
}

function shouldSkipStreaming(noStreaming?: boolean | (() => boolean)): boolean {
  if (typeof noStreaming === "function") {
    return Boolean(noStreaming());
  }
  return Boolean(noStreaming);
}

function prepareTarget(
  options: NormalizedYawlConfig,
  result: WebAssembly.WebAssemblyInstantiatedSource,
  install: WhWasmInstaller,
): void {
  // 1. Input handling - copy the instantiate result onto the target.
  const target = options.wasmUtilTarget as WhWasmHelperTarget;
  target.module = result.module;
  target.instance = result.instance;

  const exports = result.instance.exports as YawlExports;

  // 2. Core processing - hydrate memory references and allocators.
  if (!exports.memory) {
    target.memory =
      readImportsMemory(options) || toss("Missing 'memory' object!");
  }
  if (!target.alloc && typeof exports.malloc === "function") {
    target.alloc = (size: number) =>
      exports.malloc?.(size) || toss("Allocation of", size, "bytes failed.");
    target.dealloc = (ptr: number): WhWasmValue => {
      exports.free?.(ptr);
      return undefined;
    };
  }

  // 3. Output handling - run the installer so helpers attach to the target.
  install(target);
}

function readImportsMemory(
  options: NormalizedYawlConfig,
): WebAssembly.Memory | undefined {
  const imports = options.imports as
    | {
        env?: { memory?: WebAssembly.Memory };
      }
    | undefined;
  const env = imports?.env;
  return env?.memory;
}

function toss(...args: unknown[]): never {
  throw new Error(args.join(" "));
}
