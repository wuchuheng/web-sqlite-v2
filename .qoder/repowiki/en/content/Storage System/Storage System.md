# Storage System

<cite>
**Referenced Files in This Document**   
- [filesystem.mjs](file://src/jswasm/vfs/filesystem.mjs)
- [vfs-integration.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-integration.mjs)
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs)
- [vfs-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.mjs)
- [syscalls.mjs](file://src/jswasm/system/syscalls.mjs)
- [mount-operations.ts](file://src/jswasm/vfs/filesystem/mount-operations/mount-operations.ts)
- [node-actions.ts](file://src/jswasm/vfs/filesystem/node-actions/node-actions.ts)
- [stream-operations.ts](file://src/jswasm/vfs/filesystem/stream-operations/stream-operations.ts)
- [state-initialization.mjs](file://src/jswasm/vfs/opfs/installer/core/state-initialization.mjs)
- [config-setup.mjs](file://src/jswasm/vfs/opfs/installer/core/config-setup.mjs)
- [environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs)
- [sanity-check.mjs](file://src/jswasm/vfs/opfs/installer/utils/sanity-check.mjs)
- [stat-syscalls.mjs](file://src/jswasm/system/stat-syscalls.mjs)
- [ioctl-syscalls.mjs](file://src/jswasm/system/ioctl-syscalls.mjs)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [VFS Architecture Overview](#vfs-architecture-overview)
3. [OPFS Integration Architecture](#opfs-integration-architecture)
4. [Filesystem Module Components](#filesystem-module-components)
5. [System Call Emulation](#system-call-emulation)
6. [Data Flow from SQLite to OPFS](#data-flow-from-sqlite-to-opfs)
7. [Performance Considerations](#performance-considerations)
8. [Security Aspects](#security-aspects)
9. [Configuration and Error Recovery](#configuration-and-error-recovery)

## Introduction
The web-sqlite-v2 storage system implements a Virtual File System (VFS) layer that enables SQLite to operate with the Origin Private File System (OPFS) in web browsers. This architecture bridges the gap between SQLite's traditional file I/O operations and the asynchronous, isolated storage environment provided by OPFS. The system is designed to maintain SQLite's ACID properties while adapting to the constraints and capabilities of web storage APIs. The VFS implementation provides a comprehensive filesystem interface that handles file operations, directory management, and persistence mechanisms through a sophisticated integration with OPFS.

## VFS Architecture Overview
The VFS architecture in web-sqlite-v2 is structured as a modular system that composes various components to provide a complete filesystem interface for SQLite. The core of this architecture is the filesystem facade assembled in the `createFS` function, which combines multiple helper modules into a unified interface. This facade includes path operations, mode operations, stream operations, mount operations, node actions, and initialization helpers, all of which work together to emulate a traditional filesystem environment.

```mermaid
graph TD
subgraph "VFS Core Components"
A[Filesystem State] --> B[Path Operations]
A --> C[Mode Operations]
A --> D[Stream Operations]
A --> E[Mount Operations]
A --> F[Node Actions]
A --> G[Stream Helpers]
A --> H[Initialization Helpers]
A --> I[Legacy Helpers]
end
J[createFS] --> A
K[PATH_FS] --> A
style A fill:#f9f,stroke:#333
style J fill:#ccf,stroke:#333
style K fill:#ccf,stroke:#333
```

**Diagram sources**
- [filesystem.mjs](file://src/jswasm/vfs/filesystem.mjs#L1-L57)

**Section sources**
- [filesystem.mjs](file://src/jswasm/vfs/filesystem.mjs#L1-L57)

## OPFS Integration Architecture
The OPFS integration architecture is designed to enable SQLite's synchronous file operations to work with OPFS's asynchronous APIs through a worker-based communication model. This integration uses SharedArrayBuffer and Atomics to coordinate between the main thread and worker thread, allowing synchronous VFS calls to be processed asynchronously in the worker. The architecture includes VFS method wrappers, I/O method wrappers, and a comprehensive state management system that handles the serialization and deserialization of data between threads.

```mermaid
graph LR
subgraph "Main Thread"
A[SQLite WASM] --> B[VFS Layer]
B --> C[SharedArrayBuffer]
C --> D[Atomics]
end
subgraph "Worker Thread"
E[OPFS Worker] --> F[OPFS APIs]
F --> G[File System]
D --> E
C --> E
end
style A fill:#f9f,stroke:#333
style B fill:#f9f,stroke:#333
style E fill:#f9f,stroke:#333
style F fill:#f9f,stroke:#333
```

**Diagram sources**
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L1-L236)
- [vfs-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.mjs#L1-L160)

**Section sources**
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L1-L236)
- [vfs-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.mjs#L1-L160)

## Filesystem Module Components
The filesystem module in web-sqlite-v2 is composed of several key components that handle different aspects of filesystem operations. These components include mount operations, node actions, and stream operations, each providing specific functionality for managing the virtual filesystem.

### Mount Operations
The mount operations component manages the mounting and unmounting of filesystems within the virtual filesystem tree. It provides methods for mounting filesystem implementations at specific paths, unmounting them, and synchronizing mounted filesystems. The mount operations also handle the creation of special nodes and the lookup of nodes within the filesystem hierarchy.

```mermaid
classDiagram
class MountOperations {
+getMounts(mount)
+syncfs(populate, callback)
+mount(type, opts, mountpoint)
+unmount(mountpoint)
+lookup(parent, name)
+mknod(path, mode, dev)
}
class FileSystemMount {
+type
+opts
+mountpoint
+mounts
+root
}
MountOperations --> FileSystemMount : "manages"
```

**Diagram sources**
- [mount-operations.ts](file://src/jswasm/vfs/filesystem/mount-operations/mount-operations.ts#L1-L310)

**Section sources**
- [mount-operations.ts](file://src/jswasm/vfs/filesystem/mount-operations/mount-operations.ts#L1-L310)

### Node Actions
The node actions component provides high-level operations for manipulating filesystem nodes, including creating, renaming, opening, and removing files and directories. These operations mirror POSIX semantics and are built on top of lower-level core and metadata operations. The node actions interface combines core file/directory operations with file status and metadata operations to provide a comprehensive API for node manipulation.

```mermaid
classDiagram
class NodeActions {
+create
+mkdir
+mkdirTree
+mkdev
+symlink
+rename
+rmdir
+readdir
+unlink
+readlink
+stat
+lstat
+chmod
+lchmod
+fchmod
+chown
+lchown
+fchown
+truncate
+ftruncate
+utime
+open
}
```

**Diagram sources**
- [node-actions.ts](file://src/jswasm/vfs/filesystem/node-actions/node-actions.ts#L1-L79)

**Section sources**
- [node-actions.ts](file://src/jswasm/vfs/filesystem/node-actions/node-actions.ts#L1-L79)

### Stream Operations
The stream operations component manages file descriptors and stream bookkeeping for the virtual filesystem. It provides methods for creating, duplicating, and closing streams, as well as managing character devices and device numbers. The stream operations also include utilities for extracting major and minor device numbers from device IDs and registering character devices with the filesystem.

```mermaid
classDiagram
class StreamOperations {
+MAX_OPEN_FDS
+nextfd()
+getStreamChecked(fd)
+getStream(fd)
+createStream(stream, fd)
+closeStream(fd)
+dupStream(original, fd)
+major(dev)
+minor(dev)
+makedev(major, minor)
+registerDevice(dev, ops)
+getDevice(dev)
}
class chrdev_stream_ops {
+open(stream)
+llseek()
}
StreamOperations --> chrdev_stream_ops : "contains"
```

**Diagram sources**
- [stream-operations.ts](file://src/jswasm/vfs/filesystem/stream-operations/stream-operations.ts#L1-L265)

**Section sources**
- [stream-operations.ts](file://src/jswasm/vfs/filesystem/stream-operations/stream-operations.ts#L1-L265)

## System Call Emulation
The system call emulation layer in web-sqlite-v2 provides implementations of POSIX system calls that SQLite expects to be available. This layer includes syscalls for file status operations, file operations, and terminal control operations, all of which are adapted to work with the virtual filesystem.

### Stat System Calls
The stat system calls component implements syscalls for retrieving file and directory status information, including `stat64`, `lstat64`, `fstat64`, and `newfstatat`. These syscalls return file metadata such as permissions, timestamps, size, and ownership, following POSIX standards. The implementation uses helper utilities to convert path pointers to strings and execute the appropriate filesystem operations.

```mermaid
sequenceDiagram
participant SQLite as "SQLite WASM"
participant Syscall as "Syscall Layer"
participant FS as "File System"
SQLite->>Syscall : ___syscall_stat64(path, buf)
Syscall->>Syscall : getStr(path)
Syscall->>FS : doStat(FS.stat, path, buf)
FS-->>Syscall : File metadata
Syscall-->>SQLite : 0 (success)
SQLite->>Syscall : ___syscall_lstat64(path, buf)
Syscall->>Syscall : getStr(path)
Syscall->>FS : doStat(FS.lstat, path, buf)
FS-->>Syscall : Symbolic link metadata
Syscall-->>SQLite : 0 (success)
```

**Diagram sources**
- [stat-syscalls.mjs](file://src/jswasm/system/stat-syscalls.mjs#L1-L166)

**Section sources**
- [stat-syscalls.mjs](file://src/jswasm/system/stat-syscalls.mjs#L1-L166)

### IOCTL System Calls
The IOCTL system calls component implements device-specific control operations, primarily for terminal (TTY) control. These operations include getting and setting terminal attributes, controlling flow, flushing, and managing window size. The implementation supports various operation codes such as `TCSBRK`, `TCGETS`, `TCSETS`, `TIOCGWINSZ`, and `FIONBIO`, with appropriate error handling for unsupported operations.

```mermaid
flowchart TD
A[___syscall_ioctl] --> B{op}
B --> |TCSBRK| C[Verify TTY]
B --> |TCGETS| D[Get terminal attributes]
B --> |TCSETS| E[Set terminal attributes]
B --> |TIOCGWINSZ| F[Get window size]
B --> |FIONBIO| G[Set/clear non-blocking I/O]
B --> |Other| H[Return -EINVAL]
C --> I[Return 0]
D --> J[Write termios to memory]
J --> K[Return 0]
E --> L[Read termios from memory]
L --> M[Call ioctl_tcsets]
M --> N[Return result]
F --> O[Write window size]
O --> P[Return 0]
G --> Q[Call FS.ioctl]
Q --> R[Return result]
H --> S[Return -EINVAL]
```

**Diagram sources**
- [ioctl-syscalls.mjs](file://src/jswasm/system/ioctl-syscalls.mjs#L1-L225)

**Section sources**
- [ioctl-syscalls.mjs](file://src/jswasm/system/ioctl-syscalls.mjs#L1-L225)

## Data Flow from SQLite to OPFS
The data flow from SQLite's file operations to OPFS storage is orchestrated through a series of coordinated steps that ensure data integrity and consistency. When SQLite performs a file operation, the VFS layer translates this into a corresponding OPFS operation through the worker thread, using SharedArrayBuffer for data transfer and Atomics for synchronization.

```mermaid
sequenceDiagram
participant SQLite as "SQLite WASM"
participant VFS as "VFS Layer"
participant Worker as "OPFS Worker"
participant OPFS as "OPFS APIs"
SQLite->>VFS : xOpen(filename)
VFS->>Worker : opRun("xOpen", filename)
Worker->>OPFS : openFile(filename)
OPFS-->>Worker : File handle
Worker-->>VFS : Success
VFS-->>SQLite : File descriptor
SQLite->>VFS : xWrite(fd, data, offset)
VFS->>VFS : Copy data to SAB
VFS->>Worker : opRun("xWrite", fd, size, offset)
Worker->>OPFS : write(data, offset)
OPFS-->>Worker : Success
Worker-->>VFS : Success
VFS-->>SQLite : Success
SQLite->>VFS : xRead(fd, buffer, offset)
VFS->>Worker : opRun("xRead", fd, size, offset)
Worker->>OPFS : read(size, offset)
OPFS-->>Worker : Data
Worker-->>VFS : Success
VFS->>VFS : Copy data from SAB to buffer
VFS-->>SQLite : Success
SQLite->>VFS : xClose(fd)
VFS->>Worker : opRun("xClose", fd)
Worker->>OPFS : closeFile()
OPFS-->>Worker : Success
Worker-->>VFS : Success
VFS-->>SQLite : Success
```

**Diagram sources**
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L1-L236)
- [vfs-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.mjs#L1-L160)

**Section sources**
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L1-L236)
- [vfs-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/vfs-sync-wrappers.mjs#L1-L160)

## Performance Considerations
The performance of the web-sqlite-v2 storage system is influenced by several factors related to the synchronous vs asynchronous nature of operations and caching strategies. The architecture employs various techniques to optimize performance while maintaining data consistency.

### Synchronous vs Asynchronous Operations
The VFS layer bridges SQLite's synchronous file operations with OPFS's asynchronous APIs through a worker-based model. This introduces some overhead due to the need for thread coordination via SharedArrayBuffer and Atomics. The system uses a shared operation buffer (sabOP) to communicate operation requests and results between threads, minimizing the overhead of cross-thread communication.

```mermaid
flowchart LR
subgraph "Synchronous Path"
A[SQLite] --> B[VFS Layer]
B --> C[SharedArrayBuffer]
C --> D[Atomics.wait]
D --> E[Worker Thread]
E --> F[OPFS APIs]
F --> G[Storage]
G --> E
E --> D
D --> C
C --> B
B --> A
end
subgraph "Asynchronous Optimization"
H[Cached Operations] --> I[Memory Buffer]
I --> J[Batched Writes]
J --> K[Worker Thread]
end
style A fill:#f9f,stroke:#333
style E fill:#f9f,stroke:#333
style F fill:#f9f,stroke:#333
style G fill:#f9f,stroke:#333
style H fill:#ccf,stroke:#333
style I fill:#ccf,stroke:#333
style J fill:#ccf,stroke:#333
```

**Diagram sources**
- [state-initialization.mjs](file://src/jswasm/vfs/opfs/installer/core/state-initialization.mjs#L1-L127)
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L1-L236)

**Section sources**
- [state-initialization.mjs](file://src/jswasm/vfs/opfs/installer/core/state-initialization.mjs#L1-L127)
- [io-sync-wrappers.mjs](file://src/jswasm/vfs/opfs/installer/wrappers/io-sync-wrappers.mjs#L1-L236)

### Caching Strategies
The system employs several caching strategies to improve performance. The file buffer (fileBufferSize) is set to 64KB, providing a reasonable balance between memory usage and I/O efficiency. The architecture also includes metrics tracking for OPFS operations, allowing for performance monitoring and optimization. The shared array buffer (sabIO) is used to transfer data between threads, reducing the need for data serialization and deserialization.

## Security Aspects
The security model of the web-sqlite-v2 storage system is built on the inherent isolation properties of OPFS and the origin-based storage model of web browsers.

### OPFS Isolation
OPFS provides strong isolation between different origins, ensuring that data stored by one origin cannot be accessed by another. This isolation is enforced by the browser's security model and is a fundamental aspect of the storage system's security. The VFS implementation respects these boundaries by operating within the context of the current origin and not attempting to access data from other origins.

### Origin-Based Storage
All data stored through the VFS layer is confined to the origin of the web application. This means that data persistence is tied to the origin, and users can manage storage permissions on a per-origin basis. The system does not attempt to bypass these restrictions, maintaining the security model expected by users and browsers.

```mermaid
graph TD
subgraph "Browser Security Model"
A[Origin A] --> B[OPFS Storage A]
C[Origin B] --> D[OPFS Storage B]
E[Origin C] --> F[OPFS Storage C]
end
G[web-sqlite-v2] --> A
style A fill:#f9f,stroke:#333
style C fill:#f9f,stroke:#333
style E fill:#f9f,stroke:#333
style B fill:#ccf,stroke:#333
style D fill:#ccf,stroke:#333
style F fill:#ccf,stroke:#333
style G fill:#f9f,stroke:#333
```

**Diagram sources**
- [environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs#L1-L53)

**Section sources**
- [environment-validation.mjs](file://src/jswasm/vfs/opfs/installer/core/environment-validation.mjs#L1-L53)

## Configuration and Error Recovery
The web-sqlite-v2 storage system provides configurable options for storage initialization and robust error recovery mechanisms to ensure data integrity.

### Configuration Options
The system offers several configuration options for storage initialization, including verbose logging, sanity checks, and proxy URI settings. These options can be specified programmatically or through URL parameters, allowing for flexible configuration in different environments. The configuration is normalized and validated during initialization to ensure consistent behavior.

```mermaid
flowchart TD
A[Configuration Input] --> B{Options Object?}
B --> |No| C[Create Empty Object]
B --> |Yes| D[Use Provided Object]
C --> E
D --> E
E[Check URL Parameters] --> F{opfs-disable?}
F --> |Yes| G[Disable OPFS]
F --> |No| H[Set Verbose Level]
H --> I[Set Sanity Checks]
I --> J[Resolve Proxy URI]
J --> K[Return Normalized Config]
```

**Diagram sources**
- [config-setup.mjs](file://src/jswasm/vfs/opfs/installer/core/config-setup.mjs#L1-L45)

**Section sources**
- [config-setup.mjs](file://src/jswasm/vfs/opfs/installer/core/config-setup.mjs#L1-L45)

### Error Recovery Scenarios
The system includes comprehensive error recovery mechanisms to handle various failure scenarios. The sanity check module verifies the integrity of the VFS implementation by testing key operations such as file access, opening, reading, writing, and deletion. Error codes are propagated through the system using standard errno values, allowing for consistent error handling across different components.

```mermaid
sequenceDiagram
participant App as "Application"
participant VFS as "VFS Layer"
participant Worker as "OPFS Worker"
App->>VFS : File Operation
VFS->>Worker : Operation Request
alt Success
Worker-->>VFS : Success
VFS-->>App : Success
else Failure
Worker-->>VFS : Error Code
VFS->>VFS : Convert to errno
VFS-->>App : Negative errno
App->>App : Handle Error
end
```

**Diagram sources**
- [sanity-check.mjs](file://src/jswasm/vfs/opfs/installer/utils/sanity-check.mjs#L1-L123)

**Section sources**
- [sanity-check.mjs](file://src/jswasm/vfs/opfs/installer/utils/sanity-check.mjs#L1-L123)