/**
 * Normalizes and prepares OPFS configuration options.
 * @param {Partial<import('./config-setup.d.ts').OpfsConfig>} [options] - Raw user options
 * @param {string} defaultProxyUri - Default proxy worker URI
 * @returns {import('./config-setup.d.ts').OpfsConfig} Normalized configuration
 */
export function prepareOpfsConfig(options, defaultProxyUri) {
    // 1. Input handling
    // 1.1 Normalize options object
    if (!options || "object" !== typeof options) {
        options = Object.create(null);
    }

    const urlParams = new URL(globalThis.location.href).searchParams;

    // 1.2 Check for disable flag
    if (urlParams.has("opfs-disable")) {
        return { disabled: true };
    }

    // 2. Core processing
    // 2.1 Set verbose level
    if (undefined === options.verbose) {
        options.verbose = urlParams.has("opfs-verbose")
            ? +urlParams.get("opfs-verbose") || 2
            : 1;
    }

    // 2.2 Set sanity checks flag
    if (undefined === options.sanityChecks) {
        options.sanityChecks = urlParams.has("opfs-sanity-check");
    }

    // 2.3 Resolve proxy URI
    if (undefined === options.proxyUri) {
        options.proxyUri = defaultProxyUri;
    }
    if ("function" === typeof options.proxyUri) {
        options.proxyUri = options.proxyUri();
    }

    // 3. Output handling
    return { ...options, disabled: false };
}
