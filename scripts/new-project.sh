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

mkdir -p .claude/base/agents .claude/overlay/agents .claude/agents .claude/skills .claude/hooks .claude/tools docs/adr docs/verify wiki

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

# 2b. Skills (v3 — callable capabilities via the native .claude/skills mechanism)
for s in discovery-interview grill-me migration-assessment principle-11-review production-readiness-review ecosystem-alignment-review verify-gate; do
  mkdir -p ".claude/skills/$s"
  cp "$DOS/skills/$s/SKILL.md" ".claude/skills/$s/SKILL.md"
done

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
cp "$DOS/templates/project-context.md"  docs/project-context.md
cp "$DOS/templates/master-roadmap.md"   docs/master-roadmap.md
cp "$DOS/templates/STATUS.md"           docs/STATUS.md
cp "$DOS/templates/project-log.md"      docs/project-log.md
cp "$DOS/templates/release-readiness.md" docs/release-readiness.md
cp "$DOS/templates/ADR-template.md"     docs/adr/0000-template.md
sed -i.bak "s/<PROJECT>/$PROJECT/g" docs/*.md 2>/dev/null || true; rm -f docs/*.bak

# 5. CLAUDE.md — the v3 ROUTER (the single entrypoint) + wiki index, from templates
cp "$DOS/templates/CLAUDE.md.template"      CLAUDE.md
cp "$DOS/templates/wiki/_index.md.template" wiki/_index.md
sed -i.bak "s/<PROJECT>/$PROJECT/g" CLAUDE.md wiki/_index.md 2>/dev/null || true
rm -f CLAUDE.md.bak wiki/_index.md.bak
# The router is discovery-first by default (template §9). The discovery-interview skill fills §1–3.

# 6. Verify-gate (Governance §12) + the AI-OS mechanisms — installed so a project INHERITS them automatically.
mkdir -p .claude/hooks .githooks docs/verify
cp "$DOS/templates/hooks/verify-gate.mjs"   .claude/hooks/verify-gate.mjs
cp "$DOS/templates/settings.json.template"  .claude/settings.json
cp "$DOS/templates/VERIFY.md.template"      docs/verify/_TEMPLATE.md
cp "$DOS/templates/githooks/pre-push"       .githooks/pre-push
chmod +x .githooks/pre-push 2>/dev/null || true
# AI-OS tools (base+overlay · drift-detection · kernel-render) — consumer-local, inherited by every project
cp "$DOS/templates/tools/os-sync.mjs"        .claude/tools/os-sync.mjs
cp "$DOS/templates/tools/check-os-drift.mjs" .claude/tools/check-os-drift.mjs
cp "$DOS/templates/tools/render-kernel.mjs"  .claude/tools/render-kernel.mjs
printf '{"baseline_ts":0,"impl_extra":[]}' > .claude/.verify-state.json
printf '{"impl_extra":[]}' > .claude/.verify-config.json   # extend impl surface here if implementation lives outside src/
git config core.hooksPath .githooks   # committed pre-push fires for ANY git client (model-independent)

# 6a-ops. Build the live kernel from disk: base+overlay → .claude/agents/, render §5/§6/§9, stamp os_version.
node .claude/tools/os-sync.mjs
node .claude/tools/render-kernel.mjs
node .claude/tools/check-os-drift.mjs || echo "  (drift warnings above are expected at scaffold time)"

# 6b. Branch model: main (protected) + dev (active). Gated first commit.
git add -A
git commit -q -m "chore: scaffold Delivery OS v3 (verify-gate + AI-OS mechanisms installed; Slice 0 NOT verified)" || true
git rev-parse --verify dev >/dev/null 2>&1 || git branch dev 2>/dev/null || true

# 6c. Fail closed — prove EVERY mechanism is wired, or abort (a half-scaffold is not a project).
for f in .claude/settings.json .claude/hooks/verify-gate.mjs .githooks/pre-push docs/verify/_TEMPLATE.md \
         .claude/tools/os-sync.mjs .claude/tools/check-os-drift.mjs .claude/tools/render-kernel.mjs \
         .claude/.verify-config.json; do
  [ -f "$f" ] || { echo "FATAL: AI-OS mechanism not installed ($f missing). Aborting (Governance §12)."; exit 1; }
done
[ -d .claude/base/agents ] || { echo "FATAL: base+overlay not wired (.claude/base/agents missing). Aborting."; exit 1; }

echo "✓ Scaffolded '$PROJECT' (packs: ${PACKS:-none})"
echo "  git: initialized · branches main+dev · verify-gate + drift-lint enforced (.claude/settings.json + .githooks/pre-push)"
echo "  AI-OS mechanisms installed: base+overlay (.claude/{base,overlay}) · tools (.claude/tools/) · version stamp · kernel render"
echo "  .claude/agents/ (rendered from base+overlay): $(ls .claude/agents | tr '\n' ' ')"
echo "  .claude/skills/: $(ls .claude/skills | tr '\n' ' ')"
echo "  wrote CLAUDE.md (v3 router, discovery-first) + wiki/_index.md + docs/{PROJECT-BRIEF,PROJECT-MISSION,NORTH-STAR}.md stubs"
echo ""
echo "NEXT — do NOT jump to roadmap/architecture. Start the discovery phase:"
echo "  Tell Claude: \"Install Delivery OS and initialize this repository.\""
echo "  (or paste delivery-os/BOOTSTRAP-PROMPT.md) → it runs the Founder Discovery Interview,"
echo "  generates BRIEF/MISSION/NORTH-STAR from your answers, then reviews ecosystem alignment."
echo "  Only after that: roadmap, ADRs, architecture (GETTING-STARTED.md §2)."
