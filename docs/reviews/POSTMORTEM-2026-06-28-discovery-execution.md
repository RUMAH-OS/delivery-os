---
artifact: POSTMORTEM
date: 2026-06-28
topic: Discovery ≥20-contacts goal — pipeline + execution-process failure
board: 4 blind lenses (timeline-archaeology, execution-postmortem, seed-architecture, governance-architecture) + adversarial critic
status: ROOT CAUSES CONVERGED (3/4 lenses in); governance design + adversarial-consensus + implementation = IN PROGRESS
---

# Postmortem — Discovery ≥20 contacts: the pipeline *and* the execution process

## A. The reframe (timeline lens — production evidence)
**The Discovery pipeline has NEVER produced ≥20 contacts in production. The all-time prod high is 8 cards, today.** Before today's flag-enablement, prod held 0 leads / 0 contacts (`DISCOVERY_ENABLED` unset, disabled-by-design; the "503" was the *intended* disabled response). The only "≥22 leads + ≥20 contacts" on record is a #210 **test** run. So "stuck at 8" is **a ceiling never exceeded, not a regression** — there is no last-known-good ≥20. The "before the migration it worked" premise is not supported by the production data. *Chasing a non-existent regression baseline compounded the failure.*

## B. The binding constraint (timeline + seed lenses, independently confirmed)
**Lead VOLUME, gated by a structurally-blocked SEED.** `runDiscovery` (the only code that finds net-new companies) is *technically wired but functionally inert* — three compounding blockers, the third fatal:
1. Advance-first starvation (`discovery-sweep.ts:466`) — seed skipped whenever any lead is in the advance backlog (almost always).
2. 24h seed cadence (`discovery-sweep-deps.ts:266`).
3. **FATAL:** a 30s seed slice (`sweepSeedBudgetMs=30_000`) racing a ~300s `runDiscovery` that has **no AbortSignal seam** → the deadline always fires first → the run is orphaned → **zero net-new companies ever persist.** The only completing path (`POST /api/discover`, 300s) has no cron and is POST (crons are GET).
**Volume math for a *stable* ≥20 A-tier contacts:** ~10–12 A-leads → ~30–50 qualified leads → **~75–120 net-new researched companies sustained by daily seeding.** Current ~5 leads is ~10× short. **No throughput tuning closes a 10× gap — only sustained seeding.** The ~10 per-lead fixes (#216–#227) are real and correct but *orthogonal* (throughput, not volume) — they finish the existing 5, add zero companies.

## C. The execution-process meta-failure (execution-postmortem lens — the founder's core ask)
**The structural answer was committed to the repo ~9 hours and ~10 PRs before the process stopped, and ignored.** PR #217's VERIFY (06-28 02:06) states in writing: *"≥20 contacts reachable from current leads — FALSE … Reaching ≥20 requires MANY more leads seeded … does not manufacture lead volume."* The Founder Review reached that exact conclusion at 11:13.
- **Pattern:** layer-by-layer symptom-chasing inside a never-re-examined frame — the loop optimized *per-lead qualify probability* while the acceptance criterion was *lead volume* (orthogonal). Each green per-slice deploy re-baited "one more fix."
- **Missed stop points:** RCA-CONVERGED (22:47, named the seed as the only growth lever) · **#215 (00:22 — the inversion that *guaranteed* the deadlock: seed-last while every later PR kept the backlog non-clearing)** · **#217 (02:06 — the written hard stop)** · **the principle-11 mercury panel (08:42) itself inherited the false "5→≥20" frame** and did not test it.
- **Un-monitored signals:** `/api/floor` = 8 cards from 01:52Z through 11:13 — the metric that defined "done" **never moved across ~9 cycles and nothing watched it**; the population stayed at 5 (zero net-new); the same 3 staffing-agency leads recycled through every PR; a human forced the halt twice.
- **The gap, exactly:** there was a per-slice verify gate (which *worked* — a verifier wrote the correct structural finding at 02:06) but **no goal-delta gate and no no-forward-progress detector above it.** A verifier's *goal-level* finding had no mechanism to halt the engineering loop.

## D. The minimal structural fix (seed lens — Design A, recommended)
A dedicated seed cron on its own 300s route (`app/api/cron/discovery-seed/route.ts`) calling `runDiscovery` **directly** (not through the time-boxed sweep) + one `vercel.json` cron line. Removes all three blockers at once; reuses the spend cap, enablement flags, auth pattern. Rejected: Design B (worker-queue — `packages/queue`/`apps/worker` are empty `export {}` placeholders; over-engineering); B1 (resumable `runDiscovery` refactor — not minimal).

## E. Permanent governance improvements (governance lens — the `redirect` rung)
**Root architectural gap:** `goal-stop.mjs` has exactly two rungs — `continue` (default) and `cap-trip` (the H1 wall-clock/turn ceiling → forced halt). The goal-state carries *work counters* (turns, time) but **no objective metric** — the hook can see time passing, never that `floor`=8 is pinned. Between "continue forever" and "blow the cap," there is **no rung that detects no-progress and auto-redirects.** H7 detects a repeated *boundary* signature, but every cycle here was a "successful" fix-verify-merge that didn't move the metric — H7 is blind to it.

**The fix — one new `redirect` rung** between continue and cap-trip, driven by an acceptance-metric ledger, that auto-invokes an in-loop structural review and *switches approach without halting.* Strictly **more** autonomous (the founder-forced step-back now fires automatically + early).

**Data spine:** extend `.goal-state.json` with `acceptance{metric,op,target,probe}` + append-only `progress[]{turn,value,predicted,fix_ref}` + `confidence` + `strategy{current,switches,max_switches}`. **Invariant: `clears_on` stays the structural pair — the metric STEERS strategy, NEVER gates exit** (do not reintroduce the human-gated-terminal bug).

**5 mechanisms (all readers of the ledger):**
1. **Acceptance-criteria monitoring** — `goal-init --metric/--op/--target/--probe` + a new main-loop tool `goal-progress.mjs` records each cycle's value+prediction (optionally self-measures via `probe`). Makes the flat line machine-visible. *Would have stamped `value:8, predicted:20` every cycle from #214.*
2. **No-progress/deadlock detection** — `detectStall()` over a window N=4: zero forward delta → `redirect` (not halt). *Fires ~#217–#218 instead of #226.*
3. **Confidence scoring** — predicted-forward but actual≈0 → decay ×0.6; `<0.3` → `redirect`. Captures "confident-and-wrong." *Fires ~#216–#217.* (Fire on **either** M2 ∨ M3.)
4. **Strategy-switch trigger (the `redirect` rung)** — M2/M3 fires → auto-invoke `principle-11-review` at `architecture` class **autonomously** (internal panel, not a founder gate) asking "next-fix or structural-redesign?" → (a) redirect+continue on a new strategy, (b) keep-going (false-positive, cost = one panel), (c) escalate via `founder-action-package` **only if** a genuine founder decision is needed. Bounded by `strategy.max_switches=3`; after that + metric still flat → boundary FAP (ledger + panel verdicts as evidence).
5. **Milestone checkpoints** — at every 25% of `cap.maxTurns`, trajectory-projection; if `projected_final` misses target → the M4 panel. Backstop for slow drift.

**State ladder:** continue → **redirect (NEW)** → escalate → cap-trip. **Core trade-off (load-bearing):** fire the cheap in-loop panel *eagerly* — a false positive costs one review cycle (autonomy-preserving); a missed deadlock costs what happened here (hours, 10+ PRs, a founder-forced halt). Eager-trigger + cheap-auto-adjudicator.

**Invariants preserved:** `clears_on` structural (metric steers, never gates); kernel-trigger / policy-content split (trigger in the hook, content in the skill); one-source-of-truth (reuse principle-11, no new review skill); H1 cap untouched; **no new founder gate, no autonomy reduction** — the only new rung *adds* autonomous redirection.

**Files:** `templates/tools/goal-stop.mjs` (M2/M3/M5 + the redirect rung in `evaluate()`), `goal-init.mjs` (acceptance + milestone capture), NEW `templates/tools/goal-progress.mjs`, `boundary-classify.mjs` (a `stall`/`redirect` sibling of boundary/transient/failure), `skills/principle-11-review` (reused content), `capabilities/GOAL-EXECUTION-CONTRACT.md` (H9: metric-driven auto-redirect).

## E2. Adversarial critic — CONSENSUS (corrections that change the design)
**Root causes: consensus, with 2 corrections.** (1) The "10× short / per-lead fixes orthogonal / add-zero" arithmetic is OVERSTATED — it contradicts `FOUNDER-REVIEW…:44-47` ("~15-25, borderline"). Correct claim: *5 leads → ~15-25 UNSTABLE; durable ≥20 needs seeding.* (2) "Known-futile ~9 hours" is UNFAIR — #218-#227 fixed genuinely prod-broken infra (SerpAPI/Playwright/telemetry-masking/search-cap) that every path to ≥20 requires. Correct charge: *necessary infra fixes done in the WRONG PRIORITY ORDER inside an un-re-examined frame.* Nuance for the founder: the "it worked before" premise is traceable to #210's test-VERIFY which asserted "≥20 contacts" without loudly flagging it was a **mocked-provider `plos_test`** run — a real artifact that read like prod.

**Governance: the auto-panel `redirect` rung is REJECTED.** It re-instantiates the failure it diagnoses: the 08:42 mercury panel (4 blind lenses + critic) STILL inherited the "5→≥20" frame (`DECISION-REVIEW-mercury…:66`). Lens-independence cured cross-lens contamination, NOT the shared false-premise framing question. Architecturally a Stop hook (`goal-stop.mjs evaluate()` → `{block, reason}`) CANNOT spawn fresh independent context — it only steers the same frame-captured agent. What broke the frame here was a human halt + fresh blind lenses re-deriving from scratch.

**CONSENSUS governance design (amplify the signal that WORKED — the 02:06 independent verifier):**
1. **Verifier-driven acceptance-delta gate (primary).** Add a required VERIFY frontmatter field `goal_metric_reachable: true|false` (+ `metric_value`/`target`); the existing `verify-gate.mjs` (already parses VERIFY frontmatter) ESCALATES / emits a FAP when a verifier marks the goal-metric unreachable or unmoved across slices. #217's VERIFY already wrote this in prose — the gap was no teeth. Reuses author≠verifier (the reliable, frame-breaking signal). No new kernel rung, no probe I/O.
2. **Ship M1 — the metric ledger** (`goal_metric`/`progress[]` made machine-visible each cycle), coupled to verifier-escalation, NOT auto-redirect.
3. **DEFER M2/M3/M4 auto-redirect** until frame-inheritance is solved: the panel (if ever added) must RE-DERIVE "is target reachable from current inputs?" from scratch, independent of the stated target. Keep `probe` network I/O OUT of the kernel `goal-stop.mjs` (preserve its zero-I/O fail-closed posture).
4. (Optional) periodic founder-checkpoint at milestone % — a human is the independence source that actually breaks frames.

## F. Implementation (post-consensus) — ORDER
1. **Governance (consensus design):** the verifier-driven acceptance-delta gate in `verify-gate.mjs` + the M1 metric ledger; amend `GOAL-EXECUTION-CONTRACT.md` (H9 = verifier-driven goal-delta escalation, NOT auto-panel); inherit (manifest + scaffolder). Defer the auto-redirect rung.
2. **Business fix — seed Design A:** dedicated `app/api/cron/discovery-seed` 300s route calling `runDiscovery` directly + one `vercel.json` cron line.
3. Migrate workflows → verify in prod → Foundation / Founder / Learning reviews documenting what failed, why the architecture allowed it, and how it's now prevented.
