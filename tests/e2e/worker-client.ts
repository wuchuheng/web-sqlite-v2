export async function runTestInWorker(
  testName: string,
  sql: string,
  dbFile: string = "/test.db",
  skipCleanup: boolean = false,
  checkEnv: boolean = false,
) {
  const worker = new Worker(new URL("./test-worker.ts", import.meta.url), {
    type: "module",
  });

  return new Promise<any[]>((resolve, reject) => {
    worker.onmessage = (e) => {
      worker.terminate(); // Clean up worker
      if (e.data.type === "test-success") {
        resolve(e.data.result);
      } else if (e.data.type === "test-failure") {
        reject(new Error(e.data.error));
      }
    };

    worker.postMessage({
      type: "run-opfs-test",
      payload: {
        testName,
        dbFile,
        sql,
        skipCleanup,
        checkEnv,
      },
    });
  });
}
