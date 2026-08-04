# HandyAlliance Platform

Simple tools for home service pros — the HandyAlliance SaaS platform (spec: HANDYALLIANCE_MASTER_SPEC v2.0).

> Note: this repository (`cloudbiz`) is the temporary home for the HandyAlliance platform code. It can be renamed/transferred to `handyalliance-platform` later without losing history.

## Status

- Public marketing site (bilingual en-US / es-US): in development — see feature branches / draft PRs.
- Backend (Supabase, Stripe, Google Sheets sync, tools): pending owner access — not started.

## Local development

```bash
npm install
npm run dev
```

Then open http://localhost:3000 (redirects to `/en`).

## Checks

```bash
npm run typecheck   # also validates EN/ES dictionary key parity via types
npm run build
```
