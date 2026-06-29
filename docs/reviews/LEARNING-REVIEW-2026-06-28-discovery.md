---
review_type: learning-review
capability: "Autonomous Discovery to a quantitative acceptance metric (PLOS '>=20 live A-score contacts')"
date: "2026-06-28"
author: "incident-review session (coordinated; blind-board + adversarial-critic sourced)"
status: lessons-captured — fed to delivery-os/capabilities/signals.jsonl
verdict_one_line: "OUTCOME (2): >=20 unreachable on the current architecture (seed all-or-nothing persistence under a 300s kill). The deeper learning is the META-FAILURE: the structural answer was committed at 02:06 in PR #217's VERIFY and ignored for ~9 hours / ~10 PRs while a frame-locked loop optimized the wrong variable."
evidence_base:
  - delivery-os/docs/reviews/POSTMORTEM-2026-06-28-discovery-execution.md
  - property-lead-os/docs/verify/VERIFY-seed-cron-design-a.md
  - property-lead-os/docs/audits/RCA-CONVERGED-discovery-plos-2026-06-27.md
  - property-lead-os/docs/reviews/DECISION-REVIEW-2026-06-28-mercury-gate-relaxation.md
  - PLOS PR history #205–#229
---

# Learning Review — Discovery ">=20 contacts": converting the incident into capability

> A milestone is not closed until experience becomes **capability**. This review reconstructs the incident
> from artifacts, names every hypothesis (the ones that worked and the ones that didn't), pinpoints **where
> governance should have interrupted and didn't**, and feeds each lesson to the ledger as a
> skill/agent/gate/automation candidate — or as a **strengthened** capability where a capability *failed to
> catch* something.

---

## 1. The reconstructed timeline (evidence-anchored)

All times 2026-06-27/28 UTC. PR merge times from `gh`; document timestamps as cited.

| Time | Event | Artifact |
|---|---|---|
| 22:47 (06-27) | **RCA-CONVERGED** names the SEED as the only growth lever; dual root cause (reachability + empty/un-seeded) | `RCA-CONVERGED-discovery-plos-2026-06-27.md` |
| 17:24–18:41 | Deploy + reachability fixes: config-doctor (#205), lazy bootstrap (#206), CLI pin (#207), `connect_timeout` (#208) | PRs #205–#208 |
| 19:10 | **`statement_timeout` (#209)** — load-bearing reachability fix; **0/60 hangs** | PR #209 |
| 20:26 | Seed cron (#210) — **test-verified >=22 leads / >=20 contacts … on MOCKED `plos_test` providers** | PR #210 |
| 22:00–23:18 | Sweep wall-clock guard (#214), **budget-gate the seed step (#215, 00:22 → advance-first/seed-last)**, per-call timeouts (#216) | PRs #214–#216 |
| **02:06 (06-28)** | **PR #217's VERIFY writes the structural hard stop in prose:** *">=20 reachable from current leads — FALSE … requires MANY more leads seeded."* | PR #217 / its VERIFY |
| 00:45–03:18 | self-heal cadence (#218), agent-runs surface (#219), SerpAPI fix (#220), serverless Chromium (#221), search cap 6→12 (#222), diagnosable fetch errors (#223) | PRs #218–#223 |
| 07:06–07:55 | retry-once transient (#224), **truthful telemetry — un-mask phantom failures (#225)** | PRs #224–#225 |
| **08:42** | **principle-11 mercury panel (4 blind lenses + critic)** — STILL inherits the "5->=20" frame | `DECISION-REVIEW-2026-06-28-mercury-gate-relaxation.md` |
| 08:41–10:05 | soft-deadline emit (#226), **force-emit fallback (#227)**, **dedicated seed cron Design A (#228)** | PRs #226–#228 |
| ~10:09 / 10:17 | **Seed run in PROD ×2 → both killed at 300s, 0 net-new companies persisted** | `VERIFY-seed-cron-design-a.md` |
| 11:13 | Founder Review independently reaches the #217 conclusion | `FOUNDER-REVIEW-2026-06-28-discovery-20-contacts.md` |
| (post) | PR #229 records the live result — "the lever did NOT fire (4th blocker)" | PR #229 |

**The whole window: `/api/floor` = 8 cards / 5 companies from 01:52Z to 11:13. The metric never moved.**

---

## 2. The meta-failure (the founder's core ask) — why a correct loop ran ~9 hours past its own answer

**The structural answer existed in the repo at 02:06 and nothing consumed it.** This is the central lesson,
and it has four named parts:

1. **The signal was generated correctly — and had no teeth.** An independent verifier (author!=verifier,
   working as designed) wrote in PR #217's VERIFY: *">=20 reachable from current leads — FALSE."* The
   verify-gate validates **slices**; there was **no goal-delta gate** to act on a *goal-level* finding. The
   right answer sat in a merged document for ~9 hours / ~10 PRs.
2. **Frame-lock.** Every cycle inherited the premise **"5 leads → get to 20"** and optimized **per-lead
   qualify-probability** — when the acceptance criterion was **lead VOLUME** (orthogonal). Each green per-slice
   deploy re-baited "one more fix." The loop never re-examined the frame.
3. **The floor was un-monitored across ~9 cycles.** The metric that *defined done* (`/api/floor`=8) was flat
   from 01:52Z to 11:13 and **nothing watched it.** Population stayed at 5; the same 3 staffing-agency leads
   recycled every PR; a **human forced the halt twice.**
4. **Even the strongest independence instrument inherited the frame.** The **08:42 principle-11 panel** (4
   blind lenses + adversarial critic) cured cross-lens contamination but **STILL accepted "5->=20" as given**
   and did not test reachability. **Lens-independence ≠ premise-independence.** This is the proof that an
   in-loop auto-panel would have re-instantiated the failure (see §4).

**Missed stop points (each a place the loop should have re-derived, not pressed on):**
`RCA-CONVERGED` (22:47, named the seed) · **#215 (00:22 — the advance-first/seed-last inversion that
*guaranteed* the deadlock: seed-last while every later PR kept the backlog non-clearing)** · **#217 (02:06 —
the written hard stop)** · the **08:42 mercury panel** (inherited the frame).

---

## 3. Every hypothesis — what worked, what didn't, and the chain that finally converged

The session walked a **symptom ladder**, each rung fixing a real defect that *unmasked* the next. The chain:
**deadline → tools → budget → cap → telemetry → soft-deadline → force-emit → seed → seed-persistence.**

| Rung | Hypothesis | PRs | Outcome |
|---|---|---|---|
| reachability | "app hangs on cold-start connect" → bound establishment | #208 | **Partly right, insufficient.** The hang was pool-acquire, not connect. |
| reachability | "hang is pool-acquire/query queuing" → `statement_timeout` | #209 | **CORRECT & load-bearing.** 0/60 hangs. (Blind board caught the #208→#209 correction.) |
| **deadline** | "the sweep route 504s because the seed isn't time-boxed" → wall-clock guard + budget-gate seed | #214, #215, #216 | **Real fix, but #215 introduced the seed-last inversion** → seed effectively never ran. |
| **tools** | "research tools are silently broken in prod" → SerpAPI no-results, serverless Chromium, diagnosable errors | #220, #221, #223 | **CORRECT, necessary** (every path to >=20 needs them) — but **orthogonal to volume.** |
| **budget** | "leads fail because research runs out of budget" → raise per-lead budget, search cap 6→12, self-heal cadence | #217, #218, #222 | **Real throughput fixes** — finish the existing 5, **add zero companies.** |
| **cap** | "spend cap mis-fires / mis-accounts" → cap tuning | (#222 region) | Necessary guardrail; later revealed the **invisible-spend latent** (§5). |
| **telemetry** | "the failures are phantom — telemetry is lying" → un-mask aborted-signal retries | #219, #225 | **CORRECT & high-value** — proved many "failures" were reporting artifacts. |
| **soft-deadline** | "the model ignores the deadline and dies at the hard ceiling" → soft deadline → emit nudge | #226 | Real fix for the slow staffing-agency leads. |
| **force-emit** | "nudge isn't enough — force the emit" → tool-removal + code-synthesis fallback | #227 | Real fix — recovers stuck leads. **Still does not grow the funnel.** |
| **seed** | "the funnel is frozen — give the seed its own 300s lane" → Design A dedicated cron (removes the 3 in-sweep blockers) | #228 | **Structurally correct on the 3 known blockers** — but exposed the 4th. |
| **seed-persistence** | "does runDiscovery actually persist within 300s live?" → **run it in prod ×2** | #229 | **FALSIFIED. Both killed at 300s, 0 persisted.** The real architectural limit: **all-or-nothing commit** (`discovery.ts:258-350`). |

**Two adversarial-critic corrections the board ratified (carry these, they correct overstatement):**
- The "10× short / per-lead fixes add ZERO" arithmetic is **OVERSTATED.** Correct claim: 5 leads → **~15–25
  UNSTABLE**; a *durable* >=20 needs seeding. (Reconciles `FOUNDER-REVIEW…:44-47`.)
- "Known-futile for ~9 hours" is **UNFAIR.** #218–#227 fixed genuinely prod-broken infra that **every path to
  >=20 requires.** The correct charge is **necessary fixes in the WRONG PRIORITY ORDER inside an
  un-re-examined frame** — not wasted work.
- The "it worked before" premise traces to **#210's test-VERIFY asserting ">=20 contacts" without loudly
  flagging it was a MOCKED-provider `plos_test` run** — a real artifact that read like prod. **A ceiling, not
  a regression.** (POSTMORTEM §A, §E2.)

---

## 4. Where governance should have interrupted — and the design that's actually safe

**The gap, exactly:** there was a per-slice verify gate (which *worked*) but **no goal-delta gate and no
no-forward-progress detector above it.** A verifier's goal-level finding had **no mechanism to halt the loop.**

**The design the board CONVERGED on (consensus — amplify the signal that worked at 02:06):**
1. **PRIMARY — verifier-driven acceptance-delta gate.** A required VERIFY frontmatter field
   `goal_metric_reachable: true|false` (+ `metric_value`/`target`); `verify-gate.mjs` (already parses VERIFY
   frontmatter) **ESCALATES / emits a FAP** when a verifier marks the goal-metric unreachable or unmoved
   across slices. #217 already wrote this in prose — the gap was teeth. **Reuses author!=verifier** (the
   reliable, frame-breaking signal). No new kernel rung, no probe I/O.
2. **Ship M1 — the metric ledger.** `goal_metric` + append-only `progress[]{turn,value,predicted,fix_ref}`
   made machine-visible each cycle. Would have stamped `value:8, predicted:20` from #214 on.
3. **DEFER the auto-redirect panel (M2/M3/M4).** **REJECTED as proposed** — it re-instantiates the failure it
   diagnoses: the 08:42 panel STILL inherited the frame, and a Stop-hook (`goal-stop.mjs evaluate()`) **cannot
   spawn fresh independent context** — it only steers the same frame-captured agent. If ever added, the panel
   must **RE-DERIVE "is the target reachable from current inputs?" from scratch, independent of the stated
   target**, and `probe` network I/O stays OUT of the zero-I/O fail-closed kernel.
4. **(Optional) periodic founder checkpoint at milestone %** — a human is the independence source that
   actually breaks frames (it's what broke this one).

**Invariant preserved:** `clears_on` stays the structural pair — **the metric STEERS strategy, it never gates
exit** (do not reintroduce the human-gated-terminal bug).

---

## 5. The architectural lessons (the durable ones)

- **L1 — Atomic persistence is incompatible with a hard wall-clock kill.** A unit of work that must commit
  all-or-nothing **must fit inside the lane's ceiling, or it persists nothing.** Long-horizon work under a
  compute cap needs **checkpointed/chunked commit or a longer lane** — designed in, not discovered in prod.
- **L2 — Cost accounting must be durable independently of the work it accounts for.** Write-ahead the spend
  *outside* the result transaction, or a killed/rolled-back run hides real money from the cap.
- **L3 — A fail-closed flag must surface as health, not as an error code.** `503 {disabled:true}` cost a whole
  hypothesis branch. Disabled != broken; make it observably so.
- **L4 — Lens-independence is not premise-independence.** Blind multi-lens panels cure cross-lens
  contamination but **inherit a shared false frame.** Frame-breaking requires re-deriving the premise from
  scratch (or a human) — not more independent lenses on the same question.
- **L5 — Mock-provider test artifacts must self-label loudly.** A `plos_test` VERIFY that asserts a prod-shaped
  metric ("≥20 contacts") without screaming "MOCKED" becomes a phantom regression baseline.
- **L6 — Symptom-laddering inside a fixed frame is locally rational and globally wrong.** Each green slice was
  correct; the *order* and the *unexamined frame* were the failure. A goal-delta gate is the architectural
  answer to "10 correct fixes that don't move the metric."

---

## 6. Capability ledger feed (every lesson → a candidate or a strengthened capability)

| Lesson | Capability action | Type |
|---|---|---|
| L1 seed persistence | **Candidate:** "long-horizon work under a compute ceiling uses checkpointed/chunked commit or a dedicated long-lane" — a deploy/architecture doctrine + a pre-merge check for atomic-write-vs-maxDuration mismatch | candidate |
| L2 invisible spend | **Candidate:** write-ahead cost-accounting pattern (record spend before/outside the result txn) | candidate |
| W4/W5 governance | **Strengthen verify-gate:** `goal_metric_reachable` frontmatter field + `verify-gate.mjs` goal-delta escalation; ship the M1 metric ledger (`goal_metric`/`progress[]`) | strengthened capability |
| L4 frame-lock | **Strengthen principle-11-review:** add an explicit "RE-DERIVE the premise / is-the-target-reachable-from-current-inputs" lens that does NOT accept the stated frame; deferred auto-redirect stays deferred | strengthened capability |
| #209 / blind RCA win | **PRESERVE (anti-regression):** the blind, independent RCA board caught the #208→#209 mechanism correction (opposite remedies). Keep the structure. | preserve |
| author!=verifier | **PRESERVE:** the floor produced the correct structural answer at 02:06 — the verifier is not the gap; the missing teeth are. | preserve |

---

## 7. Closing

The capability "autonomous Discovery to a quantitative acceptance metric" is **not yet delivered**, and the
honest reason is **architectural** (L1), not effort. The session's engineering was real and mostly correct;
its **process** was the failure — a frame-locked loop with no goal-delta gate ran ~9 hours past its own
written answer. The two durable outputs of this incident are: (1) the **seed persistence redesign** is the
single business lever; and (2) the framework must not run another long-horizon goal without the **verifier-
driven goal-delta gate + the M1 metric ledger.** Both are now in the ledger as the next capability work.
