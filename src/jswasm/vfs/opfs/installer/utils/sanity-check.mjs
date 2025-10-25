/**
 * Runs sanity checks on OPFS VFS implementation.
 * @param {import('./sanity-check.d.ts').SanityCheckDeps} deps - Dependencies object
 */
export function runSanityCheck(deps) {
    const {
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
    } = deps;
    const { sqlite3_file } = capi;

    // 1. Input handling
    const scope = wasm.scopedAllocPush();
    const sq3File = new sqlite3_file();

    try {
        // 2. Core processing
        const fid = sq3File.pointer;
        const openFlags =
            capi.SQLITE_OPEN_CREATE |
            capi.SQLITE_OPEN_READWRITE |
            capi.SQLITE_OPEN_MAIN_DB;
        const pOut = wasm.scopedAlloc(8);
        const dbFile = "/sanity/check/file" + randomFilename(8);
        const zDbFile = wasm.scopedAllocCString(dbFile);
        let rc;

        // 2.1 Test serialization
        state.s11n.serialize("This is ä string.");
        rc = state.s11n.deserialize();
        log("deserialize() says:", rc);
        if ("This is ä string." !== rc[0]) toss("String d13n error.");

        // 2.2 Test xAccess (file doesn't exist)
        vfsSyncWrappers.xAccess(opfsVfs.pointer, zDbFile, 0, pOut);
        rc = wasm.peek(pOut, "i32");
        log("xAccess(", dbFile, ") exists ?=", rc);

        // 2.3 Test xOpen
        rc = vfsSyncWrappers.xOpen(
            opfsVfs.pointer,
            zDbFile,
            fid,
            openFlags,
            pOut,
        );
        log(
            "open rc =",
            rc,
            "state.sabOPView[xOpen] =",
            state.sabOPView[state.opIds.xOpen],
        );
        if (0 !== rc) {
            error("open failed with code", rc);
            return;
        }

        // 2.4 Test xAccess (file exists)
        vfsSyncWrappers.xAccess(opfsVfs.pointer, zDbFile, 0, pOut);
        rc = wasm.peek(pOut, "i32");
        if (!rc) toss("xAccess() failed to detect file.");

        // 2.5 Test xSync
        rc = ioSyncWrappers.xSync(sq3File.pointer, 0);
        if (rc) toss("sync failed w/ rc", rc);

        // 2.6 Test xTruncate
        rc = ioSyncWrappers.xTruncate(sq3File.pointer, 1024);
        if (rc) toss("truncate failed w/ rc", rc);

        // 2.7 Test xFileSize
        wasm.poke(pOut, 0, "i64");
        rc = ioSyncWrappers.xFileSize(sq3File.pointer, pOut);
        if (rc) toss("xFileSize failed w/ rc", rc);
        log("xFileSize says:", wasm.peek(pOut, "i64"));

        // 2.8 Test xWrite
        rc = ioSyncWrappers.xWrite(sq3File.pointer, zDbFile, 10, 1);
        if (rc) toss("xWrite() failed!");

        // 2.9 Test xRead
        const readBuf = wasm.scopedAlloc(16);
        rc = ioSyncWrappers.xRead(sq3File.pointer, readBuf, 6, 2);
        wasm.poke(readBuf + 6, 0);
        const jRead = wasm.cstrToJs(readBuf);
        log("xRead() got:", jRead);
        if ("sanity" !== jRead) toss("Unexpected xRead() value.");

        // 2.10 Test xSleep (if available)
        if (vfsSyncWrappers.xSleep) {
            log("xSleep()ing before close()ing...");
            vfsSyncWrappers.xSleep(opfsVfs.pointer, 2000);
            log("waking up from xSleep()");
        }

        // 2.11 Test xClose
        rc = ioSyncWrappers.xClose(fid);
        log("xClose rc =", rc, "sabOPView =", state.sabOPView);

        // 2.12 Test xDelete
        log("Deleting file:", dbFile);
        vfsSyncWrappers.xDelete(opfsVfs.pointer, zDbFile, 0x1234);
        vfsSyncWrappers.xAccess(opfsVfs.pointer, zDbFile, 0, pOut);
        rc = wasm.peek(pOut, "i32");
        if (rc) toss("Expecting 0 from xAccess(", dbFile, ") after xDelete().");

        warn("End of OPFS sanity checks.");
    } finally {
        // 3. Output handling
        sq3File.dispose();
        wasm.scopedAllocPop(scope);
    }
}
