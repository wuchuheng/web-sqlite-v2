import { describe, it, expect } from "vitest";
import {
  UTF8ArrayToString,
  lengthBytesUTF8,
  stringToUTF8Array,
  intArrayFromString,
} from "./utf8";

describe("utf8 helpers", () => {
  it("roundtrips ASCII strings", () => {
    const s = "Hello, UTF8!";
    const bytes = new Uint8Array(lengthBytesUTF8(s) + 1);
    const written = stringToUTF8Array(s, bytes, 0, bytes.length);

    expect(written).toBe(lengthBytesUTF8(s));
    expect(bytes[written]).toBe(0); // null terminator
    const decoded = UTF8ArrayToString(bytes, 0, written + 1);
    expect(decoded).toBe(s);
  });

  it("handles multi-byte characters (BMP)", () => {
    const s = "こんにちは"; // Japanese greeting
    const len = lengthBytesUTF8(s);
    expect(len).toBeGreaterThan(s.length); // multibyte

    const buf = new Uint8Array(len + 1);
    const written = stringToUTF8Array(s, buf, 0, buf.length);
    expect(written).toBe(len);
    expect(UTF8ArrayToString(buf)).toBe(s);
  });

  it("handles surrogate pairs (non-BMP)", () => {
    const s = "😀"; // U+1F600
    const len = lengthBytesUTF8(s);
    expect(len).toBe(4);

    const buf = new Uint8Array(len + 1);
    const written = stringToUTF8Array(s, buf, 0, buf.length);
    expect(written).toBe(4);
    expect(UTF8ArrayToString(buf)).toBe(s);
  });

  it("intArrayFromString produces a null-terminated array by default", () => {
    const s = "abc";
    const arr = intArrayFromString(s);
    expect(arr[arr.length - 1]).toBe(0);
    const decoded = UTF8ArrayToString(new Uint8Array(arr));
    expect(decoded).toBe(s);
  });

  it("intArrayFromString respects dontAddNull flag", () => {
    const s = "xyz";
    const arr = intArrayFromString(s, true);
    expect(arr[arr.length - 1]).not.toBe(0);
    // Manually null-terminate to decode
    const term = new Uint8Array([...arr, 0]);
    expect(UTF8ArrayToString(term)).toBe(s);
  });

  it("UTF8ArrayToString respects maxBytesToRead and idx", () => {
    const s = "prefix\0ignored";
    const arr = new TextEncoder().encode(s); // includes null in middle
    const heap = new Uint8Array([...arr, 0]);
    const decoded = UTF8ArrayToString(heap, 0, 7); // "prefix\0" length
    expect(decoded).toBe("prefix");
  });

  it("works with plain number[] heaps as well", () => {
    const s = "plain-array";
    const arr = intArrayFromString(s); // number[]
    const decoded = UTF8ArrayToString(arr);
    expect(decoded).toBe(s);
  });
});
