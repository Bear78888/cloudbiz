import type { Metadata, Viewport } from "next";
import "../globals.css";
import { Analytics } from "@/components/Analytics";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { isLocale } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  applicationName: "SellerRelay Logistics",
  title: "SellerRelay Logistics",
  description:
    "California-based receiving, inspection, preparation, storage, and logistics for international marketplace sellers.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1633",
};

export async function generateStaticParams() {
  return [{ locale: "en" }, { locale: "ru" }];
}

export default async function LocaleRootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: requestedLocale } = await params;
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";

  return (
    <html lang={locale}>
      <body>
        <a className="skip-link" href="#main-content">
          {locale === "ru" ? "Перейти к содержимому" : "Skip to content"}
        </a>
        <Header locale={locale} />
        <main id="main-content">{children}</main>
        <Footer locale={locale} />
        <Analytics />
      </body>
    </html>
  );
}
