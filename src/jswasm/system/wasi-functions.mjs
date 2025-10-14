/**
 * WASI and system-level functions for SQLite3 WebAssembly
 * Extracted from sqlite3.mjs for better code organization
 *
 * This module contains:
 * - Time and date functions
 * - Memory management utilities
 * - Environment variable handling
 * - File descriptor operations (read, write, seek, sync, close)
 */

/**
 * Creates and exports all WASI-related system functions
 */
export function createWASIFunctions(
    FS,
    SYSCALLS,
    HEAP8,
    HEAP16,
    HEAP32,
    HEAPU8,
    HEAPU32,
    HEAP64,
    stringToUTF8Array
) {
    // Utility function for UTF8 conversion
    const stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };

    // Integer conversion utilities
    const INT53_MAX = 9007199254740992;
    const INT53_MIN = -9007199254740992;
    const bigintToI53Checked = (num) =>
        num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);

    const nowIsMonotonic = 1;
    const __emscripten_get_now_is_monotonic = () => nowIsMonotonic;

    // Date/time utilities
    const isLeapYear = (year) =>
        year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

    const MONTH_DAYS_LEAP_CUMULATIVE = [
        0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335,
    ];

    const MONTH_DAYS_REGULAR_CUMULATIVE = [
        0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
    ];

    const ydayFromDate = (date) => {
        const leap = isLeapYear(date.getFullYear());
        const monthDaysCumulative = leap
            ? MONTH_DAYS_LEAP_CUMULATIVE
            : MONTH_DAYS_REGULAR_CUMULATIVE;
        const yday =
            monthDaysCumulative[date.getMonth()] + date.getDate() - 1;

        return yday;
    };

    function __localtime_js(time, tmPtr) {
        time = bigintToI53Checked(time);

        const date = new Date(time * 1000);
        HEAP32[tmPtr >> 2] = date.getSeconds();
        HEAP32[(tmPtr + 4) >> 2] = date.getMinutes();
        HEAP32[(tmPtr + 8) >> 2] = date.getHours();
        HEAP32[(tmPtr + 12) >> 2] = date.getDate();
        HEAP32[(tmPtr + 16) >> 2] = date.getMonth();
        HEAP32[(tmPtr + 20) >> 2] = date.getFullYear() - 1900;
        HEAP32[(tmPtr + 24) >> 2] = date.getDay();

        const yday = ydayFromDate(date) | 0;
        HEAP32[(tmPtr + 28) >> 2] = yday;
        HEAP32[(tmPtr + 36) >> 2] = -(date.getTimezoneOffset() * 60);

        const start = new Date(date.getFullYear(), 0, 1);
        const summerOffset = new Date(
            date.getFullYear(),
            6,
            1
        ).getTimezoneOffset();
        const winterOffset = start.getTimezoneOffset();
        const dst =
            (summerOffset != winterOffset &&
                date.getTimezoneOffset() ==
                    Math.min(winterOffset, summerOffset)) | 0;
        HEAP32[(tmPtr + 32) >> 2] = dst;
    }

    function __mmap_js(len, prot, flags, fd, offset, allocated, addr) {
        offset = bigintToI53Checked(offset);

        try {
            if (isNaN(offset)) return 61;
            const stream = SYSCALLS.getStreamFromFD(fd);
            const res = FS.mmap(stream, len, offset, prot, flags);
            const ptr = res.ptr;
            HEAP32[allocated >> 2] = res.allocated;
            HEAPU32[addr >> 2] = ptr;
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function __munmap_js(addr, len, prot, flags, fd, offset) {
        offset = bigintToI53Checked(offset);

        try {
            const stream = SYSCALLS.getStreamFromFD(fd);
            if (prot & 2) {
                SYSCALLS.doMsync(addr, stream, len, flags, offset);
            }
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    const __tzset_js = (timezone, daylight, std_name, dst_name) => {
        const currentYear = new Date().getFullYear();
        const winter = new Date(currentYear, 0, 1);
        const summer = new Date(currentYear, 6, 1);
        const winterOffset = winter.getTimezoneOffset();
        const summerOffset = summer.getTimezoneOffset();

        const stdTimezoneOffset = Math.max(winterOffset, summerOffset);

        HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;

        HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);

        const extractZone = (timezoneOffset) => {
            const sign = timezoneOffset >= 0 ? "-" : "+";

            const absOffset = Math.abs(timezoneOffset);
            const hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
            const minutes = String(absOffset % 60).padStart(2, "0");

            return `UTC${sign}${hours}${minutes}`;
        };

        const winterName = extractZone(winterOffset);
        const summerName = extractZone(summerOffset);
        if (summerOffset < winterOffset) {
            stringToUTF8(winterName, std_name, 17);
            stringToUTF8(summerName, dst_name, 17);
        } else {
            stringToUTF8(winterName, dst_name, 17);
            stringToUTF8(summerName, std_name, 17);
        }
    };

    const _emscripten_date_now = () => Date.now();

    const _emscripten_get_now = () => performance.now();

    // Environment variables
    const ENV = {};

    const getExecutableName = () => {
        return "./this.program";
    };

    const getEnvStrings = () => {
        if (!getEnvStrings.strings) {
            const lang =
                (
                    (typeof navigator == "object" &&
                        navigator.languages &&
                        navigator.languages[0]) ||
                    "C"
                ).replace("-", "_") + ".UTF-8";
            const env = {
                USER: "web_user",
                LOGNAME: "web_user",
                PATH: "/",
                PWD: "/",
                HOME: "/home/web_user",
                LANG: lang,
                _: getExecutableName(),
            };

            for (const x in ENV) {
                if (ENV[x] === undefined) delete env[x];
                else env[x] = ENV[x];
            }
            const strings = [];
            for (const x in env) {
                strings.push(`${x}=${env[x]}`);
            }
            getEnvStrings.strings = strings;
        }
        return getEnvStrings.strings;
    };

    const stringToAscii = (str, buffer) => {
        for (let i = 0; i < str.length; ++i) {
            HEAP8[buffer++] = str.charCodeAt(i);
        }

        HEAP8[buffer] = 0;
    };

    const _environ_get = (__environ, environ_buf) => {
        let bufSize = 0;
        getEnvStrings().forEach((string, i) => {
            const ptr = environ_buf + bufSize;
            HEAPU32[(__environ + i * 4) >> 2] = ptr;
            stringToAscii(string, ptr);
            bufSize += string.length + 1;
        });
        return 0;
    };

    const _environ_sizes_get = (penviron_count, penviron_buf_size) => {
        const strings = getEnvStrings();
        HEAPU32[penviron_count >> 2] = strings.length;
        let bufSize = 0;
        strings.forEach((string) => (bufSize += string.length + 1));
        HEAPU32[penviron_buf_size >> 2] = bufSize;
        return 0;
    };

    // File descriptor operations
    function _fd_close(fd) {
        try {
            const stream = SYSCALLS.getStreamFromFD(fd);
            FS.close(stream);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return e.errno;
        }
    }

    function _fd_fdstat_get(fd, pbuf) {
        try {
            const rightsBase = 0;
            const rightsInheriting = 0;
            const flags = 0;
            const stream = SYSCALLS.getStreamFromFD(fd);

            const type = stream.tty
                ? 2
                : FS.isDir(stream.mode)
                ? 3
                : FS.isLink(stream.mode)
                ? 7
                : 4;

            HEAP8[pbuf] = type;
            HEAP16[(pbuf + 2) >> 1] = flags;
            HEAP64[(pbuf + 8) >> 3] = BigInt(rightsBase);
            HEAP64[(pbuf + 16) >> 3] = BigInt(rightsInheriting);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return e.errno;
        }
    }

    const doReadv = (stream, iov, iovcnt, offset) => {
        let ret = 0;
        for (let i = 0; i < iovcnt; i++) {
            const ptr = HEAPU32[iov >> 2];
            const len = HEAPU32[(iov + 4) >> 2];
            iov += 8;
            const curr = FS.read(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) break;
            if (typeof offset != "undefined") {
                offset += curr;
            }
        }
        return ret;
    };

    function _fd_read(fd, iov, iovcnt, pnum) {
        try {
            const stream = SYSCALLS.getStreamFromFD(fd);
            const num = doReadv(stream, iov, iovcnt);
            HEAPU32[pnum >> 2] = num;
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return e.errno;
        }
    }

    function _fd_seek(fd, offset, whence, newOffset) {
        offset = bigintToI53Checked(offset);

        try {
            if (isNaN(offset)) return 61;
            const stream = SYSCALLS.getStreamFromFD(fd);
            FS.llseek(stream, offset, whence);
            HEAP64[newOffset >> 3] = BigInt(stream.position);
            if (stream.getdents && offset === 0 && whence === 0)
                stream.getdents = null;
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return e.errno;
        }
    }

    function _fd_sync(fd) {
        try {
            const stream = SYSCALLS.getStreamFromFD(fd);
            if (stream.stream_ops?.fsync) {
                return stream.stream_ops.fsync(stream);
            }
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return e.errno;
        }
    }

    const doWritev = (stream, iov, iovcnt, offset) => {
        let ret = 0;
        for (let i = 0; i < iovcnt; i++) {
            const ptr = HEAPU32[iov >> 2];
            const len = HEAPU32[(iov + 4) >> 2];
            iov += 8;
            const curr = FS.write(stream, HEAP8, ptr, len, offset);
            if (curr < 0) return -1;
            ret += curr;
            if (curr < len) {
                break;
            }
            if (typeof offset != "undefined") {
                offset += curr;
            }
        }
        return ret;
    };

    function _fd_write(fd, iov, iovcnt, pnum) {
        try {
            const stream = SYSCALLS.getStreamFromFD(fd);
            const num = doWritev(stream, iov, iovcnt);
            HEAPU32[pnum >> 2] = num;
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return e.errno;
        }
    }

    // Return all functions
    return {
        __emscripten_get_now_is_monotonic,
        __localtime_js,
        __mmap_js,
        __munmap_js,
        __tzset_js,
        _emscripten_date_now,
        _emscripten_get_now,
        _environ_get,
        _environ_sizes_get,
        _fd_close,
        _fd_fdstat_get,
        _fd_read,
        _fd_seek,
        _fd_sync,
        _fd_write,
    };
}
