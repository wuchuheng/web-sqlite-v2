/**
 * Tests for the logging module
 * These tests target the TypeScript implementation
 */

import { describe, test, expect, vi } from "vitest";

// Import the TypeScript implementation
import { WorkerLogger } from "./logging";

describe("WorkerLogger", () => {
  describe("basic functionality", () => {
    test("should be available as a constructor", () => {
      // 1. Input handling
      // WorkerLogger should be available from globalThis

      // 2. Core processing

      // 3. Output handling
      expect(WorkerLogger).toBeDefined();
      expect(typeof WorkerLogger).toBe("function");
      expect(WorkerLogger.prototype.constructor).toBe(WorkerLogger);
    });

    test("should initialize with levelProvider function", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 2);

      // 2. Core processing
      const logger = new WorkerLogger(levelProvider);

      // 3. Output handling
      expect(logger).toBeInstanceOf(WorkerLogger);
    });

    test("should throw if levelProvider is not a function", () => {
      // 1. Input handling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const invalidProvider = "not a function" as any;

      // 2. Core processing & 3. Output handling
      expect(() => new WorkerLogger(invalidProvider)).toThrow(TypeError);
    });

    test("should have all expected methods", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 2);

      // 2. Core processing
      const logger = new WorkerLogger(levelProvider);

      // 3. Output handling
      expect(typeof logger.logAt).toBe("function");
      expect(typeof logger.log).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });
  });

  describe("method calls", () => {
    test("should not throw when calling logging methods", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 2);
      const logger = new WorkerLogger(levelProvider);

      // 2. Core processing
      // These should not throw, regardless of console output
      expect(() => {
        logger.error("test error");
        logger.warn("test warn");
        logger.log("test log");
        logger.logAt(0, "test error via logAt");
        logger.logAt(1, "test warn via logAt");
        logger.logAt(2, "test log via logAt");
      }).not.toThrow();

      // 3. Output handling
      expect(true).toBe(true); // Test passes if no exceptions were thrown
    });

    test("should handle various argument types without errors", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 2);
      const logger = new WorkerLogger(levelProvider);
      const testArgs = [
        "string",
        42,
        true,
        { key: "value" },
        [1, 2, 3],
        null,
        undefined,
      ] as const;

      // 2. Core processing
      expect(() => {
        logger.log(...testArgs);
        logger.log(...([] as const));
        logger.logAt(2, ...testArgs);
        logger.error("Error:", { error: "object" });
        logger.warn("Warning:", [1, 2, 3]);
      }).not.toThrow();

      // 3. Output handling
      expect(true).toBe(true); // Test passes if no exceptions were thrown
    });
  });

  describe("global assignment", () => {
    test("should assign WorkerLogger to globalThis", () => {
      // 1. Input handling - Global assignment happens during module import

      // 2. Core processing

      // 3. Output handling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((globalThis as any).WorkerLogger).toBe(WorkerLogger);
    });
  });

  describe("convenience methods delegation", () => {
    test("should delegate error() to logAt with correct level", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 0);
      const logger = new WorkerLogger(levelProvider);
      const logAtSpy = vi.spyOn(logger, "logAt");

      // 2. Core processing
      logger.error("error arg1", "error arg2");

      // 3. Output handling
      expect(logAtSpy).toHaveBeenCalledWith(0, "error arg1", "error arg2");
    });

    test("should delegate warn() to logAt with correct level", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 1);
      const logger = new WorkerLogger(levelProvider);
      const logAtSpy = vi.spyOn(logger, "logAt");

      // 2. Core processing
      logger.warn("warn arg1", "warn arg2");

      // 3. Output handling
      expect(logAtSpy).toHaveBeenCalledWith(1, "warn arg1", "warn arg2");
    });

    test("should delegate log() to logAt with correct level", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 2);
      const logger = new WorkerLogger(levelProvider);
      const logAtSpy = vi.spyOn(logger, "logAt");

      // 2. Core processing
      logger.log("log arg1", "log arg2");

      // 3. Output handling
      expect(logAtSpy).toHaveBeenCalledWith(2, "log arg1", "log arg2");
    });
  });

  describe("type compatibility", () => {
    test("should accept various argument types as defined in WorkerLogArgument", () => {
      // 1. Input handling
      const levelProvider = vi.fn(() => 2);
      const logger = new WorkerLogger(levelProvider);

      // Test various valid argument types as defined in WorkerLogArgument
      const stringArg = "test string";
      const numberArg = 42;
      const bigintArg = 42n;
      const boolArg = true;
      const symbolArg = Symbol("test");
      const objectArg = { prop: "value" };
      const arrayArg = [1, 2, 3];
      const nullArg = null;
      const undefinedArg = undefined;

      // 2. Core processing
      expect(() => {
        logger.log(stringArg, numberArg, boolArg, objectArg, arrayArg);
        logger.log(nullArg, undefinedArg);
        logger.log(bigintArg, symbolArg);
      }).not.toThrow();

      // 3. Output handling
      expect(true).toBe(true); // Test passes if no exceptions were thrown
    });
  });
});
