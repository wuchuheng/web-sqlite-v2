import { toss } from "./struct-binder-helpers.mjs";

export const createSignatureHelpers = ({ ptrSizeof, ptrIR, bigIntEnabled }) => {
    const BigInt64ArrayCtor = globalThis.BigInt64Array;
    const ensureBigInt = () => {
        if (!bigIntEnabled || !BigInt64ArrayCtor) {
            toss("BigInt64Array is not available.");
        }
    };

    const glyphFor = (signature) =>
        signature && signature.length > 1 && signature[1] === "("
            ? "p"
            : signature
              ? signature[0]
              : undefined;

    return {
        glyphFor,
        isAutoPointer: (signature) => signature === "P",
        irFor(signature) {
            switch (glyphFor(signature)) {
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
                    toss("Unhandled signature IR:", signature);
            }
        },
        getterFor(signature) {
            switch (glyphFor(signature)) {
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
                    toss("Unhandled DataView getter for signature:", signature);
            }
        },
        setterFor(signature) {
            switch (glyphFor(signature)) {
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
                    toss("Unhandled DataView setter for signature:", signature);
            }
        },
        wrapForSet(signature) {
            switch (glyphFor(signature)) {
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
                    toss("Unhandled setter wrapper for signature:", signature);
            }
        },
    };
};
