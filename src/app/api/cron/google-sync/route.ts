import { NextResponse, type NextRequest } from "next/server";

import { runSyncForOrganization } from "@/features/google/worker";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * GET /api/cron/google-sync — the scheduled worker (§14.9 step 4).
 *
 * Without this the product would be lying: §14.1 promises jobs "sync
 * automatically", and a queue that is only drained when someone opens the
 * settings screen and presses a button is not automatic. "Sync now" stays,
 * because §14.13 asks for it and because it is the only way to force the issue
 * when something looks wrong — but it is the exception, not the mechanism.
 *
 * Authorisation is `CRON_SECRET`: Vercel sends it as a bearer token on every
 * scheduled invocation. The endpoint writes to every organization's
 * spreadsheet, so leaving it open would let anyone on the internet drive other
 * people's Google API quota.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed. An unprotected endpoint that quietly works is worse than
    // one that refuses and says why.
    console.error("[cron] CRON_SECRET is not configured; refusing to run");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // Only organizations that actually have work due. The alternative — walking
  // every organization every five minutes — turns an idle account into a
  // recurring Google API call for nothing.
  const { data: due, error } = await admin
    .from("sync_outbox")
    .select("organization_id")
    .in("status", ["pending", "retrying"])
    .lte("next_attempt_at", new Date().toISOString())
    .limit(1000);

  if (error) {
    console.error("[cron] could not read the outbox:", error.message);
    return NextResponse.json({ error: "outbox_unavailable" }, { status: 500 });
  }

  const organizationIds = [...new Set((due ?? []).map((row) => row.organization_id as string))];
  if (organizationIds.length === 0) {
    return NextResponse.json({ organizations: 0, synced: 0 });
  }

  let synced = 0;
  let retrying = 0;
  let failed = 0;
  let disconnected = 0;

  // Sequential on purpose. These calls share one Google API quota per project,
  // and firing every organization at once is the fastest way to turn a busy
  // minute into a rate limit for all of them.
  for (const organizationId of organizationIds) {
    try {
      const result = await runSyncForOrganization(organizationId);
      synced += result.synced;
      retrying += result.retrying;
      failed += result.failed;
      disconnected += result.disconnected;
    } catch (runError) {
      // One organization's failure must not stop the rest of the queue.
      console.error(
        `[cron] sync failed for organization ${organizationId}:`,
        runError instanceof Error ? runError.message : runError,
      );
    }
  }

  return NextResponse.json({
    organizations: organizationIds.length,
    synced,
    retrying,
    failed,
    disconnected,
  });
}
