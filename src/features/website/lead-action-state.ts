import type { LeadErrors } from "./lead-schema";

/**
 * The shape `useActionState` carries for the public lead form (§19.7).
 *
 * Its own module so the client component can import the type without pulling in
 * the action, and with it the service-role client.
 */
export interface LeadActionState {
  errors: LeadErrors;
  formError: "generic" | "slow_down" | null;
  sent: boolean;
}

export const EMPTY_LEAD_ACTION_STATE: LeadActionState = {
  errors: {},
  formError: null,
  sent: false,
};
