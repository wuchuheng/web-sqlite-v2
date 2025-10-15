import type { SQLite3API } from "@wuchuheng/web-sqlite";
import { TestUtils } from "../utils/test-utils";

export interface TestCase {
  name: string;
  fn: (sqlite3: SQLite3API) => Promise<void>;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
}

export interface TestResults {
  total: number;
  passed: number;
  failed: number;
}

export interface MessageData {
  level?: string;
  message?: string;
  suite?: string;
  test?: string;
  source?: string;
  passed?: boolean | number;
  error?: string;
  duration?: number;
  total?: number;
  failed?: number;
}

/**
 * Test Framework for SQLite3 OPFS/WASM
 * Comprehensive test suite for database operations
 */
export class TestRunner {
  private sqlite3: SQLite3API | null = null;
  private testSuites: TestSuite[] = [];
  private results: TestResults = {
    total: 0,
    passed: 0,
    failed: 0,
  };

  /**
   * Initialize SQLite3 module
   */
  async initialize(
    sqlite3InitModule: (config: {
      print: typeof console.log;
      printErr: typeof console.error;
    }) => Promise<SQLite3API>
  ): Promise<boolean> {
    this.log("info", "🚀 Initializing SQLite3 WASM module...");

    try {
      this.sqlite3 = await sqlite3InitModule({
        print: console.log,
        printErr: console.error,
      });

      this.log("success", `✅ SQLite3 loaded successfully`);
      this.log("info", `📋 Version: ${this.sqlite3.version.libVersion}`);

      const hasOpfs = !!this.sqlite3.capi.sqlite3_vfs_find("opfs");
      this.log(
        hasOpfs ? "success" : "warn",
        `🏗️ OPFS VFS: ${hasOpfs ? "Available" : "Not available"}`
      );

      await TestUtils.cleanupTrackedOpfsDatabases(this.sqlite3);
      this.log("info", "🧹 Reset OPFS databases for fresh test run");

      return true;
    } catch (error) {
      this.log(
        "error",
        `❌ Initialization failed: ${(error as Error).message}`
      );
      return false;
    }
  }

  /**
   * Register a test suite
   */
  registerSuite(name: string, tests: TestCase[]): void {
    if (!name || !tests) {
      throw new Error("Suite name and tests are required");
    }

    this.testSuites.push({ name, tests });
  }

  /**
   * Run all test suites
   */
  async runAllTests(): Promise<void> {
    this.results = { total: 0, passed: 0, failed: 0 };
    const startTime = performance.now();
    const plannedTotal = this.testSuites.reduce(
      (sum, suite) => sum + suite.tests.length,
      0
    );

    this.sendMessage("test-plan", { total: plannedTotal });

    for (const suite of this.testSuites) {
      await this.runSuite(suite);
    }

    const duration = Math.round(performance.now() - startTime);
    this.sendMessage("all-tests-complete", {
      total: this.results.total,
      passed: this.results.passed,
      failed: this.results.failed,
      duration,
    });
  }

  /**
   * Run a single test suite
   */
  private async runSuite(suite: TestSuite): Promise<void> {
    const { name, tests } = suite;
    let suitePassed = 0;
    let suiteFailed = 0;
    const suiteStartTime = performance.now();

    for (const test of tests) {
      const result = await this.runTest(name, test);
      if (result) {
        suitePassed++;
      } else {
        suiteFailed++;
      }
    }

    const suiteDuration = Math.round(performance.now() - suiteStartTime);
    this.sendMessage("test-suite-complete", {
      suite: name,
      passed: suitePassed,
      failed: suiteFailed,
      duration: suiteDuration,
    });
  }

  /**
   * Run a single test
   */
  private async runTest(suiteName: string, test: TestCase): Promise<boolean> {
    const { name, fn } = test;
    this.results.total++;

    const source = fn.toString();
    this.sendMessage("test-start", { suite: suiteName, test: name, source });
    const startTime = performance.now();

    try {
      if (!this.sqlite3) {
        throw new Error("SQLite3 not initialized");
      }

      await fn(this.sqlite3);
      const duration = Math.round(performance.now() - startTime);

      this.results.passed++;
      this.sendMessage("test-complete", {
        suite: suiteName,
        test: name,
        passed: true,
        duration,
      });
      return true;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      this.results.failed++;
      this.sendMessage("test-complete", {
        suite: suiteName,
        test: name,
        passed: false,
        error: (error as Error).message,
        duration,
      });
      return false;
    }
  }

  /**
   * Send message to main thread
   */
  private sendMessage(type: string, data: MessageData): void {
    self.postMessage({ type, data });
  }

  /**
   * Log message to main thread
   */
  private log(level: string, message: string): void {
    console[level === "error" ? "error" : "log"](message);
    this.sendMessage("log", { level, message });
  }
}
