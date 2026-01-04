export interface SqlLogInfo {
  sql: string;
  duration: number;
  bind?: unknown;
}

const originalInfo = console.info;
const originalDebug = console.debug;

const sqlKeywords = new Set([
  "SELECT",
  "INSERT",
  "UPDATE",
  "DELETE",
  "FROM",
  "WHERE",
  "AND",
  "OR",
  "LIMIT",
  "ORDER",
  "BY",
  "GROUP",
  "VALUES",
  "SET",
  "INTO",
  "CREATE",
  "TABLE",
  "DROP",
  "ALTER",
  "INDEX",
  "JOIN",
  "LEFT",
  "RIGHT",
  "INNER",
  "OUTER",
  "ON",
  "IS",
  "NULL",
  "NOT",
  "AS",
  "DISTINCT",
  "UNION",
  "ALL",
  "EXISTS",
  "HAVING",
  "ASC",
  "DESC",
  "OFFSET",
  "PRIMARY",
  "KEY",
  "DEFAULT",
  "CHECK",
  "UNIQUE",
  "FOREIGN",
  "REFERENCES",
  "BEGIN",
  "TRANSACTION",
  "COMMIT",
  "ROLLBACK",
  "PRAGMA",
  "VIEW",
  "TRIGGER",
]);

const isSqlLogInfo = (arg: unknown): arg is SqlLogInfo => {
  return (
    typeof arg === "object" && arg !== null && "sql" in arg && "duration" in arg
  );
};

export const configureLogger = (isDebug: boolean) => {
  if (isDebug) {
    console.debug = (...args: unknown[]) => {
      const badgeText = "Debug";
      const badgeStyle =
        "background: #1976d2; color: white; padding: 2px 4px; border-radius: 4px; font-weight: bold;";
      const defaultStyle =
        "color: inherit; background: inherit; font-weight: inherit;"; // Browser's native default style

      const firstArg = args[0];

      // Declare these here so they are definitely "read" in the context where they are used.
      const sqlKeywordStyle = "color: #9c27b0; font-weight: bold;";
      const sqlNormalTextStyle =
        "color: #616161; background: inherit; font-weight: normal;";

      if (isSqlLogInfo(firstArg)) {
        const { sql, duration, bind } = firstArg;

        let formatString = `%cDebug:sql%c `; // Badge %c and Reset %c for what follows
        const logArgs: unknown[] = [badgeStyle, sqlNormalTextStyle]; // Start with badge style, then sqlNormalTextStyle for initial SQL content

        const parts = sql.split(/(\b\w+\b)/);

        for (const part of parts) {
          if (sqlKeywords.has(part.toUpperCase())) {
            formatString += "%c%s%c"; // Keyword style + Text + Reset
            logArgs.push(sqlKeywordStyle, part, sqlNormalTextStyle); // Apply keyword, then reset to sqlNormalTextStyle
          } else {
            formatString += "%s"; // Non-keyword text, inherits sqlNormalTextStyle
            logArgs.push(part);
          }
        }

        // Now, append duration. It should be default style, not sqlNormalTextStyle.
        // So, explicitly reset to defaultStyle before the duration text.
        formatString += `%c %s`; // This %c will get defaultStyle, and %s will get duration text.
        const bindArgs = bind ? ` ${JSON.stringify(bind)}` : "";
        logArgs.push(defaultStyle, bindArgs, `(${duration.toFixed(2)}ms)`);

        originalInfo.apply(console, [formatString, ...logArgs]);
        return;
      }
      let finalFormatString = `%c${badgeText}%c`;
      const finalArgs: unknown[] = [badgeStyle, defaultStyle]; // General logs: badge + default style

      for (const arg of args) {
        if (typeof arg === "string") {
          finalFormatString += " %s";
          finalArgs.push(arg);
        } else {
          finalFormatString += " %o";
          finalArgs.push(arg);
        }
      }

      originalInfo.apply(console, [finalFormatString, ...finalArgs]);
    };
  } else {
    console.debug = originalDebug;
  }
};
