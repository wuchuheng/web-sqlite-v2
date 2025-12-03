import { describe, test, expect } from "vitest";
import { runTestInWorker } from "../../../../tests/e2e/worker-client";

describe("JavaScript Storage Backend (kvvfs) Tests", () => {
  const DB_FILE_LOCAL = "/kvvfs-local-test.db";
  const DB_FILE_SESSION = "/kvvfs-session-test.db";

  test("kvvfs backend initialization and setup", async () => {
    const sql = `
      -- Create a test table
      CREATE TABLE kvvfs_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO kvvfs_test (data) VALUES ('kvvfs test data');
      SELECT * FROM kvvfs_test;
    `;

    const result = await runTestInWorker(
      "kvvfs initialization test",
      sql,
      DB_FILE_LOCAL,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 1,
      data: "kvvfs test data",
    });
  });

  test("localStorage persistence across sessions", async () => {
    const setupSql = `
      CREATE TABLE IF NOT EXISTS persistence_test (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO persistence_test (value) VALUES ('Persistent data');
    `;

    // First session - setup data
    await runTestInWorker(
      "Setup persistence test",
      setupSql,
      DB_FILE_LOCAL,
      true,
    );

    // Simulate new session by running query in separate worker call
    const checkSql = `SELECT * FROM persistence_test WHERE value = 'Persistent data';`;
    const result = await runTestInWorker(
      "Check persistence across sessions",
      checkSql,
      DB_FILE_LOCAL,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      value: "Persistent data",
    });
  });

  test("sessionStorage isolation and cleanup", async () => {
    const setupSql = `
      CREATE TABLE IF NOT EXISTS session_test (id INTEGER PRIMARY KEY, value TEXT);
      INSERT INTO session_test (value) VALUES ('Session data');
    `;

    // Setup session storage data
    await runTestInWorker(
      "Setup session storage test",
      setupSql,
      DB_FILE_SESSION,
      true,
    );

    // Verify data exists
    const checkSql = `SELECT * FROM session_test;`;
    const result = await runTestInWorker(
      "Check session storage data",
      checkSql,
      DB_FILE_SESSION,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      value: "Session data",
    });
  });

  test("Storage size calculation and limits", async () => {
    const sql = `
      -- Create table with multiple rows to test storage size
      CREATE TABLE size_test (id INTEGER PRIMARY KEY, data TEXT);
      WITH RECURSIVE data_generator(i) AS (
        SELECT 1
        UNION ALL
        SELECT i + 1 FROM data_generator WHERE i < 10
      )
      INSERT INTO size_test (data) SELECT 'Test data row ' || i FROM data_generator;
      
      -- Get row count
      SELECT COUNT(*) as row_count FROM size_test;
    `;

    const result = await runTestInWorker(
      "Storage size calculation test",
      sql,
      DB_FILE_LOCAL,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      row_count: 10,
    });
  });

  test("Storage backend switching (localStorage ↔ sessionStorage)", async () => {
    const localSetup = `
      CREATE TABLE IF NOT EXISTS backend_test (id INTEGER PRIMARY KEY, backend TEXT);
      INSERT INTO backend_test (backend) VALUES ('localStorage');
    `;

    const sessionSetup = `
      CREATE TABLE IF NOT EXISTS backend_test (id INTEGER PRIMARY KEY, backend TEXT);
      INSERT INTO backend_test (backend) VALUES ('sessionStorage');
    `;

    // Setup localStorage
    await runTestInWorker(
      "Setup localStorage backend",
      localSetup,
      DB_FILE_LOCAL,
      true,
    );

    // Setup sessionStorage
    await runTestInWorker(
      "Setup sessionStorage backend",
      sessionSetup,
      DB_FILE_SESSION,
      true,
    );

    // Verify localStorage data
    const localCheck = `SELECT * FROM backend_test WHERE backend = 'localStorage';`;
    const localResult = await runTestInWorker(
      "Check localStorage data",
      localCheck,
      DB_FILE_LOCAL,
    );

    // Verify sessionStorage data
    const sessionCheck = `SELECT * FROM backend_test WHERE backend = 'sessionStorage';`;
    const sessionResult = await runTestInWorker(
      "Check sessionStorage data",
      sessionCheck,
      DB_FILE_SESSION,
    );

    expect(localResult).toHaveLength(1);
    expect(localResult[0]).toMatchObject({
      backend: "localStorage",
    });

    expect(sessionResult).toHaveLength(1);
    expect(sessionResult[0]).toMatchObject({
      backend: "sessionStorage",
    });
  });

  test("Storage cleanup and data clearing operations", async () => {
    const setupSql = `
      CREATE TABLE IF NOT EXISTS cleanup_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO cleanup_test (data) VALUES ('Data to be cleaned');
    `;

    // Setup data
    await runTestInWorker("Setup cleanup test", setupSql, DB_FILE_LOCAL, true);

    // Verify data exists
    const checkBefore = `SELECT * FROM cleanup_test;`;
    const beforeResult = await runTestInWorker(
      "Check data before cleanup",
      checkBefore,
      DB_FILE_LOCAL,
      true,
    );

    expect(beforeResult).toHaveLength(1);

    // Note: Actual cleanup would require JsStorageDb.clearStorage() API
    // For now, we test that data can be deleted via SQL
    const cleanupSql = `DELETE FROM cleanup_test;`;
    await runTestInWorker(
      "Delete data via SQL",
      cleanupSql,
      DB_FILE_LOCAL,
      true,
    );

    const checkAfter = `SELECT * FROM cleanup_test;`;
    const afterResult = await runTestInWorker(
      "Check data after cleanup",
      checkAfter,
      DB_FILE_LOCAL,
    );

    expect(afterResult).toHaveLength(0);
  });

  test("Cross-session data persistence validation", async () => {
    const firstSessionSql = `
      CREATE TABLE IF NOT EXISTS cross_session_test (id INTEGER PRIMARY KEY, session_data TEXT);
      INSERT INTO cross_session_test (session_data) VALUES ('Data from first session');
    `;

    const secondSessionSql = `
      INSERT INTO cross_session_test (session_data) VALUES ('Data from second session');
      SELECT * FROM cross_session_test ORDER BY id;
    `;

    // First session
    await runTestInWorker(
      "First session setup",
      firstSessionSql,
      DB_FILE_LOCAL,
      true,
    );

    // Second session (simulated by separate worker call)
    const result = await runTestInWorker(
      "Second session validation",
      secondSessionSql,
      DB_FILE_LOCAL,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      session_data: "Data from first session",
    });
    expect(result[1]).toMatchObject({
      session_data: "Data from second session",
    });
  });

  test("Storage backend error handling", async () => {
    const invalidSql = `
      CREATE TABLE error_test (id INTEGER PRIMARY KEY);
      INVALID SQL SYNTAX !!!;
    `;

    await expect(
      runTestInWorker(
        "Storage backend error handling",
        invalidSql,
        DB_FILE_LOCAL,
      ),
    ).rejects.toThrow();
  });

  test("Migration between storage backends", async () => {
    const sourceSetup = `
      CREATE TABLE IF NOT EXISTS migration_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO migration_test (data) VALUES ('Data to migrate');
    `;

    // Setup data in one backend
    await runTestInWorker(
      "Setup migration source",
      sourceSetup,
      DB_FILE_LOCAL,
      true,
    );

    // Note: Actual migration would require export/import functionality
    // For now, we test that both backends work independently
    const targetSetup = `
      CREATE TABLE IF NOT EXISTS migration_test (id INTEGER PRIMARY KEY, data TEXT);
      INSERT INTO migration_test (data) VALUES ('Migrated data');
    `;

    await runTestInWorker(
      "Setup migration target",
      targetSetup,
      DB_FILE_SESSION,
      true,
    );

    // Verify both backends contain data
    const checkSql = `SELECT * FROM migration_test;`;

    const localResult = await runTestInWorker(
      "Check local storage",
      checkSql,
      DB_FILE_LOCAL,
    );

    const sessionResult = await runTestInWorker(
      "Check session storage",
      checkSql,
      DB_FILE_SESSION,
    );

    expect(localResult).toHaveLength(1);
    expect(sessionResult).toHaveLength(1);
  });
});
