#!/usr/bin/env node
/**
 * Fails when `src/lib/supabase/database.types.ts` has drifted from the schema
 * the migrations produce.
 *
 * Reads the schema straight from `information_schema` (a JSON dump produced by
 * psql) rather than running `supabase gen types`. The CLI needs Docker to pull
 * `postgres-meta`, and on its first real run in CI that pull hit
 * `toomanyrequests: Rate exceeded` — a guard that depends on a public registry
 * being in a good mood is a guard that will be switched off the third time it
 * flakes. The database is already in the job; asking it directly has no moving
 * parts.
 *
 * Compares the column inventory — table → column → type — not the file text.
 * The committed file is hand-trimmed, so a textual diff would fail forever on
 * formatting. What has to hold is that every table and column the code can
 * reference exists with the type claimed. That is exactly the check that was
 * missing when `.select("lead_source")` shipped against a `jobs` table whose
 * column is `source`.
 *
 * Usage:
 *   psql ... -tAc "<query from schemaQuery below>" > /tmp/schema.json
 *   node scripts/check-db-types.mjs /tmp/schema.json src/lib/supabase/database.types.ts
 */

import { readFileSync } from "node:fs";

/**
 * Postgres type → the TypeScript the Supabase generator emits. Anything not
 * listed fails loudly rather than being guessed: a silent `unknown` here would
 * reintroduce exactly the blind spot this script exists to remove.
 */
const TYPE_MAP = {
  uuid: "string",
  text: "string",
  citext: "string",
  varchar: "string",
  bpchar: "string",
  timestamptz: "string",
  timestamp: "string",
  date: "string",
  time: "string",
  timetz: "string",
  bool: "boolean",
  int2: "number",
  int4: "number",
  int8: "number",
  numeric: "number",
  float4: "number",
  float8: "number",
  json: "Json",
  jsonb: "Json",
  _text: "string[]",
  _uuid: "string[]",
};

function tsTypeFor(udtName, isNullable) {
  const base = TYPE_MAP[udtName];
  if (!base) return null;
  return isNullable ? `${base} | null` : base;
}

/** Same parser as before: the `Row:` block of each table in the committed file. */
function extractRows(source) {
  const tables = {};
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

const [schemaPath, committedPath] = process.argv.slice(2);
if (!schemaPath || !committedPath) {
  console.error("usage: check-db-types.mjs <schema.json> <committed.ts>");
  process.exit(2);
}

const rawSchema = JSON.parse(readFileSync(schemaPath, "utf8"));
const committed = extractRows(readFileSync(committedPath, "utf8"));

const schema = {};
const unmapped = [];
for (const row of rawSchema) {
  const type = tsTypeFor(row.udt_name, row.is_nullable);
  if (!type) {
    unmapped.push(`${row.table_name}.${row.column_name} (${row.udt_name})`);
    continue;
  }
  (schema[row.table_name] ??= {})[row.column_name] = type;
}

if (unmapped.length > 0) {
  console.error("Unmapped Postgres types — add them to TYPE_MAP in this script:\n");
  for (const item of unmapped) console.error(`  - ${item}`);
  process.exit(2);
}

if (Object.keys(schema).length === 0) {
  console.error("Refusing to pass: the schema dump contained no tables.");
  process.exit(2);
}

const problems = [];

for (const [table, columns] of Object.entries(schema)) {
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
  if (!schema[table]) {
    problems.push(`table ${table} is in database.types.ts but not in the schema`);
    continue;
  }
  for (const column of Object.keys(columns)) {
    if (schema[table][column] === undefined) {
      // The dangerous direction: code can reference this and typecheck, but the
      // query fails at runtime with a 400.
      problems.push(`${table}.${column} is in database.types.ts but not in the schema`);
    }
  }
}

if (problems.length > 0) {
  console.error("database.types.ts has drifted from the migrations:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nRegenerate with the Supabase CLI and commit the result:");
  console.error('  npx supabase gen types typescript --db-url "$URL" \\');
  console.error("    > src/lib/supabase/database.types.ts");
  process.exit(1);
}

console.log(
  `database.types.ts matches the migrations (${Object.keys(schema).length} tables checked).`,
);
