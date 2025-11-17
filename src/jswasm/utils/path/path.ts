import type {
  FileSystemLike,
  PathFsUtilities,
  PathUtilities,
} from "./types.d.ts";

const splitPathRe =
  /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^/]+?|)(\.[^./]*|))(?:[/]*)$/;

export const PATH: PathUtilities = {
  isAbs(path) {
    // 1. Input handling
    return path.charAt(0) === "/";
  },

  splitPath(filename) {
    // 1. Input handling
    const match = splitPathRe.exec(filename);

    // 2. Core processing
    const result = match ? match.slice(1) : ["", "", "", ""];

    // 3. Output handling
    return result as [string, string, string, string];
  },

  normalizeArray(parts, allowAboveRoot) {
    // 1. Input handling
    let up = 0;

    // 2. Core processing
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

    // 3. Output handling
    if (allowAboveRoot) {
      for (; up; up--) {
        parts.unshift("..");
      }
    }

    return parts;
  },

  normalize(path) {
    // 1. Input handling
    const isAbsolute = PATH.isAbs(path);
    const trailingSlash = path.substr(-1) === "/";

    // 2. Core processing
    path = PATH.normalizeArray(
      path.split("/").filter((segment) => !!segment),
      !isAbsolute,
    ).join("/");

    if (!path && !isAbsolute) {
      path = ".";
    }

    if (path && trailingSlash) {
      path += "/";
    }

    // 3. Output handling
    return (isAbsolute ? "/" : "") + path;
  },

  dirname(path) {
    // 1. Input handling
    const result = PATH.splitPath(path);
    const root = result[0];
    let dir = result[1];

    // 2. Core processing
    if (!root && !dir) {
      return ".";
    }

    if (dir) {
      dir = dir.substr(0, dir.length - 1);
    }

    // 3. Output handling
    return root + dir;
  },

  basename(path) {
    // 1. Input handling
    if (path === "/") return "/";

    // 2. Core processing
    path = PATH.normalize(path);
    path = path.replace(/\/$/, "");
    const lastSlash = path.lastIndexOf("/");
    if (lastSlash === -1) return path;

    // 3. Output handling
    return path.substr(lastSlash + 1);
  },

  join(...paths) {
    // 1. Input handling
    const joined = paths.join("/");

    // 2. Core processing
    const normalized = PATH.normalize(joined);

    // 3. Output handling
    return normalized;
  },

  join2(left, right) {
    // 1. Input handling
    const combined = left + "/" + right;

    // 2. Core processing
    const normalized = PATH.normalize(combined);

    // 3. Output handling
    return normalized;
  },
};

export const createPathFS = (
  FS: FileSystemLike | null = null,
): PathFsUtilities => ({
  resolve(...args) {
    // 1. Input handling
    let resolvedPath = "";
    let resolvedAbsolute = false;

    // 2. Core processing
    for (let i = args.length - 1; i >= -1 && !resolvedAbsolute; i--) {
      const segment = i >= 0 ? args[i] : FS?.cwd() || "/";

      if (typeof segment !== "string") {
        throw new TypeError("Arguments to path.resolve must be strings");
      } else if (!segment) {
        return "";
      }

      resolvedPath = segment + "/" + resolvedPath;
      resolvedAbsolute = PATH.isAbs(segment);
    }

    resolvedPath = PATH.normalizeArray(
      resolvedPath.split("/").filter((part) => !!part),
      !resolvedAbsolute,
    ).join("/");

    // 3. Output handling
    return (resolvedAbsolute ? "/" : "") + resolvedPath || ".";
  },

  relative(from, to) {
    // 1. Input handling
    const pathFS = FS ? createPathFS(FS) : createPathFS();
    from = pathFS.resolve(from).substr(1);
    to = pathFS.resolve(to).substr(1);

    function trim(arr: string[]): string[] {
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
    const fromParts = trim(from.split("/"));
    const toParts = trim(to.split("/"));
    const length = Math.min(fromParts.length, toParts.length);
    let samePartsLength = length;
    for (let i = 0; i < length; i++) {
      if (fromParts[i] !== toParts[i]) {
        samePartsLength = i;
        break;
      }
    }

    const outputParts: string[] = [];
    for (let i = samePartsLength; i < fromParts.length; i++) {
      outputParts.push("..");
    }
    outputParts.push(...toParts.slice(samePartsLength));

    // 3. Output handling
    return outputParts.join("/");
  },
});

export const PATH_FS = createPathFS();
