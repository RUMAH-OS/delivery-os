# Business Trigger Architecture — auto-starting workflows toward a self-operating system (2026-06-24)

> Goal: how should business events automatically start workflows; how do triggers interact with Delivery OS,
> verification, approvals, and execution; the highest-value trigger types, the required architecture, the
> implementation plan, and the **smallest path to a self-operating system** (founder = approvals/access/strategic only).
> Method: 4 parallel specialized agents (taxonomy · architecture · engine-lifecycle · smallest-path/safety), evidence-cited.

## The core insight (what makes this safe and small)
**The autonomous engine dunning workflow is PREPARE-ONLY — it has no send step and no human-gate step.** It runs
resolve → check → prepare → verify(T1) and terminates at `reminder_prepared` with `sent:false` as a hard invariant
(`mailbox-intelligence.ts:135-157,308`). The actual send lives only in the founder Room `/execute` path
(`executeBusinessAction`), behind `requireHuman` (`approvals-route.ts:47`). **A cron tick structurally cannot send or
approve** (`cron/tick/route.ts:10-13`).

So the trigger is **money-safe by construction**: it can *start* and *prepare* a workflow, but it **physically cannot
send.** The founder approval stays the one human step — not by policy, but by the engine's design. This makes the MVP an
inherent **shadow/dry-run**, which is exactly the safe first rollout.

## Two architectural paths (the key decision)
| | **Path B — Hybrid (RECOMMENDED, smallest)** | **Path A — Engine-native (fuller, deferred)** |
|---|---|---|
| Trigger | sweep enqueues a prepare-only run | same |
| Engine | prepares the draft, completes | prepares → **blocks on an always-on human gate** → send step |
| Approval | founder approves via the **existing Room `/execute`** send path | founder approves via `POST /approvals` |
| Send | the existing wired send (`executeBusinessAction`) | a **new `irreversible` send step** in the definition |
| New engine work | **none** | **new always-block gate primitive** (the cap-trip `gateSeq` only fires on verify *failure*; a clean pass *skips* it — wrong primitive) + the C6 block sets no `awaiting_event_id`/`human-response`, so `POST /approvals` can't resolve a plain irreversible step (`engine.ts:249-255,499-508`) |
| Verdict | **the run starts autonomously; only the send is the founder's gesture** — proves "self-operating up to approval" today | fully engine-orchestrated; needs delivery-os engine changes |

**Recommendation: build Path B now** (no new engine primitive; reuses the proven Room send). Path A (an always-on
human-gate step type that routes through `blockHumanGate` + a post-gate send step) is the fuller end-state — a later
delivery-os slice once the trigger is proven.

## How triggers fire — three modalities (use the source that owns the transition)
| Trigger | Real-world transition | Modality | Why |
|---|---|---|---|
| **Overdue → dunning** | a standing condition (no event) | **POLL** `/v1/ops/overdue-invoices` | overdue/expiring events are **sweep-gated (no cron in Admin)** → the ops projection is the only always-true source |
| **Invoice send requested** | a discrete Admin event | **EVENT** (extend the drain to enqueue) | already drained; enqueue off the event — D2-safe (prepare-only ends at the gate) |
| **Inbound dunning email** | a discrete inbound | **MAILBOX** poll→classify→enqueue | the pack was purpose-built for `input.email` (`mailbox-intelligence.ts:160-184`) |

Today only `invoice.send_requested` is dispatched into a workflow; every other event/mailbox route is read into context
but never enqueued. **The missing component = a dispatcher** that turns a projection-sweep / new inbox row / routed
triage row into an idempotent `enqueue(...)` of the matching `prepare*` capability, ending in a founder-gated draft.

## Highest-value triggers (ranked = the money lifecycle: bill → collect → renew)
1. **Overdue → dunning sweep** (POLL) — **the MVP.** Highest value × readiness; direct cash collection; founder's documented pain (invoice 2026-0060 chased 6× incl. post-payment). Every piece exists except the trigger.
2. **Pending-invoice-generation → monthly prep** (POLL; Admin-internal — could be Admin's own pg_cron). "No invoice, no cash."
3. **Expiring → renewal proposal** (POLL; deterministic idempotency already exists). Revenue retention.
*(Then: mailbox-dunning, signature chase, payment-received receipt, new-lead — lower value/readiness.)*

## Enqueue mechanics + the cadence/idempotency design (the safety core)
- `enqueue(definitionKey, input, idempotencyKey)` is **idempotent on `(definitionKey, idempotencyKey)`** — a re-fired sweep returns the existing run (`created:false`), never a duplicate (`engine.ts:94-122`). The allow-list is derived from registered packs.
- **The cadence lives entirely in the key:** `dunning-sweep:v1:{tenantId}:{week-bucket}` → "chase at most once per N days per debtor" for free. (Event: `invoice-send:{adminEventId}` = exactly-once; mailbox: `dunning-mail:{messageId}`.)
- **Three independent defense layers — the trigger must NOT re-implement them:**
  1. **enqueue key** — how often a run is *created* (cadence).
  2. **send-audit claim** (`claimOverdueFollowupSend`, keyed on invoiceId) — whether the terminal send *fires* (one winner).
  3. **stop-on-paid** — paid invoices are never drafted (re-read `getPaymentStatus` at check seq1 AND prepare seq2).
- **G1 per-run input** carries the trigger payload opaquely (`StepContext.input`); the engine never reads inside it.

## The MVP trigger spec (overdue dunning sweep)
A new **`apps/web/app/api/cron/dunning-sweep/route.ts`** (sibling of the tick route, same CRON_SECRET fail-closed pattern):
1. **Kill-switch:** `DUNNING_SWEEP_ENABLED` unset/false → inert.
2. **Read:** `getOverdueInvoices()` (PII-free refs); typed-error → enqueue nothing, honest return.
3. **Group by `tenantId`** (the draft is multi-invoice-aware — one run per debtor).
4. **MAX_TOUCHES** (default 3) — skip a debtor at the cap.
5. **Enqueue:** `enqueue("mailbox.dunning-stop-on-paid", { invoiceIds, tenantId }, "dunning-sweep:v1:{tenant}:{week}")`.
6. **Stops at enqueue.** The heartbeat advances the run to `reminder_prepared`; the draft surfaces; the founder approves+sends via the existing path. **No send, no approval in the trigger.**

**Smallest proof of life:** the daily sweep enqueues one run with **no human trigger**, the heartbeat prepares it, and the draft appears in the founder's queue. That proves "a business event auto-started a workflow that reached the founder's approval queue."

## Safety rails (rail → enforcing mechanism)
| Rail | Mechanism | Status |
|---|---|---|
| Trigger can never auto-send | prepare-only definition; verifier asserts `sent===false`; send is a separate `requireHuman` path | **EXISTS (by construction)** |
| Stop-on-paid before prepare | `getPaymentStatus` re-read at seq1 + seq2 | EXISTS |
| Stop-on-paid before send | `executeBusinessAction` must re-read `getPaymentStatus` immediately pre-send | **CONFIRM/ADD** |
| Cadence ≤ once/N days | idempotent enqueue on the cadence key | Slice B |
| MAX_TOUCHES (3) | sweep reads prior touch count, skips at cap | Slice C |
| No-contact debtor | `gated` with honest "link a contact"; never fabricated | EXISTS |
| Global kill-switch | `DUNNING_SWEEP_ENABLED` | Slice B |
| Shadow/dry-run first | inherent (no send path) | EXISTS |
| Dispute/credit suspension | exclude flagged invoices from the sweep | **ADD (small)** |
| Gated-but-owed can't hide behind GREEN | AD-4 verifier split | Slice D |

## Failure modes → mitigations (all cited to on-disk guards)
sweep double-fires → idempotent enqueue · Admin unreachable → typed error, enqueue nothing + transient fail-closed prepare · pool exhaustion → #181 + bounded sweep work · no-contact → honest `gated` · stale overdue read → double re-read at check+prepare + at-send re-read · empty-email no-op → **Slice A threads `input.invoiceIds`** + Slice D · approval-after-payment → at-send re-read + send claim.

## The inverse-transition caveat (must be in the build's seam gate)
The forward lifecycle is well-guarded, but the **inverse transitions** are not yet wired and will detonate cross-system:
(i) an invoice **paid mid-window** must *retract* a prepared-but-unsent dunning draft sitting in the founder's queue
(stop-on-paid handles the draft content, but a stale "approve this chase" item shouldn't linger); (ii) a **rescinded
`send_requested`** needs a cancel. Per-event shape validation passes on each and still leaves a reversible action
irreversible end-to-end. **First thing the build's seam-gate must cover.**

## Rollout
1. **Phase 0 — Shadow (the MVP, money-safe by construction):** sweep enqueues → prepares → founder approves *every* send by hand. Measure swept-vs-prepared-vs-approved.
2. **Phase 1 — Measured:** with AD-4 (honest GREEN) + MAX_TOUCHES, widen from a pilot debtor set to all overdue. Money 100% behind the gate.
3. **Phase 2 (later) — Trusted auto-ack, non-money only** (e.g. "received your reply"). **Money chases stay behind the human gate permanently.**

## Implementation plan (engineer → QA → reviewer; builder never grades own)
Prereqs (founder-gated): **#181 merge** + **heartbeat G2** (Vercel Cron / `pg_cron`) — without self-advance, enqueued runs sit idle.

| Slice | What | Effort | Depends on |
|---|---|---|---|
| **A — per-run refs seam** | `refsForRun(ctx, deps)` in the pack: prefer `ctx.input.invoiceIds/tenantId`, else email resolution (frozen logic untouched). Fixes the empty-email no-op (F1). | ~0.5d | none — **build now** |
| **B — the sweep trigger (KEYSTONE)** | new `cron/dunning-sweep/route.ts`: kill-switch → `getOverdueInvoices` → group → MAX_TOUCHES → idempotent enqueue. **The only thing that makes the loop START.** | ~1d | A · #181 · heartbeat |
| **D — AD-4 verifier policy** | split `gated-honestly` (pass) vs `gated-but-owed` (fail/escalate) so GREEN means a real outcome. | ~0.5d | parallel |
| **C — MAX_TOUCHES** | per-debtor touch count; skip at cap. | ~0.5–1d | B |
| **E — shadow surfacing** | wire prepared/awaiting set into the founder queue. | ~0.5d | **G4/G5 merge (PR #1)** |
| **contacts feed** | `customer_contacts` auto-sync from Admin → runs reach `reminder_prepared` not `gated-no-contact`. | small + **DPIA** | parallel (founder-gated) |
| **F — period-bucketed send key (deferred)** | multi-touch *send* cadence (today capped at one chase/invoice — a Phase-0 safety feature). | ~1d | post Phase-1 |

**Critical path to the proof:** #181 + heartbeat *(founder)* → **A → B** → first autonomous prepared run in the queue.
Add **D** + contacts feed to turn gated terminals into real prepared reminders; then **C** + **E** before widening.

## The smallest path to a self-operating system (synthesis)
1. *(founder)* merge **#181** + schedule **heartbeat (G2)**.
2. *(me)* **Slice A** (per-run refs) + **Slice B** (the overdue dunning sweep) → **a business event auto-starts a workflow with no human trigger and lands a prepared reminder in the founder's queue.** ← the operational-self-start proof.
3. *(me)* **Slice D** (AD-4) + *(founder)* contacts feed/DPIA → prepared reminders for real debtors.
4. *(founder)* approves + sends via the existing Room path (the one human gate).
5. *(me)* **C + E**, then expand to triggers #2 (monthly prep) and #3 (renewal) — same dispatcher pattern.

After this, the business **runs itself up to the approval gate**: events start workflows, the engine prepares + verifies,
and the founder's only operational act is **approve-and-send** — exactly the self-operating target, with money permanently
human-gated by construction.

## Honest limits
- The MVP is shadow-by-construction; "fully engine-native send-after-approval" (Path A) needs a new delivery-os gate primitive — deferred.
- Slices A/B/D are buildable now; B's *autonomous* proof needs the founder prereqs (#181 + heartbeat). The contacts feed (for non-gated runs) is DPIA-gated.
- Inverse transitions (paid-mid-window retract; rescinded request) are unbuilt — the seam gate must cover them before Phase 1.
- The at-send stop-on-paid re-read in `executeBusinessAction` is the one rail to *confirm* (flagged, not assumed).
