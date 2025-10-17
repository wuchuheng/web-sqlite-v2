/**
 * Creates a serialization/deserialization utility for SharedArrayBuffer communication.
 * @param {import('../../../../../../shared/opfs-vfs-installer').OpfsState} state - OPFS state object
 * @param {import('./serialization.d.ts').SerializerDeps['toss']} toss - Error throwing utility
 * @returns {import('./serialization.d.ts').SerializerInterface} Serialization interface with serialize and deserialize methods
 */
export function createSerializer(state, toss) {
    // 1. Input handling
    const textDecoder = new TextDecoder();
    const textEncoder = new TextEncoder("utf-8");
    const viewU8 = new Uint8Array(
        state.sabIO,
        state.sabS11nOffset,
        state.sabS11nSize
    );
    const viewDV = new DataView(
        state.sabIO,
        state.sabS11nOffset,
        state.sabS11nSize
    );

    // 2. Core processing
    // 2.1 Define type identifiers
    const TypeIds = Object.create(null);
    TypeIds.number = {
        id: 1,
        size: 8,
        getter: "getFloat64",
        setter: "setFloat64",
    };
    TypeIds.bigint = {
        id: 2,
        size: 8,
        getter: "getBigInt64",
        setter: "setBigInt64",
    };
    TypeIds.boolean = {
        id: 3,
        size: 4,
        getter: "getInt32",
        setter: "setInt32",
    };
    TypeIds.string = { id: 4 };

    // 2.2 Helper: Get type ID from value
    const getTypeId = (v) =>
        TypeIds[typeof v] ||
        toss("Maintenance required: this value type cannot be serialized.", v);

    // 2.3 Helper: Get type descriptor from ID
    const getTypeIdById = (tid) => {
        switch (tid) {
            case TypeIds.number.id:
                return TypeIds.number;
            case TypeIds.bigint.id:
                return TypeIds.bigint;
            case TypeIds.boolean.id:
                return TypeIds.boolean;
            case TypeIds.string.id:
                return TypeIds.string;
            default:
                toss("Invalid type ID:", tid);
        }
    };

    // 3. Output handling
    return {
        /**
         * Deserializes data from the shared buffer.
         * @param {boolean} clear - Whether to clear buffer after read
         * @returns {Array|null} Deserialized values or null if empty
         */
        deserialize(clear = false) {
            // 1. Input handling
            const argc = viewU8[0];
            const rc = argc ? [] : null;

            if (!argc) {
                return rc;
            }

            // 2. Core processing
            // 2.1 Read type IDs
            const typeIds = [];
            let offset = 1;
            for (let i = 0; i < argc; ++i, ++offset) {
                typeIds.push(getTypeIdById(viewU8[offset]));
            }

            // 2.2 Read values
            for (let i = 0; i < argc; ++i) {
                const t = typeIds[i];
                let v;
                if (t.getter) {
                    v = viewDV[t.getter](offset, state.littleEndian);
                    offset += t.size;
                } else {
                    const n = viewDV.getInt32(offset, state.littleEndian);
                    offset += 4;
                    v = textDecoder.decode(viewU8.slice(offset, offset + n));
                    offset += n;
                }
                rc.push(v);
            }

            // 3. Output handling
            if (clear) viewU8[0] = 0;
            return rc;
        },

        /**
         * Serializes arguments into the shared buffer.
         * @param {...any} args - Values to serialize
         */
        serialize(...args) {
            // 1. Input handling
            if (!args.length) {
                viewU8[0] = 0;
                return;
            }

            // 2. Core processing
            // 2.1 Write type IDs
            const typeIds = [];
            let offset = 1;
            viewU8[0] = args.length & 0xff;
            for (let i = 0; i < args.length; ++i, ++offset) {
                typeIds.push(getTypeId(args[i]));
                viewU8[offset] = typeIds[i].id;
            }

            // 2.2 Write values
            for (let i = 0; i < args.length; ++i) {
                const t = typeIds[i];
                if (t.setter) {
                    viewDV[t.setter](offset, args[i], state.littleEndian);
                    offset += t.size;
                } else {
                    const s = textEncoder.encode(args[i]);
                    viewDV.setInt32(offset, s.byteLength, state.littleEndian);
                    offset += 4;
                    viewU8.set(s, offset);
                    offset += s.byteLength;
                }
            }
        },
    };
}
