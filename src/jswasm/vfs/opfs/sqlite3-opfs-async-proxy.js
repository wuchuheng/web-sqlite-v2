"use strict";

/**
 * Legacy entry point for the OPFS async worker.
 *
 * Historically the OPFS worker lived alongside this file path. To preserve
 * compatibility with existing integrations we keep the module shell here and
 * immediately delegate to the modern, modular worker implementation.
 */
import "./async-proxy/index.mjs";
