import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentMembership } from "@/features/organizations/service";
import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Signed-in dashboard shell (§20.1): business name, navigation, language
 * switch, sign out. Middleware already gates on a session; this layout
 * additionally requires an organization (otherwise → onboarding).
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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
  if (!user) redirect(l === "es" ? "/es/iniciar-sesion" : "/en/sign-in");

  const membership = await getCurrentMembership(supabase);
  if (!membership) redirect(`/${l}/onboarding`);

  const otherLocale: Locale = l === "en" ? "es" : "en";
  const d = dict.platform.dashboard;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={`/${l}`} className="font-bold text-brand-700">
            {dict.meta.siteName}
          </Link>
          <span className="hidden truncate text-sm font-semibold text-slate-700 sm:inline">
            {membership.organizationName}
          </span>
          <nav aria-label={d.title} className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <Link href={`/${l}/app`} className="hover:text-slate-900">
              {d.navDashboard}
            </Link>
            <Link href={`/${l}/app/jobs`} className="hover:text-slate-900">
              {dict.platform.jobs.nav}
            </Link>
            {membership.role === "owner" ? (
              <Link href={`/${l}/app/billing`} className="hover:text-slate-900">
                {d.navBilling}
              </Link>
            ) : null}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link
              href={`/${otherLocale}/app`}
              lang={otherLocale === "es" ? "es-US" : "en-US"}
              className="font-medium text-slate-500 hover:text-slate-900"
            >
              {dict.nav.switchLocale}
            </Link>
            <form action="/auth/sign-out" method="post">
              <input type="hidden" name="locale" value={l} />
              <button type="submit" className="font-medium text-slate-500 hover:text-slate-900">
                {dict.platform.common.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
