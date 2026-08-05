import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Reads that must not fail silently.
 *
 * The whole reason this exists: destructuring only `data` from a query discards
 * the error, so a failed query and an empty result become the same value. That
 * has now cost us three defects — an infinite onboarding loop, a job that never
 * reached the spreadsheet while the queue said "synced", and every plain edit
 * of a job failing. Each was a query that errored while the caller read `null`
 * and carried on as if the answer were "nothing here".
 *
 * A comment asking people to check `error` did not work; one of those three was
 * written after I had already written that comment. So the check moves into a
 * function that cannot be forgotten, and CI refuses a bare destructure.
 *
 * Throwing is the point. In a server component it surfaces the error boundary —
 * a page that says something went wrong, which is honest — instead of an empty
 * list that quietly claims the user has no jobs. Callers that genuinely need to
 * continue after a failure (the sync worker, which has to record an outcome for
 * every event) handle `error` explicitly and are exempt.
 */
export class SupabaseQueryError extends Error {
  readonly code: string | undefined;

  constructor(context: string, error: PostgrestError) {
    // The message goes to logs, not to the user: it can name columns and
    // constraints (§29 — no raw errors in the interface).
    super(`${context}: ${error.message}`);
    this.name = "SupabaseQueryError";
    this.code = error.code;
  }
}

type QueryResult<T> = { data: T; error: PostgrestError | null };

/**
 * Awaits a PostgREST query and returns its data, throwing when it failed.
 *
 * `context` is a short phrase naming the read ("jobs list", "entitlements"),
 * so a log line says which query broke without a stack trace archaeology.
 */
export async function must<T>(
  query: PromiseLike<QueryResult<T>>,
  context: string,
): Promise<T> {
  const { data, error } = await query;
  if (error) {
    console.error(`[supabase] ${context} failed:`, error.message);
    throw new SupabaseQueryError(context, error);
  }
  return data;
}

/**
 * Same, but for reads where "no rows" is an ordinary answer and a failure is
 * not. Returns `null` only when the query succeeded and matched nothing.
 */
export async function maybe<T>(
  query: PromiseLike<QueryResult<T | null>>,
  context: string,
): Promise<T | null> {
  return must(query, context);
}
