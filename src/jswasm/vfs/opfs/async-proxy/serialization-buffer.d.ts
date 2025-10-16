export type SerializableValue = string | number | boolean | bigint;

export interface SerializationBufferInit {
    sharedBuffer: SharedArrayBuffer;
    offset: number;
    size: number;
    littleEndian: boolean;
    exceptionVerbosity: number;
}

export interface TypeDescriptor {
    id: number;
    size?: number;
    getter?: keyof DataView;
    setter?: keyof DataView;
}

export type SerializableError =
    | Error
    | DOMException
    | string
    | number
    | boolean
    | bigint;

export declare class SerializationBuffer {
    constructor(options: SerializationBufferInit);
    serialize(...values: SerializableValue[]): void;
    deserialize(clear?: boolean): SerializableValue[];
    storeException(priority: number, error: SerializableError): void;
}
