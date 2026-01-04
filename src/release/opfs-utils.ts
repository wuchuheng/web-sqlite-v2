import { DEFAULT_VERSION } from "./constants";

/** Ensure the root directory exists and is not shadowed by a file. */
export const ensureDir = async (
  root: FileSystemDirectoryHandle,
  dirName: string,
): Promise<FileSystemDirectoryHandle> => {
  try {
    return await root.getDirectoryHandle(dirName);
  } catch (error) {
    const name = (error as Error).name;
    if (name !== "NotFoundError") {
      throw error;
    }
  }
  try {
    await root.getFileHandle(dirName);
    throw new Error(`A file already exists with the name ${dirName}`);
  } catch (error) {
    const name = (error as Error).name;
    if (name !== "NotFoundError") {
      throw error;
    }
  }
  return await root.getDirectoryHandle(dirName, { create: true });
};

/** Ensure a file handle exists. */
export const ensureFile = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemFileHandle> => {
  return await dir.getFileHandle(name, { create: true });
};

/** Write a text file atomically. */
export const writeTextFile = async (
  dir: FileSystemDirectoryHandle,
  name: string,
  contents: string,
): Promise<void> => {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
};

/** Copy a file handle's contents to a target file handle. */
export const copyFileHandle = async (
  source: FileSystemFileHandle,
  target: FileSystemFileHandle,
): Promise<void> => {
  const file = await source.getFile();
  const writable = await target.createWritable();
  await writable.write(await file.arrayBuffer());
  await writable.close();
};

/** Remove a directory tree. */
export const removeDir = async (
  dir: FileSystemDirectoryHandle,
  name: string,
): Promise<void> => {
  await dir.removeEntry(name, { recursive: true });
};

/** Resolve an OPFS path for a versioned database. */
export const getDbPathForVersion = (
  dirName: string,
  version: string,
): string => {
  if (version === DEFAULT_VERSION) {
    return `${dirName}/default.sqlite3`;
  }
  return `${dirName}/${version}/db.sqlite3`;
};

/** Get a file handle for a versioned database. */
export const getDbHandleForVersion = async (
  baseDir: FileSystemDirectoryHandle,
  version: string,
  create: boolean,
): Promise<FileSystemFileHandle> => {
  if (version === DEFAULT_VERSION) {
    return await baseDir.getFileHandle("default.sqlite3", { create });
  }
  const versionDir = await baseDir.getDirectoryHandle(version, { create });
  return await versionDir.getFileHandle("db.sqlite3", { create });
};
