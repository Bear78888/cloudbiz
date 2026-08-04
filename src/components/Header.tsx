"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { alternatePathname, hrefFor, type Locale } from "@/lib/routes";
import { buttonStyles } from "./ui";

export interface HeaderStrings {
  brand: string;
  tools: string;
  pricing: string;
  jobTracker: string;
  signIn: string;
  chooseTools: string;
  openMenu: string;
  closeMenu: string;
  switchLocale: string;
  switchLocaleLabel: string;
}

export function Header({ locale, strings }: { locale: Locale; strings: HeaderStrings }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const otherLocale: Locale = locale === "en" ? "es" : "en";
  const switchHref = alternatePathname(pathname ?? `/${locale}`, otherLocale);

  const navItems = [
    { href: hrefFor("tools", locale), label: strings.tools },
    { href: hrefFor("jobTracker", locale), label: strings.jobTracker },
    { href: hrefFor("pricing", locale), label: strings.pricing },
  ];

  function rememberLocale(next: Locale) {
    // Spec §9.4: persist the language choice in a cookie.
    document.cookie = `ha_locale=${next};path=/;max-age=31536000;samesite=lax`;
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-brand-800"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-sm font-black text-white" aria-hidden="true">
            HA
          </span>
          {strings.brand}
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="font-medium text-slate-700 hover:text-brand-700">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={switchHref}
            hrefLang={otherLocale}
            aria-label={strings.switchLocaleLabel}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-brand-400 hover:text-brand-700"
            onClick={() => rememberLocale(otherLocale)}
          >
            {strings.switchLocale}
          </Link>
          <Link href={hrefFor("signIn", locale)} className="font-medium text-slate-700 hover:text-brand-700">
            {strings.signIn}
          </Link>
          <Link href={hrefFor("tools", locale)} className={`${buttonStyles.primary} !min-h-10 !px-5 !py-2 text-sm`}>
            {strings.chooseTools}
          </Link>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
          aria-expanded={open}
          aria-label={open ? strings.closeMenu : strings.openMenu}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-6 w-6" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {open ? (
        <nav className="border-t border-slate-200 bg-white px-4 py-4 md:hidden" aria-label="Main mobile">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-lg px-3 py-3 text-lg font-medium text-slate-800 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={hrefFor("signIn", locale)}
                className="block rounded-lg px-3 py-3 text-lg font-medium text-slate-800 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                {strings.signIn}
              </Link>
            </li>
            <li>
              <Link
                href={switchHref}
                hrefLang={otherLocale}
                aria-label={strings.switchLocaleLabel}
                className="block rounded-lg px-3 py-3 text-lg font-medium text-brand-700 hover:bg-slate-50"
                onClick={() => rememberLocale(otherLocale)}
              >
                {strings.switchLocale}
              </Link>
            </li>
            <li className="pt-2">
              <Link
                href={hrefFor("tools", locale)}
                className={`${buttonStyles.primary} w-full`}
                onClick={() => setOpen(false)}
              >
                {strings.chooseTools}
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
