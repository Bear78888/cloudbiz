"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { TRADES } from "@/lib/config";
import { isLocale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { US_TIMEZONES } from "@/features/organizations/constants";
import { createOrganization } from "@/features/organizations/service";

const onboardingSchema = z.object({
  locale: z.enum(["en", "es"]),
  business_name: z.string().trim().min(1).max(200),
  trade: z.enum(TRADES.map((t) => t.code) as [string, ...string[]]),
  default_locale: z.enum(["en", "es"]),
  timezone: z.enum(US_TIMEZONES),
});

export interface OnboardingActionState {
  error: "required" | "generic" | null;
}

export async function createOrganizationAction(
  _previous: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const raw = {
    locale: String(formData.get("locale") ?? "en"),
    business_name: String(formData.get("business_name") ?? ""),
    trade: String(formData.get("trade") ?? ""),
    default_locale: String(formData.get("default_locale") ?? "en"),
    timezone: String(formData.get("timezone") ?? "America/New_York"),
  };

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: raw.business_name.trim() === "" ? "required" : "generic" };
  }
  const input = parsed.data;
  const uiLocale = isLocale(input.locale) ? input.locale : "en";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/${uiLocale}/sign-in`);
  }

  const result = await createOrganization(supabase, {
    name: input.business_name,
    trade: input.trade as (typeof TRADES)[number]["code"],
    defaultLocale: input.default_locale,
    timezone: input.timezone,
  });
  if ("error" in result) {
    // §29 keeps the reason off the screen — but swallowing it entirely means
    // a failed signup is undiagnosable in any environment.
    console.error("[organizations] create_organization failed:", result.error);
    return { error: "generic" };
  }

  redirect(`/${uiLocale}/app`);
}
