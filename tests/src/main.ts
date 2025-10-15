/**
 * Main entry point for SQLite3 OPFS/WASM Test Runner
 */
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";

// Register languages for syntax highlighting
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);

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
  private testStats = { completed: 0, passed: 0, failed: 0 };
  private plannedTestTotal = 0;
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
      case "test-plan":
        this.handleTestPlan(data);
        break;
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
    this.testStats = { completed: 0, passed: 0, failed: 0 };
    this.plannedTestTotal = 0;
    this.testTree.clear();
    this.suiteIdMap.clear();
    this.currentSuiteId = 0;
    this.clearConsole();
    this.updateProgress();

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
   * Handle test plan metadata
   */
  private handleTestPlan(data: { total?: number }): void {
    const { total = 0 } = data;
    this.plannedTestTotal = total;
    this.updateProgress();
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

    // Automatically capture source code if provided
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
    this.testStats.completed++;

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
    this.plannedTestTotal = total;
    this.testStats.completed = total;
    this.updateProgress();

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

      const isSuiteActive =
        this.activeTest && this.activeTest.startsWith(`${suite}::`);
      if (isSuiteActive) suiteClass += " suite-active";
      if (isCollapsed) suiteClass += " collapsed suite-collapsed";

      html += `<div class="${suiteClass}" data-suite-id="${suiteId}">`;
      html += `<div class="suite-header" onclick="window.testController?.handleSuiteClick('${suite}', ${suiteId})">`;
      html += `<span class="collapse-icon">${isCollapsed ? "▶" : "▼"}</span>`;
      html += `<span class="suite-icon">${suiteIcon}</span>`;
      html += `<span class="suite-name">${suite}</span>`;
      html += `<div class="suite-stats">`;
      html += `<span class="suite-count">${passedCount}/${totalCount}</span>`;

      const stats = this.suiteStats.get(suite);
      if (stats && stats.duration > 0) {
        html += `<span class="suite-duration">${stats.duration}ms</span>`;
      }
      html += `</div>`;
      html += `</div>`;

      // Test items
      html += `<div class="test-items suite-tests">`;
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

        html += `<div class="${testClass}" data-test-id="${test.testId}">`;
        html += `<div class="test-info" onclick="window.testController?.handleTestClick('${suite}', '${test.name}', '${test.testId}')">`;
        html += `<span class="test-icon">${testIcon}</span>`;
        html += `<span class="test-name">${test.name}</span>`;
        html += `</div>`;
        html += `<div class="test-actions">`;
        if (test.duration !== null) {
          html += `<span class="test-duration">${test.duration}ms</span>`;
        }
        if (test.source) {
          html += `<button class="view-source-btn" onclick="event.stopPropagation(); window.testController?.viewTestSource('${suite}', '${test.name}', '${test.testId}')" title="View source code">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z"/>
              </svg>
            </button>`;
        }
        html += `</div>`;
        html += `</div>`;
      }
      html += `</div>`;

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
    const isCurrentlyCollapsed = this.collapsedSuites.has(suite);

    if (isCurrentlyCollapsed) {
      this.collapsedSuites.delete(suite);
    } else {
      this.collapsedSuites.add(suite);
    }

    // 2. Core processing - Toggle collapsed class for animation
    const testTreeEl = document.getElementById("test-tree");
    if (testTreeEl) {
      const suiteElement = testTreeEl.querySelector(
        `[data-suite-id="${suiteId}"]`
      );
      if (suiteElement) {
        if (isCurrentlyCollapsed) {
          suiteElement.classList.remove("collapsed");
          suiteElement.classList.remove("suite-collapsed");
          // Update collapse icon
          const collapseIcon = suiteElement.querySelector(".collapse-icon");
          if (collapseIcon) collapseIcon.textContent = "▼";
        } else {
          suiteElement.classList.add("collapsed");
          suiteElement.classList.add("suite-collapsed");
          // Update collapse icon
          const collapseIcon = suiteElement.querySelector(".collapse-icon");
          if (collapseIcon) collapseIcon.textContent = "▶";
        }
      }
    }

    // 3. Output handling - Scroll to suite log block
    this.scrollToLogBlock(`group-${suiteId}`);
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
  public handleTestClick(
    suite: string,
    testName: string,
    testId: string
  ): void {
    // 1. Input handling - Set active test
    const testKey = `${suite}::${testName}`;
    this.activeTest = testKey;

    // 2. Core processing - Switch to console mode and scroll to log
    if (this.viewMode === "source") {
      this.viewMode = "console";
      this.renderConsoleView();
    }
    this.scrollToLogBlock(`item-${testId}`);
    this.highlightLogBlock(`item-${testId}`);

    // 3. Output handling
    this.renderTestTree();
  }

  /**
   * View test source code
   */
  public viewTestSource(
    suite: string,
    testName: string,
    _testId: string
  ): void {
    // 1. Input handling - Find test
    const tests = this.testTree.get(suite);
    const test = tests?.find((t) => t.name === testName);
    if (!test || !test.source) return;

    // 2. Core processing - Switch to source view
    this.viewMode = "source";

    // 3. Output handling - Render source code
    this.renderSourceView(suite, testName, test.source);
    this.renderTestTree();
  }

  /**
   * Go back to console view
   */
  public goBackToConsole(): void {
    // 1. Input handling
    this.viewMode = "console";

    // 2. Core processing & 3. Output handling
    this.renderConsoleView();
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
    const scrollOffset =
      blockRect.top -
      containerRect.top -
      containerRect.height / 2 +
      blockRect.height / 2;

    // 3. Output handling - Smooth scroll to center
    scrollContainer.scrollBy({
      top: scrollOffset,
      behavior: "smooth",
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
    consoleLog.querySelectorAll(".log-block-highlight").forEach((el) => {
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
    const { completed, passed, failed } = this.testStats;

    // 2. Core processing
    const expectedTotal = this.plannedTestTotal || completed;
    const percentage =
      expectedTotal > 0 ? (completed / expectedTotal) * 100 : 0;
    const passRate = completed > 0 ? (passed / completed) * 100 : 0;

    // 3. Output handling
    const progressText = document.getElementById("test-progress-text");
    const passRateEl = document.getElementById("test-pass-rate");
    const progressBar = document.getElementById(
      "test-progress-bar"
    ) as HTMLElement;
    const passedCount = document.getElementById("test-passed-count");
    const failedCount = document.getElementById("test-failed-count");

    if (progressText) {
      const label =
        this.plannedTestTotal > 0
          ? ` ${completed} / ${this.plannedTestTotal} tests`
          : ` ${completed} test${completed === 1 ? "" : "s"}`;
      progressText.textContent = label;
    }
    if (passRateEl) passRateEl.textContent = `${passRate.toFixed(1)}%`;
    if (progressBar) progressBar.style.width = `${Math.min(percentage, 100)}%`;
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
   * Render source code view
   */
  private renderSourceView(
    suite: string,
    testName: string,
    source: string
  ): void {
    // 1. Input handling
    const rightPanel = document.querySelector(".right-panel");
    if (!rightPanel) return;

    // 2. Core processing - Format source code
    const formattedSource = this.formatSourceCode(source);

    // 3. Output handling - Display source viewer
    rightPanel.innerHTML = `
      <div class="source-viewer-container">
        <div class="source-header">
          <div class="source-title">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 8px;">
              <path d="M5.854 4.854a.5.5 0 1 0-.708-.708l-3.5 3.5a.5.5 0 0 0 0 .708l3.5 3.5a.5.5 0 0 0 .708-.708L2.707 8l3.147-3.146zm4.292 0a.5.5 0 0 1 .708-.708l3.5 3.5a.5.5 0 0 1 0 .708l-3.5 3.5a.5.5 0 0 1-.708-.708L13.293 8l-3.147-3.146z"/>
            </svg>
            ${suite} › ${testName}
          </div>
          <button class="source-close-btn" onclick="window.testController?.goBackToConsole()">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 6px;">
              <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM4.5 7.5a.5.5 0 0 0 0 1h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L10.293 7.5H4.5z"/>
            </svg>
            Back to Console
          </button>
        </div>
        <div class="source-viewer">
          <pre class="source-code">${formattedSource}</pre>
        </div>
      </div>
    `;
  }

  /**
   * Render console view
   */
  private renderConsoleView(): void {
    // 1. Input handling
    const rightPanel = document.querySelector(".right-panel");
    if (!rightPanel) return;

    // 2. Core processing & 3. Output handling - Restore console
    rightPanel.innerHTML = `<div class="log-container" id="console-log">${this.consoleContent}</div>`;
  }

  /**
   * Format source code with syntax highlighting using highlight.js
   */
  private formatSourceCode(source: string): string {
    // 1. Input handling - Detect language
    const language =
      source.includes("=>") || source.includes("async")
        ? "javascript"
        : "typescript";

    try {
      // 2. Core processing - Apply highlight.js syntax highlighting
      const highlighted = hljs.highlight(source, { language }).value;

      // 3. Output handling
      return highlighted;
    } catch (error) {
      // Fallback to plain text if highlighting fails
      console.error("Syntax highlighting failed:", error);
      return source.replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
