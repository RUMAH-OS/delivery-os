# G14 — Ownership Routing Policy + Ownership Gate (specialist ownership, 2026-06-15)

> Founder: "Agent Exists ≠ Agent Used; Agent Used ≠ Agent Owns Work." The next milestone is not
> *agent exists* — it is *the correct specialist owns the work*. Evaluate a formal Ownership Routing Policy
> + an Ownership Gate (Required Owner / Actual Owner / Ownership Status PASS|FAIL). Runtime-backed.

## Diagnosis: WHY specialist ownership is low (the honest answer)
Not perception, not corpus composition — **misrouting + missing enforcement.** Runtime evidence
(`build-ownership-probe.mjs`, independently verified, **bypass-on-OWN-TURF** measurement):
| Specialist turf | Real work (mutations) | Specialist's share | Who actually built it |
|---|---|---|---|
| Frontend (`admin-ui/`, `*.tsx`) | 326 | frontend-engineer **5.5%** | Claude 67.5% + software-engineer 25.5% |
| DB / migration (`migrations/`, `*.sql`) | 55 | database-data **0%** | Claude 65.5% + software-engineer 27.3% |
| API / seam (`*-api.ts`, events) | 43 | api-integration **0%** | software-engineer 62.8% + Claude 34.9% |
OS-tooling is only 16.8% of mutations; product code is 34.3% — so the "recent work was just OS-tooling"
hypothesis is **rejected**. There WAS substantial work on each specialist's exact turf, and on every turf the
specialist did ≤5.5% while Claude + the general builder did the rest. **Root causes, ranked:**
1. **No routing policy / missing enforcement** — nothing says "frontend → frontend-engineer," so the
   orchestrator (Claude) defaults to the general builder or inline editing.
2. **software-engineer became a catch-all** — the default builder for any non-trivial build, regardless of specialty.
3. **Claude-inline-for-speed** — 52% of build is Claude directly (orchestration overhead avoided by editing inline).
NOT a perception artifact (telemetry confirms), NOT "no specialist work happened" (there was plenty).

## The 5 questions, answered from evidence
1. **Do we have specialist routing discipline?** **No.** Bypass-on-turf is the proof (frontend-engineer 5.5% on frontend; database-data/api-integration 0% on their turf).
2. **How often are specialists bypassed for Claude/software-engineer?** Frontend: **93%** of frontend work bypassed the specialist. DB: **100%**. API: **100%**.
3. **What work needs a required specialist owner?** Frontend · DB/migration · API/integration · knowledge · workflow (general backend stays software-engineer). See the policy below.
4. **Would an Ownership Routing Policy improve adoption?** **Yes** — a declarative work-type→owner map makes the correct specialist the *default*, replacing ad-hoc routing that collapses to software-engineer/Claude.
5. **Would an Ownership Gate improve adoption?** **Yes, staged** — report-only Required/Actual/Status FIRST (visible every slice), escalating to a hard block once baselined. A premature hard gate adds friction on trivial edits; visibility first, enforcement second.

## The Ownership Routing Policy (declarative; the work-type → required-owner map)
| Work type | Detect by (changed-file globs) | Required BUILD owner | Advisors/verifiers |
|---|---|---|---|
| Frontend | `admin-ui/**`, `*.tsx` | **frontend-engineer** | frontend-architect · ux-reviewer · founder-experience-reviewer · qa-test |
| DB / migration | `migrations/**`, `*.sql` | **database-data** | lead-architect · qa-test · security-compliance (PII) |
| API / integration | `src/*-api.ts`, `src/ops-api.ts`, events/seam | **api-integration** (build) | integration-architect (contract) · security-compliance · qa-test |
| Knowledge | `wiki/**`, `memory/**`, capability docs, ADRs | **knowledge-engineer** | independent verifier · founder (ratify) |
| Workflow | multi-surface operator flows | workflow specialist + **builder per surface** | workflow-reviewer · customer-journey-reviewer · product-designer |
| Backend / general / tooling | `src/**` (non-api), `scripts/**`, `.claude/**` | **software-engineer** | qa-test · reviewer-critic |
| Trivial edit | 1-file, < small N lines, non-product | inline (Claude) allowed | — |

## The Ownership Gate (Required / Actual / Status — per slice)
In `slice-close` / the Operating-Model Check, per slice: detect dominant work-type from changed files → look up
Required Owner → determine Actual Owner (who made the build mutations) → emit:
```
Work Type: Frontend · Required: frontend-engineer · Actual: software-engineer · Status: 🔴 FAIL
Work Type: Frontend · Required: frontend-engineer · Actual: frontend-engineer · Status: ✅ PASS
```
**Staged enforcement:** Phase 1 **report-only** (every slice shows Required/Actual/Status; bypass is visible,
never blocks). Phase 2 **hard gate** (`--block`: a specialist's turf built by the wrong owner → push blocked),
adopted only after the baseline is seen and the trivial-edit exemption is tuned.

## G14 proof requirements (added to the V6 backlog)
- **P1 Policy declared** — the work-type→owner map exists as config (`.claude/ownership-policy.json` or OS-vendored), single-sourced.
- **P2 Required/Actual/Status visible** — the Operating-Model Check / slice record shows it every slice (report-only).
- **P3 Routing discipline applied** — frontend/DB/API/knowledge slices route to the specialist owner; the **bypass-on-turf rate declines** (frontend-engineer's frontend share ↑ from 5.5%, database-data/api-integration off 0).
- **P4 Specialists OWN their turf** — each specialist USED with material-effect on its turf (Built ≠ Used ≠ Owns).
- **P5 (escalation) Ownership Gate** — hard-block a slice whose specialist turf was built by the wrong owner (founder-ratified before enforcing).
**Measured by the standing Operating-Model Check** (the Build-Ownership dimension already live: per-builder share + IDLE-SPECIALIST flags; G14 adds the Required/Actual/Status per-slice view). **Not more agents — the correct specialist owning the work.** PLOS-decoupled.

## Guardrail (unchanged)
Routing/ratification/§11/security-sign-off/agent-creation stay with Claude. The Ownership Gate enforces WHO
BUILDS; it never delegates the WHO-DECIDES (orchestration) or the author≠verifier check.
