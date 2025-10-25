import type {
    FileSystemLike,
    PathFsUtilities,
    PathUtilities,
} from "./path.d.ts";

const splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/;

const trimSegments = (segments: string[]): string[] => {
    let start = 0;
    while (start < segments.length && segments[start] === "") {
        start += 1;
    }

    let end = segments.length - 1;
    while (end >= 0 && segments[end] === "") {
        end -= 1;
    }

    if (start > end) {
        return [];
    }

    return segments.slice(start, end + 1);
};

export const PATH: PathUtilities = {
    isAbs: (path) => path.startsWith("/"),

    splitPath: (filename) => {
        const match = splitPathRe.exec(filename);
        if (!match) {
            throw new Error(
                `Unable to resolve path components for "${filename}".`,
            );
        }
        return match.slice(1) as [string, string, string, string];
    },

    normalizeArray: (parts, allowAboveRoot) => {
        const normalizedParts = [...parts];
        let up = 0;

        for (let index = normalizedParts.length - 1; index >= 0; index -= 1) {
            const last = normalizedParts[index];
            if (last === ".") {
                normalizedParts.splice(index, 1);
            } else if (last === "..") {
                normalizedParts.splice(index, 1);
                up += 1;
            } else if (up) {
                normalizedParts.splice(index, 1);
                up -= 1;
            }
        }

        if (allowAboveRoot) {
            for (; up > 0; up -= 1) {
                normalizedParts.unshift("..");
            }
        }

        return normalizedParts;
    },

    normalize: (path) => {
        const isAbsolute = PATH.isAbs(path);
        const trailingSlash = path.endsWith("/");

        let normalized = PATH.normalizeArray(
            path.split("/").filter(Boolean),
            !isAbsolute,
        ).join("/");

        if (!normalized && !isAbsolute) {
            normalized = ".";
        }

        if (normalized && trailingSlash) {
            normalized += "/";
        }

        return (isAbsolute ? "/" : "") + normalized;
    },

    dirname: (path) => {
        const [root, dir] = PATH.splitPath(path);

        if (!root && !dir) {
            return ".";
        }

        const directory = dir ? dir.slice(0, -1) : dir;
        return `${root}${directory}`;
    },

    basename: (path) => {
        if (path === "/") {
            return "/";
        }

        let normalized = PATH.normalize(path);
        normalized = normalized.replace(/\/$/, "");

        const lastSlash = normalized.lastIndexOf("/");
        if (lastSlash === -1) {
            return normalized;
        }

        return normalized.slice(lastSlash + 1);
    },

    join: (...paths) => PATH.normalize(paths.join("/")),

    join2: (left, right) => PATH.normalize(`${left}/${right}`),
};

export const createPathFS = (
    fs: FileSystemLike | null = null,
): PathFsUtilities => {
    const resolveInternal = (...args: string[]): string => {
        let resolvedPath = "";
        let resolvedAbsolute = false;

        for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i -= 1) {
            const value = i >= 0 ? args[i] : (fs?.cwd() ?? "/");
            if (typeof value !== "string") {
                throw new TypeError(
                    "Arguments to path.resolve must be strings",
                );
            }

            if (!value) {
                continue;
            }

            resolvedPath = `${value}/${resolvedPath}`;
            resolvedAbsolute = PATH.isAbs(value);
        }

        const normalized = PATH.normalizeArray(
            resolvedPath.split("/").filter(Boolean),
            !resolvedAbsolute,
        ).join("/");

        if (!normalized && !resolvedAbsolute) {
            return ".";
        }

        return (resolvedAbsolute ? "/" : "") + normalized;
    };

    const relative = (from: string, to: string): string => {
        const fromPath = resolveInternal(from).slice(1);
        const toPath = resolveInternal(to).slice(1);

        const fromParts = trimSegments(fromPath.split("/"));
        const toParts = trimSegments(toPath.split("/"));
        const length = Math.min(fromParts.length, toParts.length);

        let samePartsLength = length;
        for (let i = 0; i < length; i += 1) {
            if (fromParts[i] !== toParts[i]) {
                samePartsLength = i;
                break;
            }
        }

        const outputParts: string[] = [];
        for (let i = samePartsLength; i < fromParts.length; i += 1) {
            outputParts.push("..");
        }

        outputParts.push(...toParts.slice(samePartsLength));
        return outputParts.join("/");
    };

    return {
        resolve: resolveInternal,
        relative,
    };
};

export const PATH_FS: PathFsUtilities = createPathFS();
