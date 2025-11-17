import { toss } from "../struct-binder-helpers/struct-binder-helpers.js";

type StructInfoMember = {
  key: string;
  signature: string;
};

type StructInfo = {
  name?: string;
  sizeof: number;
  members: Record<string, StructInfoMember>;
};

type StructCtor = {
  structName: string;
  structInfo: StructInfo;
  debugFlags: {
    __flags: {
      alloc?: boolean;
      dealloc?: boolean;
    };
  };
};

type StructTypeRef = { dispose(): void };

type StructTypeRefConstructor = {
  new (...args: unknown[]): StructTypeRef;
};

type StructTypeRefAccessor = {
  get(): StructTypeRefConstructor | null;
};

type CreateMemoryHelpersConfig = {
  alloc(size: number): number;
  dealloc(pointer: number): void;
  log(...value: unknown[]): void;
  memberPrefix?: string;
  memberSuffix?: string;
  pointerMap: WeakMap<object, number>;
  externalPointers: WeakMap<object, boolean>;
  viewHeap(): Uint8Array;
  textEncoder: TextEncoder;
  textDecoder: TextDecoder;
  sabCtor: typeof SharedArrayBuffer | null;
  describeMember(structName: string, memberName: string): string;
  StructTypeRefAccessor: StructTypeRefAccessor;
};

type DisposeHandler = (() => void) | number | StructTypeRef;

type InstanceWithDispose = Record<string, unknown> & {
  ondispose?: DisposeHandler | DisposeHandler[];
};

export const createMemoryHelpers = (config: CreateMemoryHelpersConfig) => {
  const {
    alloc,
    dealloc,
    log,
    memberPrefix = "",
    memberSuffix = "",
    pointerMap,
    externalPointers,
    viewHeap,
    textEncoder,
    textDecoder,
    sabCtor,
    describeMember,
    StructTypeRefAccessor,
  } = config;

  const pointerOf = (instance: object) => pointerMap.get(instance);

  const hasExternalPointer = (instance: object) =>
    externalPointers.get(instance) === true;

  const validateExternalPointer = (structName: string, value: number) => {
    if (typeof value !== "number" || value !== (value | 0) || value <= 0) {
      toss("Invalid pointer value for", structName, "constructor.");
    }
    return value;
  };

  const allocStruct = (
    structCtor: StructCtor,
    instance: object,
    pointer?: number,
  ) => {
    // 1. Input handling
    const externalPointer = pointer !== undefined;
    const addr = externalPointer
      ? pointer!
      : alloc(structCtor.structInfo.sizeof);
    if (!addr) {
      toss("Allocation of", structCtor.structName, "structure failed.");
    }

    // 2. Core processing
    try {
      if (structCtor.debugFlags.__flags.alloc) {
        log(
          "debug.alloc:",
          externalPointer ? "EXTERNAL" : "",
          structCtor.structName,
          "instance:",
          structCtor.structInfo.sizeof,
          "bytes @" + addr,
        );
      }
      if (!externalPointer) {
        viewHeap().fill(0, addr, addr + structCtor.structInfo.sizeof);
      }
      pointerMap.set(instance, addr);
      if (externalPointer) externalPointers.set(instance, true);
      else externalPointers.delete(instance);
    } catch (error) {
      pointerMap.delete(instance);
      if (!externalPointer) dealloc(addr);
      throw error;
    }

    // 3. Output
    return addr;
  };

  const disposeHandler = (
    structCtor: StructCtor,
    instance: object,
    handler: DisposeHandler,
  ) => {
    try {
      if (typeof handler === "function") {
        handler.call(instance);
        return;
      }

      const StructRefCtor = StructTypeRefAccessor.get();
      if (StructRefCtor && handler instanceof StructRefCtor) {
        handler.dispose();
        return;
      }

      if (typeof handler === "number") {
        dealloc(handler);
      }
    } catch (error) {
      console.warn(
        "ondispose() for",
        structCtor.structName,
        "@",
        pointerOf(instance),
        "threw. NOT propagating it.",
        error,
      );
    }
  };

  const freeStruct = (structCtor: StructCtor, instance: object) => {
    const target = instance as InstanceWithDispose;
    // 1. Input validation
    const addr = pointerMap.get(instance);
    if (!addr) return;
    pointerMap.delete(instance);
    const externalPointer = hasExternalPointer(instance);
    externalPointers.delete(instance);
    const handlers = target.ondispose;

    // 2. Core processing
    if (Array.isArray(handlers)) {
      while (handlers.length) {
        const handler = handlers.shift();
        if (handler) {
          disposeHandler(structCtor, instance, handler);
        }
      }
    } else if (typeof handlers === "function") {
      disposeHandler(structCtor, instance, handlers);
    }
    delete target.ondispose;

    if (structCtor.debugFlags.__flags.dealloc) {
      log(
        "debug.dealloc:",
        externalPointer ? "EXTERNAL" : "",
        structCtor.structName,
        "instance:",
        structCtor.structInfo.sizeof,
        "bytes @" + addr,
      );
    }
    if (!externalPointer) dealloc(addr);

    // 3. Output
    return;
  };

  const addOnDispose = (
    instance: Record<string, unknown>,
    ...items: DisposeHandler[]
  ) => {
    const target = instance as InstanceWithDispose;
    const existing = target.ondispose;
    let disposeList: DisposeHandler[];

    if (!existing) {
      disposeList = [];
      target.ondispose = disposeList;
    } else if (Array.isArray(existing)) {
      disposeList = existing;
    } else {
      disposeList = [existing];
      target.ondispose = disposeList;
    }

    disposeList.push(...items);
  };

  const allocCString = (value: string) => {
    // 1. Input handling
    const encoded = textEncoder.encode(value);
    const pointer = alloc(encoded.length + 1);
    if (!pointer) toss("Allocation error while duplicating string:", value);

    // 2. Core processing
    const memory = viewHeap();
    memory.set(encoded, pointer);
    memory[pointer + encoded.length] = 0;

    // 3. Output
    return pointer;
  };

  const decodeCString = (memory: Uint8Array, start: number) => {
    // 1. Input handling
    let end = start;
    while (memory[end] !== 0) end += 1;

    // 2. Core processing
    const view =
      !sabCtor || !(memory.buffer instanceof sabCtor)
        ? memory.subarray(start, end)
        : memory.slice(start, end);

    // 3. Output
    return textDecoder.decode(view);
  };

  const lookupMember = (
    structInfo: StructInfo,
    memberName: string,
    tossIfNotFound = true,
  ) => {
    // 1. Input validation
    let member = structInfo.members[memberName];
    if (!member && (memberPrefix || memberSuffix)) {
      // 2. Core processing
      for (const candidate of Object.values(structInfo.members)) {
        if (candidate.key === memberName) {
          member = candidate;
          break;
        }
      }
    }
    if (!member && tossIfNotFound) {
      toss(
        describeMember(structInfo.name || "anonymous struct", memberName),
        "is not a mapped struct member.",
      );
    }

    // 3. Output
    return member;
  };

  const assertCStringSignature = (member: StructInfoMember) => {
    if (member.signature === "s") return;
    toss(
      "Invalid member type signature for C-string value:",
      JSON.stringify(member),
    );
  };

  return {
    pointerOf,
    hasExternalPointer,
    validateExternalPointer,
    allocStruct,
    disposeHandler,
    freeStruct,
    addOnDispose,
    allocCString,
    decodeCString,
    lookupMember,
    assertCStringSignature,
  };
};
