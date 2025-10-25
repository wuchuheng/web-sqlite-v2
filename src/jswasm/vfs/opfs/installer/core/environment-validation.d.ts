/**
 * Type definitions for environment-validation module
 * @module core/environment-validation
 */

/**
 * Validates OPFS environment and returns error if unsupported
 * @param globalScope - The global scope object (typically globalThis)
 * @returns Error object if validation fails, null if environment is valid
 */
export function validateOpfsEnvironment(
  globalScope: typeof globalThis,
): Error | null;

/**
 * Checks if the current thread has OPFS APIs available
 * @returns True if OPFS APIs are available in current thread
 */
export function thisThreadHasOPFS(): boolean;
