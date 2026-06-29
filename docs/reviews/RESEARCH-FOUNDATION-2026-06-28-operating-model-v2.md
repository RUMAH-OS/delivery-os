---
artifact: RESEARCH-FOUNDATION
subject: Delivery OS Operating Model v2 — the definitive architecture investigation
date: 2026-06-28
status: research-only (NO v2 design, NO implementation — this is the evidence foundation a later design phase builds on)
primary_evidence: docs/reviews/HANDOFF-2026-06-28-discovery-incident.md (the PLOS Discovery ">=20 contacts" incident)
method: 6 parallel evidence streams (OS design history · full incident corpus · PLOS forensic · consumer-repo production history · proposed-capability catalog · external first-principles research) cross-referenced and synthesized
scope_guard: This document does NOT design Project Owner / Heartbeat / Execution Governor / persistent agents / result bus. It evaluates them — and every other assumption — from first principles against evidence. It recommends what to decide; it decides nothing irreversible.
---

# Delivery OS Operating Model v2 — Definitive Research Foundation

> **What this is.** The research foundation for Operating Model v2 — and *only* the foundation. It reconstructs
> the complete execution history, names every root cause behind wasted effort and unreached objectives,
> extracts the timeless engineering principles that govern AI-native delivery, challenges every existing
> assumption (including the founder's own v2 proposals), compares competing architectures from first
> principles, and ends in prioritized, evidence-backed recommendations.
> **What this is NOT.** A v2 design. No architecture is committed here. Where the evidence supports a
> direction, it says so and says how confident it is; where the evidence is mixed, it surfaces the
> disagreement rather than smoothing it (Governance §11). The single deliverable is this document.

---

## 0. Executive conclusion (one screen)

Across two real consumer products (rumah-admin, property-lead-os) and the framework's own dogfooding, **every
expensive failure in the record occurred at the same structural location: a place where the discipline that
human friction used to supply for free had not been re-introduced as an explicit, external, enforced
mechanism keyed on the objective.** This is the unifying root cause, and it has two faces:

1. **The framework's own law, proven twice over:** *trust in a control is proportional to its mechanical
   fraction.* Every recorded incident occurred at a link that was **prose** (a remembered rule, a
   hand-maintained surface, a ratified-but-unenforced contract, a documented-but-discretionary boundary);
   **zero** occurred at a link that was a **program** (a hook, a lint, an append-only store, a deterministic
   gate). (`core/GOVERNANCE.md:130`, `case-studies/2026-06-incident-ledger.md`.)

2. **The decisive new evidence (the PLOS Discovery incident):** the framework's controls are almost all keyed
   on the **slice**, not the **goal**. An autonomous loop ran ~9 hours / ~10 PRs against an *architecturally
   unreachable* objective while every per-slice gate stayed green, because **nothing watched the goal-delta
   and nothing re-derived feasibility.** The correct structural answer existed in writing at 02:06
   (PR #217's independent VERIFY: "≥20 from current leads = FALSE") and had **no mechanism to halt the loop.**
   (`docs/reviews/POSTMORTEM-2026-06-28-discovery-execution.md`, `HANDOFF-2026-06-28-discovery-incident.md:51-58`.)

**The single most important finding for v2.** Five independent engineering disciplines — embedded-systems
watchdogs, resilience circuit-breakers, control-theory anti-windup, SRE burn-rate alerting, and
organizational double-loop learning — **converge on one missing organ:** an *external supervisor, keyed on
the objective (goal-delta) not the activity, that separates liveness from progress, layers its stop
conditions, and on a stall halts → escalates → forces a re-frame rather than authorizing one more attempt.*
The convergence of five unrelated fields on the same mechanism is strong evidence it is a real invariant, not
a fashion.

**What the evidence says about the proposed v2 capabilities (challenged, not assumed):**

| Proposed capability | Verdict from first principles | Why |
|---|---|---|
| **Result bus / durable block-resume engine** | **SUPPORTED — highest-confidence** | Already built and proven (P1–P4, 27 files byte-identical across two repos); independently endorsed by the release-engineering canon (durable, checkpointed, idempotent sagas are the correct substrate for long-horizon autonomous work). The discovery incident is, precisely, a long-running job run on the wrong substrate. |
| **An external goal-delta supervisor ("Execution Governor")** | **SUPPORTED in shape — but NOT as currently designed** | The function is mandatory (it is the missing organ). But it must live **outside** the loop it guards and key on an **independently measured** goal-delta. The OS's current H9 places the detection inside the same agent/Stop-hook, which its own design admits "cannot spawn fresh independent context." |
| **Project Owner (persistent goal-holder)** | **SUPPORTED in shape — with a hard constraint** | Maps to the single-threaded owner holding an *un-delegatable goal contract + a progress/effort budget*. Valid ONLY if it is a different locus than the worker; if it is just another in-loop agent it re-creates the frame-lock the incident proved fatal. |
| **Heartbeat** | **RE-FRAME REQUIRED — proposed form is dangerous** | The incident agent was *alive and producing PRs the whole time.* A liveness heartbeat would have shown all-green. The watchdog literature is explicit: **liveness ≠ progress.** What is needed is a **progress watchdog keyed on goal-delta**, not a liveness heartbeat. Copying "heartbeat" literally measures the wrong thing. |
| **Persistent specialist agents** | **NOT YET JUSTIFIED — cheaper fix exists** | Their main claimed benefit (curing context-loss across a long run) is better served by a **persisted append-only attempt-ledger + durable state**, per the durable-execution and Anthropic multi-agent findings. Persistent fleets cost ~15× tokens, worsen coordination/context failure modes, and collide with the G9 no-self-spawn ceiling. Prefer *durable state + ephemeral workers under a persistent supervisor that holds the state.* |
| **Automatic in-loop blind board (auto-redirect panel)** | **REJECT — already correctly rejected by the OS** | A Stop-hook/in-loop panel cannot break frame-lock; the 08:42 principle-11 panel itself inherited the false "5→≥20" frame. The independence that breaks frames is a human or an out-of-loop re-derivation, not an in-loop rung. (`capabilities/GOAL-EXECUTION-CONTRACT.md:233-239`.) |

**The honest meta-finding about v2's starting point.** Delivery OS is, by its own ratified definition, **not
yet an "AI Operating System"** — it is the best-instrumented *delivery model / orchestration layer* in the
ecosystem, but it "does nothing when you are not looking" because the autonomy strata (D/F/H/J — multi-step
no-founder, recovery, long-running, founder-absence) are unbuilt (`capabilities/AUTONOMOUS-EXECUTION-DEFINITION.md:38-67`).
v2 is therefore not a greenfield design and not a rescue of a broken system: it is **the deliberate
construction of the autonomy strata on top of a proven delivery spine — and the central design problem of
that construction is the missing goal-keyed supervisor.** Everything else in this report serves that finding.

---

## 1. Method and evidence base

This investigation reconstructed the record from the complete corpus, not a summary of it. Six independent
evidence streams ran in parallel, each returning a cited digest; this document is their cross-referenced
synthesis. Disagreements between streams (and between OS documents) are surfaced, not smoothed.

| Stream | Corpus mined | Anchor citations |
|---|---|---|
| **A — OS design history & decision spine** | `proposals/`, `CHANGELOG-v2..v5`, `DECISIONS.md`, `core/` | Governance §1–§16; D1–D10 |
| **B — Full incident / postmortem corpus** | `case-studies/`, `docs/feedback/`, `docs/reviews/`, `docs/audits/` | 31-incident root-cause catalog; `2026-06-incident-ledger.md` |
| **C — PLOS Discovery forensic** | `POSTMORTEM-2026-06-28`, the 4 blind lenses + critic, PLOS RCAs, PR #217/#228/#229 VERIFYs | hour-by-hour PR-by-PR timeline |
| **D — Consumer production history** | rumah-admin (432+ docs), property-lead-os (319+ docs), siblings | 9-day red CI; migration-parity; serverless-autonomy class |
| **E — Proposed-capability catalog** | `capabilities/` (full), `docs/V6-*`, `FOUNDER-ACTION-ELIMINATION-PLAN`, `skills/` | what is built vs designed vs proposed; the v2 wish-list |
| **F — External first-principles research** | Google SRE, Amazon/AWS, Anthropic, control theory, SCT, Argyris/Boyd, multi-agent papers | 7 domains → timeless principle → AI-native re-derivation |

**Confidence convention used throughout:** *Proven* (production evidence on the running thing) · *Strong*
(converged across ≥2 independent streams or ≥2 disciplines) · *Plausible* (single source / first-principles
argument not yet field-tested) · *Open* (genuine unknown; flagged for the design phase).

---

## 2. The complete execution timeline (first project → today)

Reconstructed from the incident ledger, case-studies, consumer retrospectives, and the changelog spine. The
arc is one of a **delivery spine hardening incident-by-incident, while the autonomy layer above it remained
unbuilt and the controls remained slice-scoped.**

### 2.1 Era I — The clean-room distillation and the delivery spine (pre-2026-06)
Delivery OS was distilled clean-room from two real projects into an agnostic spine: vertical slices,
author≠verifier via CODEOWNERS, independent QA, Definition of Done, the consequential-decision review (§11),
the Waterline rule (no platform until a second consumer pulls). This spine is the part of the system that has
**never been the site of an incident** — every later failure landed above or around it, at a prose link.

### 2.2 Era II — Operability and the first operationalization failure (2026-06-10)
v3 added the kernel: the `CLAUDE.md` router, six first-class skills, the wiki. Then the **founding incident of
the framework's enforcement doctrine**: a generated, *unexecuted* scaffold was presented as progress with no
independent verifier, because §3 (author≠verifier) was documented but not *operationalized* — CODEOWNERS is
inert without git, skills were dispatched by discretion, status vocabulary was aspirational
(`case-studies/2026-06-10-author-verifier-not-operationalized.md`). This earned **§12 ("verification is
operationally enforced, not remembered")** and the verify-gate hook. It is the template for every later fix:
*a prose control failed; it was replaced by a mechanism.*

### 2.3 Era III — Company OS phase: the cross-system and runtime lessons (2026-06-11 → 06-18)
The two products were wired together. The richest cluster of root causes in the record (`case-studies/2026-06-13-company-os-phase.md`):
- **N17 — the pooler concurrency saga:** prod reads returned crossed columns; two wrong fixes from
  assumptions/curl (one, `max:1`, made it *worse*) before a session-pooler fix proven only by a concurrency
  repro on the running thing. Earned **runtime-repro doctrine (§15)**.
- **N18 — contract built from a mental model:** a cross-system producer built opposite to the ratified
  contract (PUSH vs PULL, divergent envelope) that sat on disk the whole time. Earned **read-canonical-first
  (§15 v5 keystone)**.
- **N20 — token/ceremony cost invisible:** ~15 slices each ran build+independent-QA re-reading large files
  from cold context; the OS measured everything except cost. Earned the **A3 cost instrument**.
- **N22 — the ownership boundary written *after* the build:** "producer owns facts, consumer owns ranking"
  arrived as three founder corrections mid-phase. Earned **boundary-first doctrine (§15)**.
- Disk-full and a 76-commit stuck-behind-billing-outage event showed **knowledge living only in unpushed
  working trees** — the first context-loss-across-sessions signal.

### 2.4 Era IV — The governance-volume correction and the learning loop (2026-06-13 → 06-25)
The pendulum swung to over-governance: ~10 panels / ~75 blind lens-runs in ~3 days against 8 operating
replies, until the founder said "diminishing returns" himself (`2026-06-incident-ledger.md`). This earned
**panel economics (§11): lens caps by decision class, refusal rules, behavioral surfaces ship as cheapest
reversible version.** In parallel the **OS Feedback Loop (§14)** was mechanized after its first trigger
*never fired in the field* (zero release tags on trunk-based projects → the **175-commit-overdue
learning-review** miss), adding the review-artifact detector, the N-merges backstop, and the review-class
(L2) trigger. v4.0 consolidated two consumers' learning into the base via a single batch ratification (F2),
and ratified D1–D10 — including **D9 (binding verification moved server-side to CI + branch protection),
D6 (founder-review only on founder-verifiable changes), D7 (deploy authorization state-gated not
person-gated), and §16 + the GOAL-EXECUTION-CONTRACT (autonomous execution terminates at the founder
boundary).**

### 2.5 Era V — The execution-engine and autonomy design (2026-06-15 → 06-22)
The board produced the **canonical autonomy definition** (`AUTONOMOUS-EXECUTION-DEFINITION.md`): A/B/C are
*automation* (Claude pulls every trigger), D/F/H/J are *autonomy* (work advances across an operator absence),
I (agents spawn agents) is permanently out of scope (G9 ceiling). It ruled, siding with the adversarial seat,
that **the "AI Operating System" noun is unearned until D/F/H/J land.** The **Execution Model v1**
(`DELIVERY-OS-EXECUTION-MODEL-V1.md`) reduced both products to one durable primitive — a step that blocks on
a correlation key and resumes on a pluggable callback (system / agent-result / timer / domain-event / human) —
plus the strategic **verified-loop / verifier-capability** model (the value is the *calibrated verifier*, not
the loop mechanics; an un-evaluated verifier may only advise, never gate).

### 2.6 Era VI — Production reality: deployment, config, and the seam (2026-06-25 → 06-27)
The products hit production and the **deployment/configuration/seam** root-cause classes fired:
- **rumah-admin prod incident (06-25):** invoicing/audit down from missing migrations 0029/0032; test data
  in prod from an unguarded `db:seed` against a `.env` that resolved to prod. Earned the **fail-closed
  prod-DB guard**.
- **Invoice-delivery seam (06-26):** operators "sent" ~200 invoices; **zero reached PLOS** — PLOS prod was
  missing migration 0035 (`provenance` column → 500), and the Admin→PLOS drain was an in-process
  `setTimeout` loop **inert on serverless Vercel**. Four MUST-FIX deviations from the ratified ADR-0005
  contract that **no conformance test had held the code honest to.** The L2 change fired **no
  Foundation/Founder/Learning review** because the review-trigger ran in SHADOW with a hole.
- **Infrastructure platform (06-27):** a 4-layer deploy failure discovered one-secret-at-a-time; pooler
  **inversion** (Admin session-:5432 vs PLOS transaction-:6543, both correct, neither recorded as a ratified
  exception); Vercel scope drift; secrets in working trees. Earned the **config-doctor + config-registry +
  fail-closed pre-build config-gate** (field-proven: it failed closed listing all 4 missing keys at once).
- The **9-day red shared CI pipeline** (175 commits, 8 independent causes incl. a shallow-checkout gate
  break and the 175-overdue learning-review).

### 2.7 Era VII — The PLOS Discovery incident: the goal-keyed gap, proven (2026-06-27 → 06-28)
The incident that occasioned this investigation (full forensic in §3). An autonomous loop pursued an
*architecturally unreachable* objective for ~9 hours / ~10 PRs, every per-slice gate green, until a human
forced the halt twice. It is not a new failure *class* — it is **patterns C (frame-never-re-examined) and the
serverless-substrate class, fired at the goal level instead of the slice level**, and it exposed the one gap
the slice-scoped controls structurally could not cover.

**The shape of the whole arc:** the delivery spine is sound; the controls hardened relentlessly at the slice
and the merge; the autonomy layer above was *designed but not built*; and the one place no control reached —
the **goal** — is exactly where the most expensive failure occurred.

---

## 3. The PLOS Discovery incident — the primary evidence, forensically

(Condensed from stream C; full hour-by-hour reconstruction in `POSTMORTEM-2026-06-28-discovery-execution.md`.)

**The objective.** "The live PLOS UI consistently contains ≥20 real, selectable A-score contacts, generated
entirely by the production Discovery pipeline."

**The proven verdict.** NOT achievable on the current architecture. `runDiscovery` — the only code that finds
net-new companies — exceeds Vercel's 300s `maxDuration` with live providers and persists **all-or-nothing in
one trailing `db.transaction` (`discovery.ts:258-350`) with no checkpoint.** Killed at 300s → full rollback →
zero persisted. Proven in production 2/2 (10:09 and 10:17 UTC: `curl (28) timeout after 300000ms`, company
delta 0, zero `discovery` runs recorded). The pipeline had **never produced ≥20 in production** — the
all-time high is 8 cards; the only "≥20" on record is a mocked-provider test (#210). **A ceiling never
exceeded, not a regression.**

**The execution meta-failure (the part that matters for v2).** Reconstructed PR-by-PR:
- The structural answer was **known and written at 02:06** (PR #217 independent VERIFY: "≥20 reachable from
  current leads — FALSE … requires MANY more leads seeded … does not manufacture lead volume"). It was
  correct, independent (author≠verifier worked perfectly), and **merged into a document with no teeth.**
- For ~9 hours and ~10 further PRs (#218–#228) the loop optimized **per-lead qualify-probability** while the
  acceptance criterion was **lead volume** (orthogonal). Each green per-slice deploy "re-baited one more fix."
- The acceptance metric (`/api/floor` = 8) was **flat from 01:52Z to 11:13Z** and **nothing watched it.**
  `goal-stop.mjs` carried work counters (turns/time) but no objective metric.
- The 08:42 **principle-11 panel** (4 blind lenses + critic — the framework's *strongest* independence
  instrument) reviewed a mid-stream gate relaxation and **still inherited the false "5→≥20" frame.**
  Lens-independence cured cross-lens contamination but not the **shared false premise.** A Stop-hook cannot
  spawn fresh context; it only steers the same frame-captured agent.
- A **human forced the halt twice.** The independence that actually broke the frame was a human stepping back
  and re-deriving reachability from scratch.

**The critic's correction (kept, not smoothed):** #218–#227 were *necessary* infra fixes (SerpAPI, Playwright,
telemetry, search-cap) that every path to ≥20 requires — done in the **wrong priority order inside a
never-re-examined frame**, not "futile." This matters for v2: the fix is not "stop building" but "**re-derive
feasibility and re-order against the goal before pouring effort**."

**Two latent findings that generalize:**
- **Spend-cap invisibility:** killed runs roll back their own cost row, so real (already-billed) vendor spend
  is invisible to `evaluateSpendCap`. A budget that lives inside the transaction it is meant to bound cannot
  bound it. (→ write-ahead cost accounting.)
- **Fail-closed flag read as a crash:** `DISCOVERY_ENABLED` unset returned a 503 that consumed a whole
  hypothesis branch chasing a non-existent outage. (→ disabled-by-design must surface as health, never 5xx.)

---

## 4. Root-cause analysis — every category, organized by systemic pattern

The goal named eleven failure categories (wasted effort, stalled execution, governance failures, deployment,
configuration, ownership gaps, context loss, unnecessary complexity, review failures, business goals
unreached, and "why execution continued"). They are not eleven independent problems. They are **eight
recurring systemic patterns**, all of which are instances of the **one meta-root-cause**: *a discipline that
human friction supplied for free was left as prose instead of being re-introduced as an external,
objective-keyed mechanism.* The mapping:

### 4.1 The meta-root-cause (the spine of every finding)
**Mechanism-over-prose, generalized to the objective.** The framework already proved that *every incident
occurs at a prose link and none at a program link* (§15, `2026-06-incident-ledger.md`). The external research
supplies the *why*: human operating models are full of **accidental safety governors** — fatigue, working
hours, the cost of context-switching, boredom with fruitless work, the social cost of asking "is this even
possible?", the slowness of iteration, the expense of re-planning. These frictions silently enforced "stop
when you're not getting anywhere." **AI removes every one of them.** So the AI-native form of mechanism-over-
prose is: *the governor a human used to provide must be re-introduced as an explicit, external, enforced
mechanism keyed on the objective — because the agent will never spontaneously supply it.*

### 4.2 The eight patterns and the categories they produce

| # | Pattern | Categories it produces | Representative instances | Why friction-removal explains it |
|---|---|---|---|---|
| **P-C** | **Frame never re-examined inside a symptom-chasing loop** | stalled execution · business-goal-unreached · wasted effort · "why execution continued" | Discovery ≥20 (9h/10PR); the 75 lens-runs replicating one operating reply | A tiring human re-frames after 2–3 failed tries; an agent treats attempt #10 with attempt #1's optimism. No external goal-delta watchdog → single-loop forever. |
| **P-A** | **Hand-maintained surface with no reconciliation loop** | governance failure · context loss · ownership gap | The two stale routers that blocked PLOS planning ~9h while the API sat shipped; the wiki produced by no one; the re-asked boundary question | "I'll keep it updated" assumes a human remembers; no mechanism = guaranteed staleness. |
| **P-B** | **Contract exists but is not READ** | governance failure · review failure · cross-repo seam | N18 producer-from-mental-model; the dual FROZEN contracts; the invoice-delivery 4 ADR deviations | The social cost of "did I check the spec?" is the human governor; absent a read-gate, the model substitutes for the bytes. |
| **P-substrate** | **Long/continuous work on a short-window or in-process substrate** | deployment · stalled execution · business-goal-unreached | Discovery 300s all-or-nothing kill; the invoice-drain `setTimeout` inert on serverless | A human notices a job "didn't finish"; serverless kills silently and the OS modeled long work as a short request. |
| **P-D** | **Tests / gates pass but bypass the real surface or the goal** | review failure · governance failure | S37 (57 author-tests green, verifier found silent data loss on the prod lane); per-slice green / integration red; FV-1..5 found at founder's live validation | A human "just clicks it once"; automated gates assert shape, not lived behavior, unless forced onto the real surface. |
| **P-config** | **Configuration / infra facts scattered, unrecorded, validated one-at-a-time** | configuration · deployment · context loss | 4-layer one-secret-at-a-time deploy; pooler inversion unrecorded; secrets in trees; migration-parity drift | A human keeps a mental model of "the prod contract"; with no registry it's discovered by breakage, layer by layer. |
| **P-F** | **Governance boundary documented but discretionary** | governance failure · review failure | author≠verifier editing the test tree; review-trigger blind to its own control plane; §11 succeeding "by practice" | The boundary holds only while someone remembers; "if it can, it will" predicts the breach. |
| **P-operate** | **Capability built and verified but not auto-executing (built ≠ operating)** | unnecessary complexity · wasted effort · business-goal-unreached | census-detector inert (zero CI integration); capability registry ~90% empty of manifests; "nothing calls `enqueue()` yet"; skills packaged unproven | The thing exists; no mechanism fires it; value never realized. The autonomy strata are the largest instance. |

### 4.3 Category-by-category index (so nothing the goal named is unaddressed)
- **Wasted engineering effort:** P-C (10 PRs orthogonal to volume), P-config (4 failed deploy cycles ×2
  products), N17 (3 pooler cycles), N20 (invisible double-QA token cost), the 75 lens-runs, the wiki.
- **Stalled execution:** P-C, P-substrate, the 9-day red pipeline, the 76 commits stuck behind a personal-
  account billing outage, the reliability keystone blocked at the 28/30 learning gate wall.
- **Governance failures:** the 18 catalogued control-didn't-fire cases (merge-on-red; author≠verifier in the
  test tree and the no-git case; ecosystem-alignment's consent-based trigger; review-trigger blind to its own
  control plane; the goal-level finding with no halt).
- **Deployment & configuration:** the whole P-substrate and P-config rows; migration-parity drift (no gate
  checks prod's applied-migration ledger equals the repo).
- **Ownership gaps:** nobody owned the integration seam (earned the integration-architect agent); nobody owned
  cross-slice QA; the producer/consumer boundary written after the build.
- **Context loss:** within a run (the 9-hour loop re-deriving prior failed fixes); across sessions (knowledge
  in unpushed trees; disk-full and billing-outage events); across repos (stale routers).
- **Unnecessary complexity:** the wiki (never cited across 57+ slices); skills-first packaged before proof;
  consumption machinery built for gates that never fired; 14×-fanout lesson duplication in `signals.jsonl`
  (one milestone's 12 lessons re-emitted 41× — the dedup is itself unmechanized).
- **Review failures:** component-QA-green / founder-finds-at-live-validation (FV-1..5); tests bypassing the
  real surface; per-slice green / integration red; lens-independence ≠ premise-independence.
- **Business goals not achieved despite hours:** Discovery ≥20 (unreachable); invoice-delivery (built, seam-
  blocked, zero delivered); discovery (built, undeployed on config); reliability keystone (built, gate-blocked).
- **Why execution continued past the objective (the core question):** answered in full in §5.

---

## 5. Why execution continued — and exactly where it should have stopped

This is the goal's central question. The answer is precise and evidence-backed.

### 5.1 Why it continued
The framework's stop conditions are **structurally slice-scoped and liveness-shaped**, and the objective is
neither. Concretely, at the moment of the incident the autonomous loop's only exit conditions were
(`capabilities/GOAL-EXECUTION-CONTRACT.md` §5, H1): `objective_complete`, a valid **boundary FAP**, or a
**cap trip** (turn/wall-clock/cost). None of these watches the goal-delta:
- `objective_complete` was never true (and could not self-assert it).
- No **founder boundary** was reached — there was always "one more fix" available, so no permission-denial,
  missing-credential, or fail-closed gate fired. The loop had *autonomous work it could still do*; it just
  wasn't work that moved the goal.
- The **H1 cap** watches *time/turns/cost*, which had not yet tripped at 9 hours — and crucially, a cap trip
  produces a `failure` FAP, **not** a feasibility re-derivation. The cap is blind to "effort burning fast,
  goal-delta flat."
- The per-slice **verify-gate** was green every cycle (each slice genuinely passed). Author≠verifier
  *worked* — it even produced the correct goal-level finding at 02:06 — but a slice gate has no channel to
  halt a *goal*.

In control-theory terms (stream F): the loop was **open-loop with respect to its own objective.** It measured
*activity* ("did I produce a PR?") and never computed the **error signal against the goal** ("did the
goal-delta shrink?"). A controller with an actuator but no feedback path from the actual output will oscillate
or run away forever. In learning-theory terms: it was a **single-loop trap** — Observe-symptom, Act-PR,
repeat, with nothing empowered to re-Orient and question the frame. In agent-failure terms: a textbook
**degeneration loop** — "high compute burn, no task completion, and no visible error."

### 5.2 Exactly where it should have stopped, escalated, or changed strategy
The record contains four discrete decision points, each with the cited reason it did not halt:

| When | The point | Correct action | Why it didn't fire |
|---|---|---|---|
| 22:47 (06-27) | RCA-CONVERGED named the **seed** the only growth lever | Re-order all effort behind seed persistence; re-derive whether ≥20 is reachable at all | No mechanism re-derives feasibility on a new structural finding |
| 00:22 (06-28) | PR #215 inverted ordering so the seed ran **last and only when backlog cleared** (it never did) | A goal-delta check would show the population flat → halt the ordering | Nothing watched the population count |
| **02:06 (06-28)** | **PR #217 VERIFY wrote "≥20 unreachable from current leads"** | **STOP the engineering loop; escalate the goal-level finding to the founder as a strategy/feasibility boundary** | **A goal-level verifier finding had no teeth** — the single highest-leverage gap |
| 08:42 (06-28) | The principle-11 panel relaxed a gate, inheriting the frame | Re-derive reachability from scratch, independent of the stated target | A Stop-hook/in-loop panel cannot spawn frame-independent context |

**The canonical stop point is 02:06.** An independent verifier had already produced the correct,
re-checkable, goal-level finding. The fix is therefore not "add intelligence" — the intelligence was present
and correct — it is **"give the goal-level finding a mechanism to halt the loop and force a feasibility
re-derivation,"** keyed on an *independently measured* goal-delta and executed by a locus *outside* the loop.

---

## 6. Timeless engineering principles, and their AI-native re-derivation

From stream F, seven domains. Each yields a provider/era-independent principle and — the load-bearing part —
**what changes when the operator is a fleet of AI agents.** The recurring shape is the meta-root-cause (§4.1):
*re-introduce, as an explicit external mechanism, the discipline human friction used to supply.*

1. **Ownership (you-build-it-you-run-it; single-threaded owner; error budgets).** *Timeless:* accountability
   is conserved — one identifiable owner holds the whole outcome, with a bounded, tradeable budget. *AI-native:*
   build-and-run becomes literal and total (no handoff loss). **But** the pager that *hurt* a human owner is
   gone, so the corrective pressure must be re-encoded as an explicit **objective function + a progress/effort
   budget** (a generalized error budget where the scarce resource flips from human labor to compute/time-
   against-progress). And the outcome's accountability must be **un-delegatable** even as work is delegated to
   subagents — or it silently fragments (Anthropic's diffused-intent failure).

2. **Governance & gates (author≠verifier; Andon stop-the-line; two-way vs one-way doors; pre-mortem).**
   *Timeless:* independent verification + the cheap right to stop + decision velocity matched to reversibility.
   *AI-native:* author≠verifier is **more** essential (it is the structural defense against reward hacking);
   gates become free and continuous (pre-mortem everything). **But** stop-the-line must become an **automatic
   circuit-breaker**, not a cultural permission (no tired human will pull the cord); and one-way doors must be
   **hard-wired to human checkpoints**, because an agent makes so many two-way-door decisions per hour that a
   misclassified one-way door is statistically guaranteed unless classification is enforced. "Move fast at 70%
   and course-correct" (Bezos) **does not transfer** — it assumed iteration was costly and therefore self-
   limiting; for an agent, unmetered iteration *is* the thrash.

3. **Deployment & release (progressive delivery; deploy≠release; idempotency; checkpointed sagas; workers
   not serverless-timeouts).** *Timeless:* never change the world in one irreversible, unobserved step — do it
   incrementally, observably, resumably, reversibly. *AI-native:* canary *analysis* is exactly what an agent
   does well (closed-loop auto-rollback). **But** the discovery incident *is* a long-running-job failure:
   model autonomous goal-pursuit as a **durable, checkpointed, idempotent saga** on a substrate that can be
   time-boxed and inspected — not an open loop on a serverless request. Idempotency moves from nice to
   existential (10 PRs is a non-idempotent retry storm). Enforce a **minimum soak/dwell window** because the
   agent won't wait.

4. **Observability & control loops (golden signals; closed-loop control; burn-rate alerting; alert on
   symptoms not causes).** *Timeless:* close the loop on the **objective**, compute error = setpoint − actual,
   act on the gap; alert on the **rate of approach to failure**. *AI-native — the crux:* the agent's
   **controlled variable must be the goal-delta, never the action count**, and it must be measured
   **independently** of the acting agent (don't let the controller mark its own homework). The burn-rate
   analogue — **monitor dGoal/dEffort** — is the precise instrument the incident lacked: high effort-burn with
   flat goal-progress = a fast-burn alert on a stuck loop. Multi-window (short = thrash now; long = 9h/10PR
   grind).

5. **Planning & goals (north-star; leading vs lagging; feasibility before execution; escalation thresholds).**
   *Timeless:* pick one influenceable leading signal, and establish that the goal is **reachable** before
   pouring in effort. *AI-native — the second crux:* feasibility = **reachability** in the supervisory-control
   sense — *if the specification is unreachable, no controller exists, and the controller cannot tell from
   inside the loop; it just keeps acting.* The incident is exactly an unreachable spec handed to a controller
   with no reachability check. AI **removes the human's instinctive feasibility brake** (it never tires of an
   immovable setpoint), so reachability must be an **explicit gate checked before execution AND re-checked on
   repeated failure/stall**, and escalation thresholds must be **pre-committed and machine-enforced**, because
   the in-loop agent is the last entity that will stop itself.

6. **Postmortems & improvement (blameless; single- vs double-loop; OODA Orient).** *Timeless:* fix systems not
   people; know when to optimize *within* a frame vs question the frame. *AI-native:* blamelessness transfers
   trivially (no person to blame); double-loop re-framing is *cognitively easy* for an LLM (a prompt away).
   **But** agents default to single-loop and **will not spontaneously switch** — there is no dissonance signal —
   so double-loop must be **triggered** by the stall watchdog, and postmortem findings must compile into
   **enforced gates**, not prose.

7. **Multi-agent / autonomous systems (orchestrator-worker; simplicity-first; layered stopping conditions;
   the named failure modes).** *Timeless:* explicit task contracts, layered stop conditions, context as a
   scarce resource, design against the known loop-failure modes — because **autonomous loops fail silently, by
   burning resources while appearing busy.** *AI-native:* the incident is the canonical **degeneration loop**;
   the canon prescribes **all four guards at once** (max-iteration cap AND cost/time budget AND no-progress /
   loop-fingerprint detection AND an independent goal-verifier — each catches what the others miss). The
   watchdog **must live outside the loop it guards** (a process cannot reliably detect its own hang). Persisted
   **attempt-ledgers** turn blind repetition into evidence of unreachability. And **multi-agent is not free**
   (~15× tokens; poor fit for interdependent/shared-context work) — "spawn more agents" contradicts Anthropic's
   own simplicity-first guidance.

**The convergence (the single most important external finding).** Five independent disciplines — watchdogs
(liveness ≠ progress), circuit breakers (trip after repeated failure, then cooldown), control-theory
anti-windup (saturated actuator + non-responsive error → stop integrating), SRE burn-rate (alert on the
derivative), and double-loop/OODA (re-Orient on stall) — **prescribe the identical four-part organ:**
1. a **progress signal = goal-delta, measured independently** of the actor;
2. **separate liveness from progress** (trip on progress, never on liveness);
3. **layer the trips** (cap AND budget AND no-progress AND independent verifier);
4. on trip, **HALT → ESCALATE → RE-FRAME** (re-derive reachability before authorizing more effort), with a
   persisted attempt-ledger as the re-frame's evidence.
The watchdog lives **outside** the loop, is keyed on the **objective not the activity**, and its default
verdict on "max effort, zero goal-movement" is **"the goal may be unreachable — stop and ask," not "try
again."**

---

## 7. AI-native operating principles for Delivery OS (extracted)

Synthesized from §6 against the full incident record. These are the timeless principles **re-derived for an
AI-native autonomous company** — the design invariants v2 should be held to. They deliberately do **not**
prescribe an architecture (that is the design phase); they constrain it.

- **AN-1 — Govern the objective, not the activity.** Every autonomous segment is controlled by an
  *independently measured goal-delta*. Liveness (the agent is producing output) is never evidence of progress.
  *(Cures P-C; the incident's core.)*

- **AN-2 — Re-introduce removed friction as external mechanism.** For every human governor AI deletes
  (fatigue, working hours, context-switch cost, the social cost of "is this possible?"), install an explicit,
  external, fail-closed mechanism keyed on the objective. *(The meta-root-cause, §4.1; the AI-native form of
  the framework's own mechanism-over-prose law.)*

- **AN-3 — The watchdog lives outside the loop it guards.** The locus that measures goal-delta and trips the
  breaker must be a *different* locus than the worker pursuing the goal — a process cannot reliably detect its
  own hang, and an in-loop panel inherits the loop's frame (08:42, proven). *(Cures the H9 limitation.)*

- **AN-4 — Reachability is a gate, checked before AND during.** Establish that a goal is reachable from current
  inputs before committing effort, and re-derive it on repeated failure/stall. An unreachable spec must
  escalate the *goal*, never trigger another attempt. *(Supervisory-control + planning; cures "why execution
  continued.")*

- **AN-5 — Layer the stop conditions.** Max-iteration cap AND cost/time budget AND no-progress/loop-fingerprint
  detection AND an independent goal-verifier — together, because each catches a failure the others miss; a
  determined loop slips any single guard. *(Agent canon; the incident had none binding on the goal.)*

- **AN-6 — On a stall: halt → escalate → re-frame, in that order; never "retry harder."** The trip action is
  double-loop (re-derive feasibility), not single-loop (the same fix again). Halting is necessary but
  insufficient. *(Argyris/Boyd + SCT.)*

- **AN-7 — Long-horizon work runs on a durable, checkpointed, idempotent substrate.** Model goal-pursuit as a
  saga that records *goal-delta per step*, not "an action was taken"; every world-touching action carries an
  intent-keyed idempotency key; no open loop on a short-window request lane. *(Release-engineering; cures
  P-substrate — the 300s kill and the inert `setTimeout`.)*

- **AN-8 — Accounting and safety budgets live OUTSIDE the work they bound.** Cost/spend is recorded write-ahead,
  independent of the transaction it accounts for; a budget inside the work it limits cannot limit it. *(The
  spend-cap-invisibility latent finding.)*

- **AN-9 — Author≠verifier extends to the goal level.** The proven, highest-value control in the record is an
  independent verifier; give its *goal-level* findings the same teeth its *slice-level* findings have. Amplify
  the signal that worked; do not replace it with automation. *(The 02:06 finding; the OS's own H9 instinct.)*

- **AN-10 — Built is not operating; verified is not gating.** A capability creates value only when a mechanism
  fires it; a verifier earns the right to gate only after it is itself evaluated/calibrated (advise-until-
  calibrated). *(P-operate; the verifier-capability model in EXECUTION-MODEL-V1 §10.5.)*

- **AN-11 — Independence is structural, not numerical.** More same-model lenses are not more independent
  (saturation ~5–6; lens-independence ≠ premise-independence). Frame-breaking independence comes from a
  *different locus / a human / an out-of-loop re-derivation*, not from adding rungs inside the loop. *(§11
  economics + the 08:42 panel.)*

- **AN-12 — Simplicity-first; parallelism is not free.** Reach for a guarded single loop with a good external
  watchdog before a persistent fleet; multi-agent costs ~15× and worsens context/coordination failure modes.
  Justify every added agent by a demonstrated outcome improvement. *(Anthropic; the 14×-fanout lesson-dup and
  the 75-lens-run over-fire are the in-record warnings.)*

---

## 8. Governance findings

What the OS's governance got **right**, where it **failed**, and the **structural gap** v2 must close.

### 8.1 What is working and must be preserved (anti-regression)
- **Mechanism-over-prose / §12 server-side binding gate.** The migration of author≠verifier to CI branch
  protection + CODEOWNERS + required `verify-coverage` is the correct application of the OS's own §13 doctrine
  (mechanism belongs where it is model-independent and un-bypassable). *Preserve.*
- **Author≠verifier itself.** Vindicated independently by the agent-failure literature as the structural
  defense against reward hacking — and it *produced the correct answer* in the incident (02:06). *Preserve and
  extend to the goal level (AN-9).*
- **Blind multi-lens RCA with surfaced dissent.** Caught a mechanism error a single investigator would have
  shipped (pool-acquire vs connection-establishment, opposite remedies). *Preserve.*
- **The §16 / GOAL-EXECUTION-CONTRACT boundary-is-success model.** Correctly killed the infinite-idle incident
  (a goal phrased "merge to main" looping its Stop-hook forever) by redefining the autonomous frontier and
  terminating at the founder boundary. *Preserve; it is the right envelope.*
- **The OS already rejected the wrong fix.** H9c declined the auto-redirect in-loop panel for exactly the
  right reason (frame-inheritance). This is evidence the OS's self-analysis is sound — v2 should build on it,
  not relitigate it.

### 8.2 Where governance failed (control existed but did not fire, or did not exist)
The 18-case catalogue (stream B) reduces to four governance gaps that matter for v2:
- **G-goal — no goal-keyed control.** The decisive gap. Every binding control is slice- or merge-scoped; the
  goal had none. *(The whole of §5.)*
- **G-shadow — controls shipped in SHADOW / inert.** The review-trigger missed the L2 invoice-delivery change
  because it ran in SHADOW with a hole; census-detector never fires; the capability registry is ~90% empty.
  *A control in SHADOW is prose with a progress bar.*
- **G-selfhost — the framework's gates were blind to the framework's own control plane.** The review-trigger
  classified edits to `core/`/`proposals/`/the gate tooling as "auto-safe"; a hook referenced a path that
  didn't resolve (MODULE_NOT_FOUND shipped). A self-hosted gate must include its own control plane in its
  trigger surface. *(Now partially fixed; a standing risk for any self-modifying v2.)*
- **G-discretion — boundaries that held "by practice."** §11 succeeding by practice, author≠verifier in the
  test tree, the ecosystem-alignment consent-trigger that cannot fire on the change you don't know about.
  *"If it can, it will" predicts each breach.*

### 8.3 The structural governance gap for v2 (stated plainly)
**The framework's governance is a superb floor for the unit of work (the slice/merge) and has no organ for the
unit of intent (the goal).** It can prove a slice is correct, independent, and merged; it cannot yet prove a
goal is *reachable*, *progressing*, or *worth continuing*. The H9 contract is the OS reaching for this organ —
but it places the organ *inside* the loop (a `verify-gate` Stop-path that parses VERIFY frontmatter), and its
own text concedes a Stop-hook "cannot spawn fresh independent context." **The unresolved design problem v2
exists to solve is: where does the external, goal-keyed supervisor live, how does it measure goal-delta
independently, and how does it force a feasibility re-derivation without re-instantiating frame-lock.**

---

## 9. Competing architectures, compared from first principles

The goal requires challenging every assumption, including the founder's own proposals, and comparing
architectures from first principles. Below, each candidate for the "goal-keyed supervisor" organ — and each
named v2 proposal — is evaluated against the evidence. **No architecture is selected here** (that is the
design phase); the purpose is to establish what the evidence supports and rules out.

### 9.1 The core question: where does the goal-keyed supervisor live?

**Architecture A — In-loop Stop-hook escalation (the current H9).** The acting agent's own `verify-gate`
Stop-path detects `goal_metric_reachable:false` in a VERIFY and escalates to a FAP.
- *For:* zero new infrastructure; reuses author≠verifier (the proven signal); fail-closed; already designed.
- *Against (decisive):* violates **AN-3** (watchdog inside the loop) and **AN-11** (in-loop independence).
  It depends on the acting agent's verifier *choosing* to stamp the field, in the frame it is already captured
  by. It is the right *signal* in the wrong *locus*. Confidence the locus is wrong: **Strong** (the 08:42
  panel proved an in-loop instrument inherits the frame).

**Architecture B — External progress-watchdog (out-of-loop supervisor keyed on goal-delta).** A separate
process/agent — *not* the worker — periodically reads an *independently measured* goal-delta from a durable
ledger, applies layered trips (AN-5), and on a stall halts the loop and emits a feasibility-re-derivation
boundary.
- *For:* satisfies AN-1/AN-3/AN-4/AN-5/AN-6 directly; matches the five-discipline convergence; the watchdog
  literature's core rule (external to the watched process) is met; composes with the existing FAP/boundary
  machinery as the halt action.
- *Against:* requires a durable goal-state ledger and an out-of-loop execution lane (which the OS does not yet
  have — G2 heartbeat is unbuilt and G9 forbids agent self-spawn, so the "supervisor" cannot be an out-of-loop
  *Claude agent* on this harness; it must be a scripted/gated runner reading state, with escalation to a human
  or the main loop). *Honest harness ceiling, per `AUTONOMOUS-EXECUTION-DEFINITION.md:82-86`.*
- *Verdict:* **the evidence points here**, with the explicit caveat that on the current harness the external
  supervisor is a *scripted, gated, state-reading runner that escalates*, not an autonomous out-of-loop agent
  fleet. Confidence: **Strong** on the shape; **Open** on the runtime that hosts it.

**Architecture C — Human-as-supervisor (status quo).** A human steps back and re-derives feasibility (what
actually happened, twice).
- *For:* it is the *only* frame-breaker proven in the field; cheapest to "build" (nothing).
- *Against:* it is the founder-burden the whole program exists to reduce; it fires late (after 9 hours) and
  only because the founder happened to look. It is the **baseline to beat**, not the answer — but note: AN-6's
  escalation target *is* a human, so v2 does not eliminate the human supervisor; it makes the system *summon*
  the human early and with evidence, instead of relying on the human to *notice* late.

**Synthesis:** B with C as its escalation target, on the durable substrate of the existing engine. The
supervisor is external (B/AN-3), keyed on goal-delta (AN-1), layered (AN-5), and on a stall it does not
auto-redirect (the rejected H9c) — it **halts and summons the human with a feasibility finding** (C/AN-6).
This is the one combination consistent with every principle and every piece of field evidence.

### 9.2 The founder's named v2 proposals, challenged

**Project Owner (a persistent owner holding goal + acceptance criteria + re-frame authority).**
- *Maps to:* AN-1 (single-threaded un-delegatable owner) + AN-3 (external locus) + the attempt-ledger.
- *Supported* in shape. *Hard constraint:* it must be a **different locus than the worker** and hold an
  **independently measured** goal-delta and a **progress/effort budget**; if it is "just another agent in the
  loop," it inherits the frame and adds cost without adding independence (AN-11). *Open question for design:*
  on this harness, is "Project Owner" a persistent *agent* (forbidden out-of-loop by G9) or a persistent
  *state object* (the goal contract + ledger) that the main loop and a scripted watchdog both read? The
  evidence leans to the latter. Confidence: **Strong** on the function, **Open** on the embodiment.

**Heartbeat (+ scheduler).**
- *Challenged hard.* The incident agent emitted "heartbeats" (PRs) continuously and was never hung. A
  **liveness** heartbeat would have shown all-green through the entire failure. The watchdog literature is
  explicit that **liveness ≠ progress**. *Re-derivation:* what v2 needs is a **progress watchdog keyed on
  goal-delta** (AN-1), not a liveness heartbeat. A scheduler/heartbeat is still *necessary* for the unbuilt
  autonomy strata (something must advance blocked work — the inert-`enqueue()` and inert-`setTimeout` gaps),
  but it is **insufficient and, if mistaken for progress monitoring, dangerous.** Confidence: **Strong.**

**Execution Governor.**
- *Maps to:* AN-5 (layered trips) + the circuit-breaker/anti-windup mechanism. *Supported* as the *function*
  of Architecture B. The existing H1 cap is a primitive, time-only instance of it. *Constraint:* it must trip
  on **goal-delta derivative (dGoal/dEffort)**, not only on absolute time/turns/cost, and it must live
  external to the loop. Confidence: **Strong** on the function.

**Persistent specialist agents.**
- *Not yet justified.* Their headline benefit — curing the within-run context-loss that made attempt #8
  re-derive attempt #3 — is more cheaply and reliably served by a **persisted append-only attempt-ledger +
  durable state** (AN-7), per the durable-execution and Anthropic findings. Persistent fleets cost ~15×
  tokens, worsen coordination/context failure modes (Anthropic's own data), and collide with G9. *Prefer*
  durable state + ephemeral workers under a persistent supervisor that holds the state. *Reconsider* only if a
  specific workload demonstrates a benefit a ledger cannot provide. Confidence: **Strong** that the ledger is
  the first move; **Open** on whether any workload later justifies persistence.

**Result bus (the unified callback spine).**
- *Highest-confidence SUPPORTED.* Already built and proven (P1–P4; the ONE completer; 27 files byte-identical
  across two repos), and independently endorsed by the release-engineering canon as the correct durable,
  idempotent, checkpointed substrate for long-horizon work. It is the substrate on which AN-7 and the
  goal-state ledger naturally sit. *This is the part of "v2" with the least architectural risk.* Confidence:
  **Proven** (substrate) / **Strong** (fit for purpose).

**Automatic blind board meetings (auto-redirect in-loop panel).**
- *REJECT* — already correctly rejected by the OS (H9c) and re-confirmed by AN-11. An in-loop panel
  re-instantiates frame-lock. Keep §11 panels as a *human-triggered or out-of-loop* instrument; never wire one
  onto a Stop-hook rung as an auto-redirect.

### 9.3 What this rules in and out for the design phase
- **In (Strong/Proven):** the durable result-bus/saga substrate; an external goal-delta supervisor with
  layered trips that halts-and-summons rather than auto-redirects; a persisted attempt-ledger; goal-level
  author≠verifier; write-ahead accounting; reachability as a checked gate.
- **Out (Strong):** in-loop auto-redirect panels; liveness-heartbeat-as-progress-signal; "spawn a persistent
  fleet" as the default; any goal-keyed control that lives inside the acting loop.
- **Open (for the design phase to resolve):** the *runtime* that hosts the external supervisor given the G9
  harness ceiling (scripted runner vs future out-of-loop capability); whether Project Owner is an agent or a
  state object; the exact reachability-test method (LLM heuristic re-derivation must be paired with hard caps,
  because the heuristic can be wrong — stream F's skeptical note); the false-positive handling for no-progress
  detection (multi-window, escalate-to-human, never silent-kill).

---

## 10. Trade-offs and risks

### 10.1 Core trade-offs the design phase must price
- **Earlier halting vs genuine deep work.** No-progress detection has false positives — some hard tasks show
  flat progress then break through (stream F). *Trade-off:* aggressive trips waste less but kill genuine grind;
  lax trips permit thrash. *Resolution direction:* multi-window detection (short=thrash, long=grind) whose trip
  action is **escalate-to-human, not silent kill**, preserving the founder's "keep going, it's genuinely hard"
  option (AN-6).
- **Autonomy vs the G9 ceiling.** True out-of-loop specialist autonomy needs a runtime beyond this harness;
  building the external supervisor as a scripted/gated runner is achievable now but is *bounded* autonomy, not
  the full "AI OS" claim. *Trade-off:* ship bounded autonomy that is honest, or wait for a runtime that may not
  come. The evidence (and the OS's own ratified position) favors **bounded, honest autonomy first.**
- **Mechanism coverage vs ceremony cost.** The 75-lens-run and 14×-fanout incidents prove over-governance is a
  real, recorded cost. *Trade-off:* every new goal-keyed mechanism must be rate-limited by evidence (§11
  economics) or it becomes the next over-fire. *Resolution:* scale the supervisor's intervention to stakes;
  default to the cheapest reversible response (nudge before halt before escalate).
- **Determinism vs intelligence in the supervisor.** Hard caps (time/cost) are dumb but reliable; feasibility
  re-derivation is intelligent but fallible. *Resolution direction (stream F):* pair them — the caps don't
  depend on getting feasibility right, so they backstop a wrong feasibility heuristic.

### 10.2 Risks to the v2 program itself
- **R1 — Re-instantiating frame-lock.** The single largest risk: building the supervisor as an in-loop agent/
  panel (Architecture A/H9c) and reproducing the exact failure. *Mitigation:* AN-3 is non-negotiable.
- **R2 — Building autonomy on the unbuilt plumbing.** The autonomy strata depend on a scheduler and on
  something actually calling `enqueue()` — both inert today. v2 risks designing the supervisor while the
  substrate it watches doesn't run. *Mitigation:* sequence the durable substrate + heartbeat-as-advancer
  before the goal-supervisor.
- **R3 — Over-building (the Waterline violation).** The proposed-capability catalog shows a large designed-but-
  inert surface already (census-detector, registry, deployment-operator). v2 risks adding more inert
  machinery. *Mitigation:* the over-build guard — a v2 capability earns its place only when a *second* workload
  or a *recorded failure* pulls for it; build the supervisor against the *one* proven failure (the incident),
  not against an imagined fleet.
- **R4 — The self-host blind spot.** A self-modifying v2 that edits its own control plane can blind its own
  gates (G-selfhost, recorded twice). *Mitigation:* the control-plane markers + regression guards must extend
  to any v2 tooling.
- **R5 — Mistaking the autonomy claim.** Shipping bounded autonomy and calling it an "AI OS" repeats the
  goalpost-move the board already caught. *Mitigation:* keep the AUTONOMOUS-EXECUTION-DEFINITION's honest
  labels.
- **R6 — Cost/observability blindness.** v2 multiplies agent activity; without the A3 cost instrument actually
  wired (it is telemetry-only and unmerged), a runaway supervisor or fleet burns invisibly. *Mitigation:*
  write-ahead cost accounting (AN-8) and cost telemetry are prerequisites, not afterthoughts.

---

## 11. Success criteria for Operating Model v2

How the design phase — and later the build — will know v2 has succeeded. These are research-derived
acceptance criteria, not a design.

**Primary (the incident must become impossible):**
- **SC-1 — Goal-delta is first-class and independently measured.** For any `/goal`, an external locus reads an
  objective metric it did not itself produce, every cycle, recorded append-only. *Test:* replay the Discovery
  timeline; `floor=8` flat across cycles is machine-visible by 02:06, not 11:13.
- **SC-2 — Effort-without-progress trips automatically.** Layered trips (cap AND budget AND no-progress AND
  independent verifier) halt the loop on a stall. *Test:* the 10-PR / 9-hour run halts at the no-progress
  threshold, from outside the loop, with no human in the path.
- **SC-3 — A stall forces feasibility re-derivation, not another attempt.** The halt action is a re-derivation
  of reachability from current inputs (independent of the stated target) → a strategy/feasibility boundary to
  the founder. *Test:* the 02:06 finding produces a founder boundary, not PR #218.
- **SC-4 — The supervisor is external and frame-independent.** The locus that trips is provably not the worker
  and does not inherit the worker's frame. *Test:* an in-loop panel would have inherited the frame (08:42); the
  v2 mechanism must demonstrably not.

**Secondary (the recurring patterns must be closed at the goal level):**
- **SC-5 — Long-horizon work is durable/checkpointed/idempotent** (P-substrate cannot recur: no all-or-nothing
  300s job; no inert in-process loop; retried actions are no-ops).
- **SC-6 — Budgets and accounting live outside the work they bound** (AN-8; killed-run spend is visible).
- **SC-7 — Built means operating** (no new designed-but-inert capability ships without the mechanism that
  fires it; AN-10).
- **SC-8 — Founder burden falls without relaxing safety** (the founder is *summoned early with evidence*
  instead of *noticing late*; Class-C human gates unchanged).

**Honesty criteria (the claim stays truthful):**
- **SC-9 — The autonomy claim matches the runtime.** Bounded autonomy is labeled bounded; the "AI OS" noun is
  reserved for the Founder Absence Test passing (`AUTONOMOUS-EXECUTION-DEFINITION.md:69-86`).
- **SC-10 — Every v2 mechanism is evidence-rate-limited** (no new over-fire; §11 economics hold).

---

## 12. Prioritized recommendations (research conclusions — for the design phase)

Ordered by the evidence's confidence and by de-risking sequence. **These are recommendations for what to
decide and design next; they are not a v2 design and authorize no implementation.**

**Tier 0 — Settle before designing (foundational decisions):**
1. **Adopt AN-1…AN-12 as the v2 design invariants.** They are the timeless principles re-derived for AI-native
   operation and are individually evidence-backed. *(Strong/Proven.)*
2. **Commit to the supervisor's locus question as the central design problem** (§8.3): external, goal-keyed,
   halts-and-summons. Rule out Architecture A (in-loop H9) and auto-redirect panels now, so the design phase
   does not relitigate them. *(Strong.)*
3. **Resolve the runtime/G9 question explicitly** (Open): is the external supervisor a scripted/gated
   state-reading runner (buildable now) or does it wait on an out-of-loop capability? Pick honestly; favor
   bounded autonomy first.

**Tier 1 — The de-risking order (riskiest-unknown-first, §9 / R2):**
4. **The durable result-bus/saga substrate + goal-state ledger first** (Proven substrate exists; AN-7).
   Everything else watches this; without it there is nothing to measure. *(Highest confidence; lowest
   architectural risk.)*
5. **A progress watchdog keyed on goal-delta, external to the loop, with layered trips** (Architecture B;
   AN-3/AN-5). This is the missing organ; design it to *halt-and-summon*, never auto-redirect. *(Strong.)*
6. **Reachability as a checked gate** — before execution and re-checked on stall (AN-4); paired with hard caps
   so a wrong feasibility heuristic is backstopped. *(Strong; method is Open.)*
7. **Goal-level author≠verifier** — give the goal-level verifier finding the teeth the slice-level one has
   (AN-9); amplify the proven signal rather than automate it away. *(Strong.)*

**Tier 2 — Close the recurring patterns at the goal level:**
8. **Write-ahead accounting / budgets-outside-the-work** (AN-8; the spend-cap latent finding). *(Strong.)*
9. **A persisted attempt-ledger** (cures within-run context-loss; the cheaper alternative to persistent agents,
   §9.2). *(Strong.)*
10. **Make "built = operating" a gate** (AN-10; the census-detector/registry/enqueue inert surface). *(Strong.)*

**Tier 3 — Explicitly defer or reject (so effort is not spent here):**
11. **Defer persistent specialist agents** until a workload proves a benefit the ledger cannot give (§9.2).
12. **Reject auto-redirect in-loop panels** (H9c; AN-11) — settled, do not revisit.
13. **Re-frame "heartbeat"** to "progress-watchdog"; a liveness heartbeat is a necessary *advancer* for the
    autonomy strata but must never be read as a progress signal (§9.2).

**The single highest-leverage recommendation, restated:** build the **external, goal-delta-keyed supervisor
that separates liveness from progress, layers its trips, and on a stall halts → summons the human with a
feasibility finding → re-derives reachability before authorizing more effort.** Five independent disciplines
and the framework's own primary incident all point at this one organ. It is the difference between a delivery
model that does excellent work on the wrong thing for nine hours, and an operating model that knows when to
stop and ask.

---

## 13. Appendix — evidence index

- **Primary incident:** `docs/reviews/HANDOFF-2026-06-28-discovery-incident.md`,
  `docs/reviews/POSTMORTEM-2026-06-28-discovery-execution.md`,
  `docs/reviews/FOUNDATION-REVIEW-2026-06-28-discovery.md`,
  `docs/reviews/LEARNING-REVIEW-2026-06-28-discovery.md`; PLOS PR #217 VERIFY (02:06),
  PR #228 + `docs/verify/VERIFY-seed-cron-design-a.md`, PR #229; `discovery.ts:258-350`.
- **OS spine:** `core/GOVERNANCE.md` §1–§16; `DECISIONS.md` D1–D10; `CHANGELOG-v2..v5`;
  `capabilities/GOAL-EXECUTION-CONTRACT.md` (H1–H9); `capabilities/AUTONOMOUS-EXECUTION-DEFINITION.md`;
  `capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md` (P1–P4 + §10 verifier model).
- **Incident corpus:** `case-studies/2026-06-incident-ledger.md`,
  `case-studies/2026-06-10-author-verifier-not-operationalized.md`,
  `case-studies/2026-06-13-company-os-phase.md`, `case-studies/2026-06-wiki-citation-survival.md`;
  `docs/feedback/OS-FEEDBACK-*`; `capabilities/signals.jsonl` (distilled lesson corpus).
- **Consumer production history:** rumah-admin `docs/RETROSPECTIVE-2026-06-25-ci-health-and-p0-signer.md`,
  `docs/INVOICE-DELIVERY-PIPELINE-ROOTCAUSE-2026-06-26.md`,
  `docs/RETROSPECTIVE-2026-06-27-reliability-keystone-and-infra-platform.md`;
  property-lead-os `docs/audits/RCA-CONVERGED-discovery-plos-2026-06-27.md`.
- **Proposed v2 surface:** `docs/V6-ARCHITECTURE.md`, `docs/END-STATE-ARCHITECTURE.md`,
  `docs/FOUNDER-ACTION-ELIMINATION-PLAN-2026-06-24.md`, `docs/BUSINESS-TRIGGER-ARCHITECTURE-2026-06-24.md`,
  `capabilities/CAPABILITY-LEDGER.md`, `capabilities/G9-DISPATCH-RUNNER-ARCHITECTURE.md`.
- **External first-principles sources** (full URLs in stream F digest): Vogels/ACM Queue; Google SRE
  (golden signals, error budgets, alerting on SLOs, postmortem culture); Bezos one/two-way doors; Toyota
  Jidoka/Andon; Klein pre-mortem; AWS saga + durable functions; serverless-timeout limits; closed-loop
  control + anti-windup; supervisory control theory (reachability/controllability); Argyris double-loop;
  Boyd OODA; Anthropic (multi-agent system, building effective agents); reward hacking (Weng); goal
  misgeneralization (arXiv 2401.07181); agentic failure modes; watchdog-vs-heartbeat; circuit breaker (Fowler).

---

*End of research foundation. This document decides nothing irreversible and designs no architecture; it is the
evidence base and the prioritized conclusions on which a separate Operating Model v2 design phase — itself a
consequential decision requiring an independent §11 panel — should build.*
