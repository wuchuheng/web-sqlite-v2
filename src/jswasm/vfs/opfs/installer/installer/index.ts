/**
 * OPFS VFS Installer for SQLite WASM
 *
 * This module provides the main entry point for installing the Origin Private File System (OPFS)
 * Virtual File System (VFS) for SQLite in WebAssembly environments. It coordinates all installer
 * components to enable persistent, high-performance storage in modern browsers.
 *
 * @module opfs-vfs-installer
 */

import {
  validateOpfsEnvironment,
  thisThreadHasOPFS,
} from "../core/environment-validation/environment-validation";
import { prepareOpfsConfig } from "../core/config-setup/config-setup";
import { createSerializer } from "../core/serialization/serialization";
import {
  initializeOpfsState,
  initializeMetrics,
} from "../core/state-initialization/state-initialization";
import {
  createOperationRunner,
  createOperationTimer,
} from "../core/operation-runner/operation-runner";
import { createIoSyncWrappers } from "../wrappers/io-sync-wrappers/io-sync-wrappers";
import { createVfsSyncWrappers } from "../wrappers/vfs-sync-wrappers/vfs-sync-wrappers";
import { createOpfsUtil } from "../utils/opfs-util/opfs-util";
import { runSanityCheck } from "../utils/sanity-check/sanity-check";
import { createWorkerMessageHandler } from "../utils/worker-message-handler/worker-message-handler";
import {
  setupOptionalVfsMethods,
  integrateWithOo1,
} from "../wrappers/vfs-integration/vfs-integration";
import type {
  OpfsUtilInterface,
  SQLite3Module,
  InstallOpfsVfs,
  OpfsConfig,
  OpfsFileHandle,
  PromiseWasRejected,
  OpfsInstallerOptions,
} from "../../../../shared/opfs-vfs-installer";

/**
 * Initializer function for OPFS VFS that configures default proxy URI
 * and installs the VFS with error handling.
 */
export type InstallOpfsVfsInitializer = (
  sqlite3: SQLite3Module,
) => Promise<void>;

/**
 * Context object returned by createInstallOpfsVfsContext containing
 * both the installer function and initializer function.
 */
export interface InstallOpfsVfsContext {
  /** Main installer function for OPFS VFS */
  installOpfsVfs: InstallOpfsVfs;
  /** Initializer function that sets up defaults and calls installer */
  installOpfsVfsInitializer: InstallOpfsVfsInitializer;
}

/**
 * Creates OPFS VFS installer context for SQLite.
 *
 * This is the main factory function that returns the installer and initializer functions.
 * It coordinates all modules to provide a complete OPFS VFS implementation.
 *
 * @param sqlite3 - SQLite3 module instance with capi, wasm, util, and config
 * @returns Object containing installOpfsVfs and installOpfsVfsInitializer functions
 * @example
 * const { installOpfsVfs } = createInstallOpfsVfsContext(sqlite3);
 * await installOpfsVfs({ verbose: 2 });
 */
export function createInstallOpfsVfsContext(
  sqlite3: SQLite3Module,
): InstallOpfsVfsContext {
  /**
   * Installs OPFS VFS for SQLite with async worker support.
   * @param options - Configuration options
   * @returns Resolves with sqlite3 instance
   */
  const installOpfsVfs = function callee(
    options?: OpfsInstallerOptions,
  ): Promise<SQLite3Module> {
    // 1. Input handling
    // 1.1 Validate environment
    const envError = validateOpfsEnvironment(globalThis);
    if (envError) {
      return Promise.reject(envError);
    }

    // 1.2 Prepare configuration
    const config = prepareOpfsConfig(options, installOpfsVfs.defaultProxyUri);
    if (config.disabled) {
      return Promise.resolve(sqlite3);
    }
    // Narrow type after check - config is now fully OpfsConfig
    const activeConfig = config as OpfsConfig;

    // 2. Core processing
    const thePromise = new Promise<SQLite3Module>(function (
      promiseResolve_,
      promiseReject_,
    ) {
      // 2.1 Set up logging
      const loggers = [
        sqlite3.config.error,
        sqlite3.config.warn,
        sqlite3.config.log,
      ];

      const logImpl = (level: number, ...args: unknown[]) => {
        const logger = loggers[level];
        if (activeConfig.verbose > level && logger) {
          logger("OPFS syncer:", ...args);
        }
      };

      const log = (...args: unknown[]) => logImpl(2, ...args);

      const warn = (...args: unknown[]) => logImpl(1, ...args);

      const error = (...args: unknown[]) => logImpl(0, ...args);
      const toss = sqlite3.util.toss;
      const capi = sqlite3.capi;
      const util = sqlite3.util;
      const wasm = sqlite3.wasm;
      const { sqlite3_vfs, sqlite3_file, sqlite3_io_methods } = capi;

      // 2.2 Create VFS structures
      const opfsIoMethods = new sqlite3_io_methods();
      const opfsVfs = new sqlite3_vfs().addOnDispose(() =>
        opfsIoMethods.dispose(),
      );

      // 2.3 Set up promise state tracking
      const promiseWasRejected: PromiseWasRejected = { value: undefined };
      const promiseReject = (err: Error) => {
        promiseWasRejected.value = true;
        opfsVfs.dispose();
        return promiseReject_(err);
      };
      const promiseResolve = () => {
        promiseWasRejected.value = false;
        return promiseResolve_(sqlite3);
      };

      // 2.4 Initialize worker
      const W = new Worker(new URL(activeConfig.proxyUri, import.meta.url));
      setTimeout(() => {
        if (undefined === promiseWasRejected.value) {
          promiseReject(
            new Error("Timeout while waiting for OPFS async proxy worker."),
          );
        }
      }, 4000);

      const workerWithOriginal = W as Worker & {
        _originalOnError?: typeof W.onerror;
      };
      workerWithOriginal._originalOnError = workerWithOriginal.onerror;
      workerWithOriginal.onerror = function (err: ErrorEvent) {
        error("Error initializing OPFS asyncer:", err);
        promiseReject(
          new Error("Loading OPFS async Worker failed for unknown reasons."),
        );
      };

      // 2.5 Get default VFS for fallback methods
      const pDVfs = capi.sqlite3_vfs_find(null);
      const dVfs = pDVfs ? new sqlite3_vfs(pDVfs) : null;

      // 2.6 Configure VFS structure
      opfsIoMethods.$iVersion = 1;
      opfsVfs.$iVersion = 2;
      opfsVfs.$szOsFile = sqlite3_file.structInfo.sizeof;
      opfsVfs.$mxPathname = 1024;
      opfsVfs.$zName = wasm.allocCString("opfs");
      opfsVfs.$xDlOpen =
        opfsVfs.$xDlError =
        opfsVfs.$xDlSym =
        opfsVfs.$xDlClose =
          null;
      opfsVfs.addOnDispose(
        "$zName",
        opfsVfs.$zName,
        "cleanup default VFS wrapper",
        () => (dVfs ? dVfs.dispose() : null),
      );

      // 2.7 Initialize state and metrics
      const state = initializeOpfsState(opfsVfs, capi, toss);
      state.verbose = activeConfig.verbose;
      const metrics = initializeMetrics(state);

      // 2.8 Create operation runner and timer
      const opRun = createOperationRunner(state, metrics, error, toss);
      const { mTimeStart, mTimeEnd } = createOperationTimer(metrics);

      // 2.9 Set up file tracking
      const __openFiles = Object.create(null) as Record<number, OpfsFileHandle>;

      // 2.10 Generate random filename utility
      type RandomFilenameFn = ((len?: number) => string) & {
        _chars?: string;
        _n?: number;
      };

      const randomFilename: RandomFilenameFn = (len = 16): string => {
        if (!randomFilename._chars) {
          randomFilename._chars =
            "abcdefghijklmnopqrstuvwxyz" +
            "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
            "012346789";
          randomFilename._n = randomFilename._chars.length;
        }
        const characters = randomFilename._chars ?? "";
        const count = randomFilename._n ?? characters.length;
        const a: string[] = [];
        for (let i = 0; i < len; ++i) {
          const ndx = (Math.random() * (count * 64)) % count | 0;
          a[i] = characters[ndx] ?? "";
        }
        return a.join("");
      };

      // 2.11 Create I/O and VFS wrappers
      const ioSyncWrappers = createIoSyncWrappers({
        wasm,
        capi,
        state,
        opRun,
        mTimeStart,
        mTimeEnd,
        error,
        __openFiles,
      });

      const vfsSyncWrappers = createVfsSyncWrappers({
        wasm,
        capi,
        state,
        opRun,
        mTimeStart,
        mTimeEnd,
        opfsIoMethods,
        randomFilename,
        __openFiles,
        sqlite3_file,
      });

      // 2.12 Set up optional VFS methods
      // state has sabOPView initialized by createOperationRunner?
      // createOperationRunner calls initializeState which does state.sabOPView = ...
      // Wait, createOperationRunner in core/operation-runner/operation-runner.ts needs to be checked.
      // Assuming it does, we cast state.
      const optionalMethods = setupOptionalVfsMethods({
        opfsVfs,
        dVfs,
        wasm,
        state,
      });
      Object.assign(vfsSyncWrappers, optionalMethods);

      // 2.13 Create OPFS utilities
      const opfsUtil = createOpfsUtil({
        state,
        util,
        sqlite3,
      });

      // 2.14 Bind metrics and debug methods
      const boundMetrics = {
        dump: () => opfsUtil.metrics.dump(metrics, W),
        reset: () => opfsUtil.metrics.reset(metrics),
      };
      opfsUtil.metrics = boundMetrics;

      const boundDebug = {
        asyncShutdown: () => opfsUtil.debug.asyncShutdown(opRun, warn),
        asyncRestart: () => opfsUtil.debug.asyncRestart(W, warn),
      };
      opfsUtil.debug = boundDebug;

      // 2.15 Initialize serialization
      state.s11n = createSerializer(state, toss);

      // 2.16 Integrate with OO1 API
      integrateWithOo1({
        sqlite3,
        opfsVfs,
        opfsUtil: opfsUtil as unknown as OpfsUtilInterface,
      });

      // 2.17 Create sanity check runner
      const boundRunSanityCheck = () =>
        runSanityCheck({
          wasm,
          capi,
          state,
          vfsSyncWrappers,
          ioSyncWrappers,
          opfsVfs,
          randomFilename,
          log,
          warn,
          error,
          toss,
        });

      // 2.18 Set up worker message handler
      W.onmessage = createWorkerMessageHandler({
        promiseResolve,
        promiseReject,
        promiseWasRejected,
        sqlite3,
        opfsVfs,
        opfsIoMethods,
        ioSyncWrappers,
        vfsSyncWrappers,
        state,
        opfsUtil: opfsUtil as unknown as OpfsUtilInterface,
        options: activeConfig,
        warn,
        error,
        runSanityCheck: boundRunSanityCheck,
        thisThreadHasOPFS,
        W: workerWithOriginal,
      });
    });

    // 3. Output handling
    return thePromise;
  } as InstallOpfsVfs;

  installOpfsVfs.defaultProxyUri =
    "../../sqlite3-opfs-async-proxy/sqlite3-opfs-async-proxy.js";

  /**
   * Initializer function for OPFS VFS.
   * @param sqlite3Ref - SQLite3 module reference
   * @returns Resolves when initialization completes
   */
  const installOpfsVfsInitializer = async (
    sqlite3Ref: SQLite3Module,
  ): Promise<void> => {
    try {
      // 1. Input handling
      const proxyJs = installOpfsVfs.defaultProxyUri;
      if (sqlite3Ref.scriptInfo && sqlite3Ref.scriptInfo.sqlite3Dir) {
        installOpfsVfs.defaultProxyUri =
          sqlite3Ref.scriptInfo.sqlite3Dir + proxyJs;
      }

      // 2. Core processing
      await installOpfsVfs().catch((e: Error) => {
        sqlite3Ref.config.warn(
          "Ignoring inability to install OPFS sqlite3_vfs:",
          e.message,
        );
      });
    } catch (e) {
      // 3. Output handling
      sqlite3Ref.config.error("installOpfsVfs() exception:", e);
      return Promise.reject(e);
    }
  };

  return { installOpfsVfs, installOpfsVfsInitializer };
}
