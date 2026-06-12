#!/usr/bin/env bash
# Delivery OS — new project scaffolder.
# Run from the ROOT of your new (empty-ish) project, after adding delivery-os
# as a submodule or copy. Creates .claude/agents/, CODEOWNERS, and docs/ from templates.
#
# Usage:   bash delivery-os/scripts/new-project.sh "<Project Name>" "<pack1,pack2,...>"
# Example: bash delivery-os/scripts/new-project.sh "Rumah Admin" "internal-admin,crm"
# Packs:   public-web internal-admin crm contracts-signatures invoicing api-first ai-product
set -euo pipefail

PROJECT="${1:?Project name required}"
PACKS="${2:-}"
DOS="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # delivery-os root

# 0. Git is the enforcement substrate (Governance §12: no git ⇒ CODEOWNERS/CI/verify-gate are inert).
#    Fail closed — a scaffold that can't enforce author≠verifier must not be presented as ready.
command -v git >/dev/null 2>&1 || { echo "FATAL: git not found. Delivery OS requires git (Governance §12)."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "FATAL: node not found. The verify-gate hook requires Node."; exit 1; }
if [ ! -d .git ]; then
  git init -q
  git symbolic-ref HEAD refs/heads/main 2>/dev/null || true   # default branch = main (protected/stable)
fi
git rev-parse --git-dir >/dev/null 2>&1 || { echo "FATAL: git init failed."; exit 1; }

# (v4/F6: no wiki/ — the wiki layer is retired; see case-studies/2026-06-wiki-citation-survival.md.
#  Knowledge lives in three-tier memory: memory/doctrine + memory/<project> + derived state.)
mkdir -p .claude/base/agents .claude/overlay/agents .claude/agents .claude/skills .claude/hooks .claude/tools \
         .claude/commands docs/adr docs/verify memory/doctrine "memory/project" tests/helpers scripts

# 1. Lean-default agents (always) → COPIED-BASE (pristine; never hand-edit; os-sync builds .claude/agents/ from it + overlay)
for a in software-engineer qa-test reviewer-critic lead-architect documentation; do
  cp "$DOS/agents/$a.md" ".claude/base/agents/$a.md"
done

# 2. Pack agents (prefix stripped) → COPIED-BASE
add() { local src="$1"; local name; name="$(basename "$src" | sed 's/^domain--//;s/^optional--//')"; cp "$DOS/agents/$src.md" ".claude/base/agents/$name.md"; }
IFS=',' read -ra LIST <<< "$PACKS"
for p in "${LIST[@]}"; do case "$(echo "$p" | xargs)" in
  public-web)          add optional--seo; add optional--design-parity;;
  internal-admin)      add domain--security-compliance; add domain--database-data;;
  crm)                 add domain--database-data; add domain--api-integration; add domain--security-compliance;;
  contracts-signatures)add domain--security-compliance; add domain--database-data;;
  invoicing)           add domain--security-compliance; add domain--database-data; add domain--api-integration;;
  api-first)           add domain--api-integration; add domain--database-data; add domain--security-compliance;;
  ai-product)          add domain--ai-product; add domain--database-data; add domain--api-integration;;
  "" ) ;; *) echo "WARN: unknown pack '$p' (skipped)";; esac; done

# 2b. Skills (v4 — ALWAYS-ON CORE PACK + the discovery phase pack; B34 fixes the inert-skill pattern).
#     Migration pack (legacy-migration-etv, cutover-execution) + platform packs (skills/platform/*) are
#     PULL-ON-NEED at the phase that needs them — copy the same way then. grill-me is retired (X2);
#     production-readiness-review is folded into principle-11-review (X3).
for s in verification principle-11-review executable-contracts cross-system-reality-audit friction-triage \
         gate-ledger instruments-audit learning-review decision-ratification write-back-gate \
         debugging-and-error-recovery verify-gate ecosystem-alignment-review \
         discovery-interview migration-assessment; do
  mkdir -p ".claude/skills/$s"
  cp "$DOS/skills/$s/SKILL.md" ".claude/skills/$s/SKILL.md"
done
# 2c. Slash commands — the one-keystroke trigger tier (B33)
cp "$DOS"/templates/commands/*.md .claude/commands/

# 3. CODEOWNERS (structural author != verifier)
cat > CODEOWNERS <<'EOF'
# Delivery OS: one owner per file; verifier cannot edit what it grades.
*            @software-engineer
/tests/      @qa-test
/e2e/        @qa-test
/evals/      @qa-test
/docs/       @owner
/CODEOWNERS  @owner
EOF

# 4a. Discovery STUBS (filled by the founder interview, NOT pre-assumed)
cp "$DOS/templates/PROJECT-BRIEF.md"    docs/PROJECT-BRIEF.md
cp "$DOS/templates/PROJECT-MISSION.md"  docs/PROJECT-MISSION.md
cp "$DOS/templates/NORTH-STAR.md"       docs/NORTH-STAR.md

# 4b. Planning docs (used AFTER discovery)
#     (v4/X4: STATUS.md + project-log.md are NOT scaffolded — their DoD rows were required, nonexistent,
#      and unnoticed; their job is done by derived state, git history, and the DECISIONS ledger.)
cp "$DOS/templates/project-context.md"  docs/project-context.md
cp "$DOS/templates/master-roadmap.md"   docs/master-roadmap.md
cp "$DOS/templates/release-readiness.md" docs/release-readiness.md
cp "$DOS/templates/ADR-template.md"     docs/adr/0000-template.md

# 4c. The four registries (v4/T4) — day-1 files; the friction log is the sole intake from founder reality.
cp "$DOS/templates/DECISIONS.md.template"    docs/DECISIONS.md
cp "$DOS/templates/INVARIANTS.md.template"   docs/INVARIANTS.md
cp "$DOS/templates/gates.md.template"        docs/gates.md
cp "$DOS/templates/friction-log.md.template" docs/friction-log.md

# 4d. Three-tier memory (v4/B17/K5): the portfolio doctrine seed travels on day 1 — THE inheritance mechanism.
cp "$DOS/templates/memory/doctrine-seed.md"  memory/doctrine/doctrine-seed.md
printf '# Project memory (nouns stay local)\n\nProject-specific lessons land here via the write-back step. STATE is never stored here - it is derived.\n' > "memory/project/README.md"

sed -i.bak "s/<PROJECT>/$PROJECT/g" docs/*.md 2>/dev/null || true; rm -f docs/*.bak

# 5. CLAUDE.md — the v4 ROUTER (the single entrypoint; hand half + derived half). No wiki (F6).
cp "$DOS/templates/CLAUDE.md.template"      CLAUDE.md
sed -i.bak "s/<PROJECT>/$PROJECT/g" CLAUDE.md 2>/dev/null || true
rm -f CLAUDE.md.bak
# The router is discovery-first by default (template §9). The discovery-interview skill fills §1–3.

# 5a. Environment hygiene, day 1 (v4/B20 — incidents 3/4/9 were all environment lessons learned by breakage)
[ -f .gitattributes ] || printf '# Delivery OS (v4): one line-ending truth - no CRLF churn across machines/worktrees.\n* text=auto eol=lf\n*.png binary\n*.jpg binary\n*.pdf binary\n' > .gitattributes
[ -f .gitignore ] || printf 'node_modules/\ndist/\nbuild/\ncoverage/\n.env\n.env.*\n!.env.example\n.worktrees/\n' > .gitignore
[ -f .env.example ] || printf '# NEVER COMMIT a real .env - this file is the documented shape only (v4/B27).\n# Secrets travel via the secret store / out-of-band; .env is gitignored from day one.\n' > .env.example
# Worktree isolation default (engineer sessions run in worktrees; one once broke the founder's live dev server)
cat > scripts/dev-worktree.sh <<'WT'
#!/usr/bin/env bash
# Delivery OS (v4/B20): engineer sessions run in ISOLATED WORKTREES, never on the founder's live checkout.
#   scripts/dev-worktree.sh new <branch>   # create .worktrees/<branch> on a new branch
#   scripts/dev-worktree.sh gc             # prune merged/stale worktrees (locked dirs accumulate otherwise)
set -euo pipefail
case "${1:-}" in
  new) b="${2:?branch name required}"; git worktree add ".worktrees/$b" -b "$b"; echo "worktree: .worktrees/$b";;
  gc)  git worktree prune -v; echo "worktree gc: pruned stale entries";;
  *)   echo "usage: $0 new <branch> | gc"; exit 1;;
esac
WT
chmod +x scripts/dev-worktree.sh 2>/dev/null || true
# Test harness guard (v4/B29): tests may only run against a *_test database.
cp "$DOS/templates/test-harness/assert-test-database.mjs" tests/helpers/assert-test-database.mjs

# 5b. Vendor the DOCTRINE (copied-base) so the router's delivery-os/core|discovery pointers RESOLVE
#     (mechanism/policy §13, operating loop, DoD, governance, the discovery gate travel WITH the project).
# Guard (v4 verifier Major): in the documented vendored layout, $DOS *is* ./delivery-os —
# the cp would copy a directory into itself (delivery-os/core/core) and abort the scaffold
# under set -e. The doctrine is already in place there; copy only when DOS lives elsewhere.
if [ "$(cd "$DOS" && pwd)" != "$(pwd)/delivery-os" ]; then
  mkdir -p delivery-os
  cp -r "$DOS/core"      delivery-os/core
  cp -r "$DOS/discovery" delivery-os/discovery 2>/dev/null || true
fi

# 6. Verify-gate (Governance §12) + the AI-OS mechanisms — installed so a project INHERITS them automatically.
mkdir -p .claude/hooks .githooks docs/verify
cp "$DOS/templates/hooks/verify-gate.mjs"   .claude/hooks/verify-gate.mjs
cp "$DOS/templates/hooks/sibling-probe.mjs" .claude/hooks/sibling-probe.mjs   # v4/B8: peer reality at session start
cp "$DOS/templates/settings.json.template"  .claude/settings.json
cp "$DOS/templates/VERIFY.md.template"      docs/verify/_TEMPLATE.md
cp "$DOS/templates/manifest.schema.json"    docs/manifest.schema.json         # v4/T6: the capability-manifest shape (generator is project code)
cp "$DOS/templates/githooks/pre-push"       .githooks/pre-push
chmod +x .githooks/pre-push 2>/dev/null || true
# AI-OS tools (base+overlay · drift-detection · kernel-render · skill lint · merge gate) — consumer-local
cp "$DOS/templates/tools/os-sync.mjs"        .claude/tools/os-sync.mjs
cp "$DOS/templates/tools/check-os-drift.mjs" .claude/tools/check-os-drift.mjs
cp "$DOS/templates/tools/render-kernel.mjs"  .claude/tools/render-kernel.mjs
cp "$DOS/templates/tools/validate-skills.mjs" .claude/tools/validate-skills.mjs   # v4/B37: fail-closed format lint (pre-push Gate 3)
cp "$DOS/templates/tools/merge-pr.mjs"       scripts/merge-pr.mjs                 # v4/B4: the only sanctioned merge path (DoD row 9)
printf '{"baseline_ts":0}' > .claude/.verify-state.json
# record the OS VERSION CONSUMED (the version boundary; v4/F1: consumers adopt by PIN, never mint versions)
OS_VERSION="$(git -C "$DOS" describe --tags --always 2>/dev/null || echo untagged)"
printf '{"impl_extra":[],"os_version":"%s","peers":[],"feedback_backstop_commits":30}' "$OS_VERSION" > .claude/.verify-config.json   # extend impl_extra if implementation lives outside src/; list sibling repos in peers
git config core.hooksPath .githooks   # committed pre-push fires for ANY git client (model-independent)
# PATH-stripped hook smoke test (v4/B20): the gate must fail CLOSED (push blocked), never OPEN, on a shell
# without node on PATH (incident 9: hooks were never smoke-tested against stripped shells).
if env -i PATH=/nonexistent /bin/sh .githooks/pre-push </dev/null >/dev/null 2>&1; then
  echo "  WARN: pre-push hook PASSED under a PATH-stripped shell — it may fail OPEN; investigate before relying on it."
else
  echo "  PATH-stripped hook smoke: pre-push fails CLOSED without node on PATH (expected; re-wire PATH per your machine runbook)."
fi

# 6a-ops. Build the live kernel from disk: base+overlay → .claude/agents/, render §5/§6/§9, stamp os_version.
node .claude/tools/os-sync.mjs
node .claude/tools/render-kernel.mjs
node .claude/tools/check-os-drift.mjs || echo "  (drift warnings above are expected at scaffold time)"

# 6b. Branch model: main (protected) + dev (active). Gated first commit.
git add -A
git commit -q -m "chore: scaffold Delivery OS v4 (verify-gate + registries + memory tiers + skill packs installed; Slice 0 NOT verified)" || true
git rev-parse --verify dev >/dev/null 2>&1 || git branch dev 2>/dev/null || true

# 6c. Fail closed — prove EVERY mechanism is wired, or abort (a half-scaffold is not a project).
for f in .claude/settings.json .claude/hooks/verify-gate.mjs .claude/hooks/sibling-probe.mjs .githooks/pre-push \
         docs/verify/_TEMPLATE.md docs/manifest.schema.json \
         .claude/tools/os-sync.mjs .claude/tools/check-os-drift.mjs .claude/tools/render-kernel.mjs \
         .claude/tools/validate-skills.mjs scripts/merge-pr.mjs \
         docs/DECISIONS.md docs/INVARIANTS.md docs/gates.md docs/friction-log.md \
         memory/doctrine/doctrine-seed.md tests/helpers/assert-test-database.mjs \
         .gitattributes .env.example .claude/.verify-config.json; do
  [ -f "$f" ] || { echo "FATAL: v4 mechanism not installed ($f missing). Aborting (Governance §12)."; exit 1; }
done
[ -d .claude/base/agents ] || { echo "FATAL: base+overlay not wired (.claude/base/agents missing). Aborting."; exit 1; }
[ -f delivery-os/core/GOVERNANCE.md ]   || { echo "FATAL: doctrine not vendored (delivery-os/core/GOVERNANCE.md missing) — router pointers would dangle. Aborting."; exit 1; }
grep -q '"os_version"' .claude/.verify-config.json || { echo "FATAL: OS version boundary not recorded. Aborting."; exit 1; }
node .claude/tools/validate-skills.mjs || { echo "FATAL: installed skill pack fails the format lint. Aborting."; exit 1; }

echo "✓ Scaffolded '$PROJECT' (packs: ${PACKS:-none})"
echo "  git: initialized · branches main+dev · verify-gate + drift-lint + skill-lint enforced (.claude/settings.json + .githooks/pre-push)"
echo "  v4 inheritance: four registries (DECISIONS/INVARIANTS/gates/friction-log) · memory/{doctrine,project} (doctrine seed copied)"
echo "  mechanisms: merge gate (scripts/merge-pr.mjs) · sibling probe · manifest schema · test-DB guard · worktree helper · CRLF policy · .env NEVER-COMMIT"
echo "  .claude/agents/ (rendered from base+overlay): $(ls .claude/agents | tr '\n' ' ')"
echo "  .claude/skills/ (always-on core pack + discovery pack): $(ls .claude/skills | tr '\n' ' ')"
echo "  .claude/commands/ (slash triggers): $(ls .claude/commands | tr '\n' ' ')"
echo "  wrote CLAUDE.md (v4 router, discovery-first) + docs/{PROJECT-BRIEF,PROJECT-MISSION,NORTH-STAR}.md stubs  (no wiki — F6)"
echo ""
echo "NEXT — do NOT jump to roadmap/architecture. Start the discovery phase:"
echo "  Tell Claude: \"Install Delivery OS and initialize this repository.\""
echo "  (or paste delivery-os/BOOTSTRAP-PROMPT.md) → it runs the Founder Discovery Interview,"
echo "  generates BRIEF/MISSION/NORTH-STAR from your answers, then reviews ecosystem alignment."
echo "  Only after that: roadmap, ADRs, architecture (GETTING-STARTED.md §2)."
