import { describe, expect, it } from "vitest";

import {
  MAX_SLUG_LENGTH,
  OPTIONAL_BLOCKS,
  RESERVED_SLUGS,
  SITE_BLOCKS,
  needsReview,
  siteBlockers,
  siteUrl,
  slugProblem,
  slugify,
  visibleBlocks,
  type SiteProfileFacts,
  type SiteTextContent,
} from "@/features/website/model";

/** A business with everything filled in; each test spoils the one part it is about. */
const COMPLETE_PROFILE: SiteProfileFacts = {
  displayName: "Alpha Plumbing",
  phone: "+1 555 010 1000",
  email: "hello@alpha.test",
  serviceCount: 4,
  hasServiceArea: true,
  googleReviewUrl: "https://g.page/r/alpha",
};

function content(overrides: Partial<SiteTextContent> = {}): SiteTextContent {
  return {
    locale: "en",
    headline: "Licensed plumbing, same-day service",
    subheadline: null,
    aboutText: "Family run since 2009.",
    ctaText: null,
    serviceAreaNote: null,
    whyChooseUs: ["Licensed and insured", "Upfront pricing"],
    faq: [{ question: "Do you charge for quotes?", answer: "No." }],
    aiGeneratedAt: null,
    reviewedAt: null,
    ...overrides,
  };
}

describe("slugify", () => {
  it("matches what app_private.slugify would produce", () => {
    expect(slugify("Alpha Plumbing & Heating")).toBe("alpha-plumbing-heating");
    expect(slugify("  Mixed   Spacing  ")).toBe("mixed-spacing");
    expect(slugify("A-1 Repairs")).toBe("a-1-repairs");
  });

  it("strips accents rather than replacing them with hyphens", () => {
    // The naive `[^a-z0-9]+ → -` gives "plomer-a", which is worse than nothing:
    // it looks deliberate.
    expect(slugify("Plomería Rápida")).toBe("plomeria-rapida");
    expect(slugify("Señor Fix")).toBe("senor-fix");
  });

  it("never produces a leading or trailing hyphen", () => {
    expect(slugify("!!! Bob's !!!")).toBe("bob-s");
    expect(slugify("---")).toBe("");
  });
});

describe("slugProblem", () => {
  it("accepts ordinary business addresses", () => {
    expect(slugProblem("alpha-plumbing")).toBeNull();
    expect(slugProblem("a1")).toBe("too_short");
    expect(slugProblem("abc")).toBeNull();
  });

  it("names the reason rather than a generic refusal", () => {
    expect(slugProblem("")).toBe("required");
    expect(slugProblem("   ")).toBe("required");
    expect(slugProblem("x".repeat(MAX_SLUG_LENGTH + 1))).toBe("too_long");
    expect(slugProblem("Alpha Plumbing")).toBe("invalid_format");
    expect(slugProblem("-alpha")).toBe("invalid_format");
    expect(slugProblem("alpha-")).toBe("invalid_format");
    expect(slugProblem("alpha--plumbing")).toBe("invalid_format");
  });

  it("refuses the reserved addresses", () => {
    for (const reserved of RESERVED_SLUGS) {
      // Only the ones long enough to reach the reserved check; the shorter
      // ones are refused earlier and just as firmly.
      if (reserved.length < 3) continue;
      expect(slugProblem(reserved), reserved).toBe("reserved");
    }
  });

  it("is case-insensitive, because the address is stored lowercase", () => {
    expect(slugProblem("ALPHA-PLUMBING")).toBeNull();
    expect(slugProblem("Admin")).toBe("reserved");
  });
});

describe("siteUrl", () => {
  it("builds the §19.6 address", () => {
    expect(siteUrl("https://handyalliance.com", "alpha-plumbing", "en")).toBe(
      "https://handyalliance.com/pro/alpha-plumbing/en",
    );
  });

  it("tolerates a trailing slash on the base", () => {
    expect(siteUrl("https://handyalliance.com/", "alpha", "es")).toBe(
      "https://handyalliance.com/pro/alpha/es",
    );
  });

  it("returns null rather than inventing a domain", () => {
    expect(siteUrl(null, "alpha", "en")).toBeNull();
    expect(siteUrl("https://handyalliance.com", "  ", "en")).toBeNull();
  });
});

describe("needsReview", () => {
  it("is false for text a person wrote", () => {
    expect(needsReview({ aiGeneratedAt: null, reviewedAt: null })).toBe(false);
  });

  it("is true for a machine draft nobody has confirmed", () => {
    expect(needsReview({ aiGeneratedAt: "2026-08-08T10:00:00Z", reviewedAt: null })).toBe(true);
  });

  it("is false once a person has saved it", () => {
    expect(
      needsReview({ aiGeneratedAt: "2026-08-08T10:00:00Z", reviewedAt: "2026-08-08T10:05:00Z" }),
    ).toBe(false);
  });

  it("becomes true again when the text is regenerated after being confirmed", () => {
    // The reason the column pair is two timestamps rather than a boolean: a
    // flag would still read "confirmed" here unless every regeneration
    // remembered to clear it.
    expect(
      needsReview({ aiGeneratedAt: "2026-08-08T11:00:00Z", reviewedAt: "2026-08-08T10:05:00Z" }),
    ).toBe(true);
  });
});

describe("visibleBlocks", () => {
  const allOn = { hiddenBlocks: [] as string[] };

  it("keeps every block a complete business can fill, except the gallery", () => {
    const blocks = visibleBlocks(allOn, COMPLETE_PROFILE, content());
    expect(blocks).toEqual(SITE_BLOCKS.filter((block) => block !== "gallery"));
  });

  it("drops blocks the owner switched off", () => {
    const blocks = visibleBlocks({ hiddenBlocks: ["faq", "reviews"] }, COMPLETE_PROFILE, content());
    expect(blocks).not.toContain("faq");
    expect(blocks).not.toContain("reviews");
    expect(blocks).toContain("services");
  });

  it("drops the reviews block when there is no review link (§19.8)", () => {
    const blocks = visibleBlocks(
      allOn,
      { ...COMPLETE_PROFILE, googleReviewUrl: null },
      content(),
    );
    expect(blocks).not.toContain("reviews");
  });

  it("drops the service area when none is set, rather than inventing one", () => {
    const blocks = visibleBlocks(allOn, { ...COMPLETE_PROFILE, hasServiceArea: false }, content());
    expect(blocks).not.toContain("service_area");
  });

  it("drops the call button when there is no phone number to call", () => {
    const blocks = visibleBlocks(allOn, { ...COMPLETE_PROFILE, phone: null }, content());
    expect(blocks).not.toContain("call_button");
  });

  it("drops the text blocks that have no text yet", () => {
    const blocks = visibleBlocks(
      allOn,
      COMPLETE_PROFILE,
      content({ aboutText: "   ", whyChooseUs: [], faq: [] }),
    );
    expect(blocks).not.toContain("about");
    expect(blocks).not.toContain("why_choose_us");
    expect(blocks).not.toContain("faq");
  });

  it("always keeps the three that are the page itself", () => {
    const blocks = visibleBlocks(
      { hiddenBlocks: [...OPTIONAL_BLOCKS] },
      { ...COMPLETE_PROFILE, phone: null, googleReviewUrl: null, serviceCount: 0 },
      null,
    );
    expect(blocks).toEqual(["hero", "footer"]);
  });
});

describe("siteBlockers", () => {
  const ready = {
    slug: "alpha-plumbing",
    locales: ["en"],
    profile: COMPLETE_PROFILE,
    content: [content()],
  };

  it("finds nothing wrong with a finished English site", () => {
    expect(siteBlockers(ready)).toEqual([]);
  });

  it("reports a missing or unusable address", () => {
    expect(siteBlockers({ ...ready, slug: null })).toContain("no_slug");
    expect(siteBlockers({ ...ready, slug: "admin" })).toContain("no_slug");
  });

  it("reports the profile facts a page cannot do without", () => {
    expect(siteBlockers({ ...ready, profile: { ...COMPLETE_PROFILE, phone: null } })).toContain(
      "no_phone",
    );
    expect(
      siteBlockers({ ...ready, profile: { ...COMPLETE_PROFILE, serviceCount: 0 } }),
    ).toContain("no_services");
    expect(siteBlockers({ ...ready, locales: [] })).toContain("no_locales");
  });

  it("requires a headline in every language the site claims to offer", () => {
    const bilingual = { ...ready, locales: ["en", "es"] };
    expect(siteBlockers(bilingual)).toContain("no_headline");

    const both = {
      ...bilingual,
      content: [content(), content({ locale: "es", headline: "Plomería con licencia" })],
    };
    expect(siteBlockers(both)).not.toContain("no_headline");
  });

  it("treats a blank headline as missing, not as written", () => {
    expect(siteBlockers({ ...ready, content: [content({ headline: "   " })] })).toContain(
      "no_headline",
    );
  });

  it("refuses to call an unchecked machine translation ready (§19.5)", () => {
    const drafted = {
      ...ready,
      locales: ["en", "es"],
      content: [
        content(),
        content({
          locale: "es",
          headline: "Plomería con licencia",
          aiGeneratedAt: "2026-08-08T10:00:00Z",
        }),
      ],
    };
    expect(siteBlockers(drafted)).toContain("translation_unreviewed");
  });

  it("ignores an unchecked translation in a language the site no longer offers", () => {
    // Dropping Spanish should not leave the English site permanently
    // unpublishable because of a Spanish draft nobody will ever see.
    const dropped = {
      ...ready,
      locales: ["en"],
      content: [
        content(),
        content({ locale: "es", headline: "…", aiGeneratedAt: "2026-08-08T10:00:00Z" }),
      ],
    };
    expect(siteBlockers(dropped)).toEqual([]);
  });
});
