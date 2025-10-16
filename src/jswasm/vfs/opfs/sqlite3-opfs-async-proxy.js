"use strict";

/**
 * Compatibility shim for the legacy OPFS async worker entry point.
 *
 * The historical build referenced `sqlite3-opfs-async-proxy.js` directly
 * when spawning the module worker. This tiny module now simply re-exports
 * the new async proxy bootstrap located under `./async-proxy/index.mjs` so
 * that existing bundle URLs continue to function without modification.
 */
import "./async-proxy/index.mjs";
