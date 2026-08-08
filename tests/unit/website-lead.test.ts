import { describe, expect, it } from "vitest";

import {
  MAX_LEAD_DESCRIPTION,
  leadDescription,
  leadPhoneDigits,
  looksAutomated,
  parseLeadForm,
} from "@/features/website/lead-schema";

const LABELS = { preferredDate: "Preferred date", zip: "ZIP code" };

describe("parseLeadForm", () => {
  const valid = { name: "Dana Ruiz", phone: "(512) 555-0134", consent: "yes" };

  it("accepts a name, one way to reply, and the consent box", () => {
    const result = parseLeadForm(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Dana Ruiz");
    expect(result.value.phone).toBe("(512) 555-0134");
    expect(result.value.email).toBeNull();
  });

  it("requires a name", () => {
    expect(parseLeadForm({ ...valid, name: "   " })).toEqual({
      ok: false,
      errors: { name: "required" },
    });
  });

  it("requires some way to reply", () => {
    // A lead the owner cannot answer is not a lead.
    expect(parseLeadForm({ name: "Dana Ruiz", consent: "yes" })).toEqual({
      ok: false,
      errors: { phone: "required" },
    });
    expect(parseLeadForm({ name: "Dana Ruiz", email: "dana@example.test", consent: "yes" }).ok).toBe(
      true,
    );
  });

  it("treats an unticked consent box as a refusal (§19.7)", () => {
    expect(parseLeadForm({ ...valid, consent: "" })).toEqual({
      ok: false,
      errors: { consent: "required" },
    });
  });

  it("is loose about phone shapes and strict about nonsense", () => {
    // Somebody typing on a phone, not a validated A2P number.
    for (const phone of ["512-555-0134", "+1 512 555 0134", "5125550134"]) {
      expect(parseLeadForm({ ...valid, phone }).ok, phone).toBe(true);
    }
    expect(parseLeadForm({ ...valid, phone: "no" })).toEqual({
      ok: false,
      errors: { phone: "invalid_phone" },
    });
  });

  it("refuses an address nobody could reply to", () => {
    expect(parseLeadForm({ ...valid, email: "dana@" })).toEqual({
      ok: false,
      errors: { email: "invalid_email" },
    });
  });

  it("caps every field, because nobody is signed in to this form", () => {
    expect(parseLeadForm({ ...valid, description: "x".repeat(MAX_LEAD_DESCRIPTION + 1) })).toEqual({
      ok: false,
      errors: { description: "too_long" },
    });
    expect(parseLeadForm({ ...valid, name: "x".repeat(200) })).toEqual({
      ok: false,
      errors: { name: "too_long" },
    });
  });

  it("keeps everything optional that a hurried customer would skip", () => {
    const result = parseLeadForm(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.service).toBeNull();
    expect(result.value.zip).toBeNull();
    expect(result.value.description).toBeNull();
    expect(result.value.preferredDate).toBeNull();
  });

  it("ignores a date that is not a date, rather than refusing the lead", () => {
    const result = parseLeadForm({ ...valid, preferred_date: "next tuesday" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preferredDate).toBeNull();
  });

  it("falls back to English for a language it does not have", () => {
    const result = parseLeadForm({ ...valid, preferred_locale: "fr" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.preferredLocale).toBe("en");
    expect(parseLeadForm({ ...valid, preferred_locale: "es" }).ok).toBe(true);
  });
});

describe("looksAutomated", () => {
  it("is true only when the hidden field was filled", () => {
    expect(looksAutomated({})).toBe(false);
    expect(looksAutomated({ website: "" })).toBe(false);
    expect(looksAutomated({ website: "http://spam.example" })).toBe(true);
  });
});

describe("leadPhoneDigits", () => {
  it("reduces every way of writing a number to the same digits", () => {
    expect(leadPhoneDigits("(512) 555-0134")).toBe("5125550134");
    expect(leadPhoneDigits("+1 512 555 0134")).toBe("15125550134");
  });
});

describe("leadDescription", () => {
  it("puts the preferred date in the description, not in the schedule", () => {
    // A date a stranger typed is a request, not an appointment. In
    // `scheduled_start` it would land on the owner's calendar and in the
    // dashboard's "this week" count without anyone agreeing to it.
    const text = leadDescription(
      {
        name: "Dana",
        phone: null,
        email: null,
        preferredLocale: "en",
        service: null,
        zip: "78701",
        description: "Kitchen tap is dripping.",
        preferredDate: "2026-08-20",
      },
      LABELS,
    );
    expect(text).toContain("Kitchen tap is dripping.");
    expect(text).toContain("Preferred date: 2026-08-20");
    expect(text).toContain("ZIP code: 78701");
  });

  it("is empty when the customer wrote nothing extra", () => {
    expect(
      leadDescription(
        {
          name: "Dana",
          phone: null,
          email: null,
          preferredLocale: "en",
          service: null,
          zip: null,
          description: null,
          preferredDate: null,
        },
        LABELS,
      ),
    ).toBe("");
  });
});
