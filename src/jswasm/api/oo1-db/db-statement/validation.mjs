/**
 * @fileoverview Validation and resolution helpers for Database and Statement operations.
 */

/**
 * Creates validation and resolver utilities for DB/Statement operations.
 *
 * @param {object} context - Shared runtime context.
 * @returns {object} Validation helper functions.
 */
export function createValidationHelpers(context) {
    const { capi, util, ptrMap, toss } = context;

    /**
     * Retrieves the native pointer for a DB or Statement instance.
     *
     * @param {object} target - Database or Statement instance.
     * @returns {number|undefined} Native pointer.
     */
    const pointerOf = (target) => ptrMap.get(target);

    /**
     * Ensures a database handle is open.
     *
     * @param {object} db - Database instance.
     * @returns {object} The same database instance.
     */
    const ensureDbOpen = (db) => {
        if (!pointerOf(db)) toss("DB has been closed.");
        return db;
    };

    /**
     * Ensures a statement handle is open.
     *
     * @param {object} stmt - Statement instance.
     * @returns {object} The same statement instance.
     */
    const ensureStmtOpen = (stmt) => {
        if (!pointerOf(stmt)) toss("Stmt has been closed.");
        return stmt;
    };

    /**
     * Ensures a statement is not locked by exec().
     *
     * @param {object} stmt - Statement instance.
     * @param {string} operation - Name of the operation being attempted.
     * @returns {object} The same statement instance.
     */
    const ensureNotLockedByExec = (stmt, operation) => {
        if (stmt._lockedByExec) {
            toss("Operation is illegal when statement is locked:", operation);
        }
        return stmt;
    };

    /**
     * Resolves and validates a column index.
     *
     * @param {object} stmt - Statement instance.
     * @param {number} index - Zero-based column index.
     * @returns {number} Validated column index.
     */
    const resolveColumnIndex = (stmt, index) => {
        if (index !== (index | 0) || index < 0 || index >= stmt.columnCount) {
            toss("Column index", index, "is out of range.");
        }
        return index;
    };

    /**
     * Resolves a parameter name or index to a 1-based bind index.
     *
     * @param {object} stmt - Statement instance.
     * @param {number|string} key - Parameter index or name.
     * @returns {number} Resolved 1-based parameter index.
     */
    const resolveParameterIndex = (stmt, key) => {
        const pointer = pointerOf(ensureStmtOpen(stmt));
        const index =
            typeof key === "number"
                ? key
                : capi.sqlite3_bind_parameter_index(pointer, key);
        if (!index || !util.isInt32(index)) {
            toss("Invalid bind() parameter name:", key);
        }
        if (index < 1 || index > stmt.parameterCount) {
            toss("Bind index", key, "is out of range.");
        }
        return index;
    };

    return {
        pointerOf,
        ensureDbOpen,
        ensureStmtOpen,
        ensureNotLockedByExec,
        resolveColumnIndex,
        resolveParameterIndex,
    };
}
