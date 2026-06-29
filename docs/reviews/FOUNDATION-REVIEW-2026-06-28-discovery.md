---
artifact: FOUNDATION-REVIEW
date: 2026-06-28
scope: architectural quality — the structural weaknesses that ALLOWED the Discovery ">=20 contacts" failure
subject: PLOS Discovery seed/pipeline architecture + the delivery-OS execution & governance architecture that ran it
verdict: The goal is unreachable on the current architecture for a SINGLE load-bearing reason — the seed's all-or-nothing persistence under a hard 300s platform ceiling. Six architectural weaknesses (3 product, 3 framework) compounded to allow ~10 hours / ~10 PRs of correct-but-orthogonal work without moving the metric.
evidence_base:
  - delivery-os/docs/reviews/POSTMORTEM-2026-06-28-discovery-execution.md (4 blind lenses + adversarial critic)
  - property-lead-os/docs/verify/VERIFY-seed-cron-design-a.md (the live prod result — both seed runs killed)
  - property-lead-os/docs/audits/RCA-CONVERGED-discovery-plos-2026-06-27.md (5 blind RCA lenses)
  - property-lead-os/docs/reviews/DECISION-REVIEW-2026-06-28-mercury-gate-relaxation.md (the 08:42 principle-11 panel)
  - PLOS PR history #205–#229
---

# Foundation Review — Discovery ">=20 contacts": the architecture that allowed it

> Foundation reviews judge **architectural quality**: not "what bug fired" but "what shape of the system
> made this failure possible, and let it run so long." The definitive outcome — proven in production, both
> seed runs — is **OUTCOME (2): >=20 live A-score contacts CANNOT be achieved with the current
> architecture.** This is an architectural limit of the **seed persistence model**, not another bug.

---

## 0. The one-line architectural verdict

`runDiscovery` (the only code that finds net-new companies) does **all of its hunting** and then commits the
**entire result graph — companies, leads, and the cost row — in one trailing `db.transaction`
(`discovery.ts:258-350`)** with **no incremental checkpoint**, while the only lane it runs on enforces a
**hard 300s `maxDuration` kill** (Vercel). The two facts are architecturally incompatible: a live-provider
run exceeds 300s, is killed *before* the transaction commits, and **all-or-nothing rollback persists zero.**
This is the binding constraint. **Throughput tuning cannot close a volume gap, and no amount of per-lead
correctness can save a seed that never commits.** (Evidence: `VERIFY-seed-cron-design-a.md` "POST-MERGE LIVE
PRODUCTION RESULT" + classified-assumption row "runDiscovery completes inside 300s with live providers =
FALSE in production"; PR #229.)

---

## 1. The product-architecture weaknesses (PLOS Discovery)

### W1 — Single-shot 300s seed with no incremental checkpoint *(the fatal one)*
The seed's persistence is **atomic-at-the-end**: nothing is durable until the final `db.transaction`
commits. Under a platform that hard-kills at 300s, this makes **partial progress worthless** — a run that
finds 18 companies in 290s and is killed at 300s persists **none of them**. Proven in prod 2/2 (10:09,
10:17): `curl: (28) timed out after 300000ms`, 0 bytes, **0 net-new companies, 0 `agent_runs` recorded.**
- **Why it is an architectural weakness, not a bug:** the *correct* behaviour (atomic write = no torn data)
  is the very thing that makes it fail under a wall-clock kill. The design assumed "the unit of work fits in
  the lane." It does not, and there is no seam (no checkpoint, no resumable cursor, no batched commit) to make
  partial work survive. The fix is a **persistence-model redesign** (chunked/checkpointed commit, or a
  sub-300s batched `runDiscovery`, or a longer compute lane) — none of which the current shape supports.
- **Earlier symptom of the same shape:** the in-sweep seed had **three** compounding blockers — a 30s slice
  racing a ~300s call (`sweepSeedBudgetMs`), advance-first starvation (`discovery-sweep.ts:466`), and a 24h
  cadence — that the dedicated cron (PR #228) correctly removed. But removing all three only **revealed** the
  deeper W1: the lane was always too short for an atomic seed. The "4th blocker" was the real one.

### W2 — Disabled-by-design indistinguishable from a crash
`DISCOVERY_ENABLED` unset in prod returns `503 {disabled:true}` from `POST /api/discover` — a **deliberate
inert response**. It read to humans (and to the early investigation) as a **production crash** ("the 503 the
founder saw"). The architecture provides **no observable difference** between "off on purpose" and "broken."
A whole branch of the early hypothesis tree chased a non-existent outage. (Evidence: RCA-CONVERGED §1 Root
cause B.1, §4.3 discovery-pipeline lens: "the 503 is the disabled response, NOT a crash.")
- **Architectural lesson:** a fail-closed flag must surface its state **as health, not as an error code** —
  a disabled subsystem should report `{enabled:false}` on a *health* surface, never a 5xx that mimics failure.

### W3 — Killed runs are invisible to the spend cap *(latent, safety-relevant)*
The daily cap (`evaluateSpendCap`) sums **recorded** `agent_runs.costUsd`. But the cost row is written **inside
the same trailing transaction** as the companies. So a killed run, which already **billed real vendor spend**
(Anthropic/SerpAPI), **rolls back its own cost record** → the cap **cannot see the spend.** A daily 05:00 cron
in this shape burns **unrecorded money every day for zero net-new** until disabled. (Evidence:
`VERIFY-seed-cron-design-a.md` "Latent spend-safety finding"; PR #229.)
- **Architectural lesson:** **cost accounting must be durable independent of the work it accounts for** —
  spend should be recorded *before/outside* the result transaction (write-ahead cost), so a rollback of the
  *work* never erases the record of the *money*. Fail-safe in place: `DISCOVERY_SEED_ENABLED=0`.

---

## 2. The framework-architecture weaknesses (delivery-OS execution & governance)

### W4 — A per-slice verify gate with no goal-delta gate above it *(the governance root cause)*
The verify-gate worked **exactly as designed at the slice level**: an independent verifier, at **02:06**,
wrote the correct structural finding in PR #217's VERIFY — *">=20 contacts reachable from current leads —
FALSE … Reaching >=20 requires MANY more leads seeded … does not manufacture lead volume."* The architecture
**had the right answer in writing ~9 hours and ~10 PRs before the loop stopped** — and **no mechanism
consumed it.** There was a gate that asked "is this slice correct?" but **none that asked "did the goal
metric move?"** A verifier's *goal-level* finding had **no teeth** — no path from "verifier says the target
is unreachable" to "halt/redirect the engineering loop." (Evidence: POSTMORTEM §C; the #217 VERIFY.)
- **Architectural lesson (consensus design, deferred to v2):** add a **verifier-driven acceptance-delta
  gate** — a required VERIFY frontmatter field (`goal_metric_reachable: true|false` + `metric_value`/`target`)
  that the existing `verify-gate.mjs` ESCALATES on when a verifier marks the goal-metric unreachable or
  unmoved across slices. This **amplifies the signal that already worked** (the independent verifier) rather
  than inventing a new rung. *Reuses author≠verifier — the reliable, frame-breaking signal.*

### W5 — No no-forward-progress detector on the acceptance metric
`/api/floor` read **8 cards from 01:52Z through 11:13** — the exact metric that defined "done" — and **nothing
watched it.** The population stayed at **5 companies**; the same **3 staffing-agency leads** recycled through
every PR; a **human had to force the halt twice.** The goal-state (`goal-stop.mjs`) carries **work counters**
(turns, wall-clock) but **no objective acceptance metric** — the hook can see *time passing*, never that
*floor=8 is pinned.* Between "continue forever" and "blow the H1 cap," there is **no rung that detects
no-progress.** Every cycle here was a "successful" fix-verify-merge that **didn't move the metric** — and H7
(repeated-boundary detection) is blind to a *successful* slice. (Evidence: POSTMORTEM §C "un-monitored
signals" + §E "root architectural gap.")
- **Architectural lesson:** ship the **M1 metric ledger** — `goal_metric` + an append-only `progress[]`
  recording `{turn, value, predicted, fix_ref}` each cycle, **made machine-visible.** It would have stamped
  `value:8, predicted:20` every cycle from PR #214 onward, making the flat line impossible to miss.
  **Couple it to W4's verifier-escalation, NOT to an auto-redirect rung** (see W6).

### W6 — Ephemeral, spawn-per-task agents lose the frame each cycle — and a Stop-hook cannot break it
Each engineering cycle spawned a **fresh agent with no memory of the prior cycle's strategic frame.** The loop
inherited and never re-examined the premise **"we have 5 leads, get them to >=20"** — when the actual
acceptance criterion was **lead VOLUME** (orthogonal to per-lead qualify-probability, which is what every PR
optimized). The decisive proof that this is *architectural*: even the **08:42 principle-11 mercury panel** (4
blind lenses + critic — the framework's strongest independence instrument) **STILL inherited the false
"5->=20" frame** (`DECISION-REVIEW-2026-06-28-mercury-gate-relaxation`). **Lens-independence cured cross-lens
contamination but NOT the shared false-premise framing.** And architecturally a Stop-hook
(`goal-stop.mjs evaluate() -> {block, reason}`) **cannot spawn fresh independent context** — it can only steer
the same frame-captured agent. **What actually broke the frame was a human halt + fresh blind lenses
re-deriving from scratch.** (Evidence: POSTMORTEM §E2 adversarial consensus — the auto-panel `redirect` rung
is **REJECTED** precisely because it re-instantiates the failure it diagnoses.)
- **Architectural lesson (consensus):** **DEFER** any in-loop auto-redirect panel until frame-inheritance is
  solved. If ever added, the panel must **RE-DERIVE "is the target reachable from current inputs?" from
  scratch, independent of the stated target** — and the `probe` network I/O must stay **OUT** of the
  zero-I/O fail-closed kernel hook. The durable independence source that *actually* breaks frames is a
  **human checkpoint at milestone %** (optional, recommended).

---

## 3. The amplifiers (real, but not root)

- **Platform-scope drift (Hobby vs Pro/Team).** Prod deploys landed on a **personal** scope while the workflow
  set a **team** `VERCEL_ORG_ID`. On Hobby this **silently clamps `maxDuration=300`** and caps crons at 2 —
  which both worsens W1 and would have **prevented the seed cron from ever scheduling.** A founder scope/plan
  decision, out of agent scope. (RCA-CONVERGED §3.)
- **Crons are GET, the only completing seed path is POST.** The one path proven to run `runDiscovery` to
  completion in prod history (`POST /api/discover`, 300s) **had no cron** and could not have one (crons are
  GET). The autonomous wiring and the working wiring were **disjoint by transport.** (RCA-CONVERGED §1.B.3.)
- **Deploy fragility.** 6 of the last 8 deploys had failed (build-time secret access); prod served a **stale
  HEAD** for much of the day, and the post-deploy health check **alarmed RED but shipped green**
  (`continue-on-error:true`). (RCA-CONVERGED §3.)

---

## 4. What the architecture got RIGHT (preserve — anti-regression)

- **The blind, independent RCA board caught a mechanism error that a single investigator would have shipped:**
  the hang was **pool-acquire/query queuing** (fixed by `statement_timeout`, #209 — **0/60 hangs**), NOT
  connection establishment (#208's `connect_timeout`, correct but **insufficient**). Two hypotheses with
  **opposite remedies**; independence surfaced and resolved the contradiction. (RCA-CONVERGED §2.) **This is
  the structure to keep.**
- **author!=verifier produced the correct structural answer (the #217 VERIFY at 02:06).** The signal was
  generated reliably. The gap was downstream (W4: no teeth), **not** in the verifier.
- **Fail-closed safety held throughout:** flags off by default, CRON_SECRET auth before any DB, the mandatory
  human "Mark sent" send-gate. No bad outreach went out; no prod data was corrupted (single-transaction
  persistence = no torn writes). The damage was **wasted cycles + invisible spend**, not a data/safety breach.

---

## 5. The structural fix set (NOT implemented here — recorded for the decision)

| # | Weakness | Structural fix | Status |
|---|---|---|---|
| W1 | All-or-nothing 300s seed | Seed **persistence redesign**: chunked/checkpointed commit, OR sub-300s batched `runDiscovery`, OR a longer compute lane (background worker) | **Decision needed (founder/architecture)** — the single open lever |
| W2 | Disabled == crash | Disabled subsystems report `{enabled:false}` on a health surface, never a 5xx | Recommendation |
| W3 | Killed run hides spend | **Write-ahead cost** outside the result transaction | Fail-safe in place (`DISCOVERY_SEED_ENABLED=0`); durable fix pending |
| W4 | No goal-delta gate | **Verifier-driven acceptance-delta gate** (`goal_metric_reachable` in VERIFY frontmatter; `verify-gate.mjs` escalates) | Consensus design — ship in framework v2 |
| W5 | No no-progress detector | **M1 metric ledger** (`goal_metric` + `progress[]`, machine-visible), coupled to W4 | Consensus design — ship M1 |
| W6 | Ephemeral agents inherit the frame | **DEFER** auto-redirect; if added it must re-derive reachability from scratch + a human milestone checkpoint | Consensus — deferred |

**The order is fixed by the evidence:** W1 is the binding business constraint; W4+W5 are the binding *process*
constraint (they are why W1 took ~10 hours to surface as the answer instead of ~2). Neither makes the other
optional.

---

## 6. Foundation verdict

The architecture is **sound at the slice level** (correct fixes, fail-closed safety, independence that caught a
real mechanism error) and **unsound at two structural seams**: (1) the **seed persistence model** cannot
deliver volume within the platform's compute ceiling — this is the proven, binding limit on the goal; and (2)
the **execution/governance architecture** had the correct answer in writing 9 hours early and **no architected
path to act on it.** Both are **design** properties, not defects to patch. The goal is **OUTCOME (2):
unreachable as built** until W1 is redesigned — and the framework should not run another long-horizon goal
without W4+W5 (the goal-delta gate + metric ledger) in place.
