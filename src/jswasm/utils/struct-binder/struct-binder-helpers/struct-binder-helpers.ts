export const DEBUG_FLAG_MASK = {
  getter: 0x01,
  setter: 0x02,
  alloc: 0x04,
  dealloc: 0x08,
} as const;

export const RX_SIG_SIMPLE = /^[ipPsjfdcC]$/;
export const RX_SIG_FUNCTION = /^[vipPsjfdcC]\([ipPsjfdcC]*\)$/;
export const INTERNAL_STRUCT_TOKEN = Symbol("StructTypeInternal");

export type NumericValue = number | bigint | number;

export const toss = (...parts: Array<unknown>): never => {
  throw new Error(parts.join(" "));
};

export const defineReadonly = (
  target: object,
  key: string | symbol,
  value: unknown,
): void => {
  Object.defineProperty(target, key, {
    configurable: false,
    enumerable: false,
    writable: false,
    value,
  });
};

export const describeMember = (structName: string, memberKey: string): string =>
  `${structName}::${memberKey}`;

export const isNumericValue = (value: unknown): value is NumericValue => {
  // 1. Handle primitive numbers first to avoid extra work.
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  // 2. Accept bigint and finite Number wrappers.
  return (
    typeof value === "bigint" ||
    (value instanceof Number && Number.isFinite(value.valueOf()))
  );
};

export const detectLittleEndian = (): boolean => {
  // 1. Create a tiny buffer and write a known value in little-endian.
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setInt16(0, 256, true);

  // 2. Inspect the buffer via Int16Array to determine the current endianness.
  return new Int16Array(buffer)[0] === 256;
};
