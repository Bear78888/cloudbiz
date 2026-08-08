import { describe, expect, it } from "vitest";

import { parseProfileForm } from "@/features/profile/schema";
import {
  parseBusinessHours,
  parseServiceArea,
  parseServices,
} from "@/features/profile/service";

describe("parseProfileForm", () => {
  it("accepts an entirely empty profile", () => {
    // A screen filled in over several sittings has to save half-finished, or
    // the finished half is lost.
    const result = parseProfileForm({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phone).toBeNull();
    expect(result.value.services).toEqual([]);
    expect(result.value.serviceArea).toEqual({ zipCodes: [], cities: [] });
  });

  it("keeps the phone number exactly as it was typed", () => {
    const result = parseProfileForm({ phone: " (512) 555-0134 " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phone).toBe("(512) 555-0134");
  });

  it("refuses a number nobody could dial and an address nobody could mail", () => {
    expect(parseProfileForm({ phone: "555-0134" })).toEqual({
      ok: false,
      errors: { phone: "invalid_phone" },
    });
    expect(parseProfileForm({ email: "hello@" })).toEqual({
      ok: false,
      errors: { email: "invalid_email" },
    });
  });

  it("reads a list typed either way and drops duplicates", () => {
    const result = parseProfileForm({
      zip_codes: "78701, 78702\n78701",
      cities: "Austin\nRound Rock, Austin",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.serviceArea.zipCodes).toEqual(["78701", "78702"]);
    expect(result.value.serviceArea.cities).toEqual(["Austin", "Round Rock"]);
  });

  it("normalises ZIP+4 and refuses anything that is not a ZIP", () => {
    const ok = parseProfileForm({ zip_codes: "78701-1234" });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.value.serviceArea.zipCodes).toEqual(["78701"]);

    expect(parseProfileForm({ zip_codes: "78701, nope" })).toEqual({
      ok: false,
      errors: { zip_codes: "invalid_zip" },
    });
  });

  it("closes a day that was unticked, even though its time inputs still posted", () => {
    // The browser keeps sending whatever sits in the two boxes; unticking
    // Sunday has to close Sunday regardless.
    const result = parseProfileForm({
      open_days: ["mon"],
      hours: {
        mon: { open: "08:00", close: "17:00" },
        sun: { open: "10:00", close: "14:00" },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.businessHours.mon).toEqual({ open: "08:00", close: "17:00" });
    expect(result.value.businessHours.sun).toBeNull();
  });

  it("refuses a day that closes before it opens", () => {
    expect(
      parseProfileForm({ open_days: ["tue"], hours: { tue: { open: "17:00", close: "08:00" } } }),
    ).toEqual({ ok: false, errors: { hours: "invalid_hours" } });
  });

  it("pairs each service's two names and drops untouched rows", () => {
    const result = parseProfileForm({
      service_name_en: ["Drain cleaning", "", "Leak repair"],
      service_name_es: ["Limpieza de desagües", "", ""],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.services).toEqual([
      { name: { en: "Drain cleaning", es: "Limpieza de desagües" } },
      { name: { en: "Leak repair" } },
    ]);
  });

  it("keeps a service named only in Spanish", () => {
    const result = parseProfileForm({ service_name_en: [""], service_name_es: ["Plomería"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.services).toEqual([{ name: { es: "Plomería" } }]);
  });

  it("does not let a cleared row inherit the next row's name", () => {
    const result = parseProfileForm({
      service_name_en: ["", "Leak repair"],
      service_name_es: ["", "Reparación de fugas"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.services).toEqual([
      { name: { en: "Leak repair", es: "Reparación de fugas" } },
    ]);
  });

  it("accepts only a Google address as the review link (§19.8)", () => {
    expect(parseProfileForm({ google_review_url: "https://example.com/reviews" })).toEqual({
      ok: false,
      errors: { google_review_url: "invalid_url" },
    });
    const ok = parseProfileForm({ google_review_url: "https://g.page/r/CabcdEfgh/review" });
    expect(ok.ok).toBe(true);
  });
});

/**
 * The jsonb columns predate any writer, so anything already stored is of
 * unknown shape. These parsers are what stands between that and a public page.
 */
describe("stored jsonb is read defensively", () => {
  it("drops service entries that are not services", () => {
    expect(parseServices(null)).toEqual([]);
    expect(parseServices("Drain cleaning")).toEqual([]);
    expect(parseServices([{ name: "Drain cleaning" }])).toEqual([]);
    expect(parseServices([{ name: { en: 42 } }])).toEqual([]);
    expect(parseServices([{ name: { en: "   " } }])).toEqual([]);
    expect(parseServices([{ name: { en: "Drain cleaning" } }, null, 7])).toEqual([
      { name: { en: "Drain cleaning" } },
    ]);
  });

  it("reads a service area and ignores a malformed one", () => {
    expect(parseServiceArea({ zipCodes: ["78701"], cities: ["Austin"] })).toEqual({
      zipCodes: ["78701"],
      cities: ["Austin"],
    });
    expect(parseServiceArea({})).toEqual({ zipCodes: [], cities: [] });
    expect(parseServiceArea([])).toEqual({ zipCodes: [], cities: [] });
    expect(parseServiceArea({ zipCodes: "78701" })).toEqual({ zipCodes: [], cities: [] });
    expect(parseServiceArea({ zipCodes: ["78701", 78702, ""] })).toEqual({
      zipCodes: ["78701"],
      cities: [],
    });
  });

  it("keeps a closed day and drops hours that no longer validate", () => {
    expect(parseBusinessHours({ sun: null })).toEqual({ sun: null });
    expect(parseBusinessHours({ mon: { open: "08:00", close: "17:00" } })).toEqual({
      mon: { open: "08:00", close: "17:00" },
    });
    // Otherwise the site would advertise "9:00–8:00" to everyone who visits.
    expect(parseBusinessHours({ mon: { open: "17:00", close: "08:00" } })).toEqual({});
    expect(parseBusinessHours({ mon: { open: "8am", close: "5pm" } })).toEqual({});
    expect(parseBusinessHours({ notaday: { open: "08:00", close: "17:00" } })).toEqual({});
    expect(parseBusinessHours("closed")).toEqual({});
  });
});
