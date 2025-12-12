import { describe, expect, it, vi } from "vitest";
import {
  createCoreBindings,
  createOptionalBindings,
  createWasmInternalBindings,
} from "./core-bindings";
import type {
  Sqlite3BindingSignature,
  Sqlite3FuncPtrAdapter,
  Sqlite3FuncPtrAdapterOptions,
  Sqlite3WasmNamespace,
  Sqlite3XWrap,
  SQLite3CAPI,
} from "./core-bindings";

type WasmBindingNamespaceStub = Pick<
  Sqlite3WasmNamespace,
  "xWrap" | "cArgvToJs" | "cstrToJs" | "exports"
>;

class TestFuncPtrAdapter implements Sqlite3FuncPtrAdapter {
  readonly signature: string;
  readonly bindScope: "singleton" | "context" | "transient";
  readonly options: Sqlite3FuncPtrAdapterOptions;
  static warnOnUse = false;

  constructor(options: Sqlite3FuncPtrAdapterOptions) {
    this.signature = options.signature;
    this.bindScope = options.bindScope ?? "transient";
    this.options = options;
  }
}

const createWasmStub = (
  exports: Record<string, unknown> = {},
): WasmBindingNamespaceStub => {
  const xWrap = {
    FuncPtrAdapter: TestFuncPtrAdapter,
  } as unknown as Sqlite3XWrap;

  return {
    xWrap,
    cArgvToJs: vi.fn((argc, argvPointer) =>
      Array.from(
        { length: argc },
        (_value, index) => `${argvPointer}-${index}`,
      ),
    ),
    cstrToJs: vi.fn((pointer) => `str-${pointer}`),
    exports: exports as WasmBindingNamespaceStub["exports"],
  } as WasmBindingNamespaceStub;
};

const capiStub = { SQLITE_ERROR: 1 } as unknown as SQLite3CAPI;

const findSignature = (
  signatures: Sqlite3BindingSignature[],
  name: string,
): Sqlite3BindingSignature | undefined => {
  return signatures.find((entry) => entry[0] === name);
};

describe("createCoreBindings", () => {
  it("builds core signatures including sqlite3_exec with callback proxy", () => {
    const wasm = createWasmStub();
    const signatures = createCoreBindings(wasm, capiStub);
    const execSig = findSignature(signatures, "sqlite3_exec");

    expect(execSig).toBeDefined();
    const args = execSig?.[2] as unknown as unknown[];
    const callbackAdapter = args[2] as TestFuncPtrAdapter;

    expect(execSig?.[1]).toBe("int");
    expect(callbackAdapter).toBeInstanceOf(TestFuncPtrAdapter);
    expect(callbackAdapter.signature).toBe("i(pipp)");
    expect(callbackAdapter.bindScope).toBe("transient");

    const callback = vi.fn().mockReturnValue(7);
    const wrapped = callbackAdapter.options.callProxy?.(callback);
    const result = wrapped?.(0, 2, 100, 200);

    expect(result).toBe(7);
    expect(callback).toHaveBeenCalledWith(
      ["100-0", "100-1"],
      ["200-0", "200-1"],
    );

    const namesCalls = (
      wasm.cArgvToJs as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([, pointer]) => pointer === 200);
    expect(namesCalls).toHaveLength(1);

    const error = Object.assign(new Error("boom"), { resultCode: 99 });
    const errorProxy = callbackAdapter.options.callProxy?.(() => {
      throw error;
    });
    const errorResult = errorProxy?.(0, 1, 10, 20);
    expect(errorResult).toBe(99);
  });

  it("uses cached column names, falls back on generic errors, and normalizes context keys", () => {
    const wasm = createWasmStub();
    const signatures = createCoreBindings(wasm, capiStub);
    const execSig = findSignature(signatures, "sqlite3_exec");
    const execArgs = execSig?.[2] as unknown as unknown[];
    const execAdapter = execArgs[2] as TestFuncPtrAdapter;

    const callback = vi
      .fn<(...args: unknown[]) => number>()
      .mockReturnValueOnce(0)
      .mockImplementation(() => {
        throw new Error("generic");
      });
    const wrapped = execAdapter.options.callProxy?.(callback);

    const firstResult = wrapped?.(0, 1, 50, 60);
    const fallbackResult = wrapped?.(0, 1, 50, 60);
    const namesCalls = (
      wasm.cArgvToJs as ReturnType<typeof vi.fn>
    ).mock.calls.filter(([, pointer]) => pointer === 60);
    expect(firstResult).toBe(0);
    expect(namesCalls).toHaveLength(1);
    expect(fallbackResult).toBe(capiStub.SQLITE_ERROR);

    const busySig = findSignature(signatures, "sqlite3_busy_handler");
    const busyArgs = busySig?.[2] as unknown;
    const busyAdapter = (busyArgs as unknown[])[1] as TestFuncPtrAdapter;
    expect(busyAdapter.options.contextKey?.([7] as number[], 0)).toBe(7);

    const commitSig = findSignature(signatures, "sqlite3_commit_hook");
    const commitArgs = commitSig?.[2] as unknown;
    const commitAdapter = (commitArgs as unknown[])[1] as TestFuncPtrAdapter;
    expect(commitAdapter.options.contextKey?.([11] as number[], 0)).toBe(11);

    const rollbackSig = findSignature(signatures, "sqlite3_rollback_hook");
    const rollbackArgs = rollbackSig?.[2] as unknown;
    const rollbackAdapter = (
      rollbackArgs as unknown[]
    )[1] as TestFuncPtrAdapter;
    expect(rollbackAdapter.options.contextKey?.([22] as number[], 0)).toBe(22);

    const traceSig = findSignature(signatures, "sqlite3_trace_v2");
    const traceArgs = traceSig?.[2] as unknown;
    const traceAdapter = (traceArgs as unknown[])[2] as TestFuncPtrAdapter;
    expect(traceAdapter.options.contextKey?.([33] as number[], 0)).toBe(33);
  });
});

describe("createOptionalBindings", () => {
  it("returns empty optional bindings when features are missing", () => {
    const wasm = createWasmStub();
    const optional = createOptionalBindings(wasm, capiStub);

    expect(optional.progressHandler).toBeUndefined();
    expect(optional.stmtExplain).toBeUndefined();
    expect(optional.authorizer).toBeUndefined();
  });

  it("creates optional bindings when wasm exports are present", () => {
    const wasm = createWasmStub({
      sqlite3_progress_handler: true,
      sqlite3_stmt_explain: true,
      sqlite3_set_authorizer: true,
    });
    const optional = createOptionalBindings(wasm, capiStub);

    expect(optional.progressHandler?.[0]).toBe("sqlite3_progress_handler");
    const progressArgs = optional.progressHandler?.[2] as unknown as unknown[];
    const progressAdapter = progressArgs[2] as TestFuncPtrAdapter;
    expect(progressAdapter.signature).toBe("i(p)");
    expect(progressAdapter.bindScope).toBe("context");
    expect(progressAdapter.options.contextKey?.([123] as number[], 0)).toBe(
      123,
    );

    expect(optional.stmtExplain).toHaveLength(2);
    expect(optional.stmtExplain?.[0][0]).toBe("sqlite3_stmt_explain");
    expect(optional.stmtExplain?.[1][0]).toBe("sqlite3_stmt_isexplain");

    const authorizerArgs = optional.authorizer?.[2] as unknown as unknown[];
    const authorizerAdapter = authorizerArgs[1] as TestFuncPtrAdapter;
    const callback = vi.fn().mockReturnValue(0);
    const proxy = authorizerAdapter.options.callProxy?.(callback);

    proxy?.(1, 2, 3, 4, 5, 6);
    expect(wasm.cstrToJs).toHaveBeenCalledWith(3);
    expect(wasm.cstrToJs).toHaveBeenCalledWith(4);
    expect(callback).toHaveBeenCalledWith(
      1,
      2,
      "str-3",
      "str-4",
      "str-5",
      "str-6",
    );

    proxy?.(1, 2, 0, 0, 0, 0);
    expect(wasm.cstrToJs).toHaveBeenCalledWith(3);
    expect(callback).toHaveBeenCalledWith(1, 2, 0, 0, 0, 0);
    expect(authorizerAdapter.options.contextKey?.([44] as number[], 0)).toBe(
      44,
    );

    const fallbackProxy = authorizerAdapter.options.callProxy?.(() => {
      throw new Error("fail");
    });
    const result = fallbackProxy?.(0, 0, "x", "y", "z", "w");
    expect(result).toBe(capiStub.SQLITE_ERROR);
  });
});

describe("createWasmInternalBindings", () => {
  it("returns internal helper signatures", () => {
    const signatures = createWasmInternalBindings();
    expect(signatures[0][0]).toBe("sqlite3__wasm_db_reset");
    expect(
      signatures.some(
        (entry: Sqlite3BindingSignature) =>
          entry[0] === "sqlite3__wasm_qfmt_token",
      ),
    ).toBe(true);
  });
});
