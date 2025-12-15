import { describe, test, expect, beforeAll, afterEach } from "vitest";
import sqlite3InitModule from "../../src/sqlite3.mjs";

describe("Sqlite3 test", () => {
  let sqlite3: any;
  let db: any;

  const log = (...args: any[]) => console.log("", ...args);
  const error = (...args: any[]) => console.error("error", ...args);

  beforeAll(async () => {
    sqlite3 = await sqlite3InitModule();
    /* {print: log, printErr: error} */
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
  });

  test("should report sqlite3 version", () => {
    const capi = sqlite3.capi;
    const version = capi.sqlite3_libversion();
    const sourceId = capi.sqlite3_sourceid();

    expect(version).toBeDefined();
    expect(sourceId).toBeDefined();
    log("sqlite3 version", version, sourceId);
  });

  test("should create a transient database", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");

    expect(db.filename).toBeDefined();
    log("transient db =", db.filename);
  });

  test("should create a table using exec()", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");

    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    // Equivalent with options object
    db.exec({ sql: "CREATE TABLE IF NOT EXISTS t2(a,b)" });

    // Verify tables exist by querying sqlite_master
    const tables: string[] = [];
    db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      rowMode: "object",
      callback: (row: any) => tables.push(row.name),
    });

    expect(tables).toContain("t");
    expect(tables).toContain("t2");
  });

  test("should insert data using exec() with bind by index", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");

    for (let i = 20; i <= 25; ++i) {
      db.exec({
        sql: "insert into t(a,b) values (?,?)",
        bind: [i, i * 2],
      });
    }

    const count = db.selectValue("select count(*) from t");
    expect(count).toBe(6);
  });

  test("should insert data using exec() with bind by name", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    // remove t table if exists
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");

    const expectedValue = 5;
    for (let i = 1; i <= expectedValue; ++i) {
      db.exec({
        sql: "insert into t(a,b) values ($a,$b)",
        bind: { $a: i * 10, $b: i * 20 },
      });
    }

    const count = db.selectValue("select count(*) from t");
    expect(count).toBe(expectedValue);
  });

  test("should insert data using prepared statement", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");

    const q = db.prepare(["insert into t(a,b) ", "values(?,?)"]);
    try {
      for (let i = 100; i < 103; ++i) {
        q.bind([i, i * 2]).step();
        q.reset();
      }
      // Equivalent using stepReset()
      for (let i = 103; i <= 105; ++i) {
        q.bind(1, i)
          .bind(2, i * 2)
          .stepReset();
      }
    } finally {
      q.finalize();
    }

    const count = db.selectValue("select count(*) from t");
    expect(count).toBe(6);
  });

  test("should query data with rowMode 'array'", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 2] });
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [3, 4] });
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [5, 6] });

    const rows: any[] = [];
    db.exec({
      sql: "select a from t order by a limit 3",
      rowMode: "array",
      callback: (row: any) => rows.push(row),
    });

    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual([1]);
    expect(rows[1]).toEqual([3]);
    expect(rows[2]).toEqual([5]);
  });

  test("should query data with rowMode 'object'", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 2] });
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [3, 4] });

    const rows: any[] = [];
    db.exec({
      sql: "select a as aa, b as bb from t order by aa limit 3",
      rowMode: "object",
      callback: (row: any) => rows.push(row),
    });

    expect(rows.length).toBe(2);
    expect(rows[0]).toEqual({ aa: 1, bb: 2 });
    expect(rows[1]).toEqual({ aa: 3, bb: 4 });
  });

  test("should query data with rowMode 'stmt'", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [10, 20] });

    const values: any[] = [];
    db.exec({
      sql: "select a from t order by a limit 3",
      rowMode: "stmt",
      callback: (row: any) => values.push(row.get(0)),
    });

    expect(values).toContain(10);
  });

  test("should query data with rowMode as column index", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 100] });
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [2, 200] });

    const bValues: number[] = [];
    db.exec({
      sql: "select a, b from t order by a limit 3",
      rowMode: 1, // result column 1 (b)
      callback: (row: unknown) => bValues.push(row as number),
    });

    expect(bValues).toEqual([100, 200]);
  });

  test("should query data with rowMode as column name", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    // remove the table if exists
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [42, 84] });

    const aValues: number[] = [];
    db.exec({
      sql: "select a, b from t order by a limit 3",
      rowMode: "$a",
      callback: (value: number) => {
        console.log(value);
        aValues.push(value);
      },
    });

    expect(aValues).toContain(42);
  });

  test("should query data with resultRows (no callback)", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 2] });
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [3, 4] });

    const resultRows: any[] = [];
    db.exec({
      sql: "select a, b from t order by a limit 3",
      rowMode: "object",
      resultRows: resultRows,
    });

    expect(resultRows.length).toBe(2);
    expect(resultRows[0]).toEqual({ a: 1, b: 2 });
  });

  test("should create and use a scalar UDF", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [5, 10] });

    db.createFunction({
      name: "twice",
      xFunc: function (_pCx: any, arg: any) {
        return arg + arg;
      },
    });

    const result = db.selectValue("select twice(a) from t where a = 5");
    expect(result).toBe(10);

    // Test with string
    const strResult = db.selectValue("select twice('hello')");
    expect(strResult).toBe("hellohello");
  });

  test("should collect column names from query", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 2] });

    const columnNames: string[] = [];
    db.exec({
      sql: "select a, b from t limit 1",
      columnNames: columnNames,
      rowMode: "array",
      callback: () => {},
    });

    expect(columnNames).toContain("a");
    expect(columnNames).toContain("b");
  });

  test("should throw error for UDF with incorrect arg count", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.createFunction({
      name: "twice",
      xFunc: function (_pCx: any, arg: any) {
        return arg + arg;
      },
    });

    expect(() => {
      db.exec("select twice(1,2,3)");
    }).toThrow();
  });

  test("should rollback transaction on error", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 2] });

    const countBefore = db.selectValue("select count(*) from t");

    expect(() => {
      db.transaction((D: any) => {
        D.exec("delete from t");
        throw new sqlite3.SQLite3Error("Demonstrating transaction() rollback");
      });
    }).toThrow(sqlite3.SQLite3Error);

    const countAfter = db.selectValue("select count(*) from t");
    expect(countAfter).toBe(countBefore); // Data should be restored after rollback
  });

  test("should rollback nested savepoint on error", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");
    db.exec("DROP TABLE IF EXISTS t");
    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    db.exec({ sql: "insert into t(a,b) values (?,?)", bind: [1, 2] });

    const countBefore = db.selectValue("select count(*) from t");

    expect(() => {
      db.savepoint((D: any) => {
        D.exec("delete from t");
        D.savepoint((DD: any) => {
          DD.exec({
            sql: [
              "insert into t(a,b) values(99,100);",
              "select count(*) from t",
            ],
            rowMode: 0,
            resultRows: [],
          });
          throw new sqlite3.SQLite3Error(
            "Demonstrating nested savepoint() rollback",
          );
        });
      });
    }).toThrow(sqlite3.SQLite3Error);

    const countAfter = db.selectValue("select count(*) from t");
    expect(countAfter).toBe(countBefore); // Data should be restored after rollback
  });
});

describe("Taster 1 tests", () => {
  let sqlite3: any;
  let db: any;

  const log = (...args: any[]) => console.log("", ...args);
  const error = (...args: any[]) => console.error("error", ...args);

  beforeAll(async () => {
    sqlite3 = await sqlite3InitModule();
    /* {print: log, printErr: error} */
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
  });

  test("should report sqlite3 version", () => {
    const capi = sqlite3.capi;
    const version = capi.sqlite3_libversion();
    const sourceId = capi.sqlite3_sourceid();

    expect(version).toBeDefined();
    expect(sourceId).toBeDefined();
    log("sqlite3 version", version, sourceId);
  });

  test("tester1: sqlite3_config() (post-init misuse behavior)", () => {
    const capi = sqlite3.capi;

    for (const k of ["SQLITE_CONFIG_GETMALLOC", "SQLITE_CONFIG_URI"] as const) {
      expect(capi[k]).toBeGreaterThan(0);
    }

    expect(capi.sqlite3_config(capi.SQLITE_CONFIG_URI, 1)).toBe(
      capi.SQLITE_MISUSE,
    );
    expect(capi.sqlite3_config(capi.SQLITE_CONFIG_GETMALLOC)).toBe(
      capi.SQLITE_MISUSE,
    );
    expect(capi.sqlite3_config(capi.SQLITE_CONFIG_GETMALLOC, 1)).toBe(
      capi.SQLITE_NOTFOUND,
    );
  });

  test("tester1: JS wasm-side allocator", () => {
    const wasm = sqlite3.wasm;

    if (sqlite3.config?.useStdAlloc) {
      expect(wasm.alloc.impl).toBe(wasm.exports.malloc);
      expect(wasm.dealloc).toBe(wasm.exports.free);
      expect(wasm.realloc.impl).toBe(wasm.exports.realloc);
    } else {
      expect(wasm.alloc.impl).toBe(wasm.exports.sqlite3_malloc);
      expect(wasm.dealloc.impl).toBe(wasm.exports.sqlite3_free);
      expect(wasm.realloc.impl).toBe(wasm.exports.sqlite3_realloc);
    }
  });

  test("tester1: Namespace object checks (portable subset)", () => {
    const capi = sqlite3.capi;
    const wasm = sqlite3.wasm;

    // Spot-check constants
    for (const k of [
      "SQLITE_SCHEMA",
      "SQLITE_NULL",
      "SQLITE_UTF8",
      "SQLITE_STATIC",
      "SQLITE_OPEN_CREATE",
      "SQLITE_OPEN_DELETEONCLOSE",
    ] as const) {
      expect(typeof capi[k]).toBe("number");
    }

    // Spot-check wasm methods
    for (const k of ["alloc", "dealloc", "installFunction"] as const) {
      expect(typeof wasm[k]).toBe("function");
    }

    // Basic errstr sanity
    expect(capi.sqlite3_errstr(capi.SQLITE_OK)).toBe("not an error");
    expect(capi.sqlite3_errstr(capi.SQLITE_CORRUPT)).toContain("malformed");

    // Error classes sanity
    expect(() => {
      throw new sqlite3.WasmAllocError();
    }).toThrowError(Error);

    const e1 = new sqlite3.WasmAllocError("test", { cause: 3 });
    expect(e1.message).toBe("test");
    expect(e1.cause).toBe(3);

    const e2 = new sqlite3.SQLite3Error(capi.SQLITE_SCHEMA);
    expect(e2.resultCode).toBe(capi.SQLITE_SCHEMA);
  });

  test("tester1: strglob/strlike", () => {
    const capi = sqlite3.capi;

    expect(capi.sqlite3_strglob("*.txt", "foo.txt")).toBe(0);
    expect(capi.sqlite3_strglob("*.txt", "foo.xtx")).not.toBe(0);

    expect(capi.sqlite3_strlike("%.txt", "foo.txt", 0)).toBe(0);
    expect(capi.sqlite3_strlike("%.txt", "foo.xtx", 0)).not.toBe(0);
  });

  test("tester1: sqlite3_randomness() to memory buffer", () => {
    const capi = sqlite3.capi;
    const wasm = sqlite3.wasm;

    const stack = wasm.pstack.pointer;
    try {
      const n = 520;
      const p = wasm.pstack.alloc(n);

      expect(wasm.peek8(p)).toBe(0);
      expect(wasm.peek8(wasm.ptr.add(p, n, -1))).toBe(0);

      // Only first (n-10) bytes should be written
      expect(capi.sqlite3_randomness(n - 10, p)).toBeUndefined();

      const heap = wasm.heap8u();
      let headSum = 0;
      for (let j = 0; j < 10 && headSum === 0; ++j)
        headSum += heap[wasm.ptr.add(p, j)];
      expect(headSum).toBeGreaterThan(0);

      let tailSum = 0;
      for (let j = n - 10; j < n && tailSum === 0; ++j)
        tailSum += heap[wasm.ptr.add(p, j)];
      expect(tailSum).toBe(0);
    } finally {
      wasm.pstack.restore(stack);
    }
  });

  test("tester1: sqlite3_randomness() to byte array", () => {
    const capi = sqlite3.capi;

    const ta = new Uint8Array(117);
    expect(ta.every((b) => b === 0)).toBe(true);

    expect(capi.sqlite3_randomness(ta)).toBe(ta);

    const tail = ta.slice(ta.length - 10);
    expect(tail.some((b) => b !== 0)).toBe(true);

    const t0 = new Uint8Array(0);
    expect(capi.sqlite3_randomness(t0)).toBe(t0);
  });

  test("should create a transient database", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");

    expect(db.filename).toBeDefined();
    log("transient db =", db.filename);
  });

  test("should create a table using exec()", () => {
    const oo = sqlite3.oo1;
    db = new oo.DB("/mydb.sqlite3", "ct");

    db.exec("CREATE TABLE IF NOT EXISTS t(a,b)");
    // Equivalent with options object
    db.exec({ sql: "CREATE TABLE IF NOT EXISTS t2(a,b)" });

    // Verify tables exist by querying sqlite_master
    const tables: string[] = [];
    db.exec({
      sql: "SELECT name FROM sqlite_master WHERE type='table'",
      rowMode: "object",
      callback: (row: any) => tables.push(row.name),
    });

    expect(tables).toContain("t");
    expect(tables).toContain("t2");
  });

  // ... existing code ...

  test("tester1: ATTACH (using :memory: instead of kvvfs/session)", () => {
    const capi = sqlite3.capi;
    const wasm = sqlite3.wasm;
    const oo = sqlite3.oo1;

    db = new oo.DB(":memory:", "c");
    db.exec([
      "attach ':memory:' as foo;",
      "create table foo.bar(a);",
      "insert into foo.bar(a) values(1),(2),(3);",
      "select a from foo.bar order by a;",
    ]);

    expect(db.selectValue("select count(*) from foo.bar")).toBe(3);

    // sqlite3_exec() JS callback API: callback receives (values[], names[])
    let rowCount = 0;
    let colCount = 0;
    const rc = capi.sqlite3_exec(
      db,
      "select a, a*2 from foo.bar order by a",
      (aVals: any[], aNames: any[]) => {
        ++rowCount;
        colCount = aVals.length;
        expect(aVals.length).toBe(2);
        expect(aNames.length).toBe(2);
        expect(+aVals[1]).toBe(2 * +aVals[0]);
      },
      0,
      0,
    );
    expect(rc).toBe(0);
    expect(rowCount).toBe(3);
    expect(colCount).toBe(2);

    // Throwing from exec callback => SQLITE_ABORT
    const rc2 = capi.sqlite3_exec(
      db.pointer,
      "select a from foo.bar",
      () => {
        throw new Error("Testing throwing from exec() callback.");
      },
      0,
      0,
    );
    expect(rc2).toBe(capi.SQLITE_ABORT);

    // Full callback signature via wasm.installFunction()
    if (wasm?.installFunction) {
      let rowCount2 = 0;
      const pCb = wasm.installFunction(
        "i(pipp)",
        (pVoid: any, nCols: number) => {
          ++rowCount2;
          expect(nCols).toBeGreaterThan(0);
          expect(wasm.isPtr(pVoid)).toBe(true);
          return 0;
        },
      );
      try {
        const rc3 = capi.sqlite3_exec(db, "select a from foo.bar", pCb, 0, 0);
        expect(rc3).toBe(0);
        expect(rowCount2).toBe(3);
      } finally {
        wasm.uninstallFunction(pCb);
      }
    }

    db.exec("detach foo");
    expect(() => db.exec("select * from foo.bar")).toThrow();
  });

  test("tester1: bind_parameter_...", () => {
    const capi = sqlite3.capi;
    const oo = sqlite3.oo1;

    db = new oo.DB(":memory:", "c");
    db.exec("create table t(a)");
    const stmt = db.prepare("insert into t(a) values($a)");
    try {
      expect(capi.sqlite3_bind_parameter_count(stmt)).toBe(1);
      expect(stmt.parameterCount).toBe(1);

      expect(capi.sqlite3_bind_parameter_index(stmt, "$a")).toBe(1);
      expect(capi.sqlite3_bind_parameter_index(stmt, ":a")).toBe(0);

      expect(stmt.getParamIndex("$a")).toBe(1);
      expect(stmt.getParamIndex(":a")).toBe(0);

      expect(capi.sqlite3_bind_parameter_name(stmt, 1)).toBe("$a");
      expect(capi.sqlite3_bind_parameter_name(stmt, 0)).toBe(null);

      expect(stmt.getParamName(1)).toBe("$a");
      expect(stmt.getParamName(0)).toBe(null);
    } finally {
      stmt.finalize();
    }
  });

  test("tester1: locked-by-exec() APIs", () => {
    const oo = sqlite3.oo1;

    db = new oo.DB(":memory:", "c");
    db.exec("create table t(a);insert into t(a) values(1);");

    const checkOp = (
      op: "bind" | "finalize" | "clearBindings" | "reset" | "step",
    ) => {
      expect(() => {
        db.exec({
          sql: "select ?1",
          bind: op,
          callback: (row: any, stmt: any) => {
            switch (row[0]) {
              case "bind":
                stmt.bind(1);
                break;
              case "finalize":
              case "clearBindings":
              case "reset":
              case "step":
                stmt[op]();
                break;
            }
          },
        });
      }).toThrow(/Operation is illegal when statement is locked/);
    };

    checkOp("bind");
    checkOp("finalize");
    checkOp("clearBindings");
    checkOp("reset");
    checkOp("step");
  });

  test("tester1: interrupt", () => {
    const capi = sqlite3.capi;
    const oo = sqlite3.oo1;

    db = new oo.DB(":memory:", "c");
    expect(capi.sqlite3_is_interrupted(db)).toBe(0);
    capi.sqlite3_interrupt(db);
    expect(capi.sqlite3_is_interrupted(db)).not.toBe(0);
  });

  test("tester1: sqlite3_set_errmsg() (if available)", () => {
    const capi = sqlite3.capi;
    const oo = sqlite3.oo1;

    if (!capi.sqlite3_set_errmsg) return; // not available in some builds

    db = new oo.DB(":memory:", "c");

    expect(capi.sqlite3_errcode(db)).toBe(0);
    expect(capi.sqlite3_errmsg(db)).toBe("not an error");

    expect(capi.sqlite3_set_errmsg(db, capi.SQLITE_RANGE, "nope")).toBe(0);
    expect(capi.sqlite3_errcode(db)).toBe(capi.SQLITE_RANGE);
    expect(capi.sqlite3_errmsg(db)).toBe("nope");

    expect(capi.sqlite3_set_errmsg(0, 0, 0)).toBe(capi.SQLITE_MISUSE);

    expect(capi.sqlite3_set_errmsg(db, 0, 0)).toBe(0);
    expect(capi.sqlite3_errcode(db)).toBe(0);
    expect(capi.sqlite3_errmsg(db)).toBe("not an error");
  });

  test("tester1: Custom collation (if available)", () => {
    const capi = sqlite3.capi;
    const wasm = sqlite3.wasm;
    const oo = sqlite3.oo1;

    if (!capi.sqlite3_create_collation_v2) return;
    if (!wasm?.exports?.sqlite3_strnicmp) return;

    db = new oo.DB(":memory:", "c");

    let collationCounter = 0;
    const myCmp = (pArg: any, n1: number, p1: any, n2: number, p2: any) => {
      ++collationCounter;
      const rc = wasm.exports.sqlite3_strnicmp(p1, p2, n1 < n2 ? n1 : n2);
      return rc ? rc : n1 - n2;
    };

    db.checkRc(
      capi.sqlite3_create_collation_v2(
        db,
        "mycollation",
        capi.SQLITE_UTF8,
        0,
        myCmp,
        0,
      ),
    );
    expect(db.selectValue("select 'hi' = 'HI' collate mycollation")).toBe(1);
    expect(collationCounter).toBe(1);
  });
});
