import type { FSNode, MutableFS } from "./base-state.d.ts";

export interface ModeOperations {
    isFile(mode: number): boolean;
    isDir(mode: number): boolean;
    isLink(mode: number): boolean;
    isChrdev(mode: number): boolean;
    isBlkdev(mode: number): boolean;
    isFIFO(mode: number): boolean;
    isSocket(mode: number): boolean;
    flagsToPermissionString(flag: number): string;
    nodePermissions(node: FSNode, perms: string): number;
    mayLookup(dir: FSNode): number;
    mayCreate(dir: FSNode, name: string): number;
    mayDelete(dir: FSNode, name: string, isDir: boolean): number;
    mayOpen(node: FSNode | null, flags: number): number;
}

export function createModeOperations(FS: MutableFS): ModeOperations;
