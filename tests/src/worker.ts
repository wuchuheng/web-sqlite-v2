import sqlite3InitModule from "@wuchuheng/web-sqlite";
import { TestRunner } from "./core/test-runner";
import {
  environmentTests,
  databaseLifecycleTests,
  schemaOperationsTests,
  crudOperationsTests,
  preparedStatementsTests,
  transactionsTests,
  queryOperationsTests,
  constraintsTests,
  errorHandlingTests,
  performanceTests,
  dataTypesTests,
  versionInfoTests,
} from "./suites";

/**
 * Initialize and configure test runner
 */
const testRunner = new TestRunner();

/**
 * Register all test suites
 */
testRunner.registerSuite("Environment", environmentTests);
testRunner.registerSuite("Database Lifecycle", databaseLifecycleTests);
testRunner.registerSuite("Schema Operations", schemaOperationsTests);
testRunner.registerSuite("CRUD Operations", crudOperationsTests);
testRunner.registerSuite("Prepared Statements", preparedStatementsTests);
testRunner.registerSuite("Transactions", transactionsTests);
testRunner.registerSuite("Query Operations", queryOperationsTests);
testRunner.registerSuite("Constraints", constraintsTests);
testRunner.registerSuite("Error Handling", errorHandlingTests);
testRunner.registerSuite("Performance", performanceTests);
testRunner.registerSuite("Data Types", dataTypesTests);
testRunner.registerSuite("Version Info", versionInfoTests);

/**
 * Message handler for worker commands
 */
self.onmessage = async function (event) {
  const { cmd } = event.data;

  if (cmd === "run-tests") {
    const initialized = await testRunner.initialize(sqlite3InitModule);
    if (initialized) {
      await testRunner.runAllTests();
    } else {
      self.postMessage({
        type: "error",
        data: { error: "Failed to initialize SQLite3" },
      });
    }
  }
};
