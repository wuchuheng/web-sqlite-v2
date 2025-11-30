/**
 * Lightweight log helper mirroring the historic integer-based verbosity levels.
 */

/**
 * Represents the verbosity levels for logging.
 * 0: error, 1: warn, 2: info
 */
type WorkerLogLevel = 0 | 1 | 2;

/**
 * Union type of acceptable log argument types.
 */
type WorkerLogArgument =
  | string
  | number
  | bigint
  | boolean
  | symbol
  | object
  | null
  | undefined;

/**
 * Defines the contract for a logging backend that outputs messages at a specific level.
 * Each backend is a function that receives log arguments and outputs them to the
 * appropriate console method with a prefix.
 */
interface LogBackend {
  /**
   * Outputs log messages to the console.
   *
   * @param args - Arguments to output
   */
  (...args: unknown[]): void;
}

/**
 * A lightweight logging class that provides leveled logging with configurable verbosity.
 * The logger uses integer-based verbosity levels and supports different console outputs.
 * Implements the ILogger interface to provide a standard logging contract.
 */
class WorkerLogger {
  /**
   * Function that returns the current verbosity level.
   * Higher values suppress more detailed logs.
   */
  private readonly levelProvider: () => number;

  /**
   * Map of log levels to their corresponding console methods with "OPFS asyncer:" prefix.
   */
  private readonly backends: Map<WorkerLogLevel, LogBackend>;

  /**
   * Creates a new WorkerLogger instance.
   *
   * @param levelProvider - Callable returning the current verbosity level
   */
  constructor(levelProvider: () => number) {
    // 1. Input handling
    if (typeof levelProvider !== "function") {
      throw new TypeError("levelProvider must be a function");
    }

    // 2. Core processing
    this.levelProvider = levelProvider;
    this.backends = new Map<WorkerLogLevel, LogBackend>([
      [0, console.error.bind(console, "OPFS asyncer:")],
      [1, console.warn.bind(console, "OPFS asyncer:")],
      [2, console.log.bind(console, "OPFS asyncer:")],
    ]);

    // 3. Output handling
    // (No specific output handling needed in constructor)
  }

  /**
   * Logs a message if the verbosity threshold allows it.
   *
   * @param level - The log level (0: error, 1: warn, 2: info)
   * @param args - Arguments to forward to the console method
   */
  public logAt(
    level: WorkerLogLevel,
    ...args: ReadonlyArray<WorkerLogArgument>
  ): void {
    // 1. Input handling
    const currentLevel = this.levelProvider();

    // 2. Core processing
    if (currentLevel > level) {
      const backend = this.backends.get(level);
      if (backend) {
        backend(...args);
      }
    }

    // 3. Output handling
    // (Output is handled by the backend if conditions are met)
  }

  /**
   * Logs an info-level message.
   *
   * @param args - Arguments to forward to console.log
   */
  public log(...args: ReadonlyArray<WorkerLogArgument>): void {
    // 1. Input handling
    // (No specific input validation needed)

    // 2. Core processing
    this.logAt(2, ...args);

    // 3. Output handling
    // (Handled by logAt method)
  }

  /**
   * Logs a warning-level message.
   *
   * @param args - Arguments to forward to console.warn
   */
  public warn(...args: ReadonlyArray<WorkerLogArgument>): void {
    // 1. Input handling
    // (No specific input validation needed)

    // 2. Core processing
    this.logAt(1, ...args);

    // 3. Output handling
    // (Handled by logAt method)
  }

  /**
   * Logs an error-level message.
   *
   * @param args - Arguments to forward to console.error
   */
  public error(...args: ReadonlyArray<WorkerLogArgument>): void {
    // 1. Input handling
    // (No specific input validation needed)

    // 2. Core processing
    this.logAt(0, ...args);

    // 3. Output handling
    // (Handled by logAt method)
  }
}

(
  globalThis as typeof globalThis & { WorkerLogger: typeof WorkerLogger }
).WorkerLogger = WorkerLogger;
