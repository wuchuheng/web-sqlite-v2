/**
 * Creates message handler f      case 'opfs-async-loaded': {
        // 2. Core processing - Send initialization data to worker
        // 2.1 Create state copy without functions (functions can't be cloned for postMessage)
        const stateForWorker = {
          littleEndian: state.littleEndian,
          asyncIdleWaitTime: state.asyncIdleWaitTime,
          asyncS11nExceptions: state.asyncS11nExceptions,
          fileBufferSize: state.fileBufferSize,
          sabS11nOffset: state.sabS11nOffset,
          sabS11nSize: state.sabS11nSize,
          sabIO: state.sabIO,
          sabOP: state.sabOP,
          opIds: state.opIds,
          sq3Codes: state.sq3Codes,
          opfsFlags: state.opfsFlags,
          verbose: state.verbose,
        };
        W.postMessage({ type: 'opfs-async-init', args: stateForWorker });
        break;
      }unication.
 * @param {object} deps - Dependencies object
 * @returns {Function} Message handler function
 */
export function createWorkerMessageHandler(deps) {
    const {
        promiseResolve,
        promiseReject,
        promiseWasRejected,
        sqlite3,
        opfsVfs,
        opfsIoMethods,
        ioSyncWrappers,
        vfsSyncWrappers,
        state,
        opfsUtil,
        options,
        warn,
        error,
        runSanityCheck,
        thisThreadHasOPFS,
        W,
    } = deps;

    return function handleWorkerMessage({ data }) {
        switch (data.type) {
            case "opfs-unavailable":
                // 1. Input handling
                promiseReject(new Error(data.payload.join(" ")));
                break;

            case "opfs-async-loaded": {
                // 2. Core processing - Send initialization data to worker
                // 2.1 Create state copy without functions (functions can't be cloned for postMessage)
                const stateForWorker = {
                    littleEndian: state.littleEndian,
                    asyncIdleWaitTime: state.asyncIdleWaitTime,
                    asyncS11nExceptions: state.asyncS11nExceptions,
                    fileBufferSize: state.fileBufferSize,
                    sabS11nOffset: state.sabS11nOffset,
                    sabS11nSize: state.sabS11nSize,
                    sabIO: state.sabIO,
                    sabOP: state.sabOP,
                    opIds: state.opIds,
                    sq3Codes: state.sq3Codes,
                    opfsFlags: state.opfsFlags,
                    verbose: state.verbose,
                };
                W.postMessage({
                    type: "opfs-async-init",
                    args: stateForWorker,
                });
                break;
            }

            case "opfs-async-inited": {
                // 1. Input handling
                if (true === promiseWasRejected.value) {
                    break;
                }

                try {
                    // 2. Core processing
                    // 2.1 Install VFS
                    sqlite3.vfs.installVfs({
                        io: { struct: opfsIoMethods, methods: ioSyncWrappers },
                        vfs: { struct: opfsVfs, methods: vfsSyncWrappers },
                    });

                    // 2.2 Set up shared array buffer views
                    state.sabOPView = new Int32Array(state.sabOP);
                    state.sabFileBufView = new Uint8Array(
                        state.sabIO,
                        0,
                        state.fileBufferSize
                    );
                    state.sabS11nView = new Uint8Array(
                        state.sabIO,
                        state.sabS11nOffset,
                        state.sabS11nSize
                    );

                    // 2.3 Run sanity checks if requested
                    if (options.sanityChecks) {
                        warn(
                            "Running sanity checks because of opfs-sanity-check URL arg..."
                        );
                        runSanityCheck();
                    }

                    // 2.4 Get OPFS root directory
                    if (thisThreadHasOPFS()) {
                        navigator.storage
                            .getDirectory()
                            .then((d) => {
                                W.onerror = W._originalOnError;
                                delete W._originalOnError;
                                sqlite3.opfs = opfsUtil;
                                opfsUtil.rootDirectory = d;
                                promiseResolve();
                            })
                            .catch(promiseReject);
                    } else {
                        promiseResolve();
                    }
                } catch (e) {
                    error(e);
                    promiseReject(e);
                }
                break;
            }

            default: {
                // 3. Output handling
                const errMsg =
                    "Unexpected message from the OPFS async worker: " +
                    JSON.stringify(data);
                error(errMsg);
                promiseReject(new Error(errMsg));
                break;
            }
        }
    };
}
