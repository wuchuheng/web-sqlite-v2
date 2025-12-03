import { afterEach, describe, expect, it, vi } from "vitest";
import { createAsyncLoad } from "./async-utils";

describe("createAsyncLoad", () => {
  const url = "https://example.com/data.bin";
  const sourceBuffer = new Uint8Array([1, 2, 3]).buffer;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads data, delivers a Uint8Array, and tracks dependencies", async () => {
    const readAsync = vi.fn().mockResolvedValue(sourceBuffer);
    const getUniqueRunDependency = vi.fn(() => "dep-id");
    const addRunDependency = vi.fn();
    const removeRunDependency = vi.fn();
    const loader = createAsyncLoad(
      readAsync,
      getUniqueRunDependency,
      addRunDependency,
      removeRunDependency,
    );

    await new Promise<void>((resolve, reject) => {
      loader(
        url,
        (data) => {
          expect(data).toEqual(new Uint8Array([1, 2, 3]));
          resolve();
        },
        reject,
      );
      expect(getUniqueRunDependency).toHaveBeenCalledWith(`al ${url}`);
      expect(addRunDependency).toHaveBeenCalledWith("dep-id");
    });

    expect(removeRunDependency).toHaveBeenCalledWith("dep-id");
  });

  it("invokes the explicit error handler when readAsync rejects", async () => {
    const readAsync = vi.fn().mockRejectedValue(new Error("network"));
    const getUniqueRunDependency = vi.fn(() => "dep-id");
    const addRunDependency = vi.fn();
    const removeRunDependency = vi.fn();
    const loader = createAsyncLoad(
      readAsync,
      getUniqueRunDependency,
      addRunDependency,
      removeRunDependency,
    );

    await new Promise<void>((resolve) => {
      loader(
        url,
        () => {
          throw new Error("should not succeed");
        },
        () => {
          expect(addRunDependency).toHaveBeenCalledWith("dep-id");
          expect(removeRunDependency).not.toHaveBeenCalled();
          resolve();
        },
      );
    });
  });

  it("lets unhandled rejections bubble when no error handler is provided", async () => {
    const readAsync = vi.fn().mockRejectedValue(new Error("io failure"));
    const getUniqueRunDependency = vi.fn(() => "dep-id");
    const addRunDependency = vi.fn();
    const loader = createAsyncLoad(
      readAsync,
      getUniqueRunDependency,
      addRunDependency,
      vi.fn(),
    );

    await new Promise<void>((resolve, reject) => {
      const handler = (reason: unknown) => {
        try {
          expect(reason).toBeInstanceOf(Error);
          expect((reason as Error).message).toContain(
            'Loading data file "https://example.com/data.bin" failed.',
          );
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      process.once("unhandledRejection", handler);
      loader(url, () => {
        throw new Error("should not succeed");
      });
    });
  });

  it("skips dependency tracking when requested", async () => {
    const readAsync = vi.fn().mockResolvedValue(sourceBuffer);
    const getUniqueRunDependency = vi.fn();
    const addRunDependency = vi.fn();
    const removeRunDependency = vi.fn();
    const loader = createAsyncLoad(
      readAsync,
      getUniqueRunDependency,
      addRunDependency,
      removeRunDependency,
    );

    await new Promise<void>((resolve, reject) => {
      loader(
        url,
        (data) => {
          expect(data).toEqual(new Uint8Array([1, 2, 3]));
          resolve();
        },
        reject,
        true,
      );
    });

    expect(getUniqueRunDependency).not.toHaveBeenCalled();
    expect(addRunDependency).not.toHaveBeenCalled();
    expect(removeRunDependency).not.toHaveBeenCalled();
  });
});
