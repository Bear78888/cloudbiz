import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { OnboardingForm } from "@/features/organizations/OnboardingForm";
import { getCurrentMembership } from "@/features/organizations/service";
import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDict(locale);
  return { title: `${dict.platform.onboarding.title} — ${dict.meta.siteName}`, robots: { index: false } };
}

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/${l === "es" ? "es/iniciar-sesion" : "en/sign-in"}`);

  const membership = await getCurrentMembership(supabase);
  if (membership) redirect(`/${l}/app`);

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{dict.platform.onboarding.title}</h1>
        <p className="mt-2 text-slate-600">{dict.platform.onboarding.sub}</p>
        <OnboardingForm locale={l} dict={dict} />
      </div>
    </div>
  );
}
