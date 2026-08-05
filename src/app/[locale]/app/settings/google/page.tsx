import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getGoogleConnection } from "@/features/google/service";
import { spreadsheetUrl } from "@/features/google/sheets";
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
  return {
    title: `${dict.platform.google.title} — ${dict.meta.siteName}`,
    robots: { index: false },
  };
}

/** Reason codes come from the OAuth routes; anything unknown is ignored. */
function messageFor(
  dict: ReturnType<typeof getDict>,
  reason: string | undefined,
): { text: string; tone: "ok" | "problem" } | null {
  if (!reason) return null;
  const messages = dict.platform.google.messages;
  if (!(reason in messages)) return null;
  const text = messages[reason as keyof typeof messages];
  return { text, tone: reason === "connected" ? "ok" : "problem" };
}

/**
 * Google Sheets settings (§14.13). This first pass shows the connection and
 * the pending-changes count; creating and replacing the spreadsheet, "Sync
 * now" and disconnect arrive with the worker.
 *
 * Owner-only (§11.3): connecting Google sends the organization's data to an
 * outside account.
 */
export default async function GoogleSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ google?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const l = locale as Locale;
  const dict = getDict(l);
  const g = dict.platform.google;

  const supabase = await createSupabaseServerClient();
  const membership = await getCurrentMembership(supabase);
  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/${l}/app`);

  const { google: reason } = await searchParams;
  const connection = await getGoogleConnection(supabase, membership.organizationId);

  // The connection may carry its own problem (a token that stopped being
  // readable, a grant the user revoked) even when the URL says nothing.
  const message =
    messageFor(dict, reason) ??
    (connection?.problem ? messageFor(dict, connection.problem) : null);

  const { data: spreadsheet } = await supabase
    .from("google_spreadsheets")
    .select("spreadsheet_id, spreadsheet_name, last_successful_sync_at, status")
    .eq("organization_id", membership.organizationId)
    .eq("status", "active")
    .maybeSingle();

  const { count: pendingChanges } = await supabase
    .from("sync_outbox")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", membership.organizationId)
    .in("status", ["pending", "retrying"]);

  const needsReconnect = connection?.status === "needs_reconnect";

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{g.title}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{g.subtitle}</p>

      {message ? (
        <p
          role="status"
          className={
            message.tone === "ok"
              ? "mt-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
              : "mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
          }
        >
          {message.text}
        </p>
      ) : null}

      <section className="mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
        {connection ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{g.connectedAs}</dt>
                <dd className="font-medium">{connection.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{g.connectedSince}</dt>
                <dd className="font-medium">
                  {new Date(connection.connectedAt).toLocaleDateString(l, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    timeZone: membership.timezone,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">{g.pendingChanges}</dt>
                <dd className="font-medium">{pendingChanges ?? 0}</dd>
              </div>
            </dl>
            {/* Status is not carried by colour alone (§8.3). */}
            <p className="mt-4 text-sm font-medium">
              {needsReconnect ? g.statusNeedsReconnect : g.statusActive}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-base font-medium">{g.notConnectedTitle}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{g.notConnectedBody}</p>
          </>
        )}

        {/* A form, not a link: starting an OAuth flow is a POST (see the route). */}
        <form action="/api/google/connect" method="post" className="mt-5">
          <input type="hidden" name="locale" value={l} />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {connection ? g.reconnect : g.connect}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{g.scopeNote}</p>
      </section>

      {/* The spreadsheet itself. Only meaningful once Google is connected and
          working — offering to create a sheet on a broken connection would just
          fail in a second step. */}
      {connection && !needsReconnect ? (
        <section className="mt-6 rounded-xl border border-slate-200 p-5 dark:border-slate-800">
          {spreadsheet ? (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">{g.sheetName}</dt>
                  <dd className="font-medium">{spreadsheet.spreadsheet_name as string}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">{g.lastSynced}</dt>
                  <dd className="font-medium">
                    {spreadsheet.last_successful_sync_at
                      ? new Date(spreadsheet.last_successful_sync_at as string).toLocaleString(l, {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: membership.timezone,
                        })
                      : g.neverSynced}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-3">
                <a
                  href={spreadsheetUrl(spreadsheet.spreadsheet_id as string)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                >
                  {g.openSheet}
                </a>
                {/* Only pulls the schedule forward: the queue is filled by
                    triggers on every write, so skipping this button costs
                    nothing but time. */}
                <form action="/api/google/sync-now" method="post">
                  <input type="hidden" name="locale" value={l} />
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    {g.syncNow}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-base font-medium">{g.noSheetTitle}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{g.noSheetBody}</p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <form action="/api/google/sheets/create" method="post">
                  <input type="hidden" name="locale" value={l} />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    {g.createSheet}
                  </button>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    {g.createSheetHint}
                  </p>
                </form>

                {/*
                  Deliberately a button, never a URL field. Under the drive.file
                  scope HandyAlliance has no access to a file the user has not
                  handed over through Google's own picker, so a pasted address
                  could not work — and an input box would promise that it does.
                  Disabled until the picker ships, with the same wording, so the
                  affordance never changes shape under the user.
                */}
                <div>
                  <button
                    type="button"
                    disabled
                    aria-describedby="choose-sheet-hint"
                    className="w-full cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-400 dark:border-slate-700 dark:text-slate-500"
                  >
                    {g.chooseSheet}
                  </button>
                  <p
                    id="choose-sheet-hint"
                    className="mt-2 text-xs text-slate-500 dark:text-slate-400"
                  >
                    {g.chooseSheetHint} {g.comingSoonShort}
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
