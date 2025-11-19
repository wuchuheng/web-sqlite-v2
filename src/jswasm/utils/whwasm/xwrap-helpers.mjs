/**
 * @fileoverview xWrap adapter wiring for the wh-wasm utilities.
 */

import { createXWrapInternals } from "./xwrap-internals.mjs";

/**
 * Populates xWrap argument/result adapters and associated helpers.
 *
 * @param {import("./installer-context/installer-context.js").WhWasmInstallerContext} context
 */
export function attachXWrapAdapters(context) {
    const { target, cache } = context;
    const {
        argConverters,
        resultConverters,
        AbstractArgAdapter,
        FuncPtrAdapter,
        ensureArgAdapter,
        ensureResultAdapter,
        convertArg,
        convertArgNoCheck,
        convertResult,
        convertResultNoCheck,
        configureAdapter,
    } = createXWrapInternals(context);

    cache.xWrap.convertArg = (type, ...args) => convertArg(type, ...args);
    cache.xWrap.convertArgNoCheck = (type, ...args) =>
        convertArgNoCheck(type, ...args);
    cache.xWrap.convertResult = (type, value) => convertResult(type, value);
    cache.xWrap.convertResultNoCheck = (type, value) =>
        convertResultNoCheck(type, value);

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
                    "Function pointer not found in WASM function table.",
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
                        "argument(s).",
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
                        i,
                    );
                }
                return cache.xWrap.convertResultNoCheck(
                    resultType,
                    fn.apply(null, callArgs),
                );
            } finally {
                target.scopedAllocPop(scope);
            }
        };
    };

    target.xWrap.resultAdapter = function resultAdapter(typeName, adapter) {
        return configureAdapter(
            target.xWrap.resultAdapter,
            arguments.length,
            typeName,
            adapter,
            "resultAdapter()",
            resultConverters,
        );
    };

    target.xWrap.argAdapter = function argAdapter(typeName, adapter) {
        return configureAdapter(
            target.xWrap.argAdapter,
            arguments.length,
            typeName,
            adapter,
            "argAdapter()",
            argConverters,
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
