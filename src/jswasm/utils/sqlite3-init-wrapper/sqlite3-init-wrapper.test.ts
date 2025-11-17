import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { wrapSqlite3InitModule } from "./sqlite3-init-wrapper";
import type {
    SQLite3ModuleAPI,
    Sqlite3InitModuleState,
    WrappedInitModule,
} from "./sqlite3-init-wrapper";

type TestGlobals = Omit<typeof globalThis, "document" | "location"> & {
    sqlite3InitModule?: WrappedInitModule;
    sqlite3InitModuleState?: Sqlite3InitModuleState;
    document?: Document;
    location?: Location;
};

const testGlobal = globalThis as TestGlobals;

const realDocument = testGlobal.document;
const realLocation = testGlobal.location;
const realInitModule = testGlobal.sqlite3InitModule;
const realInitModuleState = testGlobal.sqlite3InitModuleState;

const createLocation = (search = "?sqlite3.dir=/assets/&sqlite3.debugModule=1") =>
    new URL(`https://example.com/app/index.mjs${search}`) as unknown as Location;

const createDocument = () =>
    ({
        currentScript: {
            src: "https://example.com/static/some/path/sqlite3-init-wrapper.js",
        },
    } as Document);

describe("wrapSqlite3InitModule", () => {
    beforeEach(() => {
        delete testGlobal.sqlite3InitModule;
        delete testGlobal.sqlite3InitModuleState;
        testGlobal.location = createLocation();
        testGlobal.document = createDocument();
    });

    afterEach(() => {
        if (realDocument) {
            testGlobal.document = realDocument;
        } else {
            delete testGlobal.document;
        }

        if (realLocation) {
            testGlobal.location = realLocation;
        } else {
            delete testGlobal.location;
        }

        if (realInitModule) {
            testGlobal.sqlite3InitModule = realInitModule;
        } else {
            delete testGlobal.sqlite3InitModule;
        }

        if (realInitModuleState) {
            testGlobal.sqlite3InitModuleState = realInitModuleState;
        } else {
            delete testGlobal.sqlite3InitModuleState;
        }
    });

    it("throws when no initializer is registered", () => {
        expect(() =>
        wrapSqlite3InitModule(
            undefined as unknown as Parameters<typeof wrapSqlite3InitModule>[0],
        ),
        ).toThrowError(
            "Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build.",
        );
    });

    it("invokes the post-load hooks and tracks the init state", async () => {
        const runSQLite3PostLoadInit = vi.fn();
        const asyncPostInit = vi.fn().mockResolvedValue("async-init-ok");
        const sqlite3: SQLite3ModuleAPI = { asyncPostInit };
        const emscriptenModule = { sqlite3, runSQLite3PostLoadInit };
        const originalInit = vi.fn(
            () => Promise.resolve(emscriptenModule),
        ) as Parameters<typeof wrapSqlite3InitModule>[0];
        originalInit.ready = Promise.resolve({ ready: true });

        const wrappedInit = wrapSqlite3InitModule(originalInit);
        expect(testGlobal.sqlite3InitModule).toBe(wrappedInit);
        expect(testGlobal.sqlite3InitModule?.ready).toBe(originalInit.ready);

        const result = await wrappedInit();

        expect(runSQLite3PostLoadInit).toHaveBeenCalledTimes(1);
        expect(asyncPostInit).toHaveBeenCalledTimes(1);
        expect(result).toBe("async-init-ok");
        expect(sqlite3.asyncPostInit).toBeUndefined();

        const initState = testGlobal.sqlite3InitModuleState!;
        expect(initState).toMatchObject({
            location: testGlobal.location,
            isWorker: false,
        });

        expect(initState.sqlite3Dir).toContain("/assets/");
        expect(initState.scriptDir).toContain("/static/some/path/");
        expect(sqlite3.scriptInfo).toBe(initState);
        expect(() => initState.debugModule("log")).not.toThrow();
    });

    it("propagates the test flag when requested", async () => {
        const runSQLite3PostLoadInit = vi.fn();
        const asyncPostInit = vi.fn().mockResolvedValue({ status: "ok" });
        const sqlite3: SQLite3ModuleAPI = { asyncPostInit };
        const emscriptenModule = { sqlite3, runSQLite3PostLoadInit };
        const originalInit = vi.fn(
            () => Promise.resolve(emscriptenModule),
        ) as Parameters<typeof wrapSqlite3InitModule>[0];

        const wrappedInit = wrapSqlite3InitModule(originalInit);
        wrappedInit.__isUnderTest = true;

        await wrappedInit();

        expect(sqlite3.__isUnderTest).toBe(true);
    });

    it("routes debug logging through console.warn when the query param exists", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        testGlobal.location = createLocation("?sqlite3.debugModule=1");

        const runSQLite3PostLoadInit = vi.fn();
        const asyncPostInit = vi.fn().mockResolvedValue(true);
        const sqlite3: SQLite3ModuleAPI = { asyncPostInit };
        const emscriptenModule = { sqlite3, runSQLite3PostLoadInit };
        const originalInit = vi.fn(
            () => Promise.resolve(emscriptenModule),
        ) as Parameters<typeof wrapSqlite3InitModule>[0];

        const wrappedInit = wrapSqlite3InitModule(originalInit);
        await wrappedInit();

        const initState = testGlobal.sqlite3InitModuleState!;
        initState.debugModule("notice");
        expect(warnSpy).toHaveBeenCalledWith("sqlite3.debugModule:", "notice");

        warnSpy.mockRestore();
    });
});
