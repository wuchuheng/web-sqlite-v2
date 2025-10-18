/**
 * Lazily wire WASM exports onto the Emscripten Module.
 * This replaces the 1.5k lines of mechanically generated wrappers with
 * a data-driven approach while keeping the same runtime behaviour.
 */

const MODULE_EXPORTS = [
    "emscripten_builtin_memalign",
    "free",
    "malloc",
    "realloc",
    "sqlite3__wasm_SQLTester_strglob",
    "sqlite3__wasm_config_i",
    "sqlite3__wasm_config_ii",
    "sqlite3__wasm_config_j",
    "sqlite3__wasm_db_config_ip",
    "sqlite3__wasm_db_config_pii",
    "sqlite3__wasm_db_config_s",
    "sqlite3__wasm_db_error",
    "sqlite3__wasm_db_export_chunked",
    "sqlite3__wasm_db_reset",
    "sqlite3__wasm_db_serialize",
    "sqlite3__wasm_db_vfs",
    "sqlite3__wasm_enum_json",
    "sqlite3__wasm_init_wasmfs",
    "sqlite3__wasm_kvvfsMakeKeyOnPstack",
    "sqlite3__wasm_kvvfs_methods",
    "sqlite3__wasm_posix_create_file",
    "sqlite3__wasm_pstack_alloc",
    "sqlite3__wasm_pstack_ptr",
    "sqlite3__wasm_pstack_quota",
    "sqlite3__wasm_pstack_remaining",
    "sqlite3__wasm_pstack_restore",
    "sqlite3__wasm_qfmt_token",
    "sqlite3__wasm_test_int64_max",
    "sqlite3__wasm_test_int64_min",
    "sqlite3__wasm_test_int64_minmax",
    "sqlite3__wasm_test_int64_times2",
    "sqlite3__wasm_test_int64ptr",
    "sqlite3__wasm_test_intptr",
    "sqlite3__wasm_test_stack_overflow",
    "sqlite3__wasm_test_str_hello",
    "sqlite3__wasm_test_struct",
    "sqlite3__wasm_test_voidptr",
    "sqlite3__wasm_vfs_create_file",
    "sqlite3__wasm_vfs_unlink",
    "sqlite3__wasm_vtab_config",
    "sqlite3_aggregate_context",
    "sqlite3_auto_extension",
    "sqlite3_bind_blob",
    "sqlite3_bind_double",
    "sqlite3_bind_int",
    "sqlite3_bind_int64",
    "sqlite3_bind_null",
    "sqlite3_bind_parameter_count",
    "sqlite3_bind_parameter_index",
    "sqlite3_bind_parameter_name",
    "sqlite3_bind_pointer",
    "sqlite3_bind_text",
    "sqlite3_busy_handler",
    "sqlite3_busy_timeout",
    "sqlite3_cancel_auto_extension",
    "sqlite3_changes",
    "sqlite3_changes64",
    "sqlite3_clear_bindings",
    "sqlite3_close_v2",
    "sqlite3_collation_needed",
    "sqlite3_column_blob",
    "sqlite3_column_bytes",
    "sqlite3_column_count",
    "sqlite3_column_decltype",
    "sqlite3_column_double",
    "sqlite3_column_int",
    "sqlite3_column_int64",
    "sqlite3_column_name",
    "sqlite3_column_text",
    "sqlite3_column_type",
    "sqlite3_column_value",
    "sqlite3_commit_hook",
    "sqlite3_compileoption_get",
    "sqlite3_compileoption_used",
    "sqlite3_complete",
    "sqlite3_context_db_handle",
    "sqlite3_create_collation",
    "sqlite3_create_collation_v2",
    "sqlite3_create_function",
    "sqlite3_create_function_v2",
    "sqlite3_create_module",
    "sqlite3_create_module_v2",
    "sqlite3_create_window_function",
    "sqlite3_data_count",
    "sqlite3_db_filename",
    "sqlite3_db_handle",
    "sqlite3_db_name",
    "sqlite3_db_readonly",
    "sqlite3_db_status",
    "sqlite3_declare_vtab",
    "sqlite3_deserialize",
    "sqlite3_drop_modules",
    "sqlite3_errcode",
    "sqlite3_errmsg",
    "sqlite3_error_offset",
    "sqlite3_errstr",
    "sqlite3_exec",
    "sqlite3_expanded_sql",
    "sqlite3_extended_errcode",
    "sqlite3_extended_result_codes",
    "sqlite3_file_control",
    "sqlite3_finalize",
    "sqlite3_free",
    "sqlite3_get_autocommit",
    "sqlite3_get_auxdata",
    "sqlite3_initialize",
    "sqlite3_interrupt",
    "sqlite3_is_interrupted",
    "sqlite3_keyword_check",
    "sqlite3_keyword_count",
    "sqlite3_keyword_name",
    "sqlite3_last_insert_rowid",
    "sqlite3_libversion",
    "sqlite3_libversion_number",
    "sqlite3_limit",
    "sqlite3_malloc",
    "sqlite3_malloc64",
    "sqlite3_msize",
    "sqlite3_open",
    "sqlite3_open_v2",
    "sqlite3_overload_function",
    "sqlite3_prepare_v2",
    "sqlite3_prepare_v3",
    "sqlite3_preupdate_blobwrite",
    "sqlite3_preupdate_count",
    "sqlite3_preupdate_depth",
    "sqlite3_preupdate_hook",
    "sqlite3_preupdate_new",
    "sqlite3_preupdate_old",
    "sqlite3_progress_handler",
    "sqlite3_randomness",
    "sqlite3_realloc",
    "sqlite3_realloc64",
    "sqlite3_reset",
    "sqlite3_reset_auto_extension",
    "sqlite3_result_blob",
    "sqlite3_result_double",
    "sqlite3_result_error",
    "sqlite3_result_error_code",
    "sqlite3_result_error_nomem",
    "sqlite3_result_error_toobig",
    "sqlite3_result_int",
    "sqlite3_result_int64",
    "sqlite3_result_null",
    "sqlite3_result_pointer",
    "sqlite3_result_subtype",
    "sqlite3_result_text",
    "sqlite3_result_zeroblob",
    "sqlite3_result_zeroblob64",
    "sqlite3_rollback_hook",
    "sqlite3_serialize",
    "sqlite3_set_authorizer",
    "sqlite3_set_auxdata",
    "sqlite3_set_last_insert_rowid",
    "sqlite3_shutdown",
    "sqlite3_sourceid",
    "sqlite3_sql",
    "sqlite3_status",
    "sqlite3_status64",
    "sqlite3_step",
    "sqlite3_stmt_busy",
    "sqlite3_stmt_explain",
    "sqlite3_stmt_isexplain",
    "sqlite3_stmt_readonly",
    "sqlite3_stmt_status",
    "sqlite3_strglob",
    "sqlite3_stricmp",
    "sqlite3_strlike",
    "sqlite3_strnicmp",
    "sqlite3_table_column_metadata",
    "sqlite3_total_changes",
    "sqlite3_total_changes64",
    "sqlite3_trace_v2",
    "sqlite3_txn_state",
    "sqlite3_update_hook",
    "sqlite3_uri_boolean",
    "sqlite3_uri_int64",
    "sqlite3_uri_key",
    "sqlite3_uri_parameter",
    "sqlite3_user_data",
    "sqlite3_value_blob",
    "sqlite3_value_bytes",
    "sqlite3_value_double",
    "sqlite3_value_dup",
    "sqlite3_value_free",
    "sqlite3_value_frombind",
    "sqlite3_value_int",
    "sqlite3_value_int64",
    "sqlite3_value_nochange",
    "sqlite3_value_numeric_type",
    "sqlite3_value_pointer",
    "sqlite3_value_subtype",
    "sqlite3_value_text",
    "sqlite3_value_type",
    "sqlite3_vfs_find",
    "sqlite3_vfs_register",
    "sqlite3_vfs_unregister",
    "sqlite3_vtab_collation",
    "sqlite3_vtab_distinct",
    "sqlite3_vtab_in",
    "sqlite3_vtab_in_first",
    "sqlite3_vtab_in_next",
    "sqlite3_vtab_nochange",
    "sqlite3_vtab_on_conflict",
    "sqlite3_vtab_rhs_value",
    "sqlite3changegroup_add",
    "sqlite3changegroup_add_strm",
    "sqlite3changegroup_delete",
    "sqlite3changegroup_new",
    "sqlite3changegroup_output",
    "sqlite3changegroup_output_strm",
    "sqlite3changeset_apply",
    "sqlite3changeset_apply_strm",
    "sqlite3changeset_apply_v2",
    "sqlite3changeset_apply_v2_strm",
    "sqlite3changeset_concat",
    "sqlite3changeset_concat_strm",
    "sqlite3changeset_conflict",
    "sqlite3changeset_finalize",
    "sqlite3changeset_fk_conflicts",
    "sqlite3changeset_invert",
    "sqlite3changeset_invert_strm",
    "sqlite3changeset_new",
    "sqlite3changeset_next",
    "sqlite3changeset_old",
    "sqlite3changeset_op",
    "sqlite3changeset_pk",
    "sqlite3changeset_start",
    "sqlite3changeset_start_strm",
    "sqlite3changeset_start_v2",
    "sqlite3changeset_start_v2_strm",
    "sqlite3session_attach",
    "sqlite3session_changeset",
    "sqlite3session_changeset_size",
    "sqlite3session_changeset_strm",
    "sqlite3session_config",
    "sqlite3session_create",
    "sqlite3session_delete",
    "sqlite3session_diff",
    "sqlite3session_enable",
    "sqlite3session_indirect",
    "sqlite3session_isempty",
    "sqlite3session_memory_used",
    "sqlite3session_object_config",
    "sqlite3session_patchset",
    "sqlite3session_patchset_strm",
    "sqlite3session_table_filter",
];

const LOCAL_EXPORTS = [
    "__wasm_call_ctors",
    "_emscripten_stack_alloc",
    "_emscripten_stack_restore",
    "emscripten_stack_get_current",
];

// Guard against configuration mismatches so we fail loudly if an expected
// export is missing.
const ensureFunctionExport = (exportName, value) => {
    if (typeof value !== "function") {
        throw new TypeError(`WASM export "${exportName}" is not callable.`);
    }
    return value;
};

const createLazyModuleBinding = (
    Module,
    wasmExports,
    moduleKey,
    exportName
) => {
    const lazy = (...args) => {
        const fn = ensureFunctionExport(exportName, wasmExports[exportName]);
        Module[moduleKey] = fn;
        return fn(...args);
    };
    Module[moduleKey] = lazy;
    return lazy;
};

const createLazyLocalBinding = (wasmExports, exportName) => {
    let cached;
    return (...args) => {
        if (!cached) {
            cached = ensureFunctionExport(exportName, wasmExports[exportName]);
        }
        return cached(...args);
    };
};

/**
 * Lazily wires module-level bindings onto the supplied Emscripten Module instance.
 *
 * @param {Record<string, unknown>} Module Target module.
 * @param {import("./bootstrap/runtime/capi-helpers.d.ts").WasmExports & WebAssembly.Exports} wasmExports
 *        Wasm export table.
 * @returns {import("./sqlite3-wasm-exports.d.ts").WasmExportBindings}
 */
export const attachSqlite3WasmExports = (Module, wasmExports) => {
    const localBindings = LOCAL_EXPORTS.reduce((acc, exportName) => {
        acc[exportName] = createLazyLocalBinding(wasmExports, exportName);
        return acc;
    }, Object.create(null));

    let emscriptenBuiltinMemalign;
    for (const exportName of MODULE_EXPORTS) {
        const moduleKey = `_${exportName}`;
        const binding = createLazyModuleBinding(
            Module,
            wasmExports,
            moduleKey,
            exportName
        );
        if (exportName === "emscripten_builtin_memalign") {
            emscriptenBuiltinMemalign = binding;
        }
    }

    void localBindings;

    return {
        emscriptenBuiltinMemalign,
    };
};
