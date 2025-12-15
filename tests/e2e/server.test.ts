// @vitest-environment node
import { test, expect, beforeAll, afterAll } from "vitest";
import { chromium, Browser, Page } from "playwright";
import { spawn, ChildProcess } from "child_process";

let server: ChildProcess;
let browser: Browser;
let page: Page;

const PORT = 8399;
const URL = `http://localhost:${PORT}/samples/index.html`;

beforeAll(async () => {
  // Start the HTTP server
  console.log("Starting HTTP server...");
  server = spawn(
    "npx",
    ["tsx", "scripts/http-service.ts", "./", "--port", String(PORT)],
    {
      stdio: "pipe",
      shell: true,
    },
  );

  // Wait for server to start
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const onData = (data: Buffer) => {
      output += data.toString();
      if (output.includes(`http://localhost:${PORT}`)) {
        resolve();
      }
    };

    server.stdout?.on("data", onData);
    server.stderr?.on("data", (data) =>
      console.error(`Server stderr: ${data}`),
    );
    server.on("error", reject);

    // Timeout
    setTimeout(
      () => reject(new Error(`Server start timeout. Output so far: ${output}`)),
      10000,
    );
  });
  console.log("HTTP server started.");

  browser = await chromium.launch();
  page = await browser.newPage();
}, 30000);

afterAll(async () => {
  await browser?.close();
  if (server) {
    // Kill the process group to ensure npx/tsx and the script are killed
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch (e) {
      // ignore ESRCH (process already dead)
    }
    // Note: 'shell: true' and process groups might be tricky across OS.
    // Usually server.kill() is enough for a simple spawn, but with npx+tsx it creates subprocesses.
    // For now simple kill, if it lingers in CI it's a problem, but locally it's usually okay.
    server.kill();
  }
});

test('should load samples/index.html and initialize sqlite3 without "Invalid URL" error', async () => {
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      consoleErrors.push(text);
    }
    consoleLogs.push(text);
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  console.log(`Navigating to ${URL}...`);
  await page.goto(URL);

  // Wait for "init sqlite3" which indicates success in worker.ts
  // Or "worker init" from main.ts.
  // We give it some time.
  try {
    await expect
      .poll(() => consoleLogs, { timeout: 10000, interval: 500 })
      .toContain("init sqlite3");
  } catch (e) {
    console.log("Console Logs:", consoleLogs);
    console.error("Console Errors:", consoleErrors);
    throw new Error('Timed out waiting for "init sqlite3" log message.');
  }

  // Check for the specific error
  const invalidUrlErrors = consoleErrors.filter((e) =>
    e.includes("Invalid URL"),
  );
  expect(invalidUrlErrors).toEqual([]);

  // Check for other unexpected errors (optional, but good practice)
  // We filter out some potential unrelated noise if necessary, but "Failed to construct 'URL'" is the key one.
}, 30000);
