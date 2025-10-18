import type { FSNode, MutableFS } from "./base-state.d.ts";

export interface LegacyHelpersOptions {
    FS_getMode(canRead: boolean, canWrite: boolean): number;
}

export interface PathAnalysis {
    isRoot: boolean;
    exists: boolean;
    error: number;
    name: string | null;
    path: string | null;
    object: FSNode | null;
    parentExists: boolean;
    parentPath: string | null;
    parentObject: FSNode | null;
}

export interface LegacyHelpers {
    findObject(path: string, dontResolveLastLink?: boolean): FSNode | null;
    analyzePath(path: string, dontResolveLastLink?: boolean): PathAnalysis;
    createPath(
        parent: string | FSNode,
        path: string,
        canRead?: boolean,
        canWrite?: boolean
    ): string;
    createFile(
        parent: string | FSNode,
        name: string,
        properties: unknown,
        canRead: boolean,
        canWrite: boolean
    ): FSNode;
    createDataFile(
        parent: string | FSNode | null,
        name: string,
        data: string | ArrayLike<number> | null,
        canRead: boolean,
        canWrite: boolean,
        canOwn?: boolean
    ): void;
    createDevice(
        parent: string | FSNode,
        name: string,
        input?: (() => number | null | undefined) | null,
        output?: ((value: number) => void) | null
    ): FSNode;
    forceLoadFile(node: FSNode): boolean;
    createLazyFile(): never;
}

export function createLegacyHelpers(
    FS: MutableFS,
    options: LegacyHelpersOptions
): LegacyHelpers;
