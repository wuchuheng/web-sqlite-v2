/**
 * Path utility functions for handling file system paths.
 * Extracted from sqlite3.mjs to improve code organization.
 */

/**
 * Core path manipulation utilities.
 */
/** @type {import('./path.d.ts').PathUtilities} */
export const PATH = {
    /**
     * Check if a path is absolute.
     * @param {string} path - Path to check.
     * @returns {boolean} True if path starts with '/'.
     */
    isAbs: (path) => path.charAt(0) === "/",

    /**
     * Split a path into components.
     * @param {string} filename - Path to split.
     * @returns {Array} Array of path components [root, dir, basename, ext].
     */
    splitPath: (filename) => {
        const splitPathRe =
            /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/;
        return splitPathRe.exec(filename).slice(1);
    },

    /**
     * Normalize an array of path parts, handling '..' and '.'.
     * @param {Array<string>} parts - Path parts to normalize.
     * @param {boolean} allowAboveRoot - Allow paths above root.
     * @returns {Array<string>} Normalized path parts.
     */
    normalizeArray: (parts, allowAboveRoot) => {
        // 1. Input handling
        let up = 0;

        // 2. Core processing
        // 2.1 Process path parts from right to left
        for (let i = parts.length - 1; i >= 0; i--) {
            const last = parts[i];
            if (last === ".") {
                parts.splice(i, 1);
            } else if (last === "..") {
                parts.splice(i, 1);
                up++;
            } else if (up) {
                parts.splice(i, 1);
                up--;
            }
        }

        // 2.2 Add parent directory references if allowed
        if (allowAboveRoot) {
            for (; up; up--) {
                parts.unshift("..");
            }
        }

        // 3. Output handling
        return parts;
    },

    /**
     * Normalize a path string.
     * @param {string} path - Path to normalize.
     * @returns {string} Normalized path.
     */
    normalize: (path) => {
        // 1. Input handling
        const isAbsolute = PATH.isAbs(path);
        const trailingSlash = path.substr(-1) === "/";

        // 2. Core processing
        // 2.1 Split, filter, and normalize path
        path = PATH.normalizeArray(
            path.split("/").filter((p) => !!p),
            !isAbsolute,
        ).join("/");

        // 2.2 Handle empty path
        if (!path && !isAbsolute) {
            path = ".";
        }

        // 2.3 Restore trailing slash if needed
        if (path && trailingSlash) {
            path += "/";
        }

        // 3. Output handling
        return (isAbsolute ? "/" : "") + path;
    },

    /**
     * Get the directory name of a path.
     * @param {string} path - Path to process.
     * @returns {string} Directory name.
     */
    dirname: (path) => {
        // 1. Input handling
        const result = PATH.splitPath(path);
        const root = result[0];
        let dir = result[1];

        // 2. Core processing
        // 2.1 Handle empty root and dir
        if (!root && !dir) {
            return ".";
        }

        // 2.2 Remove trailing slash from dir
        if (dir) {
            dir = dir.substr(0, dir.length - 1);
        }

        // 3. Output handling
        return root + dir;
    },

    /**
     * Get the base name of a path.
     * @param {string} path - Path to process.
     * @returns {string} Base name.
     */
    basename: (path) => {
        // 1. Input handling
        if (path === "/") return "/";

        // 2. Core processing
        // 2.1 Normalize and remove trailing slash
        path = PATH.normalize(path);
        path = path.replace(/\/$/, "");

        // 2.2 Find last slash
        const lastSlash = path.lastIndexOf("/");
        if (lastSlash === -1) return path;

        // 3. Output handling
        return path.substr(lastSlash + 1);
    },

    /**
     * Join path segments.
     * @param {...string} paths - Path segments to join.
     * @returns {string} Joined path.
     */
    join: (...paths) => PATH.normalize(paths.join("/")),

    /**
     * Join two path segments.
     * @param {string} l - Left path segment.
     * @param {string} r - Right path segment.
     * @returns {string} Joined path.
     */
    join2: (l, r) => PATH.normalize(l + "/" + r),
};

/**
 * File system path utilities.
 * Extends PATH with FS-specific functionality.
 * @param {import('./path.d.ts').FileSystemLike|null} FS - File system object (optional, for resolve with cwd support).
 * @returns {import('./path.d.ts').PathFsUtilities}
 */
export const createPathFS = (FS = null) => ({
    /**
     * Resolve path arguments to an absolute path.
     * @param {...string} args - Path segments to resolve.
     * @returns {string} Absolute path.
     */
    resolve: (...args) => {
        // 1. Input handling
        let resolvedPath = "";
        let resolvedAbsolute = false;

        // 2. Core processing
        // 2.1 Process arguments from right to left
        for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
            const path = i >= 0 ? args[i] : FS?.cwd() || "/";

            // 2.1.1 Validate path type
            if (typeof path != "string") {
                throw new TypeError(
                    "Arguments to path.resolve must be strings",
                );
            } else if (!path) {
                return "";
            }

            // 2.1.2 Prepend path and check if absolute
            resolvedPath = path + "/" + resolvedPath;
            resolvedAbsolute = PATH.isAbs(path);
        }

        // 2.2 Normalize resolved path
        resolvedPath = PATH.normalizeArray(
            resolvedPath.split("/").filter((p) => !!p),
            !resolvedAbsolute,
        ).join("/");

        // 3. Output handling
        return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
    },

    /**
     * Get relative path from one path to another.
     * @param {string} from - Source path.
     * @param {string} to - Target path.
     * @returns {string} Relative path.
     */
    relative: (from, to) => {
        // 1. Input handling
        // 1.1 Resolve and normalize paths
        const pathFS = FS ? createPathFS(FS) : createPathFS();
        from = pathFS.resolve(from).substr(1);
        to = pathFS.resolve(to).substr(1);

        // 1.2 Helper to trim empty strings from array
        function trim(arr) {
            let start = 0;
            for (; start < arr.length; start++) {
                if (arr[start] !== "") break;
            }
            let end = arr.length - 1;
            for (; end >= 0; end--) {
                if (arr[end] !== "") break;
            }
            if (start > end) return [];
            return arr.slice(start, end - start + 1);
        }

        // 2. Core processing
        // 2.1 Split paths into parts
        const fromParts = trim(from.split("/"));
        const toParts = trim(to.split("/"));

        // 2.2 Find common parts
        const length = Math.min(fromParts.length, toParts.length);
        let samePartsLength = length;
        for (let i = 0; i < length; i++) {
            if (fromParts[i] !== toParts[i]) {
                samePartsLength = i;
                break;
            }
        }

        // 2.3 Build output path
        const outputParts = [];
        for (let i = samePartsLength; i < fromParts.length; i++) {
            outputParts.push("..");
        }
        outputParts.push(...toParts.slice(samePartsLength));

        // 3. Output handling
        return outputParts.join("/");
    },
});

/**
 * Default PATH_FS instance without FS dependency.
 */
/** @type {import('./path.d.ts').PathFsUtilities} */
export const PATH_FS = createPathFS();
