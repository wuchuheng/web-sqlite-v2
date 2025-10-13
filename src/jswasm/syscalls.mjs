/**
 * SYSCALLS - System call utilities and implementations
 * Extracted from sqlite3.mjs for better code organization
 */

 
export function createSYSCALLS(FS, PATH, HEAPU8, HEAP8, HEAP16, HEAP32, HEAPU32, HEAP64, UTF8ArrayToString, lengthBytesUTF8, stringToUTF8Array) {
    const UTF8ToString = (ptr, maxBytesToRead) => {
        return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : "";
    };

    const stringToUTF8 = (str, outPtr, maxBytesToWrite) => {
        return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
    };

    const SYSCALLS = {
        DEFAULT_POLLMASK: 5,
        calculateAt(dirfd, path, allowEmpty) {
            if (PATH.isAbs(path)) {
                return path;
            }

            var dir;
            if (dirfd === -100) {
                dir = FS.cwd();
            } else {
                var dirstream = SYSCALLS.getStreamFromFD(dirfd);
                dir = dirstream.path;
            }
            if (path.length == 0) {
                if (!allowEmpty) {
                    throw new FS.ErrnoError(44);
                }
                return dir;
            }
            return PATH.join2(dir, path);
        },
        doStat(func, path, buf) {
            var stat = func(path);
            HEAP32[buf >> 2] = stat.dev;
            HEAP32[(buf + 4) >> 2] = stat.mode;
            HEAPU32[(buf + 8) >> 2] = stat.nlink;
            HEAP32[(buf + 12) >> 2] = stat.uid;
            HEAP32[(buf + 16) >> 2] = stat.gid;
            HEAP32[(buf + 20) >> 2] = stat.rdev;
            HEAP64[(buf + 24) >> 3] = BigInt(stat.size);
            HEAP32[(buf + 32) >> 2] = 4096;
            HEAP32[(buf + 36) >> 2] = stat.blocks;
            var atime = stat.atime.getTime();
            var mtime = stat.mtime.getTime();
            var ctime = stat.ctime.getTime();
            HEAP64[(buf + 40) >> 3] = BigInt(Math.floor(atime / 1000));
            HEAPU32[(buf + 48) >> 2] = (atime % 1000) * 1000 * 1000;
            HEAP64[(buf + 56) >> 3] = BigInt(Math.floor(mtime / 1000));
            HEAPU32[(buf + 64) >> 2] = (mtime % 1000) * 1000 * 1000;
            HEAP64[(buf + 72) >> 3] = BigInt(Math.floor(ctime / 1000));
            HEAPU32[(buf + 80) >> 2] = (ctime % 1000) * 1000 * 1000;
            HEAP64[(buf + 88) >> 3] = BigInt(stat.ino);
            return 0;
        },
        doMsync(addr, stream, len, flags, offset) {
            if (!FS.isFile(stream.node.mode)) {
                throw new FS.ErrnoError(43);
            }
            if (flags & 2) {
                return 0;
            }
            var buffer = HEAPU8.slice(addr, addr + len);
            FS.msync(stream, buffer, offset, len, flags);
        },
        getStreamFromFD(fd) {
            var stream = FS.getStreamChecked(fd);
            return stream;
        },
        varargs: undefined,
        getStr(ptr) {
            var ret = UTF8ToString(ptr);
            return ret;
        },
    };

    function syscallGetVarargI() {
        var ret = HEAP32[+SYSCALLS.varargs >> 2];
        SYSCALLS.varargs += 4;
        return ret;
    }
    var syscallGetVarargP = syscallGetVarargI;

    const INT53_MAX = 9007199254740992;
    const INT53_MIN = -9007199254740992;
    const bigintToI53Checked = (num) =>
        num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);

    const readI53FromI64 = (ptr) => {
        return HEAPU32[ptr >> 2] + HEAP32[(ptr + 4) >> 2] * 4294967296;
    };

    function ___syscall_chmod(path, mode) {
        try {
            path = SYSCALLS.getStr(path);
            FS.chmod(path, mode);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_faccessat(dirfd, path, amode, _flags) {
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);
            if (amode & ~7) {
                return -28;
            }
            var lookup = FS.lookupPath(path, { follow: true });
            var node = lookup.node;
            if (!node) {
                return -44;
            }
            var perms = "";
            if (amode & 4) perms += "r";
            if (amode & 2) perms += "w";
            if (amode & 1) perms += "x";
            if (perms && FS.nodePermissions(node, perms)) {
                return -2;
            }
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_fchmod(fd, mode) {
        try {
            FS.fchmod(fd, mode);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_fchown32(fd, owner, group) {
        try {
            FS.fchown(fd, owner, group);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_fcntl64(fd, cmd, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            let arg;
            switch (cmd) {
                case 0: {
                    arg = syscallGetVarargI();
                    if (arg < 0) {
                        return -28;
                    }
                    while (FS.streams[arg]) {
                        arg++;
                    }
                    var newStream;
                    newStream = FS.dupStream(stream, arg);
                    return newStream.fd;
                }
                case 1:
                case 2:
                    return 0;
                case 3:
                    return stream.flags;
                case 4: {
                    arg = syscallGetVarargI();
                    stream.flags |= arg;
                    return 0;
                }
                case 12: {
                    arg = syscallGetVarargP();
                    var offset = 0;

                    HEAP16[(arg + offset) >> 1] = 2;
                    return 0;
                }
                case 13:
                case 14:
                    return 0;
            }
            return -28;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_fstat64(fd, buf) {
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            return SYSCALLS.doStat(FS.stat, stream.path, buf);
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_ftruncate64(fd, length) {
        length = bigintToI53Checked(length);

        try {
            if (isNaN(length)) return 61;
            FS.ftruncate(fd, length);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_getcwd(buf, size) {
        try {
            if (size === 0) return -28;
            var cwd = FS.cwd();
            var cwdLengthInBytes = lengthBytesUTF8(cwd) + 1;
            if (size < cwdLengthInBytes) return -68;
            stringToUTF8(cwd, buf, size);
            return cwdLengthInBytes;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_ioctl(fd, op, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            var stream = SYSCALLS.getStreamFromFD(fd);
            let argp;
            switch (op) {
                case 21509: {
                    if (!stream.tty) return -59;
                    return 0;
                }
                case 21505: {
                    if (!stream.tty) return -59;
                    if (stream.tty.ops.ioctl_tcgets) {
                        var termios = stream.tty.ops.ioctl_tcgets(stream);
                        argp = syscallGetVarargP();
                        HEAP32[argp >> 2] = termios.c_iflag || 0;
                        HEAP32[(argp + 4) >> 2] = termios.c_oflag || 0;
                        HEAP32[(argp + 8) >> 2] = termios.c_cflag || 0;
                        HEAP32[(argp + 12) >> 2] = termios.c_lflag || 0;
                        for (var i = 0; i < 32; i++) {
                            HEAP8[argp + i + 17] = termios.c_cc[i] || 0;
                        }
                        return 0;
                    }
                    return 0;
                }
                case 21510:
                case 21511:
                case 21512: {
                    if (!stream.tty) return -59;
                    return 0;
                }
                case 21506:
                case 21507:
                case 21508: {
                    if (!stream.tty) return -59;
                    if (stream.tty.ops.ioctl_tcsets) {
                        argp = syscallGetVarargP();
                        var c_iflag = HEAP32[argp >> 2];
                        var c_oflag = HEAP32[(argp + 4) >> 2];
                        var c_cflag = HEAP32[(argp + 8) >> 2];
                        var c_lflag = HEAP32[(argp + 12) >> 2];
                        var c_cc = [];
                        for (let i = 0; i < 32; i++) {
                            c_cc.push(HEAP8[argp + i + 17]);
                        }
                        return stream.tty.ops.ioctl_tcsets(stream.tty, op, {
                            c_iflag,
                            c_oflag,
                            c_cflag,
                            c_lflag,
                            c_cc,
                        });
                    }
                    return 0;
                }
                case 21519: {
                    if (!stream.tty) return -59;
                    argp = syscallGetVarargP();
                    HEAP32[argp >> 2] = 0;
                    return 0;
                }
                case 21520: {
                    if (!stream.tty) return -59;
                    return -28;
                }
                case 21531: {
                    argp = syscallGetVarargP();
                    return FS.ioctl(stream, op, argp);
                }
                case 21523: {
                    if (!stream.tty) return -59;
                    if (stream.tty.ops.ioctl_tiocgwinsz) {
                        var winsize = stream.tty.ops.ioctl_tiocgwinsz(
                            stream.tty
                        );
                        argp = syscallGetVarargP();
                        HEAP16[argp >> 1] = winsize[0];
                        HEAP16[(argp + 2) >> 1] = winsize[1];
                    }
                    return 0;
                }
                case 21524: {
                    if (!stream.tty) return -59;
                    return 0;
                }
                case 21515: {
                    if (!stream.tty) return -59;
                    return 0;
                }
                default:
                    return -28;
            }
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_lstat64(path, buf) {
        try {
            path = SYSCALLS.getStr(path);
            return SYSCALLS.doStat(FS.lstat, path, buf);
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_mkdirat(dirfd, path, mode) {
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);

            path = PATH.normalize(path);
            if (path[path.length - 1] === "/")
                path = path.substr(0, path.length - 1);
            FS.mkdir(path, mode, 0);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_newfstatat(dirfd, path, buf, flags) {
        try {
            path = SYSCALLS.getStr(path);
            var nofollow = flags & 256;
            var allowEmpty = flags & 4096;
            flags = flags & ~6400;
            path = SYSCALLS.calculateAt(dirfd, path, allowEmpty);
            return SYSCALLS.doStat(
                nofollow ? FS.lstat : FS.stat,
                path,
                buf
            );
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_openat(dirfd, path, flags, varargs) {
        SYSCALLS.varargs = varargs;
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);
            var mode = varargs ? syscallGetVarargI() : 0;
            return FS.open(path, flags, mode).fd;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_readlinkat(dirfd, path, buf, bufsize) {
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);
            if (bufsize <= 0) return -28;
            var ret = FS.readlink(path);

            var len = Math.min(bufsize, lengthBytesUTF8(ret));
            var endChar = HEAP8[buf + len];
            stringToUTF8(ret, buf, bufsize + 1);

            HEAP8[buf + len] = endChar;
            return len;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_rmdir(path) {
        try {
            path = SYSCALLS.getStr(path);
            FS.rmdir(path);
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_stat64(path, buf) {
        try {
            path = SYSCALLS.getStr(path);
            return SYSCALLS.doStat(FS.stat, path, buf);
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_unlinkat(dirfd, path, flags) {
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path);
            if (flags === 0) {
                FS.unlink(path);
            } else if (flags === 512) {
                FS.rmdir(path);
            } else {
                // Note: abort function needs to be passed from caller
                throw new Error("Invalid flags passed to unlinkat");
            }
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    function ___syscall_utimensat(dirfd, path, times, _flags) {
        try {
            path = SYSCALLS.getStr(path);
            path = SYSCALLS.calculateAt(dirfd, path, true);
            var now = Date.now(),
                atime,
                mtime;
            if (!times) {
                atime = now;
                mtime = now;
            } else {
                var seconds = readI53FromI64(times);
                var nanoseconds = HEAP32[(times + 8) >> 2];
                if (nanoseconds == 1073741823) {
                    atime = now;
                } else if (nanoseconds == 1073741822) {
                    atime = -1;
                } else {
                    atime = seconds * 1000 + nanoseconds / (1000 * 1000);
                }
                times += 16;
                seconds = readI53FromI64(times);
                nanoseconds = HEAP32[(times + 8) >> 2];
                if (nanoseconds == 1073741823) {
                    mtime = now;
                } else if (nanoseconds == 1073741822) {
                    mtime = -1;
                } else {
                    mtime = seconds * 1000 + nanoseconds / (1000 * 1000);
                }
            }

            if (mtime != -1 || atime != -1) {
                FS.utime(path, atime, mtime);
            }
            return 0;
        } catch (e) {
            if (typeof FS == "undefined" || !(e.name === "ErrnoError"))
                throw e;
            return -e.errno;
        }
    }

    return {
        SYSCALLS,
        ___syscall_chmod,
        ___syscall_faccessat,
        ___syscall_fchmod,
        ___syscall_fchown32,
        ___syscall_fcntl64,
        ___syscall_fstat64,
        ___syscall_ftruncate64,
        ___syscall_getcwd,
        ___syscall_ioctl,
        ___syscall_lstat64,
        ___syscall_mkdirat,
        ___syscall_newfstatat,
        ___syscall_openat,
        ___syscall_readlinkat,
        ___syscall_rmdir,
        ___syscall_stat64,
        ___syscall_unlinkat,
        ___syscall_utimensat,
    };
}
