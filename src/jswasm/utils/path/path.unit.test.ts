import { describe, expect, it } from "vitest";
import { createPathFS, PATH, PATH_FS } from "./path";

const mockFS = {
  cwd: () => "/foo/bar",
};

describe("PATH utilities", () => {
  it("normalizes strings while preserving trailing separators and handling dot segments", () => {
    const cases: Array<[string, string]> = [
      ["/foo/../bar//baz/", "/bar/baz/"],
      ["foo/././bar", "foo/bar"],
      ["./../", "../"],
      ["", "."],
      ["/", "/"],
    ];

    for (const [input, expected] of cases) {
      expect(PATH.normalize(input)).toBe(expected);
    }
  });

  it("normalizes arrays with parent directory handling", () => {
    const input = ["foo", "..", "..", "bar", ".", "baz"];
    const normalized = PATH.normalizeArray([...input], true);
    expect(normalized).toEqual(["..", "bar", "baz"]);
  });

  it("provides dirname and basename consistent with POSIX semantics", () => {
    expect(PATH.dirname("/foo/bar/baz.txt")).toBe("/foo/bar");
    expect(PATH.dirname("/foo/")).toBe("/");
    expect(PATH.dirname("foo")).toBe(".");
    expect(PATH.dirname("/")).toBe("/");

    expect(PATH.basename("/foo/bar/baz.txt")).toBe("baz.txt");
    expect(PATH.basename("/foo/")).toBe("foo");
    expect(PATH.basename("foo")).toBe("foo");
    expect(PATH.basename("/")).toBe("/");
  });

  it("joins segments and normalizes separators", () => {
    expect(PATH.join("foo", "bar", "..", "baz")).toBe("foo/baz");
    expect(PATH.join("/foo/", "/bar", "baz/")).toBe("/foo/bar/baz/");
    expect(PATH.join2("/foo", "bar")).toBe("/foo/bar");
  });

  it("resolves paths with and without a filesystem helper", () => {
    expect(PATH_FS.resolve("..", "baz")).toBe("/baz");
    const fsResolver = createPathFS(mockFS);
    expect(fsResolver.resolve("..", "baz")).toBe("/foo/baz");
    expect(fsResolver.resolve("baz", "..", "qux")).toBe("/foo/bar/qux");
    expect(() => fsResolver.resolve("foo", 123 as never)).toThrow(TypeError);
  });

  it("computes relative paths via the provided filesystem context", () => {
    const fsResolver = createPathFS(mockFS);
    expect(fsResolver.relative("/foo/bar/baz", "/foo/qux")).toBe("../../qux");
    expect(fsResolver.relative("/foo/bar", "/foo/bar/baz")).toBe("baz");
  });
});
