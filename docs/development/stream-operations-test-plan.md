# Stream Operations Test Plan

## Overview

Test plan for migrating `src/jswasm/vfs/filesystem/stream-operations.mjs` to TypeScript. This module provides low-level stream bookkeeping utilities for file descriptor allocation and device registration.

## Test Cases

### File Descriptor Management

- **nextfd()**:
    - Returns first available FD (0) when streams array is empty
    - Returns next available FD when some lower FDs are occupied
    - Throws `EMFILE` error when all FDs are occupied (up to MAX_OPEN_FDS)
    - Finds gaps in used FDs (reuse freed descriptors)

### Stream Operations

- **getStream(fd)**:
    - Returns null for non-existent FD
    - Returns stream object for valid FD
    - Works with array indexing

- **getStreamChecked(fd)**:
    - Returns stream for valid FD
    - Throws `EBADF` error for non-existent FD
    - Proper error type and errno

- **createStream(stream, fd)**:
    - Creates stream with auto-assigned FD when fd=-1
    - Creates stream with specific FD when provided
    - Uses Object.assign with FS.FSStream instance
    - Registers stream in FS.streams array
    - Returns created stream with proper fd set

- **closeStream(fd)**:
    - Sets streams[fd] to null
    - Clears the slot properly

- **dupStream(origStream, fd)**:
    - Creates duplicate of original stream
    - Uses auto-assigned FD when fd=-1
    - Uses specific FD when provided
    - Calls stream_ops.dup if available
    - Returns duplicated stream

### Device Number Operations

- **major(dev)**: Extracts major number (high 8 bits)
- **minor(dev)**: Extracts minor number (low 8 bits)
- **makedev(ma, mi)**: Combines major/minor into device number

### Character Device Operations

- **chrdev_stream_ops.open()**:
    - Gets device from FS.getDevice()
    - Sets stream_ops to device's stream_ops
    - Calls device's open() if available

- **chrdev_stream_ops.llseek()**:
    - Always throws `ESPIPE` errno error
    - Proper error type and message

### Device Registration

- **registerDevice(dev, ops)**:
    - Registers device in FS.devices array
    - Stores stream_ops properly

- **getDevice(dev)**:
    - Returns DeviceDefinition for registered device
    - Returns undefined for unregistered device

## Test Data

- Mock MutableFS object with required properties
- Mock FSStream constructor
- Mock ErrnoError constructor
- Array of 4096 slots for streams
- Device objects for testing character devices

## Scaffolding

- Helper to create mock FS state
- Helper to create mock stream objects
- Helper to verify errno error types
- Setup/teardown for each test to reset state

## Edge Cases

- All FDs exhausted scenario
- Invalid FD values (negative, too large)
- Device operations on unregistered devices
- Stream operations on null streams
- Duplicate stream with missing dup callback
