/**
 * Shared type definitions for the struct binder runtime.
 * The `.ts` sources import from this stub so we can keep the
 * ergonomics of local relative imports while still matching
 * the sqlite3 facade type surface.
 */

export type WasmPointer = number | bigint;

export interface Sqlite3DebugFlagState {
  getter: boolean;
  setter: boolean;
  alloc: boolean;
  dealloc: boolean;
}

export interface Sqlite3DebugFlagController {
  (mask?: number): Sqlite3DebugFlagState;
  readonly __flags: Sqlite3DebugFlagState;
}

export interface Sqlite3StructMemberDescriptor {
  readonly offset: number;
  readonly sizeof: number;
  readonly signature: string;
  readonly key?: string;
  readonly name?: string;
  readonly readOnly?: boolean;
}

export interface Sqlite3StructDefinition {
  readonly name?: string;
  readonly sizeof: number;
  readonly members: Record<string, Sqlite3StructMemberDescriptor>;
}

export type Sqlite3StructDisposer =
  | WasmPointer
  | Sqlite3StructInstance
  | (() => void);

export interface Sqlite3StructInstance extends Record<string, unknown> {
  readonly pointer: WasmPointer;
  readonly structInfo: Sqlite3StructDefinition;
  readonly debugFlags: Sqlite3DebugFlagController;
  ondispose?: Sqlite3StructDisposer | Sqlite3StructDisposer[];
  dispose(): void;
  lookupMember(
    memberName: string,
    tossIfNotFound?: boolean,
  ): Sqlite3StructMemberDescriptor | null;
  memberToJsString(memberName: string): string | null;
  memberIsString(memberName: string, tossIfNotFound?: boolean): boolean;
  memberKey(memberName: string): string;
  memberKeys(): string[];
  memberSignature(memberName: string, emscriptenFormat?: boolean): string;
  memoryDump(): Uint8Array | null;
  setMemberCString(memberName: string, value: string): this;
  addOnDispose(...items: Array<unknown>): this;
}

export interface Sqlite3StructConstructor {
  readonly structName: string;
  readonly structInfo: Sqlite3StructDefinition;
  readonly debugFlags: Sqlite3DebugFlagController;
  readonly prototype: Sqlite3StructInstance;
  new (pointer?: WasmPointer): Sqlite3StructInstance;
  isA(candidate: unknown): candidate is Sqlite3StructInstance;
  memberKey(memberName: string): string;
  memberKeys(structInfo: Sqlite3StructDefinition): string[];
  methodInfoForKey(
    memberKey: string,
  ): Sqlite3StructMemberDescriptor | undefined;
  allocCString(value: string): WasmPointer;
  hasExternalPointer(candidate: Sqlite3StructInstance): boolean;
}

export interface Sqlite3StructBinderConfig {
  heap: WebAssembly.Memory | (() => Uint8Array);
  alloc(bytes: number): WasmPointer;
  dealloc(pointer: WasmPointer): void;
  log?(...parts: (string | number | bigint | boolean)[]): void;
  memberPrefix?: string;
  memberSuffix?: string;
  bigIntEnabled?: boolean;
  ptrSizeof?: 4 | 8;
  ptrIR?: "i32" | "i64";
}

export interface Sqlite3StructBinder {
  (
    definition: Sqlite3StructDefinition | string,
    info?: Sqlite3StructDefinition,
  ): Sqlite3StructConstructor;
  readonly StructType: Sqlite3StructConstructor;
  readonly config: Sqlite3StructBinderConfig;
  readonly debugFlags: Sqlite3DebugFlagController;
  allocCString(value: string): WasmPointer;
}
