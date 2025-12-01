import { describe, it, expect, beforeEach } from "vitest";

// Baseline tests target the existing global class provided by the script variant
// We load the original .mjs for its side effects so globalThis.SerializationBuffer exists
describe("serialization-buffer.mjs baseline", () => {
  beforeEach(async () => {
    // Load either the TS script (compiled to JS) or the original .mjs, whichever is available.
    // Prefer the new compiled JS next to the TS source
    // @ts-expect-error: side-effect import
    await import("./serialization-buffer");
  });

  function makeBuffer() {
    const sab = new SharedArrayBuffer(1024);
    const Ctor = globalThis.SerializationBuffer as unknown as new (o: {
      readonly sharedBuffer: SharedArrayBuffer;
      readonly offset: number;
      readonly size: number;
      readonly littleEndian: boolean;
      readonly exceptionVerbosity: number;
    }) => any;
    return new Ctor({
      sharedBuffer: sab,
      offset: 0,
      size: 1024,
      littleEndian: true,
      exceptionVerbosity: 2,
    });
  }

  it("serializes and deserializes number", () => {
    const s = makeBuffer();
    s.serialize(3.14159);
    const out = s.deserialize(true);
    expect(out).toEqual([3.14159]);
  });

  it("serializes and deserializes bigint", () => {
    const s = makeBuffer();
    s.serialize(1234n);
    const out = s.deserialize(true);
    expect(out).toEqual([1234n]);
  });

  it("serializes and deserializes boolean", () => {
    const s = makeBuffer();
    s.serialize(true);
    const out = s.deserialize(true);
    // baseline encodes boolean via Int32; getInt32 returns 1
    expect(out).toEqual([1]);
  });

  it("serializes and deserializes string", () => {
    const s = makeBuffer();
    s.serialize("hello");
    const out = s.deserialize(true);
    expect(out).toEqual(["hello"]);
  });

  it("mixed values preserve order", () => {
    const s = makeBuffer();
    s.serialize("a", 42, 7n, false);
    const out = s.deserialize(true);
    expect(out[0]).toBe("a");
    expect(out[1]).toBe(42);
    expect(out[2]).toBe(7n);
    expect(out[3]).toBe(0);
  });

  it("empty payload returns [] and clears header when requested", () => {
    const s = makeBuffer();
    s.serialize();
    const out = s.deserialize(true);
    expect(out).toEqual([]);
  });

  it("storeException respects verbosity and formats errors", () => {
    const s = makeBuffer();
    s.storeException(1, new Error("boom"));
    const out = s.deserialize(true);
    expect(out).toEqual(["Error: boom"]);
  });
});
