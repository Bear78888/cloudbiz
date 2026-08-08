import { NextResponse } from "next/server";
import { quotePayloadSchema } from "@/lib/schemas";
import { clientIp, createRequestNumber, insertSupabaseRecord, rateLimit, sendQuoteEmails, uploadPrivateFiles, verifyTurnstile, writeDevRecord } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const allowedTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const allowedExtensions = new Set(["pdf", "jpg", "jpeg", "png", "xlsx", "csv", "docx"]);
const maxFileSize = 10 * 1024 * 1024;
const maxFiles = 5;

function errorMessage(locale: "en" | "ru", code: string) {
  const messages: Record<string, [string, string]> = {
    invalid: ["Please review the highlighted fields and try again.", "Проверьте заполненные поля и попробуйте снова."],
    spam: ["We could not verify this request. Please refresh the page and try again.", "Не удалось проверить запрос. Обновите страницу и попробуйте снова."],
    rate: ["Too many requests. Please try again later.", "Слишком много запросов. Попробуйте позже."],
    storage: ["The secure request database is not connected yet. Please use the contact form or return after the integration is enabled.", "Безопасная база заявок пока не подключена. Используйте контактную форму или вернитесь после подключения интеграции."],
    file: ["One or more files are unsupported or too large. Use PDF, JPG, PNG, XLSX, CSV, or DOCX up to 10 MB each.", "Один или несколько файлов имеют неподдерживаемый формат или слишком большой размер. Используйте PDF, JPG, PNG, XLSX, CSV или DOCX до 10 МБ каждый."],
    server: ["We could not save the request. Your shipment has not been approved. Please try again.", "Не удалось сохранить заявку. Поставка не согласована. Попробуйте снова."],
  };
  return messages[code]?.[locale === "ru" ? 1 : 0] || messages.server[locale === "ru" ? 1 : 0];
}

export async function POST(request: Request) {
  const ip = clientIp(request);
  let locale: "en" | "ru" = "en";
  if (!rateLimit(`quote:${ip}`)) return NextResponse.json({ ok: false, message: errorMessage(locale, "rate") }, { status: 429 });

  try {
    const formData = await request.formData();
    const rawPayload = formData.get("payload");
    if (typeof rawPayload !== "string") return NextResponse.json({ ok: false, message: errorMessage("en", "invalid") }, { status: 400 });

    let parsedJson: unknown;
    try { parsedJson = JSON.parse(rawPayload); } catch { return NextResponse.json({ ok: false, message: errorMessage("en", "invalid") }, { status: 400 }); }
    locale = typeof parsedJson === "object" && parsedJson && "tracking" in parsedJson && typeof (parsedJson as { tracking?: { language?: unknown } }).tracking?.language === "string" && (parsedJson as { tracking: { language: string } }).tracking.language === "ru" ? "ru" : "en";
    const parsed = quotePayloadSchema.safeParse(parsedJson);
    if (!parsed.success) return NextResponse.json({ ok: false, message: errorMessage(locale, "invalid"), fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    if (parsed.data.tracking.website) return NextResponse.json({ ok: false, message: errorMessage(locale, "spam") }, { status: 400 });

    const challenge = await verifyTurnstile(parsed.data.tracking.turnstileToken, ip);
    if (!challenge.ok) return NextResponse.json({ ok: false, message: errorMessage(locale, "spam") }, { status: 400 });

    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length > maxFiles) return NextResponse.json({ ok: false, message: errorMessage(locale, "file") }, { status: 400 });
    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase() || "";
      if (file.size > maxFileSize || !allowedTypes.has(file.type) || !allowedExtensions.has(extension)) {
        return NextResponse.json({ ok: false, message: errorMessage(locale, "file") }, { status: 400 });
      }
    }

    const requestNumber = createRequestNumber("SR");
    const uploaded = await uploadPrivateFiles(requestNumber, files);
    const safePayload = {
      ...parsed.data,
      tracking: { ...parsed.data.tracking, turnstileToken: "", website: "" },
    };
    const record = {
      request_number: requestNumber,
      locale,
      intent: parsed.data.final.intent,
      contact_email: parsed.data.contact.email,
      contact_name: `${parsed.data.contact.firstName} ${parsed.data.contact.lastName}`,
      country: parsed.data.contact.country,
      product_category: parsed.data.product.category,
      monthly_volume: parsed.data.selling.monthlyVolume,
      shipment_size: parsed.data.product.totalUnits,
      sku_count: parsed.data.product.numberOfSkus,
      requested_services: parsed.data.services,
      readiness_to_ship: parsed.data.selling.readiness,
      call_requested: parsed.data.final.callRequested,
      source: parsed.data.tracking.utmSource || null,
      campaign: parsed.data.tracking.utmCampaign || null,
      payload: safePayload,
      file_paths: uploaded.paths,
      status: "new",
      consent_version: parsed.data.tracking.consentVersion,
    };

    const inserted = await insertSupabaseRecord("quote_requests", record);
    const devStored = !inserted.configured ? await writeDevRecord("quote_requests", record) : false;
    if (!inserted.configured && !devStored) {
      return NextResponse.json({ ok: false, message: errorMessage(locale, "storage"), integration: "supabase" }, { status: 503 });
    }

    const emails = await sendQuoteEmails({
      requestNumber,
      firstName: parsed.data.contact.firstName,
      customerEmail: parsed.data.contact.email,
      language: locale,
      summary: {
        intent: parsed.data.final.intent,
        contact: parsed.data.contact,
        selling: parsed.data.selling,
        product: parsed.data.product,
        services: parsed.data.services,
        flags: parsed.data.flags,
        final: parsed.data.final,
        tracking: { ...parsed.data.tracking, turnstileToken: undefined, website: undefined },
        files: uploaded.paths,
      },
    });

    return NextResponse.json({ ok: true, requestNumber, contactMethod: parsed.data.final.contactMethod, emailSent: emails.customerSent });
  } catch (error) {
    console.error("SellerRelay quote submission failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ ok: false, message: errorMessage(locale, "server") }, { status: 500 });
  }
}
