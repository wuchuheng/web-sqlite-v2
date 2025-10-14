# Analysis of `src/jswasm`

This document provides an analysis of the JavaScript and WebAssembly modules located in the `src/jswasm` directory. These modules collectively provide a WebAssembly-based version of SQLite, complete with various storage backends and a high-level JavaScript API.

## High-Level Architecture

The system is built around a core SQLite WASM module and is augmented by several layers of JavaScript code that provide:
1.  A high-level, object-oriented (OO) API.
2.  Multiple virtual file systems (VFS) for data persistence (in-memory, OPFS).
3.  Low-level system call and WASI implementations required by the WASM module.
4.  Utility functions for memory management, data conversion, and asynchronous operations.

## File Categorization

The files in `src/jswasm` can be grouped into the following categories:

### 1. Core SQLite & Emscripten Glue

These files are the central components that load and run the SQLite WebAssembly module.

*   **`sqlite3.wasm`**: The compiled SQLite3 WebAssembly binary.
*   **`sqlite3.mjs`**: The main Emscripten-generated JavaScript "glue" code. It handles the loading and instantiation of the `.wasm` module, sets up the runtime environment, and provides the low-level `cwrap` and `ccall` functions for interacting with the WASM module.
*   **`sqlite3-wasm-exports.mjs`**: This module takes the raw exports from the WASM module and attaches them to a JavaScript `Module` object for easier access.
*   **`sqlite3Apibootstrap.mjs`**: This script runs after the WASM module is loaded. It initializes the higher-level JavaScript APIs and applies any necessary patches or configurations.

### 2. High-Level OO1 API

This layer provides a more user-friendly, object-oriented API over the C-style functions exported by the WASM module.

*   **`install-oo1.mjs`**: This module installs the "OO1" (Object-Oriented layer 1) API. It uses the `xWrap` utility to wrap the C-style WASM functions with more JavaScript-friendly interfaces, handling type conversions and memory management.
*   **`install-oo1-db-api.mjs`**: This builds on `install-oo1.mjs` to provide the high-level `DB` and `Stmt` classes, which are the primary interfaces for developers using this library.

### 3. Virtual File Systems (VFS)

SQLite's VFS architecture allows it to use different storage backends. This implementation provides several for the browser environment.

*   **`filesystem.mjs`**: A generic, in-memory POSIX-like file system implementation. It provides the fundamental FS structure that other VFS implementations can build upon.
*   **`memfs.mjs`**: A specific implementation of an in-memory file system, likely used for transient databases.
*   **`install-opfs-vfs.mjs`**: This module installs a VFS that uses the Origin Private File System (OPFS) for persistent storage. OPFS provides fast, file-based storage in the browser.
*   **`opfs-sahpool-vfs.mjs`**: A more advanced OPFS-based VFS that uses a pool of `SyncAccessHandle` objects for potentially better performance and concurrency.
*   **`sqlite3-opfs-async-proxy.js`**: A Web Worker script that manages asynchronous OPFS operations on behalf of the synchronous VFS running in the main thread. This is necessary because some OPFS APIs are asynchronous.

### 4. WASM & System-Level Utilities

These are general-purpose modules that provide foundational capabilities for the rest of the system.

*   **`create-wh-wasm-util-installer.mjs`**: A factory for creating a "Wasm-Helper" utility installer. This utility provides a host of functions for interacting with the WASM module's memory and function table (e.g., `peek`, `poke`, `allocCString`).
*   **`struct-binder-factory.mjs`**: Provides a factory (`Jaccwabyt`) for creating JavaScript classes that can bind to C structs in the WASM memory, allowing for easy reading and writing of complex data structures.
*   **`syscalls.mjs`**: Implements various POSIX-like system calls (e.g., `open`, `read`, `stat`) that are required by the underlying C code compiled to WASM.
*   **`wasi-functions.mjs`**: Implements functions from the WebAssembly System Interface (WASI), which provides a standard way for WASM modules to interact with the outside world (e.g., file I/O, environment variables, time).
*   **`tty-operations.mjs`**: Provides support for terminal/TTY operations, which are often part of a standard C library environment.

### 5. Utility Sub-modules (`src/jswasm/utils/`)

This directory contains smaller, focused utility modules.

*   **`async-utils.mjs`**: Helpers for asynchronous operations, like loading files.
*   **`memory-utils.mjs`**: Utilities for memory operations like alignment and allocation.
*   **`path.mjs`**: Path manipulation utilities (e.g., `dirname`, `basename`, `normalize`).
*   **`sqlite3-init-wrapper.mjs`**: A wrapper around the main `sqlite3InitModule` to orchestrate the initialization sequence.
*   **`utf8.mjs`**: Functions for converting between JavaScript strings and UTF-8 byte arrays.
*   **`wasm-loader.mjs`**: Logic for loading the `.wasm` file, including streaming instantiation.
