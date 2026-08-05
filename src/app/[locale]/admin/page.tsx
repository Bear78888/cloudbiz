import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getDict } from "@/lib/i18n";
import { isLocale, type Locale } from "@/lib/routes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { must } from "@/lib/supabase/query";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDict(locale);
  return {
    title: `${dict.platform.admin.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/**
 * Admin foundation (§22, §11.5) with the three-layer check (audit §4.3):
 * 1) page checks the session, 2) RLS on admin_roles returns zero rows to a
 * non-admin, 3) the role is re-verified before the elevated client is used.
 * Non-admins get a 404, not a hint that the page exists.
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const a = dict.platform.admin;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  // Layer 2: RLS admin_roles_self_select — a non-admin sees zero rows.
  const selfRole = await must(
    supabase
    .from("admin_roles")
    .select("role, is_active")
    .eq("profile_id", user.id)
    .maybeSingle(),
    "page:selfRole",
  );
  if (!selfRole?.is_active) notFound();

  // Layer 3: re-verify with the elevated client before using it.
  const admin = createSupabaseAdminClient();
  const verify = await admin
    .from("admin_roles")
    .select("role, is_active")
    .eq("profile_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (!verify.data) notFound();

  const organizations = await must(
    admin
    .from("organizations")
    .select("name, trade, status, created_at")
    .order("created_at", { ascending: false })
    .limit(50),
    "page:organizations",
  );
  const rows = organizations ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">{a.title}</h1>
      <p className="mt-1 text-slate-600">{a.sub}</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm font-medium text-slate-600">{a.totalOrganizations}</p>
        <p className="text-3xl font-bold text-slate-900">{rows.length}</p>
      </div>

      <h2 className="mt-8 text-lg font-bold text-slate-900">{a.organizations}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-slate-500">{a.empty}</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3">{a.name}</th>
                <th scope="col" className="px-4 py-3">{a.trade}</th>
                <th scope="col" className="px-4 py-3">{a.status}</th>
                <th scope="col" className="px-4 py-3">{a.created}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((org) => (
                <tr key={`${org.name}-${org.created_at}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{org.name}</td>
                  <td className="px-4 py-3 text-slate-600">{org.trade}</td>
                  <td className="px-4 py-3 text-slate-600">{org.status}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(org.created_at as string).toLocaleDateString(l === "es" ? "es-US" : "en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
