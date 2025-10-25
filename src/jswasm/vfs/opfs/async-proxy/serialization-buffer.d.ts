export type SerializationValue = string | number | bigint | boolean;

export interface SerializationBufferOptions {
  readonly sharedBuffer: SharedArrayBuffer;
  readonly offset: number;
  readonly size: number;
  readonly littleEndian: boolean;
  readonly exceptionVerbosity: number;
}

export type SerializableError =
  | Error
  | DOMException
  | string
  | number
  | bigint
  | boolean
  | symbol
  | { readonly name?: string; readonly message?: string };

export declare class SerializationBuffer {
  constructor(options: SerializationBufferOptions);
  serialize(...values: ReadonlyArray<SerializationValue>): void;
  deserialize(clear?: boolean): SerializationValue[];
  storeException(priority: number, error: SerializableError): void;
}
