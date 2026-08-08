/**
 * What a published version actually contains (§19.10).
 *
 * Pure. A snapshot is the whole site as it stood when Publish was pressed:
 * settings, the profile facts the page renders, and every language's content.
 * Not a diff and not a pointer at the live rows — the point of publishing is
 * that what the public reads stops changing when the owner starts editing
 * again. With live rows, half-written wording is on the internet the moment it
 * is typed, and there would be nothing for "roll back" to roll back to.
 *
 * Reading is defensive throughout. A snapshot written by an older version of
 * this code is still expected to render, and a malformed one must not take the
 * business's website down for everyone.
 */

import {
  type BusinessHours,
  type BusinessService,
  type ServiceArea,
} from "@/features/profile/model";
import { LOCALES, type Locale } from "@/lib/routes";

import {
  isSiteColorPreset,
  isSiteTemplate,
  type SiteColorPreset,
  type SiteTemplate,
  type SiteTextContent,
} from "./model";
import { buildRenderableSite, type RenderableSite } from "./render";

/** Bumped only when the shape changes in a way old readers cannot handle. */
export const SNAPSHOT_FORMAT = 1;

export interface SiteSnapshot {
  format: number;
  slug: string;
  site: {
    template: SiteTemplate;
    colorPreset: SiteColorPreset;
    hiddenBlocks: string[];
  };
  profile: {
    displayName: string;
    ownerName: string | null;
    phone: string | null;
    email: string | null;
    services: BusinessService[];
    serviceArea: ServiceArea;
    businessHours: BusinessHours;
    googleReviewUrl: string | null;
    supportedLocales: Locale[];
  };
  /** Keyed by locale. Only the languages the site was offered in. */
  content: Partial<Record<Locale, SiteTextContent>>;
}

export interface SnapshotInput {
  slug: string;
  site: SiteSnapshot["site"];
  profile: SiteSnapshot["profile"];
  content: readonly SiteTextContent[];
}

/**
 * Freezes the current draft into a version.
 *
 * Content for languages the site is not offered in is dropped rather than
 * carried: a Spanish draft on an English-only site is not part of what was
 * published, and storing it would put text the owner never approved for
 * publication inside the published record.
 */
export function buildSnapshot(input: SnapshotInput): SiteSnapshot {
  const content: Partial<Record<Locale, SiteTextContent>> = {};
  for (const locale of input.profile.supportedLocales) {
    const row = input.content.find((entry) => entry.locale === locale);
    if (row) content[locale] = { ...row, locale };
  }

  return {
    format: SNAPSHOT_FORMAT,
    slug: input.slug,
    site: input.site,
    profile: input.profile,
    content,
  };
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function services(value: unknown): BusinessService[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const name = (entry as Record<string, unknown>).name;
    if (name === null || typeof name !== "object") return [];
    const record = name as Record<string, unknown>;
    const built: BusinessService = { name: {} };
    if (typeof record.en === "string") built.name.en = record.en;
    if (typeof record.es === "string") built.name.es = record.es;
    return built.name.en || built.name.es ? [built] : [];
  });
}

function serviceArea(value: unknown): ServiceArea {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { zipCodes: [], cities: [] };
  }
  const record = value as Record<string, unknown>;
  return { zipCodes: strings(record.zipCodes), cities: strings(record.cities) };
}

function businessHours(value: unknown): BusinessHours {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const hours: BusinessHours = {};
  for (const [day, entry] of Object.entries(record)) {
    if (entry === null) {
      hours[day as keyof BusinessHours] = null;
      continue;
    }
    if (entry === null || typeof entry !== "object") continue;
    const shape = entry as Record<string, unknown>;
    if (typeof shape.open !== "string" || typeof shape.close !== "string") continue;
    hours[day as keyof BusinessHours] = { open: shape.open, close: shape.close };
  }
  return hours;
}

function contentEntry(locale: Locale, value: unknown): SiteTextContent | null {
  if (value === null || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    locale,
    headline: str(record.headline),
    subheadline: str(record.subheadline),
    aboutText: str(record.aboutText),
    ctaText: str(record.ctaText),
    serviceAreaNote: str(record.serviceAreaNote),
    whyChooseUs: strings(record.whyChooseUs),
    faq: Array.isArray(record.faq)
      ? record.faq.flatMap((entry) => {
          if (entry === null || typeof entry !== "object") return [];
          const faq = entry as Record<string, unknown>;
          if (typeof faq.question !== "string" || typeof faq.answer !== "string") return [];
          return [{ question: faq.question, answer: faq.answer }];
        })
      : [],
    aiGeneratedAt: typeof record.aiGeneratedAt === "string" ? record.aiGeneratedAt : null,
    reviewedAt: typeof record.reviewedAt === "string" ? record.reviewedAt : null,
  };
}

/**
 * Reads a stored snapshot back.
 *
 * Returns null only when there is nothing usable at all — no business name
 * means no page. Everything else degrades to absent, which the renderer already
 * knows how to handle: a block with nothing in it does not appear (§19.8).
 */
export function parseSnapshot(value: unknown): SiteSnapshot | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;

  const siteRecord = (record.site ?? {}) as Record<string, unknown>;
  const profileRecord = (record.profile ?? {}) as Record<string, unknown>;

  const displayName = str(profileRecord.displayName);
  if (!displayName) return null;

  const template = String(siteRecord.template ?? "");
  const colorPreset = String(siteRecord.colorPreset ?? "");

  const supportedLocales = LOCALES.filter((locale) =>
    strings(profileRecord.supportedLocales).includes(locale),
  );

  const contentRecord = (record.content ?? {}) as Record<string, unknown>;
  const content: Partial<Record<Locale, SiteTextContent>> = {};
  for (const locale of supportedLocales) {
    const entry = contentEntry(locale, contentRecord[locale]);
    if (entry) content[locale] = entry;
  }

  return {
    format: typeof record.format === "number" ? record.format : 0,
    slug: str(record.slug) ?? "",
    site: {
      // An unknown template or colour falls back rather than rendering an
      // unstyled page: a snapshot outlives the code that wrote it.
      template: isSiteTemplate(template) ? template : "classic",
      colorPreset: isSiteColorPreset(colorPreset) ? colorPreset : "navy",
      hiddenBlocks: strings(siteRecord.hiddenBlocks),
    },
    profile: {
      displayName,
      ownerName: str(profileRecord.ownerName),
      phone: str(profileRecord.phone),
      email: str(profileRecord.email),
      services: services(profileRecord.services),
      serviceArea: serviceArea(profileRecord.serviceArea),
      businessHours: businessHours(profileRecord.businessHours),
      googleReviewUrl: str(profileRecord.googleReviewUrl),
      supportedLocales: supportedLocales.length > 0 ? [...supportedLocales] : ["en"],
    },
    content,
  };
}

/**
 * The page for one language of a published version.
 *
 * Returns null when the site was not published in this language — which the
 * route turns into the same 404 as an unknown address, so a visitor cannot
 * learn that a Spanish page exists somewhere but is not offered here.
 */
export function renderableFromSnapshot(
  snapshot: SiteSnapshot,
  locale: Locale,
  /** The address it is being served at, which is a live fact, not a stored one. */
  slug: string,
): RenderableSite | null {
  if (!snapshot.profile.supportedLocales.includes(locale)) return null;

  return buildRenderableSite({
    locale,
    slug,
    site: snapshot.site,
    profile: snapshot.profile,
    content: snapshot.content[locale] ?? null,
  });
}
