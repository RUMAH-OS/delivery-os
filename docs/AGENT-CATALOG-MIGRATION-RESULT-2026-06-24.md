# Agent Catalog Migration — execution result (2026-06-24)

> Executes `AGENT-SYSTEM-AUDIT-2026-06-24.md`. This slice establishes the **framework's single canonical
> operative catalog** and makes the previously-unreachable authored agents spawnable. Done via the canonical
> primitive (`os-sync`), verified drift-clean. Cross-repo re-sync + custom-agent promotion are staged follow-ups.

## What was done (delivery-os, branch `feat/canonical-agent-catalog`)
1. **Installed the 9 missing authored agents into the operative base** (`.claude/base/agents/`), prefix-normalized:
   `deployment-operator · project-manager · database-data · security-compliance · api-integration · ai-product ·
   accessibility · design-parity · seo-validation` (from `agents/domain--*` / `optional--*` / the two un-prefixed).
2. **Fixed the catalog orphan:** authored `founder-experience-reviewer.md` into `agents/` (it was installed but not authored — would be lost on a clean re-install).
3. **Normalized naming:** dropped the `domain--`/`optional--` prefixes on install; fixed `seo` → `seo-validation` so every spawnable file's name == its `name:` frontmatter (the harness spawns by `name`).
4. **Re-synced** via `os-sync` (the canonical base+overlay→`.claude/agents` primitive) and pruned the one stale spawnable left by the rename.

## Result (verified)
| Metric | Before | After |
|---|---|---|
| delivery-os spawnable agents | **7** | **16** |
| name ↔ filename match | n/a | **16/16 OK** |
| `tools` frontmatter present | — | **16/16** |
| `check-os-drift` | OK | **OK (still clean)** |
| CODEOWNERS handles backed | yes | yes |

**New spawnable specialists (next session):** deployment-operator · project-manager · database-data ·
security-compliance · api-integration · ai-product · accessibility · design-parity · seo-validation.
The framework can now spawn its own domain/ops/coordination specialists — removing the `general-purpose`
catch-all bottleneck the audit measured.

## Verification of "agents can be discovered + spawned correctly"
- **Discoverable:** all 16 are well-formed (`name`==filename, `description`, `tools`), in `.claude/agents/`, drift-clean. ✅
- **Structurally spawnable:** the 9 additions are **byte-shape-identical** to the 7 agents that already spawn (same `name`/`description`/`tools` frontmatter; none of the catalog uses the v6 `kind/capabilities/triggers` fields — that router tooling is ahead of the files, pre-existing). ✅
- **HONEST LIMIT — live spawn:** the harness loads the spawnable-agent-type registry **at session start**, so the 9 new agents become spawnable in the **next session**, not this one. This is a framework constraint, not a defect — verification of an actual spawn must happen in a fresh session (the structural identity above is the in-session proof).

## Staged follow-ups (the rest of the audit's migration plan)
- **M5 — consumer re-sync:** re-install the reconciled base into PLOS + Admin (heals Admin's base drift; shrinks overlays to truly-local). *Cross-repo; through each repo's own gate.*
- **M3 — promote Admin's 8 custom agents** to canonical (frontend-architect/engineer, product-designer, ux-reviewer, customer-journey-reviewer, knowledge-engineer, workflow-reviewer, qa-reviewer) + author the 3 net-new specialists (workflow-engine, operations/SRE, research-synthesist).
- **agents/ naming:** regenerate the authored `agents/` to mirror the normalized operative catalog (drop the `domain--`/`optional--` prefixes at the source) so there is one naming convention end-to-end.
- **M6 — drift-gate:** assert each consumer's `.claude/base/agents/*` == canonical in CI (catch Admin-style base drift); assert no spawnable orphan lacks a source.
- **M7 — GC** the 14 stale `property-lead-os/.claude/worktrees/agent-*` dirs via `git worktree prune`/`remove` (deferred — other-repo git state).
- **v6 note:** no agent carries `kind/capabilities/triggers`; if v6 deterministic routing is intended, the agent files need those fields (separate framework-evolution slice).

## Parallel-execution playbook (now enabled)
With the full roster spawnable, future work fans out to the *right* specialist in parallel:
Research (research-synthesist ∥ Explore) · Planning (lead-architect + project-manager + §11 blind panel: database-data ∥ security-compliance ∥ ai-product) · Implementation (software-engineer ∥ database-data ∥ integration-architect ∥ deployment-operator) · Verification (qa-test ∥ reviewer-critic ∥ security-compliance ∥ founder-experience-reviewer) · Rollout (deployment-operator + production-readiness) — with **project-manager as the standing coordinator**.
