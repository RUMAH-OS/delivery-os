---
name: v6-migration-audit
version: 1.0.0
stability: stable
description: >
  Pre-cutover knowledge-preservation gate for a v5→v6 migration. Inventories EVERY knowledge asset in a
  project (memories, skills, wiki pages, lessons, patterns, workflows, founder-learnings, decision records)
  and assigns each an explicit destination — preserved, promoted, or rescued — so NOTHING proven is lost in
  the migration. Fail-closed: the cutover is blocked until every asset has a destination and LOST = 0.
kind: review
class: OS-foundational
capabilities: [pre-cutover knowledge audit, capability census, classify knowledge destination, no-knowledge-loss gate, v5 to v6 migration inventory]
triggers: [audit knowledge before the v6 cutover, capability census before migration, make sure no lesson is lost in the migration, inventory what knowledge exists and where it goes, knowledge preservation plan for v6]
decision_class: governance
inputs:  [the project's memory/ entries, .claude/skills/, wiki/, docs/ (lessons/retros/ADRs/decision-reviews), capability-backlog, founder-learning notes]
outputs: [a migration-audit table (asset → destination → status) + the no-loss verdict; LOST rows become rescue tasks before cutover]
earned_from: "founder requirement 2026-06-15 — 'no proven skill, lesson, pattern, workflow or founder-learning disappears during the migration; the upgrade is complete only when knowledge is preserved or promoted, not lost.'"
---
# v6 Migration Audit — no knowledge is lost in the cutover

A v6 cutover is **not** "the project now runs the new tools." It is "every proven thing the project learned is
**preserved or promoted**, nothing dropped." This audit is the gate that proves it.

## The destination taxonomy (every asset gets exactly one)
- **MEMORY** — a fact / context / founder-preference that stays a memory entry (not a capability). Preserved as-is.
- **WIKI / PRESERVED-DOC** — an explanation/playbook that stays documentation (the "wiki explains" layer).
- **CAPABILITY (project-local)** — a recurring lesson/pattern that becomes a skill/agent/gate/automation in the
  project's backlog/ledger (executes, doesn't just describe).
- **INHERITED-SKILL (OS-foundational)** — a proven capability promoted to delivery-os so EVERY future project
  inherits it via the canonical path (os-inherit). The compounding step.
- **LOST (must rescue)** — an asset with no destination yet. **This is the gate's enemy.** Cutover is blocked
  while any LOST row exists.

## Method
1. **Inventory exhaustively** — walk memory/, .claude/skills/, wiki/, docs/ (retros, ADRs, decision-reviews,
   lessons), the capability-backlog, and any founder-learning notes. Every distinct knowledge asset is a row.
2. **Classify destination** — assign each row exactly one destination above, with the concrete target (which
   memory stays; which becomes which capability; which promotes to delivery-os as an inherited skill).
3. **Cross-check against the canonical ledger** — anything classified CAPABILITY or INHERITED-SKILL must appear
   (or be added) in the ONE `delivery-os/capabilities/CAPABILITY-LEDGER.md`. No second ledger.
4. **Feed the census** — recurring lessons (≥3×, per `census-detector`) MUST be CAPABILITY/INHERITED, not MEMORY.
   A lesson that recurs and is left as MEMORY is a misclassification.
5. **Verdict (fail-closed)** — produce the audit table; the cutover is GO only when **LOST = 0** and every
   CAPABILITY/INHERITED row is actually represented in the ledger. Any LOST row → a rescue task, cutover BLOCKED.

## The no-loss gate
The migration is complete **only** when this audit shows: every inventoried asset preserved (MEMORY/WIKI),
promoted (CAPABILITY/INHERITED-SKILL), and zero LOST. "Promoted or preserved, never lost" — re-run the audit
until the verdict is GO.
