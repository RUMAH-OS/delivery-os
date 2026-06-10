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

mkdir -p .claude/agents docs/adr

# 1. Lean-default agents (always)
for a in software-engineer qa-test reviewer-critic lead-architect documentation; do
  cp "$DOS/agents/$a.md" ".claude/agents/$a.md"
done

# 2. Pack agents (prefix stripped)
add() { local src="$1"; local name; name="$(basename "$src" | sed 's/^domain--//;s/^optional--//')"; cp "$DOS/agents/$src.md" ".claude/agents/$name"; }
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

# 5. CLAUDE.md — encodes "discovery first" so Claude knows it in every session
cat > CLAUDE.md <<EOF
# $PROJECT

This project follows **Delivery OS** (\`delivery-os/\`). Agents: \`.claude/agents/\`.
Packs: ${PACKS:-none}. Loop: \`delivery-os/core/OPERATING-LOOP.md\`; Definition of Done:
\`delivery-os/core/DEFINITION-OF-DONE.md\` + the active pack rows.

## FIRST RESPONSIBILITY (before any roadmap, ADR, architecture, or code)
Run **Project Discovery & Alignment** (\`delivery-os/discovery/DISCOVERY-WORKFLOW.md\`):
1. Conduct the Founder Discovery Interview (\`delivery-os/discovery/FOUNDER-INTERVIEW.md\`) —
   ask, reflect back, **do not assume**; mark unknowns \`TBD — to confirm\`.
2. Generate \`docs/PROJECT-BRIEF.md\`, \`docs/PROJECT-MISSION.md\`, \`docs/NORTH-STAR.md\`
   from the founder's answers; get approval on each.
3. Review Ecosystem alignment (entities owned vs consumed; source-of-truth; dependencies).
4. Gate on \`delivery-os/discovery/PROJECT-DISCOVERY-CHECKLIST.md\`.
**Only after those are approved** may you create the roadmap, ADRs, and architecture.

## Always-on rules
Author ≠ verifier (CODEOWNERS). Honest failure (no false success). Irreversible actions
are human-gated. One source of truth per entity. De-risk early. Evidence over assumptions.
EOF

echo "✓ Scaffolded '$PROJECT' (packs: ${PACKS:-none})"
echo "  .claude/agents/: $(ls .claude/agents | tr '\n' ' ')"
echo "  wrote CLAUDE.md (discovery-first) + docs/{PROJECT-BRIEF,PROJECT-MISSION,NORTH-STAR}.md stubs"
echo ""
echo "NEXT — do NOT jump to roadmap/architecture. Start the discovery phase:"
echo "  Tell Claude: \"Install Delivery OS and initialize this repository.\""
echo "  (or paste delivery-os/BOOTSTRAP-PROMPT.md) → it runs the Founder Discovery Interview,"
echo "  generates BRIEF/MISSION/NORTH-STAR from your answers, then reviews ecosystem alignment."
echo "  Only after that: roadmap, ADRs, architecture (GETTING-STARTED.md §2)."
