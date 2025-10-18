/**
 * @fileoverview User-Defined Function (UDF) factory utilities
 *
 * This module provides utilities for creating and managing SQLite user-defined functions,
 * including scalar functions, aggregate functions, and window functions.
 *
 * Features:
 * - Automatic JavaScript-to-SQLite type conversion
 * - Error handling and propagation
 * - Function pointer management
 * - Argument validation
 */

/**
 * Creates UDF factory utilities.
 *
 * @param {import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3WasmNamespace} wasm
 *        Wasm helper namespace.
 * @param {import("../oo1-db/context.d.ts").SQLite3CapiWithHelpers} capi C API namespace with helpers.
 * @param {import("./db-cleanup.d.ts").DbCleanupMap} __dbCleanupMap Database cleanup map function.
 * @returns {import("./udf-factory.d.ts").UdfFactoryResult} Object containing UDF creation functions.
 */
export function createUdfFactory(wasm, capi, __dbCleanupMap) {
    /**
     * Helper function to report database argument count mismatches.
     *
     * @param {number} pDb - Database pointer
     * @param {string} f - Function name
     * @param {number} n - Expected argument count
     * @returns {number} SQLITE_MISUSE error code
     */
    const __dbArgcMismatch = (pDb, f, n) => {
        const util = { sqlite3__wasm_db_error: capi.sqlite3__wasm_db_error };
        return util.sqlite3__wasm_db_error(
            pDb,
            capi.SQLITE_MISUSE,
            f + "() requires " + n + " argument" + (1 === n ? "" : "s") + "."
        );
    };

    /**
     * Helper function to report encoding errors.
     *
     * @param {number} pDb - Database pointer
     * @returns {number} SQLITE_FORMAT error code
     */
    const __errEncoding = (pDb) => {
        const util = { sqlite3__wasm_db_error: capi.sqlite3__wasm_db_error };
        return util.sqlite3__wasm_db_error(
            pDb,
            capi.SQLITE_FORMAT,
            "SQLITE_UTF8 is the only supported encoding."
        );
    };

    /**
     * Call proxies for UDF callback functions.
     * These wrap JavaScript callbacks to handle type conversion and error handling.
     */
    const __cfProxy = Object.assign(Object.create(null), {
        /**
         * Proxy for xInverse and xStep callbacks (aggregate/window functions).
         */
        xInverseAndStep: {
            signature: "v(pip)",
            contextKey: function (argv, argIndex) {
                return (
                    argv[0] +
                    ":" +
                    (argv[2] < 0 ? -1 : argv[2]) +
                    ":" +
                    argIndex +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            },
            callProxy: (callback) => {
                return (pCtx, argc, pArgv) => {
                    try {
                        callback(
                            pCtx,
                            ...capi.sqlite3_values_to_js(argc, pArgv)
                        );
                    } catch (e) {
                        capi.sqlite3_result_error_js(pCtx, e);
                    }
                };
            },
        },

        /**
         * Proxy for xFinal and xValue callbacks (aggregate/window functions).
         */
        xFinalAndValue: {
            signature: "v(p)",
            contextKey: function (argv, argIndex) {
                return (
                    argv[0] +
                    ":" +
                    (argv[2] < 0 ? -1 : argv[2]) +
                    ":" +
                    argIndex +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            },
            callProxy: (callback) => {
                return (pCtx) => {
                    try {
                        capi.sqlite3_result_js(pCtx, callback(pCtx));
                    } catch (e) {
                        capi.sqlite3_result_error_js(pCtx, e);
                    }
                };
            },
        },

        /**
         * Proxy for xFunc callback (scalar functions).
         */
        xFunc: {
            signature: "v(pip)",
            contextKey: function (argv, argIndex) {
                return (
                    argv[0] +
                    ":" +
                    (argv[2] < 0 ? -1 : argv[2]) +
                    ":" +
                    argIndex +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            },
            callProxy: (callback) => {
                return (pCtx, argc, pArgv) => {
                    try {
                        capi.sqlite3_result_js(
                            pCtx,
                            callback(
                                pCtx,
                                ...capi.sqlite3_values_to_js(argc, pArgv)
                            )
                        );
                    } catch (e) {
                        capi.sqlite3_result_error_js(pCtx, e);
                    }
                };
            },
        },

        /**
         * Proxy for xDestroy callback (cleanup).
         */
        xDestroy: {
            signature: "v(p)",
            contextKey: function (argv, argIndex) {
                return (
                    argv[0] +
                    ":" +
                    (argv[2] < 0 ? -1 : argv[2]) +
                    ":" +
                    argIndex +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            },
            callProxy: (callback) => {
                return (pVoid) => {
                    try {
                        callback(pVoid);
                    } catch (e) {
                        console.error("UDF xDestroy method threw:", e);
                    }
                };
            },
        },
    });

    /**
     * Native sqlite3_create_function_v2 wrapper.
     */
    const __sqlite3CreateFunction = wasm.xWrap("sqlite3_create_function_v2", "int", [
        "sqlite3*",
        "string",
        "int",
        "int",
        "*",
        new wasm.xWrap.FuncPtrAdapter({
            name: "xFunc",
            ...__cfProxy.xFunc,
        }),
        new wasm.xWrap.FuncPtrAdapter({
            name: "xStep",
            ...__cfProxy.xInverseAndStep,
        }),
        new wasm.xWrap.FuncPtrAdapter({
            name: "xFinal",
            ...__cfProxy.xFinalAndValue,
        }),
        new wasm.xWrap.FuncPtrAdapter({
            name: "xDestroy",
            ...__cfProxy.xDestroy,
        }),
    ]);

    /**
     * Native sqlite3_create_window_function wrapper (if available).
     */
    const __sqlite3CreateWindowFunction = wasm.exports.sqlite3_create_window_function
        ? wasm.xWrap("sqlite3_create_window_function", "int", [
              "sqlite3*",
              "string",
              "int",
              "int",
              "*",
              new wasm.xWrap.FuncPtrAdapter({
                  name: "xStep",
                  ...__cfProxy.xInverseAndStep,
              }),
              new wasm.xWrap.FuncPtrAdapter({
                  name: "xFinal",
                  ...__cfProxy.xFinalAndValue,
              }),
              new wasm.xWrap.FuncPtrAdapter({
                  name: "xValue",
                  ...__cfProxy.xFinalAndValue,
              }),
              new wasm.xWrap.FuncPtrAdapter({
                  name: "xInverse",
                  ...__cfProxy.xInverseAndStep,
              }),
              new wasm.xWrap.FuncPtrAdapter({
                  name: "xDestroy",
                  ...__cfProxy.xDestroy,
              }),
          ])
        : undefined;

    /**
     * Creates a user-defined function (scalar, aggregate, or both).
     *
     * @param {import("../../sqlite3.d.ts").sqlite3} pDb - Database pointer
     * @param {string} funcName - Function name
     * @param {number} nArg - Number of arguments (-1 for variadic)
     * @param {number} eTextRep - Text encoding flags
     * @param {unknown} pApp - Application data pointer
     * @param {import("../../sqlite3.d.ts").ScalarFunction | null} xFunc - Scalar function callback
     * @param {import("../../sqlite3.d.ts").AggregateStepFunction | null} xStep - Aggregate step callback
     * @param {import("../../sqlite3.d.ts").AggregateFinalFunction | null} xFinal - Aggregate finalize callback
     * @param {import("../../sqlite3.d.ts").FunctionDestructor | null} xDestroy - Cleanup callback
     * @returns {import("../../sqlite3.d.ts").SqliteResultCode} SQLite result code
     */
    const sqlite3_create_function_v2 = function f(
        pDb,
        funcName,
        nArg,
        eTextRep,
        pApp,
        xFunc,
        xStep,
        xFinal,
        xDestroy
    ) {
        // 1. Validate argument count
        if (f.length !== arguments.length) {
            return __dbArgcMismatch(pDb, "sqlite3_create_function_v2", f.length);
        }

        // 2. Ensure UTF-8 encoding
        if (0 === (eTextRep & 0xf)) {
            eTextRep |= capi.SQLITE_UTF8;
        } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
            return __errEncoding(pDb);
        }

        // 3. Create function
        try {
            const rc = __sqlite3CreateFunction(
                pDb,
                funcName,
                nArg,
                eTextRep,
                pApp,
                xFunc,
                xStep,
                xFinal,
                xDestroy
            );

            // 4. Track for cleanup if successful
            if (
                0 === rc &&
                (xFunc instanceof Function ||
                    xStep instanceof Function ||
                    xFinal instanceof Function ||
                    xDestroy instanceof Function)
            ) {
                __dbCleanupMap.addFunction(pDb, funcName, nArg);
            }

            return rc;
        } catch (e) {
            console.error("sqlite3_create_function_v2() setup threw:", e);
            const util = { sqlite3__wasm_db_error: capi.sqlite3__wasm_db_error };
            return util.sqlite3__wasm_db_error(
                pDb,
                e,
                "Creation of UDF threw: " + e
            );
        }
    };

    /**
     * Creates a user-defined function (simplified version without xDestroy).
     *
     * @param {number} pDb - Database pointer
     * @param {string} funcName - Function name
     * @param {number} nArg - Number of arguments (-1 for variadic)
     * @param {number} eTextRep - Text encoding flags
     * @param {*} pApp - Application data pointer
     * @param {Function} xFunc - Scalar function callback
     * @param {Function} xStep - Aggregate step callback
     * @param {Function} xFinal - Aggregate finalize callback
     * @returns {number} SQLite result code
     */
    const sqlite3_create_function = function f(
        pDb,
        funcName,
        nArg,
        eTextRep,
        pApp,
        xFunc,
        xStep,
        xFinal
    ) {
        return f.length === arguments.length
            ? sqlite3_create_function_v2(
                  pDb,
                  funcName,
                  nArg,
                  eTextRep,
                  pApp,
                  xFunc,
                  xStep,
                  xFinal,
                  0
              )
            : __dbArgcMismatch(pDb, "sqlite3_create_function", f.length);
    };

    /**
     * Creates a window function.
     *
     * @param {number} pDb - Database pointer
     * @param {string} funcName - Function name
     * @param {number} nArg - Number of arguments (-1 for variadic)
     * @param {number} eTextRep - Text encoding flags
     * @param {*} pApp - Application data pointer
     * @param {Function} xStep - Step callback
     * @param {Function} xFinal - Finalize callback
     * @param {Function} xValue - Value callback
     * @param {Function} xInverse - Inverse callback
     * @param {Function} xDestroy - Cleanup callback
     * @returns {number} SQLite result code
     */
    const sqlite3_create_window_function = __sqlite3CreateWindowFunction
        ? function f(
              pDb,
              funcName,
              nArg,
              eTextRep,
              pApp,
              xStep,
              xFinal,
              xValue,
              xInverse,
              xDestroy
          ) {
              // 1. Validate argument count
              if (f.length !== arguments.length) {
                  return __dbArgcMismatch(
                      pDb,
                      "sqlite3_create_window_function",
                      f.length
                  );
              }

              // 2. Ensure UTF-8 encoding
              if (0 === (eTextRep & 0xf)) {
                  eTextRep |= capi.SQLITE_UTF8;
              } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
                  return __errEncoding(pDb);
              }

              // 3. Create window function
              try {
                  const rc = __sqlite3CreateWindowFunction(
                      pDb,
                      funcName,
                      nArg,
                      eTextRep,
                      pApp,
                      xStep,
                      xFinal,
                      xValue,
                      xInverse,
                      xDestroy
                  );

                  // 4. Track for cleanup if successful
                  if (
                      0 === rc &&
                      (xStep instanceof Function ||
                          xFinal instanceof Function ||
                          xValue instanceof Function ||
                          xInverse instanceof Function ||
                          xDestroy instanceof Function)
                  ) {
                      __dbCleanupMap.addWindowFunc(pDb, funcName, nArg);
                  }

                  return rc;
              } catch (e) {
                  console.error("sqlite3_create_window_function() setup threw:", e);
                  const util = {
                      sqlite3__wasm_db_error: capi.sqlite3__wasm_db_error,
                  };
                  return util.sqlite3__wasm_db_error(
                      pDb,
                      e,
                      "Creation of UDF threw: " + e
                  );
              }
          }
        : undefined;

    // Attach helper methods to the created functions
    if (sqlite3_create_function_v2) {
        sqlite3_create_function_v2.udfSetResult = capi.sqlite3_result_js;
        sqlite3_create_function_v2.udfConvertArgs = capi.sqlite3_values_to_js;
        sqlite3_create_function_v2.udfSetError = capi.sqlite3_result_error_js;
    }

    if (sqlite3_create_function) {
        sqlite3_create_function.udfSetResult = capi.sqlite3_result_js;
        sqlite3_create_function.udfConvertArgs = capi.sqlite3_values_to_js;
        sqlite3_create_function.udfSetError = capi.sqlite3_result_error_js;
    }

    if (sqlite3_create_window_function) {
        sqlite3_create_window_function.udfSetResult = capi.sqlite3_result_js;
        sqlite3_create_window_function.udfConvertArgs = capi.sqlite3_values_to_js;
        sqlite3_create_window_function.udfSetError = capi.sqlite3_result_error_js;
    }

    return {
        sqlite3_create_function_v2,
        sqlite3_create_function,
        sqlite3_create_window_function,
    };
}
