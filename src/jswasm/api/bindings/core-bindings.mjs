/**
 * @fileoverview Core SQLite C API function binding signatures
 *
 * This module exports the binding signatures for core SQLite3 C API functions.
 * These signatures are used by wasm.xWrap to create JavaScript wrappers around
 * the WebAssembly-compiled SQLite functions.
 *
 * Each signature is an array: [functionName, returnType, ...parameterTypes]
 */

/**
 * Creates the core binding signatures for SQLite3 C API functions.
 *
 * @param {import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3WasmNamespace} wasm
 *        Wasm helper namespace exposing xWrap.
 * @param {import("@wuchuheng/web-sqlite").SQLite3CAPI} capi C API namespace.
 * @returns {import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3BindingSignatureCollection}
 *     Array of binding signature descriptors.
 */
export function createCoreBindings(wasm, capi) {
    return [
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
        [
            "sqlite3_busy_handler",
            "int",
            [
                "sqlite3*",
                new wasm.xWrap.FuncPtrAdapter({
                    signature: "i(pi)",
                    contextKey: (argv, _argIndex) => argv[0],
                }),
                "*",
            ],
        ],
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
        [
            "sqlite3_commit_hook",
            "void*",
            [
                "sqlite3*",
                new wasm.xWrap.FuncPtrAdapter({
                    name: "sqlite3_commit_hook",
                    signature: "i(p)",
                    contextKey: (argv) => argv[0],
                }),
                "*",
            ],
        ],

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
            [
                "sqlite3*",
                "string:flexible",
                new wasm.xWrap.FuncPtrAdapter({
                    signature: "i(pipp)",
                    bindScope: "transient",
                    callProxy: (
                        /** @type {import("../../sqlite3.d.ts").ExecCallback} */ callback
                    ) => {
                        let aNames;
                        return (pVoid, nCols, pColVals, pColNames) => {
                            try {
                                const aVals = wasm.cArgvToJs(nCols, pColVals);
                                if (!aNames)
                                    aNames = wasm.cArgvToJs(nCols, pColNames);
                                return callback(aVals, aNames) | 0;
                            } catch (e) {
                                return e.resultCode || capi.SQLITE_ERROR;
                            }
                        };
                    },
                }),
                "*",
                "**",
            ],
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
        [
            "sqlite3_result_blob",
            undefined,
            "sqlite3_context*",
            "*",
            "int",
            "*",
        ],
        ["sqlite3_result_double", undefined, "sqlite3_context*", "f64"],
        [
            "sqlite3_result_error",
            undefined,
            "sqlite3_context*",
            "string",
            "int",
        ],
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
        [
            "sqlite3_rollback_hook",
            "void*",
            [
                "sqlite3*",
                new wasm.xWrap.FuncPtrAdapter({
                    name: "sqlite3_rollback_hook",
                    signature: "v(p)",
                    contextKey: (argv) => argv[0],
                }),
                "*",
            ],
        ],

        // Auxiliary data
        [
            "sqlite3_set_auxdata",
            undefined,
            ["sqlite3_context*", "int", "*", "*"],
        ],
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
        [
            "sqlite3_trace_v2",
            "int",
            [
                "sqlite3*",
                "int",
                new wasm.xWrap.FuncPtrAdapter({
                    name: "sqlite3_trace_v2::callback",
                    signature: "i(ippp)",
                    contextKey: (argv, _argIndex) => argv[0],
                }),
                "*",
            ],
        ],
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
    ];
}

/**
 * Creates optional binding signatures that depend on specific compile-time features.
 *
 * @param {import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3WasmNamespace} wasm
 *        Wasm helper namespace exposing optional exports.
 * @param {import("@wuchuheng/web-sqlite").SQLite3CAPI} capi C API namespace.
 * @returns {import("./core-bindings.d.ts").OptionalBindingGroups}
 *     Optional binding collections keyed by feature.
 */
export function createOptionalBindings(wasm, capi) {
    const optional = {};

    // Progress handler (if available)
    if (wasm.exports.sqlite3_progress_handler) {
        optional.progressHandler = [
            "sqlite3_progress_handler",
            undefined,
            [
                "sqlite3*",
                "int",
                new wasm.xWrap.FuncPtrAdapter({
                    name: "xProgressHandler",
                    signature: "i(p)",
                    bindScope: "context",
                    contextKey: (argv, _argIndex) => argv[0],
                }),
                "*",
            ],
        ];
    }

    // Statement explain (if available)
    if (wasm.exports.sqlite3_stmt_explain) {
        optional.stmtExplain = [
            ["sqlite3_stmt_explain", "int", "sqlite3_stmt*", "int"],
            ["sqlite3_stmt_isexplain", "int", "sqlite3_stmt*"],
        ];
    }

    // Authorizer (if available)
    if (wasm.exports.sqlite3_set_authorizer) {
        optional.authorizer = [
            "sqlite3_set_authorizer",
            "int",
            [
                "sqlite3*",
                new wasm.xWrap.FuncPtrAdapter({
                    name: "sqlite3_set_authorizer::xAuth",
                    signature: "i(pi" + "ssss)",
                    contextKey: (argv, _argIndex) => argv[0],
                    callProxy: (callback) => {
                        return (pV, iCode, s0, s1, s2, s3) => {
                            try {
                                s0 = s0 && wasm.cstrToJs(s0);
                                s1 = s1 && wasm.cstrToJs(s1);
                                s2 = s2 && wasm.cstrToJs(s2);
                                s3 = s3 && wasm.cstrToJs(s3);
                                return callback(pV, iCode, s0, s1, s2, s3) || 0;
                            } catch (e) {
                                return e.resultCode || capi.SQLITE_ERROR;
                            }
                        };
                    },
                }),
                "*",
            ],
        ];
    }

    return optional;
}

/**
 * Creates WASM-internal binding signatures.
 *
 * @returns {import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3BindingSignatureCollection}
 *     Array of internal binding signatures.
 */
export function createWasmInternalBindings() {
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
    ];
}
