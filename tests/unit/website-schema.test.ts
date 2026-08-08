import { describe, expect, it } from "vitest";

import { OPTIONAL_BLOCKS } from "@/features/website/model";
import {
  MAX_ABOUT,
  MAX_FAQ_ITEMS,
  MAX_HEADLINE,
  MAX_WHY_ITEMS,
  parseSiteContentForm,
  parseSiteSettingsForm,
} from "@/features/website/schema";

const VALID_SETTINGS = {
  slug: "alpha-plumbing",
  template: "classic",
  color_preset: "navy",
  locales: ["en"],
  visible_blocks: [...OPTIONAL_BLOCKS],
};

describe("parseSiteSettingsForm", () => {
  it("accepts a complete submission", () => {
    const result = parseSiteSettingsForm(VALID_SETTINGS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("alpha-plumbing");
    expect(result.value.template).toBe("classic");
    expect(result.value.colorPreset).toBe("navy");
    expect(result.value.locales).toEqual(["en"]);
    expect(result.value.hiddenBlocks).toEqual([]);
  });

  it("lowercases and trims the address, since that is how it is stored", () => {
    const result = parseSiteSettingsForm({ ...VALID_SETTINGS, slug: "  Alpha-Plumbing  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.slug).toBe("alpha-plumbing");
  });

  it("carries the slug's own reason through to the field error", () => {
    expect(parseSiteSettingsForm({ ...VALID_SETTINGS, slug: "pro" })).toEqual({
      ok: false,
      errors: { slug: "reserved" },
    });
    expect(parseSiteSettingsForm({ ...VALID_SETTINGS, slug: "Alpha Plumbing" })).toEqual({
      ok: false,
      errors: { slug: "invalid_format" },
    });
    expect(parseSiteSettingsForm({ ...VALID_SETTINGS, slug: "" })).toEqual({
      ok: false,
      errors: { slug: "required" },
    });
  });

  it("refuses a template or colour that is not on the approved list (§19.9)", () => {
    expect(parseSiteSettingsForm({ ...VALID_SETTINGS, template: "bespoke" })).toEqual({
      ok: false,
      errors: { template: "invalid_choice" },
    });
    expect(parseSiteSettingsForm({ ...VALID_SETTINGS, color_preset: "#ff00aa" })).toEqual({
      ok: false,
      errors: { color_preset: "invalid_choice" },
    });
  });

  it("requires at least one language", () => {
    expect(parseSiteSettingsForm({ ...VALID_SETTINGS, locales: [] })).toEqual({
      ok: false,
      errors: { locales: "required" },
    });
  });

  it("orders the languages by the platform's list, not by the form's", () => {
    const result = parseSiteSettingsForm({ ...VALID_SETTINGS, locales: ["es", "en"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.locales).toEqual(["en", "es"]);
  });

  it("ignores languages the platform does not have", () => {
    const result = parseSiteSettingsForm({ ...VALID_SETTINGS, locales: ["en", "fr"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.locales).toEqual(["en"]);
  });

  it("stores the blocks that are off, derived from the registry", () => {
    const result = parseSiteSettingsForm({
      ...VALID_SETTINGS,
      visible_blocks: ["services", "about"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hiddenBlocks).not.toContain("services");
    expect(result.value.hiddenBlocks).not.toContain("about");
    expect(result.value.hiddenBlocks).toContain("faq");
    // Blocks that are not switchable never end up in the stored exceptions,
    // which is what keeps the gallery from arriving switched off for everyone
    // on the day photo upload ships.
    expect(result.value.hiddenBlocks).not.toContain("gallery");
    expect(result.value.hiddenBlocks).not.toContain("hero");
    expect(result.value.hiddenBlocks).not.toContain("footer");
  });

  it("cannot be made to hide a block that does not exist", () => {
    const result = parseSiteSettingsForm({
      ...VALID_SETTINGS,
      visible_blocks: ["services", "made_up_block"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hiddenBlocks).not.toContain("made_up_block");
  });

  it("treats no blocks submitted as all of them switched off", () => {
    // Which is what an ordinary form posts when every box is unchecked — the
    // reason the column stores the exceptions rather than the visible set.
    const result = parseSiteSettingsForm({ ...VALID_SETTINGS, visible_blocks: undefined });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hiddenBlocks).toEqual([...OPTIONAL_BLOCKS]);
  });
});

describe("parseSiteContentForm", () => {
  it("accepts an entirely empty draft", () => {
    // Half-written pages have to save, or the half that was written is lost.
    const result = parseSiteContentForm({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headline).toBeNull();
    expect(result.value.whyChooseUs).toEqual([]);
    expect(result.value.faq).toEqual([]);
  });

  it("turns blank fields into null rather than empty strings", () => {
    const result = parseSiteContentForm({ headline: "   ", about_text: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.headline).toBeNull();
    expect(result.value.aboutText).toBeNull();
  });

  it("reads one reason per line and drops the blank ones", () => {
    const result = parseSiteContentForm({
      why_choose_us: "Licensed and insured\n\n  Upfront pricing  \n",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.whyChooseUs).toEqual(["Licensed and insured", "Upfront pricing"]);
  });

  it("refuses more reasons than the block holds", () => {
    const result = parseSiteContentForm({
      why_choose_us: Array.from({ length: MAX_WHY_ITEMS + 1 }, (_, i) => `Reason ${i}`).join("\n"),
    });
    expect(result).toEqual({ ok: false, errors: { why_choose_us: "too_many" } });
  });

  it("refuses text longer than the template can lay out", () => {
    expect(parseSiteContentForm({ headline: "x".repeat(MAX_HEADLINE + 1) })).toEqual({
      ok: false,
      errors: { headline: "too_long" },
    });
    expect(parseSiteContentForm({ about_text: "x".repeat(MAX_ABOUT + 1) })).toEqual({
      ok: false,
      errors: { about_text: "too_long" },
    });
  });

  it("pairs each question with its own answer", () => {
    const result = parseSiteContentForm({
      faq_question: ["Do you charge for quotes?", "Are you insured?"],
      faq_answer: ["No.", "Yes, fully."],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.faq).toEqual([
      { question: "Do you charge for quotes?", answer: "No." },
      { question: "Are you insured?", answer: "Yes, fully." },
    ]);
  });

  it("drops rows nobody touched", () => {
    const result = parseSiteContentForm({
      faq_question: ["Are you insured?", "", "  "],
      faq_answer: ["Yes.", "", ""],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.faq).toHaveLength(1);
  });

  it("refuses half a row rather than publishing an unanswered question", () => {
    expect(
      parseSiteContentForm({ faq_question: ["Are you insured?"], faq_answer: [""] }),
    ).toEqual({ ok: false, errors: { faq: "required" } });
    expect(parseSiteContentForm({ faq_question: [""], faq_answer: ["Yes."] })).toEqual({
      ok: false,
      errors: { faq: "required" },
    });
  });

  it("does not let a cleared row inherit the next row's answer", () => {
    const result = parseSiteContentForm({
      faq_question: ["", "Are you insured?"],
      faq_answer: ["", "Yes."],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.faq).toEqual([{ question: "Are you insured?", answer: "Yes." }]);
  });

  it("refuses more questions than the block holds", () => {
    const count = MAX_FAQ_ITEMS + 1;
    const result = parseSiteContentForm({
      faq_question: Array.from({ length: count }, (_, i) => `Question ${i}`),
      faq_answer: Array.from({ length: count }, (_, i) => `Answer ${i}`),
    });
    expect(result).toEqual({ ok: false, errors: { faq: "too_many" } });
  });
});
