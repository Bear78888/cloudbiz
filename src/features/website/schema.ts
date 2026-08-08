/**
 * Business Website form parsing (§19.3, §19.4) — pure, so the same rules serve
 * the settings screen, the server action and, later, the AI translation draft
 * that has to be checked before it becomes a page.
 *
 * Two parsers rather than one, because the screen has two forms and they are
 * genuinely different decisions: what the site *is* (address, template, colour,
 * languages, which blocks exist) and what one language of it *says*. Editing a
 * Spanish paragraph should not require re-submitting the site's address, and
 * changing the colour should not risk overwriting text in a language the form
 * did not have on screen.
 *
 * Errors are codes, never sentences: the caller looks them up in the dictionary
 * of the current locale (§9.2).
 */

import { LOCALES, type Locale } from "@/lib/routes";

import {
  OPTIONAL_BLOCKS,
  isSiteColorPreset,
  isSiteTemplate,
  slugProblem,
  type SiteColorPreset,
  type SiteTemplate,
} from "./model";

export type SiteFieldErrorCode =
  | "required"
  | "too_long"
  | "too_short"
  | "invalid_choice"
  | "invalid_format"
  | "reserved"
  | "taken"
  | "too_many";

export type SiteSettingsField = "slug" | "template" | "color_preset" | "locales";

export type SiteContentField =
  | "headline"
  | "subheadline"
  | "about_text"
  | "cta_text"
  | "service_area_note"
  | "why_choose_us"
  | "faq";

export type SiteSettingsErrors = Partial<Record<SiteSettingsField, SiteFieldErrorCode>>;
export type SiteContentErrors = Partial<Record<SiteContentField, SiteFieldErrorCode>>;

/**
 * Ceilings on the content.
 *
 * These are not database constraints looking for a home — they are what fits in
 * a template (§19.9). A "Why Choose Us" block with thirty reasons is not a
 * longer version of the block, it is a different page that this tool does not
 * build.
 */
export const MAX_HEADLINE = 120;
export const MAX_SUBHEADLINE = 200;
export const MAX_CTA = 60;
export const MAX_ABOUT = 4000;
export const MAX_SERVICE_AREA_NOTE = 500;
export const MAX_WHY_ITEMS = 8;
export const MAX_WHY_ITEM_LENGTH = 200;
export const MAX_FAQ_ITEMS = 12;
export const MAX_FAQ_QUESTION = 200;
export const MAX_FAQ_ANSWER = 1000;

export interface SiteSettingsInput {
  slug: string;
  template: SiteTemplate;
  colorPreset: SiteColorPreset;
  /** In `LOCALES` order, deduplicated — this is what the site is offered in (§19.5). */
  locales: Locale[];
  /** Optional blocks the owner switched off; already known to be switchable. */
  hiddenBlocks: string[];
}

export interface SiteContentInput {
  headline: string | null;
  subheadline: string | null;
  aboutText: string | null;
  ctaText: string | null;
  serviceAreaNote: string | null;
  whyChooseUs: string[];
  faq: { question: string; answer: string }[];
}

export type SiteSettingsResult =
  | { ok: true; value: SiteSettingsInput }
  | { ok: false; errors: SiteSettingsErrors };

export type SiteContentResult =
  | { ok: true; value: SiteContentInput }
  | { ok: false; errors: SiteContentErrors };

function text(raw: string | undefined | null): string {
  return (raw ?? "").trim();
}

function optionalText(raw: string | undefined | null): string | null {
  const value = text(raw);
  return value === "" ? null : value;
}

export interface RawSiteSettingsForm {
  slug?: string;
  template?: string;
  color_preset?: string;
  /** The languages the owner ticked. */
  locales?: string[];
  /** The optional blocks the owner left ticked — i.e. the ones to *show*. */
  visible_blocks?: string[];
}

/**
 * Validates the site's settings.
 *
 * The form posts the blocks that are *on* and this returns the ones that are
 * off, because that is how an unchecked checkbox works: it posts nothing. If
 * the column stored the visible set instead, a block added to the product later
 * would arrive switched off for every existing site, and nobody would know to
 * go and switch it on.
 */
export function parseSiteSettingsForm(raw: RawSiteSettingsForm): SiteSettingsResult {
  const errors: SiteSettingsErrors = {};

  const slug = text(raw.slug).toLowerCase();
  // Every `SlugProblem` is also a field error code, so the reason survives all
  // the way to the sentence the owner reads instead of collapsing to "invalid".
  const slugIssue = slugProblem(slug);
  if (slugIssue) errors.slug = slugIssue;

  const template = text(raw.template);
  if (!isSiteTemplate(template)) errors.template = "invalid_choice";

  const colorPreset = text(raw.color_preset);
  if (!isSiteColorPreset(colorPreset)) errors.color_preset = "invalid_choice";

  // Order comes from `LOCALES`, not from the form: the checkbox order in the
  // markup is a rendering detail, and `supported_locales` is compared as an
  // array elsewhere.
  const submitted = new Set((raw.locales ?? []).map((value) => text(value)));
  const locales = LOCALES.filter((locale) => submitted.has(locale));
  if (locales.length === 0) errors.locales = "required";

  // Anything unrecognised in the submission is simply not a block, so it can
  // neither switch one on nor switch one off: the answer is derived from the
  // registry, never from what arrived.
  const visible = new Set((raw.visible_blocks ?? []).map((value) => text(value)));
  const hiddenBlocks = OPTIONAL_BLOCKS.filter((block) => !visible.has(block));

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      slug,
      template: template as SiteTemplate,
      colorPreset: colorPreset as SiteColorPreset,
      locales: [...locales],
      hiddenBlocks: [...hiddenBlocks],
    },
  };
}

export interface RawSiteContentForm {
  headline?: string;
  subheadline?: string;
  about_text?: string;
  cta_text?: string;
  service_area_note?: string;
  /** One reason per line, which is how someone types a list into a box. */
  why_choose_us?: string;
  faq_question?: string[];
  faq_answer?: string[];
}

/**
 * Validates one language of the site's content.
 *
 * Blank is allowed almost everywhere: this is a draft the owner fills in over
 * several sittings, and refusing to save a half-written page would mean losing
 * the half that was written. What blank costs is publication — `siteBlockers`
 * is where a missing headline stops being fine.
 */
export function parseSiteContentForm(raw: RawSiteContentForm): SiteContentResult {
  const errors: SiteContentErrors = {};

  const headline = optionalText(raw.headline);
  if (headline && headline.length > MAX_HEADLINE) errors.headline = "too_long";

  const subheadline = optionalText(raw.subheadline);
  if (subheadline && subheadline.length > MAX_SUBHEADLINE) errors.subheadline = "too_long";

  const aboutText = optionalText(raw.about_text);
  if (aboutText && aboutText.length > MAX_ABOUT) errors.about_text = "too_long";

  const ctaText = optionalText(raw.cta_text);
  if (ctaText && ctaText.length > MAX_CTA) errors.cta_text = "too_long";

  const serviceAreaNote = optionalText(raw.service_area_note);
  if (serviceAreaNote && serviceAreaNote.length > MAX_SERVICE_AREA_NOTE) {
    errors.service_area_note = "too_long";
  }

  // Empty lines are dropped rather than rejected: a trailing newline is what a
  // textarea does, not something the user meant.
  const whyChooseUs = (raw.why_choose_us ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (whyChooseUs.length > MAX_WHY_ITEMS) errors.why_choose_us = "too_many";
  else if (whyChooseUs.some((line) => line.length > MAX_WHY_ITEM_LENGTH)) {
    errors.why_choose_us = "too_long";
  }

  // Question and answer arrive as parallel arrays, one entry per row. Reading
  // them by index keeps a row's two halves together; a question whose answer
  // was cleared must not silently inherit the next row's answer.
  const questions = raw.faq_question ?? [];
  const answers = raw.faq_answer ?? [];
  const faq: { question: string; answer: string }[] = [];
  for (let index = 0; index < questions.length; index += 1) {
    const question = text(questions[index]);
    const answer = text(answers[index]);
    // A row is started when either half has something in it. Half a row is a
    // mistake worth naming rather than silently discarding — a question with no
    // answer would render as a question nobody answered.
    if (question === "" && answer === "") continue;
    if (question === "" || answer === "") {
      errors.faq ??= "required";
      continue;
    }
    if (question.length > MAX_FAQ_QUESTION || answer.length > MAX_FAQ_ANSWER) {
      errors.faq ??= "too_long";
      continue;
    }
    faq.push({ question, answer });
  }
  if (faq.length > MAX_FAQ_ITEMS) errors.faq = "too_many";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: { headline, subheadline, aboutText, ctaText, serviceAreaNote, whyChooseUs, faq },
  };
}
