import { notFound } from "next/navigation";

import { isLocale } from "@/lib/routes";
import "../../../globals.css";

/**
 * A root layout of its own, deliberately outside `[locale]`.
 *
 * The customer's copy of an estimate must not be wrapped in the marketing
 * site's header and footer. Under `[locale]` it was: the page came with the
 * product navigation, a Sign In link and a footer listing every tool — an
 * advertisement stapled to a document a tradesperson sends their client, and a
 * page that says more about HandyAlliance than about the work being quoted.
 *
 * A nested layout could not have fixed this. In the App Router a child layout
 * adds to its parent rather than replacing it, so escaping the chrome meant
 * leaving the segment that renders it. Hence `/e/{locale}/{token}` rather than
 * `/{locale}/e/{token}`, with the locale kept in the path so `lang` is right
 * without a second query for it.
 *
 * The e2e spec asserts the absence of that chrome, which is how this was found.
 */
export default async function PublicEstimateLayout({
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
      <body className="bg-slate-50">{children}</body>
    </html>
  );
}
