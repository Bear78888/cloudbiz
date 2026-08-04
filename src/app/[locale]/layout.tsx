import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { getDict } from "@/lib/i18n";
import { isLocale, LOCALES, type Locale } from "@/lib/routes";
import "../globals.css";

export const metadata: Metadata = {
  title: "HandyAlliance",
};

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale as Locale);

  return (
    <html lang={locale === "en" ? "en-US" : "es-US"}>
      <body className="flex min-h-screen flex-col">
        <a href="#main-content" className="skip-link">
          {dict.common.skipToContent}
        </a>
        <Header
          locale={locale as Locale}
          strings={{
            brand: dict.meta.siteName,
            tools: dict.nav.tools,
            pricing: dict.nav.pricing,
            jobTracker: dict.nav.jobTracker,
            signIn: dict.nav.signIn,
            chooseTools: dict.nav.chooseTools,
            openMenu: dict.nav.openMenu,
            closeMenu: dict.nav.closeMenu,
            switchLocale: dict.nav.switchLocale,
            switchLocaleLabel: dict.nav.switchLocaleLabel,
          }}
        />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer locale={locale as Locale} dict={dict} />
      </body>
    </html>
  );
}
