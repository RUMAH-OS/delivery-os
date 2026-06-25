# IMPLEMENTATION HANDOFF — bootstrap for the next Claude Code session
**Created:** 2026-06-24 · **By:** ecosystem assessment session · **Status:** assessment COMPLETE, implementation NOT started.

> **Read me first.** This bootstraps a fresh terminal to *execute* the plan. The full reasoning + evidence is in
> the companion **`ECOSYSTEM-STATE-ASSESSMENT-2026-06-24.md`** (same folder) — read it before touching code.
> **Mandate:** move Delivery OS from *proven-capable* to *canonical execution platform in live operational usage.*
> **Discipline (non-negotiable):** never bypass the verify-gate; author≠verifier; honest-over-green; do NOT modify
> the enforcement gate (`verify-gate.mjs`/hooks) — gate changes come from founder/Delivery-OS only. PLOS proves +
> surfaces; **Admin/Delivery-OS own promotion/propagation + all `delivery-os` changes.**

---

## 0. One-paragraph context
Six-repo ecosystem under `C:\Users\brian\RUMAH`. **Admin** = canonical business-data (operational/transactional truth) + healthy in prod. **PLOS** = comms/intelligence/workflow layer, degraded on a fixable connection-pool issue. **Delivery OS** = the execution platform (engine + verification + capability packs); its engine is **proven-capable and byte-identical in both consumers (zero drift, G1 closed)** but **not yet running real daily workflows** — the one prod run was a no-op. **Website** = live. **jarvis** = intended founder control surface, currently an unaligned working seed. The migration regressions were all PLOS-side and are root-caused (see assessment §7).

## 1. What is DONE (verified — do not redo)
- ✅ Ecosystem assessment (`ECOSYSTEM-STATE-ASSESSMENT-2026-06-24.md`) — current state, regressions, root causes, ownership, alignment, decisions, order.
- ✅ Engine **G1** (per-run `input` in `StepContext`) closed in delivery-os AND **byte-identical** in PLOS + Admin (`.claude/os/engine/`, all 27 files, drift = 0). Verified by `diff -rq` this session.
- ✅ Recoverability PROVEN off-prod: PLOS degrades-then-refills; `customer_contacts` rebuilds from Admin canonical (`property-lead-os@edce74f`, idempotent, founder-curation preserved).
- ✅ CI/billing incident closed (all repos in `RUMAH-OS` org); daily `RepoHygieneMonitor`; PLOS auto-push active.
- ✅ Admin `/v1/ops` + `/v1/finance` read seams live + healthy in prod.

## 2. The goal-defining task
**Run the first REAL operational dunning on prod**: a real overdue invoice → PLOS reads Admin payment state → engine decides → drafts a real reminder → `engine.verify` passes on a *real outcome* (not `gated`) → run completes. That single live, verified, non-no-op run is the proof Delivery OS is the canonical execution platform *for the ecosystem*. Everything in §4 builds to it.

## 3. BLOCKED ON FOUNDER (cannot proceed without these — surface them immediately)
| Item | Action needed | Unblocks |
|---|---|---|
| PLOS `DATABASE_URL` | Switch to transaction pooler **`:6543`** (or un-mark Sensitive so it's editable). `prepare:false` already set. | #1 live regression (EMAXCONN) |
| Prod DB read access | Un-mark `DATABASE_URL` Sensitive → `vercel env pull`, or provide read-only string | Live verification + prod recovery |
| Supabase extensions | Enable **`pg_cron` + `pg_net`** (dashboard) | Engine heartbeat (G2) |
| Admin contact-source | Wire `ADMIN_CONTACT_SOURCE_URL`/`_TOKEN` to privileged Admin read — **after DPIA** | `customer_contacts` prod recovery |
| DPIA | Approve (GDPR Art. 35) | Contact backfill |
| Secrets | Rotate chat-exposed (DB pw, JWT, Vercel/TICK/CRON tokens, Web OAuth secret) | Security |
| Mailbox | One-time OAuth consent + `j.huisman@` re-consent | Mailbox workflows (G6) |

## 4. Implementation order (de-risked — execute top-down; each step gates the next)
1. **Fix PLOS EMAXCONN** (AD-2): set `DATABASE_URL` → `:6543`; trim the always-on drain loop's pooled-client hold (`apps/web/instrumentation.ts:40-98`) + per-request fan-out (`apps/web/app/page.tsx:31`). **Verify under a 25-way burst** (was 20/25 → 500). *PLOS repo, behind the gate.*
2. **Land G2 heartbeat** (AD-3): after extensions enabled, wire a minute pg_cron job → `/api/cron/tick` (CRON_SECRET-gated, endpoint already exists). Confirm runs self-advance.
3. **Confirm G1 in the deployed build** (source already byte-identical) — redeploy/verify the running engine carries `StepContext.input`.
4. **First real operational dunning** (the goal — §2). Build the real per-run input path now that G1 is live; real email via the resolved `customer_contacts`.
5. **`customer_contacts` prod recovery** (AD-1 ruled + Admin source + DPIA): run the proven backfill (`apps/web/lib/customer-contacts-backfill.ts`, migration `0035`) against prod.
6. **G4 (verifier verdict on `GET /v1/workflow/runs/:id`) + G5 (pending-approvals listing/event)** — engine changes in delivery-os, then os-inherit into consumers.
7. **jarvis control surface** (AD-6): install Delivery OS kernel; build trigger + status + approvals + notifications + verdict display as an **HTTP-only always-on worker** (Socket Mode + poller), per `jarvis-slack-control-surface/docs/SLACK-CONTROL-SURFACE-PLAN.md`. Depends on G1/G2/G4/G5.
8. **Capability growth:** G6 mailbox, G8 T2–T4 verifier calibration, AD-5 discovery decision, PLOS CAP-1…CAP-8.
9. **Hygiene:** AD-4 verifier policy, config fixes (D: `ADMIN_UI_URL`, events timeout), ecosystem-wide auto-push, branch protection on website + working branches.

## 5. Architecture decisions to get RULED before/with implementation (assessment §9–§10)
- **AD-1 Contact ownership** — recommend: lightweight **Admin-seed + PLOS-derivation** (accept the §11 "billing-email floor" scoping); **do NOT sign ECR-0007** (heavy PLOS canonical-Contact identity) now. **No contact-identity code until ruled.**
- **AD-2** pooler `:6543`. **AD-3** `pg_cron`. **AD-4** dunning verifier should FAIL a gated real debtor (recommend). **AD-5** discovery ON/OFF. **AD-6** install kernel into jarvis.

## 6. Key files / commands the next session will need
- **Assessment:** `delivery-os/docs/ECOSYSTEM-STATE-ASSESSMENT-2026-06-24.md`
- **Prior session handoffs:** `rumah-admin/docs/HANDOFF-SESSION-2026-06-24.md`, `rumah-admin/docs/handoff/CURRENT_SYSTEM_STATE.md` + `DELIVERY_OS_HANDOFF.md` (§11 contact decision), `rumah-admin/docs/HANDOFF-stuck-commits-from-plos-recovery.md`
- **Engine gap register:** `delivery-os/docs/OPERATIONAL-VALIDATION-2026-06-24.md`
- **Ownership truth:** `ecosystem-architecture/06-source-of-truth-registry.md`, `11-project-responsibilities.md`, `decisions/ECR-0006` (live seam), `ECR-0007` (proposed, unsigned)
- **Recovery proof:** `property-lead-os/scripts/run-recoverability-proof.mjs`; backfill `property-lead-os/apps/web/lib/customer-contacts-backfill.ts`
- **Engine source (canonical):** `delivery-os/templates/workflow-engine/` (27 files); consumer copies `*/.claude/os/engine/`
- **Drift verify:** `diff -rq delivery-os/templates/workflow-engine/ property-lead-os/.claude/os/engine/` (expect: only-in-consumer extras; no `differ`/`Only in delivery-os`)
- **State markers:** `git -C rumah-admin rev-list --count origin/dev..dev`; `schtasks /query /tn RepoHygieneMonitor`; PLOS `git status` (Admin's gate-held engine-install work — leave alone unless it's yours)

## 7. Open threads inherited from the prior session (not goal-critical but track)
- rumah-admin `dev`: run `slice:close` green → push (CI now fixed).
- Admin's engine-install + capability-extraction sits **uncommitted, gate-held, in the PLOS tree** — Admin verifies + commits it (NOT recovery debris; do not delete — it was stashed once already by mistaken premise).
- Ecosystem-wide auto-push is cross-blocked on a clean PLOS tree (held by the above).
- delivery-os engine `mailbox-pack` dunning proof was RED (invoiceId reconciliation bug in `mailbox-intelligence.ts`) — recorded in PLOS `TASK-engine-install-reinstall-validate.md`.

## 8. Definition of done for "canonical execution platform, live"
- [ ] PLOS serves under concurrency without EMAXCONN (burst-tested).
- [ ] Engine self-advances on prod (heartbeat live).
- [ ] **≥1 real, non-no-op dunning run completes on prod with a real verified business outcome** (a real reminder prepared/sent, not `gated`).
- [ ] `customer_contacts` recoverable on prod (backfill run + idempotent re-run green).
- [ ] AD-1…AD-6 ruled and recorded.
- [ ] Founder can trigger + see a run + approve via the control surface (jarvis), even if minimal.
