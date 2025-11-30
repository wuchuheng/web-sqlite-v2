import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We are testing the side effects of loading the module, which assigns to globalThis.
// Since ESM modules are cached, we assume the module is loaded once and we test the functions
// attached to globalThis.

describe("environment.mjs", () => {
  beforeEach(async () => {
    vi.stubGlobal("postMessage", vi.fn());
    // Load the module. If it's already loaded, this does nothing, which is fine
    // because the side effects (globals) persist.
    // We need to mock the globals BEFORE importing the script because the script might run immediately
    // or we might just load it and check the globals it sets.
    // But environment.ts assigns to globalThis.wPost etc.
    // @ts-expect-error: Import non-module script for side effects
    await import("./environment"); // Import the new TS source for its side effects
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wPost posts a structured message", () => {
    globalThis.wPost("test-type", "arg1", "arg2");
    expect(globalThis.postMessage).toHaveBeenCalledWith({
      type: "test-type",
      payload: ["arg1", "arg2"],
    });
  });

  it("toss throws an Error with joined parts", () => {
    expect(() => globalThis.toss("error", "message", 123)).toThrow(
      "error message 123",
    );
  });

  describe("detectEnvironmentIssue", () => {
    it("reports missing SharedArrayBuffer", () => {
      vi.stubGlobal("SharedArrayBuffer", undefined);
      vi.stubGlobal("Atomics", {});
      // Mock OPFS APIs to be present so we verify SAB check specifically
      vi.stubGlobal("FileSystemHandle", {});
      vi.stubGlobal("FileSystemDirectoryHandle", {});
      vi.stubGlobal("FileSystemFileHandle", {
        prototype: { createSyncAccessHandle: () => {} },
      });
      vi.stubGlobal("navigator", { storage: { getDirectory: () => {} } });

      const issues = globalThis.detectEnvironmentIssue();
      expect(issues.some((i) => i.includes("SharedArrayBuffer"))).toBe(true);
    });

    it("reports missing Atomics", () => {
      vi.stubGlobal("SharedArrayBuffer", {});
      vi.stubGlobal("Atomics", undefined);
      vi.stubGlobal("FileSystemHandle", {});
      vi.stubGlobal("FileSystemDirectoryHandle", {});
      vi.stubGlobal("FileSystemFileHandle", {
        prototype: { createSyncAccessHandle: () => {} },
      });
      vi.stubGlobal("navigator", { storage: { getDirectory: () => {} } });

      const issues = globalThis.detectEnvironmentIssue();
      expect(issues.some((i) => i.includes("Atomics"))).toBe(true);
    });

    it("reports missing OPFS APIs", () => {
      vi.stubGlobal("SharedArrayBuffer", {});
      vi.stubGlobal("Atomics", {});
      vi.stubGlobal("FileSystemHandle", undefined); // Missing

      const issues = globalThis.detectEnvironmentIssue();
      expect(issues).toContain("Missing required OPFS APIs.");
    });

    it("returns empty array when all requirements are met", () => {
      vi.stubGlobal("SharedArrayBuffer", {});
      vi.stubGlobal("Atomics", {});
      vi.stubGlobal("FileSystemHandle", {});
      vi.stubGlobal("FileSystemDirectoryHandle", {});
      vi.stubGlobal("FileSystemFileHandle", {
        prototype: { createSyncAccessHandle: () => {} },
      });
      vi.stubGlobal("navigator", { storage: { getDirectory: () => {} } });

      const issues = globalThis.detectEnvironmentIssue();
      expect(issues).toHaveLength(0);
    });
  });

  describe("getResolvedPath", () => {
    it("resolves paths correctly", () => {
      expect(globalThis.getResolvedPath("/a/b/c")).toEqual(["a", "b", "c"]);
    });

    it("handles multiple slashes", () => {
      expect(globalThis.getResolvedPath("/a//b///c/")).toEqual(["a", "b", "c"]);
    });
  });

  it("detectLittleEndian returns a boolean", () => {
    expect(typeof globalThis.detectLittleEndian()).toBe("boolean");
  });
});
