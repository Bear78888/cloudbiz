import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Locale } from "@/lib/routes";
import type { TradeCode } from "@/lib/config";

export interface CurrentMembership {
  organizationId: string;
  role: "owner" | "staff";
  organizationName: string;
  organizationSlug: string;
  trade: string;
  defaultLocale: Locale;
  /** IANA zone (§25.1): scheduled jobs are entered and shown in it. */
  timezone: string;
  currency: string;
}

/**
 * The signed-in user's primary organization (first active membership).
 * RLS scopes every query to the user's own memberships. MVP assumes one
 * organization per user; the model supports more later (§25.1).
 */
export async function getCurrentMembership(
  supabase: SupabaseClient,
): Promise<CurrentMembership | null> {
  // Two plain reads instead of one embedded select. An embed depends on
  // PostgREST resolving the foreign key from its schema cache, and when that
  // resolution fails the call returns an *error* — which, treated as "no
  // membership", sends a user who does have an organization back to
  // onboarding, forever, with nothing in any log. Two reads cannot fail that
  // way, and the cost is one extra round trip on a page that already makes
  // several.
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[organizations] membership lookup failed:", membershipError.message);
    return null;
  }
  if (!membership) return null;

  const organizationId = membership.organization_id as string;
  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name, slug, trade, default_locale, timezone, currency")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) {
    console.error("[organizations] organization lookup failed:", organizationError.message);
    return null;
  }
  if (!organization) return null;

  return {
    organizationId,
    role: membership.role as "owner" | "staff",
    organizationName: organization.name as string,
    organizationSlug: organization.slug as string,
    trade: organization.trade as string,
    defaultLocale: (organization.default_locale as Locale) ?? "en",
    timezone: (organization.timezone as string) ?? "America/New_York",
    currency: (organization.currency as string) ?? "usd",
  };
}

export interface CreateOrganizationInput {
  name: string;
  trade: TradeCode | "other";
  defaultLocale: Locale;
  timezone?: string;
}

/** Calls the atomic SECURITY DEFINER RPC (org + owner + profile + free Job Tracker). */
export async function createOrganization(
  supabase: SupabaseClient,
  input: CreateOrganizationInput,
): Promise<{ organizationId: string } | { error: string }> {
  const { data, error } = await supabase.rpc("create_organization", {
    org_name: input.name,
    org_trade: input.trade,
    org_default_locale: input.defaultLocale,
    org_timezone: input.timezone ?? "America/New_York",
  });
  if (error) return { error: error.message };
  return { organizationId: data as string };
}
