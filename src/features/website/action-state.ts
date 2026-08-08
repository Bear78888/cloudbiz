import type { SiteContentErrors, SiteSettingsErrors } from "./schema";

/**
 * The shape `useActionState` carries between the form and the server (§19.3).
 *
 * Kept in its own module so that the client component can import the type
 * without pulling in the action — and with it the whole server-side tree.
 */

export interface SiteSettingsActionState {
  errors: SiteSettingsErrors;
  /** A problem with the submission as a whole rather than with one field. */
  formError: "generic" | "not_owner" | null;
  saved: boolean;
}

export interface SiteContentActionState {
  errors: SiteContentErrors;
  formError: "generic" | "not_owner" | null;
  saved: boolean;
}

export const EMPTY_SETTINGS_ACTION_STATE: SiteSettingsActionState = {
  errors: {},
  formError: null,
  saved: false,
};

export const EMPTY_CONTENT_ACTION_STATE: SiteContentActionState = {
  errors: {},
  formError: null,
  saved: false,
};
