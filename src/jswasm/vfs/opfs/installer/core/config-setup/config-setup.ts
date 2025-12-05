import type {
  OpfsConfig,
  OpfsInstallerOptions,
} from "../../../../../shared/opfs-vfs-installer";

export type PrepareOpfsConfigResult =
  | (OpfsConfig & { disabled: false })
  | { disabled: true };

/**
 * Normalizes and prepares OPFS configuration options.
 * URL query parameters override defaults when caller options are missing.
 * Returns a disabled-only configuration when `opfs-disable` is present.
 *
 * @param options - Raw user options.
 * @param defaultProxyUri - Default proxy worker URI.
 * @returns Normalized configuration or a disabled marker when OPFS is turned off.
 */
export function prepareOpfsConfig(
  options: OpfsInstallerOptions | null | undefined,
  defaultProxyUri: string,
): PrepareOpfsConfigResult {
  // 1. Input handling
  const normalizedOptions: OpfsInstallerOptions =
    options && typeof options === "object"
      ? options
      : (Object.create(null) as OpfsInstallerOptions);

  const urlParams = new URL(globalThis.location.href).searchParams;

  if (urlParams.has("opfs-disable")) {
    return { disabled: true };
  }

  // 2. Core processing
  const verbose =
    normalizedOptions.verbose ??
    (urlParams.has("opfs-verbose") ? +urlParams.get("opfs-verbose")! || 2 : 1);

  const sanityChecks =
    normalizedOptions.sanityChecks ?? urlParams.has("opfs-sanity-check");

  let proxyUri = normalizedOptions.proxyUri ?? defaultProxyUri;
  if (typeof proxyUri === "function") {
    proxyUri = proxyUri();
  }

  normalizedOptions.verbose = verbose;
  normalizedOptions.sanityChecks = sanityChecks;
  normalizedOptions.proxyUri = proxyUri;

  // 3. Output handling
  return {
    verbose,
    sanityChecks,
    proxyUri,
    disabled: false,
  };
}
