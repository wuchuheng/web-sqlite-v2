# Browser Compatibility

`web-sqlite-js` leverages modern browser APIs to provide high-performance, persistent SQLite storage. To use this library, the user's browser must support the following capabilities.

## Minimum Browser Versions

Based on the combined requirements above (primarily restricted by OPFS and DecompressionStream), the following are the minimum recommended browser versions:

| Browser                                                          | Minimum Version | Note                                         |
| :--------------------------------------------------------------- | :-------------- | :------------------------------------------- |
| <i class="fa-brands fa-chrome"></i> **Google Chrome**            | 102+            | Full support for OPFS and SAB.               |
| <i class="fa-brands fa-firefox-browser"></i> **Mozilla Firefox** | 113+            | Required for `DecompressionStream` and OPFS. |
| <i class="fa-brands fa-safari"></i> **Apple Safari**             | 17+             | Required for full OPFS support.              |
| <i class="fa-brands fa-edge"></i> **Microsoft Edge**             | 102+            | Same engine as Chrome.                       |

## Important: Security Requirements

Even with a compatible browser, two critical security constraints must be met:

### 1. HTTPS Environment

Secure contexts are required for OPFS and SharedArrayBuffer. The library will not function over plain HTTP (except for `localhost`).

### 2. COOP/COEP Headers

To enable `SharedArrayBuffer` (which SQLite uses for file locking), your server **must** send the following HTTP headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Without these headers, the browser will disable `SharedArrayBuffer`, and the library will throw an error. For setup instructions, see the [Getting Started](/getting-started#setup-http-headers) guide.

## Required Web APIs

| Feature                                                         | Purpose                                             | Minimum Requirement                                                                                                                                                                                                               |
| :-------------------------------------------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <i class="fa-solid fa-hard-drive"></i> **OPFS**                 | Persistent file storage on the user's device.       | [Chrome 102](https://caniuse.com/native-filesystem-api), [Firefox 111](https://caniuse.com/native-filesystem-api), [Safari 17](https://caniuse.com/native-filesystem-api)                                                         |
| <i class="fa-solid fa-microchip"></i> **WASM**                  | Running the SQLite engine at near-native speed.     | All modern browsers                                                                                                                                                                                                               |
| <i class="fa-solid fa-network-wired"></i> **SharedArrayBuffer** | High-performance locking and concurrency.           | [Chrome 68](https://caniuse.com/sharedarraybuffer), [Firefox 79](https://caniuse.com/sharedarraybuffer), [Safari 15.2](https://caniuse.com/sharedarraybuffer)                                                                     |
| <i class="fa-solid fa-box-open"></i> **DecompressionStream**    | On-the-fly decompression of the SQLite WASM binary. | [Chrome 80](https://caniuse.com/mdn-api_decompressionstream), [Firefox 113](https://caniuse.com/mdn-api_decompressionstream), [Safari 16.4](https://caniuse.com/mdn-api_decompressionstream)                                      |
| <i class="fa-solid fa-people-gear"></i> **Module Workers**      | Running logic in background threads via ES Modules. | [Chrome 80](https://caniuse.com/mdn-api_worker_worker_ecmascript_modules), [Firefox 114](https://caniuse.com/mdn-api_worker_worker_ecmascript_modules), [Safari 15](https://caniuse.com/mdn-api_worker_worker_ecmascript_modules) |
