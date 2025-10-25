import type { TestCase } from "../core/test-runner";
import { TestUtils } from "../utils/test-utils";

/**
 * Version Information Tests
 * Validates metadata and version-related C API bindings.
 */
export const versionInfoTests: TestCase[] = [
  {
    name: "Version metadata matches C API values",
    fn: async (sqlite3) => {
      const capiVersion = sqlite3.capi.sqlite3_libversion();
      const capiVersionNumber = sqlite3.capi.sqlite3_libversion_number();

      TestUtils.assertEqual(
        sqlite3.version.libVersion,
        capiVersion,
        "libVersion should match sqlite3_libversion()",
      );
      TestUtils.assertEqual(
        sqlite3.version.libVersionNumber,
        capiVersionNumber,
        "libVersionNumber should match sqlite3_libversion_number()",
      );
    },
  },
  {
    name: "Source ID is consistent",
    fn: async (sqlite3) => {
      const capiSourceId = sqlite3.capi.sqlite3_sourceid();

      TestUtils.assert(
        typeof capiSourceId === "string" && capiSourceId.length > 0,
        "sqlite3_sourceid() should return a non-empty string",
      );
      TestUtils.assertEqual(
        sqlite3.version.sourceId,
        capiSourceId,
        "Version sourceId should match sqlite3_sourceid()",
      );
    },
  },
  {
    name: "Version fields have expected shapes",
    fn: async (sqlite3) => {
      TestUtils.assert(
        /^\d+\.\d+\.\d+$/.test(sqlite3.version.libVersion),
        "libVersion should be in semantic version format",
      );
      TestUtils.assert(
        Number.isInteger(sqlite3.version.libVersionNumber),
        "libVersionNumber should be an integer",
      );
      TestUtils.assert(
        Number.isInteger(sqlite3.version.downloadVersion),
        "downloadVersion should be an integer",
      );
      TestUtils.assert(
        sqlite3.version.downloadVersion >= sqlite3.version.libVersionNumber,
        "downloadVersion should not be less than libVersionNumber",
      );
    },
  },
];
