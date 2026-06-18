# Delivery OS — Phase 2 Execution-Layer Readiness Review (2026-06-18)

> Evidence-based inventory (read-only, real tools run). Goal: how close is Delivery OS to a V2
> execution layer, and the SHORTEST path — not a V2 design, not "v6 complete". Optimised for reuse.
> Sources: 4 parallel read-only investigations (workflows/lifecycle/state/recovery · events/comms/
> inheritance + `os:check` · orchestration/observability + `operating-model-check` · cross-project
> consumption forensic audit). DRAFT — founder reviews; not self-certified.

## HEADLINE VERDICT
**Delivery OS has a COMPLETE governance + routing layer and NO execution ENGINE.** Everything that
exists is a **checker / gate / router / record** — fail-closed, synchronous, human-invoked. There is
**no durable workflow state machine, no async runner, no automatic retry/resume, no escalation**.
Cross-project sharing is **mirrored, not inherited** (each consumer hand-copies the contract); the
only real inheritance is `delivery-os → Admin` (N=1). So: the *discipline* is real and reusable; the
*autonomous execution substrate* is not built — and crucially **may not be the right next build.**

---

## 1. Delivery OS V2 capability map (layered)

| Layer | State | What exists |
|---|---|---|
| **Governance / enforcement** | ✅ COMPLETE | 9 gates (seam, lifecycle, workflow, experience, verify, deploy-debt, milestone-retro, ownership, skill/agent-frontmatter), all fail-closed, CI-wired |
| **Routing / orchestration-planning** | ✅ EXISTS (plans, doesn't spawn) | `dispatch-route` composes agent-route + ownership-policy + skill-route + knowledge-route; 93% conformance; 18-agent roster; auto-injection of skills/KUs |
| **Event / seam** | 🟡 PARTIAL | App-local transactional outbox (16 event types, durable log, replay-by-cursor) + ONE point-to-point PULL drain (`/v1/events`). No broker/routing/retention/DLQ/ack |
| **Execution state machine** | 🔴 MISSING | Only `created→closed` (slice) + `pending→verified` (verify) persist. None of queued/planned/executing/blocked/failed/recovered exist |
| **Recovery** | 🔴 MANUAL | No auto-retry/resume/escalation; recovery = human reads stderr, fixes, re-runs (or `--force` with logged cause). Gates are *preventive*, not *operational* recovery |
| **Observability** | 🟡 PARTIAL | Comprehensive backend telemetry (215 selection records, 66.8k transcript lines) + an 8-question founder screen (`execution-ledger.html`) — but POST-HOC only (closed slices); no in-flight/live view |
| **Inheritance / distribution** | 🟡 ONE-WAY | `os-inherit` real + GREEN, but only delivery-os→Admin (10 vendored files, byte-current). PLOS/Rumah have NO `INHERITED.json`; contracts are mirrored in consumers |

---

## 2. Existing execution-layer inventory (what's actually there)

- **Workflows (as patterns, all CHECKERS not RUNNERS):** slice-delivery lifecycle (`slice-close.mjs`), verify-gate workflow, §11 decision workflow, lifecycle-completeness (`lifecycle-gate`), cross-repo workflow-completeness (`workflow-gate`, returns `fullyProven:false` for unmet peer obligations), seam contract (`seam-gate`), learning-review/retro gate, deploy-debt gate.
- **Events:** `outbox` table (transactional, µs-ordered, `consumed_at` reserved-never-set) → 16 emitted types (contract.*/invoice.*/payment.received/contract.signed/…) → `GET /v1/events` (opaque cursor, at-least-once, `events:read`). Executable seam contract `admin-plos-seam-v1.mjs` (strict envelope + per-type registry + PII deny-list). **No retention/archival/DLQ/broker.**
- **Orchestration:** `dispatch-route` (plan → Claude spawns → conformance audit), dispatch-log (53), ownership-policy (work-type→required-owner), author≠verifier + §11 panel handoffs.
- **State:** slice frontmatter (`status:closed` only value across 276 records), verify frontmatter, dispatch-log (append-only), git refs (deploy-debt). No persisted execution queue/DAG.
- **Recovery:** `--force` override (logged), tamper-detection (digest re-run), fail-closed gates. Zero auto-recovery.
- **Observability:** dispatch/skill/knowledge/agent selection logs (L1–L5 evidence ladder), `execution-ledger.html` (8 questions, 32 of 46 objectives COMPLETE — honest), `operating-model-check`, one health check (`mail-config-health`).
- **Cross-project comms (live):** PLOS←`/v1/events` + `/v1/ops` (wired consumer `admin-events-consumer.ts` + drain route); Rumah←`/v1/inventory/properties` (`lib/inventory.ts`). `/v1/inventory/units` built, consumer NOT wired.

## 3. Gap analysis (genuinely missing)

| Gap | Severity | Note |
|---|---|---|
| Durable workflow state machine (7 states) | HIGH (if unattended exec is the goal) | today only 2 binary states persist |
| Async runner / scheduler / resume-after-interruption | HIGH (cond.) | `slice:close` is synchronous spawnSync; restart re-runs from start |
| Automatic retry / escalation / recovery workflows | HIGH (cond.) | all recovery is human-driven |
| Cross-project inheritance distribution (seam cap #11) | **HIGH (THE real blocker)** | consumers mirror the contract; no build-once-consume-everywhere |
| Event lifecycle: retention/archival/DLQ/ack (+ broker/routing IF needed) | MEDIUM | outbox grows unbounded; point-to-point only |
| In-flight founder observability (live ops, not post-hoc) | MEDIUM | screen shows only closed work |
| 2 idle specialists + 2 RED ownership areas (docs/knowledge) | MEDIUM | operating-model below |

## 4. Reuse analysis (DON'T rebuild — this is most of it)

**Reuse as-is:** the 9 gates · `dispatch-route` + 4 routers · the **transactional outbox + cursor drain** (a genuinely solid event substrate — durable, ordered, replayable) · the **executable seam contract** (envelope + registry + PII deny-list) · **os-inherit** (proven byte-current) · **execution-ledger** 8-Q screen · the telemetry/evidence ladder · `operating-model-check`. **The governance + routing + event-substrate + inheritance-mechanism all exist and are reusable.** The Capability Promotion & Discovery design (just ratified-with-conditions) is the missing distribution layer on top of these.

## 5. New-build analysis (the short list)

Only THREE things are genuinely new — and they are ordered by leverage, not size:
1. **Inheritance distribution (seam cap #11):** make Admin's contract a vendored, sha-pinned artifact a 2nd project *inherits* instead of mirrors. This is the N=1 gate and the highest-leverage build. SMALL-MEDIUM (os-inherit already exists; extend it to app→app contract vendoring).
2. **Event lifecycle:** retention/archival + ack/`consumed_at` + (only if a 2nd consumer appears) routing. SMALL-MEDIUM.
3. **Durable execution engine (state machine + async runner + recovery):** LARGE — but **conditionally needed**. Today the founder is the orchestrator and it works. Build this only if/when the goal is genuinely *unattended* multi-step execution. Do NOT build it speculatively.

## 6. Validation plan (prove, don't assume)

- **N=1 master gate:** a SECOND project must inherit a Delivery OS capability (an `INHERITED.json` + `os:check` PASS) AND run a gate green. Until then "shared platform" is unproven. *Blocked while PLOS is frozen + Rumah is off-limits — this is the true constraint, not a missing build.*
- **Seam end-to-end:** one live round-trip — Admin emits → PLOS drains → PLOS acts → callback — with `workflow-gate` reporting `fullyProven:true` (today it reports `false` for unmet peer obligations).
- **Inheritance-not-mirror:** a consumer importing the *vendored* contract (sha-pinned) instead of a hand-copied shape; prove drift-gate catches a contract change.
- **Execution engine (only if built):** kill a workflow mid-run; prove resume-from-checkpoint + auto-retry.

## 7. Estimated implementation effort (rough)

- Inheritance distribution (#1): **S–M** (~1–2 slices; extends os-inherit). 
- Event lifecycle (#2): **S–M** (~1–2 slices).
- Capability Promotion & Discovery mechanism (already designed v2): **M** (catalog + reference-gen + 4 report-only gates on Admin's ~26 manifests).
- In-flight observability: **M**.
- Durable execution engine (#3): **L** (multi-slice; a distinct project) — defer until needed.

## 8. Major risks

- **Over-building:** constructing a distributed async execution engine that isn't needed — the founder-as-orchestrator model works today. Biggest risk is solving an unproven problem.
- **N=1 stays unmet structurally:** "prove cross-project" is impossible while the only 2 other projects are frozen/off-limits. *Proving the platform requires unfreezing a 2nd consumer to actually inherit+run.* This is a decision, not a build.
- **Mirrored-contract drift:** PLOS/Rumah hand-copy the envelope/PropertyV1 — a contract change silently desyncs until a live failure. Distribution (#1) is the fix.
- **RED ownership areas** (Documentation 83% Claude, Knowledge 75% Claude) + 2 idle specialists (database-data, api-integration at 0%): the operating model isn't fully agent-owned yet.
- **Founder visibility is post-hoc:** no live view of in-flight work.

## 9. Recommended execution order (shortest path to an operational execution layer)

1. **Close the inheritance/distribution gap (seam cap #11)** — the N=1-unblocking build; makes "build once, consume everywhere" real for the FIRST time. Highest leverage, small.
2. **Build Capability Promotion & Discovery (v2, report-only)** on Admin's ~26 manifests — the discovery half of distribution; already designed + conditions applied.
3. **Prove ONE seam end-to-end cross-project** (live consumer round-trip; `workflow-gate fullyProven:true`) — the real v6 proof. *Requires a founder decision to unfreeze a 2nd consumer.*
4. **Event lifecycle** (retention/ack) — cheap hardening once a 2nd consumer exists.
5. **In-flight founder observability** — extend execution-ledger from post-hoc to live.
6. **Durable execution engine** — ONLY if/when unattended multi-step execution is a real requirement. Defer; revisit after 1–5.

**Bottom line:** Delivery OS is ~1–2 well-chosen slices (inheritance distribution + a live cross-project seam round-trip) away from being a *genuinely shared* platform — NOT a big-engine rebuild away. The execution *engine* is the largest gap but the *lowest-priority* one; the *distribution + cross-project proof* is small and is the actual unlock. The single decision only the founder can make: **unfreeze a second consumer so the platform can be proven, not assumed.**
