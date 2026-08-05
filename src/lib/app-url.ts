/**
 * The absolute base URL for links that leave the app — links written into the
 * Google Sheet, into emails, anywhere the reader is not already on a page.
 *
 * There used to be a hardcoded `https://handyalliance.com` fallback here, and
 * it wrote that domain into a customer's spreadsheet while the platform was
 * still living on `*.vercel.app`. The links were dead, and nothing said so:
 * a plausible-looking URL is the worst kind of wrong value, because it does not
 * announce itself.
 *
 * Resolution order, most specific first:
 *   1. `NEXT_PUBLIC_APP_URL` — what the deployment is actually called. Set per
 *      environment; changing domain is one variable.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` — the deployment's own
 *      address. This is what makes preview links point at the preview that
 *      produced them instead of at production.
 *   3. The request origin, when a caller has one.
 *
 * There is deliberately no constant at the end of that list. If nothing above
 * resolves, the caller gets `null` and decides — omitting a link is honest,
 * inventing one is not.
 */
export function resolveAppUrl(requestOrigin?: string | null): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (vercelHost) return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  if (requestOrigin) return requestOrigin.replace(/\/$/, "");

  return null;
}
