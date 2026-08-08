/**
 * Business Website domain model (§19).
 *
 * Pure: which blocks a page has, which of them are worth rendering for a given
 * business, what a public address may be called, and what is still missing
 * before anyone should see it. All of that is decided by tests here rather than
 * by clicking through a form.
 *
 * The codes are stable identifiers; the words a user sees come from the
 * dictionaries (§9.2).
 */

/**
 * §19.4 verbatim, in render order.
 *
 * A fixed list is the product (§19.9): this is a template builder, not a web
 * studio, and "add a block" is a decision taken once for everybody rather than
 * per customer.
 */
export const SITE_BLOCKS = [
  "hero",
  "services",
  "why_choose_us",
  "about",
  "gallery",
  "reviews",
  "service_area",
  "faq",
  "contact_form",
  "call_button",
  "footer",
] as const;

export type SiteBlock = (typeof SITE_BLOCKS)[number];

/**
 * Blocks the owner may switch off, matching `business_sites_hidden_blocks_check`.
 *
 * Hero and Footer are not on the list: a page with no opening and no contact
 * details at the bottom is not one of the shapes this tool offers, and letting
 * someone build it would mostly produce sites that look broken.
 *
 * Gallery is off the list for a different reason. It has nothing to show until
 * photo upload exists, so `visibleBlocks` already drops it — but recording it
 * as *hidden* in the meantime would leave every site built before then switched
 * off on the day the photos arrive, and nobody would know to switch it back on.
 * A block that cannot yet be filled is not the same as a block someone refused.
 */
const UNSWITCHABLE_BLOCKS: readonly SiteBlock[] = ["hero", "gallery", "footer"];

export const OPTIONAL_BLOCKS: readonly SiteBlock[] = SITE_BLOCKS.filter(
  (block) => !UNSWITCHABLE_BLOCKS.includes(block),
);

export function isSiteBlock(value: string): value is SiteBlock {
  return (SITE_BLOCKS as readonly string[]).includes(value);
}

export function isOptionalBlock(value: string): value is SiteBlock {
  return (OPTIONAL_BLOCKS as readonly string[]).includes(value);
}

/** Layouts, matching `business_sites_template_check`. */
export const SITE_TEMPLATES = ["classic", "bold", "compact"] as const;
export type SiteTemplate = (typeof SITE_TEMPLATES)[number];

/**
 * The approved colour presets (§19.3), matching `business_sites_color_check`.
 *
 * A closed set rather than a colour picker, for the same reason as the
 * templates and for one more: every pair here has been chosen to keep text
 * legible against its background (§8.3), which a free picker cannot promise.
 */
export const SITE_COLOR_PRESETS = ["navy", "forest", "sunset", "slate", "brick"] as const;
export type SiteColorPreset = (typeof SITE_COLOR_PRESETS)[number];

export const SITE_STATUSES = ["draft", "published"] as const;
export type SiteStatus = (typeof SITE_STATUSES)[number];

export function isSiteTemplate(value: string): value is SiteTemplate {
  return (SITE_TEMPLATES as readonly string[]).includes(value);
}

export function isSiteColorPreset(value: string): value is SiteColorPreset {
  return (SITE_COLOR_PRESETS as readonly string[]).includes(value);
}

/**
 * Addresses that must not become a business slug (§19.6).
 *
 * `/pro/[slug]` is its own segment, so these are not currently reachable
 * collisions — they are reserved anyway because the spec allows moving to
 * `[slug].handyalliance.com` later, where every one of them *would* collide,
 * and a slug someone has already printed on a van is not a thing we can take
 * back.
 */
export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "api",
  "app",
  "auth",
  "blog",
  "contact",
  "de",
  "docs",
  "e",
  "en",
  "es",
  "help",
  "legal",
  "login",
  "mail",
  "onboarding",
  "pricing",
  "pro",
  "privacy",
  "settings",
  "sign-in",
  "sign-up",
  "static",
  "support",
  "terms",
  "tools",
  "www",
];

/** Long enough to be distinctive, short enough to say out loud on the phone. */
export const MIN_SLUG_LENGTH = 3;
export const MAX_SLUG_LENGTH = 63;

/**
 * A business name as a URL segment.
 *
 * Mirrors `app_private.slugify` so that a slug suggested here and a slug the
 * database would have produced are the same string — two spellings of "the
 * same" rule is how a suggestion starts failing its own validation.
 *
 * Accented letters are stripped rather than transliterated: `plomería` becomes
 * `plomer-a` under a naive replace, which is worse than `plomeria`, so the
 * string is normalised to NFD and its combining marks dropped first.
 */
export function slugify(source: string): string {
  const withoutAccents = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type SlugProblem = "required" | "too_short" | "too_long" | "invalid_format" | "reserved";

/**
 * Whether this is a usable public address, and if not, why.
 *
 * Uniqueness is deliberately not checked here: it is a fact about the database,
 * not about the string, and a pure function that pretended to know it would be
 * wrong the moment two people typed the same name at once. The unique index is
 * the authority; the caller turns its violation into the same kind of message.
 */
export function slugProblem(candidate: string): SlugProblem | null {
  const value = candidate.trim().toLowerCase();
  if (value === "") return "required";
  if (value.length < MIN_SLUG_LENGTH) return "too_short";
  if (value.length > MAX_SLUG_LENGTH) return "too_long";
  // Same shape as `business_profiles_website_slug_format`: lowercase, digits,
  // single hyphens between them, never leading or trailing.
  if (!/^[a-z0-9](-?[a-z0-9])*$/.test(value)) return "invalid_format";
  if (RESERVED_SLUGS.includes(value)) return "reserved";
  return null;
}

/** The public address of a site, given the deployment's base URL (§19.6). */
export function siteUrl(baseUrl: string | null, slug: string, locale: string): string | null {
  if (!baseUrl || slug.trim() === "") return null;
  return `${baseUrl.replace(/\/$/, "")}/pro/${slug}/${locale}`;
}

export interface SiteTextContent {
  locale: string;
  headline: string | null;
  subheadline: string | null;
  aboutText: string | null;
  ctaText: string | null;
  serviceAreaNote: string | null;
  whyChooseUs: string[];
  faq: { question: string; answer: string }[];
  aiGeneratedAt: string | null;
  reviewedAt: string | null;
}

/**
 * Whether this language is waiting for a person to confirm it (§19.5).
 *
 * Not a boolean column, because "confirmed, then regenerated" has to read as
 * unconfirmed again — which comparing the two timestamps gives for free, and a
 * flag would only give if every regeneration remembered to clear it.
 */
export function needsReview(content: Pick<SiteTextContent, "aiGeneratedAt" | "reviewedAt">): boolean {
  if (!content.aiGeneratedAt) return false;
  if (!content.reviewedAt) return true;
  return content.reviewedAt < content.aiGeneratedAt;
}

export interface SiteProfileFacts {
  displayName: string;
  phone: string | null;
  email: string | null;
  serviceCount: number;
  hasServiceArea: boolean;
  googleReviewUrl: string | null;
}

/**
 * Which blocks this site would actually render.
 *
 * Two filters, and they are different questions: the owner switched a block off
 * (`hiddenBlocks`), or there is nothing to put in it. The second matters more
 * than it sounds — §19.8 forbids invented reviews and invented service areas,
 * so a Reviews block with no review link is not an empty box to fill with
 * placeholder text, it is a block that must not appear.
 */
export function visibleBlocks(
  site: { hiddenBlocks: readonly string[] },
  profile: SiteProfileFacts,
  content: Pick<SiteTextContent, "aboutText" | "whyChooseUs" | "faq"> | null,
): SiteBlock[] {
  const hidden = new Set(site.hiddenBlocks);

  return SITE_BLOCKS.filter((block) => {
    if (hidden.has(block)) return false;
    switch (block) {
      case "services":
        return profile.serviceCount > 0;
      case "why_choose_us":
        return (content?.whyChooseUs.length ?? 0) > 0;
      case "about":
        return Boolean(content?.aboutText?.trim());
      // The bucket that fills it does not exist yet, so a gallery would be an
      // empty frame promising photos nobody uploaded.
      case "gallery":
        return false;
      case "reviews":
        return Boolean(profile.googleReviewUrl);
      case "service_area":
        return profile.hasServiceArea;
      case "faq":
        return (content?.faq.length ?? 0) > 0;
      case "call_button":
        return Boolean(profile.phone);
      default:
        // Hero, Contact Form and Footer are always there: they are the page.
        return true;
    }
  });
}

export type SiteBlocker =
  | "no_slug"
  | "no_headline"
  | "no_phone"
  | "no_services"
  | "no_locales"
  | "translation_unreviewed";

/**
 * What is missing before this site should be shown to anyone (§19.10).
 *
 * Deliberately not "is it valid": every one of these passes the schema. It is
 * the list of things that would make a published page embarrassing or useless —
 * an address nobody can reach it at, a hero with no sentence in it, a trade
 * site that names no services, a contractor with no phone number on a page
 * whose whole purpose is getting phoned.
 *
 * `translation_unreviewed` is the §19.5 rule and the one with teeth: a machine
 * translation of a licensed trade's promises is not something to put in front
 * of the public on the model's say-so.
 */
export function siteBlockers(input: {
  slug: string | null;
  locales: readonly string[];
  profile: SiteProfileFacts;
  content: readonly SiteTextContent[];
}): SiteBlocker[] {
  const blockers: SiteBlocker[] = [];

  if (!input.slug || slugProblem(input.slug) !== null) blockers.push("no_slug");
  if (input.locales.length === 0) blockers.push("no_locales");
  if (!input.profile.phone?.trim()) blockers.push("no_phone");
  if (input.profile.serviceCount === 0) blockers.push("no_services");

  // Every language the site claims to be offered in needs its own opening line;
  // one written language and one blank one is a half-built site, not a
  // bilingual one.
  const missingHeadline = input.locales.some((locale) => {
    const content = input.content.find((row) => row.locale === locale);
    return !content?.headline?.trim();
  });
  if (missingHeadline) blockers.push("no_headline");

  const unreviewed = input.content.some(
    (row) => input.locales.includes(row.locale) && needsReview(row),
  );
  if (unreviewed) blockers.push("translation_unreviewed");

  return blockers;
}
