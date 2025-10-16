"use strict";

/* global toss */

/** @typedef {import("./serialization-buffer.d.ts").SerializationValue} SerializationValue */
/** @typedef {import("./serialization-buffer.d.ts").SerializationBufferOptions} SerializationBufferOptions */

/**
 * Handles serialization/deserialization of arguments across a SharedArrayBuffer.
 */
class SerializationBuffer {
    /**
     * @param {SerializationBufferOptions} options - Construction options.
     */
    constructor({ sharedBuffer, offset, size, littleEndian, exceptionVerbosity }) {
        this.bytes = new Uint8Array(sharedBuffer, offset, size);
        this.view = new DataView(sharedBuffer, offset, size);
        this.littleEndian = littleEndian;
        this.exceptionVerbosity = exceptionVerbosity;
        this.textEncoder = new TextEncoder();
        this.textDecoder = new TextDecoder();

        /**
         * Metadata for the supported value kinds.
         * @type {Record<string, {id:number,size?:number,getter?:string,setter?:string}>}
         */
        this.typeInfo = {
            number: { id: 1, size: 8, getter: "getFloat64", setter: "setFloat64" },
            bigint: { id: 2, size: 8, getter: "getBigInt64", setter: "setBigInt64" },
            boolean: { id: 3, size: 4, getter: "getInt32", setter: "setInt32" },
            string: { id: 4 },
        };
        this.typeInfoById = Object.fromEntries(
            Object.values(this.typeInfo).map((info) => [info.id, info])
        );
    }

    /**
     * Encodes arbitrary values into the shared buffer.
     *
     * @param {...SerializationValue} values - Values stored for the consumer.
     */
    serialize(...values) {
        if (!values.length) {
            this.bytes[0] = 0;
            return;
        }
        const typeDescriptors = values.map((value) => {
            const descriptor = this.typeInfo[typeof value];
            if (!descriptor) {
                toss(
                    "Maintenance required: this value type cannot be serialized.",
                    value
                );
            }
            return descriptor;
        });

        let offset = 1;
        this.bytes[0] = values.length & 0xff;
        for (const descriptor of typeDescriptors) {
            this.bytes[offset++] = descriptor.id;
        }
        for (let i = 0; i < values.length; i++) {
            const descriptor = typeDescriptors[i];
            const value = values[i];
            if (descriptor.setter) {
                this.view[descriptor.setter](offset, value, this.littleEndian);
                offset += descriptor.size;
            } else {
                const encoded = this.textEncoder.encode(value);
                this.view.setInt32(offset, encoded.byteLength, this.littleEndian);
                offset += 4;
                this.bytes.set(encoded, offset);
                offset += encoded.byteLength;
            }
        }
    }

    /**
     * Reads data previously written by {@link serialize}.
     *
     * @param {boolean} clear - When true the buffer is marked empty after reading.
     * @returns {SerializationValue[]} Payload values (empty if nothing was stored).
     */
    deserialize(clear = false) {
        const argc = this.bytes[0];
        if (!argc) {
            if (clear) this.bytes[0] = 0;
            return [];
        }

        const values = [];
        const types = [];
        let offset = 1;
        for (let i = 0; i < argc; i++, offset++) {
            types.push(this.typeInfoById[this.bytes[offset]]);
        }
        for (const descriptor of types) {
            if (descriptor.getter) {
                values.push(this.view[descriptor.getter](offset, this.littleEndian));
                offset += descriptor.size;
            } else {
                const length = this.view.getInt32(offset, this.littleEndian);
                offset += 4;
                const slice = this.bytes.slice(offset, offset + length);
                values.push(this.textDecoder.decode(slice));
                offset += length;
            }
        }

        if (clear) this.bytes[0] = 0;
        return values;
    }

    /**
     * Conditionally serializes an exception string based on the configured threshold.
     *
     * @param {number} priority - Smaller numbers represent higher priority.
     * @param {import("./serialization-buffer.d.ts").SerializableError} error - Error object to stringify.
     */
    storeException(priority, error) {
        if (this.exceptionVerbosity <= 0 || priority > this.exceptionVerbosity) {
            return;
        }
        if (!error || typeof error !== "object") {
            this.serialize(String(error ?? "Unknown error"));
            return;
        }
        const { name = "Error", message = "" } = /** @type {Error} */ (error);
        this.serialize(`${name}: ${message}`);
    }
}
globalThis.SerializationBuffer = SerializationBuffer;
