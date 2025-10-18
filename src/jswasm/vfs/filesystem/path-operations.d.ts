import type {
    FSNode,
    MutableFS,
} from "./base-state.d.ts";

export interface PathOperationsOptions {
    getPathFS(): {
        resolve(...paths: string[]): string;
        relative(from: string, to: string): string;
    };
}

export interface PathLookupResult {
    path: string;
    node: FSNode | null;
}

export interface PathOperations {
    lookupPath(path: string, opts?: {
        follow_mount?: boolean;
        recurse_count?: number;
        parent?: boolean;
        follow?: boolean;
    }): PathLookupResult;
    getPath(node: FSNode): string;
    hashName(parentId: number, name: string): number;
    hashAddNode(node: FSNode): void;
    hashRemoveNode(node: FSNode): void;
    lookupNode(parent: FSNode, name: string): FSNode;
    createNode(parent: FSNode, name: string, mode: number, rdev: number): FSNode;
    destroyNode(node: FSNode): void;
    isRoot(node: FSNode): boolean;
    isMountpoint(node: FSNode): boolean;
}

export function createPathOperations(
    FS: MutableFS,
    options: PathOperationsOptions
): PathOperations;
