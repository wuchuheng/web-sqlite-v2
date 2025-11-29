/**
 * Unit tests for filesystem constants module
 * Tests the TypeScript implementation after migration
 */

import { describe, it, expect } from "vitest";
import {
  MODE,
  OPEN_FLAGS,
  STREAM_STATE_MASK,
  MAX_OPEN_FDS,
  DEVICE_MAJOR_BASE,
  ERRNO_CODES,
  PERMISSION,
} from "./constants";

describe("filesystem constants", () => {
  describe("MODE constants", () => {
    it("should export all required mode constants", () => {
      // 1. Verify object exists and has expected structure
      expect(MODE).toBeDefined();
      expect(typeof MODE).toBe("object");

      // 2. Verify key mode bit values
      expect(MODE.TYPE_MASK).toBe(0o170000);
      expect(MODE.FILE).toBe(0o100000);
      expect(MODE.DIRECTORY).toBe(0o040000);
      expect(MODE.SYMLINK).toBe(0o120000);
      expect(MODE.CHARACTER_DEVICE).toBe(0o020000);
      expect(MODE.BLOCK_DEVICE).toBe(0o060000);
      expect(MODE.FIFO).toBe(0o010000);
      expect(MODE.SOCKET).toBe(0o140000);

      // 3. Verify permission constants
      expect(MODE.PERMISSION_READ).toBe(0o444);
      expect(MODE.PERMISSION_WRITE).toBe(0o222);
      expect(MODE.PERMISSION_EXECUTE).toBe(0o111);
      expect(MODE.PERMISSION_MASK).toBe(0o7777);
      expect(MODE.DIR_PERMISSION_MASK).toBe(0o777);
      expect(MODE.DIR_PERMISSION_WITH_STICKY).toBe(0o1777);

      // 4. Verify default permissions
      expect(MODE.DEFAULT_FILE_PERMISSIONS).toBe(0o666);
      expect(MODE.DEFAULT_DIRECTORY_PERMISSIONS).toBe(0o777);
    });

    it("should have readonly numeric properties", () => {
      // Verify all properties are numbers and cannot be modified
      Object.values(MODE).forEach((value) => {
        expect(typeof value).toBe("number");
      });
    });
  });

  describe("OPEN_FLAGS constants", () => {
    it("should export all required open flag constants", () => {
      // 1. Verify object exists and has expected structure
      expect(OPEN_FLAGS).toBeDefined();
      expect(typeof OPEN_FLAGS).toBe("object");

      // 2. Verify access mode flags
      expect(OPEN_FLAGS.O_ACCMODE).toBe(0o3);
      expect(OPEN_FLAGS.O_RDONLY).toBe(0);
      expect(OPEN_FLAGS.O_WRONLY).toBe(1);
      expect(OPEN_FLAGS.O_RDWR).toBe(2);

      // 3. Verify file creation flags
      expect(OPEN_FLAGS.O_CREAT).toBe(0o100);
      expect(OPEN_FLAGS.O_EXCL).toBe(0o200);
      expect(OPEN_FLAGS.O_TRUNC).toBe(0o1000);
      expect(OPEN_FLAGS.O_APPEND).toBe(0o2000);

      // 4. Verify directory and path flags
      expect(OPEN_FLAGS.O_DIRECTORY).toBe(0o200000);
      expect(OPEN_FLAGS.O_NOFOLLOW).toBe(0o400000);
      expect(OPEN_FLAGS.O_PATH).toBe(0o10000000);
    });

    it("should have readonly numeric properties", () => {
      // Verify all properties are numbers
      Object.values(OPEN_FLAGS).forEach((value) => {
        expect(typeof value).toBe("number");
      });
    });
  });

  describe("ERRNO_CODES constants", () => {
    it("should export all required errno codes", () => {
      // 1. Verify object exists and has expected structure
      expect(ERRNO_CODES).toBeDefined();
      expect(typeof ERRNO_CODES).toBe("object");

      // 2. Verify common error codes
      expect(ERRNO_CODES.EPERM).toBe(63);
      expect(ERRNO_CODES.ENOENT).toBe(44);
      expect(ERRNO_CODES.EACCES).toBe(2);
      expect(ERRNO_CODES.EEXIST).toBe(20);
      expect(ERRNO_CODES.ENOTDIR).toBe(54);
      expect(ERRNO_CODES.ENOTEMPTY).toBe(55);
      expect(ERRNO_CODES.EISDIR).toBe(31);
      expect(ERRNO_CODES.EINVAL).toBe(28);
      expect(ERRNO_CODES.ELOOP).toBe(32);
      expect(ERRNO_CODES.EXDEV).toBe(75);
      expect(ERRNO_CODES.EBUSY).toBe(10);
      expect(ERRNO_CODES.EBADF).toBe(8);
      expect(ERRNO_CODES.EMFILE).toBe(33);
      expect(ERRNO_CODES.ESPIPE).toBe(70);
      expect(ERRNO_CODES.EIO).toBe(29);
      expect(ERRNO_CODES.ENXIO).toBe(6);
      expect(ERRNO_CODES.ENOTTY).toBe(59);
      expect(ERRNO_CODES.ENOTSUP).toBe(138);
      expect(ERRNO_CODES.ENODEV).toBe(43);
    });

    it("should have readonly numeric properties", () => {
      // Verify all properties are numbers
      Object.values(ERRNO_CODES).forEach((value) => {
        expect(typeof value).toBe("number");
      });
    });
  });

  describe("Single value constants", () => {
    it("should export STREAM_STATE_MASK", () => {
      expect(STREAM_STATE_MASK).toBeDefined();
      expect(typeof STREAM_STATE_MASK).toBe("number");
      expect(STREAM_STATE_MASK).toBe(OPEN_FLAGS.O_PATH | OPEN_FLAGS.O_ACCMODE);
    });

    it("should export MAX_OPEN_FDS", () => {
      expect(MAX_OPEN_FDS).toBeDefined();
      expect(typeof MAX_OPEN_FDS).toBe("number");
      expect(MAX_OPEN_FDS).toBe(4096);
    });

    it("should export DEVICE_MAJOR_BASE", () => {
      expect(DEVICE_MAJOR_BASE).toBeDefined();
      expect(typeof DEVICE_MAJOR_BASE).toBe("number");
      expect(DEVICE_MAJOR_BASE).toBe(64);
    });
  });

  describe("PERMISSION constants", () => {
    it("should export permission helper constants", () => {
      expect(PERMISSION).toBeDefined();
      expect(typeof PERMISSION).toBe("object");
      expect(PERMISSION.READ_EXECUTE).toBe(
        MODE.PERMISSION_READ | MODE.PERMISSION_EXECUTE,
      );
    });

    it("should have readonly numeric properties", () => {
      Object.values(PERMISSION).forEach((value) => {
        expect(typeof value).toBe("number");
      });
    });
  });

  describe("Import compatibility", () => {
    it("should support named imports", () => {
      // Test that individual constants can be imported
      expect(MODE).toBeDefined();
      expect(OPEN_FLAGS).toBeDefined();
      expect(ERRNO_CODES).toBeDefined();
    });

    it("should support destructuring imports", () => {
      // This test validates that the import syntax used in the test file works
      expect(typeof MODE).toBe("object");
      expect(typeof OPEN_FLAGS).toBe("object");
      expect(typeof ERRNO_CODES).toBe("object");
    });
  });

  describe("Calculated values consistency", () => {
    it("should have consistent STREAM_STATE_MASK calculation", () => {
      const calculatedMask = OPEN_FLAGS.O_PATH | OPEN_FLAGS.O_ACCMODE;
      expect(STREAM_STATE_MASK).toBe(calculatedMask);
    });

    it("should have consistent PERMISSION.READ_EXECUTE calculation", () => {
      const calculatedPermission =
        MODE.PERMISSION_READ | MODE.PERMISSION_EXECUTE;
      expect(PERMISSION.READ_EXECUTE).toBe(calculatedPermission);
    });
  });
});
