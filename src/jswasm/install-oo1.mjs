import { createWhWasmUtilInstaller } from "./create-wh-wasm-util-installer.mjs";

export function createInstallOo1Initializer() {
    const installWhWasmUtils = createWhWasmUtilInstaller();

    return function installOo1Initializer(sqlite3) {
        "use strict";
        const toss = (...args) => {
            throw new Error(args.join(" "));
        };
        const capi = sqlite3.capi,
            wasm = sqlite3.wasm,
            util = sqlite3.util;
        installWhWasmUtils(wasm);

        wasm.bindingSignatures = [
            ["sqlite3_aggregate_context", "void*", "sqlite3_context*", "int"],

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

            ["sqlite3_changes", "int", "sqlite3*"],
            ["sqlite3_clear_bindings", "int", "sqlite3_stmt*"],
            ["sqlite3_collation_needed", "int", "sqlite3*", "*", "*"],
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
            ["sqlite3_compileoption_get", "string", "int"],
            ["sqlite3_compileoption_used", "int", "string"],
            ["sqlite3_complete", "int", "string:flexible"],
            ["sqlite3_context_db_handle", "sqlite3*", "sqlite3_context*"],

            ["sqlite3_data_count", "int", "sqlite3_stmt*"],
            ["sqlite3_db_filename", "string", "sqlite3*", "string"],
            ["sqlite3_db_handle", "sqlite3*", "sqlite3_stmt*"],
            ["sqlite3_db_name", "string", "sqlite3*", "int"],
            ["sqlite3_db_readonly", "int", "sqlite3*", "string"],
            ["sqlite3_db_status", "int", "sqlite3*", "int", "*", "*", "int"],
            ["sqlite3_errcode", "int", "sqlite3*"],
            ["sqlite3_errmsg", "string", "sqlite3*"],
            ["sqlite3_error_offset", "int", "sqlite3*"],
            ["sqlite3_errstr", "string", "int"],
            [
                "sqlite3_exec",
                "int",
                [
                    "sqlite3*",
                    "string:flexible",
                    new wasm.xWrap.FuncPtrAdapter({
                        signature: "i(pipp)",
                        bindScope: "transient",
                        callProxy: (callback) => {
                            let aNames;
                            return (pVoid, nCols, pColVals, pColNames) => {
                                try {
                                    const aVals = wasm.cArgvToJs(
                                        nCols,
                                        pColVals
                                    );
                                    if (!aNames)
                                        aNames = wasm.cArgvToJs(
                                            nCols,
                                            pColNames
                                        );
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
            ["sqlite3_file_control", "int", "sqlite3*", "string", "int", "*"],
            ["sqlite3_finalize", "int", "sqlite3_stmt*"],
            ["sqlite3_free", undefined, "*"],
            ["sqlite3_get_autocommit", "int", "sqlite3*"],
            ["sqlite3_get_auxdata", "*", "sqlite3_context*", "int"],
            ["sqlite3_initialize", undefined],
            ["sqlite3_interrupt", undefined, "sqlite3*"],
            ["sqlite3_is_interrupted", "int", "sqlite3*"],
            ["sqlite3_keyword_count", "int"],
            ["sqlite3_keyword_name", "int", ["int", "**", "*"]],
            ["sqlite3_keyword_check", "int", ["string", "int"]],
            ["sqlite3_libversion", "string"],
            ["sqlite3_libversion_number", "int"],
            ["sqlite3_limit", "int", ["sqlite3*", "int", "int"]],
            ["sqlite3_malloc", "*", "int"],
            ["sqlite3_open", "int", "string", "*"],
            ["sqlite3_open_v2", "int", "string", "*", "int", "string"],

            ["sqlite3_realloc", "*", "*", "int"],
            ["sqlite3_reset", "int", "sqlite3_stmt*"],

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

            [
                "sqlite3_set_auxdata",
                undefined,
                ["sqlite3_context*", "int", "*", "*"],
            ],
            ["sqlite3_shutdown", undefined],
            ["sqlite3_sourceid", "string"],
            ["sqlite3_sql", "string", "sqlite3_stmt*"],
            ["sqlite3_status", "int", "int", "*", "*", "int"],
            ["sqlite3_step", "int", "sqlite3_stmt*"],
            ["sqlite3_stmt_busy", "int", "sqlite3_stmt*"],
            ["sqlite3_stmt_readonly", "int", "sqlite3_stmt*"],
            ["sqlite3_stmt_status", "int", "sqlite3_stmt*", "int", "int"],
            ["sqlite3_strglob", "int", "string", "string"],
            ["sqlite3_stricmp", "int", "string", "string"],
            ["sqlite3_strlike", "int", "string", "string", "int"],
            ["sqlite3_strnicmp", "int", "string", "string", "int"],
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
            ["sqlite3_total_changes", "int", "sqlite3*"],
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

            ["sqlite3_uri_boolean", "int", "sqlite3_filename", "string", "int"],
            ["sqlite3_uri_key", "string", "sqlite3_filename", "int"],
            ["sqlite3_uri_parameter", "string", "sqlite3_filename", "string"],
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
            ["sqlite3_vfs_find", "*", "string"],
            ["sqlite3_vfs_register", "int", "sqlite3_vfs*", "int"],
            ["sqlite3_vfs_unregister", "int", "sqlite3_vfs*"],
        ];

        if (wasm.exports.sqlite3_progress_handler) {
            wasm.bindingSignatures.push([
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
            ]);
        }

        if (wasm.exports.sqlite3_stmt_explain) {
            wasm.bindingSignatures.push(
                ["sqlite3_stmt_explain", "int", "sqlite3_stmt*", "int"],
                ["sqlite3_stmt_isexplain", "int", "sqlite3_stmt*"]
            );
        }

        if (wasm.exports.sqlite3_set_authorizer) {
            wasm.bindingSignatures.push([
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
                                    return (
                                        callback(pV, iCode, s0, s1, s2, s3) || 0
                                    );
                                } catch (e) {
                                    return e.resultCode || capi.SQLITE_ERROR;
                                }
                            };
                        },
                    }),
                    "*",
                ],
            ]);
        }

        // Note: SQLITE_ENABLE_NORMALIZE feature is currently disabled
        // The following code would be used if SQLITE_ENABLE_NORMALIZE was enabled:
        // wasm.bindingSignatures.push([
        //     "sqlite3_normalized_sql",
        //     "string",
        //     "sqlite3_stmt*",
        // ]);

        wasm.bindingSignatures.int64 = [
            ["sqlite3_bind_int64", "int", ["sqlite3_stmt*", "int", "i64"]],
            ["sqlite3_changes64", "i64", ["sqlite3*"]],
            ["sqlite3_column_int64", "i64", ["sqlite3_stmt*", "int"]],
            [
                "sqlite3_deserialize",
                "int",
                "sqlite3*",
                "string",
                "*",
                "i64",
                "i64",
                "int",
            ],
            ["sqlite3_last_insert_rowid", "i64", ["sqlite3*"]],
            ["sqlite3_malloc64", "*", "i64"],
            ["sqlite3_msize", "i64", "*"],
            ["sqlite3_overload_function", "int", ["sqlite3*", "string", "int"]],
            ["sqlite3_realloc64", "*", "*", "i64"],
            ["sqlite3_result_int64", undefined, "*", "i64"],
            ["sqlite3_result_zeroblob64", "int", "*", "i64"],
            ["sqlite3_serialize", "*", "sqlite3*", "string", "*", "int"],
            ["sqlite3_set_last_insert_rowid", undefined, ["sqlite3*", "i64"]],
            ["sqlite3_status64", "int", "int", "*", "*", "int"],
            ["sqlite3_total_changes64", "i64", ["sqlite3*"]],
            [
                "sqlite3_update_hook",
                "*",
                [
                    "sqlite3*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "sqlite3_update_hook",
                        signature: "v(iippj)",
                        contextKey: (argv) => argv[0],
                        callProxy: (callback) => {
                            return (p, op, z0, z1, rowid) => {
                                callback(
                                    p,
                                    op,
                                    wasm.cstrToJs(z0),
                                    wasm.cstrToJs(z1),
                                    rowid
                                );
                            };
                        },
                    }),
                    "*",
                ],
            ],
            ["sqlite3_uri_int64", "i64", ["sqlite3_filename", "string", "i64"]],
            ["sqlite3_value_int64", "i64", "sqlite3_value*"],
        ];

        if (wasm.bigIntEnabled && !!wasm.exports.sqlite3_declare_vtab) {
            wasm.bindingSignatures.int64.push(
                [
                    "sqlite3_create_module",
                    "int",
                    ["sqlite3*", "string", "sqlite3_module*", "*"],
                ],
                [
                    "sqlite3_create_module_v2",
                    "int",
                    ["sqlite3*", "string", "sqlite3_module*", "*", "*"],
                ],
                [
                    "sqlite3_declare_vtab",
                    "int",
                    ["sqlite3*", "string:flexible"],
                ],
                ["sqlite3_drop_modules", "int", ["sqlite3*", "**"]],
                [
                    "sqlite3_vtab_collation",
                    "string",
                    "sqlite3_index_info*",
                    "int",
                ],
                ["sqlite3_vtab_distinct", "int", "sqlite3_index_info*"],
                ["sqlite3_vtab_in", "int", "sqlite3_index_info*", "int", "int"],
                ["sqlite3_vtab_in_first", "int", "sqlite3_value*", "**"],
                ["sqlite3_vtab_in_next", "int", "sqlite3_value*", "**"],

                ["sqlite3_vtab_nochange", "int", "sqlite3_context*"],
                ["sqlite3_vtab_on_conflict", "int", "sqlite3*"],
                [
                    "sqlite3_vtab_rhs_value",
                    "int",
                    "sqlite3_index_info*",
                    "int",
                    "**",
                ]
            );
        }

        if (wasm.bigIntEnabled && !!wasm.exports.sqlite3_preupdate_hook) {
            wasm.bindingSignatures.int64.push(
                ["sqlite3_preupdate_blobwrite", "int", "sqlite3*"],
                ["sqlite3_preupdate_count", "int", "sqlite3*"],
                ["sqlite3_preupdate_depth", "int", "sqlite3*"],
                [
                    "sqlite3_preupdate_hook",
                    "*",
                    [
                        "sqlite3*",
                        new wasm.xWrap.FuncPtrAdapter({
                            name: "sqlite3_preupdate_hook",
                            signature: "v(ppippjj)",
                            contextKey: (argv) => argv[0],
                            callProxy: (callback) => {
                                return (p, db, op, zDb, zTbl, iKey1, iKey2) => {
                                    callback(
                                        p,
                                        db,
                                        op,
                                        wasm.cstrToJs(zDb),
                                        wasm.cstrToJs(zTbl),
                                        iKey1,
                                        iKey2
                                    );
                                };
                            },
                        }),
                        "*",
                    ],
                ],
                ["sqlite3_preupdate_new", "int", ["sqlite3*", "int", "**"]],
                ["sqlite3_preupdate_old", "int", ["sqlite3*", "int", "**"]]
            );
        }

        if (
            wasm.bigIntEnabled &&
            !!wasm.exports.sqlite3changegroup_add &&
            !!wasm.exports.sqlite3session_create &&
            !!wasm.exports.sqlite3_preupdate_hook
        ) {
            const __ipsProxy = {
                signature: "i(ps)",
                callProxy: (callback) => {
                    return (p, s) => {
                        try {
                            return callback(p, wasm.cstrToJs(s)) | 0;
                        } catch (e) {
                            return e.resultCode || capi.SQLITE_ERROR;
                        }
                    };
                },
            };

            wasm.bindingSignatures.int64.push(
                ...[
                    [
                        "sqlite3changegroup_add",
                        "int",
                        ["sqlite3_changegroup*", "int", "void*"],
                    ],
                    [
                        "sqlite3changegroup_add_strm",
                        "int",
                        [
                            "sqlite3_changegroup*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changegroup_delete",
                        undefined,
                        ["sqlite3_changegroup*"],
                    ],
                    ["sqlite3changegroup_new", "int", ["**"]],
                    [
                        "sqlite3changegroup_output",
                        "int",
                        ["sqlite3_changegroup*", "int*", "**"],
                    ],
                    [
                        "sqlite3changegroup_output_strm",
                        "int",
                        [
                            "sqlite3_changegroup*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppi)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply",
                        "int",
                        [
                            "sqlite3*",
                            "int",
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply_strm",
                        "int",
                        [
                            "sqlite3*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply_v2",
                        "int",
                        [
                            "sqlite3*",
                            "int",
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                            "**",
                            "int*",
                            "int",
                        ],
                    ],
                    [
                        "sqlite3changeset_apply_v2_strm",
                        "int",
                        [
                            "sqlite3*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                bindScope: "transient",
                                ...__ipsProxy,
                            }),
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xConflict",
                                signature: "i(pip)",
                                bindScope: "transient",
                            }),
                            "void*",
                            "**",
                            "int*",
                            "int",
                        ],
                    ],
                    [
                        "sqlite3changeset_concat",
                        "int",
                        ["int", "void*", "int", "void*", "int*", "**"],
                    ],
                    [
                        "sqlite3changeset_concat_strm",
                        "int",
                        [
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInputA",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInputB",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppi)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_conflict",
                        "int",
                        ["sqlite3_changeset_iter*", "int", "**"],
                    ],
                    [
                        "sqlite3changeset_finalize",
                        "int",
                        ["sqlite3_changeset_iter*"],
                    ],
                    [
                        "sqlite3changeset_fk_conflicts",
                        "int",
                        ["sqlite3_changeset_iter*", "int*"],
                    ],
                    [
                        "sqlite3changeset_invert",
                        "int",
                        ["int", "void*", "int*", "**"],
                    ],
                    [
                        "sqlite3changeset_invert_strm",
                        "int",
                        [
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppi)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_new",
                        "int",
                        ["sqlite3_changeset_iter*", "int", "**"],
                    ],
                    [
                        "sqlite3changeset_next",
                        "int",
                        ["sqlite3_changeset_iter*"],
                    ],
                    [
                        "sqlite3changeset_old",
                        "int",
                        ["sqlite3_changeset_iter*", "int", "**"],
                    ],
                    [
                        "sqlite3changeset_op",
                        "int",
                        [
                            "sqlite3_changeset_iter*",
                            "**",
                            "int*",
                            "int*",
                            "int*",
                        ],
                    ],
                    [
                        "sqlite3changeset_pk",
                        "int",
                        ["sqlite3_changeset_iter*", "**", "int*"],
                    ],
                    ["sqlite3changeset_start", "int", ["**", "int", "*"]],
                    [
                        "sqlite3changeset_start_strm",
                        "int",
                        [
                            "**",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3changeset_start_v2",
                        "int",
                        ["**", "int", "*", "int"],
                    ],
                    [
                        "sqlite3changeset_start_v2_strm",
                        "int",
                        [
                            "**",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xInput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                            "int",
                        ],
                    ],
                    [
                        "sqlite3session_attach",
                        "int",
                        ["sqlite3_session*", "string"],
                    ],
                    [
                        "sqlite3session_changeset",
                        "int",
                        ["sqlite3_session*", "int*", "**"],
                    ],
                    [
                        "sqlite3session_changeset_size",
                        "i64",
                        ["sqlite3_session*"],
                    ],
                    [
                        "sqlite3session_changeset_strm",
                        "int",
                        [
                            "sqlite3_session*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    ["sqlite3session_config", "int", ["int", "void*"]],
                    [
                        "sqlite3session_create",
                        "int",
                        ["sqlite3*", "string", "**"],
                    ],

                    [
                        "sqlite3session_diff",
                        "int",
                        ["sqlite3_session*", "string", "string", "**"],
                    ],
                    [
                        "sqlite3session_enable",
                        "int",
                        ["sqlite3_session*", "int"],
                    ],
                    [
                        "sqlite3session_indirect",
                        "int",
                        ["sqlite3_session*", "int"],
                    ],
                    ["sqlite3session_isempty", "int", ["sqlite3_session*"]],
                    ["sqlite3session_memory_used", "i64", ["sqlite3_session*"]],
                    [
                        "sqlite3session_object_config",
                        "int",
                        ["sqlite3_session*", "int", "void*"],
                    ],
                    [
                        "sqlite3session_patchset",
                        "int",
                        ["sqlite3_session*", "*", "**"],
                    ],
                    [
                        "sqlite3session_patchset_strm",
                        "int",
                        [
                            "sqlite3_session*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xOutput",
                                signature: "i(ppp)",
                                bindScope: "transient",
                            }),
                            "void*",
                        ],
                    ],
                    [
                        "sqlite3session_table_filter",
                        undefined,
                        [
                            "sqlite3_session*",
                            new wasm.xWrap.FuncPtrAdapter({
                                name: "xFilter",
                                ...__ipsProxy,
                                contextKey: (argv, _argIndex) => argv[0],
                            }),
                            "*",
                        ],
                    ],
                ]
            );
        }

        wasm.bindingSignatures.wasmInternal = [
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

        sqlite3.StructBinder = globalThis.Jaccwabyt({
            heap: wasm.heap8u,
            alloc: wasm.alloc,
            dealloc: wasm.dealloc,
            bigIntEnabled: wasm.bigIntEnabled,
            memberPrefix: "$",
        });
        delete globalThis.Jaccwabyt;

        {
            const __xString = wasm.xWrap.argAdapter("string");
            wasm.xWrap.argAdapter("string:flexible", (v) =>
                __xString(util.flexibleString(v))
            );

            wasm.xWrap.argAdapter(
                "string:static",
                function (v) {
                    if (wasm.isPtr(v)) return v;
                    v = "" + v;
                    let rc = this[v];
                    return rc || (this[v] = wasm.allocCString(v));
                }.bind(Object.create(null))
            );

            const __xArgPtr = wasm.xWrap.argAdapter("*");
            const nilType = function () {};
            wasm.xWrap.argAdapter("sqlite3_filename", __xArgPtr)(
                "sqlite3_context*",
                __xArgPtr
            )("sqlite3_value*", __xArgPtr)("void*", __xArgPtr)(
                "sqlite3_changegroup*",
                __xArgPtr
            )("sqlite3_changeset_iter*", __xArgPtr)(
                "sqlite3_session*",
                __xArgPtr
            )("sqlite3_stmt*", (v) =>
                __xArgPtr(
                    v instanceof (sqlite3?.oo1?.Stmt || nilType) ? v.pointer : v
                )
            )("sqlite3*", (v) =>
                __xArgPtr(
                    v instanceof (sqlite3?.oo1?.DB || nilType) ? v.pointer : v
                )
            )("sqlite3_vfs*", (v) => {
                if ("string" === typeof v) {
                    return (
                        capi.sqlite3_vfs_find(v) ||
                        sqlite3.SQLite3Error.toss(
                            capi.SQLITE_NOTFOUND,
                            "Unknown sqlite3_vfs name:",
                            v
                        )
                    );
                }
                return __xArgPtr(
                    v instanceof (capi.sqlite3_vfs || nilType) ? v.pointer : v
                );
            });
            if (wasm.exports.sqlite3_declare_vtab) {
                wasm.xWrap.argAdapter("sqlite3_index_info*", (v) =>
                    __xArgPtr(
                        v instanceof (capi.sqlite3_index_info || nilType)
                            ? v.pointer
                            : v
                    )
                )("sqlite3_module*", (v) =>
                    __xArgPtr(
                        v instanceof (capi.sqlite3_module || nilType)
                            ? v.pointer
                            : v
                    )
                );
            }

            const __xRcPtr = wasm.xWrap.resultAdapter("*");
            wasm.xWrap.resultAdapter("sqlite3*", __xRcPtr)(
                "sqlite3_context*",
                __xRcPtr
            )("sqlite3_stmt*", __xRcPtr)("sqlite3_value*", __xRcPtr)(
                "sqlite3_vfs*",
                __xRcPtr
            )("void*", __xRcPtr);

            if (0 === wasm.exports.sqlite3_step.length) {
                wasm.xWrap.doArgcCheck = false;
                sqlite3.config.warn(
                    "Disabling sqlite3.wasm.xWrap.doArgcCheck due to environmental quirks."
                );
            }
            for (const e of wasm.bindingSignatures) {
                capi[e[0]] = wasm.xWrap.apply(null, e);
            }
            for (const e of wasm.bindingSignatures.wasmInternal) {
                util[e[0]] = wasm.xWrap.apply(null, e);
            }

            const fI64Disabled = function (fname) {
                return () =>
                    toss(
                        fname + "() is unavailable due to lack",
                        "of BigInt support in this build."
                    );
            };
            for (const e of wasm.bindingSignatures.int64) {
                capi[e[0]] = wasm.bigIntEnabled
                    ? wasm.xWrap.apply(null, e)
                    : fI64Disabled(e[0]);
            }

            delete wasm.bindingSignatures;

            if (wasm.exports.sqlite3__wasm_db_error) {
                const __db_err = wasm.xWrap(
                    "sqlite3__wasm_db_error",
                    "int",
                    "sqlite3*",
                    "int",
                    "string"
                );

                util.sqlite3__wasm_db_error = function (
                    pDb,
                    resultCode,
                    message
                ) {
                    if (resultCode instanceof sqlite3.WasmAllocError) {
                        resultCode = capi.SQLITE_NOMEM;
                        message = 0;
                    } else if (resultCode instanceof Error) {
                        message = message || "" + resultCode;
                        resultCode = resultCode.resultCode || capi.SQLITE_ERROR;
                    }
                    return pDb
                        ? __db_err(pDb, resultCode, message)
                        : resultCode;
                };
            } else {
                util.sqlite3__wasm_db_error = function (_pDb, errCode, _msg) {
                    console.warn(
                        "sqlite3__wasm_db_error() is not exported.",
                        arguments
                    );
                    return errCode;
                };
            }
        }

        {
            const cJson = wasm.xCall("sqlite3__wasm_enum_json");
            if (!cJson) {
                toss(
                    "Maintenance required: increase sqlite3__wasm_enum_json()'s",
                    "static buffer size!"
                );
            }

            wasm.ctype = JSON.parse(wasm.cstrToJs(cJson));

            const defineGroups = [
                "access",
                "authorizer",
                "blobFinalizers",
                "changeset",
                "config",
                "dataTypes",
                "dbConfig",
                "dbStatus",
                "encodings",
                "fcntl",
                "flock",
                "ioCap",
                "limits",
                "openFlags",
                "prepareFlags",
                "resultCodes",
                "sqlite3Status",
                "stmtStatus",
                "syncFlags",
                "trace",
                "txnState",
                "udfFlags",
                "version",
            ];
            if (wasm.bigIntEnabled) {
                defineGroups.push("serialize", "session", "vtab");
            }
            for (const t of defineGroups) {
                for (const e of Object.entries(wasm.ctype[t])) {
                    capi[e[0]] = e[1];
                }
            }
            if (!wasm.functionEntry(capi.SQLITE_WASM_DEALLOC)) {
                toss(
                    "Internal error: cannot resolve exported function",
                    "entry SQLITE_WASM_DEALLOC (==" +
                        capi.SQLITE_WASM_DEALLOC +
                        ")."
                );
            }
            const __rcMap = Object.create(null);
            for (const t of ["resultCodes"]) {
                for (const e of Object.entries(wasm.ctype[t])) {
                    __rcMap[e[1]] = e[0];
                }
            }

            capi.sqlite3_js_rc_str = (rc) => __rcMap[rc];

            const notThese = Object.assign(Object.create(null), {
                WasmTestStruct: true,

                sqlite3_kvvfs_methods: !util.isUIThread(),

                sqlite3_index_info: !wasm.bigIntEnabled,
                sqlite3_index_constraint: !wasm.bigIntEnabled,
                sqlite3_index_orderby: !wasm.bigIntEnabled,
                sqlite3_index_constraint_usage: !wasm.bigIntEnabled,
            });
            for (const s of wasm.ctype.structs) {
                if (!notThese[s.name]) {
                    capi[s.name] = sqlite3.StructBinder(s);
                }
            }
            if (capi.sqlite3_index_info) {
                for (const k of [
                    "sqlite3_index_constraint",
                    "sqlite3_index_orderby",
                    "sqlite3_index_constraint_usage",
                ]) {
                    capi.sqlite3_index_info[k] = capi[k];
                    delete capi[k];
                }
                capi.sqlite3_vtab_config = wasm.xWrap(
                    "sqlite3__wasm_vtab_config",
                    "int",
                    ["sqlite3*", "int", "int"]
                );
            }
        }

        const __dbArgcMismatch = (pDb, f, n) => {
            return util.sqlite3__wasm_db_error(
                pDb,
                capi.SQLITE_MISUSE,
                f +
                    "() requires " +
                    n +
                    " argument" +
                    (1 === n ? "" : "s") +
                    "."
            );
        };

        const __errEncoding = (pDb) => {
            return util.sqlite3__wasm_db_error(
                pDb,
                capi.SQLITE_FORMAT,
                "SQLITE_UTF8 is the only supported encoding."
            );
        };

        const __argPDb = (pDb) => wasm.xWrap.argAdapter("sqlite3*")(pDb);
        const __argStr = (str) => (wasm.isPtr(str) ? wasm.cstrToJs(str) : str);
        const __dbCleanupMap = function (pDb, mode) {
            pDb = __argPDb(pDb);
            let m = this.dbMap.get(pDb);
            if (!mode) {
                this.dbMap.delete(pDb);
                return m;
            } else if (!m && mode > 0) {
                this.dbMap.set(pDb, (m = Object.create(null)));
            }
            return m;
        }.bind(
            Object.assign(Object.create(null), {
                dbMap: new Map(),
            })
        );

        __dbCleanupMap.addCollation = function (pDb, name) {
            const m = __dbCleanupMap(pDb, 1);
            if (!m.collation) m.collation = new Set();
            m.collation.add(__argStr(name).toLowerCase());
        };

        __dbCleanupMap._addUDF = function (pDb, name, arity, map) {
            name = __argStr(name).toLowerCase();
            let u = map.get(name);
            if (!u) map.set(name, (u = new Set()));
            u.add(arity < 0 ? -1 : arity);
        };

        __dbCleanupMap.addFunction = function (pDb, name, arity) {
            const m = __dbCleanupMap(pDb, 1);
            if (!m.udf) m.udf = new Map();
            this._addUDF(pDb, name, arity, m.udf);
        };

        if (wasm.exports.sqlite3_create_window_function) {
            __dbCleanupMap.addWindowFunc = function (pDb, name, arity) {
                const m = __dbCleanupMap(pDb, 1);
                if (!m.wudf) m.wudf = new Map();
                this._addUDF(pDb, name, arity, m.wudf);
            };
        }

        __dbCleanupMap.cleanup = function (pDb) {
            pDb = __argPDb(pDb);

            const closeArgs = [pDb];
            for (const name of [
                "sqlite3_busy_handler",
                "sqlite3_commit_hook",
                "sqlite3_preupdate_hook",
                "sqlite3_progress_handler",
                "sqlite3_rollback_hook",
                "sqlite3_set_authorizer",
                "sqlite3_trace_v2",
                "sqlite3_update_hook",
            ]) {
                const x = wasm.exports[name];
                if (!x) {
                    continue;
                }
                closeArgs.length = x.length;
                try {
                    capi[name](...closeArgs);
                } catch (e) {
                    sqlite3.config.warn(
                        "close-time call of",
                        name + "(",
                        closeArgs,
                        ") threw:",
                        e
                    );
                }
            }
            const m = __dbCleanupMap(pDb, 0);
            if (!m) return;
            if (m.collation) {
                for (const name of m.collation) {
                    try {
                        capi.sqlite3_create_collation_v2(
                            pDb,
                            name,
                            capi.SQLITE_UTF8,
                            0,
                            0,
                            0
                        );
                    } catch (_e) {}
                }
                delete m.collation;
            }
            let i;
            for (i = 0; i < 2; ++i) {
                const fmap = i ? m.wudf : m.udf;
                if (!fmap) continue;
                const func = i
                    ? capi.sqlite3_create_window_function
                    : capi.sqlite3_create_function_v2;
                for (const e of fmap) {
                    const name = e[0],
                        arities = e[1];
                    const fargs = [
                        pDb,
                        name,
                        0,
                        capi.SQLITE_UTF8,
                        0,
                        0,
                        0,
                        0,
                        0,
                    ];
                    if (i) fargs.push(0);
                    for (const arity of arities) {
                        try {
                            fargs[2] = arity;
                            func.apply(null, fargs);
                        } catch (_e) {}
                    }
                    arities.clear();
                }
                fmap.clear();
            }
            delete m.udf;
            delete m.wudf;
        };

        {
            const __sqlite3CloseV2 = wasm.xWrap(
                "sqlite3_close_v2",
                "int",
                "sqlite3*"
            );
            capi.sqlite3_close_v2 = function (pDb) {
                if (1 !== arguments.length)
                    return __dbArgcMismatch(pDb, "sqlite3_close_v2", 1);
                if (pDb) {
                    try {
                        __dbCleanupMap.cleanup(pDb);
                    } catch (_e) {}
                }
                return __sqlite3CloseV2(pDb);
            };
        }

        if (capi.sqlite3session_create) {
            const __sqlite3SessionDelete = wasm.xWrap(
                "sqlite3session_delete",
                undefined,
                ["sqlite3_session*"]
            );
            capi.sqlite3session_delete = function (pSession) {
                if (1 !== arguments.length) {
                    throw new Error(
                        "sqlite3session_delete() requires 1 argument."
                    );
                } else if (pSession) {
                    capi.sqlite3session_table_filter(pSession, 0, 0);
                }
                __sqlite3SessionDelete(pSession);
            };
        }

        {
            const contextKey = (argv, argIndex) => {
                return (
                    "argv[" +
                    argIndex +
                    "]:" +
                    argv[0] +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            };
            const __sqlite3CreateCollationV2 = wasm.xWrap(
                "sqlite3_create_collation_v2",
                "int",
                [
                    "sqlite3*",
                    "string",
                    "int",
                    "*",
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xCompare",
                        signature: "i(pipip)",
                        contextKey,
                    }),
                    new wasm.xWrap.FuncPtrAdapter({
                        name: "xDestroy",
                        signature: "v(p)",
                        contextKey,
                    }),
                ]
            );

            capi.sqlite3_create_collation_v2 = function (
                pDb,
                zName,
                eTextRep,
                pArg,
                xCompare,
                xDestroy
            ) {
                if (6 !== arguments.length)
                    return __dbArgcMismatch(
                        pDb,
                        "sqlite3_create_collation_v2",
                        6
                    );
                else if (0 === (eTextRep & 0xf)) {
                    eTextRep |= capi.SQLITE_UTF8;
                } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
                    return __errEncoding(pDb);
                }
                try {
                    const rc = __sqlite3CreateCollationV2(
                        pDb,
                        zName,
                        eTextRep,
                        pArg,
                        xCompare,
                        xDestroy
                    );
                    if (0 === rc && xCompare instanceof Function) {
                        __dbCleanupMap.addCollation(pDb, zName);
                    }
                    return rc;
                } catch (e) {
                    return util.sqlite3__wasm_db_error(pDb, e);
                }
            };

            capi.sqlite3_create_collation = (
                pDb,
                zName,
                eTextRep,
                pArg,
                xCompare
            ) => {
                return 5 === arguments.length
                    ? capi.sqlite3_create_collation_v2(
                          pDb,
                          zName,
                          eTextRep,
                          pArg,
                          xCompare,
                          0
                      )
                    : __dbArgcMismatch(pDb, "sqlite3_create_collation", 5);
            };
        }

        {
            const contextKey = function (argv, argIndex) {
                return (
                    argv[0] +
                    ":" +
                    (argv[2] < 0 ? -1 : argv[2]) +
                    ":" +
                    argIndex +
                    ":" +
                    wasm.cstrToJs(argv[1]).toLowerCase()
                );
            };

            const __cfProxy = Object.assign(Object.create(null), {
                xInverseAndStep: {
                    signature: "v(pip)",
                    contextKey,
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
                xFinalAndValue: {
                    signature: "v(p)",
                    contextKey,
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
                xFunc: {
                    signature: "v(pip)",
                    contextKey,
                    callProxy: (callback) => {
                        return (pCtx, argc, pArgv) => {
                            try {
                                capi.sqlite3_result_js(
                                    pCtx,
                                    callback(
                                        pCtx,
                                        ...capi.sqlite3_values_to_js(
                                            argc,
                                            pArgv
                                        )
                                    )
                                );
                            } catch (e) {
                                capi.sqlite3_result_error_js(pCtx, e);
                            }
                        };
                    },
                },
                xDestroy: {
                    signature: "v(p)",
                    contextKey,

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

            const __sqlite3CreateFunction = wasm.xWrap(
                "sqlite3_create_function_v2",
                "int",
                [
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
                ]
            );

            const __sqlite3CreateWindowFunction = wasm.exports
                .sqlite3_create_window_function
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

            capi.sqlite3_create_function_v2 = function f(
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
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        pDb,
                        "sqlite3_create_function_v2",
                        f.length
                    );
                } else if (0 === (eTextRep & 0xf)) {
                    eTextRep |= capi.SQLITE_UTF8;
                } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
                    return __errEncoding(pDb);
                }
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
                    console.error(
                        "sqlite3_create_function_v2() setup threw:",
                        e
                    );
                    return util.sqlite3__wasm_db_error(
                        pDb,
                        e,
                        "Creation of UDF threw: " + e
                    );
                }
            };

            capi.sqlite3_create_function = function f(
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
                    ? capi.sqlite3_create_function_v2(
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
                    : __dbArgcMismatch(
                          pDb,
                          "sqlite3_create_function",
                          f.length
                      );
            };

            if (__sqlite3CreateWindowFunction) {
                capi.sqlite3_create_window_function = function f(
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
                    if (f.length !== arguments.length) {
                        return __dbArgcMismatch(
                            pDb,
                            "sqlite3_create_window_function",
                            f.length
                        );
                    } else if (0 === (eTextRep & 0xf)) {
                        eTextRep |= capi.SQLITE_UTF8;
                    } else if (capi.SQLITE_UTF8 !== (eTextRep & 0xf)) {
                        return __errEncoding(pDb);
                    }
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
                        console.error(
                            "sqlite3_create_window_function() setup threw:",
                            e
                        );
                        return util.sqlite3__wasm_db_error(
                            pDb,
                            e,
                            "Creation of UDF threw: " + e
                        );
                    }
                };
            } else {
                delete capi.sqlite3_create_window_function;
            }

            capi.sqlite3_create_function_v2.udfSetResult =
                capi.sqlite3_create_function.udfSetResult =
                    capi.sqlite3_result_js;
            if (capi.sqlite3_create_window_function) {
                capi.sqlite3_create_window_function.udfSetResult =
                    capi.sqlite3_result_js;
            }

            capi.sqlite3_create_function_v2.udfConvertArgs =
                capi.sqlite3_create_function.udfConvertArgs =
                    capi.sqlite3_values_to_js;
            if (capi.sqlite3_create_window_function) {
                capi.sqlite3_create_window_function.udfConvertArgs =
                    capi.sqlite3_values_to_js;
            }

            capi.sqlite3_create_function_v2.udfSetError =
                capi.sqlite3_create_function.udfSetError =
                    capi.sqlite3_result_error_js;
            if (capi.sqlite3_create_window_function) {
                capi.sqlite3_create_window_function.udfSetError =
                    capi.sqlite3_result_error_js;
            }
        }

        {
            const __flexiString = (v, n) => {
                if ("string" === typeof v) {
                    n = -1;
                } else if (util.isSQLableTypedArray(v)) {
                    n = v.byteLength;
                    v = util.typedArrayToString(
                        v instanceof ArrayBuffer ? new Uint8Array(v) : v
                    );
                } else if (Array.isArray(v)) {
                    v = v.join("");
                    n = -1;
                }
                return [v, n];
            };

            const __prepare = {
                basic: wasm.xWrap("sqlite3_prepare_v3", "int", [
                    "sqlite3*",
                    "string",
                    "int",
                    "int",
                    "**",
                    "**",
                ]),

                full: wasm.xWrap("sqlite3_prepare_v3", "int", [
                    "sqlite3*",
                    "*",
                    "int",
                    "int",
                    "**",
                    "**",
                ]),
            };

            capi.sqlite3_prepare_v3 = function f(
                pDb,
                sql,
                sqlLen,
                prepFlags,
                ppStmt,
                pzTail
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        pDb,
                        "sqlite3_prepare_v3",
                        f.length
                    );
                }
                const [xSql, xSqlLen] = __flexiString(sql, sqlLen);
                switch (typeof xSql) {
                    case "string":
                        return __prepare.basic(
                            pDb,
                            xSql,
                            xSqlLen,
                            prepFlags,
                            ppStmt,
                            null
                        );
                    case "number":
                        return __prepare.full(
                            pDb,
                            xSql,
                            xSqlLen,
                            prepFlags,
                            ppStmt,
                            pzTail
                        );
                    default:
                        return util.sqlite3__wasm_db_error(
                            pDb,
                            capi.SQLITE_MISUSE,
                            "Invalid SQL argument type for sqlite3_prepare_v2/v3()."
                        );
                }
            };

            capi.sqlite3_prepare_v2 = function f(
                pDb,
                sql,
                sqlLen,
                ppStmt,
                pzTail
            ) {
                return f.length === arguments.length
                    ? capi.sqlite3_prepare_v3(
                          pDb,
                          sql,
                          sqlLen,
                          0,
                          ppStmt,
                          pzTail
                      )
                    : __dbArgcMismatch(pDb, "sqlite3_prepare_v2", f.length);
            };
        }

        {
            const __bindText = wasm.xWrap("sqlite3_bind_text", "int", [
                "sqlite3_stmt*",
                "int",
                "string",
                "int",
                "*",
            ]);
            const __bindBlob = wasm.xWrap("sqlite3_bind_blob", "int", [
                "sqlite3_stmt*",
                "int",
                "*",
                "int",
                "*",
            ]);

            capi.sqlite3_bind_text = function f(
                pStmt,
                iCol,
                text,
                nText,
                xDestroy
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        capi.sqlite3_db_handle(pStmt),
                        "sqlite3_bind_text",
                        f.length
                    );
                } else if (wasm.isPtr(text) || null === text) {
                    return __bindText(pStmt, iCol, text, nText, xDestroy);
                } else if (text instanceof ArrayBuffer) {
                    text = new Uint8Array(text);
                } else if (Array.isArray(text)) {
                    text = text.join("");
                }
                let p, n;
                try {
                    if (util.isSQLableTypedArray(text)) {
                        p = wasm.allocFromTypedArray(text);
                        n = text.byteLength;
                    } else if ("string" === typeof text) {
                        [p, n] = wasm.allocCString(text);
                    } else {
                        return util.sqlite3__wasm_db_error(
                            capi.sqlite3_db_handle(pStmt),
                            capi.SQLITE_MISUSE,
                            "Invalid 3rd argument type for sqlite3_bind_text()."
                        );
                    }
                    return __bindText(
                        pStmt,
                        iCol,
                        p,
                        n,
                        capi.SQLITE_WASM_DEALLOC
                    );
                } catch (e) {
                    wasm.dealloc(p);
                    return util.sqlite3__wasm_db_error(
                        capi.sqlite3_db_handle(pStmt),
                        e
                    );
                }
            };

            capi.sqlite3_bind_blob = function f(
                pStmt,
                iCol,
                pMem,
                nMem,
                xDestroy
            ) {
                if (f.length !== arguments.length) {
                    return __dbArgcMismatch(
                        capi.sqlite3_db_handle(pStmt),
                        "sqlite3_bind_blob",
                        f.length
                    );
                } else if (wasm.isPtr(pMem) || null === pMem) {
                    return __bindBlob(pStmt, iCol, pMem, nMem, xDestroy);
                } else if (pMem instanceof ArrayBuffer) {
                    pMem = new Uint8Array(pMem);
                } else if (Array.isArray(pMem)) {
                    pMem = pMem.join("");
                }
                let p, n;
                try {
                    if (util.isBindableTypedArray(pMem)) {
                        p = wasm.allocFromTypedArray(pMem);
                        n = nMem >= 0 ? nMem : pMem.byteLength;
                    } else if ("string" === typeof pMem) {
                        [p, n] = wasm.allocCString(pMem);
                    } else {
                        return util.sqlite3__wasm_db_error(
                            capi.sqlite3_db_handle(pStmt),
                            capi.SQLITE_MISUSE,
                            "Invalid 3rd argument type for sqlite3_bind_blob()."
                        );
                    }
                    return __bindBlob(
                        pStmt,
                        iCol,
                        p,
                        n,
                        capi.SQLITE_WASM_DEALLOC
                    );
                } catch (e) {
                    wasm.dealloc(p);
                    return util.sqlite3__wasm_db_error(
                        capi.sqlite3_db_handle(pStmt),
                        e
                    );
                }
            };
        }

        {
            capi.sqlite3_config = function (op, ...args) {
                if (arguments.length < 2) return capi.SQLITE_MISUSE;
                switch (op) {
                    case capi.SQLITE_CONFIG_COVERING_INDEX_SCAN:
                    case capi.SQLITE_CONFIG_MEMSTATUS:
                    case capi.SQLITE_CONFIG_SMALL_MALLOC:
                    case capi.SQLITE_CONFIG_SORTERREF_SIZE:
                    case capi.SQLITE_CONFIG_STMTJRNL_SPILL:
                    case capi.SQLITE_CONFIG_URI:
                        return wasm.exports.sqlite3__wasm_config_i(op, args[0]);
                    case capi.SQLITE_CONFIG_LOOKASIDE:
                        return wasm.exports.sqlite3__wasm_config_ii(
                            op,
                            args[0],
                            args[1]
                        );
                    case capi.SQLITE_CONFIG_MEMDB_MAXSIZE:
                        return wasm.exports.sqlite3__wasm_config_j(op, args[0]);
                    case capi.SQLITE_CONFIG_GETMALLOC:
                    case capi.SQLITE_CONFIG_GETMUTEX:
                    case capi.SQLITE_CONFIG_GETPCACHE2:
                    case capi.SQLITE_CONFIG_GETPCACHE:
                    case capi.SQLITE_CONFIG_HEAP:
                    case capi.SQLITE_CONFIG_LOG:
                    case capi.SQLITE_CONFIG_MALLOC:
                    case capi.SQLITE_CONFIG_MMAP_SIZE:
                    case capi.SQLITE_CONFIG_MULTITHREAD:
                    case capi.SQLITE_CONFIG_MUTEX:
                    case capi.SQLITE_CONFIG_PAGECACHE:
                    case capi.SQLITE_CONFIG_PCACHE2:
                    case capi.SQLITE_CONFIG_PCACHE:
                    case capi.SQLITE_CONFIG_PCACHE_HDRSZ:
                    case capi.SQLITE_CONFIG_PMASZ:
                    case capi.SQLITE_CONFIG_SERIALIZED:
                    case capi.SQLITE_CONFIG_SINGLETHREAD:
                    case capi.SQLITE_CONFIG_SQLLOG:
                    case capi.SQLITE_CONFIG_WIN32_HEAPSIZE:
                    default:
                        return capi.SQLITE_NOTFOUND;
                }
            };
        }

        {
            const __autoExtFptr = new Set();

            capi.sqlite3_auto_extension = function (fPtr) {
                if (fPtr instanceof Function) {
                    fPtr = wasm.installFunction("i(ppp)", fPtr);
                } else if (1 !== arguments.length || !wasm.isPtr(fPtr)) {
                    return capi.SQLITE_MISUSE;
                }
                const rc = wasm.exports.sqlite3_auto_extension(fPtr);
                if (fPtr !== arguments[0]) {
                    if (0 === rc) __autoExtFptr.add(fPtr);
                    else wasm.uninstallFunction(fPtr);
                }
                return rc;
            };

            capi.sqlite3_cancel_auto_extension = function (fPtr) {
                if (!fPtr || 1 !== arguments.length || !wasm.isPtr(fPtr))
                    return 0;
                return wasm.exports.sqlite3_cancel_auto_extension(fPtr);
            };

            capi.sqlite3_reset_auto_extension = function () {
                wasm.exports.sqlite3_reset_auto_extension();
                for (const fp of __autoExtFptr) wasm.uninstallFunction(fp);
                __autoExtFptr.clear();
            };
        }

        const pKvvfs = capi.sqlite3_vfs_find("kvvfs");
        if (pKvvfs) {
            if (util.isUIThread()) {
                const kvvfsMethods = new capi.sqlite3_kvvfs_methods(
                    wasm.exports.sqlite3__wasm_kvvfs_methods()
                );
                delete capi.sqlite3_kvvfs_methods;

                const kvvfsMakeKey =
                        wasm.exports.sqlite3__wasm_kvvfsMakeKeyOnPstack,
                    pstack = wasm.pstack;

                const kvvfsStorage = (zClass) =>
                    115 === wasm.peek(zClass) ? sessionStorage : localStorage;

                const kvvfsImpls = {
                    xRead: (zClass, zKey, zBuf, nBuf) => {
                        const stack = pstack.pointer,
                            astack = wasm.scopedAllocPush();
                        try {
                            const zXKey = kvvfsMakeKey(zClass, zKey);
                            if (!zXKey) return -3;
                            const jKey = wasm.cstrToJs(zXKey);
                            const jV = kvvfsStorage(zClass).getItem(jKey);
                            if (!jV) return -1;
                            const nV = jV.length;
                            if (nBuf <= 0) return nV;
                            else if (1 === nBuf) {
                                wasm.poke(zBuf, 0);
                                return nV;
                            }
                            const zV = wasm.scopedAllocCString(jV);
                            if (nBuf > nV + 1) nBuf = nV + 1;
                            wasm.heap8u().copyWithin(zBuf, zV, zV + nBuf - 1);
                            wasm.poke(zBuf + nBuf - 1, 0);
                            return nBuf - 1;
                        } catch (e) {
                            console.error("kvstorageRead()", e);
                            return -2;
                        } finally {
                            pstack.restore(stack);
                            wasm.scopedAllocPop(astack);
                        }
                    },
                    xWrite: (zClass, zKey, zData) => {
                        const stack = pstack.pointer;
                        try {
                            const zXKey = kvvfsMakeKey(zClass, zKey);
                            if (!zXKey) return 1;
                            const jKey = wasm.cstrToJs(zXKey);
                            kvvfsStorage(zClass).setItem(
                                jKey,
                                wasm.cstrToJs(zData)
                            );
                            return 0;
                        } catch (e) {
                            console.error("kvstorageWrite()", e);
                            return capi.SQLITE_IOERR;
                        } finally {
                            pstack.restore(stack);
                        }
                    },
                    xDelete: (zClass, zKey) => {
                        const stack = pstack.pointer;
                        try {
                            const zXKey = kvvfsMakeKey(zClass, zKey);
                            if (!zXKey) return 1;
                            kvvfsStorage(zClass).removeItem(
                                wasm.cstrToJs(zXKey)
                            );
                            return 0;
                        } catch (e) {
                            console.error("kvstorageDelete()", e);
                            return capi.SQLITE_IOERR;
                        } finally {
                            pstack.restore(stack);
                        }
                    },
                };
                for (const k of Object.keys(kvvfsImpls)) {
                    kvvfsMethods[kvvfsMethods.memberKey(k)] =
                        wasm.installFunction(
                            kvvfsMethods.memberSignature(k),
                            kvvfsImpls[k]
                        );
                }
            } else {
                capi.sqlite3_vfs_unregister(pKvvfs);
            }
        }

        wasm.xWrap.FuncPtrAdapter.warnOnUse = true;

        const StructBinder = sqlite3.StructBinder;
        const installMethod = function callee(
            tgt,
            name,
            func,
            applyArgcCheck = callee.installMethodArgcCheck
        ) {
            if (!(tgt instanceof StructBinder.StructType)) {
                toss("Usage error: target object is-not-a StructType.");
            } else if (!(func instanceof Function) && !wasm.isPtr(func)) {
                toss(
                    "Usage error: expecting a Function or WASM pointer to one."
                );
            }
            if (1 === arguments.length) {
                return (n, f) => callee(tgt, n, f, applyArgcCheck);
            }
            if (!callee.argcProxy) {
                callee.argcProxy = function (tgt, funcName, func, sig) {
                    return function (...args) {
                        if (func.length !== arguments.length) {
                            toss(
                                "Argument mismatch for",
                                tgt.structInfo.name +
                                    "::" +
                                    funcName +
                                    ": Native signature is:",
                                sig
                            );
                        }
                        return func.apply(this, args);
                    };
                };

                callee.removeFuncList = function () {
                    if (this.ondispose.__removeFuncList) {
                        this.ondispose.__removeFuncList.forEach((v, _ndx) => {
                            if ("number" === typeof v) {
                                try {
                                    wasm.uninstallFunction(v);
                                } catch (_e) {}
                            }
                        });
                        delete this.ondispose.__removeFuncList;
                    }
                };
            }
            const sigN = tgt.memberSignature(name);
            if (sigN.length < 2) {
                toss(
                    "Member",
                    name,
                    "does not have a function pointer signature:",
                    sigN
                );
            }
            const memKey = tgt.memberKey(name);
            const fProxy =
                applyArgcCheck && !wasm.isPtr(func)
                    ? callee.argcProxy(tgt, memKey, func, sigN)
                    : func;
            if (wasm.isPtr(fProxy)) {
                if (fProxy && !wasm.functionEntry(fProxy)) {
                    toss(
                        "Pointer",
                        fProxy,
                        "is not a WASM function table entry."
                    );
                }
                tgt[memKey] = fProxy;
            } else {
                const pFunc = wasm.installFunction(
                    fProxy,
                    tgt.memberSignature(name, true)
                );
                tgt[memKey] = pFunc;
                if (!tgt.ondispose || !tgt.ondispose.__removeFuncList) {
                    tgt.addOnDispose(
                        "ondispose.__removeFuncList handler",
                        callee.removeFuncList
                    );
                    tgt.ondispose.__removeFuncList = [];
                }
                tgt.ondispose.__removeFuncList.push(memKey, pFunc);
            }
            return (n, f) => callee(tgt, n, f, applyArgcCheck);
        };
        installMethod.installMethodArgcCheck = false;

        const installMethods = function (
            structInstance,
            methods,
            applyArgcCheck = installMethod.installMethodArgcCheck
        ) {
            const seen = new Map();
            for (const k of Object.keys(methods)) {
                const m = methods[k];
                const prior = seen.get(m);
                if (prior) {
                    const mkey = structInstance.memberKey(k);
                    structInstance[mkey] =
                        structInstance[structInstance.memberKey(prior)];
                } else {
                    installMethod(structInstance, k, m, applyArgcCheck);
                    seen.set(m, k);
                }
            }
            return structInstance;
        };

        StructBinder.StructType.prototype.installMethod = function callee(
            name,
            _func,
            _applyArgcCheck = installMethod.installMethodArgcCheck
        ) {
            return arguments.length < 3 && name && "object" === typeof name
                ? installMethods(this, ...arguments)
                : installMethod(this, ...arguments);
        };

        StructBinder.StructType.prototype.installMethods = function (
            methods,
            applyArgcCheck = installMethod.installMethodArgcCheck
        ) {
            return installMethods(this, methods, applyArgcCheck);
        };
    };
}
