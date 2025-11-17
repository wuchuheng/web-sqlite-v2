export interface SQLite3ModuleAPI {
    asyncPostInit?: () => Promise<unknown>;
    scriptInfo?: unknown;
    __isUnderTest?: boolean;
    [key: string]: unknown;
}

export interface SQLite3FullModule {
    runSQLite3PostLoadInit(module: SQLite3FullModule): void;
    sqlite3: SQLite3ModuleAPI;
    [key: string]: unknown;
}

export type SQLite3InitModule = {
    (config?: unknown): Promise<SQLite3FullModule>;
    ready?: Promise<unknown>;
};

export type WrappedInitModule = SQLite3InitModule & {
    __isUnderTest?: boolean;
    ready?: Promise<unknown>;
};

export interface Sqlite3InitModuleState {
    moduleScript: HTMLScriptElement | null;
    isWorker: boolean;
    location?: Location;
    urlParams: URLSearchParams;
    sqlite3Dir?: string;
    scriptDir?: string;
    debugModule: (...args: unknown[]) => void;
}

type GlobalWithSqlite3 = typeof globalThis & {
    sqlite3InitModule?: WrappedInitModule;
    sqlite3InitModuleState?: Sqlite3InitModuleState;
};

const sqlite3Global = globalThis as GlobalWithSqlite3;

const createInitModuleState = (): Sqlite3InitModuleState =>
    Object.assign(Object.create(null), (() => {
        // 1. Capture available environment metadata.
        const moduleScript =
            typeof document !== "undefined"
                ? (document.currentScript as HTMLScriptElement | null)
                : null;
        const location =
            typeof globalThis.location !== "undefined"
                ? (globalThis.location as Location)
                : undefined;
        const urlParams = location?.href
            ? new URL(location.href).searchParams
            : new URLSearchParams();
        // 2. Derive directory hints from URL parameters or script location.
        const debugModuleEnabled = urlParams.has("sqlite3.debugModule");
        const sqlite3Dir = urlParams.has("sqlite3.dir")
            ? `${urlParams.get("sqlite3.dir")}/`
            : undefined;
        const scriptDir = moduleScript
            ? `${moduleScript.src.split("/").slice(0, -1).join("/")}/`
            : undefined;
        // 3. Prepare the debug logger and return the composed state.
        const debugModule = debugModuleEnabled
            ? (...args: unknown[]) => console.warn("sqlite3.debugModule:", ...args)
            : () => {};
        return {
            moduleScript,
            isWorker:
                typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !==
                "undefined",
            location,
            urlParams,
            sqlite3Dir,
            scriptDir,
            debugModule,
        };
    })());

export function wrapSqlite3InitModule(
    originalInit: SQLite3InitModule,
): WrappedInitModule {
    // 1. Validate inputs and prepare shared state.
    if (!originalInit) {
        throw new Error(
            "Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build.",
        );
    }
    const initModuleState = (sqlite3Global.sqlite3InitModuleState =
        createInitModuleState());

    // 2. Replace the initializer with the wrapped version that runs post-load hooks.
    const wrappedInit = ((...args: Parameters<SQLite3InitModule>) => {
        // 1. Call the original initializer and await its module promise.
        return originalInit(...args)
            .then((emscriptenModule) => {
                // 2. Run the post-load hook and attach state to sqlite3.
                emscriptenModule.runSQLite3PostLoadInit(emscriptenModule);
                const sqlite3 = emscriptenModule.sqlite3;
                sqlite3.scriptInfo = initModuleState;

                if (wrappedInit.__isUnderTest) {
                    sqlite3.__isUnderTest = true;
                }

                const asyncPostInit = sqlite3.asyncPostInit;
                if (!asyncPostInit) {
                    throw new Error("Missing sqlite3 asyncPostInit hook");
                }
                delete sqlite3.asyncPostInit;
                return asyncPostInit();
            })
            .catch((error) => {
                // 3. Log the failure and rethrow for consumers to handle.
                console.error("Exception loading sqlite3 module:", error);
                throw error;
            });
    }) as WrappedInitModule;

    sqlite3Global.sqlite3InitModule = wrappedInit;
    sqlite3Global.sqlite3InitModule!.ready = originalInit.ready;

    // 3. Surface debug information and return the wrapped initializer.
    initModuleState.debugModule("sqlite3InitModuleState =", initModuleState);
    return wrappedInit;
}
