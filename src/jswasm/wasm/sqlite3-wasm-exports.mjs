export const attachSqlite3WasmExports = (Module, wasmExports) => {
    var ___wasm_call_ctors = () =>
        (___wasm_call_ctors = wasmExports["__wasm_call_ctors"])();
    var _sqlite3_status64 = (Module["_sqlite3_status64"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_status64 = Module["_sqlite3_status64"] =
            wasmExports["sqlite3_status64"])(a0, a1, a2, a3));
    var _sqlite3_status = (Module["_sqlite3_status"] = (a0, a1, a2, a3) =>
        (_sqlite3_status = Module["_sqlite3_status"] =
            wasmExports["sqlite3_status"])(a0, a1, a2, a3));
    var _sqlite3_db_status = (Module["_sqlite3_db_status"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_db_status = Module["_sqlite3_db_status"] =
            wasmExports["sqlite3_db_status"])(a0, a1, a2, a3, a4));
    var _sqlite3_msize = (Module["_sqlite3_msize"] = (a0) =>
        (_sqlite3_msize = Module["_sqlite3_msize"] =
            wasmExports["sqlite3_msize"])(a0));
    var _sqlite3_vfs_find = (Module["_sqlite3_vfs_find"] = (a0) =>
        (_sqlite3_vfs_find = Module["_sqlite3_vfs_find"] =
            wasmExports["sqlite3_vfs_find"])(a0));
    var _sqlite3_initialize = (Module["_sqlite3_initialize"] = () =>
        (_sqlite3_initialize = Module["_sqlite3_initialize"] =
            wasmExports["sqlite3_initialize"])());
    var _sqlite3_malloc = (Module["_sqlite3_malloc"] = (a0) =>
        (_sqlite3_malloc = Module["_sqlite3_malloc"] =
            wasmExports["sqlite3_malloc"])(a0));
    var _sqlite3_free = (Module["_sqlite3_free"] = (a0) =>
        (_sqlite3_free = Module["_sqlite3_free"] =
            wasmExports["sqlite3_free"])(a0));
    var _sqlite3_vfs_register = (Module["_sqlite3_vfs_register"] = (
        a0,
        a1
    ) =>
        (_sqlite3_vfs_register = Module["_sqlite3_vfs_register"] =
            wasmExports["sqlite3_vfs_register"])(a0, a1));
    var _sqlite3_vfs_unregister = (Module["_sqlite3_vfs_unregister"] = (
        a0
    ) =>
        (_sqlite3_vfs_unregister = Module["_sqlite3_vfs_unregister"] =
            wasmExports["sqlite3_vfs_unregister"])(a0));
    var _sqlite3_malloc64 = (Module["_sqlite3_malloc64"] = (a0) =>
        (_sqlite3_malloc64 = Module["_sqlite3_malloc64"] =
            wasmExports["sqlite3_malloc64"])(a0));
    var _sqlite3_realloc = (Module["_sqlite3_realloc"] = (a0, a1) =>
        (_sqlite3_realloc = Module["_sqlite3_realloc"] =
            wasmExports["sqlite3_realloc"])(a0, a1));
    var _sqlite3_realloc64 = (Module["_sqlite3_realloc64"] = (a0, a1) =>
        (_sqlite3_realloc64 = Module["_sqlite3_realloc64"] =
            wasmExports["sqlite3_realloc64"])(a0, a1));
    var _sqlite3_value_text = (Module["_sqlite3_value_text"] = (a0) =>
        (_sqlite3_value_text = Module["_sqlite3_value_text"] =
            wasmExports["sqlite3_value_text"])(a0));
    var _sqlite3_randomness = (Module["_sqlite3_randomness"] = (a0, a1) =>
        (_sqlite3_randomness = Module["_sqlite3_randomness"] =
            wasmExports["sqlite3_randomness"])(a0, a1));
    var _sqlite3_stricmp = (Module["_sqlite3_stricmp"] = (a0, a1) =>
        (_sqlite3_stricmp = Module["_sqlite3_stricmp"] =
            wasmExports["sqlite3_stricmp"])(a0, a1));
    var _sqlite3_strnicmp = (Module["_sqlite3_strnicmp"] = (a0, a1, a2) =>
        (_sqlite3_strnicmp = Module["_sqlite3_strnicmp"] =
            wasmExports["sqlite3_strnicmp"])(a0, a1, a2));
    var _sqlite3_uri_parameter = (Module["_sqlite3_uri_parameter"] = (
        a0,
        a1
    ) =>
        (_sqlite3_uri_parameter = Module["_sqlite3_uri_parameter"] =
            wasmExports["sqlite3_uri_parameter"])(a0, a1));
    var _sqlite3_uri_boolean = (Module["_sqlite3_uri_boolean"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_uri_boolean = Module["_sqlite3_uri_boolean"] =
            wasmExports["sqlite3_uri_boolean"])(a0, a1, a2));
    var _sqlite3_serialize = (Module["_sqlite3_serialize"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_serialize = Module["_sqlite3_serialize"] =
            wasmExports["sqlite3_serialize"])(a0, a1, a2, a3));
    var _sqlite3_prepare_v2 = (Module["_sqlite3_prepare_v2"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_prepare_v2 = Module["_sqlite3_prepare_v2"] =
            wasmExports["sqlite3_prepare_v2"])(a0, a1, a2, a3, a4));
    var _sqlite3_step = (Module["_sqlite3_step"] = (a0) =>
        (_sqlite3_step = Module["_sqlite3_step"] =
            wasmExports["sqlite3_step"])(a0));
    var _sqlite3_column_int64 = (Module["_sqlite3_column_int64"] = (
        a0,
        a1
    ) =>
        (_sqlite3_column_int64 = Module["_sqlite3_column_int64"] =
            wasmExports["sqlite3_column_int64"])(a0, a1));
    var _sqlite3_reset = (Module["_sqlite3_reset"] = (a0) =>
        (_sqlite3_reset = Module["_sqlite3_reset"] =
            wasmExports["sqlite3_reset"])(a0));
    var _sqlite3_exec = (Module["_sqlite3_exec"] = (a0, a1, a2, a3, a4) =>
        (_sqlite3_exec = Module["_sqlite3_exec"] =
            wasmExports["sqlite3_exec"])(a0, a1, a2, a3, a4));
    var _sqlite3_column_int = (Module["_sqlite3_column_int"] = (a0, a1) =>
        (_sqlite3_column_int = Module["_sqlite3_column_int"] =
            wasmExports["sqlite3_column_int"])(a0, a1));
    var _sqlite3_finalize = (Module["_sqlite3_finalize"] = (a0) =>
        (_sqlite3_finalize = Module["_sqlite3_finalize"] =
            wasmExports["sqlite3_finalize"])(a0));
    var _sqlite3_file_control = (Module["_sqlite3_file_control"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_file_control = Module["_sqlite3_file_control"] =
            wasmExports["sqlite3_file_control"])(a0, a1, a2, a3));
    var _sqlite3_column_name = (Module["_sqlite3_column_name"] = (a0, a1) =>
        (_sqlite3_column_name = Module["_sqlite3_column_name"] =
            wasmExports["sqlite3_column_name"])(a0, a1));
    var _sqlite3_column_text = (Module["_sqlite3_column_text"] = (a0, a1) =>
        (_sqlite3_column_text = Module["_sqlite3_column_text"] =
            wasmExports["sqlite3_column_text"])(a0, a1));
    var _sqlite3_column_type = (Module["_sqlite3_column_type"] = (a0, a1) =>
        (_sqlite3_column_type = Module["_sqlite3_column_type"] =
            wasmExports["sqlite3_column_type"])(a0, a1));
    var _sqlite3_errmsg = (Module["_sqlite3_errmsg"] = (a0) =>
        (_sqlite3_errmsg = Module["_sqlite3_errmsg"] =
            wasmExports["sqlite3_errmsg"])(a0));
    var _sqlite3_deserialize = (Module["_sqlite3_deserialize"] = (
        a0,
        a1,
        a2,
        a3,
        a4,
        a5
    ) =>
        (_sqlite3_deserialize = Module["_sqlite3_deserialize"] =
            wasmExports["sqlite3_deserialize"])(a0, a1, a2, a3, a4, a5));
    var _sqlite3_clear_bindings = (Module["_sqlite3_clear_bindings"] = (
        a0
    ) =>
        (_sqlite3_clear_bindings = Module["_sqlite3_clear_bindings"] =
            wasmExports["sqlite3_clear_bindings"])(a0));
    var _sqlite3_value_blob = (Module["_sqlite3_value_blob"] = (a0) =>
        (_sqlite3_value_blob = Module["_sqlite3_value_blob"] =
            wasmExports["sqlite3_value_blob"])(a0));
    var _sqlite3_value_bytes = (Module["_sqlite3_value_bytes"] = (a0) =>
        (_sqlite3_value_bytes = Module["_sqlite3_value_bytes"] =
            wasmExports["sqlite3_value_bytes"])(a0));
    var _sqlite3_value_double = (Module["_sqlite3_value_double"] = (a0) =>
        (_sqlite3_value_double = Module["_sqlite3_value_double"] =
            wasmExports["sqlite3_value_double"])(a0));
    var _sqlite3_value_int = (Module["_sqlite3_value_int"] = (a0) =>
        (_sqlite3_value_int = Module["_sqlite3_value_int"] =
            wasmExports["sqlite3_value_int"])(a0));
    var _sqlite3_value_int64 = (Module["_sqlite3_value_int64"] = (a0) =>
        (_sqlite3_value_int64 = Module["_sqlite3_value_int64"] =
            wasmExports["sqlite3_value_int64"])(a0));
    var _sqlite3_value_subtype = (Module["_sqlite3_value_subtype"] = (a0) =>
        (_sqlite3_value_subtype = Module["_sqlite3_value_subtype"] =
            wasmExports["sqlite3_value_subtype"])(a0));
    var _sqlite3_value_pointer = (Module["_sqlite3_value_pointer"] = (
        a0,
        a1
    ) =>
        (_sqlite3_value_pointer = Module["_sqlite3_value_pointer"] =
            wasmExports["sqlite3_value_pointer"])(a0, a1));
    var _sqlite3_value_type = (Module["_sqlite3_value_type"] = (a0) =>
        (_sqlite3_value_type = Module["_sqlite3_value_type"] =
            wasmExports["sqlite3_value_type"])(a0));
    var _sqlite3_value_nochange = (Module["_sqlite3_value_nochange"] = (
        a0
    ) =>
        (_sqlite3_value_nochange = Module["_sqlite3_value_nochange"] =
            wasmExports["sqlite3_value_nochange"])(a0));
    var _sqlite3_value_frombind = (Module["_sqlite3_value_frombind"] = (
        a0
    ) =>
        (_sqlite3_value_frombind = Module["_sqlite3_value_frombind"] =
            wasmExports["sqlite3_value_frombind"])(a0));
    var _sqlite3_value_dup = (Module["_sqlite3_value_dup"] = (a0) =>
        (_sqlite3_value_dup = Module["_sqlite3_value_dup"] =
            wasmExports["sqlite3_value_dup"])(a0));
    var _sqlite3_value_free = (Module["_sqlite3_value_free"] = (a0) =>
        (_sqlite3_value_free = Module["_sqlite3_value_free"] =
            wasmExports["sqlite3_value_free"])(a0));
    var _sqlite3_result_blob = (Module["_sqlite3_result_blob"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_result_blob = Module["_sqlite3_result_blob"] =
            wasmExports["sqlite3_result_blob"])(a0, a1, a2, a3));
    var _sqlite3_result_error_toobig = (Module[
        "_sqlite3_result_error_toobig"
    ] = (a0) =>
        (_sqlite3_result_error_toobig = Module[
            "_sqlite3_result_error_toobig"
        ] =
            wasmExports["sqlite3_result_error_toobig"])(a0));
    var _sqlite3_result_error_nomem = (Module[
        "_sqlite3_result_error_nomem"
    ] = (a0) =>
        (_sqlite3_result_error_nomem = Module[
            "_sqlite3_result_error_nomem"
        ] =
            wasmExports["sqlite3_result_error_nomem"])(a0));
    var _sqlite3_result_double = (Module["_sqlite3_result_double"] = (
        a0,
        a1
    ) =>
        (_sqlite3_result_double = Module["_sqlite3_result_double"] =
            wasmExports["sqlite3_result_double"])(a0, a1));
    var _sqlite3_result_error = (Module["_sqlite3_result_error"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_result_error = Module["_sqlite3_result_error"] =
            wasmExports["sqlite3_result_error"])(a0, a1, a2));
    var _sqlite3_result_int = (Module["_sqlite3_result_int"] = (a0, a1) =>
        (_sqlite3_result_int = Module["_sqlite3_result_int"] =
            wasmExports["sqlite3_result_int"])(a0, a1));
    var _sqlite3_result_int64 = (Module["_sqlite3_result_int64"] = (
        a0,
        a1
    ) =>
        (_sqlite3_result_int64 = Module["_sqlite3_result_int64"] =
            wasmExports["sqlite3_result_int64"])(a0, a1));
    var _sqlite3_result_null = (Module["_sqlite3_result_null"] = (a0) =>
        (_sqlite3_result_null = Module["_sqlite3_result_null"] =
            wasmExports["sqlite3_result_null"])(a0));
    var _sqlite3_result_pointer = (Module["_sqlite3_result_pointer"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_result_pointer = Module["_sqlite3_result_pointer"] =
            wasmExports["sqlite3_result_pointer"])(a0, a1, a2, a3));
    var _sqlite3_result_subtype = (Module["_sqlite3_result_subtype"] = (
        a0,
        a1
    ) =>
        (_sqlite3_result_subtype = Module["_sqlite3_result_subtype"] =
            wasmExports["sqlite3_result_subtype"])(a0, a1));
    var _sqlite3_result_text = (Module["_sqlite3_result_text"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_result_text = Module["_sqlite3_result_text"] =
            wasmExports["sqlite3_result_text"])(a0, a1, a2, a3));
    var _sqlite3_result_zeroblob = (Module["_sqlite3_result_zeroblob"] = (
        a0,
        a1
    ) =>
        (_sqlite3_result_zeroblob = Module["_sqlite3_result_zeroblob"] =
            wasmExports["sqlite3_result_zeroblob"])(a0, a1));
    var _sqlite3_result_zeroblob64 = (Module["_sqlite3_result_zeroblob64"] =
        (a0, a1) =>
            (_sqlite3_result_zeroblob64 = Module[
                "_sqlite3_result_zeroblob64"
            ] =
                wasmExports["sqlite3_result_zeroblob64"])(a0, a1));
    var _sqlite3_result_error_code = (Module["_sqlite3_result_error_code"] =
        (a0, a1) =>
            (_sqlite3_result_error_code = Module[
                "_sqlite3_result_error_code"
            ] =
                wasmExports["sqlite3_result_error_code"])(a0, a1));
    var _sqlite3_user_data = (Module["_sqlite3_user_data"] = (a0) =>
        (_sqlite3_user_data = Module["_sqlite3_user_data"] =
            wasmExports["sqlite3_user_data"])(a0));
    var _sqlite3_context_db_handle = (Module["_sqlite3_context_db_handle"] =
        (a0) =>
            (_sqlite3_context_db_handle = Module[
                "_sqlite3_context_db_handle"
            ] =
                wasmExports["sqlite3_context_db_handle"])(a0));
    var _sqlite3_vtab_nochange = (Module["_sqlite3_vtab_nochange"] = (a0) =>
        (_sqlite3_vtab_nochange = Module["_sqlite3_vtab_nochange"] =
            wasmExports["sqlite3_vtab_nochange"])(a0));
    var _sqlite3_vtab_in_first = (Module["_sqlite3_vtab_in_first"] = (
        a0,
        a1
    ) =>
        (_sqlite3_vtab_in_first = Module["_sqlite3_vtab_in_first"] =
            wasmExports["sqlite3_vtab_in_first"])(a0, a1));
    var _sqlite3_vtab_in_next = (Module["_sqlite3_vtab_in_next"] = (
        a0,
        a1
    ) =>
        (_sqlite3_vtab_in_next = Module["_sqlite3_vtab_in_next"] =
            wasmExports["sqlite3_vtab_in_next"])(a0, a1));
    var _sqlite3_aggregate_context = (Module["_sqlite3_aggregate_context"] =
        (a0, a1) =>
            (_sqlite3_aggregate_context = Module[
                "_sqlite3_aggregate_context"
            ] =
                wasmExports["sqlite3_aggregate_context"])(a0, a1));
    var _sqlite3_get_auxdata = (Module["_sqlite3_get_auxdata"] = (a0, a1) =>
        (_sqlite3_get_auxdata = Module["_sqlite3_get_auxdata"] =
            wasmExports["sqlite3_get_auxdata"])(a0, a1));
    var _sqlite3_set_auxdata = (Module["_sqlite3_set_auxdata"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_set_auxdata = Module["_sqlite3_set_auxdata"] =
            wasmExports["sqlite3_set_auxdata"])(a0, a1, a2, a3));
    var _sqlite3_column_count = (Module["_sqlite3_column_count"] = (a0) =>
        (_sqlite3_column_count = Module["_sqlite3_column_count"] =
            wasmExports["sqlite3_column_count"])(a0));
    var _sqlite3_data_count = (Module["_sqlite3_data_count"] = (a0) =>
        (_sqlite3_data_count = Module["_sqlite3_data_count"] =
            wasmExports["sqlite3_data_count"])(a0));
    var _sqlite3_column_blob = (Module["_sqlite3_column_blob"] = (a0, a1) =>
        (_sqlite3_column_blob = Module["_sqlite3_column_blob"] =
            wasmExports["sqlite3_column_blob"])(a0, a1));
    var _sqlite3_column_bytes = (Module["_sqlite3_column_bytes"] = (
        a0,
        a1
    ) =>
        (_sqlite3_column_bytes = Module["_sqlite3_column_bytes"] =
            wasmExports["sqlite3_column_bytes"])(a0, a1));
    var _sqlite3_column_double = (Module["_sqlite3_column_double"] = (
        a0,
        a1
    ) =>
        (_sqlite3_column_double = Module["_sqlite3_column_double"] =
            wasmExports["sqlite3_column_double"])(a0, a1));
    var _sqlite3_column_value = (Module["_sqlite3_column_value"] = (
        a0,
        a1
    ) =>
        (_sqlite3_column_value = Module["_sqlite3_column_value"] =
            wasmExports["sqlite3_column_value"])(a0, a1));
    var _sqlite3_column_decltype = (Module["_sqlite3_column_decltype"] = (
        a0,
        a1
    ) =>
        (_sqlite3_column_decltype = Module["_sqlite3_column_decltype"] =
            wasmExports["sqlite3_column_decltype"])(a0, a1));
    var _sqlite3_bind_blob = (Module["_sqlite3_bind_blob"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_bind_blob = Module["_sqlite3_bind_blob"] =
            wasmExports["sqlite3_bind_blob"])(a0, a1, a2, a3, a4));
    var _sqlite3_bind_double = (Module["_sqlite3_bind_double"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_bind_double = Module["_sqlite3_bind_double"] =
            wasmExports["sqlite3_bind_double"])(a0, a1, a2));
    var _sqlite3_bind_int = (Module["_sqlite3_bind_int"] = (a0, a1, a2) =>
        (_sqlite3_bind_int = Module["_sqlite3_bind_int"] =
            wasmExports["sqlite3_bind_int"])(a0, a1, a2));
    var _sqlite3_bind_int64 = (Module["_sqlite3_bind_int64"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_bind_int64 = Module["_sqlite3_bind_int64"] =
            wasmExports["sqlite3_bind_int64"])(a0, a1, a2));
    var _sqlite3_bind_null = (Module["_sqlite3_bind_null"] = (a0, a1) =>
        (_sqlite3_bind_null = Module["_sqlite3_bind_null"] =
            wasmExports["sqlite3_bind_null"])(a0, a1));
    var _sqlite3_bind_pointer = (Module["_sqlite3_bind_pointer"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_bind_pointer = Module["_sqlite3_bind_pointer"] =
            wasmExports["sqlite3_bind_pointer"])(a0, a1, a2, a3, a4));
    var _sqlite3_bind_text = (Module["_sqlite3_bind_text"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_bind_text = Module["_sqlite3_bind_text"] =
            wasmExports["sqlite3_bind_text"])(a0, a1, a2, a3, a4));
    var _sqlite3_bind_parameter_count = (Module[
        "_sqlite3_bind_parameter_count"
    ] = (a0) =>
        (_sqlite3_bind_parameter_count = Module[
            "_sqlite3_bind_parameter_count"
        ] =
            wasmExports["sqlite3_bind_parameter_count"])(a0));
    var _sqlite3_bind_parameter_name = (Module[
        "_sqlite3_bind_parameter_name"
    ] = (a0, a1) =>
        (_sqlite3_bind_parameter_name = Module[
            "_sqlite3_bind_parameter_name"
        ] =
            wasmExports["sqlite3_bind_parameter_name"])(a0, a1));
    var _sqlite3_bind_parameter_index = (Module[
        "_sqlite3_bind_parameter_index"
    ] = (a0, a1) =>
        (_sqlite3_bind_parameter_index = Module[
            "_sqlite3_bind_parameter_index"
        ] =
            wasmExports["sqlite3_bind_parameter_index"])(a0, a1));
    var _sqlite3_db_handle = (Module["_sqlite3_db_handle"] = (a0) =>
        (_sqlite3_db_handle = Module["_sqlite3_db_handle"] =
            wasmExports["sqlite3_db_handle"])(a0));
    var _sqlite3_stmt_readonly = (Module["_sqlite3_stmt_readonly"] = (a0) =>
        (_sqlite3_stmt_readonly = Module["_sqlite3_stmt_readonly"] =
            wasmExports["sqlite3_stmt_readonly"])(a0));
    var _sqlite3_stmt_isexplain = (Module["_sqlite3_stmt_isexplain"] = (
        a0
    ) =>
        (_sqlite3_stmt_isexplain = Module["_sqlite3_stmt_isexplain"] =
            wasmExports["sqlite3_stmt_isexplain"])(a0));
    var _sqlite3_stmt_explain = (Module["_sqlite3_stmt_explain"] = (
        a0,
        a1
    ) =>
        (_sqlite3_stmt_explain = Module["_sqlite3_stmt_explain"] =
            wasmExports["sqlite3_stmt_explain"])(a0, a1));
    var _sqlite3_stmt_busy = (Module["_sqlite3_stmt_busy"] = (a0) =>
        (_sqlite3_stmt_busy = Module["_sqlite3_stmt_busy"] =
            wasmExports["sqlite3_stmt_busy"])(a0));
    var _sqlite3_stmt_status = (Module["_sqlite3_stmt_status"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_stmt_status = Module["_sqlite3_stmt_status"] =
            wasmExports["sqlite3_stmt_status"])(a0, a1, a2));
    var _sqlite3_sql = (Module["_sqlite3_sql"] = (a0) =>
        (_sqlite3_sql = Module["_sqlite3_sql"] =
            wasmExports["sqlite3_sql"])(a0));
    var _sqlite3_expanded_sql = (Module["_sqlite3_expanded_sql"] = (a0) =>
        (_sqlite3_expanded_sql = Module["_sqlite3_expanded_sql"] =
            wasmExports["sqlite3_expanded_sql"])(a0));
    var _sqlite3_preupdate_old = (Module["_sqlite3_preupdate_old"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_preupdate_old = Module["_sqlite3_preupdate_old"] =
            wasmExports["sqlite3_preupdate_old"])(a0, a1, a2));
    var _sqlite3_preupdate_count = (Module["_sqlite3_preupdate_count"] = (
        a0
    ) =>
        (_sqlite3_preupdate_count = Module["_sqlite3_preupdate_count"] =
            wasmExports["sqlite3_preupdate_count"])(a0));
    var _sqlite3_preupdate_depth = (Module["_sqlite3_preupdate_depth"] = (
        a0
    ) =>
        (_sqlite3_preupdate_depth = Module["_sqlite3_preupdate_depth"] =
            wasmExports["sqlite3_preupdate_depth"])(a0));
    var _sqlite3_preupdate_blobwrite = (Module[
        "_sqlite3_preupdate_blobwrite"
    ] = (a0) =>
        (_sqlite3_preupdate_blobwrite = Module[
            "_sqlite3_preupdate_blobwrite"
        ] =
            wasmExports["sqlite3_preupdate_blobwrite"])(a0));
    var _sqlite3_preupdate_new = (Module["_sqlite3_preupdate_new"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_preupdate_new = Module["_sqlite3_preupdate_new"] =
            wasmExports["sqlite3_preupdate_new"])(a0, a1, a2));
    var _sqlite3_value_numeric_type = (Module[
        "_sqlite3_value_numeric_type"
    ] = (a0) =>
        (_sqlite3_value_numeric_type = Module[
            "_sqlite3_value_numeric_type"
        ] =
            wasmExports["sqlite3_value_numeric_type"])(a0));
    var _sqlite3_set_authorizer = (Module["_sqlite3_set_authorizer"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_set_authorizer = Module["_sqlite3_set_authorizer"] =
            wasmExports["sqlite3_set_authorizer"])(a0, a1, a2));
    var _sqlite3_strglob = (Module["_sqlite3_strglob"] = (a0, a1) =>
        (_sqlite3_strglob = Module["_sqlite3_strglob"] =
            wasmExports["sqlite3_strglob"])(a0, a1));
    var _sqlite3_strlike = (Module["_sqlite3_strlike"] = (a0, a1, a2) =>
        (_sqlite3_strlike = Module["_sqlite3_strlike"] =
            wasmExports["sqlite3_strlike"])(a0, a1, a2));
    var _sqlite3_auto_extension = (Module["_sqlite3_auto_extension"] = (
        a0
    ) =>
        (_sqlite3_auto_extension = Module["_sqlite3_auto_extension"] =
            wasmExports["sqlite3_auto_extension"])(a0));
    var _sqlite3_cancel_auto_extension = (Module[
        "_sqlite3_cancel_auto_extension"
    ] = (a0) =>
        (_sqlite3_cancel_auto_extension = Module[
            "_sqlite3_cancel_auto_extension"
        ] =
            wasmExports["sqlite3_cancel_auto_extension"])(a0));
    var _sqlite3_reset_auto_extension = (Module[
        "_sqlite3_reset_auto_extension"
    ] = () =>
        (_sqlite3_reset_auto_extension = Module[
            "_sqlite3_reset_auto_extension"
        ] =
            wasmExports["sqlite3_reset_auto_extension"])());
    var _sqlite3_prepare_v3 = (Module["_sqlite3_prepare_v3"] = (
        a0,
        a1,
        a2,
        a3,
        a4,
        a5
    ) =>
        (_sqlite3_prepare_v3 = Module["_sqlite3_prepare_v3"] =
            wasmExports["sqlite3_prepare_v3"])(a0, a1, a2, a3, a4, a5));
    var _sqlite3_create_module = (Module["_sqlite3_create_module"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_create_module = Module["_sqlite3_create_module"] =
            wasmExports["sqlite3_create_module"])(a0, a1, a2, a3));
    var _sqlite3_create_module_v2 = (Module["_sqlite3_create_module_v2"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_create_module_v2 = Module["_sqlite3_create_module_v2"] =
            wasmExports["sqlite3_create_module_v2"])(a0, a1, a2, a3, a4));
    var _sqlite3_drop_modules = (Module["_sqlite3_drop_modules"] = (
        a0,
        a1
    ) =>
        (_sqlite3_drop_modules = Module["_sqlite3_drop_modules"] =
            wasmExports["sqlite3_drop_modules"])(a0, a1));
    var _sqlite3_declare_vtab = (Module["_sqlite3_declare_vtab"] = (
        a0,
        a1
    ) =>
        (_sqlite3_declare_vtab = Module["_sqlite3_declare_vtab"] =
            wasmExports["sqlite3_declare_vtab"])(a0, a1));
    var _sqlite3_vtab_on_conflict = (Module["_sqlite3_vtab_on_conflict"] = (
        a0
    ) =>
        (_sqlite3_vtab_on_conflict = Module["_sqlite3_vtab_on_conflict"] =
            wasmExports["sqlite3_vtab_on_conflict"])(a0));
    var _sqlite3_vtab_collation = (Module["_sqlite3_vtab_collation"] = (
        a0,
        a1
    ) =>
        (_sqlite3_vtab_collation = Module["_sqlite3_vtab_collation"] =
            wasmExports["sqlite3_vtab_collation"])(a0, a1));
    var _sqlite3_vtab_in = (Module["_sqlite3_vtab_in"] = (a0, a1, a2) =>
        (_sqlite3_vtab_in = Module["_sqlite3_vtab_in"] =
            wasmExports["sqlite3_vtab_in"])(a0, a1, a2));
    var _sqlite3_vtab_rhs_value = (Module["_sqlite3_vtab_rhs_value"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_vtab_rhs_value = Module["_sqlite3_vtab_rhs_value"] =
            wasmExports["sqlite3_vtab_rhs_value"])(a0, a1, a2));
    var _sqlite3_vtab_distinct = (Module["_sqlite3_vtab_distinct"] = (a0) =>
        (_sqlite3_vtab_distinct = Module["_sqlite3_vtab_distinct"] =
            wasmExports["sqlite3_vtab_distinct"])(a0));
    var _sqlite3_keyword_name = (Module["_sqlite3_keyword_name"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_keyword_name = Module["_sqlite3_keyword_name"] =
            wasmExports["sqlite3_keyword_name"])(a0, a1, a2));
    var _sqlite3_keyword_count = (Module["_sqlite3_keyword_count"] = () =>
        (_sqlite3_keyword_count = Module["_sqlite3_keyword_count"] =
            wasmExports["sqlite3_keyword_count"])());
    var _sqlite3_keyword_check = (Module["_sqlite3_keyword_check"] = (
        a0,
        a1
    ) =>
        (_sqlite3_keyword_check = Module["_sqlite3_keyword_check"] =
            wasmExports["sqlite3_keyword_check"])(a0, a1));
    var _sqlite3_complete = (Module["_sqlite3_complete"] = (a0) =>
        (_sqlite3_complete = Module["_sqlite3_complete"] =
            wasmExports["sqlite3_complete"])(a0));
    var _sqlite3_libversion = (Module["_sqlite3_libversion"] = () =>
        (_sqlite3_libversion = Module["_sqlite3_libversion"] =
            wasmExports["sqlite3_libversion"])());
    var _sqlite3_libversion_number = (Module["_sqlite3_libversion_number"] =
        () =>
            (_sqlite3_libversion_number = Module[
                "_sqlite3_libversion_number"
            ] =
                wasmExports["sqlite3_libversion_number"])());
    var _sqlite3_shutdown = (Module["_sqlite3_shutdown"] = () =>
        (_sqlite3_shutdown = Module["_sqlite3_shutdown"] =
            wasmExports["sqlite3_shutdown"])());
    var _sqlite3_last_insert_rowid = (Module["_sqlite3_last_insert_rowid"] =
        (a0) =>
            (_sqlite3_last_insert_rowid = Module[
                "_sqlite3_last_insert_rowid"
            ] =
                wasmExports["sqlite3_last_insert_rowid"])(a0));
    var _sqlite3_set_last_insert_rowid = (Module[
        "_sqlite3_set_last_insert_rowid"
    ] = (a0, a1) =>
        (_sqlite3_set_last_insert_rowid = Module[
            "_sqlite3_set_last_insert_rowid"
        ] =
            wasmExports["sqlite3_set_last_insert_rowid"])(a0, a1));
    var _sqlite3_changes64 = (Module["_sqlite3_changes64"] = (a0) =>
        (_sqlite3_changes64 = Module["_sqlite3_changes64"] =
            wasmExports["sqlite3_changes64"])(a0));
    var _sqlite3_changes = (Module["_sqlite3_changes"] = (a0) =>
        (_sqlite3_changes = Module["_sqlite3_changes"] =
            wasmExports["sqlite3_changes"])(a0));
    var _sqlite3_total_changes64 = (Module["_sqlite3_total_changes64"] = (
        a0
    ) =>
        (_sqlite3_total_changes64 = Module["_sqlite3_total_changes64"] =
            wasmExports["sqlite3_total_changes64"])(a0));
    var _sqlite3_total_changes = (Module["_sqlite3_total_changes"] = (a0) =>
        (_sqlite3_total_changes = Module["_sqlite3_total_changes"] =
            wasmExports["sqlite3_total_changes"])(a0));
    var _sqlite3_txn_state = (Module["_sqlite3_txn_state"] = (a0, a1) =>
        (_sqlite3_txn_state = Module["_sqlite3_txn_state"] =
            wasmExports["sqlite3_txn_state"])(a0, a1));
    var _sqlite3_close_v2 = (Module["_sqlite3_close_v2"] = (a0) =>
        (_sqlite3_close_v2 = Module["_sqlite3_close_v2"] =
            wasmExports["sqlite3_close_v2"])(a0));
    var _sqlite3_busy_handler = (Module["_sqlite3_busy_handler"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_busy_handler = Module["_sqlite3_busy_handler"] =
            wasmExports["sqlite3_busy_handler"])(a0, a1, a2));
    var _sqlite3_progress_handler = (Module["_sqlite3_progress_handler"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_progress_handler = Module["_sqlite3_progress_handler"] =
            wasmExports["sqlite3_progress_handler"])(a0, a1, a2, a3));
    var _sqlite3_busy_timeout = (Module["_sqlite3_busy_timeout"] = (
        a0,
        a1
    ) =>
        (_sqlite3_busy_timeout = Module["_sqlite3_busy_timeout"] =
            wasmExports["sqlite3_busy_timeout"])(a0, a1));
    var _sqlite3_interrupt = (Module["_sqlite3_interrupt"] = (a0) =>
        (_sqlite3_interrupt = Module["_sqlite3_interrupt"] =
            wasmExports["sqlite3_interrupt"])(a0));
    var _sqlite3_is_interrupted = (Module["_sqlite3_is_interrupted"] = (
        a0
    ) =>
        (_sqlite3_is_interrupted = Module["_sqlite3_is_interrupted"] =
            wasmExports["sqlite3_is_interrupted"])(a0));
    var _sqlite3_create_function = (Module["_sqlite3_create_function"] = (
        a0,
        a1,
        a2,
        a3,
        a4,
        a5,
        a6,
        a7
    ) =>
        (_sqlite3_create_function = Module["_sqlite3_create_function"] =
            wasmExports["sqlite3_create_function"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5,
            a6,
            a7
        ));
    var _sqlite3_create_function_v2 = (Module[
        "_sqlite3_create_function_v2"
    ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
        (_sqlite3_create_function_v2 = Module[
            "_sqlite3_create_function_v2"
        ] =
            wasmExports["sqlite3_create_function_v2"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5,
            a6,
            a7,
            a8
        ));
    var _sqlite3_create_window_function = (Module[
        "_sqlite3_create_window_function"
    ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) =>
        (_sqlite3_create_window_function = Module[
            "_sqlite3_create_window_function"
        ] =
            wasmExports["sqlite3_create_window_function"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5,
            a6,
            a7,
            a8,
            a9
        ));
    var _sqlite3_overload_function = (Module["_sqlite3_overload_function"] =
        (a0, a1, a2) =>
            (_sqlite3_overload_function = Module[
                "_sqlite3_overload_function"
            ] =
                wasmExports["sqlite3_overload_function"])(a0, a1, a2));
    var _sqlite3_trace_v2 = (Module["_sqlite3_trace_v2"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3_trace_v2 = Module["_sqlite3_trace_v2"] =
            wasmExports["sqlite3_trace_v2"])(a0, a1, a2, a3));
    var _sqlite3_commit_hook = (Module["_sqlite3_commit_hook"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_commit_hook = Module["_sqlite3_commit_hook"] =
            wasmExports["sqlite3_commit_hook"])(a0, a1, a2));
    var _sqlite3_update_hook = (Module["_sqlite3_update_hook"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_update_hook = Module["_sqlite3_update_hook"] =
            wasmExports["sqlite3_update_hook"])(a0, a1, a2));
    var _sqlite3_rollback_hook = (Module["_sqlite3_rollback_hook"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_rollback_hook = Module["_sqlite3_rollback_hook"] =
            wasmExports["sqlite3_rollback_hook"])(a0, a1, a2));
    var _sqlite3_preupdate_hook = (Module["_sqlite3_preupdate_hook"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_preupdate_hook = Module["_sqlite3_preupdate_hook"] =
            wasmExports["sqlite3_preupdate_hook"])(a0, a1, a2));
    var _sqlite3_error_offset = (Module["_sqlite3_error_offset"] = (a0) =>
        (_sqlite3_error_offset = Module["_sqlite3_error_offset"] =
            wasmExports["sqlite3_error_offset"])(a0));
    var _sqlite3_errcode = (Module["_sqlite3_errcode"] = (a0) =>
        (_sqlite3_errcode = Module["_sqlite3_errcode"] =
            wasmExports["sqlite3_errcode"])(a0));
    var _sqlite3_extended_errcode = (Module["_sqlite3_extended_errcode"] = (
        a0
    ) =>
        (_sqlite3_extended_errcode = Module["_sqlite3_extended_errcode"] =
            wasmExports["sqlite3_extended_errcode"])(a0));
    var _sqlite3_errstr = (Module["_sqlite3_errstr"] = (a0) =>
        (_sqlite3_errstr = Module["_sqlite3_errstr"] =
            wasmExports["sqlite3_errstr"])(a0));
    var _sqlite3_limit = (Module["_sqlite3_limit"] = (a0, a1, a2) =>
        (_sqlite3_limit = Module["_sqlite3_limit"] =
            wasmExports["sqlite3_limit"])(a0, a1, a2));
    var _sqlite3_open = (Module["_sqlite3_open"] = (a0, a1) =>
        (_sqlite3_open = Module["_sqlite3_open"] =
            wasmExports["sqlite3_open"])(a0, a1));
    var _sqlite3_open_v2 = (Module["_sqlite3_open_v2"] = (a0, a1, a2, a3) =>
        (_sqlite3_open_v2 = Module["_sqlite3_open_v2"] =
            wasmExports["sqlite3_open_v2"])(a0, a1, a2, a3));
    var _sqlite3_create_collation = (Module["_sqlite3_create_collation"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3_create_collation = Module["_sqlite3_create_collation"] =
            wasmExports["sqlite3_create_collation"])(a0, a1, a2, a3, a4));
    var _sqlite3_create_collation_v2 = (Module[
        "_sqlite3_create_collation_v2"
    ] = (a0, a1, a2, a3, a4, a5) =>
        (_sqlite3_create_collation_v2 = Module[
            "_sqlite3_create_collation_v2"
        ] =
            wasmExports["sqlite3_create_collation_v2"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ));
    var _sqlite3_collation_needed = (Module["_sqlite3_collation_needed"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3_collation_needed = Module["_sqlite3_collation_needed"] =
            wasmExports["sqlite3_collation_needed"])(a0, a1, a2));
    var _sqlite3_get_autocommit = (Module["_sqlite3_get_autocommit"] = (
        a0
    ) =>
        (_sqlite3_get_autocommit = Module["_sqlite3_get_autocommit"] =
            wasmExports["sqlite3_get_autocommit"])(a0));
    var _sqlite3_table_column_metadata = (Module[
        "_sqlite3_table_column_metadata"
    ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
        (_sqlite3_table_column_metadata = Module[
            "_sqlite3_table_column_metadata"
        ] =
            wasmExports["sqlite3_table_column_metadata"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5,
            a6,
            a7,
            a8
        ));
    var _sqlite3_extended_result_codes = (Module[
        "_sqlite3_extended_result_codes"
    ] = (a0, a1) =>
        (_sqlite3_extended_result_codes = Module[
            "_sqlite3_extended_result_codes"
        ] =
            wasmExports["sqlite3_extended_result_codes"])(a0, a1));
    var _sqlite3_uri_key = (Module["_sqlite3_uri_key"] = (a0, a1) =>
        (_sqlite3_uri_key = Module["_sqlite3_uri_key"] =
            wasmExports["sqlite3_uri_key"])(a0, a1));
    var _sqlite3_uri_int64 = (Module["_sqlite3_uri_int64"] = (a0, a1, a2) =>
        (_sqlite3_uri_int64 = Module["_sqlite3_uri_int64"] =
            wasmExports["sqlite3_uri_int64"])(a0, a1, a2));
    var _sqlite3_db_name = (Module["_sqlite3_db_name"] = (a0, a1) =>
        (_sqlite3_db_name = Module["_sqlite3_db_name"] =
            wasmExports["sqlite3_db_name"])(a0, a1));
    var _sqlite3_db_filename = (Module["_sqlite3_db_filename"] = (a0, a1) =>
        (_sqlite3_db_filename = Module["_sqlite3_db_filename"] =
            wasmExports["sqlite3_db_filename"])(a0, a1));
    var _sqlite3_db_readonly = (Module["_sqlite3_db_readonly"] = (a0, a1) =>
        (_sqlite3_db_readonly = Module["_sqlite3_db_readonly"] =
            wasmExports["sqlite3_db_readonly"])(a0, a1));
    var _sqlite3_compileoption_used = (Module[
        "_sqlite3_compileoption_used"
    ] = (a0) =>
        (_sqlite3_compileoption_used = Module[
            "_sqlite3_compileoption_used"
        ] =
            wasmExports["sqlite3_compileoption_used"])(a0));
    var _sqlite3_compileoption_get = (Module["_sqlite3_compileoption_get"] =
        (a0) =>
            (_sqlite3_compileoption_get = Module[
                "_sqlite3_compileoption_get"
            ] =
                wasmExports["sqlite3_compileoption_get"])(a0));
    var _sqlite3session_diff = (Module["_sqlite3session_diff"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3session_diff = Module["_sqlite3session_diff"] =
            wasmExports["sqlite3session_diff"])(a0, a1, a2, a3));
    var _sqlite3session_attach = (Module["_sqlite3session_attach"] = (
        a0,
        a1
    ) =>
        (_sqlite3session_attach = Module["_sqlite3session_attach"] =
            wasmExports["sqlite3session_attach"])(a0, a1));
    var _sqlite3session_create = (Module["_sqlite3session_create"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3session_create = Module["_sqlite3session_create"] =
            wasmExports["sqlite3session_create"])(a0, a1, a2));
    var _sqlite3session_delete = (Module["_sqlite3session_delete"] = (a0) =>
        (_sqlite3session_delete = Module["_sqlite3session_delete"] =
            wasmExports["sqlite3session_delete"])(a0));
    var _sqlite3session_table_filter = (Module[
        "_sqlite3session_table_filter"
    ] = (a0, a1, a2) =>
        (_sqlite3session_table_filter = Module[
            "_sqlite3session_table_filter"
        ] =
            wasmExports["sqlite3session_table_filter"])(a0, a1, a2));
    var _sqlite3session_changeset = (Module["_sqlite3session_changeset"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3session_changeset = Module["_sqlite3session_changeset"] =
            wasmExports["sqlite3session_changeset"])(a0, a1, a2));
    var _sqlite3session_changeset_strm = (Module[
        "_sqlite3session_changeset_strm"
    ] = (a0, a1, a2) =>
        (_sqlite3session_changeset_strm = Module[
            "_sqlite3session_changeset_strm"
        ] =
            wasmExports["sqlite3session_changeset_strm"])(a0, a1, a2));
    var _sqlite3session_patchset_strm = (Module[
        "_sqlite3session_patchset_strm"
    ] = (a0, a1, a2) =>
        (_sqlite3session_patchset_strm = Module[
            "_sqlite3session_patchset_strm"
        ] =
            wasmExports["sqlite3session_patchset_strm"])(a0, a1, a2));
    var _sqlite3session_patchset = (Module["_sqlite3session_patchset"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3session_patchset = Module["_sqlite3session_patchset"] =
            wasmExports["sqlite3session_patchset"])(a0, a1, a2));
    var _sqlite3session_enable = (Module["_sqlite3session_enable"] = (
        a0,
        a1
    ) =>
        (_sqlite3session_enable = Module["_sqlite3session_enable"] =
            wasmExports["sqlite3session_enable"])(a0, a1));
    var _sqlite3session_indirect = (Module["_sqlite3session_indirect"] = (
        a0,
        a1
    ) =>
        (_sqlite3session_indirect = Module["_sqlite3session_indirect"] =
            wasmExports["sqlite3session_indirect"])(a0, a1));
    var _sqlite3session_isempty = (Module["_sqlite3session_isempty"] = (
        a0
    ) =>
        (_sqlite3session_isempty = Module["_sqlite3session_isempty"] =
            wasmExports["sqlite3session_isempty"])(a0));
    var _sqlite3session_memory_used = (Module[
        "_sqlite3session_memory_used"
    ] = (a0) =>
        (_sqlite3session_memory_used = Module[
            "_sqlite3session_memory_used"
        ] =
            wasmExports["sqlite3session_memory_used"])(a0));
    var _sqlite3session_object_config = (Module[
        "_sqlite3session_object_config"
    ] = (a0, a1, a2) =>
        (_sqlite3session_object_config = Module[
            "_sqlite3session_object_config"
        ] =
            wasmExports["sqlite3session_object_config"])(a0, a1, a2));
    var _sqlite3session_changeset_size = (Module[
        "_sqlite3session_changeset_size"
    ] = (a0) =>
        (_sqlite3session_changeset_size = Module[
            "_sqlite3session_changeset_size"
        ] =
            wasmExports["sqlite3session_changeset_size"])(a0));

    var _sqlite3changeset_start = (Module["_sqlite3changeset_start"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3changeset_start = Module["_sqlite3changeset_start"] =
            wasmExports["sqlite3changeset_start"])(a0, a1, a2));
    var _sqlite3changeset_start_v2 = (Module["_sqlite3changeset_start_v2"] =
        (a0, a1, a2, a3) =>
            (_sqlite3changeset_start_v2 = Module[
                "_sqlite3changeset_start_v2"
            ] =
                wasmExports["sqlite3changeset_start_v2"])(a0, a1, a2, a3));
    var _sqlite3changeset_start_strm = (Module[
        "_sqlite3changeset_start_strm"
    ] = (a0, a1, a2) =>
        (_sqlite3changeset_start_strm = Module[
            "_sqlite3changeset_start_strm"
        ] =
            wasmExports["sqlite3changeset_start_strm"])(a0, a1, a2));
    var _sqlite3changeset_start_v2_strm = (Module[
        "_sqlite3changeset_start_v2_strm"
    ] = (a0, a1, a2, a3) =>
        (_sqlite3changeset_start_v2_strm = Module[
            "_sqlite3changeset_start_v2_strm"
        ] =
            wasmExports["sqlite3changeset_start_v2_strm"])(a0, a1, a2, a3));
    var _sqlite3changeset_next = (Module["_sqlite3changeset_next"] = (a0) =>
        (_sqlite3changeset_next = Module["_sqlite3changeset_next"] =
            wasmExports["sqlite3changeset_next"])(a0));
    var _sqlite3changeset_op = (Module["_sqlite3changeset_op"] = (
        a0,
        a1,
        a2,
        a3,
        a4
    ) =>
        (_sqlite3changeset_op = Module["_sqlite3changeset_op"] =
            wasmExports["sqlite3changeset_op"])(a0, a1, a2, a3, a4));
    var _sqlite3changeset_pk = (Module["_sqlite3changeset_pk"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3changeset_pk = Module["_sqlite3changeset_pk"] =
            wasmExports["sqlite3changeset_pk"])(a0, a1, a2));
    var _sqlite3changeset_old = (Module["_sqlite3changeset_old"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3changeset_old = Module["_sqlite3changeset_old"] =
            wasmExports["sqlite3changeset_old"])(a0, a1, a2));
    var _sqlite3changeset_new = (Module["_sqlite3changeset_new"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3changeset_new = Module["_sqlite3changeset_new"] =
            wasmExports["sqlite3changeset_new"])(a0, a1, a2));
    var _sqlite3changeset_conflict = (Module["_sqlite3changeset_conflict"] =
        (a0, a1, a2) =>
            (_sqlite3changeset_conflict = Module[
                "_sqlite3changeset_conflict"
            ] =
                wasmExports["sqlite3changeset_conflict"])(a0, a1, a2));
    var _sqlite3changeset_fk_conflicts = (Module[
        "_sqlite3changeset_fk_conflicts"
    ] = (a0, a1) =>
        (_sqlite3changeset_fk_conflicts = Module[
            "_sqlite3changeset_fk_conflicts"
        ] =
            wasmExports["sqlite3changeset_fk_conflicts"])(a0, a1));
    var _sqlite3changeset_finalize = (Module["_sqlite3changeset_finalize"] =
        (a0) =>
            (_sqlite3changeset_finalize = Module[
                "_sqlite3changeset_finalize"
            ] =
                wasmExports["sqlite3changeset_finalize"])(a0));
    var _sqlite3changeset_invert = (Module["_sqlite3changeset_invert"] = (
        a0,
        a1,
        a2,
        a3
    ) =>
        (_sqlite3changeset_invert = Module["_sqlite3changeset_invert"] =
            wasmExports["sqlite3changeset_invert"])(a0, a1, a2, a3));
    var _sqlite3changeset_invert_strm = (Module[
        "_sqlite3changeset_invert_strm"
    ] = (a0, a1, a2, a3) =>
        (_sqlite3changeset_invert_strm = Module[
            "_sqlite3changeset_invert_strm"
        ] =
            wasmExports["sqlite3changeset_invert_strm"])(a0, a1, a2, a3));
    var _sqlite3changeset_apply_v2 = (Module["_sqlite3changeset_apply_v2"] =
        (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
            (_sqlite3changeset_apply_v2 = Module[
                "_sqlite3changeset_apply_v2"
            ] =
                wasmExports["sqlite3changeset_apply_v2"])(
                a0,
                a1,
                a2,
                a3,
                a4,
                a5,
                a6,
                a7,
                a8
            ));
    var _sqlite3changeset_apply = (Module["_sqlite3changeset_apply"] = (
        a0,
        a1,
        a2,
        a3,
        a4,
        a5
    ) =>
        (_sqlite3changeset_apply = Module["_sqlite3changeset_apply"] =
            wasmExports["sqlite3changeset_apply"])(a0, a1, a2, a3, a4, a5));
    var _sqlite3changeset_apply_v2_strm = (Module[
        "_sqlite3changeset_apply_v2_strm"
    ] = (a0, a1, a2, a3, a4, a5, a6, a7, a8) =>
        (_sqlite3changeset_apply_v2_strm = Module[
            "_sqlite3changeset_apply_v2_strm"
        ] =
            wasmExports["sqlite3changeset_apply_v2_strm"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5,
            a6,
            a7,
            a8
        ));
    var _sqlite3changeset_apply_strm = (Module[
        "_sqlite3changeset_apply_strm"
    ] = (a0, a1, a2, a3, a4, a5) =>
        (_sqlite3changeset_apply_strm = Module[
            "_sqlite3changeset_apply_strm"
        ] =
            wasmExports["sqlite3changeset_apply_strm"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ));
    var _sqlite3changegroup_new = (Module["_sqlite3changegroup_new"] = (
        a0
    ) =>
        (_sqlite3changegroup_new = Module["_sqlite3changegroup_new"] =
            wasmExports["sqlite3changegroup_new"])(a0));
    var _sqlite3changegroup_add = (Module["_sqlite3changegroup_add"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3changegroup_add = Module["_sqlite3changegroup_add"] =
            wasmExports["sqlite3changegroup_add"])(a0, a1, a2));
    var _sqlite3changegroup_output = (Module["_sqlite3changegroup_output"] =
        (a0, a1, a2) =>
            (_sqlite3changegroup_output = Module[
                "_sqlite3changegroup_output"
            ] =
                wasmExports["sqlite3changegroup_output"])(a0, a1, a2));
    var _sqlite3changegroup_add_strm = (Module[
        "_sqlite3changegroup_add_strm"
    ] = (a0, a1, a2) =>
        (_sqlite3changegroup_add_strm = Module[
            "_sqlite3changegroup_add_strm"
        ] =
            wasmExports["sqlite3changegroup_add_strm"])(a0, a1, a2));
    var _sqlite3changegroup_output_strm = (Module[
        "_sqlite3changegroup_output_strm"
    ] = (a0, a1, a2) =>
        (_sqlite3changegroup_output_strm = Module[
            "_sqlite3changegroup_output_strm"
        ] =
            wasmExports["sqlite3changegroup_output_strm"])(a0, a1, a2));
    var _sqlite3changegroup_delete = (Module["_sqlite3changegroup_delete"] =
        (a0) =>
            (_sqlite3changegroup_delete = Module[
                "_sqlite3changegroup_delete"
            ] =
                wasmExports["sqlite3changegroup_delete"])(a0));
    var _sqlite3changeset_concat = (Module["_sqlite3changeset_concat"] = (
        a0,
        a1,
        a2,
        a3,
        a4,
        a5
    ) =>
        (_sqlite3changeset_concat = Module["_sqlite3changeset_concat"] =
            wasmExports["sqlite3changeset_concat"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ));
    var _sqlite3changeset_concat_strm = (Module[
        "_sqlite3changeset_concat_strm"
    ] = (a0, a1, a2, a3, a4, a5) =>
        (_sqlite3changeset_concat_strm = Module[
            "_sqlite3changeset_concat_strm"
        ] =
            wasmExports["sqlite3changeset_concat_strm"])(
            a0,
            a1,
            a2,
            a3,
            a4,
            a5
        ));
    var _sqlite3session_config = (Module["_sqlite3session_config"] = (
        a0,
        a1
    ) =>
        (_sqlite3session_config = Module["_sqlite3session_config"] =
            wasmExports["sqlite3session_config"])(a0, a1));
    var _sqlite3_sourceid = (Module["_sqlite3_sourceid"] = () =>
        (_sqlite3_sourceid = Module["_sqlite3_sourceid"] =
            wasmExports["sqlite3_sourceid"])());
    var _sqlite3__wasm_pstack_ptr = (Module["_sqlite3__wasm_pstack_ptr"] =
        () =>
            (_sqlite3__wasm_pstack_ptr = Module[
                "_sqlite3__wasm_pstack_ptr"
            ] =
                wasmExports["sqlite3__wasm_pstack_ptr"])());
    var _sqlite3__wasm_pstack_restore = (Module[
        "_sqlite3__wasm_pstack_restore"
    ] = (a0) =>
        (_sqlite3__wasm_pstack_restore = Module[
            "_sqlite3__wasm_pstack_restore"
        ] =
            wasmExports["sqlite3__wasm_pstack_restore"])(a0));
    var _sqlite3__wasm_pstack_alloc = (Module[
        "_sqlite3__wasm_pstack_alloc"
    ] = (a0) =>
        (_sqlite3__wasm_pstack_alloc = Module[
            "_sqlite3__wasm_pstack_alloc"
        ] =
            wasmExports["sqlite3__wasm_pstack_alloc"])(a0));
    var _sqlite3__wasm_pstack_remaining = (Module[
        "_sqlite3__wasm_pstack_remaining"
    ] = () =>
        (_sqlite3__wasm_pstack_remaining = Module[
            "_sqlite3__wasm_pstack_remaining"
        ] =
            wasmExports["sqlite3__wasm_pstack_remaining"])());
    var _sqlite3__wasm_pstack_quota = (Module[
        "_sqlite3__wasm_pstack_quota"
    ] = () =>
        (_sqlite3__wasm_pstack_quota = Module[
            "_sqlite3__wasm_pstack_quota"
        ] =
            wasmExports["sqlite3__wasm_pstack_quota"])());
    var _sqlite3__wasm_db_error = (Module["_sqlite3__wasm_db_error"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3__wasm_db_error = Module["_sqlite3__wasm_db_error"] =
            wasmExports["sqlite3__wasm_db_error"])(a0, a1, a2));
    var _sqlite3__wasm_test_struct = (Module["_sqlite3__wasm_test_struct"] =
        (a0) =>
            (_sqlite3__wasm_test_struct = Module[
                "_sqlite3__wasm_test_struct"
            ] =
                wasmExports["sqlite3__wasm_test_struct"])(a0));
    var _sqlite3__wasm_enum_json = (Module["_sqlite3__wasm_enum_json"] =
        () =>
            (_sqlite3__wasm_enum_json = Module["_sqlite3__wasm_enum_json"] =
                wasmExports["sqlite3__wasm_enum_json"])());
    var _sqlite3__wasm_vfs_unlink = (Module["_sqlite3__wasm_vfs_unlink"] = (
        a0,
        a1
    ) =>
        (_sqlite3__wasm_vfs_unlink = Module["_sqlite3__wasm_vfs_unlink"] =
            wasmExports["sqlite3__wasm_vfs_unlink"])(a0, a1));
    var _sqlite3__wasm_db_vfs = (Module["_sqlite3__wasm_db_vfs"] = (
        a0,
        a1
    ) =>
        (_sqlite3__wasm_db_vfs = Module["_sqlite3__wasm_db_vfs"] =
            wasmExports["sqlite3__wasm_db_vfs"])(a0, a1));
    var _sqlite3__wasm_db_reset = (Module["_sqlite3__wasm_db_reset"] = (
        a0
    ) =>
        (_sqlite3__wasm_db_reset = Module["_sqlite3__wasm_db_reset"] =
            wasmExports["sqlite3__wasm_db_reset"])(a0));
    var _sqlite3__wasm_db_export_chunked = (Module[
        "_sqlite3__wasm_db_export_chunked"
    ] = (a0, a1) =>
        (_sqlite3__wasm_db_export_chunked = Module[
            "_sqlite3__wasm_db_export_chunked"
        ] =
            wasmExports["sqlite3__wasm_db_export_chunked"])(a0, a1));
    var _sqlite3__wasm_db_serialize = (Module[
        "_sqlite3__wasm_db_serialize"
    ] = (a0, a1, a2, a3, a4) =>
        (_sqlite3__wasm_db_serialize = Module[
            "_sqlite3__wasm_db_serialize"
        ] =
            wasmExports["sqlite3__wasm_db_serialize"])(a0, a1, a2, a3, a4));
    var _sqlite3__wasm_vfs_create_file = (Module[
        "_sqlite3__wasm_vfs_create_file"
    ] = (a0, a1, a2, a3) =>
        (_sqlite3__wasm_vfs_create_file = Module[
            "_sqlite3__wasm_vfs_create_file"
        ] =
            wasmExports["sqlite3__wasm_vfs_create_file"])(a0, a1, a2, a3));
    var _sqlite3__wasm_posix_create_file = (Module[
        "_sqlite3__wasm_posix_create_file"
    ] = (a0, a1, a2) =>
        (_sqlite3__wasm_posix_create_file = Module[
            "_sqlite3__wasm_posix_create_file"
        ] =
            wasmExports["sqlite3__wasm_posix_create_file"])(a0, a1, a2));
    var _sqlite3__wasm_kvvfsMakeKeyOnPstack = (Module[
        "_sqlite3__wasm_kvvfsMakeKeyOnPstack"
    ] = (a0, a1) =>
        (_sqlite3__wasm_kvvfsMakeKeyOnPstack = Module[
            "_sqlite3__wasm_kvvfsMakeKeyOnPstack"
        ] =
            wasmExports["sqlite3__wasm_kvvfsMakeKeyOnPstack"])(a0, a1));
    var _sqlite3__wasm_kvvfs_methods = (Module[
        "_sqlite3__wasm_kvvfs_methods"
    ] = () =>
        (_sqlite3__wasm_kvvfs_methods = Module[
            "_sqlite3__wasm_kvvfs_methods"
        ] =
            wasmExports["sqlite3__wasm_kvvfs_methods"])());
    var _sqlite3__wasm_vtab_config = (Module["_sqlite3__wasm_vtab_config"] =
        (a0, a1, a2) =>
            (_sqlite3__wasm_vtab_config = Module[
                "_sqlite3__wasm_vtab_config"
            ] =
                wasmExports["sqlite3__wasm_vtab_config"])(a0, a1, a2));
    var _sqlite3__wasm_db_config_ip = (Module[
        "_sqlite3__wasm_db_config_ip"
    ] = (a0, a1, a2, a3) =>
        (_sqlite3__wasm_db_config_ip = Module[
            "_sqlite3__wasm_db_config_ip"
        ] =
            wasmExports["sqlite3__wasm_db_config_ip"])(a0, a1, a2, a3));
    var _sqlite3__wasm_db_config_pii = (Module[
        "_sqlite3__wasm_db_config_pii"
    ] = (a0, a1, a2, a3, a4) =>
        (_sqlite3__wasm_db_config_pii = Module[
            "_sqlite3__wasm_db_config_pii"
        ] =
            wasmExports["sqlite3__wasm_db_config_pii"])(
            a0,
            a1,
            a2,
            a3,
            a4
        ));
    var _sqlite3__wasm_db_config_s = (Module["_sqlite3__wasm_db_config_s"] =
        (a0, a1, a2) =>
            (_sqlite3__wasm_db_config_s = Module[
                "_sqlite3__wasm_db_config_s"
            ] =
                wasmExports["sqlite3__wasm_db_config_s"])(a0, a1, a2));
    var _sqlite3__wasm_config_i = (Module["_sqlite3__wasm_config_i"] = (
        a0,
        a1
    ) =>
        (_sqlite3__wasm_config_i = Module["_sqlite3__wasm_config_i"] =
            wasmExports["sqlite3__wasm_config_i"])(a0, a1));
    var _sqlite3__wasm_config_ii = (Module["_sqlite3__wasm_config_ii"] = (
        a0,
        a1,
        a2
    ) =>
        (_sqlite3__wasm_config_ii = Module["_sqlite3__wasm_config_ii"] =
            wasmExports["sqlite3__wasm_config_ii"])(a0, a1, a2));
    var _sqlite3__wasm_config_j = (Module["_sqlite3__wasm_config_j"] = (
        a0,
        a1
    ) =>
        (_sqlite3__wasm_config_j = Module["_sqlite3__wasm_config_j"] =
            wasmExports["sqlite3__wasm_config_j"])(a0, a1));
    var _sqlite3__wasm_qfmt_token = (Module["_sqlite3__wasm_qfmt_token"] = (
        a0,
        a1
    ) =>
        (_sqlite3__wasm_qfmt_token = Module["_sqlite3__wasm_qfmt_token"] =
            wasmExports["sqlite3__wasm_qfmt_token"])(a0, a1));
    var _sqlite3__wasm_init_wasmfs = (Module["_sqlite3__wasm_init_wasmfs"] =
        (a0) =>
            (_sqlite3__wasm_init_wasmfs = Module[
                "_sqlite3__wasm_init_wasmfs"
            ] =
                wasmExports["sqlite3__wasm_init_wasmfs"])(a0));
    var _sqlite3__wasm_test_intptr = (Module["_sqlite3__wasm_test_intptr"] =
        (a0) =>
            (_sqlite3__wasm_test_intptr = Module[
                "_sqlite3__wasm_test_intptr"
            ] =
                wasmExports["sqlite3__wasm_test_intptr"])(a0));
    var _sqlite3__wasm_test_voidptr = (Module[
        "_sqlite3__wasm_test_voidptr"
    ] = (a0) =>
        (_sqlite3__wasm_test_voidptr = Module[
            "_sqlite3__wasm_test_voidptr"
        ] =
            wasmExports["sqlite3__wasm_test_voidptr"])(a0));
    var _sqlite3__wasm_test_int64_max = (Module[
        "_sqlite3__wasm_test_int64_max"
    ] = () =>
        (_sqlite3__wasm_test_int64_max = Module[
            "_sqlite3__wasm_test_int64_max"
        ] =
            wasmExports["sqlite3__wasm_test_int64_max"])());
    var _sqlite3__wasm_test_int64_min = (Module[
        "_sqlite3__wasm_test_int64_min"
    ] = () =>
        (_sqlite3__wasm_test_int64_min = Module[
            "_sqlite3__wasm_test_int64_min"
        ] =
            wasmExports["sqlite3__wasm_test_int64_min"])());
    var _sqlite3__wasm_test_int64_times2 = (Module[
        "_sqlite3__wasm_test_int64_times2"
    ] = (a0) =>
        (_sqlite3__wasm_test_int64_times2 = Module[
            "_sqlite3__wasm_test_int64_times2"
        ] =
            wasmExports["sqlite3__wasm_test_int64_times2"])(a0));
    var _sqlite3__wasm_test_int64_minmax = (Module[
        "_sqlite3__wasm_test_int64_minmax"
    ] = (a0, a1) =>
        (_sqlite3__wasm_test_int64_minmax = Module[
            "_sqlite3__wasm_test_int64_minmax"
        ] =
            wasmExports["sqlite3__wasm_test_int64_minmax"])(a0, a1));
    var _sqlite3__wasm_test_int64ptr = (Module[
        "_sqlite3__wasm_test_int64ptr"
    ] = (a0) =>
        (_sqlite3__wasm_test_int64ptr = Module[
            "_sqlite3__wasm_test_int64ptr"
        ] =
            wasmExports["sqlite3__wasm_test_int64ptr"])(a0));
    var _sqlite3__wasm_test_stack_overflow = (Module[
        "_sqlite3__wasm_test_stack_overflow"
    ] = (a0) =>
        (_sqlite3__wasm_test_stack_overflow = Module[
            "_sqlite3__wasm_test_stack_overflow"
        ] =
            wasmExports["sqlite3__wasm_test_stack_overflow"])(a0));
    var _sqlite3__wasm_test_str_hello = (Module[
        "_sqlite3__wasm_test_str_hello"
    ] = (a0) =>
        (_sqlite3__wasm_test_str_hello = Module[
            "_sqlite3__wasm_test_str_hello"
        ] =
            wasmExports["sqlite3__wasm_test_str_hello"])(a0));
    var _sqlite3__wasm_SQLTester_strglob = (Module[
        "_sqlite3__wasm_SQLTester_strglob"
    ] = (a0, a1) =>
        (_sqlite3__wasm_SQLTester_strglob = Module[
            "_sqlite3__wasm_SQLTester_strglob"
        ] =
            wasmExports["sqlite3__wasm_SQLTester_strglob"])(a0, a1));
    var _malloc = (Module["_malloc"] = (a0) =>
        (_malloc = Module["_malloc"] = wasmExports["malloc"])(a0));
    var _free = (Module["_free"] = (a0) =>
        (_free = Module["_free"] = wasmExports["free"])(a0));
    var _realloc = (Module["_realloc"] = (a0, a1) =>
        (_realloc = Module["_realloc"] = wasmExports["realloc"])(a0, a1));
    var _emscripten_builtin_memalign = (Module["_emscripten_builtin_memalign"] = (
        a0,
        a1
    ) =>
        (_emscripten_builtin_memalign = Module["_emscripten_builtin_memalign"] =
            wasmExports["emscripten_builtin_memalign"])(a0, a1));
    var __emscripten_stack_restore = (a0) =>
        (__emscripten_stack_restore =
            wasmExports["_emscripten_stack_restore"])(a0);
    var __emscripten_stack_alloc = (a0) =>
        (__emscripten_stack_alloc = wasmExports["_emscripten_stack_alloc"])(
            a0
        );
    var _emscripten_stack_get_current = () =>
        (_emscripten_stack_get_current =
            wasmExports["emscripten_stack_get_current"])();
    return {
        emscriptenBuiltinMemalign: _emscripten_builtin_memalign,
    };
};
