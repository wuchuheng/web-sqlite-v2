import { describe, it, expect, afterEach } from "vitest";
import {
  validateOpfsEnvironment,
  thisThreadHasOPFS,
} from "./environment-validation";

describe("environment-validation", () => {
  // Store original globals
  const originalSharedArrayBuffer = globalThis.SharedArrayBuffer;
  const originalAtomics = globalThis.Atomics;
  const originalWorkerGlobalScope = globalThis.WorkerGlobalScope;
  const originalFileSystemHandle = globalThis.FileSystemHandle;
  const originalFileSystemDirectoryHandle =
    globalThis.FileSystemDirectoryHandle;
  const originalFileSystemFileHandle = globalThis.FileSystemFileHandle;
  const originalNavigator = globalThis.navigator;

  afterEach(() => {
    // Restore globals
    Object.defineProperty(globalThis, "SharedArrayBuffer", {
      value: originalSharedArrayBuffer,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "Atomics", {
      value: originalAtomics,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "WorkerGlobalScope", {
      value: originalWorkerGlobalScope,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "FileSystemHandle", {
      value: originalFileSystemHandle,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "FileSystemDirectoryHandle", {
      value: originalFileSystemDirectoryHandle,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "FileSystemFileHandle", {
      value: originalFileSystemFileHandle,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe("validateOpfsEnvironment", () => {
    const setValidEnvironment = () => {
      Object.defineProperty(globalThis, "SharedArrayBuffer", {
        value: ArrayBuffer,
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "Atomics", {
        value: {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "WorkerGlobalScope", {
        value: function () {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "FileSystemHandle", {
        value: function () {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "FileSystemDirectoryHandle", {
        value: function () {},
        writable: true,
        configurable: true,
      });

      const mockFileSystemFileHandle = function () {};
      mockFileSystemFileHandle.prototype = { createSyncAccessHandle: () => {} };
      Object.defineProperty(globalThis, "FileSystemFileHandle", {
        value: mockFileSystemFileHandle,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "navigator", {
        value: { storage: { getDirectory: () => {} } },
        writable: true,
        configurable: true,
      });
    };

    it("should return error when SharedArrayBuffer is missing", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "SharedArrayBuffer", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toContain("Missing SharedArrayBuffer");
      expect(result?.message).toContain("COOP/COEP");
    });

    it("should return error when Atomics is missing", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "Atomics", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toContain("Missing SharedArrayBuffer"); // Message mentions both
    });

    it("should return error when not in WorkerGlobalScope", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "WorkerGlobalScope", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toContain("cannot run in the main thread");
      expect(result?.message).toContain("Atomics.wait()");
    });

    it("should return error when FileSystemHandle is missing", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "FileSystemHandle", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Missing required OPFS APIs.");
    });

    it("should return error when FileSystemDirectoryHandle is missing", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "FileSystemDirectoryHandle", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Missing required OPFS APIs.");
    });

    it("should return error when FileSystemFileHandle is missing", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "FileSystemFileHandle", {
        value: undefined,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Missing required OPFS APIs.");
    });

    it("should return error when createSyncAccessHandle is missing", () => {
      setValidEnvironment();
      const mockHandle = function () {};
      mockHandle.prototype = {}; // No createSyncAccessHandle
      Object.defineProperty(globalThis, "FileSystemFileHandle", {
        value: mockHandle,
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Missing required OPFS APIs.");
    });

    it("should return error when navigator.storage.getDirectory is missing", () => {
      setValidEnvironment();
      Object.defineProperty(globalThis, "navigator", {
        value: { storage: {} },
        writable: true,
        configurable: true,
      });

      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeInstanceOf(Error);
      expect(result?.message).toBe("Missing required OPFS APIs.");
    });

    it("should return null when environment is valid", () => {
      setValidEnvironment();
      const result = validateOpfsEnvironment(globalThis);
      expect(result).toBeNull();
    });
  });

  describe("thisThreadHasOPFS", () => {
    const setValidOPFSEnvironment = () => {
      Object.defineProperty(globalThis, "FileSystemHandle", {
        value: function () {},
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, "FileSystemDirectoryHandle", {
        value: function () {},
        writable: true,
        configurable: true,
      });

      const mockFileSystemFileHandle = function () {};
      mockFileSystemFileHandle.prototype = { createSyncAccessHandle: () => {} };
      Object.defineProperty(globalThis, "FileSystemFileHandle", {
        value: mockFileSystemFileHandle,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(globalThis, "navigator", {
        value: { storage: { getDirectory: () => {} } },
        writable: true,
        configurable: true,
      });
    };

    it("should return false when FileSystemHandle is missing", () => {
      setValidOPFSEnvironment();
      Object.defineProperty(globalThis, "FileSystemHandle", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(thisThreadHasOPFS()).toBeFalsy();
    });

    it("should return false when FileSystemDirectoryHandle is missing", () => {
      setValidOPFSEnvironment();
      Object.defineProperty(globalThis, "FileSystemDirectoryHandle", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(thisThreadHasOPFS()).toBeFalsy();
    });

    it("should return false when FileSystemFileHandle is missing", () => {
      setValidOPFSEnvironment();
      Object.defineProperty(globalThis, "FileSystemFileHandle", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(thisThreadHasOPFS()).toBeFalsy();
    });

    it("should return false when createSyncAccessHandle is missing", () => {
      setValidOPFSEnvironment();
      const mockHandle = function () {};
      mockHandle.prototype = {};
      Object.defineProperty(globalThis, "FileSystemFileHandle", {
        value: mockHandle,
        writable: true,
        configurable: true,
      });
      expect(thisThreadHasOPFS()).toBeFalsy();
    });

    it("should return false when navigator.storage.getDirectory is missing", () => {
      setValidOPFSEnvironment();
      Object.defineProperty(globalThis, "navigator", {
        value: { storage: {} },
        writable: true,
        configurable: true,
      });
      expect(thisThreadHasOPFS()).toBeFalsy();
    });

    it("should return true when all OPFS APIs are present", () => {
      setValidOPFSEnvironment();
      expect(thisThreadHasOPFS()).toBeTruthy();
    });
  });
});
