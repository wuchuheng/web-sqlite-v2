import openDB from "../../src/main";

self.onmessage = async (e: MessageEvent<{ filename: string }>) => {
  const { filename } = e.data;

  // Simulate an environment where nested workers are NOT allowed
  // @ts-expect-error - testing same-thread mode by disabling Worker
  self.Worker = undefined;

  try {
    const db = await openDB(filename, { debug: true });

    await db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);");
    await db.exec("INSERT INTO test (name) VALUES (?)", ["nested-worker-test"]);

    const rows = await db.query<{ name: string }>("SELECT name FROM test");

    await db.close();

    self.postMessage({
      success: true,
      data: rows,
    });
  } catch (err) {
    self.postMessage({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
