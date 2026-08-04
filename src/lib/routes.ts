import { PRODUCTS, TRADES, type PaidProductCode, type TradeCode } from "./config";

/** Supported locales (spec §9.1). URL prefixes are /en and /es (spec §7.1). */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  es: "es-US",
};

export type RouteEntry =
  | { kind: "home"; key: "home"; paths: Record<Locale, string[]> }
  | { kind: "tools"; key: "tools"; paths: Record<Locale, string[]> }
  | {
      kind: "tool";
      key: `tool:${PaidProductCode}`;
      product: PaidProductCode;
      paths: Record<Locale, string[]>;
    }
  | { kind: "jobTracker"; key: "jobTracker"; paths: Record<Locale, string[]> }
  | { kind: "pricing"; key: "pricing"; paths: Record<Locale, string[]> }
  | {
      kind: "trade";
      key: `trade:${TradeCode}`;
      trade: TradeCode;
      paths: Record<Locale, string[]>;
    }
  | { kind: "signIn"; key: "signIn"; paths: Record<Locale, string[]> }
  | { kind: "signUp"; key: "signUp"; paths: Record<Locale, string[]> };

/** Localized route registry (spec §7.1). */
export const ROUTES: RouteEntry[] = [
  { kind: "home", key: "home", paths: { en: [], es: [] } },
  { kind: "tools", key: "tools", paths: { en: ["tools"], es: ["herramientas"] } },
  ...PRODUCTS.map(
    (p): RouteEntry => ({
      kind: "tool",
      key: `tool:${p.code}`,
      product: p.code,
      paths: { en: ["tools", p.slugs.en], es: ["herramientas", p.slugs.es] },
    }),
  ),
  {
    kind: "jobTracker",
    key: "jobTracker",
    paths: { en: ["job-tracker"], es: ["seguimiento-de-trabajos"] },
  },
  { kind: "pricing", key: "pricing", paths: { en: ["pricing"], es: ["precios"] } },
  ...TRADES.map(
    (t): RouteEntry => ({
      kind: "trade",
      key: `trade:${t.code}`,
      trade: t.code,
      paths: { en: ["for", t.slugs.en], es: ["para", t.slugs.es] },
    }),
  ),
  { kind: "signIn", key: "signIn", paths: { en: ["sign-in"], es: ["iniciar-sesion"] } },
  { kind: "signUp", key: "signUp", paths: { en: ["sign-up"], es: ["registrarse"] } },
];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Resolve a locale + slug segment array to a route entry (undefined = 404). */
export function resolveRoute(locale: Locale, slug: string[] | undefined): RouteEntry | undefined {
  const segments = slug ?? [];
  return ROUTES.find(
    (r) =>
      r.paths[locale].length === segments.length &&
      r.paths[locale].every((seg, i) => seg === segments[i]),
  );
}

export function findRoute(key: RouteEntry["key"]): RouteEntry {
  const entry = ROUTES.find((r) => r.key === key);
  if (!entry) throw new Error(`Unknown route key: ${key}`);
  return entry;
}

/** Absolute path (starting with /<locale>) for a route entry. */
export function pathFor(entry: RouteEntry, locale: Locale): string {
  return `/${[locale, ...entry.paths[locale]].join("/")}`;
}

export function hrefFor(key: RouteEntry["key"], locale: Locale): string {
  return pathFor(findRoute(key), locale);
}

/**
 * Given a full pathname (e.g. /en/tools/call-answering), return the
 * equivalent pathname in the other locale, or the other locale's home
 * page when the path is unknown.
 */
export function alternatePathname(pathname: string, target: Locale): string {
  const parts = pathname.split("/").filter(Boolean);
  const [maybeLocale, ...rest] = parts;
  if (!maybeLocale || !isLocale(maybeLocale)) return `/${target}`;
  const entry = resolveRoute(maybeLocale, rest);
  return entry ? pathFor(entry, target) : `/${target}`;
}
