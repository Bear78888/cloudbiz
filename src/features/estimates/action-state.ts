import type { EstimateFormErrors } from "./schema";

/**
 * Result shape for the estimate editor's action. Lives outside `actions.ts`
 * because a `"use server"` module may only export async functions — the
 * initial-state constant would break the build there.
 */
export interface EstimateActionState {
  errors: EstimateFormErrors;
  /** Set when the failure is not attributable to one field (§29). */
  formError: "generic" | "not_found" | "already_sent" | null;
  /** Set after a save that went through, so the page can say so. */
  saved: boolean;
}

export const EMPTY_ESTIMATE_ACTION_STATE: EstimateActionState = {
  errors: {},
  formError: null,
  saved: false,
};
