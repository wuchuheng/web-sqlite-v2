export type WasmPointer = number;

export type ExecCallback = (
  columnValues: (string | null)[],
  columnNames: string[],
) => number | boolean | void;

export interface SQLite3CAPI {
  readonly SQLITE_ERROR: number;
}

export interface Sqlite3FuncPtrAdapterOptions {
  readonly name?: string;
  readonly signature: string;
  readonly bindScope?: "singleton" | "context" | "transient";
  readonly contextKey?: (argv: WasmPointer[], index: number) => string | number;
  readonly callProxy?: (
    callback: (...args: unknown[]) => unknown,
  ) => (...args: unknown[]) => unknown;
}

export interface Sqlite3FuncPtrAdapter {
  readonly signature: string;
  readonly bindScope: "singleton" | "context" | "transient";
}

export interface Sqlite3FuncPtrAdapterConstructor {
  new (options: Sqlite3FuncPtrAdapterOptions): Sqlite3FuncPtrAdapter;
  warnOnUse: boolean;
}

export type Sqlite3BindingSignatureArgument =
  | string
  | number
  | Sqlite3FuncPtrAdapter
  | Sqlite3FuncPtrAdapterConstructor
  | ReadonlyArray<Sqlite3BindingSignatureArgument>;

export type Sqlite3BindingSignature = [
  string,
  string | undefined,
  ...Sqlite3BindingSignatureArgument[],
];

export type Sqlite3BindingSignatureCollection = Sqlite3BindingSignature[] & {
  int64?: Sqlite3BindingSignature[];
  wasmInternal?: Sqlite3BindingSignature[];
};

export interface Sqlite3XWrap {
  FuncPtrAdapter: Sqlite3FuncPtrAdapterConstructor;
}

export interface Sqlite3WasmNamespace {
  xWrap: Sqlite3XWrap;
  cArgvToJs: (argc: number, argv: number) => (string | number | null)[];
  cstrToJs: (pointer: number) => string;
  exports: Record<string, unknown>;
}

export interface OptionalBindingGroups {
  progressHandler?: Sqlite3BindingSignature;
  stmtExplain?: Sqlite3BindingSignature[];
  authorizer?: Sqlite3BindingSignature;
}

type AuthorizerCallback = (
  context: WasmPointer,
  code: number,
  arg0: string | WasmPointer,
  arg1: string | WasmPointer,
  arg2: string | WasmPointer,
  arg3: string | WasmPointer,
) => number | void;

const contextKeyFromFirstArg = (argv: WasmPointer[]): WasmPointer => argv[0];
type FuncPtrCallProxy = NonNullable<Sqlite3FuncPtrAdapterOptions["callProxy"]>;

function createAdapter(
  wasm: Sqlite3WasmNamespace,
  options: Sqlite3FuncPtrAdapterOptions,
): Sqlite3FuncPtrAdapter {
  return new wasm.xWrap.FuncPtrAdapter(options);
}

function createContextAdapter(
  wasm: Sqlite3WasmNamespace,
  options: Sqlite3FuncPtrAdapterOptions,
): Sqlite3FuncPtrAdapter {
  return createAdapter(wasm, {
    contextKey: contextKeyFromFirstArg,
    ...options,
  });
}

function normalizeErrorResult(error: unknown, capi: SQLite3CAPI): number {
  const candidate = error as { resultCode?: number } | undefined;
  return candidate?.resultCode ?? capi.SQLITE_ERROR;
}

function createExecCallProxy(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CAPI,
): FuncPtrCallProxy {
  return (callback) => {
    const execCallback = callback as ExecCallback;
    let cachedNames: (string | number | null)[] | undefined;

    const proxy = (
      _context: WasmPointer,
      columnCount: number,
      columnValues: WasmPointer,
      columnNames: WasmPointer,
    ) => {
      // 1. Convert wasm pointers into JavaScript arrays.
      try {
        const values = wasm.cArgvToJs(columnCount, columnValues);
        if (!cachedNames) {
          cachedNames = wasm.cArgvToJs(columnCount, columnNames);
        }

        // 2. Invoke the callback with cached column names.
        const result = execCallback(
          values as (string | null)[],
          cachedNames as unknown as string[],
        );

        // 3. Normalize the callback result into an integer status code.
        const normalized = Number(result ?? 0);
        return normalized | 0;
      } catch (error) {
        return normalizeErrorResult(error, capi);
      }
    };
    return proxy as (...args: unknown[]) => unknown;
  };
}

function maybeCstrToJs(
  wasm: Sqlite3WasmNamespace,
  pointer: WasmPointer,
): string | WasmPointer {
  return pointer ? wasm.cstrToJs(pointer) : pointer;
}

function createAuthorizerCallProxy(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CAPI,
): FuncPtrCallProxy {
  return (callback) => {
    const authorizerCallback = callback as AuthorizerCallback;
    const proxy = (
      context: WasmPointer,
      code: number,
      arg0: WasmPointer,
      arg1: WasmPointer,
      arg2: WasmPointer,
      arg3: WasmPointer,
    ) => {
      // 1. Convert any non-null pointers to strings.
      try {
        const convertedArg0 = maybeCstrToJs(wasm, arg0);
        const convertedArg1 = maybeCstrToJs(wasm, arg1);
        const convertedArg2 = maybeCstrToJs(wasm, arg2);
        const convertedArg3 = maybeCstrToJs(wasm, arg3);

        // 2. Delegate to the caller-provided authorizer callback.
        const result =
          authorizerCallback(
            context,
            code,
            convertedArg0,
            convertedArg1,
            convertedArg2,
            convertedArg3,
          ) || 0;

        // 3. Ensure an integer status code.
        return result as number;
      } catch (error) {
        return normalizeErrorResult(error, capi);
      }
    };
    return proxy as (...args: unknown[]) => unknown;
  };
}

function createExecAdapter(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CAPI,
): Sqlite3FuncPtrAdapter {
  return createAdapter(wasm, {
    signature: "i(pipp)",
    bindScope: "transient",
    callProxy: createExecCallProxy(wasm, capi),
  });
}

function createProgressHandlerAdapter(
  wasm: Sqlite3WasmNamespace,
): Sqlite3FuncPtrAdapter {
  return createContextAdapter(wasm, {
    name: "xProgressHandler",
    signature: "i(p)",
    bindScope: "context",
  });
}

function createAuthorizerAdapter(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CAPI,
): Sqlite3FuncPtrAdapter {
  return createContextAdapter(wasm, {
    name: "sqlite3_set_authorizer::xAuth",
    signature: "i(pi" + "ssss)",
    callProxy: createAuthorizerCallProxy(wasm, capi),
  });
}

function createBusyHandlerAdapter(
  wasm: Sqlite3WasmNamespace,
): Sqlite3FuncPtrAdapter {
  return createContextAdapter(wasm, { signature: "i(pi)" });
}

function createCommitHookAdapter(
  wasm: Sqlite3WasmNamespace,
): Sqlite3FuncPtrAdapter {
  return createContextAdapter(wasm, {
    name: "sqlite3_commit_hook",
    signature: "i(p)",
  });
}

function createRollbackHookAdapter(
  wasm: Sqlite3WasmNamespace,
): Sqlite3FuncPtrAdapter {
  return createContextAdapter(wasm, {
    name: "sqlite3_rollback_hook",
    signature: "v(p)",
  });
}

function createTraceCallbackAdapter(
  wasm: Sqlite3WasmNamespace,
): Sqlite3FuncPtrAdapter {
  return createContextAdapter(wasm, {
    name: "sqlite3_trace_v2::callback",
    signature: "i(ippp)",
  });
}

/**
 * Creates the core binding signatures for SQLite3 C API functions.
 *
 * @param wasm Wasm helper namespace exposing xWrap utilities.
 * @param capi C API namespace with error codes.
 * @returns Array of binding signature descriptors.
 */
export function createCoreBindings(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CAPI,
): Sqlite3BindingSignatureCollection {
  const execAdapter = createExecAdapter(wasm, capi);
  const busyHandlerAdapter = createBusyHandlerAdapter(wasm);
  const commitHookAdapter = createCommitHookAdapter(wasm);
  const rollbackHookAdapter = createRollbackHookAdapter(wasm);
  const traceCallbackAdapter = createTraceCallbackAdapter(wasm);

  const bindings = [
    ["sqlite3_aggregate_context", "void*", "sqlite3_context*", "int"],

    // Binding functions
    ["sqlite3_bind_double", "int", "sqlite3_stmt*", "int", "f64"],
    ["sqlite3_bind_int", "int", "sqlite3_stmt*", "int", "int"],
    ["sqlite3_bind_null", undefined, "sqlite3_stmt*", "int"],
    ["sqlite3_bind_parameter_count", "int", "sqlite3_stmt*"],
    ["sqlite3_bind_parameter_index", "int", "sqlite3_stmt*", "string"],
    ["sqlite3_bind_parameter_name", "string", "sqlite3_stmt*", "int"],
    [
      "sqlite3_bind_pointer",
      "int",
      "sqlite3_stmt*",
      "int",
      "*",
      "string:static",
      "*",
    ],

    // Busy handler
    ["sqlite3_busy_handler", "int", ["sqlite3*", busyHandlerAdapter, "*"]],
    ["sqlite3_busy_timeout", "int", "sqlite3*", "int"],

    // Database operations
    ["sqlite3_changes", "int", "sqlite3*"],
    ["sqlite3_clear_bindings", "int", "sqlite3_stmt*"],
    ["sqlite3_collation_needed", "int", "sqlite3*", "*", "*"],

    // Column operations
    ["sqlite3_column_blob", "*", "sqlite3_stmt*", "int"],
    ["sqlite3_column_bytes", "int", "sqlite3_stmt*", "int"],
    ["sqlite3_column_count", "int", "sqlite3_stmt*"],
    ["sqlite3_column_decltype", "string", "sqlite3_stmt*", "int"],
    ["sqlite3_column_double", "f64", "sqlite3_stmt*", "int"],
    ["sqlite3_column_int", "int", "sqlite3_stmt*", "int"],
    ["sqlite3_column_name", "string", "sqlite3_stmt*", "int"],
    ["sqlite3_column_text", "string", "sqlite3_stmt*", "int"],
    ["sqlite3_column_type", "int", "sqlite3_stmt*", "int"],
    ["sqlite3_column_value", "sqlite3_value*", "sqlite3_stmt*", "int"],

    // Hooks
    ["sqlite3_commit_hook", "void*", ["sqlite3*", commitHookAdapter, "*"]],

    // Compilation options
    ["sqlite3_compileoption_get", "string", "int"],
    ["sqlite3_compileoption_used", "int", "string"],
    ["sqlite3_complete", "int", "string:flexible"],
    ["sqlite3_context_db_handle", "sqlite3*", "sqlite3_context*"],

    // Data access
    ["sqlite3_data_count", "int", "sqlite3_stmt*"],
    ["sqlite3_db_filename", "string", "sqlite3*", "string"],
    ["sqlite3_db_handle", "sqlite3*", "sqlite3_stmt*"],
    ["sqlite3_db_name", "string", "sqlite3*", "int"],
    ["sqlite3_db_readonly", "int", "sqlite3*", "string"],
    ["sqlite3_db_status", "int", "sqlite3*", "int", "*", "*", "int"],

    // Error handling
    ["sqlite3_errcode", "int", "sqlite3*"],
    ["sqlite3_errmsg", "string", "sqlite3*"],
    ["sqlite3_error_offset", "int", "sqlite3*"],
    ["sqlite3_errstr", "string", "int"],

    // Execute SQL
    [
      "sqlite3_exec",
      "int",
      ["sqlite3*", "string:flexible", execAdapter, "*", "**"],
    ],
    ["sqlite3_expanded_sql", "string", "sqlite3_stmt*"],
    ["sqlite3_extended_errcode", "int", "sqlite3*"],
    ["sqlite3_extended_result_codes", "int", "sqlite3*", "int"],

    // File control
    ["sqlite3_file_control", "int", "sqlite3*", "string", "int", "*"],
    ["sqlite3_finalize", "int", "sqlite3_stmt*"],
    ["sqlite3_free", undefined, "*"],
    ["sqlite3_get_autocommit", "int", "sqlite3*"],
    ["sqlite3_get_auxdata", "*", "sqlite3_context*", "int"],

    // Initialization and interruption
    ["sqlite3_initialize", undefined],
    ["sqlite3_interrupt", undefined, "sqlite3*"],
    ["sqlite3_is_interrupted", "int", "sqlite3*"],

    // Keywords
    ["sqlite3_keyword_count", "int"],
    ["sqlite3_keyword_name", "int", ["int", "**", "*"]],
    ["sqlite3_keyword_check", "int", ["string", "int"]],

    // Version info
    ["sqlite3_libversion", "string"],
    ["sqlite3_libversion_number", "int"],
    ["sqlite3_limit", "int", ["sqlite3*", "int", "int"]],

    // Memory management
    ["sqlite3_malloc", "*", "int"],
    ["sqlite3_open", "int", "string", "*"],
    ["sqlite3_open_v2", "int", "string", "*", "int", "string"],
    ["sqlite3_realloc", "*", "*", "int"],
    ["sqlite3_reset", "int", "sqlite3_stmt*"],

    // Result functions
    ["sqlite3_result_blob", undefined, "sqlite3_context*", "*", "int", "*"],
    ["sqlite3_result_double", undefined, "sqlite3_context*", "f64"],
    ["sqlite3_result_error", undefined, "sqlite3_context*", "string", "int"],
    ["sqlite3_result_error_code", undefined, "sqlite3_context*", "int"],
    ["sqlite3_result_error_nomem", undefined, "sqlite3_context*"],
    ["sqlite3_result_error_toobig", undefined, "sqlite3_context*"],
    ["sqlite3_result_int", undefined, "sqlite3_context*", "int"],
    ["sqlite3_result_null", undefined, "sqlite3_context*"],
    [
      "sqlite3_result_pointer",
      undefined,
      "sqlite3_context*",
      "*",
      "string:static",
      "*",
    ],
    ["sqlite3_result_subtype", undefined, "sqlite3_value*", "int"],
    [
      "sqlite3_result_text",
      undefined,
      "sqlite3_context*",
      "string",
      "int",
      "*",
    ],
    ["sqlite3_result_zeroblob", undefined, "sqlite3_context*", "int"],

    // Rollback hook
    ["sqlite3_rollback_hook", "void*", ["sqlite3*", rollbackHookAdapter, "*"]],

    // Auxiliary data
    ["sqlite3_set_auxdata", undefined, ["sqlite3_context*", "int", "*", "*"]],
    ["sqlite3_shutdown", undefined],
    ["sqlite3_sourceid", "string"],
    ["sqlite3_sql", "string", "sqlite3_stmt*"],

    // Status
    ["sqlite3_status", "int", "int", "*", "*", "int"],
    ["sqlite3_step", "int", "sqlite3_stmt*"],
    ["sqlite3_stmt_busy", "int", "sqlite3_stmt*"],
    ["sqlite3_stmt_readonly", "int", "sqlite3_stmt*"],
    ["sqlite3_stmt_status", "int", "sqlite3_stmt*", "int", "int"],

    // String operations
    ["sqlite3_strglob", "int", "string", "string"],
    ["sqlite3_stricmp", "int", "string", "string"],
    ["sqlite3_strlike", "int", "string", "string", "int"],
    ["sqlite3_strnicmp", "int", "string", "string", "int"],

    // Table metadata
    [
      "sqlite3_table_column_metadata",
      "int",
      "sqlite3*",
      "string",
      "string",
      "string",
      "**",
      "**",
      "*",
      "*",
      "*",
    ],

    // Total changes
    ["sqlite3_total_changes", "int", "sqlite3*"],

    // Tracing
    ["sqlite3_trace_v2", "int", ["sqlite3*", "int", traceCallbackAdapter, "*"]],
    ["sqlite3_txn_state", "int", ["sqlite3*", "string"]],

    // URI parameters
    ["sqlite3_uri_boolean", "int", "sqlite3_filename", "string", "int"],
    ["sqlite3_uri_key", "string", "sqlite3_filename", "int"],
    ["sqlite3_uri_parameter", "string", "sqlite3_filename", "string"],

    // Value functions
    ["sqlite3_user_data", "void*", "sqlite3_context*"],
    ["sqlite3_value_blob", "*", "sqlite3_value*"],
    ["sqlite3_value_bytes", "int", "sqlite3_value*"],
    ["sqlite3_value_double", "f64", "sqlite3_value*"],
    ["sqlite3_value_dup", "sqlite3_value*", "sqlite3_value*"],
    ["sqlite3_value_free", undefined, "sqlite3_value*"],
    ["sqlite3_value_frombind", "int", "sqlite3_value*"],
    ["sqlite3_value_int", "int", "sqlite3_value*"],
    ["sqlite3_value_nochange", "int", "sqlite3_value*"],
    ["sqlite3_value_numeric_type", "int", "sqlite3_value*"],
    ["sqlite3_value_pointer", "*", "sqlite3_value*", "string:static"],
    ["sqlite3_value_subtype", "int", "sqlite3_value*"],
    ["sqlite3_value_text", "string", "sqlite3_value*"],
    ["sqlite3_value_type", "int", "sqlite3_value*"],

    // VFS operations
    ["sqlite3_vfs_find", "*", "string"],
    ["sqlite3_vfs_register", "int", "sqlite3_vfs*", "int"],
    ["sqlite3_vfs_unregister", "int", "sqlite3_vfs*"],
  ] as Sqlite3BindingSignatureCollection;

  return bindings;
}

/**
 * Creates optional binding signatures that depend on specific compile-time features.
 *
 * @param wasm Wasm helper namespace exposing optional exports.
 * @param capi C API namespace.
 * @returns Optional binding collections keyed by feature.
 */
export function createOptionalBindings(
  wasm: Sqlite3WasmNamespace,
  capi: SQLite3CAPI,
): OptionalBindingGroups {
  const optional: OptionalBindingGroups = {};

  if (wasm.exports.sqlite3_progress_handler) {
    optional.progressHandler = [
      "sqlite3_progress_handler",
      undefined,
      ["sqlite3*", "int", createProgressHandlerAdapter(wasm), "*"],
    ];
  }

  if (wasm.exports.sqlite3_stmt_explain) {
    optional.stmtExplain = [
      ["sqlite3_stmt_explain", "int", "sqlite3_stmt*", "int"],
      ["sqlite3_stmt_isexplain", "int", "sqlite3_stmt*"],
    ];
  }

  if (wasm.exports.sqlite3_set_authorizer) {
    optional.authorizer = [
      "sqlite3_set_authorizer",
      "int",
      ["sqlite3*", createAuthorizerAdapter(wasm, capi), "*"],
    ];
  }

  return optional;
}

/**
 * Creates WASM-internal binding signatures.
 *
 * @returns Array of internal binding signatures.
 */
export function createWasmInternalBindings(): Sqlite3BindingSignatureCollection {
  return [
    ["sqlite3__wasm_db_reset", "int", "sqlite3*"],
    ["sqlite3__wasm_db_vfs", "sqlite3_vfs*", "sqlite3*", "string"],
    [
      "sqlite3__wasm_vfs_create_file",
      "int",
      "sqlite3_vfs*",
      "string",
      "*",
      "int",
    ],
    ["sqlite3__wasm_posix_create_file", "int", "string", "*", "int"],
    ["sqlite3__wasm_vfs_unlink", "int", "sqlite3_vfs*", "string"],
    ["sqlite3__wasm_qfmt_token", "string:dealloc", "string", "int"],
  ] as Sqlite3BindingSignatureCollection;
}
