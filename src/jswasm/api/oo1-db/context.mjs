/**
 * @fileoverview Shared context factory for the OO1 database API helpers.
 */

/**
 * Creates the shared context passed around the refactored helpers.
 *
 * @param {import("@wuchuheng/web-sqlite").SQLite3API} sqlite3
 *        The runtime API object.
 * @returns {import("./context.d.ts").Oo1Context}
 *        Context with frequently accessed helpers.
 */
export function createOo1Context(sqlite3) {
    const { capi, wasm, util } = sqlite3;
    const ptrMap = new WeakMap();
    const stmtMap = new WeakMap();
    const vfsCallbacks = Object.create(null);

    const toss = (...args) => {
        throw new sqlite3.SQLite3Error(...args);
    };

    const checkRc = (dbOrPtr, resultCode) => {
        if (!resultCode) return dbOrPtr;
        let dbPointer = dbOrPtr;
        if (dbPointer && typeof dbPointer === "object") {
            dbPointer = ptrMap.get(dbPointer) ?? dbPointer.pointer ?? dbPointer;
        }
        const message = dbPointer
            ? capi.sqlite3_errmsg(dbPointer)
            : capi.sqlite3_errstr(resultCode);
        toss(resultCode, "sqlite3 result code", `${resultCode}:`, message);
        return dbOrPtr;
    };

    return {
        sqlite3,
        capi,
        wasm,
        util,
        ptrMap,
        stmtMap,
        vfsCallbacks,
        toss,
        checkRc,
    };
}
