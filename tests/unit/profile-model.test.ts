import { describe, expect, it } from "vitest";

import { TRADES } from "@/lib/config";
import {
  DAYS,
  SERVICE_PRESETS,
  hasAnyHours,
  isGoogleReviewUrl,
  isServiceAreaEmpty,
  isUsablePhone,
  isValidDayHours,
  normalizeZip,
  phoneDigits,
  presetsForTrade,
  profileGaps,
  serviceLabel,
  telHref,
} from "@/features/profile/model";

describe("serviceLabel", () => {
  it("prefers the page's language", () => {
    const service = { name: { en: "Drain cleaning", es: "Limpieza de desagües" } };
    expect(serviceLabel(service, "en")).toBe("Drain cleaning");
    expect(serviceLabel(service, "es")).toBe("Limpieza de desagües");
  });

  it("falls back rather than leaving a gap in the list", () => {
    // A blank bullet on someone's website is worse than a line in the other
    // language, which is at least true.
    expect(serviceLabel({ name: { en: "Leak repair" } }, "es")).toBe("Leak repair");
    expect(serviceLabel({ name: { es: "Plomería" } }, "en")).toBe("Plomería");
  });

  it("treats whitespace as absent", () => {
    expect(serviceLabel({ name: { en: "   ", es: "Plomería" } }, "en")).toBe("Plomería");
    expect(serviceLabel({ name: {} }, "en")).toBe("");
  });
});

describe("normalizeZip", () => {
  it("keeps the five digits people say", () => {
    expect(normalizeZip("78701")).toBe("78701");
    expect(normalizeZip(" 78701 ")).toBe("78701");
    expect(normalizeZip("78701-1234")).toBe("78701");
  });

  it("refuses anything that is not a ZIP", () => {
    expect(normalizeZip("7870")).toBeNull();
    expect(normalizeZip("787011")).toBeNull();
    expect(normalizeZip("ABCDE")).toBeNull();
    expect(normalizeZip("")).toBeNull();
  });
});

describe("phone", () => {
  it("accepts a US number however it is written", () => {
    expect(isUsablePhone("(512) 555-0134")).toBe(true);
    expect(isUsablePhone("512.555.0134")).toBe(true);
    expect(isUsablePhone("+1 512 555 0134")).toBe(true);
  });

  it("refuses a number nobody could dial", () => {
    expect(isUsablePhone("555-0134")).toBe(false);
    expect(isUsablePhone("+44 20 7946 0958")).toBe(false);
    expect(isUsablePhone("")).toBe(false);
  });

  it("builds a tel: link without rewriting how the owner wrote it", () => {
    expect(phoneDigits("(512) 555-0134")).toBe("5125550134");
    expect(telHref("(512) 555-0134")).toBe("tel:+15125550134");
    expect(telHref("+1 512 555 0134")).toBe("tel:+15125550134");
  });
});

describe("isGoogleReviewUrl", () => {
  it("accepts Google's own review addresses", () => {
    expect(isGoogleReviewUrl("https://g.page/r/CabcdEfgh/review")).toBe(true);
    expect(isGoogleReviewUrl("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isGoogleReviewUrl("https://search.google.com/local/writereview?placeid=x")).toBe(true);
  });

  it("refuses anything else, which is the point of the field", () => {
    // §19.8: the block that uses this says "Reviews" under the business's own
    // name. A field taking any URL would be a way to point that word anywhere.
    expect(isGoogleReviewUrl("https://example.com/fake-reviews")).toBe(false);
    expect(isGoogleReviewUrl("https://g.page.evil.com/r/x")).toBe(false);
    expect(isGoogleReviewUrl("http://g.page/r/x")).toBe(false);
    expect(isGoogleReviewUrl("javascript:alert(1)")).toBe(false);
    expect(isGoogleReviewUrl("not a url")).toBe(false);
  });
});

describe("isValidDayHours", () => {
  it("accepts an ordinary working day", () => {
    expect(isValidDayHours({ open: "08:00", close: "17:00" })).toBe(true);
    expect(isValidDayHours({ open: "00:00", close: "23:59" })).toBe(true);
  });

  it("refuses a range that closes before it opens", () => {
    // Not silently swapped: an overnight shift is a real thing, and guessing
    // which the owner meant would be wrong half the time.
    expect(isValidDayHours({ open: "17:00", close: "08:00" })).toBe(false);
    expect(isValidDayHours({ open: "09:00", close: "09:00" })).toBe(false);
  });

  it("refuses anything that is not a time of day", () => {
    expect(isValidDayHours({ open: "8am", close: "5pm" })).toBe(false);
    expect(isValidDayHours({ open: "24:00", close: "25:00" })).toBe(false);
    expect(isValidDayHours({ open: "", close: "" })).toBe(false);
  });
});

describe("hasAnyHours", () => {
  it("tells a closed day apart from a day nobody filled in", () => {
    // Both are falsy in a naive check, and only one of them is worth printing.
    expect(hasAnyHours({})).toBe(false);
    expect(hasAnyHours({ sun: null })).toBe(true);
    expect(hasAnyHours({ mon: { open: "08:00", close: "17:00" } })).toBe(true);
  });
});

describe("service presets (§10.2 step 4)", () => {
  it("covers every trade the platform offers", () => {
    for (const trade of TRADES) {
      expect(presetsForTrade(trade.code).length, trade.code).toBeGreaterThan(0);
    }
  });

  it("names every preset in both languages", () => {
    // A preset is the one case where the translation is genuinely known; the
    // owner's own wording is theirs to type.
    for (const [trade, services] of Object.entries(SERVICE_PRESETS)) {
      for (const service of services) {
        expect(service.name.en?.trim(), `${trade} en`).toBeTruthy();
        expect(service.name.es?.trim(), `${trade} es`).toBeTruthy();
      }
    }
  });

  it("offers nothing for a business that chose 'other'", () => {
    expect(presetsForTrade("other")).toEqual([]);
    expect(presetsForTrade("")).toEqual([]);
  });
});

describe("profileGaps", () => {
  const filled = {
    phone: "(512) 555-0134",
    email: "hello@alpha.test",
    services: [{ name: { en: "Drain cleaning" } }],
    serviceArea: { zipCodes: ["78701"], cities: [] },
    businessHours: { mon: { open: "08:00", close: "17:00" } },
  };

  it("finds nothing missing in a filled profile", () => {
    expect(profileGaps(filled)).toEqual([]);
  });

  it("names each blank one", () => {
    expect(profileGaps({ ...filled, phone: null })).toEqual(["no_phone"]);
    expect(profileGaps({ ...filled, phone: "   " })).toEqual(["no_phone"]);
    expect(profileGaps({ ...filled, email: null })).toEqual(["no_email"]);
    expect(profileGaps({ ...filled, services: [] })).toEqual(["no_services"]);
    expect(profileGaps({ ...filled, businessHours: {} })).toEqual(["no_hours"]);
  });

  it("treats an area with empty lists as no area at all", () => {
    // The shape `{zipCodes: [], cities: []}` is an object with keys, and a
    // reader that counted keys would call it "set" — switching on a Service
    // Area block with nothing in it (§19.8).
    expect(isServiceAreaEmpty({ zipCodes: [], cities: [] })).toBe(true);
    expect(profileGaps({ ...filled, serviceArea: { zipCodes: [], cities: [] } })).toEqual([
      "no_service_area",
    ]);
    expect(isServiceAreaEmpty({ zipCodes: [], cities: ["Austin"] })).toBe(false);
  });

  it("covers all seven days in week order", () => {
    expect(DAYS).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
  });
});
