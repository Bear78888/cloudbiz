/**
 * The estimate email (§16.9).
 *
 * Pure: takes facts, returns a subject, an HTML body and a plain-text body.
 * No I/O, so what the customer receives is decided by tests rather than by
 * sending mail and looking at an inbox.
 *
 * Written in the estimate's own language, not the owner's interface language.
 * The estimate carries a `locale` chosen when it was written; a customer who is
 * quoted in Spanish should not be emailed in English about it.
 *
 * Deliberately plain. This message competes with a text message for attention
 * on a phone, and its whole job is to carry one link. There is no logo, no
 * tracking pixel, and nothing that needs images switched on to make sense.
 */

export interface EstimateEmailInput {
  locale: "en" | "es";
  businessName: string;
  customerName: string | null;
  title: string;
  total: string;
  link: string;
  expiresOn: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * HTML-escapes a value.
 *
 * Every interpolated value here is user-entered — a business name, a job title,
 * a customer's name — and lands in an HTML document sent to someone else. A
 * business called `Bob & Sons <Plumbing>` must arrive as its own name, and a
 * title containing a tag must not become one.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const COPY = {
  en: {
    subject: (business: string, title: string) => `Your estimate from ${business}: ${title}`,
    greeting: (name: string | null) => (name ? `Hi ${name},` : "Hi,"),
    intro: (business: string) => `${business} has prepared an estimate for you.`,
    totalLabel: "Total",
    cta: "View and respond to the estimate",
    fallback: "If the button doesn't work, copy this address into your browser:",
    expires: (date: string) => `This estimate is good until ${date}.`,
    closing: "You can accept or decline right from that page.",
    sentBy: (business: string) => `Sent by ${business}.`,
  },
  es: {
    subject: (business: string, title: string) => `Tu presupuesto de ${business}: ${title}`,
    greeting: (name: string | null) => (name ? `Hola ${name}:` : "Hola:"),
    intro: (business: string) => `${business} preparó un presupuesto para ti.`,
    totalLabel: "Total",
    cta: "Ver y responder el presupuesto",
    fallback: "Si el botón no funciona, copia esta dirección en tu navegador:",
    expires: (date: string) => `Este presupuesto es válido hasta el ${date}.`,
    closing: "Puedes aceptarlo o rechazarlo desde esa misma página.",
    sentBy: (business: string) => `Enviado por ${business}.`,
  },
} as const;

export function renderEstimateEmail(input: EstimateEmailInput): RenderedEmail {
  const t = COPY[input.locale];

  const subject = t.subject(input.businessName, input.title);

  const textLines = [
    t.greeting(input.customerName),
    "",
    t.intro(input.businessName),
    `${input.title} — ${t.totalLabel}: ${input.total}`,
    "",
    input.link,
    "",
    t.closing,
    ...(input.expiresOn ? ["", t.expires(input.expiresOn)] : []),
    "",
    t.sentBy(input.businessName),
  ];

  const html = `<!doctype html>
<html lang="${input.locale}">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
    <p style="margin:0 0 16px">${escapeHtml(t.greeting(input.customerName))}</p>
    <p style="margin:0 0 20px">${escapeHtml(t.intro(input.businessName))}</p>
    <p style="margin:0 0 4px;font-size:18px;font-weight:700">${escapeHtml(input.title)}</p>
    <p style="margin:0 0 24px;font-size:24px;font-weight:700">${escapeHtml(
      `${t.totalLabel}: ${input.total}`,
    )}</p>
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(input.link)}" style="display:inline-block;background:#2554eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:12px;font-weight:600">${escapeHtml(
        t.cta,
      )}</a>
    </p>
    <p style="margin:0 0 8px;color:#475569">${escapeHtml(t.closing)}</p>
    ${
      input.expiresOn
        ? `<p style="margin:0 0 8px;color:#475569">${escapeHtml(t.expires(input.expiresOn))}</p>`
        : ""
    }
    <p style="margin:20px 0 4px;color:#64748b;font-size:13px">${escapeHtml(t.fallback)}</p>
    <p style="margin:0;color:#64748b;font-size:13px;word-break:break-all">${escapeHtml(input.link)}</p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">${escapeHtml(
      t.sentBy(input.businessName),
    )}</p>
  </div>
</body>
</html>`;

  return { subject, html, text: textLines.join("\n") };
}
