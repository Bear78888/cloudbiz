#!/usr/bin/env bash
# Pushes the confirmation and magic-link templates from supabase/templates/ to
# the live project via the Supabase Management API.
#
# Why this exists instead of a migration or an MCP tool call: auth email
# templates are project *configuration*, not schema — Supabase's Management
# API (PATCH /v1/projects/{ref}/config/auth) is the only way to set them
# outside the Dashboard, and no MCP tool in this session exposes that
# endpoint. This script is the documented, reviewable substitute: read it
# before running it, the way you would review a migration.
#
# Requires SUPABASE_ACCESS_TOKEN — a personal access token from
# https://supabase.com/dashboard/account/tokens. That token is yours to hold;
# it is not committed anywhere and this script never prints it.
#
# Usage:
#   export SUPABASE_ACCESS_TOKEN=sbp_...
#   ./scripts/apply-auth-email-templates.sh
#
# Safe to re-run: it only ever sets these four fields, and running it again
# with the same files in the repo produces the same result.

set -euo pipefail

PROJECT_REF="whwzfdkdxyycsvyvyxdn"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "SUPABASE_ACCESS_TOKEN is not set. Get one at https://supabase.com/dashboard/account/tokens" >&2
  exit 1
fi

CONFIRMATION_HTML="$(cat "$ROOT/supabase/templates/confirmation.html")"
MAGIC_LINK_HTML="$(cat "$ROOT/supabase/templates/magic_link.html")"

# jq builds the JSON body so the HTML's quotes and newlines are escaped
# correctly — hand-escaping a multi-hundred-character HTML string into a
# shell heredoc is exactly the kind of thing that looks right and corrupts
# silently on the one apostrophe you didn't test.
if ! command -v jq >/dev/null; then
  echo "jq is required (apt install jq / brew install jq)." >&2
  exit 1
fi

BODY=$(jq -n \
  --arg confirmation_subject '{{ if eq .Data.preferred_locale "es" }}Confirma tu cuenta de HandyAlliance{{ else }}Confirm your HandyAlliance account{{ end }}' \
  --arg confirmation_content "$CONFIRMATION_HTML" \
  --arg magic_link_subject '{{ if eq .Data.preferred_locale "es" }}Tu enlace de acceso a HandyAlliance{{ else }}Your HandyAlliance sign-in link{{ end }}' \
  --arg magic_link_content "$MAGIC_LINK_HTML" \
  '{
    mailer_subjects_confirmation: $confirmation_subject,
    mailer_templates_confirmation_content: $confirmation_content,
    mailer_subjects_magic_link: $magic_link_subject,
    mailer_templates_magic_link_content: $magic_link_content
  }')

echo "Applying to project $PROJECT_REF..."
curl -sS -X PATCH "https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY" \
  -o /tmp/auth-config-response.json \
  -w "HTTP %{http_code}\n"

echo "Response saved to /tmp/auth-config-response.json"
echo "Verify with a real sign-up (or 'Email me a sign-in link') in each language before trusting this blind — GoTrue's rendering of .Data.preferred_locale was not exercised in CI (see docs/HANDYALLIANCE_ARCHITECTURE.md §5i)."
