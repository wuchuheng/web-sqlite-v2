import Sqlite3Worker from "./worker?worker&inline";

export const start = async (): Promise<void> => {
  const worker = new Sqlite3Worker();

  let msgId = 0;
  const pending = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();

  worker.onmessage = (event) => {
    const { id, type, result, error } = event.data;
    if (type === "init_success" || type === "success") {
      if (pending.has(id)) {
        pending.get(id)?.resolve(result);
        pending.delete(id);
      } else {
        console.log("Worker message:", event.data);
      }
    } else if (type === "error") {
      if (pending.has(id)) {
        pending.get(id)?.reject(new Error(error));
        pending.delete(id);
      } else {
        console.error("Worker error:", error);
      }
    }
  };

  const request = (type: string, payload: any = {}) => {
    return new Promise((resolve, reject) => {
      const id = ++msgId;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, ...payload });
    });
  };

  console.log("Initializing worker...");
  await request("init");
  console.log("Worker initialized.");

  console.log("Opening database...");
  await request("open", { filename: "my_opfs_db.sqlite3" });
  console.log("Database opened.");

  console.log("Creating table...");
  await request("exec", {
    sql: "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)",
  });

  console.log("Inserting data...");
  await request("exec", {
    sql: "INSERT INTO users (name) VALUES (?), (?)",
    bind: ["Alice", "Bob"],
  });

  console.log("Querying data...");
  const users = await request("query", { sql: "SELECT * FROM users" });
  console.log("Users:", users);
};

export default start;
