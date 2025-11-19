/**
 * Pointer-aware peek and poke helpers for the wh-wasm installer.
 */

import type {
  WhWasmHelperTarget,
  WhWasmInstallerContext,
} from "../installer-context/installer-context";

type WasmPointer = number | bigint;
type PeekType =
  | "i1"
  | "i8"
  | "i16"
  | "i32"
  | "i64"
  | "f32"
  | "f64"
  | "float"
  | "double"
  | "ptr"
  | "*";
type PokeType = PeekType;
export type MemoryAccessorTarget = WhWasmHelperTarget & {
  peek?: (
    pointer: WasmPointer | WasmPointer[],
    signature?: MemoryReadSignature,
  ) => number | bigint | (number | bigint)[];
  poke?: (
    pointer: WasmPointer | WasmPointer[],
    value: number | bigint,
    signature?: MemoryWriteSignature,
  ) => MemoryAccessorTarget;
  peekPtr?: (...pointer: WasmPointer[]) => WasmPointer | WasmPointer[];
  pokePtr?: (
    pointer: WasmPointer | WasmPointer[],
    value?: WasmPointer,
  ) => MemoryAccessorTarget;
  peek8?: (...pointer: WasmPointer[]) => number | number[];
  poke8?: (
    pointer: WasmPointer | WasmPointer[],
    value: number,
  ) => MemoryAccessorTarget;
  peek16?: (...pointer: WasmPointer[]) => number | number[];
  poke16?: (
    pointer: WasmPointer | WasmPointer[],
    value: number,
  ) => MemoryAccessorTarget;
  peek32?: (...pointer: WasmPointer[]) => number | number[];
  poke32?: (
    pointer: WasmPointer | WasmPointer[],
    value: number,
  ) => MemoryAccessorTarget;
  peek64?: (...pointer: WasmPointer[]) => bigint | (bigint | number)[];
  poke64?: (
    pointer: WasmPointer | WasmPointer[],
    value: number | bigint,
  ) => MemoryAccessorTarget;
  peek32f?: (...pointer: WasmPointer[]) => number | number[];
  poke32f?: (
    pointer: WasmPointer | WasmPointer[],
    value: number,
  ) => MemoryAccessorTarget;
  peek64f?: (...pointer: WasmPointer[]) => number | number[];
  poke64f?: (
    pointer: WasmPointer | WasmPointer[],
    value: number,
  ) => MemoryAccessorTarget;
  getMemValue?: MemoryAccessorTarget["peek"];
  setMemValue?: MemoryAccessorTarget["poke"];
  getPtrValue?: (...pointer: WasmPointer[]) => WasmPointer | WasmPointer[];
  setPtrValue?: (
    pointer: WasmPointer | WasmPointer[],
    value: WasmPointer,
  ) => MemoryAccessorTarget;
  isPtr?: (candidate: unknown) => candidate is WasmPointer;
  isPtr32?: (candidate: unknown) => candidate is WasmPointer;
};
type MemoryReadSignature = PeekType | `${PeekType}*`;
type MemoryWriteSignature = PokeType | `${PokeType}*`;
type NumericType = "i1" | "i8" | "i16" | "i32" | "i64" | "f32" | "f64";

const NUMERIC_TYPES = new Set<NumericType>([
  "i1",
  "i8",
  "i16",
  "i32",
  "i64",
  "f32",
  "f64",
]);

const packPointerArgs = (args: WasmPointer[]): WasmPointer | WasmPointer[] =>
  args.length === 1 ? args[0] : args;

const toPointerArray = (pointer: WasmPointer | WasmPointer[]): WasmPointer[] =>
  Array.isArray(pointer) ? pointer : [pointer];

const normalizeFloatingType = (type: string): string => {
  if (type === "float") return "f32";
  if (type === "double") return "f64";
  if (type === "ptr" || type === "*") return "ptr";
  return type;
};

const resolveNumericType = (
  signature: MemoryReadSignature | MemoryWriteSignature | undefined,
  defaultType: NumericType,
  ptrIR: NumericType,
  toss: WhWasmInstallerContext["toss"],
  verb: "peek" | "poke",
): NumericType => {
  const raw = signature ?? defaultType;
  const normalized = normalizeFloatingType(String(raw));
  const resolved =
    normalized.endsWith("*") || normalized === "ptr" ? ptrIR : normalized;

  if (!NUMERIC_TYPES.has(resolved as NumericType)) {
    toss(`Invalid type for ${verb}():`, raw);
  }
  return resolved as NumericType;
};

const readValue = (
  context: WhWasmInstallerContext,
  pointer: WasmPointer,
  type: NumericType,
): number | bigint => {
  const heap = context.getHeapViews();
  const offset = Number(pointer);

  switch (type) {
    case "i1":
    case "i8":
      return heap.HEAP8![offset >> 0];
    case "i16":
      return heap.HEAP16![offset >> 1];
    case "i32":
      return heap.HEAP32![offset >> 2];
    case "f32":
      return heap.HEAP32F![offset >> 2];
    case "f64":
      return Number(heap.HEAP64F![offset >> 3]);
    case "i64":
      if (context.target.bigIntEnabled && heap.HEAP64) {
        return heap.HEAP64[offset >> 3];
      }
      context.toss("Invalid type for peek():", type);
  }
  return context.toss("Invalid type for peek():", type);
};

const writeValue = (
  context: WhWasmInstallerContext,
  pointer: WasmPointer,
  value: number | bigint,
  type: NumericType,
): void => {
  const heap = context.getHeapViews();
  const offset = Number(pointer);

  switch (type) {
    case "i1":
    case "i8":
      heap.HEAP8![offset >> 0] = Number(value);
      return;
    case "i16":
      heap.HEAP16![offset >> 1] = Number(value);
      return;
    case "i32":
      heap.HEAP32![offset >> 2] = Number(value);
      return;
    case "f32":
      heap.HEAP32F![offset >> 2] = Number(value);
      return;
    case "f64":
      heap.HEAP64F![offset >> 3] = Number(value);
      return;
    case "i64":
      if (heap.HEAP64) {
        heap.HEAP64[offset >> 3] = BigInt(value);
        return;
      }
      context.toss("Invalid type for poke():", type);
      return;
  }
  context.toss("Invalid type for poke():", type);
};

const isPtr32 = (candidate: unknown): candidate is WasmPointer =>
  typeof candidate === "number" &&
  candidate === (candidate | 0) &&
  candidate >= 0;

/**
 * Installs peek/poke helpers and pointer utilities on the context target.
 *
 * @param context Installer context providing heap views and pointer metadata.
 */
export function attachMemoryAccessors(context: WhWasmInstallerContext): void {
  // 1. Input handling
  const target = context.target as MemoryAccessorTarget;
  const { ptrIR } = context;
  const toss = context.toss.bind(context);

  // 2. Core processing
  target.peek = ((pointer, signature: MemoryReadSignature = "i8") => {
    const requests = toPointerArray(pointer);
    const resolvedType = resolveNumericType(
      signature,
      "i8",
      ptrIR,
      toss,
      "peek",
    );
    const values = requests.map((address) =>
      readValue(context, address, resolvedType),
    );
    return Array.isArray(pointer) ? values : values[0];
  }) as MemoryAccessorTarget["peek"];

  target.poke = ((pointer, value, signature: MemoryWriteSignature = "i8") => {
    const targets = toPointerArray(pointer);
    const resolvedType = resolveNumericType(
      signature,
      "i8",
      ptrIR,
      toss,
      "poke",
    );
    for (const address of targets) {
      writeValue(context, address, value, resolvedType);
    }
    return target;
  }) as MemoryAccessorTarget["poke"];

  target.peekPtr = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      ptrIR,
    )) as unknown as MemoryAccessorTarget["peekPtr"];

  target.pokePtr = ((
    pointer: WasmPointer | WasmPointer[],
    value: WasmPointer = 0,
  ) => target.poke!(pointer, value, ptrIR)) as MemoryAccessorTarget["pokePtr"];

  target.peek8 = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      "i8",
    )) as unknown as MemoryAccessorTarget["peek8"];
  target.poke8 = ((pointer: WasmPointer | WasmPointer[], value: number) =>
    target.poke!(pointer, value, "i8")) as MemoryAccessorTarget["poke8"];

  target.peek16 = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      "i16",
    )) as unknown as MemoryAccessorTarget["peek16"];
  target.poke16 = ((pointer: WasmPointer | WasmPointer[], value: number) =>
    target.poke!(pointer, value, "i16")) as MemoryAccessorTarget["poke16"];

  target.peek32 = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      "i32",
    )) as unknown as MemoryAccessorTarget["peek32"];
  target.poke32 = ((pointer: WasmPointer | WasmPointer[], value: number) =>
    target.poke!(pointer, value, "i32")) as MemoryAccessorTarget["poke32"];

  target.peek64 = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      "i64",
    )) as unknown as MemoryAccessorTarget["peek64"];
  target.poke64 = ((
    pointer: WasmPointer | WasmPointer[],
    value: number | bigint,
  ) => target.poke!(pointer, value, "i64")) as MemoryAccessorTarget["poke64"];

  target.peek32f = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      "f32",
    )) as unknown as MemoryAccessorTarget["peek32f"];
  target.poke32f = ((pointer: WasmPointer | WasmPointer[], value: number) =>
    target.poke!(pointer, value, "f32")) as MemoryAccessorTarget["poke32f"];

  target.peek64f = ((...args: WasmPointer[]) =>
    target.peek!(
      packPointerArgs(args),
      "f64",
    )) as unknown as MemoryAccessorTarget["peek64f"];
  target.poke64f = ((pointer: WasmPointer | WasmPointer[], value: number) =>
    target.poke!(pointer, value, "f64")) as MemoryAccessorTarget["poke64f"];

  target.getMemValue = target.peek;
  target.getPtrValue = target.peekPtr;
  target.setMemValue = target.poke;
  target.setPtrValue = target.pokePtr;

  target.isPtr32 = isPtr32;
  target.isPtr = isPtr32;
  // 3. Output handling
}
