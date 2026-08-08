import { notFound } from "next/navigation";

import { isLocale } from "@/lib/routes";
import "../../../globals.css";

/**
 * A root layout of its own, deliberately outside `[locale]`.
 *
 * Exactly the reasoning behind `/e/{locale}/{token}` (see that layout, and
 * §5f): under `[locale]` this page would arrive wrapped in our marketing
 * header, our footer and a Sign In link — an advertisement for HandyAlliance
 * stapled to a page that belongs to a plumber and is read by their customer.
 *
 * In the App Router a child layout adds to its parent rather than replacing it,
 * so the only way out of that chrome is to leave the segment that renders it.
 * Hence `/pro/{slug}/{locale}`. The e2e spec asserts the absence of the chrome,
 * which is how the same mistake was caught the first time.
 */
export default async function PublicSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale === "en" ? "en-US" : "es-US"}>
      <body className="bg-white">{children}</body>
    </html>
  );
}
