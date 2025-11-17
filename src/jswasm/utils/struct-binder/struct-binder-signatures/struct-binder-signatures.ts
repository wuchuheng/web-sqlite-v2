import { toss } from "../struct-binder-helpers/struct-binder-helpers.js";

export type CreateSignatureHelpersConfig = {
  ptrSizeof: number;
  ptrIR: string;
  bigIntEnabled: boolean;
};

export type SignatureHelpers = {
  glyphFor(signature: string): string | undefined;
  isAutoPointer(signature: string): boolean;
  irFor(signature: string): string;
  getterFor(signature: string): string;
  setterFor(signature: string): string;
  wrapForSet(signature: string): typeof Number | typeof BigInt;
};

const glyphFromSignature = (signature: string): string | undefined => {
  if (!signature) return undefined;
  if (signature.length > 1 && signature[1] === "(") {
    return "p";
  }
  return signature[0];
};

export const createSignatureHelpers = (
  config: CreateSignatureHelpersConfig,
): SignatureHelpers => {
  const { ptrSizeof, ptrIR, bigIntEnabled } = config;
  const BigInt64ArrayCtor = globalThis.BigInt64Array;

  const ensureBigInt = (): void => {
    if (!bigIntEnabled || !BigInt64ArrayCtor) {
      toss("BigInt64Array is not available.");
    }
  };

  const glyphFor = (signature: string): string | undefined =>
    glyphFromSignature(signature);

  return {
    glyphFor,
    isAutoPointer(signature: string): boolean {
      return signature === "P";
    },
    irFor(signature: string): string {
      const glyph = glyphFor(signature);
      switch (glyph) {
        case "c":
        case "C":
          return "i8";
        case "i":
          return "i32";
        case "p":
        case "P":
        case "s":
          return ptrIR;
        case "j":
          return "i64";
        case "f":
          return "float";
        case "d":
          return "double";
        default:
          return toss("Unhandled signature IR:", signature);
      }
    },
    getterFor(signature: string): string {
      const glyph = glyphFor(signature);
      switch (glyph) {
        case "p":
        case "P":
        case "s":
          if (ptrSizeof === 8) {
            ensureBigInt();
            return "getBigInt64";
          }
          return "getInt32";
        case "i":
          return "getInt32";
        case "c":
          return "getInt8";
        case "C":
          return "getUint8";
        case "j":
          ensureBigInt();
          return "getBigInt64";
        case "f":
          return "getFloat32";
        case "d":
          return "getFloat64";
        default:
          return toss("Unhandled DataView getter for signature:", signature);
      }
    },
    setterFor(signature: string): string {
      const glyph = glyphFor(signature);
      switch (glyph) {
        case "p":
        case "P":
        case "s":
          if (ptrSizeof === 8) {
            ensureBigInt();
            return "setBigInt64";
          }
          return "setInt32";
        case "i":
          return "setInt32";
        case "c":
          return "setInt8";
        case "C":
          return "setUint8";
        case "j":
          ensureBigInt();
          return "setBigInt64";
        case "f":
          return "setFloat32";
        case "d":
          return "setFloat64";
        default:
          return toss("Unhandled DataView setter for signature:", signature);
      }
    },
    wrapForSet(signature: string): typeof Number | typeof BigInt {
      const glyph = glyphFor(signature);
      switch (glyph) {
        case "i":
        case "f":
        case "c":
        case "C":
        case "d":
          return Number;
        case "j":
          ensureBigInt();
          return BigInt;
        case "p":
        case "P":
        case "s":
          if (ptrSizeof === 8) {
            ensureBigInt();
            return BigInt;
          }
          return Number;
        default:
          return toss("Unhandled setter wrapper for signature:", signature);
      }
    },
  };
};
