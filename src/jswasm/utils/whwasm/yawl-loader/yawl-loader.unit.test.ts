import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { createYawlLoader } from "./yawl-loader";
import type { WhWasmHelperTarget } from "../installer-context/installer-context";

type MockWasmExports = {
  memory?: WebAssembly.Memory;
  malloc?: (n: number) => number;
  free?: (ptr: number) => void;
};

const TEST_URI = "/sqlite3.wasm";
const originalFetch = globalThis.fetch;
const originalWebAssembly = globalThis.WebAssembly;

function createInstantiateResult(
  exports: MockWasmExports = {},
): WebAssembly.WebAssemblyInstantiatedSource {
  return {
    module: {} as WebAssembly.Module,
    instance: {
      exports,
    } as unknown as WebAssembly.Instance,
  } as WebAssembly.WebAssemblyInstantiatedSource;
}

function mockFetch(buffer = new ArrayBuffer(4)) {
  const response = {
    arrayBuffer: vi.fn(() => Promise.resolve(buffer)),
  };
  const fetchMock = vi.fn(() =>
    Promise.resolve(response as unknown as Response),
  );
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return { fetchMock, response };
}

function mockWebAssembly(result: WebAssembly.WebAssemblyInstantiatedSource) {
  const instantiateStreaming = vi.fn(() => Promise.resolve(result));
  const instantiate = vi.fn(() => Promise.resolve(result));
  globalThis.WebAssembly = {
    ...originalWebAssembly,
    instantiateStreaming:
      instantiateStreaming as unknown as typeof WebAssembly.instantiateStreaming,
    instantiate: instantiate as unknown as typeof WebAssembly.instantiate,
  } as typeof WebAssembly;
  return { instantiateStreaming, instantiate };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.WebAssembly = originalWebAssembly;
});

describe("createYawlLoader", () => {
  it("creates loader that prefers instantiateStreaming by default", async () => {
    const install = vi.fn();
    const { fetchMock } = mockFetch();
    const instantiateResult = createInstantiateResult();
    const { instantiateStreaming, instantiate } =
      mockWebAssembly(instantiateResult);

    const yawlLoaderFactory = createYawlLoader(install);
    const load = yawlLoaderFactory({ uri: TEST_URI });

    expect(typeof load).toBe("function");
    await load();

    expect(fetchMock).toHaveBeenCalledWith(TEST_URI, {
      credentials: "same-origin",
    });
    expect(instantiateStreaming).toHaveBeenCalledTimes(1);
    expect(instantiate).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();
  });

  it("falls back to arrayBuffer path when noStreaming callback returns true", async () => {
    const install = vi.fn();
    const { fetchMock, response } = mockFetch();
    const instantiateResult = createInstantiateResult();
    const { instantiateStreaming, instantiate } =
      mockWebAssembly(instantiateResult);

    const options = {
      uri: TEST_URI,
      imports: { env: {} },
      noStreaming: () => true,
    } as const;
    const load = createYawlLoader(install)(options);
    await load();

    expect(instantiateStreaming).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.arrayBuffer).toHaveBeenCalledTimes(1);
    expect(instantiate).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      options.imports,
    );
  });

  it("wires wasmUtilTarget with module, instance, memory, and allocators", async () => {
    const install = vi.fn();
    const wasmExports: MockWasmExports = {
      malloc: vi.fn(() => 123),
      free: vi.fn(),
    };
    const instantiateResult = createInstantiateResult(wasmExports);
    mockFetch();
    mockWebAssembly(instantiateResult);

    const target: WhWasmHelperTarget = {};
    const imports = { env: { memory: {} as WebAssembly.Memory } };
    const load = createYawlLoader(install)({
      uri: TEST_URI,
      wasmUtilTarget: target,
      imports,
    });
    await load();

    expect(target.module).toBe(instantiateResult.module);
    expect(target.instance).toBe(instantiateResult.instance);
    expect(target.memory).toBe(imports.env.memory);
    expect(typeof target.alloc).toBe("function");
    expect(typeof target.dealloc).toBe("function");
    expect((target.alloc as (n: number) => number)(16)).toBe(123);
    expect(wasmExports.malloc).toHaveBeenCalledWith(16);
    (target.dealloc as (ptr: number) => void)(99);
    expect(wasmExports.free).toHaveBeenCalledWith(99);
    expect(install).toHaveBeenCalledWith(target);
  });

  it("invokes onload callback after installation", async () => {
    const install = vi.fn();
    const onload = vi.fn();
    const instantiateResult = createInstantiateResult();
    mockFetch();
    mockWebAssembly(instantiateResult);

    const options = { uri: TEST_URI, onload };
    const load = createYawlLoader(install)(options);
    const result = await load();

    expect(result).toBe(instantiateResult);
    expect(onload).toHaveBeenCalledWith(instantiateResult, options);
    expect(install).not.toHaveBeenCalled();
  });
});
