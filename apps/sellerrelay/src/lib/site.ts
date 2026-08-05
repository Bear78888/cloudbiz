const defaultSiteUrl = "https://sellerrelay.vercel.app";

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  return (explicit || defaultSiteUrl).replace(/\/$/, "");
}
