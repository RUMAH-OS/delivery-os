# V6 Portfolio Rollout Plan — Delivery OS as the single operational system (DRAFT)

> Plan only (PLOS frozen; all PLOS steps founder-gated). How Admin · PLOS · Rumah · Jarvis · future
> projects come to operate through one Delivery OS. Disk-verified, not assumed. DRAFT — founder ratifies.

## Disk-verified ground truth
- **N=2 is real:** `rumah-website/.claude/os/INHERITED.json` exists (13 files = Admin's 11 pins + `inventory-properties-v1.mjs`/`.d.mts`); os:check PASS. First non-Admin project inheriting-and-running-green.
- **PLOS mirrors, doesn't inherit:** no `INHERITED.json`; `packages/integrations/src/admin-events-consumer.ts` + `scripts/validate-admin-seam.mjs` hand-copy the event envelope. Drift risk is concrete.
- **os-inherit has NO subset/profile mechanism:** `os-inherit.mjs plan()` vendors the ENTIRE flat `os-foundation.manifest.json` into every project → Rumah is **over-inherited** (got dispatch-route/agent-route/experience-gate/workflow-gate/learning-review — orchestration tooling a static marketing app never calls).

## The honest correction
The answer to "should Rumah inherit more?" is **no — it should inherit LESS.** Over-inheritance has a maintenance cost (Tier-2 drift fails Rumah's os:check for tools it never invokes) and zero benefit. The fix is **tiered inheritance**, which is a prerequisite build (os-inherit has no subset today).

## The inheritance unit — 3 tiers (replaces the flat manifest)
- **Tier 0 — governance spine** (EVERY project): the fail-closed gates + os-inherit/os:check + the seam/contract validators. Minimal, universal.
- **Tier 1 — contracts consumed** (per need): e.g. `inventory-properties-v1` (Rumah), `admin-plos-seam-v1` (PLOS). A project inherits only the contracts it actually consumes.
- **Tier 2 — orchestration + engine** (only projects that ORCHESTRATE): dispatch-route, the routers, the execution engine, learning-review.
Implemented as an additive `profiles` block on the ONE manifest + a `--profile` flag on the ONE os-inherit — NOT a second propagation path. Tool canonical / data + workflow definitions per-project (the proven pattern).

## Per-project rollout
| Project | State today | Profile | Plan |
|---|---|---|---|
| **Admin** | proving ground, N=1 source (11 files) | orchestrator (all tiers — legitimately) | done/ongoing; promotion waves continue |
| **Rumah** | N=2 inherit PROVEN; live round-trip OWED; OVER-inherited (13 files) | Tier 0 + inventory contract (~7 files) | inherit LESS: drop the orchestration tier; flip `lib/inventory.ts` to the vendored contract (done); prove a drift-gate catch + one live round-trip = closes its N-gate |
| **PLOS** | FROZEN; mirrors the seam; no INHERITED.json | Tier 0 + `admin-plos-seam-v1` + (orchestrates) Tier 2 w/ BullMQ adapter | **[ALL FOUNDER-GATED]** ratify unfreeze → adopt os-inherit → STOP mirroring (import vendored contract, delete hand-copy) → os:check green → live round-trip w/ `workflow-gate fullyProven:true` = **N=3** |
| **Jarvis / greenfield** | n/a | orchestrator | day-one `os-inherit sync --profile orchestrator`; CI drift-gate from first commit; consume ≥1 capability via `capability-consume` against `GET /v1/capabilities`. The thin-bootstrap end-state |

## Sequencing + gates (N=k = inherit AND run-green per project)
1. **S1** build tiered `profiles` (re-sync Admin = no-op) — SAFE.
2. **S2** Rumah profile-fix (inherit less) + live round-trip — SAFE.
3. **S3** promote the orchestration tier to canonical (ledger waves 1–4 + the engine) — SAFE, Admin-internal.
4. **S4 PLOS unfreeze — FOUNDER-GATED** (the unblock).
5. **S5** PLOS adopt + stop-mirroring + round-trip = **N=3**.
6. **S6** Jarvis greenfield = N=4.
7. **DEFER** execution-engine cross-project distribution until a 2nd orchestrator exists.

## Top risks
- **R1 over-inheriting** light apps (Rumah) → the tiering fix.
- **R2 mirrored-contract drift** until PLOS inherits (concrete: PLOS hand-copies the envelope today).
- **R3 the pgmq/BullMQ engine queue boundary** — one proven path (SKIP LOCKED), two needed; BullMQ unproven (bounded to PLOS per ECR-0005).
- **R4 per-project CODEOWNERS/ownership** governance.
- **R5 the dishonest N-gate** — do NOT claim "portfolio operational" while round-trips are owed.
- **R6 profiles forking the propagation path** — keep it ONE manifest + ONE os-inherit, additive.

## Definition of done (measurable)
"Delivery OS is the single operational system" = `operationalMembers ≥ 3 total with ≥2 non-Admin`, each satisfying **inherit + consume-via-contract (not mirrored) + gates-green + one live round-trip**, AND **mirror-count = 0** on all active seams. Single tracked number: `operationalMembers / activeProjects` with the non-Admin floor.
**Today: operationalMembers = 1 (Admin); Rumah owes its round-trip; PLOS frozen; mirror-count = 1. DoD NOT met** — this plan does not claim portfolio-operational.

## The one founder decision that unblocks the most
**Unfreeze PLOS for inheritance adoption (scoped: "adopt os-inherit + retire the mirrored seam," not all PLOS work).** It is a decision, not a build: kills R2, closes the PLOS axis of success-criteria #6/#8, makes N=3 reachable, and first-exercises the BullMQ adapter. Everything else (profiles, Rumah, Jarvis) is SAFE and proceeds without it.
