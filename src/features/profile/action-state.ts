import type { ProfileErrors } from "./schema";

/**
 * The shape `useActionState` carries between the form and the server.
 *
 * Its own module so the client component can import the type without pulling in
 * the action, and with it the whole server-side tree.
 */
export interface ProfileActionState {
  errors: ProfileErrors;
  formError: "generic" | "not_owner" | null;
  saved: boolean;
}

export const EMPTY_PROFILE_ACTION_STATE: ProfileActionState = {
  errors: {},
  formError: null,
  saved: false,
};
