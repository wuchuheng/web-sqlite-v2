type SerializationValue = string | number | bigint | boolean;

interface SerializationBufferOptions {
  readonly sharedBuffer: SharedArrayBuffer;
  readonly offset: number;
  readonly size: number;
  readonly littleEndian: boolean;
  readonly exceptionVerbosity: number;
}

type SerializableError =
  | Error
  | DOMException
  | string
  | number
  | bigint
  | boolean
  | symbol
  | { readonly name?: string; readonly message?: string };

type TypeHandler<T extends SerializationValue> = {
  readonly id: number;
  readonly size?: number;
  write(
    view: DataView,
    offset: number,
    value: T,
    littleEndian: boolean,
    encoder: TextEncoder,
  ): number;
  read(
    view: DataView,
    offset: number,
    littleEndian: boolean,
    decoder: TextDecoder,
  ): T;
};

class SBImpl {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  private readonly littleEndian: boolean;
  private readonly exceptionVerbosity: number;
  private readonly textEncoder: TextEncoder;
  private readonly textDecoder: TextDecoder;
  private readonly handlersByType: Record<
    "number" | "bigint" | "boolean" | "string",
    TypeHandler<SerializationValue>
  >;
  private readonly handlersById: Record<
    number,
    TypeHandler<SerializationValue>
  >;

  constructor({
    sharedBuffer,
    offset,
    size,
    littleEndian,
    exceptionVerbosity,
  }: SerializationBufferOptions) {
    this.bytes = new Uint8Array(sharedBuffer, offset, size);
    this.view = new DataView(sharedBuffer, offset, size);
    this.littleEndian = littleEndian;
    this.exceptionVerbosity = exceptionVerbosity;
    this.textEncoder = new TextEncoder();
    this.textDecoder = new TextDecoder();

    const handlers: ReadonlyArray<TypeHandler<SerializationValue>> = [
      {
        id: 1,
        size: 8,
        write: (view, off, val, le) => {
          view.setFloat64(off, val as number, le);
          return 8;
        },
        read: (view, off, le) => view.getFloat64(off, le),
      },
      {
        id: 2,
        size: 8,
        write: (view, off, val, le) => {
          view.setBigInt64(off, val as bigint, le);
          return 8;
        },
        read: (view, off, le) => view.getBigInt64(off, le),
      },
      {
        id: 3,
        size: 4,
        write: (view, off, val, le) => {
          view.setInt32(off, (val as boolean) ? 1 : 0, le);
          return 4;
        },
        read: (view, off, le) => view.getInt32(off, le),
      },
      {
        id: 4,
        write: (view, off, val, le, encoder) => {
          const encoded = encoder.encode(val as string);
          view.setInt32(off, encoded.byteLength, le);
          const bytes = new Uint8Array(
            view.buffer,
            view.byteOffset + off + 4,
            encoded.byteLength,
          );
          bytes.set(encoded);
          return 4 + encoded.byteLength;
        },
        read: (view, off, le, decoder) => {
          const length = view.getInt32(off, le);
          const sharedBytes = new Uint8Array(
            view.buffer,
            view.byteOffset + off + 4,
            length,
          );
          const copy = new Uint8Array(length);
          copy.set(sharedBytes);
          return decoder.decode(copy);
        },
      },
    ];

    this.handlersById = {} as Record<number, TypeHandler<SerializationValue>>;
    for (const handler of handlers) {
      this.handlersById[handler.id] = handler;
    }
    this.handlersByType = {
      number: this.handlersById[1],
      bigint: this.handlersById[2],
      boolean: this.handlersById[3],
      string: this.handlersById[4],
    } as const;
  }

  serialize(...values: readonly SerializationValue[]): void {
    if (!values.length) {
      this.bytes[0] = 0;
      return;
    }
    const activeHandlers = values.map((value) => {
      const handler =
        this.handlersByType[
          typeof value as "number" | "bigint" | "boolean" | "string"
        ];
      if (!handler) {
        toss(
          "Maintenance required: this value type cannot be serialized.",
          String(value),
        );
      }
      return handler;
    });
    let offset = 1;
    this.bytes[0] = values.length & 0xff;
    for (const handler of activeHandlers) {
      this.bytes[offset++] = handler.id;
    }
    for (let i = 0; i < values.length; i++) {
      const handler = activeHandlers[i];
      const value = values[i];
      try {
        const written = handler.write(
          this.view,
          offset,
          value,
          this.littleEndian,
          this.textEncoder,
        );
        offset += written;
      } catch (error: unknown) {
        toss("Serialization failed for value:", String(value), String(error));
      }
    }
  }

  deserialize(clear = false): SerializationValue[] {
    const argc = this.bytes[0];
    if (!argc) {
      if (clear) this.bytes[0] = 0;
      return [];
    }
    const handlers: TypeHandler<SerializationValue>[] = [];
    let offset = 1;
    for (let i = 0; i < argc; i++) {
      handlers.push(this.handlersById[this.bytes[offset++]]);
    }
    const values: SerializationValue[] = [];
    for (const handler of handlers) {
      values.push(
        handler.read(this.view, offset, this.littleEndian, this.textDecoder),
      );
      if (handler.size !== undefined) {
        offset += handler.size;
      } else {
        const length = this.view.getInt32(offset, this.littleEndian);
        offset += 4 + length;
      }
    }
    if (clear) {
      this.bytes[0] = 0;
    }
    return values;
  }

  storeException(priority: number, error: SerializableError): void {
    if (this.exceptionVerbosity <= 0 || priority > this.exceptionVerbosity) {
      return;
    }
    if (!error || typeof error !== "object") {
      this.serialize(String((error as unknown) ?? "Unknown error"));
      return;
    }
    const { name = "Error", message = "" } = error as Error;
    this.serialize(`${name}: ${message}`);
  }
}

(
  globalThis as unknown as { SerializationBuffer: unknown }
).SerializationBuffer = SBImpl;
