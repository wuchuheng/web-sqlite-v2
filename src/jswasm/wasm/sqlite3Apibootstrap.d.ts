import type { BootstrapConfig } from "./bootstrap/configuration.d.ts";
import type {
  Sqlite3Facade as InternalSqlite3Facade,
  Sqlite3Initializer as InternalSqlite3Initializer,
  Sqlite3AsyncInitializer as InternalSqlite3AsyncInitializer,
  Sqlite3BootstrapFunction as InternalSqlite3BootstrapFunction,
  Sqlite3BootstrapGlobal as InternalSqlite3BootstrapGlobal,
  Sqlite3EmscriptenModule as InternalSqlite3EmscriptenModule,
  Sqlite3JsValue,
  Sqlite3ResultValue,
  Sqlite3BinaryValue,
  Sqlite3StructInstance,
  Sqlite3StructDisposer,
  Sqlite3WasmCallArgument as InternalSqlite3WasmCallArgument,
  Sqlite3WasmCallResult as InternalSqlite3WasmCallResult,
} from "./bootstrap/runtime/sqlite3-facade-namespace.d.ts";
import type { DB as Sqlite3DatabaseHandle } from "../../types/index.d.ts";

/**
 * Describes the sqlite3 facade produced by the bootstrap pipeline. The facade
 * exposes the public API surface returned to consumer code once the
 * WebAssembly module has been fully initialised.
 */
export type Sqlite3Facade = InternalSqlite3Facade;

/**
 * Represents the synchronous bootstrap callbacks executed before the sqlite3
 * facade is returned. Each initializer receives the facade and may mutate it
 * in place to expose additional capabilities.
 */
export type Sqlite3Initializer = InternalSqlite3Initializer;

/**
 * Represents asynchronous bootstrap callbacks that run after the synchronous
 * initialisers. Each function resolves to the sqlite3 facade once its async
 * work has completed.
 */
export type Sqlite3AsyncInitializer = InternalSqlite3AsyncInitializer;

/**
 * Models the bootstrap function installed on {@link globalThis}. The function
 * accepts optional configuration overrides and returns the sqlite3 facade. It
 * also exposes initializer queues and caching state used across the bootstrap
 * lifecycle.
 */
export type Sqlite3BootstrapFunction = InternalSqlite3BootstrapFunction;

/**
 * Captures the subset of the Emscripten module required by
 * {@link runSQLite3PostLoadInit}. The bootstrapper inspects the compiled
 * exports and memory references to seed the sqlite3 facade.
 */
export type Sqlite3EmscriptenModule = InternalSqlite3EmscriptenModule;

/**
 * Defines the bootstrap-specific fields placed on the global object while the
 * WebAssembly bridge initialises. The fields are ephemeral and removed once
 * the sqlite3 facade has been constructed.
 */
export type Sqlite3BootstrapGlobal = InternalSqlite3BootstrapGlobal;

/**
 * Primitive values accepted by wasm helper wrappers when bridging between
 * JavaScript and the compiled sqlite3 module.
 */
export type Sqlite3WasmCallArgument = InternalSqlite3WasmCallArgument;

/**
 * Result values produced by wasm helper wrappers after invoking compiled
 * sqlite3 exports.
 */
export type Sqlite3WasmCallResult = InternalSqlite3WasmCallResult;

/**
 * Represents a prepared statement instance exposed to worker callbacks. The
 * interface captures the properties consumed by the worker helpers without
 * relying on the wider OO1 `Stmt` definition.
 */
export interface Sqlite3StatementContext {
  readonly pointer: number;
  readonly columnCount: number;
  readonly parameterCount: number;
  get(index: number): Sqlite3ResultValue;
  getColumnName(index: number): string;
}

/**
 * Scalar values accepted by statement execution helpers when binding
 * parameters from worker messages.
 */
export type Sqlite3BindableValue =
  | null
  | undefined
  | number
  | bigint
  | string
  | boolean
  | Sqlite3BinaryValue;

/**
 * Read-only projection of a row encoded as a positional array.
 */
export type Sqlite3RowArray = ReadonlyArray<Sqlite3ResultValue>;

/**
 * Read-only projection of a row encoded as a keyed object.
 */
export type Sqlite3RowObject = Readonly<Record<string, Sqlite3ResultValue>>;

/**
 * Union describing the row shapes emitted through worker callbacks.
 */
export type Sqlite3RowValue = Sqlite3RowArray | Sqlite3RowObject;

/**
 * Callback signature invoked for each row produced by a worker `exec`
 * operation.
 */
export type Sqlite3WorkerRowCallback = (
  row: Sqlite3RowValue,
  statement: Sqlite3StatementContext,
) => boolean | void;

/**
 * Execution options accepted by the worker `exec` handler. The structure
 * mirrors the OO1 `DB.exec` options but is restricted to the fields observed
 * within the worker pipeline.
 */
export interface Sqlite3WorkerExecOptions {
  sql: string;
  bind?:
    | ReadonlyArray<Sqlite3BindableValue>
    | Readonly<Record<string, Sqlite3BindableValue>>;
  rowMode?: "array" | "object" | "stmt" | number | `$${string}`;
  resultRows?: Sqlite3RowValue[];
  columnNames?: string[];
  callback?: Sqlite3WorkerRowCallback | string;
  returnValue?: "this" | "resultRows" | "saveSql";
  saveSql?: string[];
  countChanges?: boolean | 64;
}

/**
 * Request payload understood by the worker `open` handler.
 */
export interface WorkerOpenRequest {
  filename?: string;
  vfs?: string;
  flags?: string;
  simulateError?: boolean;
}

/**
 * Request payload understood by the worker `close` handler.
 */
export interface WorkerCloseRequest {
  unlink?: boolean;
}

/**
 * Converter directives accepted by the worker `xCall` handler.
 */
export interface Sqlite3WorkerXCallConverters {
  readonly args?: ReadonlyArray<
    true | string | Readonly<[string, ...Sqlite3WasmCallArgument[]]>
  >;
  result?: true | Readonly<[string, ...Sqlite3WasmCallArgument[]]>;
}

/**
 * Structured payload understood by the worker `xCall` handler.
 */
export interface WorkerXCallRequest {
  fn: string;
  args: Sqlite3WasmCallArgument[];
  converters?: Sqlite3WorkerXCallConverters;
  resultType?: string;
  argTypes?: string[];
  resultSize?: number;
  xCall?: "flex" | "wrapped";
  flexResult?: Sqlite3WasmCallResult[];
}

/**
 * Definition payload forwarded to the scalar/aggregate registration helpers.
 */
export interface WorkerFunctionRequest {
  name: string;
  xFunc?: (...args: Sqlite3JsValue[]) => Sqlite3JsValue | void;
  xStep?: (...args: Sqlite3JsValue[]) => void;
  xFinal?: (...args: Sqlite3JsValue[]) => void;
  xValue?: (...args: Sqlite3JsValue[]) => Sqlite3JsValue | void;
  xInverse?: (...args: Sqlite3JsValue[]) => void;
  xDestroy?: () => void;
  pApp?: number;
  arity?: number;
  deterministic?: boolean;
  directOnly?: boolean;
  innocuous?: boolean;
}

/**
 * Snapshot of sqlite3 configuration flags returned by
 * `sqlite3_wasm_config_get()`.
 */
export type Sqlite3ConfigSnapshot = Readonly<
  Record<string, number | string | boolean>
>;

/**
 * Standard status object returned from sqlite3 configuration helpers.
 */
export interface Sqlite3StatusObject {
  result: number;
  message?: string;
  [key: string]: number | string | boolean | Sqlite3StatusObject | undefined;
}

/**
 * Success payload produced by the worker `open` handler.
 */
export interface WorkerOpenResponse {
  filename: string;
  persistent: boolean;
  dbId: string;
  vfs?: string;
}

/**
 * Success payload produced by the worker `close` handler.
 */
export interface WorkerCloseResponse {
  filename?: string;
}

/**
 * Success payload produced by the worker `exec` handler.
 */
export interface WorkerExecResult extends Sqlite3WorkerExecOptions {
  changeCount?: number | bigint;
}

/**
 * Success payload produced by the worker `loadExtension` handler.
 */
export interface WorkerExtensionResponse {
  filename: string;
}

/**
 * Response produced by the worker `configSet` handler when the call succeeds.
 */
export interface WorkerConfigResponse extends Sqlite3StatusObject {
  message: string;
}

/**
 * Error payload posted back to the main thread when a worker handler throws.
 */
export interface Sqlite3WorkerErrorResult {
  operation: string;
  message: string;
  errorClass: string;
  input: Sqlite3WorkerMessage;
  stack?: string | string[];
}

/**
 * Result envelope forwarded from the worker back to the caller.
 */
export type Sqlite3WorkerResponse =
  | {
      type: "result" | "error";
      dbId?: string;
      messageId?: string | number;
      workerReceivedTime: number;
      workerRespondTime: number;
      departureTime?: number;
      result:
        | WorkerOpenResponse
        | WorkerCloseResponse
        | WorkerExecResult
        | WorkerExtensionResponse
        | WorkerConfigResponse
        | Sqlite3StatusObject
        | Sqlite3ConfigSnapshot
        | Sqlite3DatabaseHandle
        | Sqlite3WorkerErrorResult
        | Sqlite3WasmCallResult
        | Sqlite3WasmCallResult[]
        | number;
    }
  | {
      type: "sqlite3-api";
      result: "worker1-ready";
    };

/**
 * Mutable runtime state shared across worker message handlers.
 */
export interface WorkerRuntimeState {
  dbList: Sqlite3DatabaseHandle[];
  idSeq: number;
  idMap: WeakMap<Sqlite3DatabaseHandle, string>;
  xfer: Transferable[];
  dbs: Record<string, Sqlite3DatabaseHandle>;
  open(options: WorkerOpenRequest): Sqlite3DatabaseHandle;
  close(db: Sqlite3DatabaseHandle | undefined, alsoUnlink?: boolean): void;
  post(message: Sqlite3WorkerResponse, transferList?: Transferable[]): void;
  getDb(
    id: string | undefined,
    require?: boolean,
  ): Sqlite3DatabaseHandle | undefined;
}

/**
 * Common envelope shared by all worker request messages.
 */
export interface Sqlite3WorkerMessageBase {
  type: "sqlite3";
  id?:
    | "open"
    | "close"
    | "exec"
    | "configGet"
    | "configSet"
    | "registerFunction"
    | "unregisterFunction"
    | "loadExtension"
    | "xCall";
  messageId?: string | number;
  dbId?: string;
  departureTime?: number;
}

/**
 * Worker request message variants supported by the bootstrap helpers.
 */
export type Sqlite3WorkerMessage =
  | (Sqlite3WorkerMessageBase & { id: "open"; args?: WorkerOpenRequest })
  | (Sqlite3WorkerMessageBase & { id: "close"; args?: WorkerCloseRequest })
  | (Sqlite3WorkerMessageBase & {
      id: "exec";
      args: string | Sqlite3WorkerExecOptions;
    })
  | (Sqlite3WorkerMessageBase & { id: "configGet" })
  | (Sqlite3WorkerMessageBase & {
      id: "configSet";
      args: Record<string, number | string | boolean>;
    })
  | (Sqlite3WorkerMessageBase & {
      id: "registerFunction";
      args: WorkerFunctionRequest;
    })
  | (Sqlite3WorkerMessageBase & {
      id: "unregisterFunction";
      args: WorkerFunctionRequest;
    })
  | (Sqlite3WorkerMessageBase & {
      id: "loadExtension";
      args: { filename: string; entryPoint?: string };
    })
  | (Sqlite3WorkerMessageBase & { id: "xCall" } & WorkerXCallRequest);

/**
 * Struct-like object expected by `sqlite3.vfs.installVfs()`.
 */
export interface Sqlite3StructMethodTable extends Sqlite3StructInstance {
  installMethods(
    methods: Record<
      string,
      (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult
    >,
    applyArgcCheck: boolean,
  ): void;
  registerVfs?(asDefault: boolean): Sqlite3StructInstance;
  addOnDispose?(disposer: Sqlite3StructDisposer): void;
}

/**
 * Describes a VFS or IO component supplied to `sqlite3.vfs.installVfs()`.
 */
export interface Sqlite3VfsComponentOptions {
  struct: Sqlite3StructMethodTable;
  methods: Record<
    string,
    (...args: Sqlite3WasmCallArgument[]) => Sqlite3WasmCallResult
  >;
  applyArgcCheck?: boolean;
  name?: string;
  asDefault?: boolean;
}

/**
 * Installation options accepted by the worker VFS initializer. At least one of
 * `io` or `vfs` must be provided.
 */
export interface Sqlite3VfsInstallOptions {
  io?: Sqlite3VfsComponentOptions;
  vfs?: Sqlite3VfsComponentOptions;
}

declare global {
  /**
   * Bootstrap entry point installed during module initialisation. Consumers
   * may call the function to receive the sqlite3 facade if the automatic
   * bootstrap is bypassed.
   */
  var sqlite3ApiBootstrap: Sqlite3BootstrapFunction;

  /**
   * Optional configuration overrides inspected by the bootstrapper before
   * resolving the final {@link BootstrapConfig} instance.
   */
  var sqlite3ApiConfig: Partial<BootstrapConfig> | undefined;
}

/**
 * Applies the bootstrap pipeline once the WebAssembly module has loaded. The
 * function wires helper namespaces, instantiates the sqlite3 facade, and
 * caches the result on both the bootstrap function and Emscripten module.
 */
export function runSQLite3PostLoadInit(
  emscriptenModule: Sqlite3EmscriptenModule,
): void;

export {};
