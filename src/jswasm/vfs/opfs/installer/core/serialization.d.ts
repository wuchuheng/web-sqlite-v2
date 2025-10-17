/**
 * Type definitions for serialization module
 * @module core/serialization
 */

import type {
  OpfsState,
  SerializerInterface,
} from "../../../shared/opfs-vfs-installer";

/**
 * Creates serializer for SharedArrayBuffer communication between threads
 * @param state - OPFS state object containing buffer views
 * @param toss - Error throwing utility function
 * @returns Serializer interface with serialize and deserialize methods
 */
export function createSerializer(
  state: OpfsState,
  toss: (...args: unknown[]) => never
): SerializerInterface;
