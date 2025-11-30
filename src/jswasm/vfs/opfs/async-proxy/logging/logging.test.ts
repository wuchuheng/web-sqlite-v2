import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// Import the script to ensure the global WorkerLogger is defined.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Import non-module script for side effects
import "./logging";

// Define the shape of WorkerLogger for the test context (internal helper)
interface IWorkerLoggerInstance {
  logAt(level: number, ...args: unknown[]): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

interface IWorkerLoggerConstructor {
  new (levelProvider: () => number): IWorkerLoggerInstance;
}

// Cast globalThis to include our expected property
const GlobalContext = globalThis as typeof globalThis & {
  WorkerLogger?: IWorkerLoggerConstructor;
};

describe("WorkerLogger", () => {
  let consoleLogSpy: Mock;
  let consoleWarnSpy: Mock;
  let consoleErrorSpy: Mock;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is assigned to globalThis", () => {
    expect(GlobalContext.WorkerLogger).toBeDefined();
  });

  it("throws if levelProvider is not a function", () => {
    expect(() => {
      // @ts-expect-error: Testing runtime validation
      new GlobalContext.WorkerLogger!(123);
    }).toThrow(TypeError);
  });

  it("logs info messages when verbosity is high enough", () => {
    // Level provider returns 3 (strictly > 2) to show info
    const logger = new GlobalContext.WorkerLogger!(() => 3);

    logger.log("info message");
    expect(consoleLogSpy).toHaveBeenCalledWith("OPFS asyncer:", "info message");
  });

  it("suppresses info messages when verbosity is low", () => {
    // Level provider returns 2 (not > 2)
    const logger = new GlobalContext.WorkerLogger!(() => 2);

    logger.log("should not appear");
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it("logs warnings", () => {
    // Level provider returns 2 (strictly > 1) to show warn
    const logger = new GlobalContext.WorkerLogger!(() => 2);

    logger.warn("warning message");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "OPFS asyncer:",
      "warning message",
    );
  });

  it("logs errors", () => {
    // Level provider returns 1 (strictly > 0) to show error
    const logger = new GlobalContext.WorkerLogger!(() => 1);

    logger.error("error message");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "OPFS asyncer:",
      "error message",
    );
  });

  it("logAt respects levels", () => {
    // Current level 2
    const logger = new GlobalContext.WorkerLogger!(() => 2);

    // Try to log at level 2 (INFO) -> Suppressed (2 > 2 is False)
    logger.logAt(2, "info");
    expect(consoleLogSpy).not.toHaveBeenCalled();

    // Try to log at level 0 (ERROR) -> Shown (2 > 0 is True)
    logger.logAt(0, "error");
    expect(consoleErrorSpy).toHaveBeenCalledWith("OPFS asyncer:", "error");
  });
});
