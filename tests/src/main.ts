/**
 * Main entry point for SQLite3 OPFS/WASM Test Runner
 */

/**
 * Test item interface
 */
interface TestItem {
  name: string;
  status: "running" | "passed" | "failed";
  duration: number | null;
  source?: string | null;
  testId: string;
  error?: string;
}

/**
 * Log information interface
 */
interface LogInfo {
  testId: string;
  suiteId: number;
}

/**
 * Suite statistics interface
 */
interface SuiteStats {
  passed: number;
  failed: number;
  duration: number;
  startTime: number;
}

/**
 * Test UI Controller - JetBrains Style
 */
class TestUIController {
  private worker: Worker | null = null;
  private testStats = { total: 0, passed: 0, failed: 0 };
  private testTree = new Map<string, TestItem[]>();
  private testLogs = new Map<string, LogInfo>();
  private suiteStats = new Map<string, SuiteStats>();
  private collapsedSuites = new Set<string>();
  private isRunning = false;
  private viewMode: "console" | "source" = "console";
  private activeTest: string | null = null;
  private consoleContent = "";
  private suiteIdMap = new Map<string, number>();
  private currentSuiteId = 0;
  private currentLogBlock: HTMLElement | null = null;
  private currentTestId: string | null = null;

  constructor() {
    // 1. Input handling - Initialize state

    // 2. Core processing - Setup
    this.initializeWorker();
    this.setupEventListeners();
    this.checkEnvironment();

    // 3. Output handling - Auto-run tests after initialization
    setTimeout(() => this.runTests(), 500);
  }

  /**
   * Initialize Web Worker
   */
  private initializeWorker(): void {
    // 1. Input handling
    try {
      // 2. Core processing
      this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (event) => this.handleWorkerMessage(event);
      this.worker.onerror = (error) => this.handleWorkerError(error);

      // 3. Output handling
      this.updateEnvironmentStatus("worker", "ready", "✅", "Ready");
    } catch (error) {
      this.updateEnvironmentStatus("worker", "error", "❌", "Failed");
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logInitial("error", `Worker init failed: ${errorMessage}`);
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // 1. Input handling
    const runBtn = document.getElementById("run-tests-btn");
    const clearBtn = document.getElementById("clear-log-btn");

    // 2. Core processing
    runBtn?.addEventListener("click", () => this.runTests());
    clearBtn?.addEventListener("click", () => this.clearConsole());
  }

  /**
   * Check environment
   */
  private checkEnvironment(): void {
    // 1. Input handling
    const hasOPFS = typeof navigator.storage?.getDirectory === "function";
    const hasSAB = typeof SharedArrayBuffer !== "undefined";

    // 2. Core processing
    this.updateEnvironmentStatus(
      "opfs",
      hasOPFS ? "ready" : "error",
      hasOPFS ? "✅" : "❌",
      hasOPFS ? "OK" : "No"
    );
    this.updateEnvironmentStatus(
      "sab",
      hasSAB ? "ready" : "error",
      hasSAB ? "✅" : "❌",
      hasSAB ? "OK" : "No"
    );

    // 3. Output handling
    this.logInitial("info", `Environment: OPFS=${hasOPFS}, SAB=${hasSAB}`);
  }

  /**
   * Update environment status
   */
  private updateEnvironmentStatus(
    key: string,
    _status: string,
    icon: string,
    text: string
  ): void {
    // 1. Input handling
    const iconEl = document.getElementById(`env-${key}-icon`);
    const statusEl = document.getElementById(`env-${key}-status`);

    // 2. Core processing
    if (iconEl) iconEl.textContent = icon;
    if (statusEl) statusEl.textContent = text;
  }

  /**
   * Handle worker messages
   */
  private handleWorkerMessage(event: MessageEvent): void {
    // 1. Input handling
    const { type, data } = event.data;

    // 2. Core processing
    switch (type) {
      case "test-start":
        this.handleTestStart(data);
        break;
      case "test-complete":
        this.handleTestComplete(data);
        break;
      case "test-suite-complete":
        this.handleSuiteComplete(data);
        break;
      case "all-tests-complete":
        this.handleAllComplete(data);
        break;
      case "log":
        this.logInitial(data.level, data.message);
        break;
      case "error":
        this.handleWorkerError(data.error);
        break;
    }
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(error: unknown): void {
    // 1. Input handling
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logInitial("error", `Worker error: ${errorMessage}`);

    // 2. Core processing
    this.isRunning = false;
    const runBtn = document.getElementById(
      "run-tests-btn"
    ) as HTMLButtonElement;
    const spinner = document.getElementById("run-spinner");
    if (runBtn) runBtn.disabled = false;
    if (spinner) spinner.style.display = "none";
  }

  /**
   * Run all tests
   */
  private runTests(): void {
    // 1. Input handling
    if (this.isRunning) return;

    // 2. Core processing
    this.isRunning = true;
    this.testStats = { total: 0, passed: 0, failed: 0 };
    this.testTree.clear();
    this.suiteIdMap.clear();
    this.currentSuiteId = 0;
    this.currentLogBlock = null;
    this.currentTestId = null;
    this.clearConsole();

    // 3. Output handling
    this.logInitial("info", "🚀 Starting test suite...\\n");
    const runBtn = document.getElementById(
      "run-tests-btn"
    ) as HTMLButtonElement;
    const spinner = document.getElementById("run-spinner");
    if (runBtn) runBtn.disabled = true;
    if (spinner) spinner.style.display = "inline-block";
    this.worker?.postMessage({ cmd: "run-tests" });
  }

  /**
   * Handle test start
   */
  private handleTestStart(data: {
    suite: string;
    test: string;
    source?: string;
  }): void {
    // 1. Input handling
    const { suite, test, source } = data;
    const testKey = `${suite}::${test}`;

    // 2. Core processing
    if (!this.testTree.has(suite)) {
      this.currentSuiteId++;
      this.suiteIdMap.set(suite, this.currentSuiteId);
      this.testTree.set(suite, []);
      this.suiteStats.set(suite, {
        passed: 0,
        failed: 0,
        duration: 0,
        startTime: performance.now(),
      });

      this.createSuiteLogBlock(suite, this.currentSuiteId);
    }

    const suiteId = this.suiteIdMap.get(suite)!;
    const testIndex = this.testTree.get(suite)!.length + 1;
    const testId = `${suiteId}-${testIndex}`;

    this.testTree.get(suite)!.push({
      name: test,
      status: "running",
      duration: null,
      source: source || null,
      testId: testId,
    });

    this.testLogs.set(testKey, {
      testId: testId,
      suiteId: suiteId,
    });

    this.createTestLogBlock(suite, test, testId, suiteId);
    this.currentTestId = testId;

    // 3. Output handling
    this.renderTestTree();
  }

  /**
   * Handle test complete
   */
  private handleTestComplete(data: {
    suite: string;
    test: string;
    passed: boolean;
    error?: string;
    duration: number;
  }): void {
    // 1. Input handling
    const { suite, test, passed, error, duration } = data;
    const testKey = `${suite}::${test}`;

    // 2. Core processing
    if (passed) {
      this.testStats.passed++;
    } else {
      this.testStats.failed++;
    }
    this.testStats.total++;

    const tests = this.testTree.get(suite);
    const testItem = tests?.find((t) => t.name === test);
    if (testItem) {
      testItem.status = passed ? "passed" : "failed";
      testItem.error = error;
      testItem.duration = duration;
    }

    const logInfo = this.testLogs.get(testKey);
    const testId = logInfo?.testId;

    // 3. Output handling
    this.renderTestTree();
    this.updateProgress();

    const icon = passed ? "✓" : "✗";
    const level = passed ? "success" : "error";
    this.logToBlock(testId, level, `${icon} ${test} (${duration}ms)`);
    if (error) {
      this.logToBlock(testId, "error", `  └─ ${error}`);
    }
  }

  /**
   * Handle suite complete
   */
  private handleSuiteComplete(data: {
    suite: string;
    passed: number;
    failed: number;
    duration: number;
  }): void {
    // 1. Input handling
    const { suite, passed, failed, duration } = data;

    // 2. Core processing
    const stats = this.suiteStats.get(suite);
    if (stats) {
      stats.passed = passed;
      stats.failed = failed;
      stats.duration = duration;
    }

    const suiteId = this.suiteIdMap.get(suite);

    this.renderTestTree();
    this.logToBlock(
      suiteId,
      "info",
      `✓ Suite completed: ${passed} passed, ${failed} failed (${duration}ms)`
    );
  }

  /**
   * Handle all tests complete
   */
  private handleAllComplete(data: {
    total: number;
    passed: number;
    failed: number;
    duration: number;
  }): void {
    // 1. Input handling
    const { total, passed, failed, duration } = data;

    // 2. Core processing
    this.isRunning = false;

    // 3. Output handling
    const runBtn = document.getElementById(
      "run-tests-btn"
    ) as HTMLButtonElement;
    const spinner = document.getElementById("run-spinner");
    if (runBtn) runBtn.disabled = false;
    if (spinner) spinner.style.display = "none";

    this.logFinal("success", `\\n${"=".repeat(60)}`);
    this.logFinal("success", `🏁 All tests completed in ${duration}ms`);
    this.logFinal(
      "success",
      `   Total: ${total} | Passed: ${passed} | Failed: ${failed}`
    );
    this.logFinal(
      "success",
      `   Success Rate: ${((passed / total) * 100).toFixed(1)}%`
    );
    this.logFinal("success", `${"=".repeat(60)}`);
  }

  /**
   * Render test tree
   */
  private renderTestTree(): void {
    // 1. Input handling
    const testTreeEl = document.getElementById("test-tree");
    if (!testTreeEl) return;

    // 2. Core processing
    let html = "";

    for (const [suite, tests] of this.testTree.entries()) {
      const suiteId = this.suiteIdMap.get(suite)!;
      const isCollapsed = this.collapsedSuites.has(suite);

      // Suite header
      const passedCount = tests.filter((t) => t.status === "passed").length;
      const failedCount = tests.filter((t) => t.status === "failed").length;
      const totalCount = tests.length;

      let suiteIcon = "📦";
      let suiteClass = "test-suite";
      if (passedCount === totalCount && totalCount > 0) {
        suiteIcon = "✓";
        suiteClass += " suite-passed";
      } else if (failedCount > 0) {
        suiteIcon = "✗";
        suiteClass += " suite-failed";
      }

      const isSuiteActive = this.activeTest && this.activeTest.startsWith(`${suite}::`);
      if (isSuiteActive) suiteClass += " suite-active";

      html += `<div class="${suiteClass}" data-suite-id="${suiteId}">`;
      html += `<div class="suite-header" onclick="window.testController?.handleSuiteClick('${suite}', ${suiteId})">`;
      html += `<span class="collapse-icon">${isCollapsed ? "▶" : "▼"}</span>`;
      html += `<span class="suite-icon">${suiteIcon}</span>`;
      html += `<span class="suite-name">${suite}</span>`;
      html += `<span class="suite-count">${passedCount}/${totalCount}</span>`;
      html += `</div>`;

      // Test items
      if (!isCollapsed) {
        html += `<div class="test-items">`;
        for (const test of tests) {
          let testIcon = "⏳";
          let testClass = "test-item";

          if (test.status === "passed") {
            testIcon = "✓";
            testClass += " test-passed";
          } else if (test.status === "failed") {
            testIcon = "✗";
            testClass += " test-failed";
          } else {
            testClass += " test-running";
          }

          const isActive = this.activeTest === `${suite}::${test.name}`;
          if (isActive) testClass += " test-active";

          html += `<div class="${testClass}" data-test-id="${test.testId}" onclick="window.testController?.handleTestClick('${suite}', '${test.name}', '${test.testId}')">`;
          html += `<span class="test-icon">${testIcon}</span>`;
          html += `<span class="test-name">${test.name}</span>`;
          if (test.duration !== null) {
            html += `<span class="test-duration">${test.duration}ms</span>`;
          }
          html += `</div>`;
        }
        html += `</div>`;
      }

      html += `</div>`;
    }

    // 3. Output handling
    testTreeEl.innerHTML = html;
  }

  /**
   * Handle suite header click
   */
  public handleSuiteClick(suite: string, suiteId: number): void {
    // 1. Input handling - Toggle collapse
    if (this.collapsedSuites.has(suite)) {
      this.collapsedSuites.delete(suite);
    } else {
      this.collapsedSuites.add(suite);
    }

    // 2. Core processing - Scroll to suite log block
    this.scrollToLogBlock(`group-${suiteId}`);

    // 3. Output handling
    this.renderTestTree();
  }

  /**
   * Toggle suite collapse/expand
   */
  public toggleSuite(suite: string): void {
    // 1. Input handling
    if (this.collapsedSuites.has(suite)) {
      this.collapsedSuites.delete(suite);
    } else {
      this.collapsedSuites.add(suite);
    }

    // 2. Core processing & 3. Output handling
    this.renderTestTree();
  }

  /**
   * Handle test item click
   */
  public handleTestClick(suite: string, testName: string, testId: string): void {
    // 1. Input handling - Set active test
    const testKey = `${suite}::${testName}`;
    this.activeTest = testKey;

    // 2. Core processing - Scroll to test log block and highlight
    this.scrollToLogBlock(`item-${testId}`);
    this.highlightLogBlock(`item-${testId}`);

    // 3. Output handling
    this.renderTestTree();
  }

  /**
   * Scroll log block into center view
   */
  private scrollToLogBlock(logId: string): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");
    if (!consoleLog) return;

    const logBlock = consoleLog.querySelector(`[data-log-id="${logId}"]`);
    if (!logBlock) return;

    // 2. Core processing - Calculate scroll position to center the block
    const scrollContainer = consoleLog.parentElement;
    if (!scrollContainer) return;

    const blockRect = logBlock.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const scrollOffset = blockRect.top - containerRect.top -
                        (containerRect.height / 2) + (blockRect.height / 2);

    // 3. Output handling - Smooth scroll to center
    scrollContainer.scrollBy({
      top: scrollOffset,
      behavior: "smooth"
    });
  }

  /**
   * Highlight log block temporarily
   */
  private highlightLogBlock(logId: string): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");
    if (!consoleLog) return;

    // Remove previous highlights
    consoleLog.querySelectorAll(".log-block-highlight").forEach(el => {
      el.classList.remove("log-block-highlight");
    });

    // 2. Core processing - Add highlight to target block
    const logBlock = consoleLog.querySelector(`[data-log-id="${logId}"]`);
    if (!logBlock) return;

    // 3. Output handling - Add highlight class
    logBlock.classList.add("log-block-highlight");

    // Remove highlight after animation
    setTimeout(() => {
      logBlock.classList.remove("log-block-highlight");
    }, 2000);
  }

  /**
   * Update progress
   */
  private updateProgress(): void {
    // 1. Input handling
    const { total, passed, failed } = this.testStats;

    // 2. Core processing
    const percentage = total > 0 ? (total / 51) * 100 : 0;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    // 3. Output handling
    const progressText = document.getElementById("test-progress-text");
    const passRateEl = document.getElementById("test-pass-rate");
    const progressBar = document.getElementById(
      "test-progress-bar"
    ) as HTMLElement;
    const passedCount = document.getElementById("test-passed-count");
    const failedCount = document.getElementById("test-failed-count");

    if (progressText) progressText.textContent = `${total} / 51 tests`;
    if (passRateEl) passRateEl.textContent = `${passRate.toFixed(1)}%`;
    if (progressBar) progressBar.style.width = `${percentage}%`;
    if (passedCount) passedCount.textContent = String(passed);
    if (failedCount) failedCount.textContent = String(failed);
  }

  /**
   * Clear console
   */
  private clearConsole(): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");

    // 2. Core processing
    this.consoleContent = "";
    if (consoleLog) {
      consoleLog.innerHTML = "";
    }
  }

  /**
   * Create suite log block
   */
  private createSuiteLogBlock(suiteName: string, suiteId: number): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");
    if (!consoleLog) return;

    // 2. Core processing
    const groupBlock = document.createElement("div");
    groupBlock.className = "log-block-group";
    groupBlock.setAttribute("data-log-id", `group-${suiteId}`);

    const header = document.createElement("div");
    header.className = "log-block-header";
    header.textContent = `📦 Test Suite: ${suiteName}`;
    groupBlock.appendChild(header);

    // 3. Output handling
    consoleLog.appendChild(groupBlock);
    this.currentLogBlock = groupBlock;

    this.consoleContent += groupBlock.outerHTML;
  }

  /**
   * Create test log block
   */
  private createTestLogBlock(
    _suiteName: string,
    testName: string,
    testId: string,
    suiteId: number
  ): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");
    if (!consoleLog) return;

    const groupBlock = consoleLog.querySelector(
      `[data-log-id="group-${suiteId}"]`
    );
    if (!groupBlock) return;

    // 2. Core processing
    const itemBlock = document.createElement("div");
    itemBlock.className = "log-block-item";
    itemBlock.setAttribute("data-log-id", `item-${testId}`);

    const header = document.createElement("div");
    header.className = "log-block-item-header";
    header.textContent = `▶ Running: ${testName}`;
    itemBlock.appendChild(header);

    // 3. Output handling
    groupBlock.appendChild(itemBlock);
    this.currentLogBlock = itemBlock;
  }

  /**
   * Log to specific block
   */
  private logToBlock(
    blockId: string | number | undefined,
    level: string,
    message: string
  ): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");
    if (!consoleLog) return;

    // 2. Core processing
    const levelClass = `log-${
      level === "success"
        ? "success"
        : level === "error"
        ? "error"
        : level === "warn"
        ? "warn"
        : "info"
    }`;

    const entry = document.createElement("div");
    entry.className = `log-entry ${levelClass}`;
    entry.textContent = message;

    let targetBlock = consoleLog.querySelector(
      `[data-log-id="item-${blockId}"]`
    );
    if (!targetBlock) {
      targetBlock = consoleLog.querySelector(
        `[data-log-id="group-${blockId}"]`
      );
    }

    // 3. Output handling
    if (targetBlock) {
      targetBlock.appendChild(entry);
    } else {
      consoleLog.appendChild(entry);
    }

    this.consoleContent = consoleLog.innerHTML;

    const scrollContainer = consoleLog.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  /**
   * Log initial message
   */
  private logInitial(level: string, message: string): void {
    // 1. Input handling
    const consoleLog = document.getElementById("console-log");
    if (!consoleLog) return;

    // 2. Core processing
    const levelClass = `log-${
      level === "success"
        ? "success"
        : level === "error"
        ? "error"
        : level === "warn"
        ? "warn"
        : "info"
    }`;

    const entry = document.createElement("div");
    entry.className = `log-entry ${levelClass}`;
    entry.textContent = message;

    // 3. Output handling
    consoleLog.appendChild(entry);
    this.consoleContent += entry.outerHTML;

    const scrollContainer = consoleLog.parentElement;
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }

  /**
   * Log final message
   */
  private logFinal(level: string, message: string): void {
    this.logInitial(level, message);
  }
}

// Declare global window interface extension
declare global {
  interface Window {
    testController?: TestUIController;
  }
}

// Initialize controller when DOM is ready
window.testController = new TestUIController();
