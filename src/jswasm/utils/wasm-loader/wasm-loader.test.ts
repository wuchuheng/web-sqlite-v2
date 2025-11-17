import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WasmLoaderConfig, WasmModuleLike } from "./wasm-loader";

const loadWasmLoader = async () => {
  vi.resetModules();
  return await import("./wasm-loader");
};

const fakeBinary = new Uint8Array([0x42]).buffer;

const flushMicrotasks = () =>
  Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());

type ConfigOverrides = Omit<Partial<WasmLoaderConfig>, "Module"> & {
  Module?: Partial<WasmModuleLike>;
};

const createConfig = (overrides: ConfigOverrides = {}): WasmLoaderConfig => {
  const moduleOverrides = overrides.Module ?? {};
  const Module: WasmModuleLike = { ...moduleOverrides };
  const locateFile =
    overrides.locateFile ??
    vi.fn((path: string) => {
      return path;
    });
  return {
    Module,
    wasmBinary: overrides.wasmBinary,
    locateFile,
    readAsync:
      overrides.readAsync ??
      vi.fn(async () => {
        return fakeBinary;
      }),
    readBinary: overrides.readBinary,
    addRunDependency: overrides.addRunDependency ?? vi.fn(),
    removeRunDependency: overrides.removeRunDependency ?? vi.fn(),
    readyPromiseReject: overrides.readyPromiseReject ?? vi.fn(),
    addOnInit: overrides.addOnInit ?? vi.fn(),
    abort: overrides.abort ?? vi.fn(),
    err: overrides.err ?? vi.fn(),
    getWasmImports: overrides.getWasmImports ?? vi.fn(() => ({})),
    setWasmExports: overrides.setWasmExports ?? vi.fn(),
  };
};

const waitForAsyncInstantiation = async () => {
  await flushMicrotasks();
  await flushMicrotasks();
};

describe("wasm-loader.mjs (baseline)", () => {
  let originalFetch: typeof globalThis.fetch | undefined;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    if (originalFetch !== undefined) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("prefers Module.instantiateWasm and wires lifecycle hooks", async () => {
    const exampleCtor = vi.fn();
    const fakeExports = {
      __wasm_call_ctors: exampleCtor,
    };
    const instantiateWasm = vi
      .fn()
      .mockImplementation((_imports: WebAssembly.Imports, receive) => {
        return receive({ exports: fakeExports });
      });
    const addOnInit = vi.fn();
    const config = createConfig({
      Module: { instantiateWasm },
      addOnInit,
    });

    const { createWasmLoader } = await loadWasmLoader();
    const loader = createWasmLoader(config);

    const exports = loader.createWasm();

    expect(exports).toBe(fakeExports);
    expect(config.addRunDependency).toHaveBeenCalledWith("wasm-instantiate");
    expect(config.removeRunDependency).toHaveBeenCalledWith("wasm-instantiate");
    expect(config.setWasmExports).toHaveBeenCalledWith(fakeExports);
    expect(addOnInit).toHaveBeenCalledWith(exampleCtor);
    expect(instantiateWasm).toHaveBeenCalled();
  });

  it("falls back to ArrayBuffer instantiation when streaming compile fails", async () => {
    const instantiateStreamingSpy = vi
      .spyOn(WebAssembly, "instantiateStreaming")
      .mockRejectedValue(new Error("streaming error"));
    const instantiateSpy = vi
      .spyOn(WebAssembly, "instantiate")
      .mockResolvedValue({ exports: {} } as WebAssembly.Instance);
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(fakeBinary),
    });
    const err = vi.fn();
    const config = createConfig({
      err,
    });

    const { createWasmLoader } = await loadWasmLoader();
    const loader = createWasmLoader(config);
    loader.createWasm();

    await waitForAsyncInstantiation();

    expect(instantiateStreamingSpy).toHaveBeenCalled();
    expect(instantiateSpy).toHaveBeenCalled();
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("falling back to ArrayBuffer instantiation"),
    );
  });

  it("rejects the ready promise when both streaming and ArrayBuffer paths fail", async () => {
    vi.spyOn(WebAssembly, "instantiateStreaming").mockRejectedValue(
      new Error("streaming error"),
    );
    vi.spyOn(WebAssembly, "instantiate").mockRejectedValue(
      new Error("array buffer failure"),
    );
    const readyPromiseReject = vi.fn();
    const config = createConfig({
      readyPromiseReject,
      readAsync: vi.fn().mockRejectedValue(new Error("network")),
    });

    const { createWasmLoader } = await loadWasmLoader();
    const loader = createWasmLoader(config);
    loader.createWasm();

    await waitForAsyncInstantiation();

    expect(readyPromiseReject).toHaveBeenCalledWith(expect.any(Error));
  });

  it("honors Module.locateFile before falling back to import.meta.url", async () => {
    const moduleLocateFile = vi.fn();
    const locateFile = vi.fn().mockReturnValue("custom/sqlite3.wasm");
    const readAsync = vi.fn().mockResolvedValue(fakeBinary);
    vi.spyOn(WebAssembly, "instantiate").mockResolvedValue({
      exports: {},
    } as WebAssembly.Instance);
    globalThis.fetch = vi.fn().mockResolvedValue({
      arrayBuffer: vi.fn().mockResolvedValue(fakeBinary),
    });
    const config = createConfig({
      Module: { locateFile: moduleLocateFile },
      locateFile,
      readAsync,
    });

    const { createWasmLoader } = await loadWasmLoader();
    const loader = createWasmLoader(config);
    loader.createWasm();

    await waitForAsyncInstantiation();

    expect(locateFile).toHaveBeenCalledWith("sqlite3.wasm");
    expect(readAsync).toHaveBeenCalledWith("custom/sqlite3.wasm");
  });
});
