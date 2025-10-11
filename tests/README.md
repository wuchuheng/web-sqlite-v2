# SQLite3 OPFS Demo - User Management Example

## Overview

This example demonstrates how to use SQLite3 WebAssembly with **Origin Private File System (OPFS)** for persistent database storage in the browser. The demo showcases a complete user management system with table creation, data insertion, querying, and transaction handling.

## Features Demonstrated

### 🗄️ **OPFS Persistent Storage**

-   Creates a persistent SQLite database stored in OPFS (`/demo/users.db`)
-   Database persists across browser sessions and page reloads
-   Demonstrates the `sqlite3.oo1.OpfsDb` class usage

### 🏗️ **Database Schema Management**

-   Creates a comprehensive `users` table with multiple column types
-   Implements database indexes for optimized query performance
-   Shows proper SQL table creation with constraints and defaults

### 📊 **Data Operations**

-   **Insert Operations**: Batch insertion of sample user data using prepared statements
-   **Query Operations**: Various SELECT queries including:
    -   Simple data retrieval
    -   Filtered queries with conditions
    -   Aggregate functions (COUNT, AVG)
    -   Grouped data analysis
-   **Transaction Management**: Demonstrates both successful commits and rollbacks

### ⚙️ **Advanced Features**

-   **Prepared Statements**: Efficient and secure parameterized queries
-   **Transaction Safety**: ACID compliance with automatic rollback on errors
-   **Error Handling**: Comprehensive error handling and user feedback
-   **Performance Optimizations**: Indexes and efficient query patterns

## Database Schema

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    age INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
```

## Sample Operations

### 1. Database Initialization

```javascript
// Initialize SQLite3 with OPFS support
const sqlite3 = await sqlite3InitModule();

// Create persistent OPFS database
const db = new sqlite3.oo1.OpfsDb("/demo/users.db", "c");
```

### 2. Data Insertion with Transactions

```javascript
db.transaction(() => {
    const stmt = db.prepare(
        "INSERT INTO users (username, email, full_name, age) VALUES (?, ?, ?, ?)"
    );

    users.forEach((user) => {
        stmt.bind([
            user.username,
            user.email,
            user.full_name,
            user.age,
        ]).stepReset();
    });

    stmt.finalize();
});
```

### 3. Complex Queries

```javascript
// Age group analysis
const ageGroups = db.selectObjects(`
    SELECT 
        CASE 
            WHEN age < 30 THEN 'Under 30'
            WHEN age BETWEEN 30 AND 40 THEN '30-40'
            ELSE 'Over 40'
        END as age_group,
        COUNT(*) as user_count
    FROM users 
    GROUP BY age_group 
    ORDER BY age_group
`);
```

## Running the Demo

### Prerequisites

-   **Node.js** and **pnpm** installed
-   **Modern browser** with OPFS support (Chrome 86+, Firefox 111+)
-   **HTTP/HTTPS server** (OPFS requires secure context)

### Quick Start

1. **Install dependencies** (if not already installed):

    ```bash
    pnpm install
    ```

2. **Start the development server**:

    ```bash
    pnpm run examples:simple-demo
    ```

    This command will:

    - Start an HTTP server with necessary COOP/COEP headers
    - Automatically open your browser to the demo page
    - Serve the demo at `http://127.0.0.1:3000/examples/simpleDemo/index.html`

3. **View the demo**:
    - The page will show a real-time status of the initialization process
    - Open browser developer tools (F12) to see detailed console output
    - Watch as the demo creates tables, inserts data, and runs queries

### Manual Server Setup

If you prefer manual setup, ensure your server includes these headers:

```http
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
```

These headers are **required** for SharedArrayBuffer and OPFS functionality.

## Browser Support

### ✅ **Supported Browsers**

-   **Chrome/Chromium**: 86+ (full OPFS support)
-   **Firefox**: 111+ (OPFS support)
-   **Safari**: 15.4+ (limited OPFS support)
-   **Edge**: 86+ (Chromium-based)

### ❌ **Unsupported Environments**

-   Internet Explorer (any version)
-   Older browser versions without OPFS APIs
-   `file://` protocol (must use HTTP/HTTPS)
-   Environments without SharedArrayBuffer support

## Key Implementation Details

### OPFS Database Creation

The demo uses the `OpfsDb` class, which is a specialized subclass of `sqlite3.oo1.DB`:

```javascript
const db = new sqlite3.oo1.OpfsDb("/demo/users.db", "c");
// 'c' flag means "create if doesn't exist"
```

### Error Handling Pattern

All database operations are wrapped in try-catch blocks with proper error reporting:

```javascript
try {
    // Database operations
    db.transaction(() => {
        // Transactional operations
    });
} catch (error) {
    // Error handling with rollback
    console.error("Operation failed:", error);
}
```

### Memory Management

The demo properly manages database connections and prepared statements:

```javascript
const stmt = db.prepare(sql);
try {
    // Use statement
    stmt.bind(params).step();
} finally {
    stmt.finalize(); // Always clean up
}
```

## Output Examples

When you run the demo, you'll see console output like:

```
🚀 Initializing SQLite3 WASM module...
✅ SQLite3 loaded successfully
📋 Version: 3.50.4
🏗️ OPFS support available
📂 Created OPFS database at: /demo/users.db
🏗️ Creating users table...
✅ Users table and indexes created successfully
👥 Inserting sample users...
✅ Inserted users. Total users in database: 5

📊 Querying user data...
📋 All Users:
──────────────────────────────────────────────────
1. { id: 1, username: 'john_doe', email: 'john@example.com', ... }
2. { id: 2, username: 'jane_smith', email: 'jane@example.com', ... }
...

🔢 Database Statistics:
──────────────────────────────
Total users: 5
Average age: 34
Oldest user: { username: 'bob_wilson', age: 45 }
```

## Troubleshooting

### Common Issues

1. **"OPFS VFS unavailable" Error**

    - **Cause**: Missing COOP/COEP headers or unsupported browser
    - **Solution**: Ensure server sends required headers and use supported browser

2. **"SharedArrayBuffer is not defined"**

    - **Cause**: Security context requirements not met
    - **Solution**: Use HTTPS or localhost with proper headers

3. **Database Not Persisting**

    - **Cause**: Using in-memory database instead of OPFS
    - **Solution**: Verify using `OpfsDb` class with proper file path

4. **File Loading Errors**
    - **Cause**: Incorrect module import paths or CORS issues
    - **Solution**: Check import paths and server CORS configuration

### Debugging Tips

-   Open browser developer tools to see detailed console output
-   Check the Network tab for any failed resource loads
-   Verify OPFS availability: `navigator.storage?.getDirectory !== undefined`
-   Test SharedArrayBuffer: `typeof SharedArrayBuffer !== 'undefined'`

## Next Steps

After exploring this demo, you can:

1. **Modify the Schema**: Add more tables and relationships
2. **Implement Full CRUD**: Add update and delete operations
3. **Add Validation**: Implement client-side data validation
4. **Performance Testing**: Test with larger datasets
5. **Worker Integration**: Use SQLite in Web Workers for better performance
6. **Data Import/Export**: Implement database backup and restore features

## Related Documentation

-   [SQLite WASM Documentation](https://sqlite.org/wasm/doc/trunk/index.md)
-   [OPFS API Documentation](https://sqlite.org/wasm/doc/trunk/persistence.md#vfs-opfs)
-   [Object-Oriented API (OO1)](https://sqlite.org/wasm/doc/trunk/api-oo1.md)
-   [Browser OPFS Support](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
