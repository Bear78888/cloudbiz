/**
 * Retry policy and write planning for the sync worker (§14.9, §14.11).
 *
 * Both are pure so the parts that are hard to get right — when to give up,
 * where a row belongs — are decided by tests rather than by watching a live
 * spreadsheet and guessing.
 */

/** §14.11: limited attempts, then a dead-letter state a human can act on. */
export const MAX_ATTEMPTS = 6;

/**
 * Exponential backoff with jitter, in milliseconds.
 *
 * The jitter matters more than it looks: without it, every event that failed
 * in the same batch retries at the same instant, and a rate-limited account
 * re-hits the limit with the whole batch at once, forever. Spreading the
 * retries is what turns a thundering herd back into a queue.
 *
 * `random` is injected so the test is deterministic.
 */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60 * 1000);
  const jitter = base * 0.25 * random();
  return Math.round(base + jitter);
}

export type EventOutcome = "synced" | "retrying" | "failed" | "disconnected";

/**
 * What to do with an event after an attempt.
 *
 * `unauthorized` is not retried: the grant is gone, and hammering a revoked
 * connection cannot fix it — the user has to reconnect, and until then further
 * attempts are noise. `not_found` means the spreadsheet was deleted (§14.14);
 * same reasoning, the queue waits rather than churns.
 */
export function nextOutcome(
  failure: "unauthorized" | "not_found" | "rate_limited" | "failed" | null,
  attempts: number,
): EventOutcome {
  if (failure === null) return "synced";
  if (failure === "unauthorized" || failure === "not_found") return "disconnected";
  return attempts + 1 >= MAX_ATTEMPTS ? "failed" : "retrying";
}

export interface PlannedWrites {
  /** Row number (1-based, including the header) → row values. */
  updates: { rowNumber: number; values: string[] }[];
  /** Rows with no existing home, appended in order. */
  appends: string[][];
}

/**
 * Decides where each row goes.
 *
 * §14.8 is explicit that rows are matched by UUID, never by customer name: two
 * customers can share a name, and a renamed customer must not become a second
 * row. `existingIds` is the id column as read from the sheet, in sheet order,
 * excluding the header.
 *
 * Rows carrying the same id more than once collapse to the last one — a job
 * edited twice before a sync should be written once, in its final state.
 */
export function planWrites(existingIds: string[], rows: string[][]): PlannedWrites {
  const rowNumberById = new Map<string, number>();
  existingIds.forEach((id, index) => {
    // +2: sheets are 1-based and the first row is the header.
    if (id && !rowNumberById.has(id)) rowNumberById.set(id, index + 2);
  });

  const latestById = new Map<string, string[]>();
  const order: string[] = [];
  for (const row of rows) {
    const id = row[0];
    if (!id) continue;
    if (!latestById.has(id)) order.push(id);
    latestById.set(id, row);
  }

  const updates: { rowNumber: number; values: string[] }[] = [];
  const appends: string[][] = [];
  for (const id of order) {
    const values = latestById.get(id)!;
    const rowNumber = rowNumberById.get(id);
    if (rowNumber === undefined) appends.push(values);
    else updates.push({ rowNumber, values });
  }

  return { updates, appends };
}

/** Converts a zero-based column count into an A1 end column (24 → "X"). */
export function columnLetter(count: number): string {
  let n = count;
  let letters = "";
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters || "A";
}

/** A1 range for one row, e.g. `'Jobs'!A5:X5`. */
export function rowRange(tabTitle: string, rowNumber: number, width: number): string {
  const quoted = tabTitle.replace(/'/g, "''");
  return `'${quoted}'!A${rowNumber}:${columnLetter(width)}${rowNumber}`;
}
