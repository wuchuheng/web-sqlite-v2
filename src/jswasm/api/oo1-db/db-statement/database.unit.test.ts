import type { DB } from "./database";
import type { ExecOptions } from "./database";
import type { DbCtorHelper } from "../db-ctor-helper";
import type { Oo1Context } from "../context";
import type { ExecHelpers, NormalizedExecPlan } from "./execution";
import type { Stmt } from "./statement";
import type { StatementValidators } from "./validation";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDatabaseClass } from "./database";

type StatementRegistry = Record<number, Stmt | undefined>;

interface MockStatementBehavior {
  parameterCount?: number;
  columnCount?: number;
  stepSequence?: boolean[];
  columnNames?: string[];
  getResult?: unknown;
}

interface TestContext {
  context: Oo1Context;
  validators: StatementValidators;
  execHelpers: ExecHelpers;
  dbCtorHelper: DbCtorHelper;
  ptrMap: WeakMap<object, number>;
  stmtMap: WeakMap<DB, StatementRegistry>;
  capi: Record<string, unknown>;
  wasm: Record<string, unknown>;
  util: Record<string, unknown>;
}

const makeDbCtorHelper = (handler?: (self: DB, args: unknown[]) => void) => {
  const fn = function (this: DB, ...args: unknown[]) {
    handler?.(this, args);
  } as DbCtorHelper;
  fn.normalizeArgs = vi.fn();
  fn.setVfsPostOpenCallback = vi.fn();
  return fn;
};

const makeValidators = (
  ptrMap: WeakMap<object, number>,
): StatementValidators => ({
  pointerOf: (target) => ptrMap.get(target as object),
  ensureDbOpen: (db) => {
    const pointer = ptrMap.get(db as object);
    if (!pointer) {
      throw new Error("db closed");
    }
    return db as typeof db;
  },
  ensureStmtOpen: (stmt) => {
    const pointer = ptrMap.get(stmt as object);
    if (!pointer) {
      throw new Error("stmt closed");
    }
    return stmt;
  },
  ensureNotLockedByExec: (statement, operation) => {
    if ((statement as Record<string, unknown>)._lockedByExec) {
      throw new Error(`locked during ${operation}`);
    }
    return statement;
  },
  resolveColumnIndex: (statement, index) => {
    if (
      index < 0 ||
      index >= (statement as Record<string, number>).columnCount
    ) {
      throw new Error("bad column");
    }
    return index;
  },
  resolveParameterIndex: (statement, key) => {
    if (typeof key === "number") return key + 1;
    return key === "$ok" ? 1 : 0;
  },
});

const makeStatementClass = (
  behavior: MockStatementBehavior,
  registry: StatementRegistry,
) => {
  const stepQueue = [...(behavior.stepSequence || [])];
  return class Statement implements Stmt {
    sql = "mock";
    db: DB;
    pointer: number;
    parameterCount: number;
    columnCount: number;
    constructor(db: DB, pointer: number) {
      this.db = db;
      this.pointer = pointer;
      this.parameterCount = behavior.parameterCount ?? 0;
      this.columnCount = behavior.columnCount ?? 0;
      registry[pointer] = this;
    }
    finalize = vi.fn(() => {
      registry[this.pointer] = undefined;
      return undefined as unknown as void;
    });
    clearBindings = vi.fn(() => this);
    reset = vi.fn(() => this);
    bind = vi.fn(() => this);
    bindAsBlob = vi.fn(() => this);
    step = vi.fn(() => {
      return stepQueue.shift() ?? false;
    });
    stepReset = vi.fn(() => this);
    stepFinalize = vi.fn(() => this);
    get = vi.fn(() => behavior.getResult ?? []);
    getColumnName = vi.fn(() => "col");
    getColumnNames = vi.fn((target?: string[]) => {
      const names = behavior.columnNames ?? ["a", "b"];
      if (Array.isArray(target)) {
        target.push(...names);
        return target;
      }
      return [...names];
    });
  };
};

const buildTestContext = (
  statementBehavior: MockStatementBehavior,
  plan?: NormalizedExecPlan,
): TestContext => {
  const ptrMap = new WeakMap<object, number>();
  const stmtMap = new WeakMap<DB, StatementRegistry>();
  const registry: StatementRegistry = {};

  const sqlite3 = { config: { warn: vi.fn() } };
  const capi = {
    sqlite3_close_v2: vi.fn(),
    sqlite3_js_db_export: vi.fn(() => new Uint8Array([1, 2])),
    sqlite3_changes: vi.fn(() => 1),
    sqlite3_total_changes: vi.fn(() => 2),
    sqlite3_changes64: vi.fn(() => 3n),
    sqlite3_total_changes64: vi.fn(() => 4n),
    sqlite3_db_filename: vi.fn(() => "file.db"),
    sqlite3_db_name: vi.fn(() => "main"),
    sqlite3_js_db_vfs: vi.fn(() => 123),
    sqlite3_vfs: class {
      $zName: number;
      constructor(zName: number) {
        this.$zName = zName;
      }
      dispose = vi.fn();
    },
    sqlite3_prepare_v2: vi.fn(() => 0),
    sqlite3_prepare_v3: vi.fn(() => 0),
    sqlite3_sql: vi.fn(() => " select 1 "),
    sqlite3_create_function_v2: vi.fn(() => 0),
    sqlite3_create_window_function: vi.fn(() => 0),
    SQLITE_DETERMINISTIC: 0x800,
    SQLITE_DIRECTONLY: 0x20000000,
    SQLITE_INNOCUOUS: 0x40000000,
    SQLITE_UTF8: 1,
    SQLITE_NOTFOUND: 12,
  };

  const wasm = {
    ptrSizeof: 4,
    pstack: {
      pointer: 0,
      alloc: vi.fn(() => 64),
      restore: vi.fn(),
    },
    scopedAllocPush: vi.fn(() => 1),
    scopedAlloc: vi.fn(() => 100),
    scopedAllocPop: vi.fn(),
    jstrlen: vi.fn(() => 8),
    jstrcpy: vi.fn(),
    heap8: vi.fn(() => {
      const buffer = new Uint8Array(256);
      return buffer;
    }),
    peekPtr: vi.fn((location: number) => {
      if (location === 64) return 222;
      if (location === 100) return 333;
      if (location === 104) return 0;
      return 0;
    }),
    peek: vi.fn(() => 1),
    poke: vi.fn(),
    pokePtr: vi.fn(),
    cstrToJs: vi.fn(() => "kv"),
  };

  const util = {
    isSQLableTypedArray: vi.fn((value: unknown) => value instanceof Uint8Array),
    isBindableTypedArray: vi.fn(),
    isInt32: vi.fn(),
    bigIntFits64: vi.fn(),
    bigIntFitsDouble: vi.fn(),
    flexibleString: vi.fn(),
  };

  const toss = (...message: unknown[]): never => {
    throw new Error(message.join(" "));
  };

  const context: Oo1Context = {
    sqlite3: sqlite3 as never,
    capi: capi as never,
    wasm: wasm as never,
    util: util as never,
    ptrMap,
    stmtMap,
    vfsCallbacks: {},
    toss,
    checkRc: vi.fn((subject, rc: number) => {
      if (rc !== 0) {
        throw new Error(`rc ${rc}`);
      }
      return subject;
    }) as unknown as Oo1Context["checkRc"],
  };

  const validators = makeValidators(ptrMap);
  const dbCtorHelper = makeDbCtorHelper();

  const execHelpers: ExecHelpers = plan
    ? {
        selectFirstRow: vi.fn(),
        selectAllRows: vi.fn(),
        parseExecPlan: vi.fn(() => plan),
      }
    : {
        selectFirstRow: vi.fn(),
        selectAllRows: vi.fn(),
        parseExecPlan: vi.fn(() => {
          throw new Error("parseExecPlan not stubbed");
        }),
      };

  const Statement = makeStatementClass(statementBehavior, registry);
  const Database = createDatabaseClass(
    context,
    dbCtorHelper,
    validators,
    execHelpers,
    Statement as unknown as typeof Stmt,
    Symbol("stmt"),
  );

  return {
    context,
    validators,
    execHelpers,
    dbCtorHelper,
    ptrMap,
    stmtMap,
    capi,
    wasm,
    util,
  };
};

describe("database.mjs", () => {
  let testContext: TestContext;

  beforeEach(() => {
    testContext = buildTestContext({ parameterCount: 0, columnCount: 0 });
  });

  it("forwards constructor arguments to dbCtorHelper", () => {
    const calls: unknown[][] = [];
    const dbCtorHelper = makeDbCtorHelper((_, args) => calls.push(args));
    const Database = createDatabaseClass(
      testContext.context,
      dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );

    const db = new Database("file.db", "c", null);
    testContext.ptrMap.set(db, 1);

    expect(calls).toEqual([["file.db", "c", null]]);
  });

  it("reports open status and affirms open handle", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();

    expect(db.isOpen()).toBe(false);
    testContext.ptrMap.set(db, 9);
    expect(db.isOpen()).toBe(true);
    expect(db.affirmOpen()).toBe(db);
  });

  it("closes database, finalizes statements, and clears hooks", () => {
    const registry: StatementRegistry = {};
    const Statement = makeStatementClass({}, registry);
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 7);

    const stmt = new (Statement as unknown as typeof Stmt)(db as DB, 11);
    testContext.ptrMap.set(stmt as unknown as object, 11);
    testContext.stmtMap.set(db, { 11: stmt as unknown as Stmt });
    (db as DB & { filename: string; onclose: unknown }).filename = "file.db";
    (
      db as DB & { onclose: { before?: () => void; after?: () => void } }
    ).onclose = {
      before: vi.fn(() => {
        throw new Error("before");
      }),
      after: vi.fn(() => {
        throw new Error("after");
      }),
    };

    db.close();

    expect(
      (stmt as unknown as { finalize: () => void }).finalize,
    ).toHaveBeenCalled();
    expect(testContext.ptrMap.has(db)).toBe(false);
    expect(testContext.stmtMap.get(db)).toBeUndefined();
    expect(
      (testContext.context.capi as { sqlite3_close_v2: unknown })
        .sqlite3_close_v2,
    ).toHaveBeenCalledWith(7);
    expect((db as Record<string, unknown>).filename).toBeUndefined();
  });

  it("no-ops close when already closed", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    db.close();
    expect(
      (testContext.context.capi as { sqlite3_close_v2: unknown })
        .sqlite3_close_v2,
    ).not.toHaveBeenCalled();
  });

  it("exports database buffer", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 5);

    const result = db.export();

    expect(
      (testContext.context.capi as { sqlite3_js_db_export: unknown })
        .sqlite3_js_db_export,
    ).toHaveBeenCalledWith(5);
    expect(result).toEqual(new Uint8Array([1, 2]));
  });

  it("routes change counters correctly", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 3);

    expect(db.changes()).toBe(1);
    expect(db.changes(true)).toBe(2);
    expect(db.changes(false, true)).toBe(3n);
    expect(db.changes(true, true)).toBe(4n);
  });

  it("resolves db filename, name, and vfs name", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 10);

    expect(db.dbFilename("main")).toBe("file.db");
    expect(db.dbName(0)).toBe("main");
    expect(db.dbVfsName()).toBe("kv");
    (
      testContext.context.capi as { sqlite3_js_db_vfs: unknown }
    ).sqlite3_js_db_vfs = vi.fn(() => 0);
    expect(db.dbVfsName()).toBeUndefined();
  });

  it("prepares statements and throws on missing pointer", () => {
    const planContext = buildTestContext({ parameterCount: 0, columnCount: 0 });
    const Database = createDatabaseClass(
      planContext.context,
      planContext.dbCtorHelper,
      planContext.validators,
      planContext.execHelpers,
      makeStatementClass(
        { parameterCount: 0, columnCount: 0 },
        {},
      ) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    planContext.ptrMap.set(db, 2);

    const stmt = db.prepare("select 1");
    expect(
      (planContext.context.capi as { sqlite3_prepare_v2: unknown })
        .sqlite3_prepare_v2,
    ).toHaveBeenCalledWith(2, "select 1", -1, 64, null);
    expect(planContext.wasm.pstack.alloc).toHaveBeenCalled();
    expect((stmt as { pointer: number }).pointer).toBe(222);

    (planContext.wasm.peekPtr as (location: number) => number) = vi.fn(() => 0);
    expect(() => db.prepare("")).toThrow("Cannot prepare empty SQL.");
  });

  it("executes SQL, binds, collects rows, and respects callbacks", () => {
    const resultRows: unknown[] = [];
    const savedSql: string[] = [];
    const statementBehavior: MockStatementBehavior = {
      parameterCount: 1,
      columnCount: 2,
      stepSequence: [true, false],
      columnNames: ["c1", "c2"],
      getResult: ["x", "y"],
    };
    const plan: NormalizedExecPlan = {
      sql: "select 1",
      opt: { columnNames: [] } as ExecOptions,
      multi: true,
      returnVal: () => "done",
      resultRows,
      saveSql: savedSql,
      cbArg: (stmt, cache) => {
        cache.columnNames = ["c1", "c2"];
        return stmt.get([]);
      },
    };
    const execContext = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      execContext.context,
      execContext.dbCtorHelper,
      execContext.validators,
      execContext.execHelpers,
      makeStatementClass(statementBehavior, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    execContext.ptrMap.set(db, 30);
    (plan.opt as ExecOptions).callback = vi.fn(() => true);

    const result = db.exec("select 1");

    expect(result).toBe("done");
    expect(resultRows).toEqual([["x", "y"]]);
    expect(savedSql).toEqual(["select 1"]);
    expect((plan.opt as ExecOptions).callback).toHaveBeenCalled();
  });

  it("executes typed array SQL and stops when multi is false", () => {
    const statementBehavior: MockStatementBehavior = {
      parameterCount: 1,
      columnCount: 0,
      stepSequence: [false],
      getResult: [],
    };
    const sqlBytes = new Uint8Array([115, 101, 108, 101, 99, 116]);
    const plan: NormalizedExecPlan = {
      sql: sqlBytes,
      opt: {},
      multi: false,
      returnVal: () => 42,
      resultRows: undefined,
      saveSql: undefined,
    };
    const execContext = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      execContext.context,
      execContext.dbCtorHelper,
      execContext.validators,
      execContext.execHelpers,
      makeStatementClass(statementBehavior, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    execContext.ptrMap.set(db, 31);

    const result = db.exec(plan.sql as Uint8Array);

    expect(result).toBe(42);
    expect(execContext.util.isSQLableTypedArray).toHaveBeenCalledWith(sqlBytes);
  });

  it("creates scalar and window functions and validates inputs", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 50);

    const scalar = vi.fn((_, value: number) => value);
    db.createFunction("add_one", scalar);
    expect(
      (testContext.context.capi as { sqlite3_create_function_v2: unknown })
        .sqlite3_create_function_v2,
    ).toHaveBeenCalledWith(50, "add_one", 1, 1, 0, scalar, null, null, 0);

    const xStep = vi.fn();
    const xFinal = vi.fn();
    const xValue = vi.fn();
    const xInverse = vi.fn();
    db.createFunction(
      "agg",
      undefined as unknown as (...args: unknown[]) => unknown,
      {
        xStep,
        xFinal,
        xValue,
        xInverse,
      },
    );
    expect(
      (testContext.context.capi as { sqlite3_create_window_function: unknown })
        .sqlite3_create_window_function,
    ).toHaveBeenCalled();

    expect(() => db.createFunction("fail", undefined, { xFinal })).toThrow(
      "Missing xStep() callback for aggregate or window UDF.",
    );
    expect(() =>
      db.createFunction("badApp", scalar, { pApp: {} as unknown as number }),
    ).toThrow(
      "Invalid value for pApp property. Must be a legal WASM pointer value.",
    );
  });

  it("delegates select helpers", () => {
    const execHelpers: ExecHelpers = {
      selectFirstRow: vi.fn(() => "first"),
      selectAllRows: vi.fn(() => ["rows"]),
      parseExecPlan: vi.fn(() => {
        throw new Error("noop");
      }),
    };
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();

    expect(db.selectValue("sql")).toBe("first");
    expect(execHelpers.selectFirstRow).toHaveBeenCalledWith(
      db,
      "sql",
      undefined,
      0,
      undefined,
    );
    expect(db.selectArrays("sql", [1])).toEqual(["rows"]);
  });

  it("delegates extended select helpers", () => {
    const execHelpers: ExecHelpers = {
      selectFirstRow: vi.fn((_db, _sql, _bind, target) => target),
      selectAllRows: vi.fn((_db, _sql, _bind, mode) => [mode]),
      parseExecPlan: vi.fn(() => {
        throw new Error("noop");
      }),
    };
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();

    expect(db.selectArray("sql", [1])).toEqual([]);
    expect(execHelpers.selectFirstRow).toHaveBeenCalledWith(db, "sql", [1], []);

    expect(db.selectObject("sql", [2])).toEqual({});
    expect(execHelpers.selectFirstRow).toHaveBeenCalledWith(db, "sql", [2], {});

    expect(db.selectObjects("sql", [3])).toEqual(["object"]);
    expect(execHelpers.selectAllRows).toHaveBeenCalledWith(
      db,
      "sql",
      [3],
      "object",
    );
  });

  it("executes selectValues", () => {
    const statementBehavior = {
      stepSequence: [true, true, false],
      getResult: "val",
    };
    const context = buildTestContext(statementBehavior);
    const Database = createDatabaseClass(
      context.context,
      context.dbCtorHelper,
      context.validators,
      context.execHelpers,
      makeStatementClass(statementBehavior, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    context.ptrMap.set(db, 80);

    const results = db.selectValues("sql", [1]);
    expect(results).toEqual(["val", "val"]);
  });

  it("throws on invalid createFunction arguments", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 90);

    const noop = () => {};
    expect(() =>
      db.createFunction("f", noop, { xStep: noop } as unknown),
    ).toThrow("Ambiguous arguments");

    expect(() =>
      db.createFunction("f", undefined, {
        xStep: noop,
        xFinal: noop,
        xValue: noop,
      } as unknown),
    ).toThrow("xInverse must be provided");

    expect(() =>
      db.createFunction("f", undefined, {
        xStep: noop,
        xFinal: noop,
        xInverse: noop,
      } as unknown),
    ).toThrow("xValue must be provided");

    expect(() =>
      db.createFunction("f", noop, { xValue: noop } as unknown),
    ).toThrow("xValue and xInverse are not permitted for non-window UDFs.");
  });

  it("binds parameters in exec", () => {
    const statementBehavior: MockStatementBehavior = {
      parameterCount: 1,
      stepSequence: [false],
    };
    const bindSpy = vi.fn();
    const Statement = class extends makeStatementClass(statementBehavior, {}) {
      bind = bindSpy;
    };
    const plan: NormalizedExecPlan = {
      sql: "select ?",
      opt: { bind: [42] } as ExecOptions,
      multi: true,
      returnVal: () => "done",
      resultRows: [],
      saveSql: [],
    };
    const execContext = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      execContext.context,
      execContext.dbCtorHelper,
      execContext.validators,
      execContext.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    execContext.ptrMap.set(db, 100);

    db.exec("select ?", { bind: [42] });
    expect(bindSpy).toHaveBeenCalledWith([42]);
  });

  it("executes without results (needFirstEval false)", () => {
    const statementBehavior: MockStatementBehavior = {
      stepSequence: [false],
    };
    const stepSpy = vi.fn(() => false);
    const Statement = class extends makeStatementClass(statementBehavior, {}) {
      step = stepSpy;
    };
    const plan: NormalizedExecPlan = {
      sql: "INSERT INTO t VALUES (1)",
      opt: {} as ExecOptions,
      multi: false,
      returnVal: () => undefined,
    };
    const execContext = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      execContext.context,
      execContext.dbCtorHelper,
      execContext.validators,
      execContext.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    execContext.ptrMap.set(db, 110);

    db.exec("INSERT INTO t VALUES (1)");
    expect(stepSpy).toHaveBeenCalled();
  });

  it("fetches column names even if result set is empty", () => {
    const statementBehavior: MockStatementBehavior = {
      columnCount: 1,
      stepSequence: [false],
    };
    const getColumnNamesSpy = vi.fn();
    const Statement = class extends makeStatementClass(statementBehavior, {}) {
      getColumnNames = getColumnNamesSpy;
    };
    const columnNames: string[] = [];
    const plan: NormalizedExecPlan = {
      sql: "SELECT * FROM empty",
      opt: { columnNames } as ExecOptions,
      multi: false,
      returnVal: () => undefined,
    };
    const execContext = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      execContext.context,
      execContext.dbCtorHelper,
      execContext.validators,
      execContext.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    execContext.ptrMap.set(db, 120);

    db.exec("SELECT * FROM empty", { columnNames });
    expect(getColumnNamesSpy).toHaveBeenCalledWith(columnNames);
  });

  it("rolls back transaction on error", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    const execSpy = vi.spyOn(db, "exec");
    execSpy.mockReturnValue(db);

    expect(() =>
      db.transaction(() => {
        throw new Error("fail");
      }),
    ).toThrow("fail");
    expect(execSpy).toHaveBeenCalledWith("ROLLBACK");
  });

  it("throws on missing function name", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    expect(() => db.createFunction({} as any)).toThrow(
      "missing function name",
    );
  });

  it("throws if non-window function has xInverse", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    const noop = () => {};
    expect(() =>
      db.createFunction("f", noop, { xInverse: noop } as unknown),
    ).toThrow("xValue and xInverse are not permitted for non-window UDFs.");
  });

  it("exec callback returning false does not break loop", () => {
    const statementBehavior = {
      parameterCount: 0,
      columnCount: 1,
      stepSequence: [true, true, false], // 2 rows
    };
    const plan: NormalizedExecPlan = {
      sql: "select 1",
      opt: {
        callback: vi.fn(() => false),
      } as ExecOptions,
      multi: true,
      returnVal: () => undefined,
      resultRows: [],
      cbArg: vi.fn(() => "row"),
    };
    const context = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      context.context,
      context.dbCtorHelper,
      context.validators,
      context.execHelpers,
      makeStatementClass(statementBehavior, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    context.ptrMap.set(db, 130);

    db.exec("select 1", plan.opt);
    expect((plan.opt as ExecOptions).callback).toHaveBeenCalledTimes(2);
  });

  it("swallows errors in onclose hooks", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 140);
    testContext.stmtMap.set(db, {});
    const beforeSpy = vi.fn(() => {
      throw new Error("before");
    });
    const afterSpy = vi.fn(() => {
      throw new Error("after");
    });

    (db as unknown as { onclose: { before: unknown; after: unknown } }).onclose =
      {
        before: beforeSpy,
        after: afterSpy,
      };

    db.close();

    expect(beforeSpy).toHaveBeenCalled();
    expect(afterSpy).toHaveBeenCalled();
    expect(testContext.ptrMap.has(db)).toBe(false);
  });

  it("handles transaction qualifiers", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    const execSpy = vi.spyOn(db, "exec");
    execSpy.mockReturnValue(db);

    db.transaction("IMMEDIATE", () => {});
    expect(execSpy).toHaveBeenCalledWith("BEGIN IMMEDIATE");
  });

  it("throws on invalid createFunction options", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    const noop = () => {};

    expect(() => db.createFunction("f", {})).toThrow(
      "Missing function-type properties",
    );
    expect(() =>
      db.createFunction("f", noop, { pApp: "bad" } as unknown),
    ).toThrow("Invalid value for pApp");
    expect(() =>
      db.createFunction("f", noop, { xDestroy: "bad" } as unknown),
    ).toThrow("xDestroy property must be a function");
  });

  it("sets function flags", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 150);

    const createSpy =
      testContext.context.capi.sqlite3_create_function_v2;

    db.createFunction("f", () => {}, {
      deterministic: true,
      directOnly: true,
      innocuous: true,
    });

    const flags =
      (testContext.context.capi.SQLITE_DETERMINISTIC as number) |
      (testContext.context.capi.SQLITE_DIRECTONLY as number) |
      (testContext.context.capi.SQLITE_INNOCUOUS as number) |
      (testContext.context.capi.SQLITE_UTF8 as number);

    expect(createSpy).toHaveBeenCalledWith(
      150,
      "f",
      0,
      flags,
      0,
      expect.anything(),
      null,
      null,
      0,
    );
  });

  it("suppresses errors during statement finalization on close", () => {
    const registry: StatementRegistry = {};
    const Statement = makeStatementClass({}, registry);
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 160);

    const stmt = new (Statement as unknown as typeof Stmt)(db as DB, 160);
    testContext.ptrMap.set(stmt as unknown as object, 160);
    testContext.stmtMap.set(db, { 160: stmt as unknown as Stmt });
    stmt.finalize = vi.fn(() => {
      throw new Error("fail");
    });

    expect(() => db.close()).not.toThrow();
  });

  it("skips empty statements (comments) in exec", () => {
    const statementBehavior = { stepSequence: [] };
    const plan: NormalizedExecPlan = {
      sql: "-- comment",
      opt: {},
      multi: true,
      returnVal: () => undefined,
    };
    const context = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      context.context,
      context.dbCtorHelper,
      context.validators,
      context.execHelpers,
      makeStatementClass(statementBehavior, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    context.ptrMap.set(db, 170);

    // Mock peekPtr to return 0 (null stmt) then 0 (end of sql)
    const peekPtrSpy = vi.fn();
    peekPtrSpy.mockReturnValueOnce(0); // pStmt = null
    peekPtrSpy.mockReturnValueOnce(0); // pSql = null (stop loop)
    context.wasm.peekPtr = peekPtrSpy;

    // Mock peek to ensure loop condition is met initially if needed,
    // but the loop condition is `while (pSql && wasm.peek(pSql, "i8"))`.
    // We need pSql to be truthy and peek to be truthy initially.
    context.wasm.peek = vi.fn().mockReturnValue(1); // valid sql char

    db.exec("-- comment");
    expect(peekPtrSpy).toHaveBeenCalled();
  });

  it("creates pure aggregate function", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 180);

    const xStep = () => {};
    const xFinal = () => {};
    db.createFunction("agg", { xStep, xFinal });
    
    expect(
        (testContext.context.capi as { sqlite3_create_function_v2: unknown })
          .sqlite3_create_function_v2,
      ).toHaveBeenCalledWith(
          180, 
          "agg", 
          0, 
          expect.any(Number), 
          0, 
          null, 
          xStep, 
          xFinal, 
          0
      );
  });

  it("throws if exec plan has no SQL", () => {
    const execHelpers: ExecHelpers = {
      selectFirstRow: vi.fn(),
      selectAllRows: vi.fn(),
      parseExecPlan: vi.fn(() => ({ sql: null } as unknown as NormalizedExecPlan)),
    };
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 190);

    expect(() => db.exec("foo")).toThrow("exec() requires an SQL string.");
  });

  it("finalizes statement if exec throws mid-execution", () => {
    const statementBehavior = {
        parameterCount: 0,
        columnCount: 0,
        stepSequence: [true], // should step once
    };
    const context = buildTestContext(statementBehavior);
    const finalizeSpy = vi.fn();
    const Statement = class extends makeStatementClass(statementBehavior, {}) {
        finalize = finalizeSpy;
        step = () => { throw new Error("step fail"); };
    };
    const Database = createDatabaseClass(
      context.context,
      context.dbCtorHelper,
      context.validators,
      context.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    context.ptrMap.set(db, 200);

    // Ensure we have a valid statement pointer so it enters the loop and creates the statement
    // but the plan needs SQL
    (context.execHelpers.parseExecPlan as unknown as any).mockReturnValue({
        sql: "select 1",
        opt: {},
        returnVal: () => {},
    });
    // mock prepare to succeed
    
    expect(() => db.exec("select 1")).toThrow("step fail");
    expect(finalizeSpy).toHaveBeenCalled();
  });

  it("throws if xStep provided without xFinal", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    
    expect(() => db.createFunction("f", { xStep: () => {} })).toThrow(
        "Missing xFinal() callback"
    );
  });

  it("throws if pApp is not an integer", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    const noop = () => {};
    testContext.util.isInt32 = vi.fn(() => false); // Mock isInt32 to fail

    expect(() =>
      db.createFunction("f", noop, { pApp: 1.5 } as unknown),
    ).toThrow("Invalid value for pApp");
  });

  it("close ignores already closed statements in registry", () => {
    const registry: StatementRegistry = {};
    const Statement = makeStatementClass({}, registry);
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      Statement as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 210);

    const stmt = new (Statement as unknown as typeof Stmt)(db as DB, 210);
    // Simulate statement being in registry but pointer map returning undefined (closed)
    testContext.stmtMap.set(db, { 210: stmt as unknown as Stmt });
    // Don't set ptrMap for stmt, or set to 0?
    // pointerOf implementation in test mock: ptrMap.get(target)
    // So if I don't set it, it returns undefined (falsy).
    
    stmt.finalize = vi.fn();

    db.close();

    expect(stmt.finalize).not.toHaveBeenCalled();
  });

  it("uses provided arity in createFunction", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 240);
    const noop = () => {};

    db.createFunction("f", noop, { arity: 42 });

    expect(
        (testContext.context.capi as { sqlite3_create_function_v2: unknown })
          .sqlite3_create_function_v2,
      ).toHaveBeenCalledWith(
          240, 
          "f", 
          42, 
          expect.anything(), 
          0, 
          noop, 
          null, 
          null, 
          0
      );
  });

  it("executes callback without collecting rows", () => {
    const statementBehavior = {
      parameterCount: 0,
      columnCount: 1,
      stepSequence: [true],
    };
    const plan: NormalizedExecPlan = {
      sql: "select 1",
      opt: {
        callback: vi.fn(),
      } as ExecOptions,
      multi: true,
      returnVal: () => undefined,
      resultRows: undefined, // Explicitly undefined
      cbArg: vi.fn(() => "row"), // Must be present
    };
    const context = buildTestContext(statementBehavior, plan);
    const Database = createDatabaseClass(
      context.context,
      context.dbCtorHelper,
      context.validators,
      context.execHelpers,
      makeStatementClass(statementBehavior, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    context.ptrMap.set(db, 230);

    db.exec("select 1", plan.opt);
    
    expect((plan.opt as ExecOptions).callback).toHaveBeenCalledWith("row", expect.anything());
  });

  it("calculates arity for unary function", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 220);

    const unary = (a: any) => {};
    db.createFunction("unary", unary);

    expect(
        (testContext.context.capi as { sqlite3_create_function_v2: unknown })
          .sqlite3_create_function_v2,
      ).toHaveBeenCalledWith(
          220, 
          "unary", 
          0, 
          expect.any(Number), 
          0, 
          unary, 
          null, 
          null, 
          0
      );
  });

  it("counts open statements only when handle is open", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 60);
    testContext.stmtMap.set(db, { 1: {} as Stmt, 2: undefined });

    expect(db.openStatementCount()).toBe(1);
    testContext.ptrMap.delete(db);
    expect(db.openStatementCount()).toBe(0);
  });

  it("wraps transaction and savepoint semantics", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    const execSpy = vi.spyOn(db, "exec");
    execSpy.mockReturnValue(db);

    const value = db.transaction(() => "ok");
    expect(value).toBe("ok");
    expect(execSpy).toHaveBeenCalledWith("BEGIN");
    expect(execSpy).toHaveBeenCalledWith("COMMIT");

    expect(() => db.transaction("bad space", () => null)).toThrow(
      "Invalid argument for BEGIN qualifier.",
    );

    execSpy.mockClear();
    expect(() =>
      db.savepoint(() => {
        throw new Error("fail");
      }),
    ).toThrow("fail");
    expect(execSpy).toHaveBeenCalledWith("SAVEPOINT oo1");
    expect(execSpy).toHaveBeenCalledWith(
      "ROLLBACK to SAVEPOINT oo1; RELEASE SAVEPOINT oo1",
    );
  });

  it("exposes diagnostic helpers", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );
    const db = new Database();
    testContext.ptrMap.set(db, 70);
    testContext.stmtMap.set(db, { 1: {} as Stmt });

    expect(db.checkRc(0)).toBe(db);
    expect(db._getStatementRegistry()).toEqual({ 1: {} });
    expect(db._pointer()).toBe(70);
  });

  it("exposes static helpers", () => {
    const Database = createDatabaseClass(
      testContext.context,
      testContext.dbCtorHelper,
      testContext.validators,
      testContext.execHelpers,
      makeStatementClass({}, {}) as unknown as typeof Stmt,
      Symbol("stmt"),
    );

    expect(Database.dbCtorHelper).toBe(testContext.dbCtorHelper);
    
    // Test static checkRc
    const checkRcSpy = testContext.context.checkRc as unknown as any;
    Database.checkRc(123 as unknown as DB, 0);
    expect(checkRcSpy).toHaveBeenCalledWith(123, 0);
  });
});
