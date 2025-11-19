/**
 * Internal helpers used by attachXWrapAdapters. Logic lives here so that
 * xwrap-helpers.mjs can focus on orchestration only.
 *
 * @param {import("./installer-context/installer-context.js").WhWasmInstallerContext} context
 * @returns {{
 *   argConverters: Map<unknown, unknown>;
 *   resultConverters: Map<unknown, unknown>;
 *   ptrAdapter: (value: unknown) => number | bigint;
 *   AbstractArgAdapter: typeof AbstractArgAdapter;
 *   FuncPtrAdapter: typeof FuncPtrAdapter;
 *   ensureArgAdapter: (type: unknown) => (...args: unknown[]) => unknown;
 *   ensureResultAdapter: (type: unknown) => (value: unknown) => unknown;
 *   convertArg: (type: unknown, ...args: unknown[]) => unknown;
 *   convertArgNoCheck: (type: unknown, ...args: unknown[]) => unknown;
 *   convertResult: (type: unknown, value: unknown) => unknown;
 *   convertResultNoCheck: (type: unknown, value: unknown) => unknown;
 *   configureAdapter: (
 *     method: Function,
 *     argsLength: number,
 *     typeName: unknown,
 *     adapter: unknown,
 *     modeName: string,
 *     map: Map<unknown, unknown>
 *   ) => unknown;
 * }}
 */
export function createXWrapInternals(context) {
    const { target, cache, ptrIR } = context;
    const argConverters = cache.xWrap.convert.arg;
    const resultConverters = cache.xWrap.convert.result;
    const ptrAdapter =
        ptrIR === "i32"
            ? (value) => value | 0
            : (value) => BigInt(value) | BigInt(0);

    if (target.bigIntEnabled) {
        argConverters.set("i64", (value) => BigInt(value));
    }

    argConverters
        .set("i32", ptrAdapter)
        .set("i16", (value) => (value | 0) & 0xffff)
        .set("i8", (value) => (value | 0) & 0xff)
        .set("f32", (value) => Number(value).valueOf())
        .set("float", (value) => Number(value).valueOf())
        .set("f64", (value) => Number(value).valueOf())
        .set("double", (value) => Number(value).valueOf())
        .set("int", (value) => (value | 0) & 0xffffffff)
        .set("null", (value) => value)
        .set(null, (value) => value)
        .set("**", ptrAdapter)
        .set("*", ptrAdapter);

    resultConverters
        .set("*", ptrAdapter)
        .set("pointer", ptrAdapter)
        .set("number", (value) => Number(value))
        .set("void", () => undefined)
        .set("null", (value) => value)
        .set(null, (value) => value);

    const copyThrough = [
        "i8",
        "i16",
        "i32",
        "int",
        "f32",
        "float",
        "f64",
        "double",
    ];
    if (target.bigIntEnabled) {
        copyThrough.push("i64");
    }
    for (const type of copyThrough) {
        argConverters.set(`${type}*`, ptrAdapter);
        resultConverters.set(`${type}*`, ptrAdapter);
        resultConverters.set(
            type,
            argConverters.get(type) ||
                context.toss("Missing arg converter:", type),
        );
    }

    const stringArgAdapter = (value) => {
        if (typeof value === "string") {
            return target.scopedAllocCString(value);
        }
        return value ? ptrAdapter(value) : null;
    };

    argConverters
        .set("string", stringArgAdapter)
        .set("utf8", stringArgAdapter)
        .set("pointer", stringArgAdapter);

    resultConverters
        .set("string", (ptr) => target.cstrToJs(ptr))
        .set("utf8", (ptr) => target.cstrToJs(ptr))
        .set("string:dealloc", (ptr) => {
            try {
                return ptr ? target.cstrToJs(ptr) : null;
            } finally {
                target.dealloc(ptr);
            }
        })
        .set("utf8:dealloc", (ptr) => {
            try {
                return ptr ? target.cstrToJs(ptr) : null;
            } finally {
                target.dealloc(ptr);
            }
        })
        .set("json", (ptr) => JSON.parse(target.cstrToJs(ptr)))
        .set("json:dealloc", (ptr) => {
            try {
                return ptr ? JSON.parse(target.cstrToJs(ptr)) : null;
            } finally {
                target.dealloc(ptr);
            }
        });

    /**
     * Abstract base class used to customise argument conversion.
     */
    class AbstractArgAdapter {
        constructor(options) {
            this.name = options.name || "unnamed adapter";
        }

        convertArg() {
            context.toss("AbstractArgAdapter must be subclassed.");
        }
    }

    const installer = context;
    class FuncPtrAdapter extends AbstractArgAdapter {
        constructor(options) {
            super(options);
            if (FuncPtrAdapter.warnOnUse) {
                console.warn(
                    "xArg.FuncPtrAdapter is an internal-only API and is not intended for client code.",
                    options,
                );
            }
            this.signature =
                options.signature ||
                context.toss("FuncPtrAdapter options requires a signature.");
            if (options.contextKey instanceof Function) {
                this.contextKey = options.contextKey;
                if (!options.bindScope) {
                    options.bindScope = "context";
                }
            }
            this.bindScope =
                options.bindScope ||
                context.toss("FuncPtrAdapter options requires a bindScope.");
            if (!FuncPtrAdapter.bindScopes.includes(this.bindScope)) {
                context.toss(
                    "Invalid options.bindScope (",
                    options.bindScope,
                    ") for FuncPtrAdapter. Expecting one of:",
                    FuncPtrAdapter.bindScopes.join(", "),
                );
            }
            this.isTransient = this.bindScope === "transient";
            this.isContext = this.bindScope === "context";
            this.singleton = this.bindScope === "singleton" ? [] : undefined;
            this.callProxy =
                options.callProxy instanceof Function
                    ? options.callProxy
                    : undefined;
        }

        contextKey(argv, argIndex) {
            return `${argv}:${argIndex}`;
        }

        contextMap(key) {
            const map = this.__contextMap || (this.__contextMap = new Map());
            let entry = map.get(key);
            if (entry === undefined) {
                map.set(key, (entry = []));
            }
            return entry;
        }

        convertArg(value, argv, argIndex) {
            const pair = this.isContext
                ? this.contextMap(this.contextKey(argv, argIndex))
                : this.singleton;
            if (pair && pair[0] === value) {
                return pair[1];
            }
            if (value instanceof Function) {
                const callback = this.callProxy ? this.callProxy(value) : value;
                const pointer = installer.installFunctionInternal(
                    callback,
                    this.signature,
                    this.isTransient,
                );
                if (pair) {
                    if (pair[1]) {
                        try {
                            cache.scopedAlloc[
                                cache.scopedAlloc.length - 1
                            ].push(pair[1]);
                        } catch (_error) {
                            // If no scope is active we just fall through.
                        }
                    }
                    pair[0] = callback;
                    pair[1] = pointer;
                }
                return pointer;
            }
            if (
                target.isPtr(value) ||
                value === null ||
                typeof value === "undefined"
            ) {
                if (pair && pair[1] && pair[1] !== value) {
                    try {
                        cache.scopedAlloc[cache.scopedAlloc.length - 1].push(
                            pair[1],
                        );
                    } catch (_error) {}
                    pair[0] = pair[1] = value | 0;
                }
                return value || 0;
            }
            throw new TypeError(
                `Invalid FuncPtrAdapter argument type. Expecting a function pointer or a ${this.name} function matching signature ${this.signature}.`,
            );
        }
    }

    FuncPtrAdapter.warnOnUse = false;
    FuncPtrAdapter.debugFuncInstall = false;
    FuncPtrAdapter.debugOut = console.debug.bind(console);
    FuncPtrAdapter.bindScopes = [
        "transient",
        "context",
        "singleton",
        "permanent",
    ];

    const ensureArgAdapter = (type) =>
        argConverters.get(type) ||
        context.toss("Argument adapter not found:", type);
    const ensureResultAdapter = (type) =>
        resultConverters.get(type) ||
        context.toss("Result adapter not found:", type);

    const convertArg = (type, ...args) => ensureArgAdapter(type)(...args);
    const convertArgNoCheck = (type, ...args) =>
        argConverters.get(type)(...args);
    const convertResult = (type, value) =>
        type === null
            ? value
            : type
              ? ensureResultAdapter(type)(value)
              : undefined;
    const convertResultNoCheck = (type, value) =>
        type === null
            ? value
            : type
              ? resultConverters.get(type)(value)
              : undefined;

    const configureAdapter = (
        method,
        argsLength,
        typeName,
        adapter,
        modeName,
        map,
    ) => {
        if (typeof typeName === "string") {
            if (argsLength === 1) {
                return map.get(typeName);
            }
            if (argsLength === 2) {
                if (!adapter) {
                    map.delete(typeName);
                    return method;
                }
                if (!(adapter instanceof Function)) {
                    context.toss(modeName, "requires a function argument.");
                }
                map.set(typeName, adapter);
                return method;
            }
        }
        context.toss("Invalid arguments to", modeName);
    };

    return {
        argConverters,
        resultConverters,
        ptrAdapter,
        AbstractArgAdapter,
        FuncPtrAdapter,
        ensureArgAdapter,
        ensureResultAdapter,
        convertArg,
        convertArgNoCheck,
        convertResult,
        convertResultNoCheck,
        configureAdapter,
    };
}
