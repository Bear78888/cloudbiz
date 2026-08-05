#!/usr/bin/env node
/**
 * Fails when `src/lib/supabase/database.types.ts` has drifted from the schema
 * the migrations produce.
 *
 * Compares the *column inventory* — table → column → type — rather than the
 * text of the two files. The committed file is hand-trimmed (no `Relationships`
 * blocks, simpler helper generics), so a textual diff would fail on formatting
 * forever and be switched off within a week. What actually needs to hold is
 * that every table and column the code can reference exists in the schema with
 * the type claimed, which is exactly what caught nothing when `.select(
 * "lead_source")` went out against a `jobs` table whose column is `source`.
 *
 * Usage:
 *   npx supabase gen types typescript --db-url "$URL" > /tmp/fresh.ts
 *   node scripts/check-db-types.mjs /tmp/fresh.ts src/lib/supabase/database.types.ts
 */

import { readFileSync } from "node:fs";

/**
 * Pulls `table -> { column: type }` out of generated (or hand-trimmed) types by
 * reading the `Row:` block of each table. Deliberately a small parser and not a
 * TypeScript AST pass: the input shape is machine-generated and stable, and a
 * compiler dependency here would cost more than it earns.
 */
function extractRows(source) {
  const tables = {};
  // `  table_name: {` at the table nesting level, then its `Row: { ... }`.
  const tablePattern = /^ {6}(\w+): \{$/gm;
  let match;
  while ((match = tablePattern.exec(source)) !== null) {
    const table = match[1];
    const rest = source.slice(match.index);
    const rowStart = rest.indexOf("Row: {");
    if (rowStart === -1) continue;
    const rowEnd = rest.indexOf("\n        }", rowStart);
    if (rowEnd === -1) continue;
    const body = rest.slice(rowStart + "Row: {".length, rowEnd);

    const columns = {};
    for (const line of body.split("\n")) {
      const column = line.match(/^\s{10}(\w+)\??:\s*(.+?);?\s*$/);
      if (!column) continue;
      columns[column[1]] = column[2].replace(/;$/, "").trim();
    }
    if (Object.keys(columns).length > 0) tables[table] = columns;
  }
  return tables;
}

const [freshPath, committedPath] = process.argv.slice(2);
if (!freshPath || !committedPath) {
  console.error("usage: check-db-types.mjs <freshly-generated.ts> <committed.ts>");
  process.exit(2);
}

const fresh = extractRows(readFileSync(freshPath, "utf8"));
const committed = extractRows(readFileSync(committedPath, "utf8"));

const problems = [];

for (const [table, columns] of Object.entries(fresh)) {
  if (!committed[table]) {
    problems.push(`table ${table} exists in the schema but not in database.types.ts`);
    continue;
  }
  for (const [column, type] of Object.entries(columns)) {
    const claimed = committed[table][column];
    if (claimed === undefined) {
      problems.push(`${table}.${column} exists in the schema but not in database.types.ts`);
    } else if (claimed !== type) {
      problems.push(`${table}.${column}: schema says ${type}, database.types.ts says ${claimed}`);
    }
  }
}

for (const [table, columns] of Object.entries(committed)) {
  if (!fresh[table]) {
    problems.push(`table ${table} is in database.types.ts but not in the schema`);
    continue;
  }
  for (const column of Object.keys(columns)) {
    if (fresh[table][column] === undefined) {
      // The dangerous direction: code can reference this and typecheck, but the
      // query will fail at runtime with a 400.
      problems.push(`${table}.${column} is in database.types.ts but not in the schema`);
    }
  }
}

if (Object.keys(fresh).length === 0) {
  console.error("Refusing to pass: parsed zero tables from the generated types.");
  process.exit(2);
}

if (problems.length > 0) {
  console.error("database.types.ts has drifted from the migrations:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nRegenerate:\n  npx supabase gen types typescript --db-url \"$URL\" \\");
  console.error("    > src/lib/supabase/database.types.ts");
  process.exit(1);
}

console.log(
  `database.types.ts matches the migrations (${Object.keys(fresh).length} tables checked).`,
);
