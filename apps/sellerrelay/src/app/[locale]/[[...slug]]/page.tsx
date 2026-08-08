import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SitePage } from "@/components/SitePage";
import { copy, isLocale, isPageSlug, pageSlugs, type Locale, type PageSlug } from "@/lib/content";
import { siteUrl } from "@/lib/site";

type RouteProps = {
  params: Promise<{ locale: string; slug?: string[] }>;
  searchParams: Promise<{ intent?: string | string[]; request?: string | string[] }>;
};

function resolve(params: { locale: string; slug?: string[] }) {
  if (!isLocale(params.locale) || (params.slug?.length || 0) > 1) return null;
  const slug = (params.slug?.[0] || "") as string;
  if (!isPageSlug(slug)) return null;
  return { locale: params.locale, slug } as { locale: Locale; slug: PageSlug };
}

export async function generateStaticParams() {
  return (["en", "ru"] as const).flatMap((locale) => pageSlugs.map((slug) => slug ? ({ locale, slug: [slug] }) : ({ locale, slug: [] })));
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const route = resolve(await params);
  if (!route) return {};
  const c = copy[route.locale];
  const path = `/${route.locale}${route.slug ? `/${route.slug}` : ""}`;
  const alternateLocale = route.locale === "en" ? "ru" : "en";
  const alternatePath = `/${alternateLocale}${route.slug ? `/${route.slug}` : ""}`;
  const image = `${siteUrl()}/opengraph-image`;
  return {
    title: c.meta[route.slug].title,
    description: c.meta[route.slug].description,
    alternates: {
      canonical: path,
      languages: { en: route.locale === "en" ? path : alternatePath, ru: route.locale === "ru" ? path : alternatePath, "x-default": `/en${route.slug ? `/${route.slug}` : ""}` },
    },
    robots: route.slug === "thank-you" ? { index: false, follow: false } : undefined,
    openGraph: { type: "website", siteName: "SellerRelay Logistics", locale: route.locale === "ru" ? "ru_RU" : "en_US", title: c.meta[route.slug].title, description: c.meta[route.slug].description, url: path, images: [{ url: image, width: 1200, height: 630, alt: "SellerRelay Logistics" }] },
    twitter: { card: "summary_large_image", title: c.meta[route.slug].title, description: c.meta[route.slug].description, images: [image] },
  };
}

export default async function LocalizedPage({ params, searchParams }: RouteProps) {
  const route = resolve(await params);
  if (!route) notFound();
  const query = await searchParams;
  const intent = Array.isArray(query.intent) ? query.intent[0] : query.intent;
  const requestNumber = Array.isArray(query.request) ? query.request[0] : query.request;
  const c = copy[route.locale];
  const canonical = `${siteUrl()}/${route.locale}${route.slug ? `/${route.slug}` : ""}`;
  const breadcrumb = route.slug ? [{ "@type": "ListItem", position: 1, name: route.locale === "ru" ? "Главная" : "Home", item: `${siteUrl()}/${route.locale}` }, { "@type": "ListItem", position: 2, name: c.meta[route.slug].title, item: canonical }] : undefined;
  const schemas: Record<string, unknown>[] = [
    { "@context": "https://schema.org", "@type": "Organization", name: "SellerRelay Logistics", legalName: "Amazing Seller LLC", url: `${siteUrl()}/${route.locale}`, areaServed: "United States", address: { "@type": "PostalAddress", addressRegion: "California", addressCountry: "US" }, description: c.meta[""].description },
    { "@context": "https://schema.org", "@type": "Service", name: "Marketplace inventory preparation and logistics", provider: { "@type": "Organization", name: "SellerRelay Logistics" }, areaServed: { "@type": "Country", name: "United States" }, serviceType: ["Inventory receiving", "Product inspection", "FNSKU labeling", "Packaging", "Storage", "FBA forwarding", "Returns processing"] },
  ];
  if (breadcrumb) schemas.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: breadcrumb });
  if (route.slug === "faq" || route.slug === "") schemas.push({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faqs.slice(0, route.slug === "" ? 8 : undefined).map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) });
  return <><SitePage locale={route.locale} slug={route.slug} intent={intent} requestNumber={requestNumber} /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas).replaceAll("<", "\\u003c") }} /></>;
}
