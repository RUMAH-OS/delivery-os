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

# 4. Day-one docs from templates
cp "$DOS/templates/project-context.md"  docs/project-context.md
cp "$DOS/templates/master-roadmap.md"   docs/master-roadmap.md
cp "$DOS/templates/STATUS.md"           docs/STATUS.md
cp "$DOS/templates/project-log.md"      docs/project-log.md
cp "$DOS/templates/release-readiness.md" docs/release-readiness.md
cp "$DOS/templates/ADR-template.md"     docs/adr/0000-template.md
sed -i.bak "s/<PROJECT>/$PROJECT/g" docs/*.md 2>/dev/null || true; rm -f docs/*.bak

echo "✓ Scaffolded '$PROJECT' (packs: ${PACKS:-none})"
echo "  .claude/agents/: $(ls .claude/agents | tr '\n' ' ')"
echo "Next: fill docs/project-context.md, write docs/adr/0001-*, draft docs/master-roadmap.md,"
echo "      add DoD pack rows (delivery-os/domain-packs/PACKS.md), wire CI validation harness,"
echo "      register in ecosystem-architecture (see GETTING-STARTED.md §4)."
