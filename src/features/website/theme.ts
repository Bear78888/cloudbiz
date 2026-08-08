/**
 * How a site looks (§19.3 template and approved colour preset).
 *
 * Every class string is written out in full rather than composed at runtime.
 * Tailwind finds classes by scanning source text, so `bg-${preset}-600` is a
 * class that exists in the source and not in the stylesheet — the page would
 * render with no colour at all, and nothing would fail loudly enough to notice
 * before a customer saw it.
 *
 * The palettes are pairs, not single hues: each one carries a surface, the text
 * that sits on it, and a button, and the pairs were picked so the contrast holds
 * (§8.3). That is the actual reason §19.9 forbids a colour picker — not a
 * limitation of the tool, but the only way to promise a legible page.
 */

import type { SiteColorPreset, SiteTemplate } from "./model";

export interface SitePalette {
  /** The hero band and other full-bleed colour. */
  band: string;
  /** Text that sits on `band`. */
  bandText: string;
  /** Muted text on `band` — still contrast-checked, never below 4.5:1. */
  bandMuted: string;
  /** The primary call to action. */
  button: string;
  /** A quieter button on a white surface. */
  buttonOutline: string;
  /** Section headings on white. */
  heading: string;
  /** Small decorative rules and borders. */
  border: string;
  /** Tinted panel on white, for alternating sections. */
  panel: string;
}

const PALETTES: Record<SiteColorPreset, SitePalette> = {
  navy: {
    band: "bg-slate-900",
    bandText: "text-white",
    bandMuted: "text-slate-200",
    button: "bg-blue-600 text-white hover:bg-blue-500",
    buttonOutline: "border-2 border-slate-900 text-slate-900 hover:bg-slate-100",
    heading: "text-slate-900",
    border: "border-slate-200",
    panel: "bg-slate-50",
  },
  forest: {
    band: "bg-emerald-900",
    bandText: "text-white",
    bandMuted: "text-emerald-100",
    button: "bg-emerald-600 text-white hover:bg-emerald-500",
    buttonOutline: "border-2 border-emerald-900 text-emerald-900 hover:bg-emerald-50",
    heading: "text-emerald-950",
    border: "border-emerald-200",
    panel: "bg-emerald-50",
  },
  sunset: {
    band: "bg-orange-900",
    bandText: "text-white",
    bandMuted: "text-orange-100",
    button: "bg-orange-600 text-white hover:bg-orange-500",
    buttonOutline: "border-2 border-orange-900 text-orange-900 hover:bg-orange-50",
    heading: "text-orange-950",
    border: "border-orange-200",
    panel: "bg-orange-50",
  },
  slate: {
    band: "bg-zinc-800",
    bandText: "text-white",
    bandMuted: "text-zinc-200",
    button: "bg-zinc-900 text-white hover:bg-zinc-700",
    buttonOutline: "border-2 border-zinc-800 text-zinc-800 hover:bg-zinc-100",
    heading: "text-zinc-900",
    border: "border-zinc-200",
    panel: "bg-zinc-50",
  },
  brick: {
    band: "bg-red-900",
    bandText: "text-white",
    bandMuted: "text-red-100",
    button: "bg-red-700 text-white hover:bg-red-600",
    buttonOutline: "border-2 border-red-900 text-red-900 hover:bg-red-50",
    heading: "text-red-950",
    border: "border-red-200",
    panel: "bg-red-50",
  },
};

export function paletteFor(preset: SiteColorPreset): SitePalette {
  return PALETTES[preset] ?? PALETTES.navy;
}

export interface TemplateLayout {
  /** Hero: how the opening block is arranged. */
  heroPadding: string;
  heroAlign: string;
  heroTitle: string;
  /** Vertical rhythm between blocks. */
  sectionPadding: string;
  /** Services: cards or a plain list. */
  servicesGrid: string;
  serviceItem: string;
}

const LAYOUTS: Record<SiteTemplate, TemplateLayout> = {
  classic: {
    heroPadding: "px-4 py-14 sm:py-20",
    heroAlign: "text-left",
    heroTitle: "text-3xl font-bold sm:text-4xl",
    sectionPadding: "px-4 py-12",
    servicesGrid: "grid gap-4 sm:grid-cols-2",
    serviceItem: "rounded-xl border p-4 text-base font-medium",
  },
  bold: {
    heroPadding: "px-4 py-20 sm:py-28",
    heroAlign: "text-center",
    heroTitle: "text-4xl font-extrabold tracking-tight sm:text-5xl",
    sectionPadding: "px-4 py-14",
    servicesGrid: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
    serviceItem: "rounded-2xl border p-6 text-lg font-semibold shadow-sm",
  },
  compact: {
    heroPadding: "px-4 py-10 sm:py-12",
    heroAlign: "text-left",
    heroTitle: "text-2xl font-bold sm:text-3xl",
    sectionPadding: "px-4 py-8",
    servicesGrid: "flex flex-wrap gap-2",
    serviceItem: "rounded-full border px-4 py-2 text-sm font-medium",
  },
};

export function layoutFor(template: SiteTemplate): TemplateLayout {
  return LAYOUTS[template] ?? LAYOUTS.classic;
}
