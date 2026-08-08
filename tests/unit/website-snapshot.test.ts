import { describe, expect, it } from "vitest";

import {
  SNAPSHOT_FORMAT,
  buildSnapshot,
  parseSnapshot,
  renderableFromSnapshot,
  type SnapshotInput,
} from "@/features/website/snapshot";
import type { SiteTextContent } from "@/features/website/model";

function content(overrides: Partial<SiteTextContent> = {}): SiteTextContent {
  return {
    locale: "en",
    headline: "Licensed plumbing, same-day service",
    subheadline: null,
    aboutText: "Family run since 2009.",
    ctaText: null,
    serviceAreaNote: null,
    whyChooseUs: ["Licensed and insured"],
    faq: [{ question: "Free quotes?", answer: "Yes." }],
    aiGeneratedAt: null,
    reviewedAt: null,
    ...overrides,
  };
}

function input(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    slug: "alpha-plumbing",
    site: { template: "bold", colorPreset: "forest", hiddenBlocks: ["faq"] },
    profile: {
      displayName: "Alpha Plumbing",
      ownerName: "Dana Ruiz",
      phone: "(512) 555-0134",
      email: "hello@alpha.test",
      services: [{ name: { en: "Drain cleaning", es: "Limpieza de desagües" } }],
      serviceArea: { zipCodes: ["78701"], cities: ["Austin"] },
      businessHours: { mon: { open: "08:00", close: "17:00" } },
      googleReviewUrl: "https://g.page/r/alpha",
      supportedLocales: ["en", "es"],
    },
    content: [content(), content({ locale: "es", headline: "Plomería con licencia" })],
    ...overrides,
  };
}

describe("buildSnapshot", () => {
  it("freezes the whole site, every offered language at once", () => {
    const snapshot = buildSnapshot(input());
    expect(snapshot.format).toBe(SNAPSHOT_FORMAT);
    expect(snapshot.site.template).toBe("bold");
    expect(snapshot.profile.displayName).toBe("Alpha Plumbing");
    expect(Object.keys(snapshot.content).sort()).toEqual(["en", "es"]);
    expect(snapshot.content.es?.headline).toBe("Plomería con licencia");
  });

  it("drops content for languages the site is not offered in", () => {
    // A Spanish draft on an English-only site was never approved for
    // publication; storing it inside the published record would make it part of
    // what was published.
    const snapshot = buildSnapshot(
      input({ profile: { ...input().profile, supportedLocales: ["en"] } }),
    );
    expect(Object.keys(snapshot.content)).toEqual(["en"]);
  });
});

describe("parseSnapshot", () => {
  it("round-trips what buildSnapshot wrote", () => {
    const snapshot = buildSnapshot(input());
    const parsed = parseSnapshot(JSON.parse(JSON.stringify(snapshot)));
    expect(parsed).not.toBeNull();
    expect(parsed?.site).toEqual(snapshot.site);
    expect(parsed?.profile.services).toEqual(snapshot.profile.services);
    expect(parsed?.profile.serviceArea).toEqual(snapshot.profile.serviceArea);
    expect(parsed?.content.es?.headline).toBe("Plomería con licencia");
  });

  it("returns null only when there is no page to render at all", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("published")).toBeNull();
    expect(parseSnapshot([])).toBeNull();
    expect(parseSnapshot({})).toBeNull();
    expect(parseSnapshot({ profile: { displayName: "   " } })).toBeNull();
  });

  it("degrades a damaged snapshot instead of taking the site down", () => {
    // A snapshot outlives the code that wrote it. Everything unusable becomes
    // absent, and the renderer already drops blocks with nothing in them.
    const parsed = parseSnapshot({
      profile: {
        displayName: "Alpha Plumbing",
        services: "drain cleaning",
        serviceArea: [],
        businessHours: "closed",
        supportedLocales: ["en", "fr"],
      },
      site: { template: "bespoke", colorPreset: "#ff00aa", hiddenBlocks: "faq" },
      content: { en: { headline: 42, faq: [{ question: "q" }] } },
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.site.template).toBe("classic");
    expect(parsed?.site.colorPreset).toBe("navy");
    expect(parsed?.site.hiddenBlocks).toEqual([]);
    expect(parsed?.profile.services).toEqual([]);
    expect(parsed?.profile.serviceArea).toEqual({ zipCodes: [], cities: [] });
    expect(parsed?.profile.businessHours).toEqual({});
    expect(parsed?.profile.supportedLocales).toEqual(["en"]);
    expect(parsed?.content.en?.headline).toBeNull();
    expect(parsed?.content.en?.faq).toEqual([]);
  });

  it("keeps a closed day, which is not the same as an unusable one", () => {
    const parsed = parseSnapshot({
      profile: { displayName: "Alpha", businessHours: { sun: null, mon: { open: "08:00", close: "17:00" } } },
    });
    expect(parsed?.profile.businessHours).toEqual({
      sun: null,
      mon: { open: "08:00", close: "17:00" },
    });
  });
});

describe("renderableFromSnapshot", () => {
  it("renders the language asked for", () => {
    const snapshot = buildSnapshot(input());
    const es = renderableFromSnapshot(snapshot, "es", "alpha-plumbing");
    expect(es?.headline).toBe("Plomería con licencia");
    expect(es?.services).toEqual(["Limpieza de desagües"]);
    expect(es?.otherLocales).toEqual(["en"]);
  });

  it("refuses a language the version was not published in", () => {
    // The route turns this into the same 404 as an unknown address, so a
    // visitor cannot learn that a Spanish page exists but is not offered here.
    const snapshot = buildSnapshot(
      input({ profile: { ...input().profile, supportedLocales: ["en"] } }),
    );
    expect(renderableFromSnapshot(snapshot, "es", "alpha-plumbing")).toBeNull();
  });

  it("serves the address it is being served at, not the one in the snapshot", () => {
    // The slug is a live fact — unique across the platform and changeable —
    // while the snapshot is frozen. The page has to know where it actually is.
    const snapshot = buildSnapshot(input());
    expect(renderableFromSnapshot(snapshot, "en", "renamed-plumbing")?.slug).toBe(
      "renamed-plumbing",
    );
  });

  it("still honours the hidden blocks the version was published with", () => {
    const snapshot = buildSnapshot(input());
    const page = renderableFromSnapshot(snapshot, "en", "alpha-plumbing");
    expect(page?.blocks).not.toContain("faq");
    expect(page?.blocks).toContain("services");
  });
});
