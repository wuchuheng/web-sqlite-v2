import type { Stmt } from "@wuchuheng/web-sqlite";
import type { Oo1Context } from "../../context";
import type { StatementValidators } from "../validation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createBindingHelpers } from "./binding";

describe("binding", () => {
  const mockCapi = {
    sqlite3_bind_null: vi.fn(),
    sqlite3_bind_text: vi.fn(),
    sqlite3_bind_blob: vi.fn(),
    sqlite3_bind_int: vi.fn(),
    sqlite3_bind_int64: vi.fn(),
    sqlite3_bind_double: vi.fn(),
    SQLITE_WASM_DEALLOC: 12345,
  };

  const mockWasm = {
    bigIntEnabled: true,
    allocCString: vi.fn(),
    alloc: vi.fn(),
    heap8: vi.fn(),
  };

  const mockUtil = {
    isBindableTypedArray: vi.fn(),
    isInt32: vi.fn(),
    bigIntFits64: vi.fn(),
    bigIntFitsDouble: vi.fn(),
  };

  const mockContext = {
    sqlite3: {
      config: {
        warn: vi.fn(),
      },
    },
    capi: mockCapi,
    wasm: mockWasm,
    util: mockUtil,
    toss: vi.fn((...args) => {
      throw new Error(args.join(" "));
    }),
    checkRc: vi.fn(),
  } as unknown as Oo1Context;

  const mockValidators = {
    pointerOf: vi.fn(),
    ensureStmtOpen: vi.fn(),
    ensureNotLockedByExec: vi.fn(),
    resolveParameterIndex: vi.fn(),
  } as unknown as StatementValidators;

  const helpers = createBindingHelpers(mockContext, mockValidators);

  beforeEach(() => {
    vi.clearAllMocks();
    mockWasm.bigIntEnabled = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockValidators.ensureStmtOpen as any).mockImplementation((s: any) => s);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockValidators.ensureNotLockedByExec as any).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockValidators.resolveParameterIndex as any).mockReturnValue(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockValidators.pointerOf as any).mockReturnValue(100);
    mockWasm.allocCString.mockReturnValue([200, 10]); // ptr, len
    mockCapi.sqlite3_bind_text.mockReturnValue(0);
    mockCapi.sqlite3_bind_null.mockReturnValue(0);
    mockCapi.sqlite3_bind_int.mockReturnValue(0);
    mockCapi.sqlite3_bind_int64.mockReturnValue(0);
    mockCapi.sqlite3_bind_double.mockReturnValue(0);
    mockCapi.sqlite3_bind_blob.mockReturnValue(0);
  });

  describe("determineBindType", () => {
    it("identifies null and undefined as null", () => {
      expect(helpers.determineBindType(null)).toBe(helpers.BindTypes.null);
      expect(helpers.determineBindType(undefined)).toBe(helpers.BindTypes.null);
    });

    it("identifies numbers", () => {
      expect(helpers.determineBindType(123)).toBe(helpers.BindTypes.number);
      expect(helpers.determineBindType(123.45)).toBe(helpers.BindTypes.number);
    });

    it("identifies strings", () => {
      expect(helpers.determineBindType("hello")).toBe(helpers.BindTypes.string);
    });

    it("identifies booleans", () => {
      expect(helpers.determineBindType(true)).toBe(helpers.BindTypes.boolean);
      expect(helpers.determineBindType(false)).toBe(helpers.BindTypes.boolean);
    });

    it("identifies bigints", () => {
      expect(helpers.determineBindType(123n)).toBe(helpers.BindTypes.bigint);

      const disabledWasm = { ...mockWasm, bigIntEnabled: false };
      const disabledContext = {
        ...mockContext,
        wasm: disabledWasm,
      } as unknown as Oo1Context;
      const disabledHelpers = createBindingHelpers(
        disabledContext,
        mockValidators,
      );
      expect(disabledHelpers.determineBindType(123n)).toBe(undefined);
    });

    it("identifies blobs", () => {
      mockUtil.isBindableTypedArray.mockReturnValue(true);
      expect(helpers.determineBindType(new Uint8Array())).toBe(
        helpers.BindTypes.blob,
      );
      mockUtil.isBindableTypedArray.mockReturnValue(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(helpers.determineBindType({} as any)).toBe(undefined);
    });
  });

  describe("ensureSupportedBindType", () => {
    it("returns type for supported values", () => {
      expect(helpers.ensureSupportedBindType(123)).toBe(
        helpers.BindTypes.number,
      );
    });

    it("throws for unsupported values", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => helpers.ensureSupportedBindType({} as any)).toThrow(
        "Unsupported bind() argument type: object",
      );
    });
  });

  describe("bindString", () => {
    it("binds string as text", () => {
      const result = helpers.bindString(100, 1, "test", false);
      expect(mockWasm.allocCString).toHaveBeenCalledWith("test", true);
      expect(mockCapi.sqlite3_bind_text).toHaveBeenCalledWith(
        100,
        1,
        200,
        10,
        mockCapi.SQLITE_WASM_DEALLOC,
      );
      expect(result).toBe(0);
    });

    it("binds string as blob", () => {
      const result = helpers.bindString(100, 1, "test", true);
      expect(mockWasm.allocCString).toHaveBeenCalledWith("test", true);
      expect(mockCapi.sqlite3_bind_blob).toHaveBeenCalledWith(
        100,
        1,
        200,
        10,
        mockCapi.SQLITE_WASM_DEALLOC,
      );
      expect(result).toBe(0);
    });
  });

  describe("bindSingleValue", () => {
    const mockStmt = { db: {} } as unknown as Stmt;

    it("binds null", () => {
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.null, null);
      expect(mockCapi.sqlite3_bind_null).toHaveBeenCalledWith(100, 1);
    });

    it("binds string", () => {
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.string, "val");
      expect(mockCapi.sqlite3_bind_text).toHaveBeenCalled();
    });

    it("binds int32", () => {
      mockUtil.isInt32.mockReturnValue(true);
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.number, 123);
      expect(mockCapi.sqlite3_bind_int).toHaveBeenCalledWith(100, 1, 123);
    });

    it("binds double", () => {
      mockUtil.isInt32.mockReturnValue(false);
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.number, 123.45);
      expect(mockCapi.sqlite3_bind_double).toHaveBeenCalledWith(100, 1, 123.45);
    });

    it("binds bigint as int64 when enabled", () => {
      mockUtil.isInt32.mockReturnValue(false);
      mockUtil.bigIntFits64.mockReturnValue(true);
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.number, 123n);
      expect(mockCapi.sqlite3_bind_int64).toHaveBeenCalledWith(100, 1, 123n);
    });

    it("binds bigint as double when disabled but fits", () => {
      mockWasm.bigIntEnabled = false;
      mockUtil.isInt32.mockReturnValue(false);
      mockUtil.bigIntFits64.mockReturnValue(true);

      mockUtil.bigIntFitsDouble.mockReturnValue(true);
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.number, 123n);
      expect(mockCapi.sqlite3_bind_double).toHaveBeenCalledWith(100, 1, 123);
    });

    it("binds number as int64 when bigIntEnabled and integer", () => {
      mockUtil.isInt32.mockReturnValue(false);
      // value is number, not bigint
      helpers.bindSingleValue(
        mockStmt,
        1,
        helpers.BindTypes.number,
        9999999999,
      );
      expect(mockCapi.sqlite3_bind_int64).toHaveBeenCalledWith(
        100,
        1,
        9999999999n,
      );
    });

    it("binds boolean", () => {
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.boolean, true);
      expect(mockCapi.sqlite3_bind_int).toHaveBeenCalledWith(100, 1, 1);
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.boolean, false);
      expect(mockCapi.sqlite3_bind_int).toHaveBeenCalledWith(100, 1, 0);
    });

    it("binds blob from string", () => {
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.blob, "blobstr");
      expect(mockCapi.sqlite3_bind_blob).toHaveBeenCalled();
    });

    it("binds blob from Uint8Array", () => {
      const blob = new Uint8Array([1, 2, 3]);
      mockUtil.isBindableTypedArray.mockReturnValue(true);
      mockWasm.alloc.mockReturnValue(300);
      const heap = new Uint8Array(1000);
      mockWasm.heap8.mockReturnValue(heap);

      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.blob, blob);

      expect(mockWasm.alloc).toHaveBeenCalledWith(3);
      expect(heap[300]).toBe(1);
      expect(heap[301]).toBe(2);
      expect(heap[302]).toBe(3);
      expect(mockCapi.sqlite3_bind_blob).toHaveBeenCalledWith(
        100,
        1,
        300,
        3,
        mockCapi.SQLITE_WASM_DEALLOC,
      );
    });

    it("throws on unsupported blob type", () => {
      mockUtil.isBindableTypedArray.mockReturnValue(false);
      expect(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.blob, {} as any),
      ).toThrow(
        "Binding a value as a blob requires that it be a string, Uint8Array, Int8Array, or ArrayBuffer.",
      );
    });

    it("checks rc", () => {
      mockCapi.sqlite3_bind_null.mockReturnValue(5); // SQLITE_BUSY or similar
      helpers.bindSingleValue(mockStmt, 1, helpers.BindTypes.null, null);
      expect(mockContext.checkRc).toHaveBeenCalledWith(mockStmt.db, 5);
    });
  });
});
