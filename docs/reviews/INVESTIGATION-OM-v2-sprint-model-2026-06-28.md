---
artifact: ARCHITECTURE-INVESTIGATION
id: INV-OM-v2-sprint
subject: Should the Operating Model be built around AI-native execution sprints (structured, objective-anchored, completion-reviewed iterations) rather than continuous unstructured execution?
date: 2026-06-28
status: investigation COMPLETE (design-only; an independent adversarial pass — §8 — WALKED BACK the "mandatory core" elevation; §8 is authoritative and supersedes §0/§7). Builds on INVESTIGATION-OM-v2-three-proposals §11 and the OBW-GS/c panel.
evidence_base:
  - docs/reviews/INVESTIGATION-OM-v2-three-proposals-2026-06-28.md (§11 — the adversarial walk-back of the first sprint take)
  - docs/reviews/ADR-OPERATING-MODEL-V2-2026-06-28.md (OBW-GS/c: the GS, author≠verifier, the H1 cap, C1/C4/C8/C9)
  - docs/reviews/HANDOFF-2026-06-28-discovery-incident.md (the incident = continuous unstructured execution)
  - capabilities/DELIVERY-OS-EXECUTION-MODEL-V1.md §10 (the verified-loop: Goal → Act → Verify → Improve → Stop; the verifier-must-be-evaluated principle)
  - external prior art (Reflexion trial-boundary reflection · OODA Orient · MPC receding horizon · K8s reconcile · watchdog independence)
scope_guard: Design only. Treats the sprint proposal as a hypothesis and challenges it — including against the discovery incident, whose root pattern is the failure mode a naïve "continue until complete" sprint loop would reproduce.
---

# Investigation — AI-native execution sprints as a core architectural concept

> **The question (founder directive):** should the Operating Model be built around **AI-native execution
> sprints** — each beginning with a clear objective + success criteria + execution plan owned by the Project
> Owner; during which the PO continuously monitors, collects evidence, reviews intermediate results, interrupts
> stalled/misaligned work, re-plans, and launches workers; ending in a **formal completion review against the
> original objective and acceptance criteria**; and if not achieved, **automatically generating the next sprint**
> and continuing until the objective is complete — rather than continuous unstructured execution? And: what is
> the optimal sprint duration, supervision cadence, and review process?

> **⚠ READ §8 FIRST — the adversarial pass changed the verdict.** §0–§7 are the *first draft* (and rendered
> "YES, core" before the challenge existed — the very error it guards against). An independent blind review (§8)
> found that promoting the Evidence Cycle to a *mandatory CORE concept* re-inflates a panel-DEFERRED item (C8) and
> re-centers on the mid-flight review while ignoring that the panel ranked the **pre-flight gate PRIMARY**. Those
> objections were **largely conceded.** The **authoritative outcome is §8**: the *substance* (structured,
> evidence-bounded, independently-reviewed, halt-capable iteration) is right and **already exists in OBW-GS/c**;
> the *"make it mandatory core"* framing is routed to a §11 panel as doctrine, not ratified here; the per-sprint
> review is the **backstop** (not the primary fix), must be **stakes-gated**, must re-check **metric-fitness**,
> and **slow-asymptotic convergence remains an unsolved open problem** bounded only by the hard cap.

## 0. Verdict (one screen)

**YES — structure execution into bounded, objective-anchored, formally-reviewed iterations, and make it a core
concept. REJECT continuous *unstructured* execution.** This is the single most direct architectural lesson of the
discovery incident, which *was* continuous unstructured execution: ~9 hours / ~10 PRs with **no per-iteration
formal completion review against the objective**. The structure the founder describes — objective → execute →
**review against acceptance criteria** → loop or stop — is the framework's own proven **verified-loop DNA**
(`EXECUTION-MODEL-V1` §10: Goal → Act → Verify → Improve → Stop) made first-class and mandatory.

**But the proposal carries one phrase that is the incident verbatim, and three corrections the evidence makes
non-negotiable.** This is *not* the human-Scrum time-box the prior adversarial pass rejected (§11) — and it must
not become the 10-PR loop with ceremony:

| The founder's sprint model | Evidence verdict | The required correction |
|---|---|---|
| Structured iterations w/ objective + criteria + plan, vs continuous unstructured flow | **ACCEPT — core concept** | Make the verified-loop / Evidence Cycle a *first-class, named, mandatory* unit (the "sprint"). |
| Formal completion review against the original criteria at each boundary | **ACCEPT — and strengthen** | The completion review must be **INDEPENDENT (author≠verifier)** — the PO may not be the sole judge of its own sprint (else frame-lock). Reuse the goal-level verifier. |
| "Continue until the objective is successfully completed" (auto-generate next sprint) | **ACCEPT *only* with the escape** | Each completion review must be able to conclude **"unreachable / structurally insufficient → HALT → summon the founder"** (a feasibility boundary), not only "not done → sprint again." **Without this, the sprint loop IS the discovery incident.** |
| "PO continuously monitors during the sprint" | **ACCEPT as the existing organs** | "Continuous monitoring" = the **level-triggered liveness tick + the Goal Supervisor** (§11), *not* a new intelligent per-tick PO driver (cost/non-determinism/redundancy — §11 B1/S4). |
| "Launch additional worker agents" | **ACCEPT via G9** | The **main loop** spawns (G9); the sprint plan dispatches via `dispatch-route`. |
| "Optimal sprint *duration*" | **REFRAME** | There is **no fixed optimal duration.** The boundary is **EVIDENCE** (the completion review fires when the acceptance criteria become evaluable), with a **wall-clock cap as a backstop** (the existing H1 cap). |

**Net:** the "AI-native sprint" is the right organizing concept *because it is the structured, reviewed,
bounded loop — not because it is a fixed time-box and not because it runs forever until done.* It is
**recorded-failure-pulled** (the incident), composes **existing organs** (verified-loop + author≠verifier + GS +
H1 cap + `dispatch-route`), and therefore — unlike the withdrawn additions in §11 — **clears the Waterline bar.**
This **revises Proposal 2's first-draft "reject sprints"**: the fixed time-box stays rejected; *structured
evidence-bounded iteration* is accepted and promoted to a core concept.

---

## 1. Continuous-unstructured vs structured-iteration — the incident decides it

The discovery incident is the controlled experiment. It ran as **continuous unstructured execution**:
- a single long flow of ~10 PRs over ~9 hours,
- **no iteration boundary at which the work was formally reviewed against the objective** (`floor ≥ 20`),
- so each PR optimized a local sub-goal (per-lead qualify-rate) while the objective (lead volume) never moved,
- and nothing forced a stop-and-check until a human intervened twice.

Had execution been **structured into objective-anchored iterations with a formal completion review against the
acceptance criteria at each boundary**, the *first* completion review would have asked "did `floor` move toward
20?" — answer: no — and the review (independent) would have surfaced #217's "≥20 unreachable from these leads"
*as the boundary verdict*, halting after one iteration instead of ten. **Structure is the cure; the missing
organ was the per-iteration completion review against the objective.** This is exactly the founder's proposal —
which is why it is accepted as a core concept.

The prior art agrees that bounded, reviewed iteration beats unstructured flow for autonomous agents: **Reflexion**
reflects at *trial boundaries* (not continuously, not never); **OODA** demands a periodic *Orient*; **MPC** acts
on a receding horizon and *re-solves each step*; the framework's own **verified loop** stops only when an
objective check passes. None of them run unstructured-until-tired (agents don't tire — the precise reason
structure must be *engineered*, not assumed).

---

## 2. Why this is NOT the time-box the adversarial pass rejected (and not re-inflation)

§11 walked back (a) a fixed 24–72h sprint as the *primary cadence* and (b) a reflection-backstop organ. This
proposal survives that walk-back because it is a *different claim*:
- **The boundary is evidence, not a clock.** A "sprint" ends when its objective's acceptance criteria become
  evaluable (the completion review), not at hour 24. The clock appears only as a **backstop cap** (the existing
  H1 turn/wall-clock/cost cap), never as the driver. §11 rejected the *clock as primary*; this keeps evidence as
  primary. ✔
- **No new organ is minted.** The sprint is a *composition* of existing, proven organs: the verified-loop
  pattern (`EXECUTION-MODEL-V1` §10) + the independent verifier (author≠verifier) + the GS (halt-and-summon) +
  the H1 cap + `dispatch-route` (work packages). §11's objection was to *new core organs* (the PO-reconciler, the
  reflection backstop); this adds none. ✔
- **It is recorded-failure-pulled.** The incident is the pull (Waterline bar: observed-failure). §11's withdrawn
  items failed the bar (no recorded failure pulled them); this passes it. ✔
- **The "continuous monitoring" is the existing tick + GS, not a per-tick driver.** The PO does not run an
  intelligent LLM pass every tick (the cost/non-determinism objection, §11 S4). Within a sprint, monitoring =
  the level-triggered liveness tick (advance/observe verified state, detect a hung worker) + the GS (dGoal/dEffort
  on the durable ledger). The PO's *intelligence* is spent at the **boundaries** (plan a sprint; review its
  completion), not every tick — which is exactly where Reflexion/OODA spend it. ✔

So this is the **structuring of execution into reviewed iterations**, which §11 never opposed — §11 opposed a
*clock-primary* cadence and a *redundant new organ*. This proposal is clock-*backstopped*, evidence-*primary*,
and organ-*composing*.

---

## 3. The non-negotiable correction — the completion review must be able to HALT, not only re-sprint

This is the heart of the investigation, and the one place the founder's wording must be amended.

> Founder wording: *"If the objective has not been achieved or quality is insufficient, the Project Owner should
> automatically generate the next sprint … and continue execution until the objective is successfully completed."*

**As written, this is the discovery incident.** "Not achieved → generate the next sprint → continue until
complete" is an **unbounded loop with no feasibility gate** — precisely the 10-PR loop, now with a "sprint"
label and a completion-review ceremony that always returns "not done, go again." An objective that is
*architecturally unreachable* (≥20 from those leads; the 300s all-or-nothing ceiling) would spawn sprint after
sprint forever, each "successfully" executing work that cannot move the goal.

**The required design:** the formal completion review is a **three-way verdict**, not a two-way (done / not-done):

| Completion-review verdict | Condition | Action |
|---|---|---|
| **objective-complete** | acceptance criteria met (independently verified) | **STOP** — success. |
| **incomplete-but-reachable** | criteria not met, *and* the goal-delta is moving (or a concrete unblocked path exists) | **auto-generate the next sprint** — redirect work packages, continue. *(This is the founder's loop — and it is correct here.)* |
| **unreachable / structurally-insufficient** | criteria not met *and* the goal-delta is flat/declining across iterations, or a verifier finds the target unreachable from current inputs | **HALT → summon the founder** (a feasibility/strategy boundary FAP). **Never auto-sprint.** |

The third row is the incident's missing organ, and it already exists in OBW-GS/c: it is the **GS's
halt-and-summon** and **goal-level author≠verifier** (C1/C4). The sprint loop **reuses** it: the completion
review *is* where the GS verdict is consumed. So "continue until complete" becomes **"continue until complete OR
a completion review proves the objective unreachable,"** which is the framework's `boundary = STOP = SUCCESS`
doctrine applied per-sprint. **This single amendment is what separates a disciplined AI-native sprint loop from
the incident it would otherwise reproduce.**

A second guard (author≠verifier): the completion review **cannot be performed by the PO alone**, because the PO
authored the sprint plan and drove the work — a self-review re-instantiates the frame-lock the 08:42 panel
proved fatal. The completion review's *judgment of done/reachable* is the **independent verifier's** (the same
goal-level author≠verifier the ADR already binds, C4 — re-probing the metric externally under its own identity).
The PO *runs* the review; it does not *adjudicate* it.

---

## 4. The specific answers — duration, supervision cadence, review process

### 4.1 Optimal sprint duration — evidence-bounded, capped, not a fixed number
There is **no single optimal duration**, and choosing one would re-import the human-Scrum error. A sprint ends
when **its objective's acceptance criteria become evaluable** — which is intrinsic to the work, not the clock.
The clock enters only as a **fail-safe cap** (the existing H1 turn/wall-clock/cost ceiling): a sprint that hits
the cap without reaching its completion review is *forced* to a completion review with a `cap-tripped` input
(→ almost always the "unreachable/insufficient → halt → summon" verdict). Practical guidance:
- **Driver:** evidence (the smallest objective whose acceptance is independently checkable).
- **Backstop cap:** small enough to bound waste, large enough to complete a real increment — the existing
  default (~6h / 250 turns) is a reasonable *ceiling*, but most sprints should close on *evidence* far sooner.
  Right-size the objective so each sprint is the *thinnest increment with an independently verifiable acceptance
  check* (the vertical-slice discipline). If sprints routinely hit the cap, the objectives are scoped too large —
  that is the signal, not a reason to raise the cap.

### 4.2 Supervision cadence — the existing tick + GS, intelligence at the boundaries
- **Within a sprint (cheap, continuous):** the **level-triggered liveness tick** (advance ready work; observe
  *verified* state; detect a hung/looping worker → bounded restart) + the **GS** (compute dGoal/dEffort on the
  durable ledger; trip on effort-without-progress). These run on a schedule (the existing engine
  heartbeat for step advancement; the GS on a coarser cron) and read durable state, so a late tick is safe.
  **No per-tick LLM PO pass** (§11 S4).
- **At sprint boundaries (expensive, rare):** the PO spends real intelligence **twice** — *planning* the sprint
  (objective + acceptance criteria + work packages, via `dispatch-route`) and *running the completion review*.
  This is the Reflexion/OODA cadence: reflect at the trial boundary, act in between. It is also where token cost
  is justified (two boundary passes per sprint, not N per-tick passes).
- **Interrupt cadence:** a worker stall is caught by the tick (observed≠desired, self-heals next pass); a
  *goal-level* stall (flat dGoal/dEffort) is caught by the GS and forces an **early completion review** — i.e., a
  sprint can be cut short by the GS, which is the in-sprint "interrupt stalled/misaligned work" the founder
  describes, done by the independent organ rather than the driver.

### 4.3 Review process — a formal, independent, three-verdict completion review
1. **Inputs:** the original objective + acceptance criteria (frozen at sprint start, immutable during the
   sprint — so the review grades against the *original* target, not a drifted one); the goal-delta ledger; the
   verified artifact state; the H1 cap status.
2. **Adjudication:** **independent** (author≠verifier / the goal-level verifier — C4), not the PO. Re-probes the
   acceptance metric from its canonical external source under the verifier's identity.
3. **Verdict:** the three-way verdict of §3 (complete / incomplete-but-reachable / unreachable-→-halt-summon).
4. **On incomplete-but-reachable:** the PO auto-generates the next sprint — a **new objective + acceptance
   criteria + work packages** derived from what the review learned — and dispatches via `dispatch-route` (work
   packages, specialist redirection). **Anti-windup:** the next sprint re-plans from current verified state and
   *discards the stale plan tail* (MPC commit-first-discard-rest) — it does not accumulate plan authority across
   sprints.
5. **On unreachable:** emit the feasibility-boundary FAP; **terminate** (boundary = success). The next autonomous
   segment is a fresh `/goal` after the founder acts.
6. **Capture:** the completion review is a natural L1 learning checkpoint (event-fired) — lessons feed the
   ledger. *(This is the honest place the §11-rejected "reflection" belongs: at the evidence-bounded sprint
   review, not bolted onto a wall clock.)*

---

## 5. The sprint loop, assembled from existing organs (no new core organ)

```
  /goal objective
     │
     ▼
  ┌─ SPRINT ──────────────────────────────────────────────────────────────┐
  │ PLAN (PO, boundary intelligence): objective + acceptance criteria +    │
  │      execution plan → work packages via dispatch-route (G9 main-loop    │
  │      spawns workers)                                                     │
  │ EXECUTE (workers: ground→build→verify-on-real-surface→post to bus)      │
  │ MONITOR (cheap, continuous): liveness tick (advance/observe verified;   │
  │      restart hung worker) + GS (dGoal/dEffort) — GS may force early review│
  └───────────────┬────────────────────────────────────────────────────────┘
                  ▼
   COMPLETION REVIEW (INDEPENDENT verifier, author≠verifier; against the
   FROZEN original objective + acceptance criteria):
      ├─ complete ─────────────► STOP (success)
      ├─ incomplete-but-reachable ─► PO auto-generates NEXT sprint
      │                              (re-plan from verified state, discard
      │                               stale tail; redirect specialists) ──┐
      └─ unreachable/insufficient ─► HALT → summon founder (feasibility    │
                                     boundary FAP) → terminate              │
                                                                           │
        ▲──────────────────────────────────────────────────────────────────┘
        (loop bounded by: objective-complete OR feasibility-boundary OR H1 cap)
```
Every box is an **existing** organ: PLAN = `dispatch-route` + the goal contract; EXECUTE = workers on the Result
Bus; MONITOR = the liveness tick + GS; COMPLETION REVIEW = the goal-level author≠verifier + the GS three-verdict;
the loop bound = `boundary = STOP = SUCCESS` + the H1 cap. **The "AI-native sprint" is the *name and the
mandatory structure* for composing them** — the first-class concept the founder asks for — not a new mechanism.

---

## 6. Compatibility with the locked invariants & the panel/§11 discipline
- **author ≠ verifier:** *strengthened* — the completion review is independent of the PO; the metric is
  re-probed under the verifier's identity (C4). ✔
- **Goal Supervisor:** the GS *is* the in-sprint progress monitor + the source of the third (halt) verdict —
  reused, not duplicated. ✔
- **C1 (the machine never judges feasibility; the human does):** preserved — the "unreachable" verdict **summons
  the founder**; it does not auto-decide to abandon. ✔
- **C8 (defer the active PO orchestrator role):** respected — the PO's intelligence is at *boundaries* (plan +
  review), which it already does for any `/goal`; no per-tick active orchestrator is introduced. ✔
- **C9 (flat goal-delta revokes autonomous re-frame):** this *is* the trigger that converts an in-sprint stall
  into an early completion review / halt. ✔
- **H1 cap:** the sprint's wall-clock backstop — reused. ✔
- **Result Bus / Company OS / validation ladder / GitHub Actions:** unchanged; sprints run their workers through
  the same ladder; the tick/GS run on the same cron substrate. ✔
- **Waterline / §11 discipline:** clears the bar (recorded-failure-pulled; composes existing organs; adds no new
  core organ). The one genuinely *new* required behavior — the **three-verdict completion review** — is the
  incident's missing organ and is itself author≠verifier-bound. ✔

---

## 7. Recommended ADR modification (justified)
- **M-SPRINT — promote the verified-loop / Evidence Cycle to a first-class, mandatory "AI-native sprint":** an
  objective-anchored, evidence-bounded iteration with **frozen acceptance criteria**, cheap continuous monitoring
  (tick + GS), and a **formal, independent, three-verdict completion review** (complete / incomplete-but-reachable
  → auto-next-sprint / unreachable → halt-summon). The boundary is **evidence**, capped by **H1**; the loop bound
  is **objective-complete OR feasibility-boundary**. This **supersedes the first-draft Proposal-2 "reject
  sprints"** (the fixed time-box stays rejected; structured evidence-bounded iteration is the accepted form) and
  **does not reintroduce** the §11-withdrawn PO-reconciler or reflection-backstop organs.
- It is a **structuring of execution**, not a new mechanism — so it folds into the ADR's execution/governance
  sections at the design-detail phase, gated (like all of OBW-GS/c) behind founder ratification and the proof
  slices. *No code is written here.*

---

## 8. Adversarial pass — findings, concessions, and the REVISED verdict (authoritative)

> **This section supersedes §0 and §7 where they conflict.** An independent blind adversarial lens reviewed this
> investigation and returned **SOUND-WITH-CONDITIONS, conditions BLOCKING.** On honest examination the objections
> **largely hold**, and — faithful to §11 discipline and to the framework's rule that an author does not conclude
> a consequential decision alone — the verdict is revised. **The substance is right and *already exists* in
> OBW-GS/c; the "make it a mandatory CORE concept" framing is re-inflation of a panel-deferred item and is routed
> to a panel as doctrine, not ratified here.** The draft above (§0–§7) also rendered "YES, core" *before* this
> challenge existed — itself the error it was meant to guard against. Corrected below.

### 8.1 The decisive concession
The "AI-native sprint" *is* the **Evidence Cycle**, which the OBW-GS/c panel explicitly placed in **DEFER —
build-on-pull (C8 · ADR §19.3, OM-9).** Promoting it to "first-class, mandatory CORE" (M-SPRINT) on a single
author's say-so, one document later, with OBW-GS/c **not yet ratified**, is the precise move the panel forbade
(ADR §17; the sibling §11.1). The defense "it adds no new *organ*" is a category error — **C8 deferred the
Evidence-Cycle *framing*, a construct, not only organs**, and this doc concedes it is "a structuring of
execution, not a new mechanism" (§5/§7). A mandatory structuring of a deferred construct is the deferred
category. → **M-SPRINT is demoted to a build-on-pull recommendation routed to its own §11 panel.**

### 8.2 Finding-by-finding disposition
- **B1 — promotes a C8-deferred item to core, pre-empting its own §8. CONCEDED.** The Evidence Cycle stays
  **DEFER (C8)**; this investigation *recommends* it be named/structured (the three-way verdict is useful
  doctrine), but the *elevation to mandatory core* is a panel decision (ADR §19.5 step 6). Status corrected to
  "hypothesis, challenged."
- **B2 — re-centers on the mid-flight completion review, ignoring the PRE-FLIGHT gate (C2/§19.2). CONCEDED —
  and it is the most important correction.** The panel's *headline* ranking is **pre-flight gate PRIMARY**
  (it refuses the unreachable goal at **hour 0, before sprint 1 exists**), **mid-flight watchdog/review
  BACKSTOP**. This investigation framed the per-iteration completion review as "the cure / the missing organ"
  and never mentioned the pre-flight gate. → **Subordinate the review to the pre-flight gate.** *For the
  discovery incident the sprint loop is NOT the primary fix — the pre-flight feasibility/serverless-ceiling gate
  is; the sprint's completion review earns its keep only on the residual not-statically-knowable class.*
- **B3 — "the three-verdict review saves continue-until-complete" is overstated; the slow-convergence class is
  unsolved. CONCEDED (a real hole).** The "unreachable → halt" verdict gates on **flat/declining** delta — but a
  **slowly-moving-but-practically-infinite** objective has *positive* dGoal/dEffort → "incomplete-but-reachable"
  → auto-next-sprint **forever**, each sprint individually "reachable," the objective never practically
  converging. The GS trips on *flat*, not *slow-positive*, so this investigation **inherits the blind spot while
  claiming to close the loop**. → **Strike the "saves" claim.** The real bound on infinite grind is the
  **existing H1 layered cap** (turn/wall-clock/cost), *not* the new ceremony; and **the slow-asymptotic-
  convergence class remains genuinely unsolved by either organ** — flagged as an open problem for the design
  phase, not papered over. (Candidate directions, unbuilt: a *rate-of-convergence* floor — require dGoal/dEffort
  to project reaching the target within the budget, not merely be positive — but that is a new mechanism owing
  its own evidence and panel.)
- **B4 — frozen PO-authored criteria re-create the C4 metric-selection frame-lock per sprint. CONCEDED.** The
  draft imported C4(a) (re-probe the metric *value* externally) but omitted **C4(b): the metric-*fitness* check
  at authoring.** A PO authors the frozen criteria; the PO is the frame-holder (ADR §3.3); a fitness-unchecked
  frozen metric runs a whole sprint "successfully moving the wrong proxy" with the watchdog green — the C4
  failure, entrenched per sprint. → **Require the C4(b) metric-fitness check at each sprint's planning**, and
  name who may break a frozen criterion mid-sprint when fitness is challenged (an independent verifier /
  founder, never the PO alone).
- **B5 — a mandatory, universal completion review is the ceremony-overrun (75-lens) class. CONCEDED.** ADR
  §15.1 rate-limits every goal-keyed mechanism by evidence to avoid over-fire; a formal independent review on
  *every* sprint boundary is not rate-limited. → **Make the independent completion review STAKES-GATED**
  (Class-C / founder-verifiable / cross-system objectives), not universal. A thin slice's cheap default is the
  *existing* verify-gate + the arithmetic watchdog reading the ledger; the expensive independent review fires by
  stakes, mirroring §11 panel economics.
- **D6 — "core concept" overclaims a noun. CONCEDED.** Decomposed, the three verdicts are existing organs
  (boundary-is-success stop · the loop continuing · the GS trip → halt-summon). It buys **naming + doctrine, not
  mechanism**. → Recast as **doctrine** ("the Evidence Cycle terminates on a *three-way* verdict, not two-way")
  on the build-on-pull queue.

### 8.3 What survives (confirmation / doctrine — not a core ratification)
1. **No fixed optimal duration; evidence-bounded, cap-backstopped** — *confirms* the existing reject-fixed-sprints
   decision. [Strong]
2. **"Continue until complete" needs a halt-escape** — correct, and it is the *already-ratified* C1/§5.3
   halt-and-summon, consumed at the boundary. A faithful articulation, not a new organ. [Strong]
3. **Monitoring = the existing tick + GS; intelligence at boundaries; no per-tick LLM driver** — genuinely
   §11-compliant; keep as a guardrail statement. [Strong]
4. **Anti-windup: re-plan from verified state, discard the stale tail** — sound. [Strong]
5. **The three-way (vs two-way) termination as DOCTRINE** — a useful naming clarification of existing behavior,
   fit for build-on-pull. [Plausible]

### 8.4 The honest answer to the founder's question
**"Should the Operating Model be built around AI-native execution sprints rather than continuous unstructured
execution?"** — *The structure you describe is right, and it already exists in the design.* Reject continuous
**unstructured** execution: yes (the incident proves it). But the structured, objective-anchored, evidence-
bounded, independently-reviewed, **halt-capable** iteration you want **is** the OBW-GS/c composition already on
the table — the **Evidence Cycle + the Goal Supervisor's halt-and-summon + the pre-flight feasibility gate + the
layered cap**. The incident pulls for *those organs — all already in OBW-GS/c* — **not** for a *new mandatory
sprint construct*. Three corrections the evidence forces on the founder's wording:
1. **The primary fix is the pre-flight gate, not the per-sprint review** — refuse an unreachable objective
   *before* sprint 1; do not discover unreachability only at completion reviews (that is the backstop).
2. **"Continue until complete" is bounded by the hard cap, and the slow-asymptotic case is unsolved** — auto-
   generating sprints while the goal creeps is a real, open failure mode; the cap is the only current backstop.
   Be honest that "until complete" is "until complete OR the cap OR a proven-unreachable verdict," and that
   *slow-but-positive* progress toward an effectively-unreachable target is not yet caught.
3. **The formal review is stakes-gated and metric-fitness-checked, not a universal ceremony** — or it becomes
   the over-governance the framework already burned on.

And the **scope move** — making this a *mandatory core concept* — is the one thing the panel deliberately
deferred; it goes to a §11 panel as doctrine, on the build-on-pull queue, **after** OBW-GS/c's narrow core is
ratified. That is the disciplined, evidence-only outcome — and the correct push-back on a directive whose
substance is already satisfied by the design.

### 8.5 Revised recommendation (replaces §7 M-SPRINT)
- **M-SPRINT′ — recommend (to a future §11 panel, build-on-pull):** name the Evidence Cycle the "AI-native
  sprint" and adopt the **three-way completion verdict as doctrine** (complete / incomplete-but-reachable →
  next-sprint / unreachable → halt-summon), with: the **pre-flight gate as the primary feasibility fix**, the
  review **subordinate and stakes-gated**, **per-sprint metric-fitness (C4b)**, **anti-windup re-planning**, and
  an explicit **open-problem note: slow-asymptotic convergence is bounded only by the H1 cap.** Do **not** ratify
  it to core here; OBW-GS/c stands as the panel left it.
