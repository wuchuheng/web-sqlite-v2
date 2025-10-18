/**
 * @fileoverview xWrap adapter wiring for the wh-wasm utilities.
 */

/**
 * Populates xWrap argument/result adapters and associated helpers.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachXWrapAdapters(context) {
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
                context.toss("Missing arg converter:", type)
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
                    options
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
                    FuncPtrAdapter.bindScopes.join(", ")
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
                    this.isTransient
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
                            pair[1]
                        );
                    } catch (_error) {}
                    pair[0] = pair[1] = value | 0;
                }
                return value || 0;
            }
            throw new TypeError(
                `Invalid FuncPtrAdapter argument type. Expecting a function pointer or a ${this.name} function matching signature ${this.signature}.`
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

    cache.xWrap.convertArg = (type, ...args) => ensureArgAdapter(type)(...args);
    cache.xWrap.convertArgNoCheck = (type, ...args) =>
        argConverters.get(type)(...args);
    cache.xWrap.convertResult = (type, value) =>
        type === null
            ? value
            : type
            ? ensureResultAdapter(type)(value)
            : undefined;
    cache.xWrap.convertResultNoCheck = (type, value) =>
        type === null
            ? value
            : type
            ? resultConverters.get(type)(value)
            : undefined;

    /**
     * Wraps a wasm export with automatic argument and result conversions.
     *
     * @param {string | ((...args: unknown[]) => unknown)} fArg
     * @param {string | undefined} [resultType]
     * @param {...(string | import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3FuncPtrAdapter | import("../../wasm/bootstrap/runtime/sqlite3-facade-namespace.d.ts").Sqlite3FuncPtrAdapterConstructor)} argTypes
     * @returns {(...args: unknown[]) => unknown}
     */
    target.xWrap = function xWrap(fArg, resultType, ...argTypes) {
        if (arguments.length === 3 && Array.isArray(arguments[2])) {
            argTypes = arguments[2];
        }

        if (target.isPtr(fArg)) {
            fArg =
                target.functionEntry(fArg) ||
                context.toss(
                    "Function pointer not found in WASM function table."
                );
        }

        const fn = fArg instanceof Function ? fArg : target.xGet(fArg);
        const fnName =
            fArg instanceof Function ? fArg.name || "unnamed function" : fArg;

        if (argTypes.length !== fn.length) {
            context.toss(fnName + "() requires", fn.length, "argument(s).");
        }

        if (resultType !== undefined && resultType !== null) {
            ensureResultAdapter(resultType);
        }

        const verifiedArgTypes = argTypes.map((type) => {
            if (type instanceof AbstractArgAdapter) {
                argConverters.set(type, (...args) => type.convertArg(...args));
                return type;
            }
            ensureArgAdapter(type);
            return type;
        });

        if (fn.length === 0) {
            return (...callArgs) => {
                if (callArgs.length) {
                    context.toss(
                        fnName + "() requires",
                        fn.length,
                        "argument(s)."
                    );
                }
                return cache.xWrap.convertResult(resultType, fn.call(null));
            };
        }

        return (...callArgs) => {
            if (callArgs.length !== fn.length) {
                context.toss(fnName + "() requires", fn.length, "argument(s).");
            }
            const scope = target.scopedAllocPush();
            try {
                for (let i = 0; i < callArgs.length; ++i) {
                    callArgs[i] = cache.xWrap.convertArgNoCheck(
                        verifiedArgTypes[i],
                        callArgs[i],
                        callArgs,
                        i
                    );
                }
                return cache.xWrap.convertResultNoCheck(
                    resultType,
                    fn.apply(null, callArgs)
                );
            } finally {
                target.scopedAllocPop(scope);
            }
        };
    };

    const configureAdapter = (
        method,
        argsLength,
        typeName,
        adapter,
        modeName,
        map
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

    /**
     * Registers or retrieves a result adapter for xWrap.
     *
     * @param {string} typeName
     * @param {(value: import("../../sqlite3.d.ts").WasmPointer) => unknown} [adapter]
     * @returns {(value: import("../../sqlite3.d.ts").WasmPointer) => unknown}
     */
    target.xWrap.resultAdapter = function resultAdapter(typeName, adapter) {
        return configureAdapter(
            target.xWrap.resultAdapter,
            arguments.length,
            typeName,
            adapter,
            "resultAdapter()",
            resultConverters
        );
    };

    /**
     * Registers or retrieves an argument adapter for xWrap.
     *
     * @param {string} typeName
     * @param {(value: unknown) => unknown} [adapter]
     * @returns {(value: unknown) => unknown}
     */
    target.xWrap.argAdapter = function argAdapter(typeName, adapter) {
        return configureAdapter(
            target.xWrap.argAdapter,
            arguments.length,
            typeName,
            adapter,
            "argAdapter()",
            argConverters
        );
    };

    target.xWrap.FuncPtrAdapter = FuncPtrAdapter;
    target.xCallWrapped = (fArg, resultType, argTypes, ...callArgs) => {
        if (Array.isArray(arguments[3])) {
            callArgs = arguments[3];
        }
        return target
            .xWrap(fArg, resultType, argTypes || [])
            .apply(null, callArgs || []);
    };

    target.xWrap.testConvertArg = cache.xWrap.convertArg;
    target.xWrap.testConvertResult = cache.xWrap.convertResult;
}
