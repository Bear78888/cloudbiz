import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";

import { renderEstimatePdf, type EstimatePdfInput } from "@/features/estimates/pdf";

/**
 * The estimate PDF (§16.9).
 *
 * `@react-pdf/renderer` Flate-compresses its content streams, so the
 * rendered text is not a plain substring of the output buffer — a naive
 * `.toString().includes(...)` test would pass on garbage and fail on
 * correct output alike. Two decoding steps recover it, both with Node's own
 * `zlib`/`Buffer` (no new dependency for testing):
 *
 * 1. Inflate every `stream ... endstream` block.
 * 2. Within that, react-pdf shows text as hex strings inside `Tj`/`TJ`
 *    operators — `[<2431302e3030> 0] TJ` for the glyphs of "$10.00" — because
 *    the font here maps codes to characters one-to-one. Every `<...>` run is
 *    hex-decoded and concatenated in encounter order; literal `(...)` strings
 *    (PDF's other text-string form) are unescaped and included too, in case a
 *    future style change makes react-pdf choose that form instead.
 *
 * This is not a PDF parser — it does not track text position, so words from
 * unrelated parts of the page can end up adjacent with no space between them.
 * It is precise enough for "does this document contain that word", the same
 * standard `email/templates/estimate.ts`'s tests hold the email to.
 */

function decodedText(pdf: Buffer): string {
  const streams: string[] = [];
  let index = 0;
  while (true) {
    const start = pdf.indexOf("stream", index);
    if (start === -1) break;
    // "stream" is followed by a single CRLF or LF before the actual data.
    let dataStart = start + "stream".length;
    if (pdf[dataStart] === 0x0d) dataStart += 1;
    if (pdf[dataStart] === 0x0a) dataStart += 1;
    const end = pdf.indexOf("endstream", dataStart);
    if (end === -1) break;
    const raw = pdf.subarray(dataStart, end);
    try {
      streams.push(inflateSync(raw).toString("latin1"));
    } catch {
      // Not every stream is Flate-compressed text (fonts, images); skip what
      // doesn't inflate rather than fail the whole extraction over it.
    }
    index = end + "endstream".length;
  }
  const combined = streams.join("\n");

  const hexRuns = (combined.match(/<[0-9a-fA-F]+>/g) ?? []).map((run) =>
    Buffer.from(run.slice(1, -1), "hex").toString("latin1"),
  );
  const literalRuns = (combined.match(/\(((?:\\.|[^()\\])*)\)/g) ?? []).map((run) =>
    run
      .slice(1, -1)
      .replace(/\\([()\\])/g, "$1"),
  );

  return [...hexRuns, ...literalRuns].join("");
}

const BASE: EstimatePdfInput = {
  locale: "en",
  businessName: "Acme Plumbing",
  currency: "usd",
  title: "Faucet Replacement",
  scope: "Replace the kitchen faucet.",
  terms: "50% deposit required.",
  items: [
    { description: "Labor", quantity: 1.5, unitPrice: 85, total: 127.5 },
    { description: "Faucet unit", quantity: 1, unitPrice: 0, total: 0 },
  ],
  subtotal: 127.5,
  tax: 10.53,
  taxRate: 0.0825,
  total: 138.03,
  sentAt: "2026-08-06T12:00:00Z",
  expiresAt: "2026-09-05T12:00:00Z",
};

describe("renderEstimatePdf", () => {
  it("produces a real PDF", async () => {
    const buf = await renderEstimatePdf(BASE);
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(500);
  });

  it("carries the business name, title, line items and totals", async () => {
    const buf = await renderEstimatePdf(BASE);
    const text = decodedText(buf);
    expect(text).toContain("ACME PLUMBING");
    expect(text).toContain("Faucet Replacement");
    expect(text).toContain("Labor");
    expect(text).toContain("Faucet unit");
    // react-pdf draws each glyph as its own show-text op broken across
    // several `Tj`/`TJ` calls, so a currency string is not one contiguous
    // run in the stream — this checks the parts a human would read as
    // "$138.03", not that exact byte sequence.
    expect(text).toContain("138");
    expect(text).toContain("03");
  });

  it("writes the scope and terms when present, omits the sections when not", async () => {
    const withBoth = decodedText(await renderEstimatePdf(BASE));
    expect(withBoth).toContain("Replace the kitchen faucet");
    expect(withBoth).toContain("50% deposit required");

    const withNeither = decodedText(
      await renderEstimatePdf({ ...BASE, scope: null, terms: null }),
    );
    expect(withNeither).not.toContain("SCOPE OF WORK");
    expect(withNeither).not.toContain("TERMS");
  });

  // §16.7: the document's own language, never the owner's interface language,
  // and never both — the same rule the email template and the with-guard
  // auth templates are held to.
  it("renders Spanish labels for a Spanish estimate, English for an English one", async () => {
    const en = decodedText(await renderEstimatePdf(BASE));
    expect(en).toContain("Subtotal");
    expect(en).toContain("Tax");
    expect(en).not.toContain("Impuesto");

    const es = decodedText(await renderEstimatePdf({ ...BASE, locale: "es" }));
    expect(es).toContain("Impuesto");
    // Headings render uppercase (`textTransform: "uppercase"` in the PDF's
    // own styles) — the assertion checks what a reader actually sees, not
    // the mixed-case source string in COPY.
    expect(es).toContain("ALCANCE DEL TRABAJO");
    expect(es).not.toContain("SCOPE OF WORK");
  });

  it("renders with no line items, no dates, and a zero total without throwing", async () => {
    const buf = await renderEstimatePdf({
      ...BASE,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
      sentAt: null,
      expiresAt: null,
    });
    expect(buf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders a large number of line items without throwing", async () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      description: `Line ${i + 1}`,
      quantity: 1,
      unitPrice: 10,
      total: 10,
    }));
    const buf = await renderEstimatePdf({ ...BASE, items, subtotal: 600, tax: 0, total: 600 });
    const text = decodedText(buf);
    expect(text).toContain("Line 1");
    expect(text).toContain("Line 60");
  });
});
