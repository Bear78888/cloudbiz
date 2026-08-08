# SellerRelay Logistics

Bilingual EN/RU demand-validation website for a California-based marketplace inventory preparation and logistics service operated by Amazing Seller LLC.

## Included

- localized routes for Home, Services, How It Works, Pricing, International Sellers, Agencies, FAQ, Quote, Contact, Privacy, Terms, Restricted Products, and Thank You;
- seven-step quote form with session progress, CTA intent, UTM capture, file validation, server validation, spam controls, and request numbers;
- contact and agency forms;
- private Supabase Storage integration and lead tables;
- optional Resend confirmation/notification emails;
- optional Cloudflare Turnstile and GA4;
- sitemap, robots, canonical, hreflang, Open Graph, structured data, accessibility, and responsive layouts.

## Local setup

```bash
cp .env.example .env.local
npm install
SELLERRELAY_DEV_FILE_STORE=1 npm run dev
```

`SELLERRELAY_DEV_FILE_STORE=1` is development-only. It writes test submissions to `.sellerrelay-dev/*.jsonl`. Production intentionally returns an integration error until Supabase is configured, so the interface never claims a request was saved when it was not.

## Supabase

1. Create or select the dedicated SellerRelay Supabase project.
2. Run `supabase/migrations/20260805000100_sellerrelay_leads.sql`.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_PRIVATE_BUCKET=sellerrelay-private` to Vercel.
4. Keep the service-role key server-side. Never prefix it with `NEXT_PUBLIC_`.

The migration enables RLS, revokes browser roles, creates no public object policy, and creates a private bucket restricted to approved file types and 10 MB per file.

## Email

Set `RESEND_API_KEY`, `RESEND_FROM`, and `SELLERRELAY_OWNER_EMAIL`. Verify the sender domain and configure SPF, DKIM, and DMARC before enabling production email. Until this is done, the app saves valid requests but does not pretend that an email was sent.

## Optional integrations

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
- `NEXT_PUBLIC_GA_ID`
- `NEXT_PUBLIC_BOOKING_URL`
- `NEXT_PUBLIC_CONTACT_EMAIL` only after the mailbox is working
- `NEXT_PUBLIC_SITE_URL` only after the production domain is connected

## Vercel deployment from `Bear78888/cloudbiz`

This application is intentionally isolated at `apps/sellerrelay` so it does not change the existing HandyAlliance project. Create a separate Vercel project with Root Directory `apps/sellerrelay`, then configure the variables above. Do not reuse another project's database or secrets.

The working brand is SellerRelay. The site does not claim that `sellerrelay.com` is connected; configure the domain only after ownership and DNS are verified.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
```

Verify EN/RU route parity, language switching, both CTA intents, all seven form steps, supported and unsupported uploads, server failure states, request storage, private file access, request numbers, thank-you rendering, and widths 360, 390, 768, 1024, and 1440 px.

## Legal review

Privacy Policy and Terms of Service are operational drafts. Review them with a licensed attorney before scaled advertising, regulated product handling, or complex international shipments.
