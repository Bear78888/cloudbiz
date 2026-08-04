import { en, type Dict } from "./en";
import { es } from "./es";
import type { Locale } from "../routes";

export type { Dict };

const dictionaries: Record<Locale, Dict> = { en, es };

export function getDict(locale: Locale): Dict {
  return dictionaries[locale];
}

/** Tiny template interpolation: fmt("{minutes} min", { minutes: 100 }) → "100 min". */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
