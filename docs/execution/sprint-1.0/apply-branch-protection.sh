#!/usr/bin/env bash
# =============================================================================
# apply-branch-protection.sh — Sprint 1.0 (Identity & Governance Binding)
# -----------------------------------------------------------------------------
# Applies main-branch protection to every ecosystem repo from branch-protection.json.
#
#   ⚠️  FOUNDER-GATED, OUTWARD-FACING ACTION. The worker agent does NOT run this.
#       It is applied ONLY by the founder (`bkasanwiredjo`) who holds admin on all repos.
#       By DEFAULT this script is DRY-RUN: it prints the exact body it WOULD send and
#       calls nothing. To actually apply, the founder runs:  APPLY=1 ./apply-branch-protection.sh
#
# Requires: gh (authenticated as a repo admin) + jq. Real `gh api` syntax; PUT is idempotent
# (re-running re-asserts the same protection). INCREMENTAL: only checks with active=true in
# branch-protection.json are sent as required contexts now — never a not-yet-built check.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${1:-$HERE/branch-protection.json}"
APPLY="${APPLY:-0}"

command -v jq >/dev/null || { echo "FATAL: jq not found"; exit 1; }
[ -f "$CONFIG" ] || { echo "FATAL: config not found: $CONFIG"; exit 1; }

if [ "$APPLY" = "1" ]; then
  command -v gh >/dev/null || { echo "FATAL: gh not found"; exit 1; }
  echo "MODE: APPLY — protection WILL be written via gh api."
else
  echo "MODE: DRY-RUN — printing bodies only, calling nothing. Set APPLY=1 to apply (founder only)."
fi
echo

defaults="$(jq -c '.defaults' "$CONFIG")"

jq -c '.repos[]' "$CONFIG" | while IFS= read -r repo; do
  slug="$(jq -r '.slug'   <<<"$repo")"
  branch="$(jq -r '.branch' <<<"$repo")"
  contexts="$(jq -c '[.required_checks[] | select(.active==true) | .name]' <<<"$repo")"

  # Build the exact PUT body GitHub's branch-protection API expects.
  body="$(jq -n --argjson d "$defaults" --argjson c "$contexts" '{
    required_status_checks: { strict: $d.required_status_checks_strict, contexts: $c },
    enforce_admins: $d.enforce_admins,
    required_pull_request_reviews: {
      dismiss_stale_reviews:          $d.required_pull_request_reviews.dismiss_stale_reviews,
      require_code_owner_reviews:     $d.required_pull_request_reviews.require_code_owner_reviews,
      required_approving_review_count:$d.required_pull_request_reviews.required_approving_review_count,
      require_last_push_approval:     $d.required_pull_request_reviews.require_last_push_approval
    },
    restrictions: $d.restrictions,
    required_linear_history: $d.required_linear_history,
    allow_force_pushes: $d.allow_force_pushes,
    allow_deletions: $d.allow_deletions,
    block_creations: $d.block_creations,
    required_conversation_resolution: $d.required_conversation_resolution
  }')"

  echo "=================================================================="
  echo ">>> $slug  ($branch)"
  echo "    active required checks: $contexts"
  echo "------------------------------------------------------------------"
  echo "$body" | jq .

  if [ "$APPLY" = "1" ]; then
    echo "$body" | gh api --method PUT \
      -H "Accept: application/vnd.github+json" \
      "repos/$slug/branches/$branch/protection" \
      --input -
    echo "    ✓ applied to $slug"
  fi
  echo
done

cat <<'NEXT'
------------------------------------------------------------------------------
APPENDING A CHECK LATER (when a deferred sprint lands its CI job):
  1. flip that check's "active" to true in branch-protection.json (its name MUST
     equal the new job's status-check context EXACTLY).
  2. re-run: APPLY=1 ./apply-branch-protection.sh  (idempotent PUT re-asserts protection).
Never set a check active=true before its job exists and is green — it blocks ALL PRs.

EVIDENCE TO CAPTURE (Sprint 1.0 DoD): per repo, run
  gh api "repos/<slug>/branches/main/protection" | jq .
and save the output as the branch-protection evidence.
------------------------------------------------------------------------------
NEXT
