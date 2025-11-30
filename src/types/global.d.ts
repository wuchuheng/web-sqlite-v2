/* eslint-disable @typescript-eslint/no-explicit-any */
// Type definitions for global variables
// This file defines properties attached to globalThis across the application.

import type {
  Sqlite3InitModuleState,
  WrappedInitModule,
} from "../jswasm/utils/sqlite3-init-wrapper/sqlite3-init-wrapper";
import type { StructBinderFactory } from "../jswasm/utils/struct-binder/struct-binder-factory/struct-binder-factory";

declare global {
  // -------------------------------------------------------------------------
  // SQLite3 / Emscripten Module Hooks
  // -------------------------------------------------------------------------

  /**
   * The Emscripten-generated module initializer.
   * Can be the raw one or the wrapped one.
   */
  var sqlite3InitModule: WrappedInitModule | undefined;

  /**
   * State metadata captured during initialization.
   */
  var sqlite3InitModuleState: Sqlite3InitModuleState | undefined;

  /**
   * Configuration object for the SQLite3 API bootstrap.
   * Used as a fallback if arguments aren't passed to sqlite3ApiBootstrap.
   */
  var sqlite3ApiConfig: Record<string, any> | undefined;

  /**
   * The main bootstrap function for the SQLite3 high-level API.
   */
  var sqlite3ApiBootstrap: {
    (apiConfig?: any): any;
    defaultConfig: any;
    sqlite3?: any;
    initializers: ((sqlite3: any) => void)[];
    initializersAsync: ((sqlite3: any) => Promise<void>)[];
  } | undefined;


  // -------------------------------------------------------------------------
  // OPFS / VFS / Worker Utilities
  // -------------------------------------------------------------------------

  /**
   * The AsyncProxyWorker class constructor.
   * Defined in `src/jswasm/vfs/opfs/async-proxy/async-proxy-worker.mjs`.
   */
  var AsyncProxyWorker: {
    new (postFn: (type: string, ...payload: any[]) => void): any;
  } | undefined;


  // -------------------------------------------------------------------------
  // Application Helpers
  // -------------------------------------------------------------------------

  /**
   * StructBinderFactory exposed globally as `Jaccwabyt`.
   */
  var Jaccwabyt: typeof StructBinderFactory | undefined;


  // -------------------------------------------------------------------------
  // Browser / Environment Features (Polyfills or Checks)
  // -------------------------------------------------------------------------

  // These might be present in standard libs but sometimes accessed safely via globalThis
  // or checked for existence. They are removed from here to avoid conflicts with lib.dom.d.ts.

  // eslint-disable-next-line no-var
  var SharedArrayBuffer: SharedArrayBufferConstructor | undefined;
  // eslint-disable-next-line no-var
  var Atomics: Atomics | undefined;
}

export {};
