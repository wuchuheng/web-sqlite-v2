import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { wrapSqlite3InitModule } from "./sqlite3-init-wrapper";

const realDocument = globalThis.document;
const realLocation = globalThis.location;
const realInitModule = globalThis.sqlite3InitModule;
const realInitModuleState = globalThis.sqlite3InitModuleState;

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
        delete globalThis.sqlite3InitModule;
        delete globalThis.sqlite3InitModuleState;
        globalThis.location = createLocation();
        globalThis.document = createDocument();
    });

    afterEach(() => {
        if (realDocument) {
            globalThis.document = realDocument;
        } else {
            delete globalThis.document;
        }

        if (realLocation) {
            globalThis.location = realLocation;
        } else {
            delete globalThis.location;
        }

        if (realInitModule) {
            globalThis.sqlite3InitModule = realInitModule;
        } else {
            delete globalThis.sqlite3InitModule;
        }

        if (realInitModuleState) {
            globalThis.sqlite3InitModuleState = realInitModuleState;
        } else {
            delete globalThis.sqlite3InitModuleState;
        }
    });

    it("throws when no initializer is registered", () => {
        expect(() =>
            wrapSqlite3InitModule(undefined as Parameters<typeof wrapSqlite3InitModule>[0]),
        ).toThrowError(
            "Expecting globalThis.sqlite3InitModule to be defined by the Emscripten build.",
        );
    });

    it("invokes the post-load hooks and tracks the init state", async () => {
        const runSQLite3PostLoadInit = vi.fn();
        const asyncPostInit = vi.fn().mockResolvedValue("async-init-ok");
        const sqlite3 = { asyncPostInit };
        const emscriptenModule = { sqlite3, runSQLite3PostLoadInit };
        const originalInit = vi.fn(() => Promise.resolve(emscriptenModule));
        originalInit.ready = Promise.resolve({ ready: true });

        const wrappedInit = wrapSqlite3InitModule(originalInit);
        expect(globalThis.sqlite3InitModule).toBe(wrappedInit);
        expect(globalThis.sqlite3InitModule?.ready).toBe(originalInit.ready);

        const result = await wrappedInit();

        expect(runSQLite3PostLoadInit).toHaveBeenCalledTimes(1);
        expect(asyncPostInit).toHaveBeenCalledTimes(1);
        expect(result).toBe("async-init-ok");
        expect(sqlite3.asyncPostInit).toBeUndefined();

        const initState = globalThis.sqlite3InitModuleState!;
        expect(initState).toMatchObject({
            location: globalThis.location,
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
        const sqlite3 = { asyncPostInit };
        const emscriptenModule = { sqlite3, runSQLite3PostLoadInit };
        const originalInit = vi.fn(() => Promise.resolve(emscriptenModule));

        const wrappedInit = wrapSqlite3InitModule(originalInit);
        wrappedInit.__isUnderTest = true;

        await wrappedInit();

        expect(sqlite3.__isUnderTest).toBe(true);
    });

    it("routes debug logging through console.warn when the query param exists", async () => {
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        globalThis.location = createLocation("?sqlite3.debugModule=1");

        const runSQLite3PostLoadInit = vi.fn();
        const asyncPostInit = vi.fn().mockResolvedValue(true);
        const sqlite3 = { asyncPostInit };
        const emscriptenModule = { sqlite3, runSQLite3PostLoadInit };
        const originalInit = vi.fn(() => Promise.resolve(emscriptenModule));

        const wrappedInit = wrapSqlite3InitModule(originalInit);
        await wrappedInit();

        const initState = globalThis.sqlite3InitModuleState!;
        initState.debugModule("notice");
        expect(warnSpy).toHaveBeenCalledWith("sqlite3.debugModule:", "notice");

        warnSpy.mockRestore();
    });
});
