---
artifact: ARCHITECTURE-INVESTIGATION
id: INV-OM-v2-proposals
subject: Three proposed additions to Operating Model v2 — Persistent Project Owner · AI-native Sprint Model · Slack-first — plus continuous orchestration & the scheduler/heartbeat architecture
date: 2026-06-28
status: investigation COMPLETE (design-only; an independent adversarial pass — §11 — WALKED BACK the headline additions; §11 is authoritative and supersedes §0/§10)
evidence_base:
  - docs/reviews/RESEARCH-FOUNDATION-2026-06-28-operating-model-v2.md
  - docs/reviews/ADR-OPERATING-MODEL-V2-2026-06-28.md (OBW-GS/c + the four-lens panel)
  - docs/reviews/HANDOFF-2026-06-28-discovery-incident.md
  - external prior art (Kubernetes/Borg/Omega · Temporal/DBOS/Step Functions · Google distributed cron · Erlang/OTP · ChatOps/SRE · Reflexion/Generative Agents · control theory)
  - on-disk grounding (what is built vs designed vs inert; the jarvis-slack seed)
scope_guard: Design only. Implements nothing. Recommends ADR modifications where evidence justifies; rejects proposals that are not objectively superior for an AI-native organization.
---

# Investigation — three proposed additions to Operating Model v2

> **Method.** Each proposal is treated as a **hypothesis**, not an assumption, and challenged against (a) first
> principles, (b) primary-source distributed-systems / control-theory / agent prior art, (c) the OBW-GS/c ADR +
> its four-lens panel, (d) the PLOS incident and the full Company-OS record, and (e) **what is actually on disk.**
> A proposal is preserved only if it is *objectively superior for an AI-native organization*; otherwise it is
> rejected or refined, with the reason. Where a proposal improves the model, §10 specifies the exact, justified
> ADR modification. Every recommendation is checked compatible with the locked invariants (§9).

> **⚠ READ §11 FIRST — the adversarial pass changed the outcome.** §0–§10 are the *first draft*. An independent
> blind adversarial review (§11) found that the three headline additions (PO-reconciler as a new core organ;
> Slack-first overturning the panel; a reflection backstop) **re-inflated scope the OBW-GS/c panel had
> deliberately deferred (C8) and reversed BLOCKER-class conditions on a single author's say-so.** Those
> objections were examined and **largely conceded.** The **REVISED, authoritative outcome is §11**: the
> persistent-process PO is rejected; the reconciler is *withdrawn as a new organ* and folded into the existing
> liveness tick as a level-triggered upgrade; the reflection backstop is *cut* (redundant with panel-C4);
> Slack-first stays *deferred to a fresh panel* (recommended as the leading founder-surface candidate, not
> unilaterally overturned). The dead-man's-switch survives. Net: **OBW-GS/c stands as the panel left it.**

---

## 0. Executive verdicts (one screen)

The prior art is unusually convergent: **Kubernetes/Borg/Omega, Temporal/DBOS/Step Functions, Google distributed
cron, and Erlang/OTP all answer the orchestration question with the same shape** — *durable STATE reconciled by
periodic, level-triggered, stateless COMPUTE; events as a latency optimization only; a thin conversational
surface as the human doorbell.* That backbone resolves all three proposals and both cross-cutting questions.

| Proposal | Verdict | The refinement the evidence forces |
|---|---|---|
| **1 — Persistent Project Owner** | **REFINE (partially overturns the panel)** | Neither an always-running *process* (SPOF + state-loss + idle cost) nor a passive *event-driven state object* (missed-event → silent wedge). The superior design is the **hybrid: a persistent durable STATE object reconciled by a periodic, level-triggered, stateless control loop** (the "PO-reconciler"). The panel was right it is "not a daemon"; the proposal is right it must *actively* supervise. Level-triggered reconciliation is *also* the direct cure for the incident's silent-wedge class. |
| **2 — AI-native Sprint Model** | **PARTIALLY ACCEPT** | Reject fixed 24–72h sprints as the *primary* boundary (thrash, integrator-windup, OODA "faster isn't better"). Keep the **event/evidence-boxed Evidence Cycle as primary** and add a **wall-clock reflection backstop (event-OR-clock, whichever first** — Kubernetes resync), sized by a Nyquist intuition, with three guardrails. Fold it into the *existing* event-fired L1 learning checkpoint — no new "sprint" construct. |
| **3 — Slack-first Operating Layer** | **ACCEPT and elevate (overturns the panel's deferral, with evidence)** | ChatOps is the fastest path to a complete, audited, human-in-the-loop control loop at near-zero build; the **`jarvis-slack-control-surface` seed already works**. Slack-first beats Browser-first (wrong layer) and direct-web (heavyweight pull surface). Make Slack the **FIRST operational surface after the foundation core**, under hard ChatOps conditions. |
| **Continuous orchestration** | **ACCEPT (as reconciliation, not a daemon)** | The PO *should* actively supervise — plan, launch workers, collect (verified) progress, interrupt stalls, re-prioritize, validate goal *movement* — but as **level-triggered reconciliation on a tick**, with the AI-native guardrails (verifier-owns-observation, event-sourced-not-replayed, de-dup keys, bounded restart, human-gated irreversibility). The PO validates *movement*; it never *judges feasibility* (that stays the GS→human path). |
| **Heartbeat / scheduler** | **ACCEPT the split; specify three independent loops** | The PO runs on a scheduled reconcile tick; the **Goal Supervisor stays an independent governance loop**; a **dead-man's-switch watches the GS on a different failure domain** (panel C3). GitHub Actions cron now (already proven), a durable-execution library over the existing Postgres bus later; dedicated worker deferred. |

**The through-line:** the proposals, correctly refined, do not *add* machinery so much as **name the active
control loop the OBW-GS/c core was missing.** OBW-GS/c specified the durable state (bus + ledger), the safety
watchdog (GS), and the pipeline — but left the *work-driving* loop implicit/passive. These three proposals,
re-derived, supply exactly that loop and its human surface, and they do so in the shape every mature
continuous-control system independently converged on.

---

## 1. The unifying prior-art backbone (why all three answers rhyme)

Every mature continuous-control system surveyed converges on one architecture, and it is the lens for all three
proposals:

1. **Durable STATE is the spine.** No essential progress lives in any process's RAM. (Kubernetes `spec`/`status`
   in etcd; Temporal event history; DBOS checkpoints in Postgres; Google-cron Paxos-replicated launch state.)
   *Delivery OS already has this: the Result Bus (append-only run/step) + the H9 goal-state.* [Proven on disk]
2. **Stateless, level-triggered COMPUTE reconciles desired-vs-observed each pass.** Correctness depends on
   *current state*, not on a perfect event sequence. A reconciler that holds no essential state is
   crash-equivalent to one that just started ("picks up where it left off" — Borg/Omega/Kubernetes).
3. **Events are a latency optimization, never the source of truth.** Edge-triggered logic loses any missed event
   *forever* (Hockin's hardware-interrupt argument); level-triggered re-derives reality and self-heals.
4. **Trigger on event OR periodic clock, whichever first** (Kubernetes resync; the canonical hybrid).
5. **A conversational surface is the human doorbell** — summon-with-evidence over an authenticated action layer,
   never the authority/execution layer itself (ChatOps/SRE).
6. **author≠verifier appears at every layer** — the *verifier* owns "observed state" (not the acting agent); the
   watchdog is independent of the loop it guards; chat approvals are identity-bound. The framework's existing
   invariant is the load-bearing safety primitive across all three proposals.

**The single sharpest AI-native caveat** (the human prior art does not pre-solve it): classical reconcilers
assume actions are cheap, idempotent, deterministic, reversible. **None hold for an agent fleet.** Every
"reconcile / restart / re-plan / re-ask" must be wrapped in: durable de-dup keys, bounded backoff + circuit
breaker, **event-sourced (never replayed) decisions**, anti-windup state reset, and human-gated irreversibility.

---

## 2. Proposal 1 — Persistent Project Owner (process vs state vs hybrid)

### 2.1 The hypothesis
*"The Project Owner should be a continuously running orchestration process rather than only a persistent state
object."*

### 2.2 The three candidate architectures, on the axes the proposal names
| Axis | (A) Always-running process (daemon) | (B) Persistent event-driven state object (the panel's passive form) | (C) Persistent durable STATE + periodic level-triggered stateless reconciler (HYBRID) |
|---|---|---|---|
| **Continuous execution** | yes, but blocks on its own liveness | only when an event arrives — **stalls silently on a missed event** | **yes — re-derives desired-vs-observed every tick; a missed event self-heals next pass** |
| **Fault tolerance / recovery** | **SPOF; state in RAM dies on crash** | state survives, but no self-healing pass | **state durable; reconciler is crash-equivalent to fresh start ("picks up where it left off")** |
| **Scalability** | one process = one bottleneck | scales with the bus | **stateless reconciler scales horizontally; durable state is the only shared spine** |
| **Observability** | introspect a live process (hard, ephemeral) | read state | **read durable state + an append-only reconcile log = full audit** |
| **Cost** | **idle cost — burns a held slot/tokens between bursts** | near-zero | **near-zero between ticks; cost only when reconciling** |
| **Autonomy** | high but fragile | reactive only — not autonomous when events stop | **autonomous: the tick keeps driving toward the goal without a human or an event** |
| **Maintainability** | a long-lived service to run/patch/monitor | simple but inert | **a stateless function + a schedule; the durable store is the memory** |
| **Incident-class fix** | — | **this IS the incident class** (inert `setTimeout`/`enqueue()` = missed edge → silent wedge) | **directly prevents it** (level-triggered self-heals a missed edge) |

### 2.3 Verdict — (C), the hybrid, decisively
**The superior design is a persistent durable STATE object (the goal contract + M1 ledger + per-worker status on
the Result Bus) reconciled by a periodic, level-triggered, stateless control loop — the "PO-reconciler."** This
is the convergent answer of *every* system surveyed (Kubernetes/Borg/Omega reconcile loops; Temporal/DBOS/SFN
durable-state-+-ephemeral-compute; Google distributed cron's replicated-state-+-stateless-leader; OTP's
supervised-workers-restart-to-known-state). Reject the alternatives on their *named* failure modes:
- **(A) daemon — three fatal modes:** SPOF (its crash halts the fleet), state-loss-on-crash (any plan/progress in
  RAM dies; nothing resumes it — the exact thing Temporal/DBOS/etcd exist to prevent), and idle cost. A daemon
  *can* be made safe only by externalizing all state to a durable store and restarting-from-state — at which
  point **it has become (C) with a convenience trigger thread.** So "persistent process" is either fragile or
  secretly the hybrid.
- **(B) pure event-driven — fatal mode: missed event → silent wedge.** This is precisely the Company-OS incident
  class: the inert `setTimeout` (frozen on serverless), the inert `enqueue()` ("nothing calls it yet"), the
  invoice-drain that fired only on manual page-open. An edge-triggered loop loses any event it doesn't see, with
  no second chance. **Level-triggered reconciliation is the direct architectural cure** — a stalled worker that
  never emits "done"/"stuck" is caught by the next reconcile pass, because the pass observes *reality*, not an
  event.

### 2.4 How this relates to the panel (refine, not contradict)
The panel (C8/§3.4) ruled the Project Owner is "a persistent **state object** + a thin surface, **not** a
long-running LLM." **That stands** — (C) is not a daemon. But the panel framed the state object as essentially
*passive* (read by the main loop and the GS). The proposal correctly pushes for *active* supervision, and the
prior art shows the right form is **a stateless reconciler loop driving the state object**, not a persistent
process. So: **the panel was right (not a daemon); the proposal is right (must actively reconcile); the synthesis
is (C)** — state object *plus* a level-triggered reconcile loop. This is a refinement that *partially overturns*
the panel's passive framing.

### 2.5 The AI-native guardrails (non-negotiable — the prior art's sharpest caveats)
The PO-reconciler is safe only with all of:
- **Verifier owns "observed state."** The reconciler's observed state must be the **verified** artifact state
  (author≠verifier), never the acting worker's self-report — else the loop confidently converges on a
  hallucinated state (the S37 silent-data-loss lesson; the "observation crispness" non-transfer).
- **Event-sourced, never replayed.** Each agent decision is a committed fact on the append-only bus; the
  reconciler re-derives the *next* action from current state — it never replays an agent's chain-of-thought
  (LLM steps are non-deterministic; this is the single biggest durable-execution non-transfer).
- **De-dup keys + human-gated irreversibility.** "Reconcile every pass" must never double-send an invoice or
  re-post a PR; world-touching actions carry intent-keyed idempotency keys (AN-7/AN-8), and irreversible
  Class-C actions stay human-gated (Google-cron's "skip beats double-launch; fail closed").
- **Bounded restart, not infinite `one_for_one`.** A stalled/looping worker is killed and re-derived from
  durable state — but with backoff + a circuit breaker + escalation to a boundary, because an agent restart
  burns tokens/wall-clock (unbounded restart = budget-DoS — the OTP "restart is free" assumption does not
  transfer).

### 2.6 Governance interaction (the load-bearing boundary)
The PO-reconciler **drives work**; the **Goal Supervisor independently judges goal-delta**. They must remain
*independent loops* (author≠verifier extended to orchestration): the loop that drives work may not also be the
loop that judges whether the goal is moving — else the driver grades its own progress and frame-lock returns.
Concretely:
- The PO-reconciler may **interrupt a stalled *worker*** (liveness: observed≠desired on the *work* plan,
  self-heals next pass).
- The PO-reconciler may **re-order/re-scope work *while the goal-delta is moving*** (panel C9).
- The PO-reconciler may **NOT** declare the *goal* unreachable or autonomously re-frame on a *flat* goal-delta —
  a flat goal-delta **revokes** its autonomous re-frame (panel C9) and routes to the **GS → human** path. The PO
  validates *movement* mechanically; it never *judges feasibility* (panel C1: feasibility judgment is the
  human's; the machine only fetches them early).

---

## 3. Proposal 2 — AI-native Sprint Model

### 3.1 The hypothesis
*"Replace or extend the Evidence Cycle with short AI-native evidence-driven sprints (e.g. 24–72h) containing
planning, execution, review, reflection and learning."*

### 3.2 Time-boxed vs event/evidence-boxed — what the prior art says
Six independent disciplines converge on a **hybrid: event/evidence-boxed PRIMARY + a slow wall-clock backstop,
whichever fires first** — structurally identical to Kubernetes "reconcile on event OR periodic resync."
- **Against a fixed time-box as the primary driver:** a 24–72h drumbeat firing regardless of evidence forces
  reflection on noise (Reflexion/Generative-Agents both *gate* reflection, never run it continuously); invites
  **integrator-windup thrash** (re-litigating settled decisions — PID anti-windup); over-samples fast work and
  under-serves long tasks; and OODA's sophisticated reading warns "faster cadence" is *not* the goal — *reliable
  re-orientation* is. A fixed clock optimizes the clock, not the state.
- **Against pure event-boxing (the current Evidence Cycle alone):** the most dangerous failures **emit no
  event** — a wedged agent loop, silent goal-drift, a thrash spiral (watchdog independence; Nyquist aliasing of
  the slow channel). An evidence-boxed cycle that never reaches its evidence condition runs forever, undetected.

### 3.3 Verdict — keep the Evidence Cycle as primary; add a wall-clock reflection backstop
**Keep the event/evidence-boxed Evidence Cycle as the primary unit** (it matches MPC executing on live state and
Reflexion reflecting at the genuine trial boundary). **Add a periodic structured *reflection checkpoint* as a
wall-clock backstop** that fires at the *earlier of* a routine boundary OR every N hours of continuous execution.
This forces the Orient/double-loop step the incident proved nothing forced — but on an *event-OR-clock* basis,
not a fixed sprint. **Reject the fixed-duration "sprint" framing** as a human-Scrum residue.

The "24–72h adaptive" instinct was groping toward the right thing — *adaptive* (event-primary) with a *bound*
(the backstop). The number is a **tuned backstop period**, not the driver: by the Nyquist intuition,
**backstop ≈ (worst-case-tolerable-undetected-drift) / 2, jittered ~10%** (to avoid fleet-wide synchronized
reflection storms). For goals where ~48h of undetected drift is the tolerance, a ~24h backstop is right — so the
founder's 24–72h range is a *reasonable backstop band*, just not the primary cadence.

### 3.4 The three mandatory guardrails (or the checkpoint becomes a thrash engine)
1. **No-op cheaply.** The checkpoint must usually conclude "still on goal, continue" at low cost (the resync that
   changes nothing) — or it taxes every cycle.
2. **Anti-windup.** It must **bound/reset accumulated plan authority** — re-plan but *discard the stale tail*
   (MPC commit-first-discard-rest); never let reflections compound authority and oscillate the fleet.
3. **Independence.** It must be **independent of the unit it guards** (a separate reflection lens / the GS), not
   the stuck agent reflecting on its own stuck context with its own stuck model (it will rationalize the wedge).

### 3.5 Minimal build (Waterline-respecting)
Do **not** create a new "sprint" construct. The framework already has **event-fired L0/L1/L2 learning
checkpoints** (the 175-overdue lesson made them event-fired) and a `progress-stall.mjs` (K=3) detector on disk.
The change is: **add a wall-clock backstop to the existing L1 reflection checkpoint** ("L1 fires at the earlier
of a routine boundary OR every N hours of continuous execution"), with the three guardrails. This is the
minimal, prior-art-backed, incident-faithful form — and it composes with the GS (the GS halts on
*effort-without-progress*; the reflection checkpoint re-orients *even while moving*, catching slow drift the
mechanical goal-delta check misses).

---

## 4. Proposal 3 — Slack-first Operating Layer

### 4.1 The hypothesis
*"Slack should be the first operational interface immediately after the foundation, so the Founder, Project
Owner, governance model and autonomous execution can be validated daily before Browser Control or other
capabilities are built."*

### 4.2 Slack-first vs Browser-first vs direct-web, on operational value
| Option | What it validates | Build cost | Verdict |
|---|---|---|---|
| **Slack-first** | the **whole operating model end-to-end** — agent observes → synthesizes evidence → **summons** founder → approve/deny → act → record — plus PO↔founder↔governance loops, boundaries, daily real operation | **near-zero** (Block Kit gives approvals without a frontend; **the `jarvis` seed already works**) | **ACCEPT — highest operational value, lowest build** |
| **Browser-first** (browser-automation capability) | a **worker/execution** capability, not a control plane — validates the *wrong layer*; brittle; high blast radius | high | **REJECT for sequencing.** Browser-automation is the right first surface *only when the system exposes no API* (Q3.7). Delivery OS **has** a goal API (the seed proves it) — so chat fronts the API; browser-driving a UI is unnecessary and fragile here. |
| **Direct web interface** (custom dashboard/app) | a **pull** surface for inspection — the founder must *go look* (violates summon-with-evidence); duplicates what Slack gives free (mobile, async, notifications, audit) | high (a whole UI) | **REJECT as the *first* surface.** A dashboard is the right *pull* surface for *exploration later*; chat is the right *first* surface for *action/approval*. (Pull for exploration, push/chat for decision.) |

### 4.3 Verdict — Slack-first, and it OVERTURNS the panel's deferral (with evidence)
**Make Slack the FIRST operational control surface after the foundation core**, before Browser Control or other
worker capabilities. The prior art is decisive: ChatOps is the **fastest path to a complete, audited,
human-in-the-loop control loop** at near-zero build; **summon-with-evidence is native for agents** (the agent
does its own triage then posts "here's what happened, here's what I propose, approve?"); the **transcript is the
audit log** (the cheapest answer to "what is my fleet doing?"); and HITL gating (OWASP LLM06) maps exactly onto
an Approve/Deny card.

This **overturns the panel's "defer Slack as build-on-pull" (C8/OM-10).** The panel was right *not to bundle
Slack into the core mechanism* — but the *sequencing* question ("what is the FIRST capability after the
foundation?") is a separate decision, and the answer is Slack, because **validating the operating model in real
daily operation is higher operational value than any worker capability**, it is how the **founder-validation
defect class (FV-1…5: founder finds defects late at live validation)** gets surfaced *early*, and — decisively —
**the build cost is already largely paid:** `jarvis-slack-control-surface` (v0.1.0) already routes `/goal` →
goal API → executed → verified → reported, over Socket Mode (no public URL), importing nothing from the
products, with a passing proof harness. The pull here is the founder's operational need + the validation value,
not a second repo — and that is a legitimate capability pull, not a framework-generalization Waterline question.

### 4.4 The hard ChatOps conditions (or Slack becomes a liability)
- **Thin front-end, never the authority.** Slack is a *transport* over the authenticated goal API (the seed
  already does this — HTTP only). No operating-model logic in Slack; decisions happen in the durable
  state/governance layer; Slack renders boundaries and accepts founder verdicts.
- **Identity-bound approvals.** Authorization is the *approver's identity*, not channel membership (channel
  membership is weak authz for Class-C verbs).
- **Prompt-injection defense.** The channel is now an *input to autonomous actors* — **never trust chat as an
  instruction source for privileged actions**; authority comes from the signed/authenticated control path with
  least-privilege tools. (A message — or fetched content — could try to hijack an agent's plan.)
- **Non-SaaS escalation fallback.** Slack is a SPOF (multi-hour global outages on record). For an autonomous
  fleet that summons humans through chat at authority boundaries, define a fallback (SMS/email) and an explicit
  **fail-closed-or-fail-safe policy per action class** — a chat outage must never silently unleash *or*
  permanently stall the fleet.
- **The cardinal rule: agents are ON the loop, not IN it.** Agents **batch to decision points and default to
  autonomous-with-audit**, summoning a human only at genuine authority boundaries — **never** chatty synchronous
  back-and-forth (that rebuilds the human-as-bottleneck the whole program exists to remove, and makes founder
  availability a hard dependency on agent throughput).

---

## 5. Continuous orchestration — the reconcile loop, specified

The mandate asks whether the PO should *continuously* supervise (plan, launch workers, request progress,
interrupt stalls, re-prioritize, create work packages, validate goal movement, restart) rather than react only
to events. **Yes — and that list IS a reconcile loop.** Each item maps to the level-triggered pattern:

| PO continuous action | Reconcile-loop equivalent | Guardrail |
|---|---|---|
| plan | compute desired-vs-(verified)-observed diff | observation owned by the verifier |
| launch workers | idempotent action to close the gap | de-dup keys; G9 main-loop spawns |
| request progress | observe verified artifact state | never trust worker self-report |
| **interrupt stalled execution** | a stall = observed≠desired; **self-heals next pass** (the level-triggered win) | bounded restart + circuit breaker |
| re-prioritize / create work packages | re-derive the plan from current state | anti-windup: discard the stale tail |
| **validate goal movement** | read the metric (re-probed externally) | **validate movement only — never judge feasibility (GS→human)** |
| restart execution | relaunch from durable state | backoff; escalate to a boundary, don't loop |

**The cadence:** level-triggered on a **tick** (event-OR-clock, whichever first — §3), *not* a daemon (§2). A
late tick is *safe* because the reconciler reads durable state (the Kubernetes resync property) — which is
exactly why GitHub Actions' best-effort cron is acceptable for it (§6). The reconciler runs until
`objective_complete` or a boundary FAP — "keep projects moving until the objective is achieved" becomes "reconcile
toward desired state until desired == observed or a human boundary is hit."

---

## 6. Heartbeat / scheduler architecture — three independent loops, one substrate

The mandate asks whether the PO runs on a scheduled orchestration loop while the GS stays an independent
governance mechanism. **Yes — and there are exactly three scheduled concerns, each independent of the layer it
watches** (author≠verifier / watchdog-independence applied to orchestration):

1. **The PO-reconciler tick** — *drives work* (level-triggered desired-vs-observed on the *work* plan).
2. **The Goal Supervisor** — *judges goal-delta* (effort-without-progress → halt → summon human). **Independent
   of the PO** (the driver cannot judge its own progress).
3. **The GS dead-man's-switch** (panel C3) — *watches the watchdog*, on a **different failure domain**.

These may share the scheduling **substrate** but must be independent **evaluations** (different state reads,
different logic). The dead-man's-switch must be on a *different platform* than the GS (panel C3 / the 76-commit
billing-outage precedent).

### 6.1 Platform comparison (for the scheduler)
| Platform | Fit for the reconciler / GS tick | Verdict |
|---|---|---|
| **GitHub Actions cron** | no 300s ceiling; **already proven** in the framework (`repo-governance.yml`, daily 06:00 UTC); best-effort cron is **fine** because the reconciler reads durable state (a late tick is safe — the resync property) | **USE NOW** for the PO-reconciler tick + the GS tick |
| **A different domain (Vercel cron / external uptime monitor)** | independent of GitHub's billing/minutes/concurrency failure domain | **USE NOW** for the GS **dead-man's-switch** (panel C3) — must not be GitHub |
| **Dedicated worker (`apps/worker` placeholder)** | true persistence / sub-minute ticks | **DEFER** — no workload pulls sub-minute supervision; the incident cadence was *hours*. Waterline: build on pull. |
| **Durable-execution service/library (Temporal / DBOS-over-Postgres)** | the eventual clean home for durable orchestration | **FUTURE — and DBOS-style is the natural fit:** durable execution *as a library over the existing Postgres Result Bus*, **no new daemon**. Adopt when the cron+bus reconciler's limits are actually hit, not before. |

**Net platform decision:** GitHub Actions cron for the PO-reconciler and the GS *now*; the dead-man's-switch on a
*different* domain *now*; the dedicated worker and a durable-execution library *deferred until pulled* — with
DBOS-over-the-existing-bus as the documented target (no daemon, no SPOF) if/when durable-execution needs outgrow
cron+Postgres.

---

## 7. Risks and trade-offs

- **Over-building the reconciler.** Risk: a full Kubernetes-style controller is heavier than the one proven
  failure pulls for. *Mitigation:* the reconciler is a **thin stateless function over the existing bus +
  goal-state** (the durable spine already exists), scheduled on the *already-proven* cron — not a new platform.
  Its first job is exactly the incident's gap (drive the goal, catch the silent wedge); scope it there.
- **Reconcile thrash / cost.** Every tick is metered (tokens). *Mitigation:* no-op-cheap reconciles (a tick that
  observes desired==observed does almost nothing); event-accelerated so the clock is a slow backstop, not the
  workhorse; anti-windup on re-planning.
- **Double-execution of irreversible actions.** The deepest non-transfer. *Mitigation:* de-dup keys +
  human-gated Class-C + fail-closed (skip beats double-launch).
- **Slack as SPOF / injection surface.** *Mitigation:* non-SaaS fallback + per-action fail-policy; chat never an
  instruction source for privileged actions; identity-bound approvals.
- **Loop independence erosion.** If the PO-reconciler and GS drift into one loop, frame-lock returns.
  *Mitigation:* they are separate scheduled evaluations with separate state reads; C9 (flat-delta revokes PO
  autonomy) is the hard interlock.
- **Reflection-checkpoint thrash.** *Mitigation:* the three guardrails (no-op-cheap, anti-windup, independence).

---

## 8. What the evidence REJECTS (so effort isn't spent there)
- **The Project Owner as an always-running process/daemon** — SPOF + state-loss + idle cost; a "safe daemon" is
  just the hybrid with a trigger thread. [Strong]
- **A pure event-driven Project Owner** — missed-event → silent wedge; *this is the incident class.* [Strong]
- **Fixed-duration sprints (24–72h) as the *primary* cadence** — thrash, windup, OODA "faster isn't better";
  the boundary is event-primary with a clock backstop. [Strong]
- **Browser-first or direct-web as the first operational surface** — wrong layer / heavyweight pull surface;
  Slack-first dominates on operational value per unit build. [Strong]
- **The PO judging feasibility** — feasibility judgment is the human's (panel C1); the PO validates *movement*
  only. [Strong]
- **A dedicated worker or a durable-execution service now** — no workload pulls it; Waterline-defer. [Strong]

---

## 9. Compatibility with the locked invariants (checked)
| Invariant | Compatible? | How |
|---|---|---|
| **author ≠ verifier** | ✅ extended | the *verifier* owns the reconciler's "observed state"; the GS is independent of the PO; the dead-man's-switch independent of the GS; chat approvals identity-bound |
| **governance independence** | ✅ strengthened | three independent loops: PO drives work · GS judges goal-delta · human breaks frames |
| **Goal Supervisor** | ✅ unchanged | the GS stays the independent governance watchdog; the PO-reconciler is a *separate* work-driving loop |
| **Result Bus** | ✅ central | the durable STATE spine the reconciler reads/writes — exactly the prior art's prescription |
| **Project Owner accountability** | ✅ sharpened | the durable goal-contract state object IS the accountability locus; the reconciler is its stateless compute |
| **local → QA → staging → prod** | ✅ unchanged | the reconciler launches workers that traverse the validation ladder; production never validates first |
| **GitHub Actions for long-running orchestration** | ✅ confirmed | proven via `repo-governance.yml`; the reconciler + GS tick run here; dead-man's-switch on a different domain |
| **Company OS inheritance** | ✅ | reconciler + scheduler are framework capabilities, version-pinned, scaffolder-inherited (templates/workflows already exist) |
| **PLOS incident lessons** | ✅ directly | level-triggered reconciliation *cures* the silent-wedge class (inert setTimeout/enqueue); the GS/human path preserves the feasibility lessons; write-ahead cost + fail-closed-as-health carried |
| **latest Discovery slices** | ✅ | the reconciler reads the M1 ledger (must ship `goal-progress.mjs` — currently designed-but-missing); the in-loop H9 gate is the interim form migrating to the out-of-loop GS |

---

## 10. Justified ADR modifications (for `ADR-OPERATING-MODEL-V2-2026-06-28.md`)

The evidence justifies these specific changes. They **refine** OBW-GS/c; they do not weaken any panel condition.

- **M1 — §3.4 / §19.1 (Project Owner form).** Upgrade the PO from "persistent state object + thin surface
  (passive)" to **"a persistent durable STATE object reconciled by a periodic, level-triggered, stateless
  control loop (the PO-reconciler)."** Add the AN-native guardrails (verifier-owns-observation, event-sourced-
  not-replayed, de-dup keys, bounded restart). *Keeps the panel's "not a daemon"; adds the active loop.*
- **M2 — new decision OM-PO-RECONCILE.** The PO-reconciler is level-triggered (event-OR-clock), runs on GitHub
  Actions cron, is **independent of the GS**, drives work (launch/collect-verified-progress/interrupt-stall/
  re-prioritize/validate-movement), and **never judges feasibility** (C1) and **loses autonomous re-frame on a
  flat goal-delta** (C9). Confidence: function Strong / embodiment Plausible-until-built.
- **M3 — §11 (Evidence Cycle).** Add a **wall-clock reflection backstop** to the event-boxed Evidence Cycle —
  fold into the existing event-fired **L1 checkpoint** as "the earlier of a routine boundary OR every N hours,"
  with the three guardrails (no-op-cheap, anti-windup, independence). **Reject fixed-duration sprints.** Size the
  backstop by the Nyquist intuition (≈ tolerable-undetected-drift / 2, jittered).
- **M4 — §6/§7 (scheduler/heartbeat).** Record the **three independent scheduled loops** (PO-reconciler · GS ·
  GS dead-man's-switch-on-a-different-domain) and the platform decision (GitHub Actions cron now; dedicated
  worker + DBOS-over-Postgres durable execution deferred-until-pulled, no daemon).
- **M5 — §12 / OM-10 (Slack).** **Promote Slack from "build-on-pull deferral" to "the FIRST operational surface
  after the foundation core,"** ahead of Browser Control and other worker capabilities, under the hard ChatOps
  conditions (§4.4), leveraging the `jarvis-slack-control-surface` seed. This **amends panel C8/OM-10 for Slack
  specifically**, with the operational-value evidence; the panel's "don't bundle Slack into the core mechanism"
  is preserved (Slack is sequenced *after* the core, not *inside* it).
- **M6 — §19.5 (build sequence).** Insert the PO-reconciler into the core (it is the active orchestration the
  foundation was missing, between the bus/ledger and the GS), and make **Slack the first capability after the
  core** (step 6) rather than indefinitely deferred. Updated order: (1) bus + M1 ledger *operating* (ship the
  missing `goal-progress.mjs`); (2) pre-flight gate; (3) **PO-reconciler** (level-triggered, on cron); (4) GS +
  dead-man's-switch; (5) pipeline hardening; (6) **Slack founder surface** (promote the jarvis seed); then
  build-on-pull: Evidence-Cycle reflection-backstop tuning, browser/worker capabilities, durable-execution
  library.

---

## 11. Adversarial pass — findings, concessions, and the REVISED recommendation (authoritative)

> **This section supersedes §0 and §10 where they conflict.** An independent adversarial lens (blind, instructed
> to refute) reviewed the investigation. Its verdict — **SOUND-WITH-CONDITIONS, conditions BLOCKING** — lands
> three BLOCKER-class objections that, on honest examination, **largely hold.** Faithful to §11 (surface
> disagreements, never smooth them) and to the framework's own discipline that an author does not get to
> conclude a consequential decision alone, the investigation's headline moves are **walked back.** What survives
> is real but smaller than §0/§10 claimed.

### 11.1 The decisive objection (conceded)
The OBW-GS/c panel's *headline correction* was to **demote active mid-flight orchestration**, rank a deterministic
**pre-flight gate as PRIMARY**, make the watchdog a **dumb arithmetic tripwire**, and **defer (C8) the 4-role
topology / Evidence-Cycle / Slack / auto-merge as build-on-pull.** This investigation, one document later,
re-inflated exactly that — a new active "PO-reconciler" core organ, Slack promoted ahead of the deferral, a new
reflection organ — **reversing BLOCKER-class panel conditions on a single author's say-so**, which is the very
move the panel's C6 forbade. **Concession: that is a §11 process error, and the additions are revised below.**

### 11.2 Finding-by-finding disposition
- **B1 — "the PO-reconciler is the liveness-tick + GS + main loop renamed." CONCEDED (mostly).** The ADR already
  has (a) a clock-driven liveness tick that advances work *and detects a hung process* (§7.2) and (b) the GS
  arithmetic watchdog on dGoal/dEffort (§5.2). The "missed-event silent-wedge cure" I credited to a new
  reconciler is already delivered by (tick + GS). The genuinely-new "driving" functions collapse: *launch
  workers* is conceded to the G9 main loop; *re-prioritize* is neutered by C9 (only while the delta moves);
  *validate movement* **duplicates the GS's C4 function inside the driver** — the exact author≠verifier-at-
  orchestration seam I claimed to protect. → **Do not mint a new "Project Owner" core organ.** The one genuinely
  useful refinement: **upgrade the existing liveness tick from "advance already-queued steps" to "level-triggered
  re-derive desired-vs-(verified)-observed from the goal,"** which catches the missed-*enqueue* wedge a
  queue-drainer misses (the inert `enqueue()` class). That folds into the **existing tick spec (ADR §7.2)** — it
  is not a new role. The active Project-Owner orchestrator **stays DEFERRED per C8.**
- **B2 — "Slack-first overturns a panel BLOCKER on sunk-cost; cockpit for an empty plane." CONCEDED.** "The seed
  exists" is not the framework's promotion bar (observed-failure OR second-consumer-pull); Slack *renders*
  artifacts (FAP / goal-delta ledger / GS output) that must exist and emit first. Overturning C8 needs a fresh
  panel, not an investigation paragraph. → **Slack stays DEFER (build-on-pull).** It is **recommended to the next
  panel as the leading candidate** for the founder control surface (the seed is ready *and* the audit
  independently found the missing V6 Pillar-3 single-screen surface it would fill) — but the sequencing is a
  panel decision, not a unilateral overturn. The merits comparison (Slack ≻ browser ≻ web-dashboard) stands as
  *input* to that panel.
- **B3 — "the reflection backstop is redundant with C4 and the L1 fold is a label-smuggle." CONCEDED.** C4 (the
  GS re-probes the metric externally under its own identity + a metric-fitness check) already catches
  drift-while-moving-the-wrong-proxy; the incident was a *flat* delta (the GS catches it). Attaching wall-clock
  progress-governance to the L1 *learning* checkpoint misuses a lessons organ. → **Cut the reflection-backstop
  organ.** Keep only the narrow, surviving point: **reject fixed 24–72h sprints as the primary cadence** (the
  Evidence Cycle stays event-boxed; it is deferred regardless). If "reflect-while-genuinely-moving" is ever
  pulled by a recorded failure, it earns its own organ and its own panel.
- **S4 — "the K8s/Temporal analogy breaks where it is load-bearing." CONCEDED.** An LLM reconcile is not
  free/convergent/reversible per tick: the cheap version *is* the GS arithmetic tripwire; the intelligent
  per-tick version *is* the daemon the panel rejected; non-determinism breaks "crash-equivalent to fresh start"
  (identical state can yield a different action each pass → oscillation, not convergence); irreversibility shrinks
  the autonomous loop to the reversible subset (the rest is "compute gap → summon human" = the GS again). →
  **Demote the analogy** from "the prior art *forces* a reconciler" to "the prior art *endorses* durable-state +
  clock-driven re-read, which the existing tick + GS already embody."
- **S5 — "Waterline: more inert machinery on an unratified, deliberately-narrowed design." CONCEDED.** OBW-GS/c
  is not yet ratified at its scoped core; re-opening to re-inflate it is undisciplined. → Hold every addition to
  the framework's promotion bar.

### 11.3 What survives (carried as refinements to the EXISTING organs — no new core organs)
1. **Level-triggered upgrade to the existing liveness tick** (re-derive desired-vs-verified-observed from the
   goal, catching the missed-enqueue wedge) — folds into ADR §7.2. [Strong]
2. **The AI-native guardrails on any scheduled organ:** de-dup keys, **event-sourced-never-replayed**, bounded
   restart + circuit breaker (the OTP "restart is free" non-transfer), human-gated irreversibility. [Strong]
3. **Verifier-owns-observed-state at orchestration** (the tick/GS observe *verified* artifact state, never worker
   self-report) — a property of the GS, not a new organ. [Strong]
4. **The cron-safety articulation** (a late best-effort GH-Actions tick is safe because it re-reads durable state
   — the resync property) — justifies running the existing GS/tick on GH Actions cron. [Strong]
5. **The dead-man's-switch on a different failure domain (M4)** — recorded-failure-pulled (C3, the 76-commit
   billing stall); the one cleanly-surviving *new* mechanism. [Strong]
6. **Reject fixed sprints; reject browser-first/web-first on the merits** (input to the deferred decisions). [Strong]

### 11.4 The REVISED ADR-modification set (replaces §10)
- **M1/M2 (PO-reconciler as a new core organ) — WITHDRAWN.** Replaced by **M1′: fold the level-triggered
  upgrade + guardrails (§11.3 #1–#4) into the EXISTING liveness-tick and GS specs (ADR §5/§7).** The active
  Project-Owner orchestrator role **stays DEFERRED (C8).**
- **M3 (reflection backstop) — WITHDRAWN.** Replaced by **M3′: a one-line note that C4's external re-probe IS
  the drift catch; reject fixed-duration sprints.** No new wall-clock organ; nothing bolted onto L1.
- **M4 (dead-man's-switch) — KEPT** (already a panel condition C3; this investigation confirms it).
- **M5/M6 (Slack-first overturn + step-6 build) — WITHDRAWN as an overturn.** Replaced by **M5′: Slack stays
  DEFER (C8); recommend it to the next §11 panel as the leading founder-surface candidate** (seed ready +
  Pillar-3 gap), with the merits comparison as input.
- **Net effect on the ADR: essentially unchanged.** The surviving content (§11.3) are *refinements to fold in at
  the design-detail phase of the already-recommended organs*, not new decisions. **OBW-GS/c stands as the panel
  left it;** this investigation adds guardrail/cron-safety detail and confirms the dead-man's-switch — and,
  importantly, **records that three intuitive additions were tested and did not clear the bar.**

### 11.5 Honest conclusion
The three proposals were treated as hypotheses and **aggressively challenged — including against this
investigation's own first draft.** The disciplined result: **Persistent Project Owner (as a process) — REJECTED;
as a new active core organ — WITHDRAWN; as a level-triggered upgrade to the existing tick — ACCEPTED.
AI-native Sprint Model — the fixed time-box REJECTED, the reflection organ WITHDRAWN (redundant with C4), the
Evidence Cycle unchanged. Slack-first — DEFERRED to a fresh panel, not unilaterally overturned, recommended as
the leading founder-surface candidate.** Continuous orchestration is endorsed only as the *level-triggered
re-read* the existing tick should do, not as an intelligent per-tick driver. The scheduler/heartbeat split
(tick · GS · dead-man's-switch) holds. This is the framework's author≠verifier discipline working on its own
design: an intuitive set of additions, stress-tested, mostly folded back into what already exists — which is the
correct, evidence-only outcome.
