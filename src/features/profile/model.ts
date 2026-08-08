/**
 * Business profile domain model (§10.2 steps 3–5, §25.1).
 *
 * `business_profiles` has carried these columns since the platform foundation,
 * and until now nothing wrote a single one of them. That is why this file
 * exists: the jsonb columns had no defined shape, so "what is in `services`"
 * was answered by whoever read it next. Here it is answered once.
 *
 * The site renders from these facts (§19.10), the estimate maker will price
 * from them, and §19.8 forbids inventing any of them — so every value here is
 * something a person typed about their own business.
 */

import type { Locale } from "@/lib/routes";
import type { TradeCode } from "@/lib/config";

/**
 * A service, named in each language the business works in.
 *
 * Language-keyed rather than a plain string, because a bilingual site (§19.5)
 * has to list "Drain cleaning" on the English page and "Limpieza de desagües"
 * on the Spanish one, and a single string would put one of those in front of
 * the wrong customer. Both keys are optional: a business that works in one
 * language fills one, and the renderer falls back rather than showing a blank
 * line.
 */
export interface ServiceName {
  en?: string;
  es?: string;
}

export interface BusinessService {
  name: ServiceName;
}

/** The name to show, given the page's language. */
export function serviceLabel(service: BusinessService, locale: Locale): string {
  const preferred = service.name[locale];
  if (preferred && preferred.trim() !== "") return preferred.trim();
  // Falling back is better than a gap in a list: the customer reads a service
  // in the other language, which is at least true, instead of an empty bullet.
  const fallback = locale === "en" ? service.name.es : service.name.en;
  return (fallback ?? "").trim();
}

export function hasServiceName(service: BusinessService): boolean {
  return serviceLabel(service, "en") !== "" || serviceLabel(service, "es") !== "";
}

/**
 * Where the business works.
 *
 * ZIP codes and city names, both typed by the owner. There is deliberately no
 * radius-from-a-point: a radius is a claim the software would be making on the
 * owner's behalf, and §19.8 is explicit that an invented service area is not
 * allowed on the public site.
 */
export interface ServiceArea {
  zipCodes: string[];
  cities: string[];
}

export const EMPTY_SERVICE_AREA: ServiceArea = { zipCodes: [], cities: [] };

export function isServiceAreaEmpty(area: ServiceArea): boolean {
  return area.zipCodes.length === 0 && area.cities.length === 0;
}

/** US ZIP, five digits or ZIP+4. Stored as the five, which is what people say. */
export function normalizeZip(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{5})(?:-\d{4})?$/.exec(trimmed);
  return match ? match[1] : null;
}

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

/**
 * Opening hours, or null for a day the business is closed.
 *
 * Closed is `null` rather than an absent key so that "we are shut on Sunday"
 * and "nobody has filled this in yet" stay different answers — the first is
 * worth printing on the site, the second is not.
 */
export interface DayHours {
  open: string;
  close: string;
}

export type BusinessHours = Partial<Record<Day, DayHours | null>>;

/** `HH:MM`, 24-hour, as an `<input type="time">` produces it. */
export function isTimeOfDay(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Whether these hours make sense as a working day.
 *
 * Closing before opening is refused rather than silently swapped: a shift that
 * runs past midnight is a real thing, and guessing which of the two the owner
 * meant would be wrong half the time. They can say so in the service-area note
 * until the site models overnight hours properly.
 */
export function isValidDayHours(hours: DayHours): boolean {
  return isTimeOfDay(hours.open) && isTimeOfDay(hours.close) && hours.open < hours.close;
}

export function hasAnyHours(hours: BusinessHours): boolean {
  return DAYS.some((day) => hours[day] !== undefined);
}

/**
 * The Google review link (§19.4 block 6, §17.4).
 *
 * Only Google's own review addresses are accepted. The block that uses this
 * says "Reviews" under the business's name, and a field that took any URL
 * would be a way to point that word at anything at all — which is the
 * fabricated-review problem §19.8 forbids, arriving through the front door.
 */
const GOOGLE_REVIEW_HOSTS = ["g.page", "search.google.com", "www.google.com", "google.com", "maps.app.goo.gl"];

export function isGoogleReviewUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return GOOGLE_REVIEW_HOSTS.includes(url.hostname.toLowerCase());
}

/**
 * A phone number as typed, kept as typed.
 *
 * The digits are what matter for `tel:` links, and the formatting is what the
 * owner wants their customers to read. Both are kept: rewriting someone's
 * number into a house style is a small rudeness that shows up on their own
 * website.
 */
export function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Ten digits, or eleven starting with a US country code. */
export function isUsablePhone(raw: string): boolean {
  const digits = phoneDigits(raw);
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function telHref(raw: string): string {
  const digits = phoneDigits(raw);
  return digits.length === 10 ? `tel:+1${digits}` : `tel:+${digits}`;
}

/**
 * Suggested services per trade (§10.2 step 4).
 *
 * A starting point, not a claim: nothing is written to the profile until the
 * owner picks it, and every one can be removed or renamed. Both languages are
 * filled in because a preset is the one case where we genuinely know the
 * translation — the owner's own wording is theirs to type.
 */
export const SERVICE_PRESETS: Record<TradeCode, BusinessService[]> = {
  handyman: [
    { name: { en: "Furniture assembly", es: "Armado de muebles" } },
    { name: { en: "Drywall repair", es: "Reparación de tablaroca" } },
    { name: { en: "Door and lock repair", es: "Reparación de puertas y cerraduras" } },
    { name: { en: "Shelving and mounting", es: "Instalación de repisas y soportes" } },
    { name: { en: "Painting touch-ups", es: "Retoques de pintura" } },
    { name: { en: "General home repairs", es: "Reparaciones generales del hogar" } },
  ],
  plumbing: [
    { name: { en: "Drain cleaning", es: "Limpieza de desagües" } },
    { name: { en: "Leak repair", es: "Reparación de fugas" } },
    { name: { en: "Water heater repair", es: "Reparación de calentadores de agua" } },
    { name: { en: "Faucet and sink installation", es: "Instalación de llaves y lavabos" } },
    { name: { en: "Toilet repair", es: "Reparación de inodoros" } },
    { name: { en: "Emergency plumbing", es: "Plomería de emergencia" } },
  ],
  hvac: [
    { name: { en: "AC repair", es: "Reparación de aire acondicionado" } },
    { name: { en: "Heating repair", es: "Reparación de calefacción" } },
    { name: { en: "System installation", es: "Instalación de sistemas" } },
    { name: { en: "Seasonal maintenance", es: "Mantenimiento por temporada" } },
    { name: { en: "Duct cleaning", es: "Limpieza de ductos" } },
    { name: { en: "Thermostat installation", es: "Instalación de termostatos" } },
  ],
  electrical: [
    { name: { en: "Outlet and switch repair", es: "Reparación de contactos e interruptores" } },
    { name: { en: "Lighting installation", es: "Instalación de iluminación" } },
    { name: { en: "Panel upgrades", es: "Actualización de paneles eléctricos" } },
    { name: { en: "Ceiling fan installation", es: "Instalación de ventiladores de techo" } },
    { name: { en: "EV charger installation", es: "Instalación de cargadores para autos eléctricos" } },
    { name: { en: "Electrical inspections", es: "Inspecciones eléctricas" } },
  ],
  cleaning: [
    { name: { en: "Deep cleaning", es: "Limpieza profunda" } },
    { name: { en: "Recurring house cleaning", es: "Limpieza periódica del hogar" } },
    { name: { en: "Move-in and move-out cleaning", es: "Limpieza de mudanza" } },
    { name: { en: "Office cleaning", es: "Limpieza de oficinas" } },
    { name: { en: "Post-construction cleaning", es: "Limpieza después de obra" } },
    { name: { en: "Carpet cleaning", es: "Limpieza de alfombras" } },
  ],
  appliance_repair: [
    { name: { en: "Refrigerator repair", es: "Reparación de refrigeradores" } },
    { name: { en: "Washer and dryer repair", es: "Reparación de lavadoras y secadoras" } },
    { name: { en: "Dishwasher repair", es: "Reparación de lavavajillas" } },
    { name: { en: "Oven and stove repair", es: "Reparación de hornos y estufas" } },
    { name: { en: "Microwave repair", es: "Reparación de microondas" } },
    { name: { en: "Appliance installation", es: "Instalación de electrodomésticos" } },
  ],
};

/** Presets for a trade, or none when the business chose "other" at onboarding. */
export function presetsForTrade(trade: string): BusinessService[] {
  return SERVICE_PRESETS[trade as TradeCode] ?? [];
}

export type ProfileGap = "no_phone" | "no_services" | "no_service_area" | "no_hours" | "no_email";

/**
 * What is still blank.
 *
 * Not "invalid" — every one of these saves fine. It is the list the website's
 * readiness check reads from, and the reason that check was unsatisfiable until
 * this screen existed: it asked for a phone number with nowhere to type one.
 */
export function profileGaps(profile: {
  phone: string | null;
  email: string | null;
  services: BusinessService[];
  serviceArea: ServiceArea;
  businessHours: BusinessHours;
}): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!profile.phone?.trim()) gaps.push("no_phone");
  if (!profile.email?.trim()) gaps.push("no_email");
  if (profile.services.length === 0) gaps.push("no_services");
  if (isServiceAreaEmpty(profile.serviceArea)) gaps.push("no_service_area");
  if (!hasAnyHours(profile.businessHours)) gaps.push("no_hours");
  return gaps;
}
