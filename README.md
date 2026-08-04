# HandyAlliance Platform

Simple tools for home service pros — the HandyAlliance SaaS platform (spec: `docs/MASTER_SPEC.md`, v2.2).

> Note: this repository (`cloudbiz`) is the temporary home for the HandyAlliance platform code. It can be renamed/transferred to `handyalliance-platform` later without losing history.

## Status

- Public marketing site (bilingual en-US / es-US): built (PR #1).
- Stage 1 platform foundation: organizations + memberships + RLS, auth (email+password, magic link; Google behind a flag), onboarding, dashboard shell, entitlements, Stripe foundation (checkout / portal / idempotent webhook), admin foundation, audit log.
- External services (Supabase project, Stripe keys, Vercel, domain, Google, Resend, SMS, Retell): awaiting owner access — see `docs/HANDYALLIANCE_CURRENT_STATE_AUDIT.md` §7. The app builds and runs in public-site mode with no environment at all.

## Documentation

| File | Contents |
|---|---|
| `docs/MASTER_SPEC.md` | Canonical master specification (v2.2, Russian) |
| `docs/HANDYALLIANCE_CURRENT_STATE_AUDIT.md` | Stage 0 audit: assets, BizMetria pattern reuse map |
| `docs/HANDYALLIANCE_ARCHITECTURE.md` | Stage 1 architecture, trust boundaries, decisions |
| `docs/HANDYALLIANCE_BILLING_AND_ENTITLEMENTS.md` | Billing model, entitlement resolution, webhook idempotency |

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000 (redirects to `/en`, honoring the `ha_locale` cookie and browser language).

Without Supabase environment variables the app runs in public-site mode: marketing pages work, sign-in shows a static preview. To run the full platform locally, copy `.env.example` to `.env.local` and fill in the Supabase (and optionally Stripe test) values.

## Database

Migrations live in `supabase/migrations/`. To validate them plus the cross-tenant RLS isolation tests against a plain Postgres 16 (no Supabase needed):

```bash
createdb ha_test
psql -d ha_test -v ON_ERROR_STOP=1 -f supabase/tests/supabase_shim.sql
for f in supabase/migrations/*.sql; do psql -d ha_test -v ON_ERROR_STOP=1 -f "$f"; done
psql -d ha_test -v ON_ERROR_STOP=1 -f supabase/tests/rls_isolation_test.sql
```

CI runs the same sequence in the `rls` job.

## Checks

```bash
npm run typecheck   # also validates EN/ES dictionary key parity via types
npm test            # unit tests (entitlements, webhook core, env schema, i18n parity)
npm run build
```

## End-to-end tests

Playwright drives a real browser against a real Next.js server and a real
Supabase — no stubs, so RLS, the auth server and the activity triggers are all
in the loop. Needs Docker for the local Supabase stack:

```bash
npx supabase start          # Postgres + API + auth, migrations applied
eval "$(npx supabase status -o env)"
export NEXT_PUBLIC_SUPABASE_URL="$API_URL" \
       NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
       SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" \
       SUPABASE_PROJECT_REF=whwzfdkdxyycsvyvyxdn
npm run build
npm run test:e2e            # or: npm run test:e2e:ui
```

`E2E_BASE_URL=https://…` points the suite at an already-deployed preview
instead of starting a local server. CI runs the same sequence in the `e2e`
job; the local stack's keys are fixed development values, so no secrets are
involved.
