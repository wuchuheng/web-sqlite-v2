import type {
  Sqlite3DebugFlagController,
  Sqlite3StructBinder,
  Sqlite3StructBinderConfig,
  Sqlite3StructConstructor,
  Sqlite3StructDefinition,
  Sqlite3StructInstance,
  WasmPointer,
} from "../../../wasm/bootstrap/runtime/sqlite3-facade-namespace";
import {
  INTERNAL_STRUCT_TOKEN,
  defineReadonly,
} from "../struct-binder-helpers/struct-binder-helpers";
import {
  type StructConstructor,
  type StructDefinition,
  type StructDefinitionWithName,
  defineMemberAccessors,
  normalizeStructArgs,
  validateStructDefinition,
} from "../struct-binder-accessors/struct-binder-accessors";
import {
  type StructTypeClass,
  type StructTypeInstance,
  createStructType,
} from "../struct-binder-struct-type/struct-binder-struct-type";
import {
  createContext,
  type StructBinderContext,
  type StructBinderFactoryDebugSupport,
} from "../struct-binder-context/struct-binder-context";

type Mutable<T> = {
  -readonly [K in keyof T]: T[K];
};

type StructBinderInternal = Mutable<Sqlite3StructBinder>;

type DebugFlagFactory = NonNullable<
  StructBinderFactoryDebugSupport["__makeDebugFlags"]
>;

type StructBinderFactoryFn = ((
  config: Sqlite3StructBinderConfig,
) => Sqlite3StructBinder) &
  StructBinderFactoryDebugSupport;

type NormalizedStruct = {
  name: string;
  info: StructDefinitionWithName & Sqlite3StructDefinition;
};

const resolveDebugFlagFactory = (
  factory: StructBinderFactoryDebugSupport,
): DebugFlagFactory => {
  const debugFactory = factory.__makeDebugFlags;
  if (!debugFactory) {
    throw new Error("Struct binder debug flags are not initialized.");
  }
  return debugFactory;
};

/**
 * Creates a struct binder configured for a WASM heap by wiring the shared
 * struct binder context (memory helpers, signatures, StructType base class).
 *
 * @param config - Low-level heap accessors, allocator hooks, and pointer metadata.
 * @returns A callable binder that turns struct definitions into constructors.
 */
const StructBinderFactory: StructBinderFactoryFn = ((config) => {
  const context: StructBinderContext = createContext(
    config,
    StructBinderFactory,
  );
  const StructType: StructTypeClass = createStructType(context);

  const structBinderImpl = function structBinderImpl(
    structNameOrInfo: string | Sqlite3StructDefinition,
    structInfo?: Sqlite3StructDefinition,
  ): Sqlite3StructConstructor {
    const { name, info } = normalizeStructArgs(
      structNameOrInfo as string | StructDefinition,
      structInfo as StructDefinition | undefined,
    ) as NormalizedStruct;
    validateStructDefinition(name, info);

    const debugFlags = resolveDebugFlagFactory(StructBinderFactory)(
      StructBinder.debugFlags,
    );

    /**
     * Struct constructor tailored to a single struct definition. Each instance
     * delegates to the shared StructType base for member access and cleanup.
     */
    class StructCtor extends StructType {
      declare static debugFlags: Sqlite3DebugFlagController;
      declare static isA: (value: unknown) => value is StructTypeInstance;
      declare static memberKey: (memberName: string) => string;
      declare static memberKeys: () => string[];
      declare static methodInfoForKey: () => undefined;
      declare static structInfo: Sqlite3StructDefinition;
      declare static structName: string;
      declare readonly debugFlags: Sqlite3DebugFlagController;

      constructor(externalPointer?: WasmPointer) {
        const pointer =
          arguments.length > 0
            ? context.validateExternalPointer(name, externalPointer)
            : undefined;
        super(name, info, INTERNAL_STRUCT_TOKEN);
        context.allocStruct(
          this.constructor as Sqlite3StructConstructor,
          this as unknown as Sqlite3StructInstance,
          pointer,
        );
      }
    }

    defineReadonly(StructCtor, "debugFlags", debugFlags);
    defineReadonly(
      StructCtor,
      "isA",
      (value: unknown): value is StructTypeInstance =>
        value instanceof StructCtor,
    );
    defineReadonly(StructCtor, "memberKey", (memberName: string) =>
      context.memberKey(memberName),
    );
    defineReadonly(StructCtor, "memberKeys", () => context.memberKeys(info));
    defineReadonly(StructCtor, "methodInfoForKey", (): undefined => undefined);
    defineReadonly(StructCtor, "structInfo", info);
    defineReadonly(StructCtor, "structName", name);
    defineReadonly(StructCtor.prototype, "debugFlags", debugFlags);

    Object.entries(info.members).forEach(([memberName, descriptor]) => {
      defineMemberAccessors(
        StructCtor as unknown as StructConstructor,
        memberName,
        descriptor,
        context,
      );
    });

    return StructCtor as unknown as Sqlite3StructConstructor;
  };

  const StructBinder = structBinderImpl as unknown as StructBinderInternal;

  StructBinder.StructType = StructType as unknown as Sqlite3StructConstructor;
  StructBinder.config = config;
  StructBinder.allocCString = (value: string): WasmPointer =>
    context.allocCString(value);
  if (!StructBinder.debugFlags) {
    StructBinder.debugFlags = resolveDebugFlagFactory(StructBinderFactory)(
      StructBinderFactory.debugFlags,
    );
  }

  return StructBinder;
}) as StructBinderFactoryFn;

export { StructBinderFactory };
