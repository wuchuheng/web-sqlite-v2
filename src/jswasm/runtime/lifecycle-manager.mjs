/**
 * Runtime lifecycle management for WebAssembly module initialization.
 * Handles preRun, initRuntime, postRun phases and dependency tracking.
 *
 * @module runtime/lifecycle-manager
 */

/**
 * Creates a runtime lifecycle manager for coordinating module initialization phases.
 *
 * @param {Object} Module - The Emscripten module object
 * @param {Object} FS - The file system implementation
 * @param {Object} TTY - The TTY operations implementation
 * @returns {{
 *   preRun: () => void,
 *   initRuntime: () => void,
 *   postRun: () => void,
 *   addOnPreRun: (callback: Function) => void,
 *   addOnInit: (callback: Function) => void,
 *   addOnPostRun: (callback: Function) => void,
 *   addRunDependency: (id: string) => void,
 *   removeRunDependency: (id: string) => void,
 *   getUniqueRunDependency: (id: string) => string,
 *   setDependenciesFulfilled: (callback: Function) => void,
 *   getRunDependencies: () => number,
 *   run: () => void
 * }} Lifecycle manager API
 */
export function createLifecycleManager(Module, FS, TTY) {
    // Lifecycle callback arrays
    const __ATPRERUN__ = [];
    const __ATINIT__ = [];
    const __ATPOSTRUN__ = [];

    // Runtime state
    let runtimeInitialized = false;
    let runDependencies = 0;
    let runDependencyWatcher = null;
    let dependenciesFulfilled = null;
    let calledRun = false;
    let calledPrerun = false;

    /**
     * Executes all callbacks in the given array.
     *
     * @param {Function[]} callbacks - Array of callbacks to execute
     */
    function callRuntimeCallbacks(callbacks) {
        // 1. Execute each callback with Module as argument
        callbacks.forEach((f) => f(Module));
    }

    /**
     * Returns a unique identifier for a run dependency.
     *
     * @param {string} id - The dependency identifier
     * @returns {string} The unique dependency identifier
     */
    function getUniqueRunDependency(id) {
        return id;
    }

    /**
     * Adds a run dependency that must be resolved before module initialization completes.
     *
     * @param {string} _id - The dependency identifier (unused but kept for API compatibility)
     */
    function addRunDependency(_id) {
        // 1. Increment dependency counter
        runDependencies++;

        // 2. Notify monitor if present
        Module["monitorRunDependencies"]?.(runDependencies);
    }

    /**
     * Removes a run dependency, potentially triggering module initialization completion.
     *
     * @param {string} _id - The dependency identifier (unused but kept for API compatibility)
     */
    function removeRunDependency(_id) {
        // 1. Decrement dependency counter
        runDependencies--;

        // 2. Notify monitor if present
        Module["monitorRunDependencies"]?.(runDependencies);

        // 3. Check if all dependencies are fulfilled
        if (runDependencies === 0) {
            if (runDependencyWatcher !== null) {
                clearInterval(runDependencyWatcher);
                runDependencyWatcher = null;
            }
            if (dependenciesFulfilled) {
                const callback = dependenciesFulfilled;
                dependenciesFulfilled = null;
                callback();
            }
        }
    }

    /**
     * Executes the preRun phase, running all registered preRun callbacks.
     */
    function preRun() {
        // 1. Collect preRun callbacks from Module
        const preRuns = Module["preRun"];
        if (preRuns) {
            if (typeof preRuns === "function") {
                addOnPreRun(preRuns);
            } else {
                preRuns.forEach(addOnPreRun);
            }
        }

        // 2. Execute all preRun callbacks
        callRuntimeCallbacks(__ATPRERUN__);
    }

    /**
     * Initializes the runtime environment, setting up file system and TTY.
     */
    function initRuntime() {
        // 1. Mark runtime as initialized
        runtimeInitialized = true;
        console.log(runtimeInitialized);

        // 2. Initialize file system if not disabled
        if (!Module["noFSInit"] && !FS.initialized) {
            FS.init();
        }
        FS.ignorePermissions = false;

        // 3. Initialize TTY
        TTY.init();

        // 4. Execute all init callbacks
        callRuntimeCallbacks(__ATINIT__);
    }

    /**
     * Executes the postRun phase, running all registered postRun callbacks.
     */
    function postRun() {
        // 1. Collect postRun callbacks from Module
        const postRuns = Module["postRun"];
        if (postRuns) {
            if (typeof postRuns === "function") {
                addOnPostRun(postRuns);
            } else {
                postRuns.forEach(addOnPostRun);
            }
        }

        // 2. Execute all postRun callbacks
        callRuntimeCallbacks(__ATPOSTRUN__);
    }

    /**
     * Adds a callback to run before runtime initialization.
     *
     * @param {Function} cb - Callback to execute during preRun phase
     */
    function addOnPreRun(cb) {
        __ATPRERUN__.unshift(cb);
    }

    /**
     * Adds a callback to run during runtime initialization.
     *
     * @param {Function} cb - Callback to execute during init phase
     */
    function addOnInit(cb) {
        __ATINIT__.unshift(cb);
    }

    /**
     * Adds a callback to run after runtime initialization.
     *
     * @param {Function} cb - Callback to execute during postRun phase
     */
    function addOnPostRun(cb) {
        __ATPOSTRUN__.unshift(cb);
    }

    /**
     * Sets the callback to execute when all run dependencies are fulfilled.
     *
     * @param {Function} callback - Callback to execute when dependencies are resolved
     */
    function setDependenciesFulfilled(callback) {
        dependenciesFulfilled = callback;
    }

    /**
     * Gets the current number of pending run dependencies.
     *
     * @returns {number} Number of pending dependencies
     */
    function getRunDependencies() {
        return runDependencies;
    }

    /**
     * Executes the main runtime initialization sequence.
     */
    function run() {
        // 1. Wait for dependencies to be resolved
        if (runDependencies > 0) {
            return;
        }

        // 2. Execute preRun phase if not already called
        if (!calledPrerun) {
            calledPrerun = true;
            preRun();

            // Check again after preRun
            if (runDependencies > 0) {
                return;
            }
        }

        // 3. Execute the actual runtime initialization
        function doRun() {
            // Prevent duplicate runs
            if (calledRun) {
                return;
            }
            calledRun = true;
            Module["calledRun"] = true;

            // Don't run if aborted
            if (Module.ABORT) {
                return;
            }

            // Initialize runtime
            initRuntime();

            // Notify ready promise
            if (Module.readyPromiseResolve) {
                Module.readyPromiseResolve(Module);
            }

            // Call onRuntimeInitialized hook
            Module["onRuntimeInitialized"]?.();

            // Execute postRun phase
            postRun();
        }

        // 4. Execute with optional status updates
        if (Module["setStatus"]) {
            Module["setStatus"]("Running...");
            setTimeout(() => {
                setTimeout(() => Module["setStatus"](""), 1);
                doRun();
            }, 1);
        } else {
            doRun();
        }
    }

    // Return lifecycle manager API
    return {
        preRun,
        initRuntime,
        postRun,
        addOnPreRun,
        addOnInit,
        addOnPostRun,
        addRunDependency,
        removeRunDependency,
        getUniqueRunDependency,
        setDependenciesFulfilled,
        getRunDependencies,
        run,
    };
}
