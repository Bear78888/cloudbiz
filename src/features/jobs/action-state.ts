import type { JobFormErrors } from "./schema";

/**
 * Shape of the job form's action result. It lives outside `actions.ts` because
 * a `"use server"` module may only export async functions — the initial-state
 * constant would break the build there.
 */
export interface JobActionState {
  errors: JobFormErrors;
  /** Set when the failure is not attributable to one field (§29). */
  formError: "generic" | "not_found" | null;
}

export const EMPTY_JOB_ACTION_STATE: JobActionState = { errors: {}, formError: null };
