/**
 * Shared helpers used by the StructBinder runtime.
 */

export const DEBUG_FLAG_MASK = {
    getter: 0x01,
    setter: 0x02,
    alloc: 0x04,
    dealloc: 0x08,
};

export const RX_SIG_SIMPLE = /^[ipPsjfdcC]$/;
export const RX_SIG_FUNCTION = /^[vipPsjfdcC]\([ipPsjfdcC]*\)$/;
export const INTERNAL_STRUCT_TOKEN = Symbol("StructTypeInternal");

export const toss = (...parts) => {
    throw new Error(parts.join(" "));
};

export const defineReadonly = (target, key, value) =>
    Object.defineProperty(target, key, {
        configurable: false,
        enumerable: false,
        writable: false,
        value,
    });

export const describeMember = (structName, memberKey) =>
    `${structName}::${memberKey}`;

export const isNumericValue = (value) =>
    typeof value === "number"
        ? Number.isFinite(value)
        : typeof value === "bigint" ||
          (value instanceof Number && Number.isFinite(value.valueOf()));

export const detectLittleEndian = () => {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setInt16(0, 256, true);
    return new Int16Array(buffer)[0] === 256;
};
