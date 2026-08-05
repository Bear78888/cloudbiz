import { describe, expect, it } from "vitest";

import { renderEstimateEmail } from "@/features/email/templates/estimate";

const BASE = {
  locale: "en" as const,
  businessName: "Ruiz Plumbing",
  customerName: "Marta",
  title: "Water heater replacement",
  total: "$1,450.00",
  link: "https://example.test/e/en/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  expiresOn: "September 4, 2026",
};

describe("the estimate email", () => {
  it("names the business and the job in the subject", () => {
    const { subject } = renderEstimateEmail(BASE);
    expect(subject).toContain("Ruiz Plumbing");
    expect(subject).toContain("Water heater replacement");
  });

  // The link is the entire point of the message.
  it("carries the link in both the HTML and the plain text", () => {
    const { html, text } = renderEstimateEmail(BASE);
    expect(html).toContain(BASE.link);
    expect(text).toContain(BASE.link);
  });

  // Plenty of mail clients block images and some strip HTML entirely. A
  // customer reading the plain part must still be able to act.
  it("says everything that matters without any HTML at all", () => {
    const { text } = renderEstimateEmail(BASE);
    expect(text).toContain("Ruiz Plumbing");
    expect(text).toContain("Water heater replacement");
    expect(text).toContain("$1,450.00");
    expect(text).toContain(BASE.link);
    expect(text).not.toContain("<");
  });

  it("writes in the estimate's language, not ours", () => {
    const spanish = renderEstimateEmail({ ...BASE, locale: "es" });
    expect(spanish.subject).toContain("presupuesto");
    expect(spanish.text).toContain("Hola Marta:");
    expect(spanish.html).toContain('lang="es"');

    const english = renderEstimateEmail(BASE);
    expect(english.text).toContain("Hi Marta,");
    expect(english.html).toContain('lang="en"');
  });

  it("greets a customer whose name we do not have", () => {
    const { text } = renderEstimateEmail({ ...BASE, customerName: null });
    expect(text).toContain("Hi,");
    expect(text).not.toContain("Hi null");
    expect(text).not.toContain("undefined");
  });

  it("leaves out the expiry line when there is no date", () => {
    const { text, html } = renderEstimateEmail({ ...BASE, expiresOn: null });
    expect(text).not.toContain("good until");
    expect(html).not.toContain("good until");
  });

  // Every interpolated value is user-entered and lands in an HTML document sent
  // to someone else. A business name is not markup.
  it("escapes a business name that looks like markup", () => {
    const { html } = renderEstimateEmail({
      ...BASE,
      businessName: 'Bob & Sons <script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes the job title and the customer's name too", () => {
    const { html } = renderEstimateEmail({
      ...BASE,
      title: 'Fix <img src=x onerror="steal()">',
      customerName: "</p><b>Not a name",
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<b>Not a name");
    expect(html).toContain("&lt;img");
  });

  // A quote mark in a name must not end the href attribute.
  it("cannot break out of the link attribute", () => {
    const { html } = renderEstimateEmail({
      ...BASE,
      link: 'https://example.test/e/en/x" onmouseover="steal()',
    });
    expect(html).not.toContain('onmouseover="steal()"');
    expect(html).toContain("&quot;");
  });

  // The plain-text part is not HTML, so escaping there would show entities to
  // a reader. What matters is that it stays plain.
  it("does not HTML-escape the plain-text part", () => {
    const { text } = renderEstimateEmail({ ...BASE, businessName: "Bob & Sons" });
    expect(text).toContain("Bob & Sons");
    expect(text).not.toContain("&amp;");
  });

  // Nothing that phones home. This message is a document, not a campaign.
  // The estimate link is the only address in it — and it appears twice on
  // purpose: once as the button, once as text to copy when the button fails.
  it("has no tracking pixel and points nowhere but the estimate", () => {
    const { html } = renderEstimateEmail(BASE);
    expect(html).not.toContain("<img");

    const urls = html.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
    expect(urls.length).toBe(2);
    expect(new Set(urls)).toEqual(new Set([BASE.link]));
  });
});
