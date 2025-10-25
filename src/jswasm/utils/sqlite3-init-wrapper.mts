import type { SQLite3InitModule } from "../sqlite3.d.ts";

type WrappedInitModule = SQLite3InitModule & {
    __isUnderTest?: boolean;
    ready?: unknown;
};

interface Sqlite3InitModuleState extends Record<string, unknown> {
    moduleScript?: HTMLOrSVGScriptElement | null;
    isWorker: boolean;
    location?: Location;
    urlParams: URLSearchParams;
    sqlite3Dir?: string;
    scriptDir?: string;
    debugModule: (...args: unknown[]) => void;
}

type Sqlite3ModuleWithInternals = Awaited<ReturnType<SQLite3InitModule>> & {
    runSQLite3PostLoadInit: (
        module: Awaited<ReturnType<SQLite3InitModule>>,
    ) => void;
    sqlite3: {
        scriptInfo?: Sqlite3InitModuleState;
        __isUnderTest?: boolean;
        asyncPostInit?: () => Promise<Awaited<ReturnType<SQLite3InitModule>>>;
    } & Record<string, unknown>;
};

const resolveCurrentScript = (): HTMLOrSVGScriptElement | null | undefined => {
    if (typeof document === "undefined") {
        return undefined;
    }

    return document.currentScript as HTMLOrSVGScriptElement | null | undefined;
};

const resolveScriptSrc = (
    script: HTMLOrSVGScriptElement | null | undefined,
): string | undefined => {
    if (!script) {
        return undefined;
    }

    if ("src" in script && typeof script.src === "string" && script.src) {
        return script.src;
    }

    return undefined;
};

const globalContext = globalThis as typeof globalThis & {
    sqlite3InitModuleState?: Sqlite3InitModuleState;
    sqlite3InitModule?: WrappedInitModule;
};

export function wrapSqlite3InitModule(
    originalInit: SQLite3InitModule,
): WrappedInitModule {
    if (!originalInit) {
        throw new Error(
            "Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build.",
        );
    }

    const locationHref = globalThis.location?.href;
    const initModuleState: Sqlite3InitModuleState =
        (globalContext.sqlite3InitModuleState = Object.assign(
            Object.create(null),
            {
                moduleScript: resolveCurrentScript(),
                isWorker:
                    typeof (globalThis as { WorkerGlobalScope?: unknown })
                        .WorkerGlobalScope !== "undefined",
                location: globalThis.location as Location | undefined,
                urlParams: locationHref
                    ? new URL(locationHref).searchParams
                    : new URLSearchParams(),
                debugModule: () => {},
            } satisfies Sqlite3InitModuleState,
        ));

    initModuleState.debugModule = initModuleState.urlParams.has(
        "sqlite3.debugModule",
    )
        ? (...args: unknown[]) => console.warn("sqlite3.debugModule:", ...args)
        : () => {};

    if (initModuleState.urlParams.has("sqlite3.dir")) {
        const dir = initModuleState.urlParams.get("sqlite3.dir");
        initModuleState.sqlite3Dir = dir ? `${dir}/` : undefined;
    } else {
        const scriptSrc = resolveScriptSrc(
            initModuleState.moduleScript ?? undefined,
        );
        if (scriptSrc) {
            const segments = scriptSrc.split("/");
            segments.pop();
            initModuleState.sqlite3Dir = `${segments.join("/")}/`;
        }
    }

    const wrappedInit: WrappedInitModule = ((
        ...args: Parameters<SQLite3InitModule>
    ) =>
        originalInit(...args)
            .then((module) => {
                const emscriptenModule =
                    module as unknown as Sqlite3ModuleWithInternals;
                emscriptenModule.runSQLite3PostLoadInit(module);

                const sqlite3Namespace = emscriptenModule.sqlite3;
                sqlite3Namespace.scriptInfo = initModuleState;

                if (wrappedInit.__isUnderTest) {
                    sqlite3Namespace.__isUnderTest = true;
                }

                const asyncPostInit = sqlite3Namespace.asyncPostInit;
                delete sqlite3Namespace.asyncPostInit;

                if (!asyncPostInit) {
                    return module;
                }

                return asyncPostInit();
            })
            .catch((error) => {
                console.error("Exception loading sqlite3 module:", error);
                throw error;
            })) as WrappedInitModule;

    globalContext.sqlite3InitModule = wrappedInit;
    globalContext.sqlite3InitModule.ready = (
        originalInit as WrappedInitModule
    ).ready;

    const moduleScript = globalContext.sqlite3InitModuleState?.moduleScript;
    const moduleScriptSrc = resolveScriptSrc(moduleScript ?? undefined);
    if (moduleScriptSrc) {
        const segments = moduleScriptSrc.split("/");
        segments.pop();
        initModuleState.scriptDir = `${segments.join("/")}/`;
    }

    initModuleState.debugModule("sqlite3InitModuleState =", initModuleState);

    return wrappedInit;
}
