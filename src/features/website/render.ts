/**
 * Assembling a page out of the profile and the site's content (§19.4).
 *
 * Pure, and deliberately the only place that decides what a visitor sees. The
 * public route and the owner's preview both call it, which is the whole point:
 * a preview built by a second code path is a preview that eventually shows
 * something the published page does not (§19.10 asks for preview *before*
 * publish, which is only worth anything if the two agree).
 */

import { serviceLabel, type BusinessHours, type BusinessService, type ServiceArea } from "@/features/profile/model";
import type { Locale } from "@/lib/routes";

import { visibleBlocks, type SiteBlock, type SiteColorPreset, type SiteTemplate, type SiteTextContent } from "./model";

export interface RenderableSite {
  locale: Locale;
  slug: string;
  businessName: string;
  ownerName: string | null;
  template: SiteTemplate;
  colorPreset: SiteColorPreset;
  blocks: SiteBlock[];
  /** Languages other than this one the site is offered in (§19.5 switch). */
  otherLocales: Locale[];
  headline: string;
  subheadline: string | null;
  aboutText: string | null;
  ctaText: string | null;
  serviceAreaNote: string | null;
  whyChooseUs: string[];
  faq: { question: string; answer: string }[];
  /** Already resolved to this page's language. */
  services: string[];
  serviceArea: ServiceArea;
  hours: BusinessHours;
  phone: string | null;
  email: string | null;
  googleReviewUrl: string | null;
}

export interface SiteSource {
  locale: Locale;
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
    supportedLocales: string[];
  };
  content: SiteTextContent | null;
}

/**
 * Builds the page.
 *
 * The headline falls back to the business's own name rather than to a slogan
 * nobody wrote: §19.8 forbids inventing copy, and "Alpha Plumbing" at the top
 * of Alpha Plumbing's page is a fact, not a claim. Everything else that is
 * missing is simply absent — `visibleBlocks` has already dropped the sections
 * with nothing in them.
 */
export function buildRenderableSite(source: SiteSource): RenderableSite {
  const { locale, profile, content } = source;

  const services = profile.services
    .map((service) => serviceLabel(service, locale))
    .filter((label) => label !== "");

  const blocks = visibleBlocks(
    source.site,
    {
      displayName: profile.displayName,
      phone: profile.phone,
      email: profile.email,
      serviceCount: services.length,
      hasServiceArea:
        profile.serviceArea.zipCodes.length > 0 || profile.serviceArea.cities.length > 0,
      googleReviewUrl: profile.googleReviewUrl,
    },
    content,
  );

  const otherLocales = profile.supportedLocales.filter(
    (candidate): candidate is Locale => candidate !== locale && (candidate === "en" || candidate === "es"),
  );

  return {
    locale,
    slug: source.slug,
    businessName: profile.displayName,
    ownerName: profile.ownerName,
    template: source.site.template,
    colorPreset: source.site.colorPreset,
    blocks,
    otherLocales,
    headline: content?.headline?.trim() || profile.displayName,
    subheadline: nonEmpty(content?.subheadline),
    aboutText: nonEmpty(content?.aboutText),
    ctaText: nonEmpty(content?.ctaText),
    serviceAreaNote: nonEmpty(content?.serviceAreaNote),
    whyChooseUs: content?.whyChooseUs ?? [],
    faq: content?.faq ?? [],
    services,
    serviceArea: profile.serviceArea,
    hours: profile.businessHours,
    phone: profile.phone,
    email: profile.email,
    googleReviewUrl: profile.googleReviewUrl,
  };
}

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * The service area as one line of prose.
 *
 * Cities first, then ZIP codes: a customer recognises "Austin, Round Rock"
 * and scans past a list of five-digit numbers. Both are printed exactly as the
 * owner entered them — §19.8 forbids widening an area on their behalf, and
 * "and surrounding areas" would be exactly that.
 */
export function serviceAreaLine(area: ServiceArea): string {
  return [...area.cities, ...area.zipCodes].join(", ");
}
