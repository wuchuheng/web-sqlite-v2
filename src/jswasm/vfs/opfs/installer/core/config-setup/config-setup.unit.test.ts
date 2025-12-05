import { afterEach, describe, expect, it, vi } from "vitest";

import type { OpfsConfig } from "../../../../../shared/opfs-vfs-installer";
import type { PrepareOpfsConfigResult } from "./config-setup";

const loadModule = async () => {
  vi.resetModules();
  return await import("./config-setup");
};

const setLocation = (query = "") => {
  const href = `https://example.test/${query.startsWith("?") ? query : ""}`;
  vi.stubGlobal("location", { href });
};

function expectEnabledConfig(
  config: PrepareOpfsConfigResult,
): asserts config is OpfsConfig & { disabled: false } {
  expect(config.disabled).toBe(false);
}

describe("config-setup.mjs (baseline)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults when options are missing", async () => {
    setLocation();
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig(undefined, "/proxy.js");
    expectEnabledConfig(config);
    expect(config).toEqual({
      verbose: 1,
      sanityChecks: false,
      proxyUri: "/proxy.js",
      disabled: false,
    });
  });

  it("treats non-object options as empty configuration", async () => {
    setLocation();
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig(null, "/proxy.js");
    expectEnabledConfig(config);
    expect(config).toEqual({
      verbose: 1,
      sanityChecks: false,
      proxyUri: "/proxy.js",
      disabled: false,
    });
  });

  it("honors the disable flag from query parameters", async () => {
    setLocation("?opfs-disable");
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig({}, "/proxy.js");
    expect(config).toEqual({ disabled: true });
  });

  it("reads verbose level from query parameters", async () => {
    setLocation("?opfs-verbose=3");
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig({}, "/proxy.js");
    expectEnabledConfig(config);
    expect(config.verbose).toBe(3);
    expect(config).toMatchObject({
      sanityChecks: false,
      proxyUri: "/proxy.js",
    });
  });

  it("falls back to verbose level 2 when query value is not numeric", async () => {
    setLocation("?opfs-verbose=not-a-number");
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig({}, "/proxy.js");
    expectEnabledConfig(config);
    expect(config.verbose).toBe(2);
  });

  it("enables sanity checks when the query flag is present", async () => {
    setLocation("?opfs-sanity-check");
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig({}, "/proxy.js");
    expectEnabledConfig(config);
    expect(config.sanityChecks).toBe(true);
  });

  it("prefers caller-provided proxy URI strings", async () => {
    setLocation();
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig(
      { proxyUri: "./custom-proxy.js" },
      "/proxy.js",
    );
    expectEnabledConfig(config);
    expect(config.proxyUri).toBe("./custom-proxy.js");
  });

  it("resolves proxy URI when provided as a function", async () => {
    setLocation();
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig(
      { proxyUri: () => "./fn-proxy.js" },
      "/proxy.js",
    );
    expectEnabledConfig(config);
    expect(config.proxyUri).toBe("./fn-proxy.js");
  });

  it("preserves caller-supplied values over query defaults", async () => {
    setLocation("?opfs-verbose=4&opfs-sanity-check");
    const { prepareOpfsConfig } = await loadModule();
    const config = prepareOpfsConfig(
      { verbose: 0, sanityChecks: false, proxyUri: "./provided.js" },
      "/proxy.js",
    );
    expectEnabledConfig(config);
    expect(config).toEqual({
      verbose: 0,
      sanityChecks: false,
      proxyUri: "./provided.js",
      disabled: false,
    });
  });
});
