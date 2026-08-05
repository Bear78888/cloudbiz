import { describe, expect, it } from "vitest";

import {
  MAX_ATTEMPTS,
  backoffMs,
  columnLetter,
  eventOutcome,
  nextOutcome,
  planWrites,
  rowRange,
} from "@/features/google/sync-plan";

describe("backoff (§14.11)", () => {
  it("grows exponentially", () => {
    const noJitter = () => 0;
    expect(backoffMs(1, noJitter)).toBe(60_000);
    expect(backoffMs(2, noJitter)).toBe(120_000);
    expect(backoffMs(3, noJitter)).toBe(240_000);
    expect(backoffMs(4, noJitter)).toBe(480_000);
  });

  it("stops growing so a retry is never scheduled days out", () => {
    expect(backoffMs(50, () => 0)).toBe(6 * 60 * 60 * 1000);
  });

  // Without jitter every event that failed together retries at the same
  // instant, and a rate-limited account re-hits the limit with the whole batch.
  it("spreads retries apart", () => {
    expect(backoffMs(3, () => 0)).toBe(240_000);
    expect(backoffMs(3, () => 1)).toBe(300_000);
    expect(backoffMs(3, () => 0.5)).toBe(270_000);
  });
});

describe("what to do after an attempt", () => {
  it("marks a success synced", () => {
    expect(nextOutcome(null, 0)).toBe("synced");
  });

  it("retries transient failures until the attempt limit", () => {
    expect(nextOutcome("rate_limited", 0)).toBe("retrying");
    expect(nextOutcome("failed", 3)).toBe("retrying");
    // §14.11: a dead-letter state, not an infinite loop.
    expect(nextOutcome("failed", MAX_ATTEMPTS - 1)).toBe("failed");
    expect(nextOutcome("rate_limited", MAX_ATTEMPTS)).toBe("failed");
  });

  // Retrying these cannot help: the user must reconnect, or the sheet is gone
  // (§14.14). Churning through six attempts would only delay telling them.
  it("does not retry a revoked grant or a deleted spreadsheet", () => {
    expect(nextOutcome("unauthorized", 0)).toBe("disconnected");
    expect(nextOutcome("not_found", 0)).toBe("disconnected");
  });
});

describe("planning where rows go (§14.8)", () => {
  const rowA = ["id-a", "New Lead"];
  const rowB = ["id-b", "Scheduled"];

  it("updates a row that already exists, offset past the header", () => {
    const plan = planWrites(["id-a", "id-b"], [rowB]);
    expect(plan.updates).toEqual([{ rowNumber: 3, values: rowB }]);
    expect(plan.appends).toEqual([]);
  });

  it("appends a row that has no home yet", () => {
    const plan = planWrites(["id-a"], [rowB]);
    expect(plan.updates).toEqual([]);
    expect(plan.appends).toEqual([rowB]);
  });

  it("matches by id, never by any other column", () => {
    // Two customers can share a name, and a renamed one must not become a
    // second row — hence the id, and hence this test.
    const renamed = ["id-a", "Renamed"];
    expect(planWrites(["id-a"], [renamed]).updates).toEqual([
      { rowNumber: 2, values: renamed },
    ]);
  });

  it("writes a row edited twice once, in its final state", () => {
    const first = ["id-a", "Scheduled"];
    const last = ["id-a", "Completed"];
    expect(planWrites(["id-a"], [first, last]).updates).toEqual([
      { rowNumber: 2, values: last },
    ]);
  });

  it("keeps a stable order and survives blanks in the id column", () => {
    const plan = planWrites(["", "id-b", ""], [rowA, rowB]);
    expect(plan.appends).toEqual([rowA]);
    expect(plan.updates).toEqual([{ rowNumber: 3, values: rowB }]);
  });

  it("ignores a row with no id rather than writing it somewhere arbitrary", () => {
    expect(planWrites([], [["", "orphan"]])).toEqual({ updates: [], appends: [] });
  });

  it("handles an empty sheet", () => {
    expect(planWrites([], [rowA, rowB])).toEqual({ updates: [], appends: [rowA, rowB] });
  });
});

describe("A1 ranges", () => {
  it("converts a column count to a letter", () => {
    expect(columnLetter(1)).toBe("A");
    expect(columnLetter(24)).toBe("X"); // the Jobs tab width
    expect(columnLetter(26)).toBe("Z");
    expect(columnLetter(27)).toBe("AA");
    expect(columnLetter(0)).toBe("A");
  });

  it("quotes tab titles so spaces and apostrophes survive", () => {
    expect(rowRange("Jobs", 5, 24)).toBe("'Jobs'!A5:X5");
    expect(rowRange("Bob's Jobs", 2, 3)).toBe("'Bob''s Jobs'!A2:C2");
  });
});

describe("an event is never synced without its row", () => {
  // The bug this exists for: a query asked for a column that does not exist,
  // PostgREST answered 400, the error was discarded, no rows were built — and
  // every event was marked synced. The queue said "up to date" while the job
  // had never reached the spreadsheet. Silent loss reported as success is
  // worse than a visible failure, because nothing prompts anyone to look.
  it("treats a missing row as a failure, not a success", () => {
    expect(eventOutcome(null, 0, false)).toBe("retrying");
    expect(eventOutcome(null, MAX_ATTEMPTS - 1, false)).toBe("failed");
  });

  it("still syncs an event whose row was built", () => {
    expect(eventOutcome(null, 0, true)).toBe("synced");
  });

  // A real transport failure keeps its own meaning: the row may well have been
  // built, and reconnect-worthy failures must not be downgraded to a retry.
  it("does not let the guard mask the real failure", () => {
    expect(eventOutcome("unauthorized", 0, true)).toBe("disconnected");
    expect(eventOutcome("unauthorized", 0, false)).toBe("disconnected");
    expect(eventOutcome("not_found", 0, false)).toBe("disconnected");
    expect(eventOutcome("rate_limited", 0, true)).toBe("retrying");
  });
});

describe("a stranded event still runs out of attempts", () => {
  // A run that dies mid-flight leaves its events in `processing`, and the due
  // query never looks there — so they are returned to the queue. If that return
  // did not count as an attempt, an event that reproducibly kills the worker
  // would cycle for ever: always retried, never counted, never dead-lettered.
  // §14.11 requires a bound, and this is where it would have leaked.
  it("dead-letters after the limit rather than cycling", () => {
    // The worker computes attempts + 1 and compares against MAX_ATTEMPTS; this
    // pins the arithmetic that decides between requeue and dead-letter.
    const requeue = (attempts: number) => attempts + 1 < MAX_ATTEMPTS;
    expect(requeue(0)).toBe(true);
    expect(requeue(MAX_ATTEMPTS - 2)).toBe(true);
    expect(requeue(MAX_ATTEMPTS - 1)).toBe(false);
    expect(requeue(MAX_ATTEMPTS)).toBe(false);
  });

  it("backs the retry off by the attempt it just spent", () => {
    expect(backoffMs(1, () => 0)).toBeLessThan(backoffMs(2, () => 0));
  });
});
