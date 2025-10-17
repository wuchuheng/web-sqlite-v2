/**
 * Type definitions for config-setup module
 * @module core/config-setup
 */

import type {
  OpfsInstallerOptions,
  OpfsConfig,
} from "../../../shared/opfs-vfs-installer";

/**
 * Normalizes and prepares OPFS configuration options
 * @param options - Raw user options
 * @param defaultProxyUri - Default proxy worker URI
 * @returns Normalized configuration with all required properties
 */
export function prepareOpfsConfig(
  options: OpfsInstallerOptions | null | undefined,
  defaultProxyUri: string
): OpfsConfig;
