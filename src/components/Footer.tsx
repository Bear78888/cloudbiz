import Link from "next/link";
import { PRODUCTS } from "@/lib/config";
import { hrefFor, type Locale } from "@/lib/routes";
import type { Dict } from "@/lib/i18n";

export function Footer({ locale, dict }: { locale: Locale; dict: Dict }) {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-bold text-brand-800">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-black text-white" aria-hidden="true">
                HA
              </span>
              {dict.meta.siteName}
            </p>
            <p className="mt-3 max-w-xs text-sm text-slate-600">{dict.footer.tagline}</p>
          </div>

          <nav aria-label={dict.footer.toolsHeading}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {dict.footer.toolsHeading}
            </h2>
            <ul className="mt-4 space-y-2">
              {PRODUCTS.map((p) => (
                <li key={p.code}>
                  <Link href={hrefFor(`tool:${p.code}`, locale)} className="text-sm text-slate-700 hover:text-brand-700">
                    {dict.tools[p.code].name}
                  </Link>
                </li>
              ))}
              <li>
                <Link href={hrefFor("jobTracker", locale)} className="text-sm text-slate-700 hover:text-brand-700">
                  {dict.jobTracker.name} — {dict.jobTracker.badge}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={dict.footer.productHeading}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {dict.footer.productHeading}
            </h2>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href={hrefFor("pricing", locale)} className="text-sm text-slate-700 hover:text-brand-700">
                  {dict.nav.pricing}
                </Link>
              </li>
              <li>
                <Link href={hrefFor("signIn", locale)} className="text-sm text-slate-700 hover:text-brand-700">
                  {dict.nav.signIn}
                </Link>
              </li>
              <li>
                <Link href={hrefFor("signUp", locale)} className="text-sm text-slate-700 hover:text-brand-700">
                  {dict.nav.chooseTools}
                </Link>
              </li>
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {dict.footer.languageHeading}
            </h2>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/en" hrefLang="en" className={`text-sm hover:text-brand-700 ${locale === "en" ? "font-semibold text-brand-800" : "text-slate-700"}`}>
                  English
                </Link>
              </li>
              <li>
                <Link href="/es" hrefLang="es" className={`text-sm hover:text-brand-700 ${locale === "es" ? "font-semibold text-brand-800" : "text-slate-700"}`}>
                  Español
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6">
          <p className="text-xs text-slate-500">{dict.footer.legalNote}</p>
          <p className="mt-2 text-xs text-slate-500">
            © {year} {dict.meta.siteName}. {dict.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
