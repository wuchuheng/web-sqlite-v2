/**
 * @fileoverview Memory peek/poke helpers for the wh-wasm utilities.
 */

/**
 * Installs pointer-aware peek/poke helpers and numeric inspections.
 *
 * @param {import("./installer-context.mjs").WhWasmInstallerContext} context
 */
export function attachMemoryAccessors(context) {
    const { target, ptrIR } = context;

    const readValue = (ptr, type) => {
        const heap = context.getHeapViews();
        switch (type) {
            case "i1":
            case "i8":
                return heap.HEAP8[ptr >> 0];
            case "i16":
                return heap.HEAP16[ptr >> 1];
            case "i32":
                return heap.HEAP32[ptr >> 2];
            case "float":
            case "f32":
                return heap.HEAP32F[ptr >> 2];
            case "double":
            case "f64":
                return Number(heap.HEAP64F[ptr >> 3]);
            case "i64":
                if (target.bigIntEnabled) {
                    return BigInt(heap.HEAP64[ptr >> 3]);
                }
                context.toss("Invalid type for peek():", type);
                break;
            default:
                context.toss("Invalid type for peek():", type);
        }
    };

    const writeValue = (ptr, value, type) => {
        const heap = context.getHeapViews();
        switch (type) {
            case "i1":
            case "i8":
                heap.HEAP8[ptr >> 0] = value;
                return;
            case "i16":
                heap.HEAP16[ptr >> 1] = value;
                return;
            case "i32":
                heap.HEAP32[ptr >> 2] = value;
                return;
            case "float":
            case "f32":
                heap.HEAP32F[ptr >> 2] = value;
                return;
            case "double":
            case "f64":
                heap.HEAP64F[ptr >> 3] = value;
                return;
            case "i64":
                if (heap.HEAP64) {
                    heap.HEAP64[ptr >> 3] = BigInt(value);
                    return;
                }
                context.toss("Invalid type for poke():", type);
                break;
            default:
                context.toss("Invalid type for poke():", type);
        }
    };

    /**
     * Reads one or more values from wasm memory according to an IR signature.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {import("../../sqlite3.d.ts").PeekType} [type="i8"]
     * @returns {number | bigint | (number | bigint)[]}
     */
    target.peek = (ptr, type = "i8") => {
        const requests = Array.isArray(ptr) ? ptr : [ptr];
        const resolvedType = type.endsWith("*") ? ptrIR : type;
        const results = requests.map((address) =>
            readValue(address, resolvedType)
        );
        return Array.isArray(ptr) ? results : results[0];
    };

    /**
     * Writes one or more values to wasm memory according to an IR signature.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number | bigint} value
     * @param {import("../../sqlite3.d.ts").PokeType} [type="i8"]
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke = (ptr, value, type = "i8") => {
        const targets = Array.isArray(ptr) ? ptr : [ptr];
        const resolvedType = type.endsWith("*") ? ptrIR : type;
        for (const address of targets) {
            writeValue(address, value, resolvedType);
        }
        return target;
    };

    /**
     * Reads a pointer-sized value from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]}
     */
    target.peekPtr = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, ptrIR);
    /**
     * Writes a pointer-sized value into wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {import("../../sqlite3.d.ts").WasmPointer} [value=0]
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.pokePtr = (ptr, value = 0) => target.poke(ptr, value, ptrIR);
    /**
     * Reads signed 8-bit values from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {number | number[]}
     */
    target.peek8 = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, "i8");
    /**
     * Writes signed 8-bit values to wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number} value
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke8 = (ptr, value) => target.poke(ptr, value, "i8");
    /**
     * Reads signed 16-bit values from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {number | number[]}
     */
    target.peek16 = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, "i16");
    /**
     * Writes signed 16-bit values to wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number} value
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke16 = (ptr, value) => target.poke(ptr, value, "i16");
    /**
     * Reads signed 32-bit values from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {number | number[]}
     */
    target.peek32 = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, "i32");
    /**
     * Writes signed 32-bit values to wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number} value
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke32 = (ptr, value) => target.poke(ptr, value, "i32");
    /**
     * Reads 64-bit integer values from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {bigint | (bigint | number)[]}
     */
    target.peek64 = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, "i64");
    /**
     * Writes 64-bit integer values into wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number | bigint} value
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke64 = (ptr, value) => target.poke(ptr, value, "i64");
    /**
     * Reads 32-bit floating point values from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {number | number[]}
     */
    target.peek32f = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, "f32");
    /**
     * Writes 32-bit floating point values into wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number} value
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke32f = (ptr, value) => target.poke(ptr, value, "f32");
    /**
     * Reads 64-bit floating point values from wasm memory.
     *
     * @param {...import("../../sqlite3.d.ts").WasmPointer} args
     * @returns {number | number[]}
     */
    target.peek64f = (...args) =>
        target.peek(args.length === 1 ? args[0] : args, "f64");
    /**
     * Writes 64-bit floating point values into wasm memory.
     *
     * @param {import("../../sqlite3.d.ts").WasmPointer | import("../../sqlite3.d.ts").WasmPointer[]} ptr
     * @param {number} value
     * @returns {import("../../sqlite3.d.ts").SQLite3Wasm}
     */
    target.poke64f = (ptr, value) => target.poke(ptr, value, "f64");

    target.getMemValue = target.peek;
    target.getPtrValue = target.peekPtr;
    target.setMemValue = target.poke;
    target.setPtrValue = target.pokePtr;

    /**
     * Determines whether the provided value is a 32-bit pointer.
     *
     * @param {unknown} ptr
     * @returns {ptr is import("../../sqlite3.d.ts").WasmPointer}
     */
    target.isPtr32 = (ptr) =>
        typeof ptr === "number" && ptr === (ptr | 0) && ptr >= 0;
    /**
     * Determines whether the provided value is a pointer for the active build.
     *
     * @param {unknown} ptr
     * @returns {ptr is import("../../sqlite3.d.ts").WasmPointer}
     */
    target.isPtr = target.isPtr32;
}
