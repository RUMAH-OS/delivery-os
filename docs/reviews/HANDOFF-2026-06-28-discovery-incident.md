---
artifact: INCIDENT-HANDOFF
date: 2026-06-28
incident: PLOS Discovery — ">=20 live A-score contacts" goal
disposition: CLOSED — outcome (2) proven (acceptance criteria not achievable on the current architecture; exact limit identified)
purpose: official handoff / design input for the next Delivery OS initiative (Operating Model v2 — NOT yet designed/built)
---

# Official Incident Handoff — PLOS Discovery >=20 contacts

## 0. Executive conclusion (one screen)
The goal ("the live PLOS UI consistently contains >=20 real selectable A-score contacts, generated entirely
by the production Discovery pipeline") is **NOT achievable on the current architecture**, and the exact
architectural limitation is **proven with production evidence** (not another implementation bug):

> **`runDiscovery` (the seed — the only code that finds net-new companies) exceeds Vercel's 300s `maxDuration`
> ceiling with live providers, and persists all-or-nothing in one trailing `db.transaction` with no incremental
> checkpoint. When the run is killed at 300s, the transaction rolls back → ZERO companies persist.** Triggered
> twice in prod (2026-06-28): both killed at 300s, company-count delta = 0, zero `discovery` runs recorded.

Corollaries proven this session: the pipeline **never produced >=20 in production** (the all-time prod high is
8 cards today; the only ">=20" on record is a mocked-provider #210 *test*) — so this was a **ceiling never
exceeded, not a regression**. The remaining fix is the **seed persistence model**, not the cron wiring.

## 1. Artifact index (the handoff package)
| Artifact | Location | What it holds |
|---|---|---|
| Consolidated postmortem (4 blind lenses + critic) | `delivery-os/docs/reviews/POSTMORTEM-2026-06-28-discovery-execution.md` | root causes, the execution meta-failure, the governance consensus design |
| Founder Review (final) | `property-lead-os/docs/reviews/FOUNDER-REVIEW-2026-06-28-FINAL.md` *(in progress)* | zero-tech: what was asked, what's true, the one decision needed |
| Foundation Review | `…/FOUNDATION-REVIEW-2026-06-28-discovery.md` *(in progress)* | architectural weaknesses that allowed this |
| Learning Review | `…/LEARNING-REVIEW-2026-06-28-discovery.md` *(in progress)* | lessons → capability ledger |
| First Founder Review (the step-back) | `property-lead-os/docs/reviews/FOUNDER-REVIEW-2026-06-28-discovery-20-contacts.md` | the manual halt that surfaced the structural limit |
| Mercury-gate decision-review (principle-11) | `property-lead-os/docs/reviews/DECISION-REVIEW-2026-06-28-mercury-gate-relaxation.md` | the mid-stream panel that inherited the false frame |
| Converged RCA + 5 blind RCAs | `property-lead-os/docs/audits/RCA-CONVERGED-…` + `RCA-*-2026-06-27.md` | the reachability/tool/telemetry root causes |
| Seed-cron production evidence | `property-lead-os` PR #228 (merged) + PR #229 (docs evidence) + `docs/verify/VERIFY-seed-cron-design-a.md` | the two killed-at-300s seed runs, 0 companies |

## 2. Production evidence (the proof of outcome 2)
- Seed cron (Design A) verified (author!=verifier), merged (PR #228), deployed; route live + fail-closed (401 on bad bearer).
- Triggered twice (secret-safe GH workflow): both `curl (28) timeout after 300000ms, 0 bytes` (HTTP 000 — Vercel 300s kill).
- `/api/floor` distinct companies: **5 before → 5 after (identical IDs)**; cards 9→9; `discovery` agent_runs for the trigger: **0**. Company-count delta = **0**.
- Root cause in source: `runDiscovery` writes companies/leads + the run row in one trailing `db.transaction` (`discovery.ts:258-350`) — no checkpoint → >300s kill = full rollback = nothing persisted.
- Spend: <€2 total, under the €5 cap. **Latent finding:** killed runs roll back their cost row → spend invisible to `evaluateSpendCap`; the daily 05:00 cron would burn unrecorded spend for zero result → **fail-safe applied: `DISCOVERY_SEED_ENABLED=0` in prod** (route inert, code stays deployed for the fix).

## 3. Architectural findings (Foundation)
1. **The seed has no compute lane for its true runtime.** A multi-search SerpAPI+Playwright+Anthropic job needs minutes; a Vercel serverless route caps at 300s. The architecture put a long job behind a short-window primitive.
2. **All-or-nothing persistence.** No incremental/idempotent checkpoint means any over-budget run loses everything — the failure is silent (no row even records).
3. **Disabled-by-design flag read as a crash** (the original "503").
4. **Killed-runs spend is invisible to the cap** (rolled-back cost row).
5. **No goal-delta gate above the per-slice verify gate** (see §4).

## 4. Governance findings (the execution meta-failure)
The structural answer was committed in **PR #217's VERIFY at 02:06 ("≥20 from current leads = FALSE … needs
many more seeded")** and ignored for ~9 hours / ~10 single-layer PRs, until a human forced the halt twice.
Pattern: **layer-by-layer symptom-chasing inside a never-re-examined frame** — the loop optimized per-lead
qualify-rate while the criterion was lead volume (orthogonal); `/api/floor`=8 never moved across ~9 cycles and
nothing watched it; even the 08:42 principle-11 panel inherited the "5→≥20" frame. **The gap: a verifier's
goal-level finding had no mechanism to halt the loop.** Correction from the critic: #218–#227 were *necessary
infra fixes done in the wrong priority order*, not "futile."

## 5. Remaining limitations
- **Volume is unreachable** until the seed persistence model is fixed. A *stable* >=20 needs ~75–120 researched
  companies accumulated over days of daily seeding even once seeding works (operational, on top of the
  architectural fix).

## 6. Recommended next steps (prioritized)
1. **Seed persistence redesign (BLOCKER for >=20).** Move `runDiscovery` off the 300s serverless route to a
   lane that fits its runtime, AND make persistence incremental/idempotent so partial progress survives:
   - **(A) GitHub Actions worker** (recommended for orchestration — no 300s ceiling, already the deploy/trigger
     substrate; the 300s limit is the decisive GH-Actions-vs-Vercel evidence) or a dedicated worker
     (`packages/queue`/`apps/worker` exist as placeholders); **(B)** chunked/batched `runDiscovery` that commits
     per-company within sub-300s windows; **(C)** a longer compute lane. Compare in the v2 design.
2. **Spend-cap robustness:** record cost incrementally / before the trailing commit so killed runs are visible to the cap.
3. **Execution governance (the consensus design, deferred to v2):** the verifier-driven goal-delta gate + the
   metric ledger; auto-redirect board panel only once it re-derives reachability *from scratch*.
4. **Then** the operational accumulation: run seeding daily, watch the funnel grow to the sizing in §5.

## 7. Implementation recommendations / scope for the NEXT initiative (Operating Model v2 — design only, not now)
Project Owner orchestration (a persistent owner holding goal + acceptance criteria + re-frame authority);
persistent specialist agents (vs ephemeral spawn-per-task that lost context every cycle); a result bus (the
coordinator's context exhausted this session); heartbeat + scheduler; capability registry; configuration
platform (built this session); automatic blind board meetings (with the frame-inheritance fix); progress
tracking + deadlock detection + strategy switching; **GitHub Actions vs Vercel for long-running orchestration
— recommend GH Actions / worker for any >300s job (the seed lesson).** All grounded in this incident's evidence.

**This package is the official handoff and the design input for Operating Model v2. v2 is NOT yet designed or built.**
