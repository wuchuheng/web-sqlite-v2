export function wrapSqlite3InitModule(originalInit) {
    if (!originalInit) {
        throw new Error(
            "Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build."
        );
    }

    const initModuleState = (globalThis.sqlite3InitModuleState = Object.assign(
        Object.create(null),
        {
            moduleScript: globalThis?.document?.currentScript,
            isWorker: typeof WorkerGlobalScope !== "undefined",
            location: globalThis.location,
            urlParams: globalThis?.location?.href
                ? new URL(globalThis.location.href).searchParams
                : new URLSearchParams(),
        }
    ));

    initModuleState.debugModule = initModuleState.urlParams.has(
        "sqlite3.debugModule"
    )
        ? (...args) => console.warn("sqlite3.debugModule:", ...args)
        : () => {};

    if (initModuleState.urlParams.has("sqlite3.dir")) {
        initModuleState.sqlite3Dir =
            initModuleState.urlParams.get("sqlite3.dir") + "/";
    } else if (initModuleState.moduleScript) {
        const li = initModuleState.moduleScript.src.split("/");
        li.pop();
        initModuleState.sqlite3Dir = li.join("/") + "/";
    }

    function wrappedInit(...args) {
        return originalInit(...args)
            .then((emscriptenModule) => {
                emscriptenModule.runSQLite3PostLoadInit(emscriptenModule);
                const s = emscriptenModule.sqlite3;
                s.scriptInfo = initModuleState;

                if (wrappedInit.__isUnderTest) s.__isUnderTest = true;
                const asyncPostInit = s.asyncPostInit;
                delete s.asyncPostInit;
                return asyncPostInit();
            })
            .catch((error) => {
                console.error("Exception loading sqlite3 module:", error);
                throw error;
            });
    }

    globalThis.sqlite3InitModule = wrappedInit;
    globalThis.sqlite3InitModule.ready = originalInit.ready;

    if (globalThis.sqlite3InitModuleState.moduleScript) {
        const sim = globalThis.sqlite3InitModuleState;
        const src = sim.moduleScript.src.split("/");
        src.pop();
        sim.scriptDir = src.join("/") + "/";
    }

    initModuleState.debugModule("sqlite3InitModuleState =", initModuleState);

    return wrappedInit;
}
