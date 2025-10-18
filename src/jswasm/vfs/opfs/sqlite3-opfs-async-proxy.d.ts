/**
 * Represents the resolved base URL shared with the modular async proxy loader
 * when the legacy worker entry point is used.
 */
export type AsyncProxyBaseUrl = URL | undefined;

/**
 * Legacy worker entry point maintained for compatibility with the original
 * single-file OPFS async proxy bootstrapper.
 */
export {};

declare global {
    /**
     * Base URL broadcast to the modular async proxy loader so it can resolve
     * the supporting worker modules when executed via `importScripts()`.
     */
    var __opfsAsyncProxyBaseUrl: AsyncProxyBaseUrl;
}
