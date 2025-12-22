import { setupHttpHeadersUrl } from "@/config/config";

/**
 * Check if SharedArrayBuffer is supported in the current environment.
 * If not, throw an error with instructions on how to enable SharedArrayBuffer.
 */
export function abilityCheck() {
  try {
    new SharedArrayBuffer();
  } catch (_) {
    throw new Error(`
[web-sqlite-js] SharedArrayBuffer is not enabled.

This library requires SharedArrayBuffer for high-performance database operations.
To enable it, your server must send the following HTTP headers:

  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

For configuration guides (Vite, Next.js, Nginx, etc.), visit:
${setupHttpHeadersUrl}
`);
  }
}
