# Founder-Action Elimination Plan — leave only approvals, access grants & strategic decisions (2026-06-24)

> Goal: review every remaining founder action; for each decide automate / delegate-to-agent / run-as-workflow /
> remove — leaving the founder only **approvals, access grants, and strategic decisions.**
> Method: 4 parallel specialized agents (operational · infra/config · release-governance · decisions+engine), each
> evidence-cited. This is the consolidation.

## The architectural finding (why "leave only approvals" is reachable)
**PLOS already has the architecture for it.** The workflow engine advances steps autonomously via the cron heartbeat,
but a tick **structurally cannot open a human gate** — `POST /approvals` requires `humanPrincipal.requireHuman` (a real
session JWT; a service/agent token is rejected by construction), and *"a cron caller can drive execution but can never
approve/send on a human's behalf"* (`cron/tick/route.ts:11-13`). **Money/comms-out is isolated behind that gate by
design (D2/V12).** So the engine can do everything up to the gate; only a verified human opens it. The gap is not
capability — it's that the autonomy isn't switched on (no heartbeat schedule, and **nothing enqueues runs**).

---

## THE MINIMAL FOUNDER SURFACE THAT SURVIVES (everything else is eliminated)

### 1. APPROVALS (the one operational gate that stays)
- **Approve-and-send** each outbound money/comms action (invoice send · dunning chase · renewal proposal · customer reply). Irreversible, external, under the founder's name (`approvals-route.ts:40-119`, V12/D2). **This is THE genuine gate.** (Collapse "approve draft" + "confirm send" into one gesture; optionally batch a vetted queue.)
- **Money-judgement calls** that are escalated *to* the founder: disputes, credits, write-offs, debt-collection escalation. Engine detects + routes; never settles.
- **Money-touching classification confirm** — the deterministic-only safety boundary (a human confirms anything that would trigger a money action from ambiguous evidence).

### 2. ACCESS GRANTS (credentials/consents — the act of granting *is* the value)
- **Gmail OAuth consent** (connect the sending mailbox) — the irreducible grant.
- **Secret values:** `DATABASE_URL` password · Anthropic key · provider keys (founder supplies/rotates; scripts inject).
- **Prod-DB access grant** (a scoped connection string handed deliberately).
- **DPIA sign-off** (legal basis for the `customer_contacts` bulk backfill).
- **Admin's token-signing authority** (owns the Admin side that mints `ops:read`/`events:read`/`deliveries:write`).
- **The one-time auto-merge opt-in** (per repo — a §11/§13 policy decision, below).

### 3. STRATEGIC DECISIONS (one-time, irreducible)
- **AD-1-class architecture/ownership rulings** (e.g. contact ownership — ruled **B** via §11 panel; record as ECR-0008). Rule-4 ownership changes.
- **Flip Discovery ON** (a one-time GDPR/cost decision; ships OFF).
- **Consequential merges** (the carve-out: enforcement plane, security/money/PII, schema/destructive migrations, prod cutovers, cross-repo contracts, version cuts).

**That's the whole standing surface: approve-and-send · 5–6 access grants · a handful of one-time strategic calls. Nothing else should reach the founder.**

---

## EVERY ACTION CLASSIFIED

### Operational (daily loop) — almost all eliminable
| Action | Disposition | How / evidence |
|---|---|---|
| Open Room / review cockpit | **REMOVE ritual → exception digest** | passive read (`business-band.ts:10-13`); engine pushes a threshold/daily digest; open Room by exception |
| Prepare / draft reminder | **AUTOMATE (workflow)** | dunning pack mounted (`engine/runtime.ts:52`); auto-prepare on trigger |
| Approve draft | **COLLAPSE into the send approval** | — |
| **Confirm SEND (money-out)** | **KEEP — the genuine gate** | `business-actions.ts:414`, `approvals-route.ts` (requireHuman) |
| Link a contact (gated send) | **AUTOMATE feed; human confirms net-new only** | auto-sync `customer_contacts` from Admin (`customer-contacts-backfill.ts`) |
| Classify escalated mail | **AUTOMATE non-money tail; keep money confirm** | LLM-advisory + learning loop shrinks the queue (`mailbox-classify.ts`) |
| Sync mailbox ("Check replies") | **REMOVE (ceremonial) → schedule it** | read-only/idempotent (`sync-replies/route.ts:1-4`); heartbeat runs it |
| Reply to customer | **AUTO-DRAFT; keep the send approval** | `mailbox-actions.ts:355` (wired) |
| Record payment (Mark Paid) | **ALREADY removed from PLOS → Admin reconciliation** | `invoice-surface.ts:269`; automate bank-reconciliation in rumah-admin |

### Infra / config — keep secrets/consents, automate the rest
- **KEEP (access grants):** Gmail OAuth · secret values · prod-DB grant · DPIA · Admin token authority.
- **AUTOMATE / ALREADY-DONE:** pooler `:6543` (✅ in code, `toTransactionPoolerUrl`) · googleapis bundling (✅ in `next.config.mjs`) · Admin-token minting (✅ `configure-admin-env.mjs`) · mailbox-connect driver (✅ `connect-mailbox.mjs`) · non-secret URLs/`INVOICE_SEND_MAILBOX` (→ checked-in defaults) · `pg_cron`/`pg_net` (→ fold `create extension` into the heartbeat SQL) · `CRON_SECRET`/Vault (→ one bootstrap owns it end-to-end).
- **Two small build items:** fold extension-enable into `setup-engine-heartbeat.sql`; one CRON_SECRET bootstrap script.

### Release / governance — auto-merge routine, keep consequential
- **AUTOMATE routine merges:** the founder click is **ceremonial** (PLOS `main` requires **0 approvals**; `merge-pr.mjs` is an override-less machine). A CI-bot auto-merge is a **distinct actor** → does **not** violate author≠verifier. Gate conditions: deterministic CI green + branch protection + independent VERIFY (promoted to a CI check) + reviewer-critic verdict + a **class-guard that fails-closed on consequential paths.**
- **KEEP:** the one-time opt-in per repo; all consequential-class merges (carve-out above).
- **Prerequisite:** **delivery-os `main` has NO branch protection** — add minimal CI + protection before any robot merges there.

### Recurring decisions — encode as policy/defaults
- **AD-4 dunning verdict:** split `gated-honestly` (pass) vs `gated-but-owed` (→ **fail/escalate**) so a real unbilled debtor never hides behind GREEN. Encode in the verifier. *(small)*
- **MAX_TOUCHES / chase cadence:** policy constant (default 3) + Admin-paid stop.
- **AD-2/AD-3 (pooler, pg_cron):** infra/access, not strategy — already treated as access blockers.

---

## THE AUTONOMOUS LOOP (with the one founder gate)
```
heartbeat (pg_cron→/api/cron/tick→engine.tick) advances every ready run, no human trigger
 DETECT ─▶ RESOLVE ─▶ READ Admin truth ─▶ PREPARE draft ─▶ ╔ FOUNDER GATE ╗ ─▶ EXECUTE send ─▶ VERIFY ─▶ stop/loop
 (trigger) entities   payment status      (D2: no send)     ║ approve/reject║    (idempotent)   (T1)     paid→closed
                      stop-on-paid                          ╚══════════════╝                            else re-chase→escalate
```
Everything except the gate is automatable **today**; the engine drives to the gate, only a verified human opens it.

## What must be BUILT to make autonomy real (dependency order, with effort)
| # | Missing piece | Why | Effort | Owner |
|---|---|---|---|---|
| 1 | **EMAXCONN merge (#181)** | reliable self-advance | done — **founder merge** | founder |
| 2 | **Heartbeat (G2)** schedule | runs self-advance | small SQL — **founder: enable extensions** | both |
| 3 | Confirm **G1** in deployed build | per-run input (else no-op) | verify-only | me |
| 4 | **BUSINESS TRIGGER (the keystone gap)** — a proactive sweep `getOverdueInvoices()` → `enqueue("mailbox.dunning-stop-on-paid", {input}, idem)` per debtor | **nothing enqueues runs today** (`grep .enqueue(` in apps = 0); the loop never *starts* | **~1–2 days** | me |
| 5 | **`customer_contacts` feed** (auto-sync from Admin) | recipient resolves → not `gated` | small code — **founder: DPIA + privileged source** | both |
| 6 | **AD-4 verifier policy** (gated-but-owed = fail) | GREEN must mean a real outcome | small | me |
| 7 | **G4/G5 approvals visibility** (built, in delivery-os PR #1) | founder can SEE what's awaiting + why | done — **founder merge** | founder |
| 8 | **Auto-merge robot** (CI-gated + class-guard + delivery-os CI/protection) | eliminate routine merges | ~2 days | me + 1-time opt-in |
| 9 | Operational reducers: scheduled mailbox sync · auto-draft reply · exception digest · auto-link | remove the ceremonial steps | small each | me |

## Recommended build order (each via engineer→QA→reviewer)
1. **#181 merge + heartbeat (G2)** → engine self-advances. *(founder unblocks)*
2. **Business trigger (#4)** → the loop STARTS itself (overdue sweep enqueues dunning). **← the single highest-leverage automation; without it the heartbeat advances nothing.**
3. **`customer_contacts` auto-sync (#5)** + **AD-4 policy (#6)** → runs reach `reminder_prepared` (real outcome), founder approves at the gate.
4. **G4/G5 merge** → the founder sees the approval queue + verdicts.
5. **Auto-merge robot (#8)** → routine merges stop reaching the founder (one-time opt-in + class guard; protect delivery-os main first).
6. **Operational reducers (#9)** → scheduled sync, auto-draft, digest, auto-link.
7. **Scale:** agent-runner wiring for the classify→resolve→draft pipeline (G6), reactive mailbox trigger.

## End state
After steps 1–6 the founder's *entire* standing involvement is: **approve-and-send at the one gate · the ~6 access grants/consents · a few one-time strategic rulings.** Every operational step (prepare, sync, classify, link, advance, reconcile, routine-merge, config) runs autonomously or is checked-in — exactly "leave only approvals, access grants, and strategic decisions."

## Honest limits
- The autonomy depends on the **business trigger (#4)**, which **does not exist yet** (verified: no `.enqueue(` in `apps/`) — the biggest single build to make "leave only approvals" real.
- Several enablers are founder-gated (merges, extensions, DPIA, OAuth) — those are the *kept* access grants, not eliminable.
- Auto-merge is governance-sensitive: it needs the one-time opt-in, the class-guard carve-out, and delivery-os branch protection first; until then routine delivery-os merges stay founder-owned.
