import { describe, expect, it } from "vitest";

import { buildRenderableSite, serviceAreaLine, type SiteSource } from "@/features/website/render";
import { layoutFor, paletteFor } from "@/features/website/theme";
import { SITE_COLOR_PRESETS, SITE_TEMPLATES } from "@/features/website/model";

/** A complete business; each test spoils only the part it is about. */
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
      services: [
        { name: { en: "Drain cleaning", es: "Limpieza de desagües" } },
        { name: { es: "Plomería de emergencia" } },
      ],
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

describe("buildRenderableSite", () => {
  it("resolves services into the page's language", () => {
    const en = buildRenderableSite(source());
    expect(en.services).toEqual(["Drain cleaning", "Plomería de emergencia"]);

    const es = buildRenderableSite(source({ locale: "es" }));
    expect(es.services).toEqual(["Limpieza de desagües", "Plomería de emergencia"]);
  });

  it("falls back to the business name rather than inventing a headline (§19.8)", () => {
    const site = buildRenderableSite(
      source({ content: { ...source().content!, headline: "   " } }),
    );
    expect(site.headline).toBe("Alpha Plumbing");
  });

  it("offers a switch only to the other languages the site is actually offered in", () => {
    expect(buildRenderableSite(source()).otherLocales).toEqual(["es"]);
    expect(
      buildRenderableSite(source({ profile: { ...source().profile, supportedLocales: ["en"] } }))
        .otherLocales,
    ).toEqual([]);
  });

  it("leaves out the blocks with nothing in them", () => {
    const bare = buildRenderableSite(
      source({
        content: null,
        profile: {
          ...source().profile,
          services: [],
          serviceArea: { zipCodes: [], cities: [] },
          googleReviewUrl: null,
          phone: null,
        },
      }),
    );
    // Everything that would have had to be invented is simply absent.
    expect(bare.blocks).toEqual(["hero", "contact_form", "footer"]);
    expect(bare.headline).toBe("Alpha Plumbing");
  });

  it("treats a service with no name in either language as no service", () => {
    const site = buildRenderableSite(
      source({ profile: { ...source().profile, services: [{ name: {} }] } }),
    );
    expect(site.services).toEqual([]);
    expect(site.blocks).not.toContain("services");
  });

  it("carries the owner's own words through unchanged", () => {
    const site = buildRenderableSite(source());
    expect(site.ctaText).toBe("Get a free quote");
    expect(site.serviceAreaNote).toBe("No travel fee inside Austin.");
    expect(site.whyChooseUs).toEqual(["Licensed and insured"]);
    expect(site.faq).toEqual([{ question: "Free quotes?", answer: "Yes." }]);
  });

  it("blanks a whitespace-only field instead of rendering an empty line", () => {
    const site = buildRenderableSite(
      source({ content: { ...source().content!, subheadline: "   ", ctaText: "" } }),
    );
    expect(site.subheadline).toBeNull();
    expect(site.ctaText).toBeNull();
  });
});

describe("serviceAreaLine", () => {
  it("puts the recognisable names first", () => {
    // A customer scans "Austin" and skims past five-digit numbers.
    expect(serviceAreaLine({ cities: ["Austin", "Round Rock"], zipCodes: ["78701"] })).toBe(
      "Austin, Round Rock, 78701",
    );
  });

  it("prints exactly what was entered, with nothing added", () => {
    // §19.8: "and surrounding areas" would be widening the area on the owner's
    // behalf, which is the invented-service-area failure.
    expect(serviceAreaLine({ cities: [], zipCodes: ["78701"] })).toBe("78701");
    expect(serviceAreaLine({ cities: [], zipCodes: [] })).toBe("");
  });
});

describe("theme", () => {
  it("has a palette for every approved preset and a layout for every template", () => {
    for (const preset of SITE_COLOR_PRESETS) {
      const palette = paletteFor(preset);
      expect(palette.band, preset).toBeTruthy();
      expect(palette.button, preset).toBeTruthy();
    }
    for (const template of SITE_TEMPLATES) {
      expect(layoutFor(template).heroTitle, template).toBeTruthy();
    }
  });

  it("writes class names out in full, never composed", () => {
    // Tailwind finds classes by scanning source text, so an interpolated class
    // is a class that exists in the source and not in the stylesheet — the page
    // would render colourless and nothing would fail loudly.
    for (const preset of SITE_COLOR_PRESETS) {
      for (const value of Object.values(paletteFor(preset))) {
        expect(value, `${preset}: ${value}`).not.toMatch(/\$\{|\bundefined\b/);
      }
    }
  });

  it("falls back rather than rendering an unstyled page for an unknown preset", () => {
    expect(paletteFor("chartreuse" as never)).toEqual(paletteFor("navy"));
    expect(layoutFor("bespoke" as never)).toEqual(layoutFor("classic"));
  });
});
