import { appendFile, mkdir } from "node:fs/promises";
import { randomInt, randomUUID } from "node:crypto";
import path from "node:path";

const rateBuckets = new Map<string, number[]>();

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function rateLimit(key: string, limit = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const recent = (rateBuckets.get(key) || []).filter((time) => now - time < windowMs);
  if (recent.length >= limit) return false;
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

export function createRequestNumber(prefix = "SR") {
  const year = new Date().getUTCFullYear();
  const timePart = String(Date.now()).slice(-7);
  const randomPart = randomInt(100, 1000);
  return `${prefix}-${year}-${timePart}${randomPart}`;
}

export async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true, configured: false };
  if (!token) return { ok: false, configured: true };

  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, configured: true };
  const result = (await response.json()) as { success?: boolean };
  return { ok: Boolean(result.success), configured: true };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { url, key };
}

export async function uploadPrivateFiles(requestNumber: string, files: File[]) {
  const config = supabaseConfig();
  if (!config) return { configured: false as const, paths: [] as string[] };
  const bucket = process.env.SUPABASE_PRIVATE_BUCKET || "sellerrelay-private";
  const paths: string[] = [];

  for (const file of files) {
    const extension = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
    const safeName = `${Date.now()}-${randomUUID()}${extension}`;
    const objectPath = `${requestNumber}/${safeName}`;
    const response = await fetch(`${config.url}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: await file.arrayBuffer(),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`File storage failed with status ${response.status}`);
    }
    paths.push(`${bucket}/${objectPath}`);
  }

  return { configured: true as const, paths };
}

export async function insertSupabaseRecord(table: "quote_requests" | "lead_requests", record: Record<string, unknown>) {
  const config = supabaseConfig();
  if (!config) return { configured: false as const, record: null };
  const response = await fetch(`${config.url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(record),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Database insert failed with status ${response.status}`);
  const rows = (await response.json()) as unknown[];
  return { configured: true as const, record: rows[0] || null };
}

export async function writeDevRecord(table: string, record: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production" || process.env.SELLERRELAY_DEV_FILE_STORE !== "1") return false;
  const directory = path.join(process.cwd(), ".sellerrelay-dev");
  await mkdir(directory, { recursive: true });
  await appendFile(path.join(directory, `${table}.jsonl`), `${JSON.stringify(record)}\n`, "utf8");
  return true;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function resendEmail(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
    cache: "no-store",
  });
  return response.ok;
}

export async function sendQuoteEmails(args: {
  requestNumber: string;
  firstName: string;
  customerEmail: string;
  language: "en" | "ru";
  summary: Record<string, unknown>;
}) {
  const owner = process.env.SELLERRELAY_OWNER_EMAIL;
  const customerText = args.language === "ru"
    ? `Здравствуйте, ${args.firstName}!\n\nСпасибо за обращение в SellerRelay. Мы получили информацию о поставке и проверим товар, объём, необходимые операции и предполагаемые сроки.\n\nНе отправляйте товар до получения письменного подтверждения партии и инструкций по приёмке.\n\nНомер заявки: ${args.requestNumber}\nПредпочитаемый язык: Русский\n\nПервичный ответ — в течение одного рабочего дня.\n\nSellerRelay Logistics\nCalifornia, United States`
    : `Hello ${args.firstName},\n\nThank you for contacting SellerRelay. We received your shipment request and will review the product, volume, required services, and timeline.\n\nPlease do not ship inventory until you receive written shipment approval and receiving instructions from us.\n\nRequest number: ${args.requestNumber}\nPreferred language: English\n\nInitial response time: within one business day.\n\nSellerRelay Logistics\nCalifornia, United States`;
  const customerSubject = args.language === "ru"
    ? `SellerRelay получил вашу заявку — ${args.requestNumber}`
    : `SellerRelay Quote Request Received — ${args.requestNumber}`;
  const customerSent = await resendEmail(args.customerEmail, customerSubject, `<p>${customerText.split("\n").map(escapeHtml).join("<br>")}</p>`, customerText);

  let ownerSent = false;
  if (owner) {
    const pretty = JSON.stringify(args.summary, null, 2);
    ownerSent = await resendEmail(owner, `New SellerRelay request — ${args.requestNumber}`, `<h1>${escapeHtml(args.requestNumber)}</h1><pre style="white-space:pre-wrap">${escapeHtml(pretty)}</pre>`, `${args.requestNumber}\n\n${pretty}`);
  }
  return { customerSent, ownerSent };
}

export async function sendLeadNotification(args: {
  requestNumber: string;
  type: "contact" | "agency";
  email: string;
  locale: "en" | "ru";
  summary: Record<string, unknown>;
}) {
  const owner = process.env.SELLERRELAY_OWNER_EMAIL;
  if (!owner) return false;
  const pretty = JSON.stringify(args.summary, null, 2);
  return resendEmail(owner, `New SellerRelay ${args.type} request — ${args.requestNumber}`, `<h1>${escapeHtml(args.requestNumber)}</h1><pre style="white-space:pre-wrap">${escapeHtml(pretty)}</pre>`, `${args.requestNumber}\n\n${pretty}`);
}
