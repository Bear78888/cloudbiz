"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { copy, type Locale } from "@/lib/content";
import { Logo } from "@/components/Logo";

export function Header({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const c = copy[locale];
  const otherLocale: Locale = locale === "en" ? "ru" : "en";
  const otherPath = pathname.replace(/^\/(en|ru)(?=\/|$)/, `/${otherLocale}`);

  useEffect(() => {
    document.documentElement.lang = locale;
    setOpen(false);
  }, [locale, pathname]);

  const isActive = (slug: string) => pathname === `/${locale}/${slug}`;

  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Logo locale={locale} />
        <nav className="desktop-nav" aria-label={locale === "en" ? "Primary navigation" : "Основная навигация"}>
          {c.nav.map((item) => (
            <Link key={item.slug} href={`/${locale}/${item.slug}`} className={isActive(item.slug) ? "active" : ""}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="header-actions">
          <Link
            href={otherPath || `/${otherLocale}`}
            className="language-switch"
            data-event="language_switch"
            data-event-label={`${locale}_to_${otherLocale}`}
            hrefLang={otherLocale}
          >
            {locale === "en" ? "Русский" : "English"}
          </Link>
          <Link href={`/${locale}/get-a-quote?intent=custom_quote`} className="button button-small header-cta" data-event="custom_quote_click">
            {c.common.getQuote}
          </Link>
          <button className="mobile-menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="mobile-nav shell" aria-label={locale === "en" ? "Mobile navigation" : "Мобильная навигация"}>
          {c.nav.map((item) => (
            <Link key={item.slug} href={`/${locale}/${item.slug}`} className={isActive(item.slug) ? "active" : ""}>
              {item.label}
            </Link>
          ))}
          <Link href={otherPath || `/${otherLocale}`} hrefLang={otherLocale}>{locale === "en" ? "Русский" : "English"}</Link>
          <Link href={`/${locale}/get-a-quote?intent=custom_quote`} className="button" data-event="custom_quote_click">
            {c.common.getQuote}
          </Link>
        </nav>
      )}
    </header>
  );
}
