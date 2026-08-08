import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/en/thank-you", "/ru/thank-you"] }], sitemap: `${siteUrl()}/sitemap.xml` };
}
