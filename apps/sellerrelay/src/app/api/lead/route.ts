import { NextResponse } from "next/server";
import { leadPayloadSchema } from "@/lib/schemas";
import { clientIp, createRequestNumber, insertSupabaseRecord, rateLimit, sendLeadNotification, verifyTurnstile, writeDevRecord } from "@/lib/server";

export const runtime = "nodejs";

function message(locale: "en" | "ru", key: "invalid" | "spam" | "storage" | "server" | "rate") {
  const en = {
    invalid: "Please review the form and try again.",
    spam: "We could not verify this request. Please refresh and try again.",
    storage: "The secure request database is not connected yet.",
    server: "We could not save the message. Please try again.",
    rate: "Too many requests. Please try again later.",
  };
  const ru = {
    invalid: "Проверьте форму и попробуйте снова.",
    spam: "Не удалось проверить запрос. Обновите страницу и попробуйте снова.",
    storage: "Безопасная база заявок пока не подключена.",
    server: "Не удалось сохранить сообщение. Попробуйте снова.",
    rate: "Слишком много запросов. Попробуйте позже.",
  };
  return (locale === "ru" ? ru : en)[key];
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  let locale: "en" | "ru" = "en";
  if (!rateLimit(`lead:${ip}`, 10)) return NextResponse.json({ ok: false, message: message(locale, "rate") }, { status: 429 });
  try {
    const json = await request.json();
    if (json?.locale === "ru") locale = "ru";
    const parsed = leadPayloadSchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ ok: false, message: message(locale, "invalid") }, { status: 400 });
    if (parsed.data.tracking.website) return NextResponse.json({ ok: false, message: message(locale, "spam") }, { status: 400 });
    const challenge = await verifyTurnstile(parsed.data.tracking.turnstileToken, ip);
    if (!challenge.ok) return NextResponse.json({ ok: false, message: message(locale, "spam") }, { status: 400 });

    const requestNumber = createRequestNumber(parsed.data.type === "agency" ? "SR-A" : "SR-C");
    const safePayload = {
      ...parsed.data,
      tracking: { ...parsed.data.tracking, turnstileToken: "", website: "" },
    };
    const record = {
      request_number: requestNumber,
      type: parsed.data.type,
      locale: parsed.data.locale,
      contact_email: parsed.data.fields.email,
      payload: safePayload,
      status: "new",
      source: parsed.data.tracking.utmSource || null,
      campaign: parsed.data.tracking.utmCampaign || null,
    };
    const inserted = await insertSupabaseRecord("lead_requests", record);
    const devStored = !inserted.configured ? await writeDevRecord("lead_requests", record) : false;
    if (!inserted.configured && !devStored) return NextResponse.json({ ok: false, message: message(locale, "storage"), integration: "supabase" }, { status: 503 });

    await sendLeadNotification({ requestNumber, type: parsed.data.type, email: parsed.data.fields.email, locale: parsed.data.locale, summary: parsed.data.fields });
    return NextResponse.json({ ok: true, requestNumber });
  } catch (error) {
    console.error("SellerRelay lead submission failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: message(locale, "server") }, { status: 500 });
  }
}
