# Project: @wuchuheng/web-sqlite

## Universal Programming Rules

This project adheres to the standards outlined in the `@.clinerules/base_rules.md` file. All contributions should align with these guidelines to ensure code quality, readability, and maintainability.

## Project Overview

This project is a TypeScript library that provides a SQLite3 implementation for the web, utilizing WebAssembly (WASM) and the Origin Private File System (OPFS) for persistent storage. It uses a web worker to run the SQLite database in a separate thread, preventing it from blocking the main UI thread. The library is built with Vite and tested with Vitest.

## Readability First

As per the project's core principles, **readability is the primary goal**. All code should be written to be as clear and understandable as possible, even for those unfamiliar with the codebase.

## Building and Running

The following scripts are available to build, test, and run the project. They can be understood through the lens of the **Three-Phase Processing Pattern**:

1.  **Input**: The source code in the `src` directory.
2.  **Processing**: The various build, test, and linting tools.
3.  **Output**: The generated files in the `dist` directory, or the results of the tests and linting.

### Building the library

To build the library, run the following command:

```bash
npm build
```

This will create a `dist` directory with the compiled JavaScript and TypeScript declaration files.

### Running tests

To run the unit tests, use the following command:

```bash
npm test:unit
```

To run the integration tests, use the following command:

```bash
npm test
```

### Running the linter

To check the code for linting errors, run:

```bash
npm lint
```

### Type checking

To perform a type check, run:

```bash
npm typecheck
```

### Development server

To start the development server, run:

```bash
npm dev
```

## Development Conventions

### Code Style

The project uses Prettier for code formatting and ESLint for linting. The configuration for these tools can be found in `.prettierrc.json` and `eslint.config.mts` respectively.

### Testing

Unit tests are located in the `src` directory alongside the files they test, with the naming convention `*.test.ts`. The project uses Vitest as the test runner.

### Commits

This project follows the conventional commit specification.

## Quality Assurance

### Code Review Checklist

All code should be reviewed against the checklist in `@.clinerules/base_rules.md` before being merged.

### Refactoring Triggers

The refactoring triggers outlined in `@.clinerules/base_rules.md` should be used to identify when code needs to be refactored.

## Memory Bank

This project uses a `.memory-bank/` directory to store important information about the project. As an AI agent, I will read the contents of this directory at the beginning of each session to ensure I have the necessary context to work on the project.
