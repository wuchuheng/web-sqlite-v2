# web-sqlite-js

Enables direct use of SQLite in the web browser with reliable local data persistence via OPFS (Origin Private File System).

It runs SQLite in a Web Worker to avoid blocking the main thread and handles all synchronization automatically, providing a simple, Promise-based API.

## Features

*   **Persistent Storage**: Uses OPFS for high-performance, persistent file storage.
*   **Non-Blocking**: Runs in a Web Worker, keeping your UI responsive.
*   **Concurrency Safe**: Built-in mutex ensures safe, sequential execution of commands.
*   **Type-Safe**: Written in TypeScript with full type definitions.
*   **Transactions**: Supports atomic transactions with automatic rollback on error.

## Installation

```bash
npm install web-sqlite-js
```

## ⚠️ Critical Configuration: COOP & COEP

To use `SharedArrayBuffer` (required by the SQLite WASM build), your server **must** serve the application with the following HTTP headers:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If these headers are missing, the database **will not start**.

### Configuration Guides

<details>
<summary><strong>Vite</strong></summary>

Update your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
```
</details>

<details>
<summary><strong>Next.js</strong></summary>

Update your `next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
```
</details>

<details>
<summary><strong>Webpack (Dev Server)</strong></summary>

Update your `webpack.config.js`:

```javascript
module.exports = {
  // ...
  devServer: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
};
```
</details>

<details>
<summary><strong>Nginx</strong></summary>

Add the headers to your server block:

```nginx
server {
    # ...
    add_header Cross-Origin-Opener-Policy "same-origin";
    add_header Cross-Origin-Embedder-Policy "require-corp";
    # ...
}
```
</details>

<details>
<summary><strong>Express.js</strong></summary>

Use a middleware:

```javascript
const express = require('express');
const app = express();

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

// ...
```
</details>

<details>
<summary><strong>React / Vue (Create React App / Vue CLI)</strong></summary>

Most modern React/Vue setups use **Vite**. Please refer to the **Vite** section above.

If you are using an older webpack-based setup (like CRA `react-scripts`), you technically need to configure the underlying `webpack-dev-server`, but CRA doesn't expose this easily without ejecting or using tools like `craco` or `react-app-rewired` to modify the dev server configuration as shown in the **Webpack** section.
</details>

## Usage

### Basic Query

```typescript
import openDB from 'web-sqlite-js';

// 1. Open the database (creates 'my-database.sqlite3' in OPFS)
const db = await openDB('my-database');

// 2. Initialize schema
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT
  );
`);

// 3. Insert data (Parameterized)
await db.exec('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com']);
await db.exec('INSERT INTO users (name, email) VALUES ($name, $email)', {
  $name: 'Bob',
  $email: 'bob@example.com'
});

// 4. Query data
interface User {
  id: number;
  name: string;
  email: string;
}

const users = await db.query<User>('SELECT * FROM users');
console.log(users); 
// Output: [{ id: 1, name: 'Alice', ... }, { id: 2, name: 'Bob', ... }]

// 5. Close when done
await db.close();
```

### Transactions

Transactions are atomic. If any command inside the callback fails, the entire transaction is rolled back.

```typescript
await db.transaction(async (tx) => {
  await tx.exec('INSERT INTO users (name) VALUES (?)', ['Charlie']);
  
  // You can perform multiple operations safely
  await tx.exec('INSERT INTO logs (action) VALUES (?)', ['User Created']);
  
  // If you throw an error here, both INSERTs will be rolled back!
  // throw new Error('Something went wrong');
});
```

### Multiple Connections

You can open multiple connections to the same file. They will automatically synchronize access.

```typescript
const db1 = await openDB('shared-db');
const db2 = await openDB('shared-db');

await db1.exec('INSERT INTO items (name) VALUES (?)', ['Item 1']);

// db2 sees the change immediately after db1 finishes
const items = await db2.query('SELECT * FROM items');
```

## API

### `openDB(filename: string, options?: { debug?: boolean })`
Opens a database connection. Returns a `DBInterface`.

### `db.exec(sql: string, params?: any[] | Record<string, any>)`
Executes a SQL statement (INSERT, UPDATE, DELETE, CREATE). Returns `{ changes, lastInsertRowid }`.

### `db.query<T>(sql: string, params?: any[] | Record<string, any>)`
Executes a SELECT statement. Returns an array of rows `T[]`.

### `db.transaction<T>(callback: (tx: DBInterface) => Promise<T>)`
Runs the callback inside a transaction (`BEGIN` ... `COMMIT`/`ROLLBACK`). The `tx` object provided to the callback has the same `exec` and `query` methods.

### `db.close()`
Closes the connection and terminates the worker.
