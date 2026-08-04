import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "@/components/home";
import {
  JobTrackerPage,
  PricingPage,
  SignInPage,
  SignUpPage,
  ToolDetailPage,
  ToolsIndexPage,
  TradePage,
} from "@/components/pages";
import { getDict, type Dict } from "@/lib/i18n";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  pathFor,
  resolveRoute,
  ROUTES,
  type Locale,
  type RouteEntry,
} from "@/lib/routes";

interface PageParams {
  locale: string;
  slug?: string[];
}

export function generateStaticParams(): PageParams[] {
  return LOCALES.flatMap((locale) =>
    ROUTES.map((route) => ({
      locale,
      slug: route.paths[locale].length > 0 ? route.paths[locale] : undefined,
    })),
  );
}

function routeMeta(entry: RouteEntry, dict: Dict): { title: string; description: string } {
  switch (entry.kind) {
    case "home":
      return dict.meta.home;
    case "tools":
      return dict.meta.tools;
    case "tool": {
      const tool = dict.tools[entry.product];
      return {
        title: `${tool.name} — ${dict.meta.siteName}`,
        description: tool.tagline,
      };
    }
    case "jobTracker":
      return dict.meta.jobTracker;
    case "pricing":
      return dict.meta.pricing;
    case "trade": {
      const trade = dict.trades.items[entry.trade];
      return {
        title: `${dict.meta.siteName} — ${trade.name}`,
        description: trade.blurb,
      };
    }
    case "signIn":
      return dict.meta.signIn;
    case "signUp":
      return dict.meta.signUp;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const entry = resolveRoute(locale, slug);
  if (!entry) return {};

  const dict = getDict(locale);
  const meta = routeMeta(entry, dict);
  const canonicalPath = pathFor(entry, locale);

  // Localized URLs + hreflang alternates for both locales (spec §9.5).
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: canonicalPath,
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_TAGS[l], pathFor(entry, l)]),
      ),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      locale: LOCALE_TAGS[locale].replace("-", "_"),
      siteName: dict.meta.siteName,
      type: "website",
    },
  };
}

export default async function Page({ params }: { params: Promise<PageParams> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const entry = resolveRoute(locale as Locale, slug);
  if (!entry) notFound();

  const dict = getDict(locale as Locale);
  const l = locale as Locale;

  switch (entry.kind) {
    case "home":
      return <HomePage locale={l} dict={dict} />;
    case "tools":
      return <ToolsIndexPage locale={l} dict={dict} />;
    case "tool":
      return <ToolDetailPage locale={l} dict={dict} code={entry.product} />;
    case "jobTracker":
      return <JobTrackerPage locale={l} dict={dict} />;
    case "pricing":
      return <PricingPage locale={l} dict={dict} />;
    case "trade":
      return <TradePage locale={l} dict={dict} trade={entry.trade} />;
    case "signIn":
      return <SignInPage locale={l} dict={dict} />;
    case "signUp":
      return <SignUpPage locale={l} dict={dict} />;
  }
}
