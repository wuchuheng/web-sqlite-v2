import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSerializer } from "./serialization";
import type { OpfsState } from "../../../../../shared/opfs-vfs-installer.js";

describe("serialization.ts", () => {
  let state: OpfsState;
  let toss: (...args: unknown[]) => never;
  let sab: SharedArrayBuffer;
  const SAB_SIZE = 4096;
  const S11N_OFFSET = 0;
  const S11N_SIZE = 1024;

  beforeEach(() => {
    sab = new SharedArrayBuffer(SAB_SIZE);
    state = {
      sabIO: sab,
      sabS11nOffset: S11N_OFFSET,
      sabS11nSize: S11N_SIZE,
      littleEndian: true,
      // Minimal other properties to satisfy type, though unused by serializer
      verbose: 0,
      asyncIdleWaitTime: 0,
      asyncS11nExceptions: 0,
      fileBufferSize: 0,
      sabOP: new SharedArrayBuffer(100),
      opIds: {} as never,
      sq3Codes: {} as never,
      opfsFlags: {} as never,
    };
    toss = vi.fn((...args: unknown[]) => {
      throw new Error(args.join(" "));
    });
  });

  it("initializes correctly", () => {
    const serializer = createSerializer(state, toss);
    expect(serializer).toHaveProperty("serialize");
    expect(serializer).toHaveProperty("deserialize");
  });

  describe("serialize / deserialize", () => {
    it("handles empty arguments", () => {
      const serializer = createSerializer(state, toss);
      serializer.serialize();

      // Check first byte is 0 (argc)
      const view = new Uint8Array(sab, S11N_OFFSET);
      expect(view[0]).toBe(0);

      const result = serializer.deserialize();
      expect(result).toEqual(null);
    });

    it("handles numbers (float64)", () => {
      const serializer = createSerializer(state, toss);
      const input = [1.23, -4.56, 0, 42];
      serializer.serialize(...input);

      const result = serializer.deserialize();
      expect(result).toEqual(input);
    });

    it("handles bigints (int64)", () => {
      const serializer = createSerializer(state, toss);
      const input = [123n, -456n, 0n];
      serializer.serialize(...input);

      const result = serializer.deserialize();
      expect(result).toEqual(input);
    });

    it("handles booleans", () => {
      const serializer = createSerializer(state, toss);
      const input = [true, false];
      serializer.serialize(...input);

      const result = serializer.deserialize();
      // Implementation uses getInt32/setInt32 for booleans, so they come back as 0/1
      expect(result).toEqual([1, 0]);
    });

    it("handles strings", () => {
      const serializer = createSerializer(state, toss);
      const input = ["hello", "world", "🌟 emoji", ""];
      serializer.serialize(...input);

      const result = serializer.deserialize();
      expect(result).toEqual(input);
    });

    it("handles mixed types", () => {
      const serializer = createSerializer(state, toss);
      const input = [1, "two", true, 4n];
      serializer.serialize(...input);

      const result = serializer.deserialize();
      // Boolean true becomes 1
      expect(result).toEqual([1, "two", 1, 4n]);
    });

    it("clears buffer when requested", () => {
      const serializer = createSerializer(state, toss);
      serializer.serialize("test");

      const view = new Uint8Array(sab, S11N_OFFSET);
      expect(view[0]).toBe(1); // argc = 1

      const result = serializer.deserialize(true); // clear = true
      expect(result).toEqual(["test"]);
      expect(view[0]).toBe(0); // argc should be reset
    });

    it("throws on unsupported types", () => {
      const serializer = createSerializer(state, toss);
      const input = [{ foo: "bar" }]; // Object is not supported
      // @ts-expect-error -- Testing invalid input
      expect(() => serializer.serialize(...input)).toThrow();
    });
  });
});
