import type { WhWasmHelperTarget } from "../installer-context/installer-context";
import { describe, expect, it, beforeEach } from "vitest";
import { WhWasmInstallerContext } from "../installer-context/installer-context";
import type { WhWasmInstallerContext as WhWasmInstallerContextType } from "../installer-context/installer-context";
import { applyDefaults } from "./defaults";

describe("applyDefaults", () => {
  let mockTarget: WhWasmHelperTarget;
  let mockContext: WhWasmInstallerContextType;

  beforeEach(() => {
    // Create a mock target with minimal required properties
    mockTarget = {
      pointerIR: "i32",
      ptrSizeof: 4,
      memory: new WebAssembly.Memory({ initial: 1 }),
      instance: {
        exports: {
          memory: new WebAssembly.Memory({ initial: 1 }),
          __indirect_function_table: new WebAssembly.Table({
            element: "anyfunc",
            initial: 1,
          }),
        },
      },
    };

    // Create context using the actual implementation
    mockContext = new WhWasmInstallerContext(mockTarget);
  });

  it("preserves existing bigIntEnabled when already set", () => {
    // 1. Input handling
    mockTarget.bigIntEnabled = true;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.bigIntEnabled).toBe(true);
  });

  it("sets bigIntEnabled based on BigInt64Array availability when undefined", () => {
    // 1. Input handling
    const originalBigInt64Array = globalThis.BigInt64Array;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Temporarily removing BigInt64Array for testing
    delete (globalThis as { BigInt64Array?: typeof BigInt64Array })
      .BigInt64Array;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.bigIntEnabled).toBe(false);

    // Restore original BigInt64Array
    globalThis.BigInt64Array = originalBigInt64Array;
  });

  it("sets bigIntEnabled to true when BigInt64Array is available", () => {
    // 1. Input handling
    if (!globalThis.BigInt64Array) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Adding BigInt64Array for testing
      (globalThis as { BigInt64Array?: typeof BigInt64Array }).BigInt64Array =
        BigInt64Array;
    }

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.bigIntEnabled).toBe(true);
  });

  it("creates exports property getter when not present", () => {
    // 1. Input handling
    delete (mockTarget as { exports?: unknown }).exports;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(
      Object.getOwnPropertyDescriptor(mockTarget, "exports"),
    ).toMatchObject({
      enumerable: true,
      configurable: true,
    });

    // Test that the getter returns instance.exports
    expect(mockTarget.exports).toBe(mockTarget.instance?.exports);
  });

  it("preserves existing exports property when present", () => {
    // 1. Input handling
    const existingExports = { test: "value" };
    mockTarget.exports = existingExports as unknown as WebAssembly.Exports;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.exports).toBe(existingExports);
  });

  it("assigns pointerIR and ptrSizeof from context to target", () => {
    // 1. Input handling
    delete (mockTarget as { pointerIR?: string }).pointerIR;
    delete (mockTarget as { ptrSizeof?: number }).ptrSizeof;

    // Mock context with different values
    mockContext.ptrIR = "i64";
    mockContext.ptrSizeof = 8;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.pointerIR).toBe("i64");
    expect(mockTarget.ptrSizeof).toBe(8);
  });

  it("overwrites pointerIR and ptrSizeof from context to target", () => {
    // 1. Input handling
    mockTarget.pointerIR = "i64";
    mockTarget.ptrSizeof = 8;

    mockContext.ptrIR = "i32";
    mockContext.ptrSizeof = 4;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.pointerIR).toBe("i32");
    expect(mockTarget.ptrSizeof).toBe(4);
  });

  it("works without instance property", () => {
    // 1. Input handling
    delete (mockTarget as { instance?: { exports?: unknown } }).instance;
    delete (mockTarget as { exports?: unknown }).exports;

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    expect(mockTarget.exports).toBeUndefined();
  });

  it("applies all default properties to target", () => {
    // 1. Input handling
    // No special setup needed

    // 2. Core processing
    applyDefaults(mockContext);

    // 3. Output handling
    // Function always ensures bigIntEnabled is set
    expect(typeof mockTarget.bigIntEnabled).toBe("boolean");
    // Function always assigns pointerIR and ptrSizeof from context
    expect(mockTarget.pointerIR).toBe(mockContext.ptrIR);
    expect(mockTarget.ptrSizeof).toBe(mockContext.ptrSizeof);
    // Function always ensures exports property exists
    expect(mockTarget).toHaveProperty("exports");
  });
});
