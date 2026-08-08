import { describe, expect, it } from "vitest";

import {
  buildLocalBusinessJsonLd,
  buildSitemapXml,
  jsonLdScriptText,
  siteDescription,
  sitemapTimestamp,
} from "@/features/website/seo";
import { buildRenderableSite, type SiteSource } from "@/features/website/render";

/**
 * §19.8, from the machine-readable side.
 *
 * The tests worth having here are the negative ones. Structured data is not
 * read by anyone who would notice a fabrication, so "does it contain a rating"
 * is a question that has to be asked by something other than a person looking
 * at the page.
 */

/** The same complete business the render tests use; each test spoils one part. */
function source(overrides: Partial<SiteSource> = {}): SiteSource {
  return {
    locale: "en",
    slug: "alpha-plumbing",
    site: { template: "classic", colorPreset: "navy", hiddenBlocks: [] },
    profile: {
      displayName: "Alpha Plumbing",
      ownerName: "Dana Ruiz",
      phone: "(512) 555-0134",
      email: "hello@alpha.test",
      services: [{ name: { en: "Drain cleaning", es: "Limpieza de desagües" } }],
      serviceArea: { zipCodes: ["78701"], cities: ["Austin"] },
      businessHours: { mon: { open: "08:00", close: "17:00" }, sun: null },
      googleReviewUrl: "https://g.page/r/alpha",
      supportedLocales: ["en", "es"],
    },
    content: {
      locale: "en",
      headline: "Licensed plumbing, same-day service",
      subheadline: "Austin and around",
      aboutText: "Family run since 2009.",
      ctaText: "Get a free quote",
      serviceAreaNote: "No travel fee inside Austin.",
      whyChooseUs: ["Licensed and insured"],
      faq: [{ question: "Free quotes?", answer: "Yes." }],
      aiGeneratedAt: null,
      reviewedAt: null,
    },
    ...overrides,
  };
}

const URL = "https://example.test/pro/alpha-plumbing/en";

describe("LocalBusiness structured data", () => {
  it("states only what the page already says", () => {
    const jsonLd = buildLocalBusinessJsonLd(buildRenderableSite(source()), URL);

    expect(jsonLd["@type"]).toBe("LocalBusiness");
    expect(jsonLd.name).toBe("Alpha Plumbing");
    expect(jsonLd.url).toBe(URL);
    expect(jsonLd.telephone).toBe("(512) 555-0134");
    expect(jsonLd.email).toBe("hello@alpha.test");
    expect(jsonLd.description).toBe("Austin and around");
    expect(jsonLd.areaServed).toEqual([{ "@type": "City", name: "Austin" }, "78701"]);
    expect(jsonLd.knowsLanguage).toEqual(["en-US", "es-US"]);
    expect(jsonLd.hasOfferCatalog).toEqual({
      "@type": "OfferCatalog",
      name: "Alpha Plumbing",
      itemListElement: [
        { "@type": "Offer", itemOffered: { "@type": "Service", name: "Drain cleaning" } },
      ],
    });
  });

  // The three §19.8 prohibitions, asked of the markup rather than of the page.
  it("invents no rating, no review, no licence and no street address", () => {
    const jsonLd = buildLocalBusinessJsonLd(buildRenderableSite(source()), URL);

    expect(jsonLd).not.toHaveProperty("aggregateRating");
    expect(jsonLd).not.toHaveProperty("review");
    expect(jsonLd).not.toHaveProperty("address");
    expect(jsonLd).not.toHaveProperty("hasCredential");
    expect(jsonLd).not.toHaveProperty("priceRange");
    // No image until photo upload exists — an empty `image` is a broken result
    // card, and a placeholder is somebody else's photo.
    expect(jsonLd).not.toHaveProperty("image");
  });

  // Every claim is gated on the block that renders it, so a business that
  // switched a section off does not keep making the claim invisibly.
  it("says nothing about a section the owner switched off", () => {
    const hidden = source({
      site: {
        template: "classic",
        colorPreset: "navy",
        hiddenBlocks: ["services", "service_area", "contact_form", "call_button"],
      },
    });
    const jsonLd = buildLocalBusinessJsonLd(buildRenderableSite(hidden), URL);

    expect(jsonLd).not.toHaveProperty("hasOfferCatalog");
    expect(jsonLd).not.toHaveProperty("areaServed");
    expect(jsonLd).not.toHaveProperty("telephone");
    expect(jsonLd).not.toHaveProperty("email");
    expect(jsonLd).not.toHaveProperty("openingHoursSpecification");
  });

  it("publishes only the days that are open", () => {
    const jsonLd = buildLocalBusinessJsonLd(buildRenderableSite(source()), URL);

    // Sunday is recorded as closed. A `00:00`–`00:00` entry is how schema.org
    // is usually made to say that, and it parses as a business that opens.
    expect(jsonLd.openingHoursSpecification).toEqual([
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Monday",
        opens: "08:00",
        closes: "17:00",
      },
    ]);
  });

  it("omits the hours entirely when nobody filled them in", () => {
    const blank = source({
      profile: { ...source().profile, businessHours: {} },
    });
    const jsonLd = buildLocalBusinessJsonLd(buildRenderableSite(blank), URL);
    expect(jsonLd).not.toHaveProperty("openingHoursSpecification");
  });

  it("leaves out the url when the deployment cannot name itself", () => {
    const jsonLd = buildLocalBusinessJsonLd(buildRenderableSite(source()), null);
    expect(jsonLd).not.toHaveProperty("url");
    expect(jsonLd.name).toBe("Alpha Plumbing");
  });
});

describe("the description search results quote", () => {
  it("prefers the subheadline the owner wrote", () => {
    expect(siteDescription(buildRenderableSite(source()))).toBe("Austin and around");
  });

  it("falls back to the About text, never to a generated sentence", () => {
    const noSub = source({ content: { ...source().content!, subheadline: null } });
    expect(siteDescription(buildRenderableSite(noSub))).toBe("Family run since 2009.");
  });

  it("is absent when the owner wrote neither", () => {
    const bare = source({
      content: { ...source().content!, subheadline: null, aboutText: null },
    });
    expect(siteDescription(buildRenderableSite(bare))).toBeUndefined();
  });

  it("truncates rather than running to the length of an essay", () => {
    const long = source({
      content: { ...source().content!, subheadline: null, aboutText: "a".repeat(400) },
    });
    const description = siteDescription(buildRenderableSite(long))!;
    expect(description.length).toBeLessThanOrEqual(160);
    expect(description.endsWith("…")).toBe(true);
  });
});

describe("the JSON-LD script body", () => {
  // The one injection this page has: everything else React renders as text.
  it("cannot close its own script tag", () => {
    const nasty = source({
      content: {
        ...source().content!,
        subheadline: '</script><script>alert("x")</script>',
      },
    });
    const text = jsonLdScriptText(
      buildLocalBusinessJsonLd(buildRenderableSite(nasty), URL),
    );

    expect(text).not.toContain("</script>");
    expect(text).not.toContain("<");
    expect(text).not.toContain(">");
    // Still the same data once a parser has read it back.
    expect((JSON.parse(text) as { description: string }).description).toBe(
      '</script><script>alert("x")</script>',
    );
  });
});

describe("the sitemap document", () => {
  it("lists every language, each pointing at all of them", () => {
    const alternates = [
      { hreflang: "en-US", href: "https://example.test/pro/alpha/en" },
      { hreflang: "es-US", href: "https://example.test/pro/alpha/es" },
    ];
    const xml = buildSitemapXml(
      alternates.map((entry) => ({
        loc: entry.href,
        lastModified: "2026-08-08T10:00:00.000Z",
        alternates,
      })),
    );

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n')).toBe(true);
    expect(xml).toContain("<loc>https://example.test/pro/alpha/en</loc>");
    expect(xml).toContain("<loc>https://example.test/pro/alpha/es</loc>");
    expect(xml).toContain("<lastmod>2026-08-08T10:00:00.000Z</lastmod>");
    expect(xml.match(/hreflang="es-US"/g)).toHaveLength(2);
    expect(xml.endsWith("</urlset>\n")).toBe(true);
  });

  it("escapes what goes into it", () => {
    const xml = buildSitemapXml([{ loc: "https://example.test/pro/a?x=1&y=2" }]);
    expect(xml).toContain("<loc>https://example.test/pro/a?x=1&amp;y=2</loc>");
  });

  it("stays a valid document with nothing in it", () => {
    expect(buildSitemapXml([])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
        "</urlset>\n",
    );
  });

  it("normalises lastmod and refuses to invent one", () => {
    expect(sitemapTimestamp("2026-08-08T10:00:00+00:00")).toBe("2026-08-08T10:00:00.000Z");
    expect(sitemapTimestamp(null)).toBeNull();
    expect(sitemapTimestamp("not a date")).toBeNull();
  });
});
