#!/usr/bin/env bash
# Sprint 1.0 — Action 2: install enforceable CODEOWNERS on each repo's DEFAULT branch.
# Founder-gated bootstrap: this commits directly to the default branch (the PR-gate it
# enables does not exist yet) and triggers a NO-OP redeploy on the live repos
# (rumah-admin/property-lead-os/rumah-housing-website) — a CODEOWNERS file is not
# imported into the build, so the deployed artifact is identical. delivery-os + jarvis
# do not deploy. Run from the delivery-os repo root: bash docs/execution/sprint-1.0/install-codeowners.sh
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DIR="docs/execution/sprint-1.0"

MSG="Sprint 1.0: install enforceable CODEOWNERS (author-not-verifier floor)

Route code-owner review to @bkasanwiredjo (a real identity) so
require_code_owner_reviews can bind. Bootstrap governance commit.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"

install_co () {  # repo  default-branch  content-file
  local repo="$1" branch="$2" file="$3" sha
  sha=$(gh api "repos/RUMAH-OS/$repo/contents/CODEOWNERS?ref=$branch" --jq .sha 2>/dev/null || true)
  if [ -n "$sha" ]; then
    gh api -X PUT "repos/RUMAH-OS/$repo/contents/CODEOWNERS" -f message="$MSG" \
      -f content="$(base64 -w0 "$file")" -f branch="$branch" -f sha="$sha" --jq '"  updated @ "+.commit.sha[0:9]'
  else
    gh api -X PUT "repos/RUMAH-OS/$repo/contents/CODEOWNERS" -f message="$MSG" \
      -f content="$(base64 -w0 "$file")" -f branch="$branch" --jq '"  created @ "+.commit.sha[0:9]'
  fi
}

echo "delivery-os (main, no deploy):";              install_co delivery-os                  main   "$DIR/CODEOWNERS.delivery-os"
echo "jarvis (master, no deploy):";                 install_co jarvis-slack-control-surface master "$DIR/CODEOWNERS.consumer"
echo "rumah-admin (main, NO-OP REDEPLOY):";         install_co rumah-admin                  main   "$DIR/CODEOWNERS.consumer"
echo "property-lead-os (main, NO-OP REDEPLOY):";    install_co property-lead-os             main   "$DIR/CODEOWNERS.consumer"
echo "rumah-housing-website (main, NO-OP REDEPLOY):"; install_co rumah-housing-website      main   "$DIR/CODEOWNERS.consumer"

echo; echo "=== VERIFY (every default branch resolves CODEOWNERS to @bkasanwiredjo) ==="
for rb in "delivery-os main" "jarvis-slack-control-surface master" "rumah-admin main" "property-lead-os main" "rumah-housing-website main"; do
  set -- $rb
  owner=$(gh api "repos/RUMAH-OS/$1/contents/CODEOWNERS?ref=$2" --jq '.content' 2>/dev/null | base64 -d | grep -E '^\*' || echo "MISSING")
  echo "  $1 ($2): $owner"
done
