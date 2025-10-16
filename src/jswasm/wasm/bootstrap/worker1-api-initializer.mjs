/**
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3Facade} Sqlite3Facade
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3Initializer} Sqlite3Initializer
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerRuntimeState} WorkerRuntimeState
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3WorkerMessage} Sqlite3WorkerMessage
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3DatabaseHandle} Sqlite3DatabaseHandle
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerOpenResponse} WorkerOpenResponse
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerCloseResponse} WorkerCloseResponse
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerExecResult} WorkerExecResult
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerConfigResponse} WorkerConfigResponse
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerExtensionResponse} WorkerExtensionResponse
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3StatusObject} Sqlite3StatusObject
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3ConfigSnapshot} Sqlite3ConfigSnapshot
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3WorkerExecOptions} Sqlite3WorkerExecOptions
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3WorkerResponse} Sqlite3WorkerResponse
 * @typedef {import("../sqlite3Apibootstrap.d.ts").Sqlite3WasmCallResult} Sqlite3WasmCallResult
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerOpenRequest} WorkerOpenRequest
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerCloseRequest} WorkerCloseRequest
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerFunctionRequest} WorkerFunctionRequest
 * @typedef {import("../sqlite3Apibootstrap.d.ts").WorkerXCallRequest} WorkerXCallRequest
 */

/**
 * Provides a factory for the default worker API initializer. The initializer
 * wires the legacy Worker-based RPC helpers onto the sqlite3 instance during
 * bootstrap so host applications can opt into the structured messaging API.
 *
 * @returns {Sqlite3Initializer}
 *          Bootstrap initializer that installs the worker helpers on the
 *          supplied sqlite3 facade.
 */
export function createWorker1ApiInitializer() {
    /**
     * Binds the Worker1 API helpers to the supplied sqlite3 facade.
     *
     * @param {Sqlite3Facade} sqlite3
     *        The sqlite3 API object exposed to consumers during bootstrap.
     */
    return function initializeWorker1Api(sqlite3) {
        sqlite3.initWorker1API = function initWorker1API() {
            const toss = (...args) => {
                throw new Error(args.join(" "));
            };
            if (!(globalThis.WorkerGlobalScope instanceof Function)) {
                toss("initWorker1API() must be run from a Worker thread.");
            }
            const sqlite3Instance = this.sqlite3 || toss("Missing this.sqlite3 object.");
            const runtime = new Worker1Runtime(sqlite3Instance, toss);
            runtime.install();
        }.bind({ sqlite3 });
    };
}

/**
 * Coordinates the worker message handlers, state tracking, and response
 * plumbing for the Worker1 API.
 */
class Worker1Runtime {
    /**
     * @param {Sqlite3Facade} sqlite3Instance
     *        sqlite3 facade available within the worker context.
     * @param {(...args: string[]) => never} toss
     *        Error helper that mirrors the behaviour of the legacy bootstrap
     *        script.
     */
    constructor(sqlite3Instance, toss) {
        this.sqlite3 = sqlite3Instance;
        this.toss = toss;
        this.util = sqlite3Instance.util;
        this.DB = sqlite3Instance.oo1.DB;
        this.handlers = Object.create(null);
        /** @type {WorkerRuntimeState} */
        this.state = this.buildState();
        this.initializeHandlers();
        this.handleMessage = this.handleMessage.bind(this);
    }

    /**
     * Constructs the mutable state used by the worker RPC helpers.
     *
     * @returns {WorkerRuntimeState} Mutable structure storing open database
     *          references and transferable tracking.
     */
    buildState() {
        /** @type {WorkerRuntimeState} */
        const state = {
            dbList: [],
            idSeq: 0,
            idMap: new WeakMap(),
            xfer: [],
            dbs: Object.create(null),
        };
        this.state = state;
        /**
         * Opens a database connection within the worker.
         *
         * @param {WorkerOpenRequest} opt
         * @returns {Sqlite3DatabaseHandle}
         */
        state.open = (opt) => {
            const db = new this.DB(opt);
            state.dbs[this.getDbId(db)] = db;
            if (state.dbList.indexOf(db) < 0) state.dbList.push(db);
            return db;
        };
        /**
         * Closes a database handle and optionally unlinks the backing VFS entry.
         *
         * @param {Sqlite3DatabaseHandle | undefined} db
         * @param {boolean} [alsoUnlink]
         * @returns {void}
         */
        state.close = (db, alsoUnlink) => {
            if (!db) return;
            delete state.dbs[this.getDbId(db)];
            const filename = db.filename;
            const pVfs = this.util.sqlite3__wasm_db_vfs(db.pointer, 0);
            db.close();
            const ddNdx = state.dbList.indexOf(db);
            if (ddNdx >= 0) state.dbList.splice(ddNdx, 1);
            if (alsoUnlink && filename && pVfs) {
                this.util.sqlite3__wasm_vfs_unlink(pVfs, filename);
            }
        };
        /**
         * Posts a structured response back to the main thread.
         *
         * @param {Sqlite3WorkerResponse} msg
         * @param {Transferable[]} [xferList]
         * @returns {void}
         */
        state.post = (msg, xferList) => {
            if (xferList && xferList.length) {
                globalThis.postMessage(msg, Array.from(xferList));
                xferList.length = 0;
            } else {
                globalThis.postMessage(msg);
            }
        };
        /**
         * Retrieves a database handle by identifier, optionally enforcing presence.
         *
         * @param {string | undefined} id
         * @param {boolean} [require=true]
         * @returns {Sqlite3DatabaseHandle | undefined}
         */
        state.getDb = (id, require = true) =>
            state.dbs[id] || (require ? this.toss("Unknown (or closed) DB ID:", id) : undefined);
        return state;
    }

    /**
     * Derives (and memoizes) the identifier for the provided DB handle.
     *
     * @param {Sqlite3DatabaseHandle} db Database wrapper to identify.
     * @returns {string} Unique database identifier tied to the pointer value.
     */
    getDbId(db) {
        const { idMap } = this.state;
        let id = idMap.get(db);
        if (id) return id;
        id = `db#${++this.state.idSeq}@${db.pointer}`;
        idMap.set(db, id);
        return id;
    }

    /**
     * Ensures the provided database handle is valid, falling back to the first
     * opened database when none is supplied.
     *
     * @param {Sqlite3DatabaseHandle} [db]
     * @returns {Sqlite3DatabaseHandle}
     */
    affirmDbOpen(db = this.state.dbList[0]) {
        return db && db.pointer ? db : this.toss("DB is not opened.");
    }

    /**
     * Resolves the database associated with a worker message payload.
     *
     * @param {Sqlite3WorkerMessage} msgData
     * @param {boolean} [affirmExists=true]
     * @returns {Sqlite3DatabaseHandle|undefined}
     */
    getMessageDb(msgData, affirmExists = true) {
        const db = this.state.getDb(msgData.dbId, false) || this.state.dbList[0];
        return affirmExists ? this.affirmDbOpen(db) : db;
    }

    /**
     * Retrieves the identifier of the first open database, if present.
     *
     * @returns {string|undefined}
     */
    getDefaultDbId() {
        const firstDb = this.state.dbList[0];
        return firstDb ? this.getDbId(firstDb) : undefined;
    }

    /**
     * Registers the message handlers that power the worker RPC surface.
     */
    initializeHandlers() {
        this.handlers.open = (ev) => this.openDatabase(ev);
        this.handlers.close = (ev) => this.closeDatabase(ev);
        this.handlers.exec = (ev) => this.exec(ev);
        this.handlers.configGet = () => this.configGet();
        this.handlers.configSet = (ev) => this.configSet(ev);
        this.handlers.registerFunction = (ev) => this.registerFunction(ev);
        this.handlers.unregisterFunction = (ev) => this.unregisterFunction(ev);
        this.handlers.loadExtension = (ev) => this.loadExtension(ev);
        this.handlers.xCall = (ev) => this.xCall(ev);
    }

    /**
     * Handles the `open` worker message.
     *
     * @param {Sqlite3WorkerMessage & { args?: WorkerOpenRequest }} ev
     * @returns {WorkerOpenResponse}
     */
    openDatabase(ev) {
        const oargs = Object.create(null);
        const args = ev.args || Object.create(null);
        if (args.simulateError) {
            this.toss("Throwing because of simulateError flag.");
        }
        const rc = Object.create(null);
        oargs.vfs = args.vfs;
        oargs.filename = args.filename || "";
        const db = this.state.open(oargs);
        rc.filename = db.filename;
        rc.persistent = !!this.sqlite3.capi.sqlite3_js_db_uses_vfs(db.pointer, "opfs");
        rc.dbId = this.getDbId(db);
        rc.vfs = db.dbVfsName();
        return rc;
    }

    /**
     * Handles the `close` worker message.
     *
     * @param {Sqlite3WorkerMessage & { args?: WorkerCloseRequest }} ev
     * @returns {WorkerCloseResponse}
     */
    closeDatabase(ev) {
        const db = this.getMessageDb(ev, false);
        const response = {
            filename: db && db.filename,
        };
        if (db) {
            const doUnlink =
                ev.args && "object" === typeof ev.args ? !!ev.args.unlink : false;
            this.state.close(db, doUnlink);
        }
        return response;
    }

    /**
     * Executes SQL via the worker interface.
     *
     * @param {Sqlite3WorkerMessage & { args: string | Sqlite3WorkerExecOptions }} ev
     * @returns {WorkerExecResult}
     */
    exec(ev) {
        /** @type {Sqlite3WorkerExecOptions} */
        const rc =
            "string" === typeof ev.args ? { sql: ev.args } : ev.args || Object.create(null);
        if ("stmt" === rc.rowMode) {
            this.toss("Invalid rowMode for 'exec': stmt mode does not work in the Worker API.");
        } else if (!rc.sql) {
            this.toss("'exec' requires input SQL.");
        }
        const db = this.getMessageDb(ev);
        if (rc.callback || Array.isArray(rc.resultRows)) {
            db._blobXfer = this.state.xfer;
        }
        const theCallback = rc.callback;
        let rowNumber = 0;
        const hadColNames = !!rc.columnNames;
        if ("string" === typeof theCallback) {
            if (!hadColNames) rc.columnNames = [];
            rc.callback = (row) => {
                this.state.post(
                    {
                        type: theCallback,
                        columnNames: rc.columnNames,
                        rowNumber: ++rowNumber,
                        row: row,
                    },
                    this.state.xfer
                );
            };
        }
        try {
            const changeCount = rc.countChanges
                ? db.changes(true, 64 === rc.countChanges)
                : undefined;
            db.exec(rc);
            if (undefined !== changeCount) {
                rc.changeCount = db.changes(true, 64 === rc.countChanges) - changeCount;
            }
        } finally {
            if ("string" === typeof theCallback) {
                delete rc.callback;
                if (!hadColNames) delete rc.columnNames;
            }
            delete db._blobXfer;
        }
        if (!Array.isArray(rc.resultRows)) delete rc.resultRows;
        delete rc.callback;
        return rc;
    }

    /**
     * Handles `configGet` messages.
     *
     * @returns {Sqlite3ConfigSnapshot}
     */
    configGet() {
        return this.sqlite3.capi.sqlite3_wasm_config_get();
    }

    /**
     * Handles `configSet` messages.
     *
     * @param {Sqlite3WorkerMessage & { args: Record<string, number | string | boolean> }} ev
     * @returns {WorkerConfigResponse | Sqlite3StatusObject}
     */
    configSet(ev) {
        let rc;
        try {
            rc = this.sqlite3.capi.sqlite3_wasm_config_set(ev.args);
        } catch (e) {
            rc = this.sqlite3.SQLite3Error.toss(e).resultCode;
        }
        if (!rc) rc = { result: 0 };
        if (!rc.message) rc.message = this.sqlite3.capi.sqlite3_js_rc_str(rc.result);
        return rc;
    }

    /**
     * Registers a SQL function for the provided database or globally.
     *
     * @param {Sqlite3WorkerMessage & { args: WorkerFunctionRequest }} ev
     * @returns {number|Sqlite3StatusObject|Sqlite3DatabaseHandle}
     */
    registerFunction(ev) {
        const db = this.getMessageDb(ev, false);
        const rc = db
            ? db.createFunction(ev.args)
            : this.sqlite3.capi.sqlite3_create_function_v2(ev.args);
        return rc || 0;
    }

    /**
     * Unregisters a SQL function for the provided database or globally.
     *
     * @param {Sqlite3WorkerMessage & { args: WorkerFunctionRequest }} ev
     * @returns {number|Sqlite3StatusObject|Sqlite3DatabaseHandle}
     */
    unregisterFunction(ev) {
        const db = this.getMessageDb(ev, false);
        const rc = db
            ? db.createFunction(ev.args)
            : this.sqlite3.capi.sqlite3_create_function_v2(ev.args);
        return rc || 0;
    }

    /**
     * Handles `loadExtension` messages.
     *
     * @param {Sqlite3WorkerMessage & { args: { filename: string; entryPoint?: string } }} ev
     * @returns {WorkerExtensionResponse}
     */
    loadExtension(ev) {
        const db = this.getMessageDb(ev);
        db.loadExtension(ev.args.filename, ev.args.entryPoint);
        return { filename: ev.args.filename };
    }

    /**
     * Invokes exported WASM functions based on structured worker messages.
     *
     * @param {Sqlite3WorkerMessage & WorkerXCallRequest} ev
     * @returns {Sqlite3WasmCallResult|Sqlite3WasmCallResult[]}
     */
    xCall(ev) {
        const ptrsize = this.sqlite3.wasm.ptrSizeof;
        const ptrN = ptrsize / 4;
        const cvt = this.sqlite3.wasm.xWrap.convertArg;
        const result = this.sqlite3.wasm.xWrap.convertResult;
        if ("string" !== typeof ev.fn) {
            this.toss("Invalid message: missing function name.");
        }
        if (!Array.isArray(ev.args)) {
            this.toss("Invalid message: missing args array.");
        }
        const f = this.sqlite3.wasm.exports[ev.fn];
        if (!(f instanceof Function)) {
            this.toss("Unknown exported function:", ev.fn);
        }
        const xArg = [];
        const pstack = this.sqlite3.wasm.pstack;
        const stack = pstack.pointer;
        try {
            if (ev.converters) {
                if (ev.converters.args) {
                    if (!Array.isArray(ev.converters.args)) {
                        this.toss("Invalid message: converters.args must be an array.");
                    }
                    if (ev.converters.args.length !== ev.args.length) {
                        this.toss("Invalid message: converters.args length must match args length.");
                    }
                    for (let i = 0; i < ev.args.length; ++i) {
                        const c = ev.converters.args[i];
                        if (!c) xArg[i] = ev.args[i];
                        else if (true === c) xArg[i] = cvt(ev.args[i]);
                        else if ("string" === typeof c) xArg[i] = cvt(ev.args[i], c);
                        else if (Array.isArray(c)) xArg[i] = cvt(ev.args[i], ...c);
                        else {
                            this.toss(
                                "Invalid message: converters.args entries",
                                "must be truthy or array",
                                "or true"
                            );
                        }
                    }
                }
                if (ev.converters.result) {
                    const c = ev.converters.result;
                    if (true === c) {
                        ev.converters.result = "i32";
                    } else if (!Array.isArray(c)) {
                        this.toss("Invalid message: converters.result must be an array.");
                    }
                }
            }
            let rc;
            if (ev.xCall === "flex") {
                if (!Array.isArray(ev.flexResult)) {
                    this.toss("Invalid message: xCall='flex' requires flexResult array");
                }
                const callRc = this.sqlite3.wasm.xCall.flex(ev.fn, ev.flexResult, ...ev.args);
                rc = Array.isArray(callRc) ? callRc.slice() : callRc;
                if (Array.isArray(rc) && rc.length === 2) {
                    rc[1] = this.util.typedArrayToArray(rc[1]);
                }
            } else if (ev.xCall === "wrapped") {
                rc = this.sqlite3.wasm.xWrap(ev.fn, ev.resultType, ev.argTypes)(...ev.args);
            } else {
                rc = f(...ev.args);
                if (ev.converters && ev.converters.result) {
                    rc = result(rc, ...ev.converters.result);
                    if (rc && this.sqlite3.wasm.isPtr(rc)) {
                        const getTypedArray = (bytes) => {
                            const heap = this.sqlite3.wasm.heapForSize(bytes);
                            return this.util.typedArrayPart(
                                heap,
                                rc / heap.BYTES_PER_ELEMENT,
                                rc / heap.BYTES_PER_ELEMENT + ev.resultSize
                            );
                        };
                        if (ev.resultSize > 0) {
                            rc = getTypedArray(ev.resultSize).slice();
                        }
                        if (ev.resultType && ev.resultType.endsWith("*") && ev.resultSize) {
                            const heap = this.sqlite3.wasm.heapForSize(ptrsize);
                            const resultPtr = this.util.typedArrayPart(
                                heap,
                                rc / heap.BYTES_PER_ELEMENT,
                                rc / heap.BYTES_PER_ELEMENT + ptrN
                            );
                            rc = [];
                            for (let i = 0; i < ptrN; ++i) {
                                rc.push(resultPtr[i]);
                            }
                        }
                    }
                }
            }
            return rc;
        } finally {
            pstack.restore(stack);
        }
    }

    /**
     * Dispatches worker `message` events to the registered handlers.
     *
     * @param {MessageEvent & { data: Sqlite3WorkerMessage }} ev
     */
    handleMessage(ev) {
        const arrivalTime = performance.now();
        const wMsg = ev.data;
        if (!wMsg || "sqlite3" !== wMsg.type) {
            return;
        }
        const wMsgType = wMsg.messageId ? "id" : "type";
        const handler = this.handlers[wMsg[wMsgType]];
        if (!handler) {
            this.toss("Unknown worker message type", wMsg[wMsgType]);
        }
        let result;
        let evType = "result";
        let dbId = wMsg.dbId;
        try {
            result = handler(wMsg);
        } catch (err) {
            evType = "error";
            result = {
                operation: ev.type,
                message: err.message,
                errorClass: err.name,
                input: ev,
            };
            if (err.stack) {
                result.stack =
                    "string" === typeof err.stack ? err.stack.split(/\n\s*/) : err.stack;
            }
        }
        if (!dbId) {
            dbId = (result && result.dbId) || this.getDefaultDbId();
        }
        this.state.post(
            {
                type: evType,
                dbId: dbId,
                messageId: wMsg.messageId,
                workerReceivedTime: arrivalTime,
                workerRespondTime: performance.now(),
                departureTime: wMsg.departureTime,
                result: result,
            },
            this.state.xfer
        );
    }

    /**
     * Hooks the worker message listener and notifies the host thread that the
     * API is ready.
     */
    install() {
        globalThis.addEventListener("message", this.handleMessage);
        globalThis.postMessage({
            type: "sqlite3-api",
            result: "worker1-ready",
        });
    }
}
