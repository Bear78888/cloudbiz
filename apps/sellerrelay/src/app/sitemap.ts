import type { MetadataRoute } from "next";
import { pageSlugs } from "@/lib/content";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return (["en", "ru"] as const).flatMap((locale) => pageSlugs.filter((slug) => slug !== "thank-you").map((slug) => ({ url: `${base}/${locale}${slug ? `/${slug}` : ""}`, lastModified: new Date(), changeFrequency: slug === "" ? "weekly" as const : "monthly" as const, priority: slug === "" ? 1 : ["services", "pricing", "get-a-quote"].includes(slug) ? 0.9 : 0.7, alternates: { languages: { en: `${base}/en${slug ? `/${slug}` : ""}`, ru: `${base}/ru${slug ? `/${slug}` : ""}` } } })));
}
