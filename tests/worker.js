import sqlite3InitModule from "../src/jswasm/sqlite3.mjs";

self.onmessage = async function (event) {
  console.log(event);

  const sqlite3 = await sqlite3InitModule({
    print: console.log,
    printErr: console.error,
  });

  const uri = "file:///foo_hello.db?vfs=opfs";
  const args = uri;
  let db = new sqlite3.oo1.DB(args);
  const result = await db.exec([
    "drop table if exists user;",
    "create table user (id integer primary key, name text);",
    "insert into user(name) values('abc'),('def'),('ghi');",
  ]);

  console.log(result);
};
