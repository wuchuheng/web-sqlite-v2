import { afterEach, describe, expect, it, vi } from "vitest";

type CryptoMock = {
  getRandomValues: (view: Uint8Array) => Uint8Array;
};

const loadMemoryUtils = async () => {
  vi.resetModules();
  return await import("./memory-utils");
};

type GlobalWithOptionalCrypto = Omit<typeof globalThis, "crypto"> & {
  crypto?: Crypto;
};

const setGlobalCrypto = (value: CryptoMock | undefined) => {
  const target = globalThis as GlobalWithOptionalCrypto;
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, "crypto");
  delete target.crypto;
  if (value !== undefined) {
    target.crypto = value as unknown as Crypto;
  }
  return () => {
    if (originalDescriptor) {
      Object.defineProperty(target, "crypto", originalDescriptor);
    } else {
      delete target.crypto;
    }
  };
};

const createHeap = (size: number) => {
  const heap = new Uint8Array(size);
  heap.fill(1);
  return heap;
};

describe("memory-utils.mjs (baseline)", () => {
  let restoreCrypto: (() => void) | undefined;

  afterEach(() => {
    restoreCrypto?.();
    restoreCrypto = undefined;
  });

  it("initRandomFill proxies to crypto.getRandomValues", async () => {
    const getRandomValues = vi.fn((view: Uint8Array) => {
      view[0] = 0xab;
      return view;
    });
    restoreCrypto = setGlobalCrypto({ getRandomValues });
    const memoryUtils = await loadMemoryUtils();
    const fill = memoryUtils.initRandomFill();
    const view = new Uint8Array(4);
    fill(view);
    expect(getRandomValues).toHaveBeenCalledWith(view);
    expect(view[0]).toBe(0xab);
  });

  it("initRandomFill throws if crypto.getRandomValues is missing", async () => {
    restoreCrypto = setGlobalCrypto(undefined);
    const memoryUtils = await loadMemoryUtils();
    expect(() => memoryUtils.initRandomFill()).toThrow(
      "initRandomDevice: crypto.getRandomValues not available",
    );
  });

  it("randomFill caches the initialized fill helper", async () => {
    const getRandomValues = vi.fn((view: Uint8Array) => view);
    restoreCrypto = setGlobalCrypto({ getRandomValues });
    const memoryUtils = await loadMemoryUtils();
    const view = new Uint8Array([1, 2, 3]);
    memoryUtils.randomFill(view);
    memoryUtils.randomFill(view);
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("zeroMemory clears the requested heap slice", async () => {
    const memoryUtils = await loadMemoryUtils();
    const heap = createHeap(64);
    const slice = heap.subarray(16, 32);
    expect(slice.every((value) => value === 1)).toBe(true);
    memoryUtils.zeroMemory(heap, 16, 16);
    expect(slice.every((value) => value === 0)).toBe(true);
  });

  it("alignMemory rounds sizes up to the alignment", async () => {
    const memoryUtils = await loadMemoryUtils();
    expect(memoryUtils.alignMemory(1, 64)).toBe(64);
    expect(memoryUtils.alignMemory(65, 64)).toBe(128);
    expect(memoryUtils.alignMemory(65537, 65536)).toBe(131072);
  });

  it("createMmapAlloc aligns, allocates, and zeros memory", async () => {
    const memoryUtils = await loadMemoryUtils();
    const heap = createHeap(65536 * 2);
    const memalign = vi
      .fn()
      .mockImplementation((_align: number, _size: number) => 4096);
    const allocator = memoryUtils.createMmapAlloc(memalign, heap);
    const pointer = allocator(5000);
    expect(memalign).toHaveBeenCalledWith(65536, 65536);
    expect(pointer).toBe(4096);
    expect(
      heap.subarray(pointer, pointer + 65536).every((value) => value === 0),
    ).toBe(true);
    memalign.mockReturnValue(0);
    const failurePointer = allocator(5000);
    expect(failurePointer).toBe(0);
  });
});
