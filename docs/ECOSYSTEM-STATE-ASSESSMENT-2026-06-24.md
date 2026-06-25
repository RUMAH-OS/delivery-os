# Ecosystem State Assessment — RUMAH portfolio (2026-06-24)

> **Task 1 deliverable — READ-ONLY. No implementation. No code changes proposed for execution yet.**
> Scope: the entire ecosystem under `C:\Users\brian\RUMAH` (delivery-os · ecosystem-architecture ·
> property-lead-os · rumah-admin · rumah-website · jarvis-slack-control-surface).
> Optimised for **real operational usage · recoverability · Delivery OS alignment** — NOT for preserving
> historical implementation decisions. Disagreements are **surfaced, not smoothed** (North Star §11).
> Priorities in §6 are **recommendations to validate before implementation planning begins**, not a plan.

## ✅ PHASE 1 — DELIVERABLE STATUS: COMPLETE
The founder's Phase-1 deliverable list, with where each lives:

| Requested deliverable | Status | Location |
|---|---|---|
| Current system state | ✅ | §1 |
| Architecture summary | ✅ | §2 |
| Open regressions | ✅ | §3 |
| Root causes | ✅ | §7 |
| Open blockers | ✅ | §4 |
| Ownership boundaries | ✅ | §5 |
| Contact-ownership decision | ✅ | §9 + the **§11 panel** `rumah-admin/docs/DECISION-REVIEW-2026-06-24-ad1-contact-ownership.md` |
| Delivery OS alignment review | ✅ | §8 |
| Architecture decisions required | ✅ | §10 |
| Founder action checklist | ✅ | §11 |
| Recommended implementation order | ✅ | §12 |
| Complete implementation handoff | ✅ | `delivery-os/docs/IMPLEMENTATION-HANDOFF-2026-06-24.md` |

**Post-assessment verifications (folded back in; these refine §1/§3/§4/§9):**
- **Dunning reconciliation is GREEN, not RED.** The `TASK-engine-install-reinstall-validate.md` "invoiceId reconciliation bug" was a *stale* pre-fix state. Reproduced this session: in-tree unit (16/16) + integration (2/2) tests pass against a real DB — `reminder_prepared` with `unpaidInvoiceIds === [invoiceId]`, `no_action_all_paid` for paid. Dunning works in code.
- **EMAXCONN keystone fix delivered (code).** `toTransactionPoolerUrl` (session `:5432` → transaction pooler `:6543`) in `packages/db/src/client.ts`; independently verified (`property-lead-os/docs/verify/VERIFY-db-transaction-pooler-local.md`); CI-green in **PR #181**, pending the founder merge (author≠verifier blocks self-merge). This converts blocker §4-#1 from "needs founder Vercel edit" to "needs founder merge of a verified PR."
- **AD-1 contact ownership RESOLVED by a 7-lens §11 panel** (unanimous): see §9 (updated) + the DECISION-REVIEW.

**Phase 1 is closed.** Phase 2 (implementation) is gated on the founder actions in §11 + the AD-1 ruling (§9). The DB fix in PR #181 is the only Phase-2 work executed so far (founder explicitly directed it).

Evidence basis: ecosystem-architecture registries + ECRs (locked/proposed), the 2026-06-24 multi-agent
recovery synthesis (`rumah-admin/docs/handoff/CURRENT_SYSTEM_STATE.md`, `DELIVERY_OS_HANDOFF.md`,
`HANDOFF-SESSION-2026-06-24.md`), the Delivery OS gap register (`delivery-os/docs/OPERATIONAL-VALIDATION-2026-06-24.md`),
and direct on-disk/git inspection. Confidence markers: **PROVEN** (ran/evidence) · **stated** (asserted in a doc) · **open**.

---

## 0. The target architecture being assessed against
- **Delivery OS** = canonical **execution platform**: orchestration · verification · runtime · memory · capability management.
- **Rumah Admin** = canonical **business-data system** (operational/transactional truth; per founder briefing, canonical owner of tenants, customers, contact data *whenever practical*).
- **PLOS** = **communication, intelligence & workflow** layer — *collects/enriches/uses* Admin-owned canonical data rather than maintaining an independent canonical contact system unless a proven reason exists.
- **Future systems** = installed **capability packs**.
- **Founder control surface** (Slack / "Founder OS") = intelligence/orchestration *above* the systems — reasons/coordinates/monitors/recommends/acts; **owns no data**.

---

## 1. Current system state

### Production
| System | Status | Evidence |
|---|---|---|
| **Rumah Admin prod** | ✅ **Healthy** | `/v1/ops/*` 200 (migration 0033 applied), seams current, event producer not stale. Supabase `clfocpodfbtgzivnivck`. All ecosystem regressions are **PLOS-side, not Admin** (PROVEN, `CURRENT_SYSTEM_STATE §7-9`). |
| **PLOS prod** | ⚠ **Degraded (serving)** | Deployed + serving; **EMAXCONN connection-pool exhaustion under concurrency** is the #1 live blocker (band-aid `max:3` only); mailbox OAuth fixed (Web client); ask 6s / briefing 16s; discovery OFF by design; **`customer_contacts` EMPTY in prod**. Supabase `inyoglidsqirznysgaho`. |
| **Rumah Website** | 🟢 **Production** (live 2026-06-10) | Public marketing + inbound enquiry capture. Inventory still static-in-repo; now inherits the canonical `inventory-properties` contract from Delivery OS (stopped mirroring). |
| **Delivery OS engine** | 🟢 **Proven-CAPABLE, not yet in real usage** | Every founder-listed behaviour proven by proof scripts + independent VERIFY docs; deployed instance byte-identical (drift-gated). Prod run `49983faa` completed — **but was a no-op** (default empty email). |
| **jarvis (control surface)** | 🟡 **Working seed only** | `src/` = `slack-app.ts`, `handle-goal.ts`, `goals-client.ts` + manifest. Plan exists; full surface↔mechanism wiring not built. Depends on engine gaps G1/G4/G5/G2. |
| **ecosystem-architecture** | 📘 Docs/registries (no runtime) | Portfolio source-of-truth: 11 maps + ECR-0001…0007. |

### Recoverability (PROVEN this session — a headline strength)
- PLOS **degrades-then-refills, never crashes** on an empty/reset operational DB. **PROVEN** via `property-lead-os/scripts/run-recoverability-proof.mjs` (throwaway Docker DB), independently re-run GREEN.
- `customer_contacts` **rebuilds from Admin canonical tenant contacts** ("ECR-0007 light path", commit `property-lead-os@edce74f`): backfill → `reminder_prepared`; re-gates on loss; recovers on re-backfill; idempotent; founder-curated rows preserved (`provenance='curated'` wins over `'derived'`). **PROVEN off-prod; NOT yet run on prod.**
- Discovery repopulates the **leads/`contacts`** graph (when enabled). Capture (ungated) rebuilds `companies/leads/signals/lead_scores`.
- **Limit:** non-regenerable history is lost on reset — `contact_events` (doneToday/cooldowns), `agent_runs` (anti-rebuy memory), audit rows. A re-discovered person yields an *equivalent* card; learning/economics do not survive.

### Working-tree / git hygiene (today)
- CI/billing incident **CLOSED** — all 6 repos migrated into the `RUMAH-OS` GitHub org (CI bills the org). Daily `RepoHygieneMonitor` scheduled; PLOS auto-push (post-commit) active.
- Ahead-of-upstream now: delivery-os +2, rumah-admin +1 (the 76 stuck commits appear pushed since the handoff), jarvis +2. Dirty trees: PLOS 10 (Admin's engine-install + capability-extraction work, **gate-held — correct**), rumah-admin 4, delivery-os 3.

---

## 2. Architecture summary

**Two systems of record (locked, ECR-0003 / registry §6):**
- **Demand/CRM Spine** (physically PLOS Supabase EU Postgres, governed as a *platform asset*) owns *who needs accommodation & our pursuit of them*: Organisation · Lead · **Contact/Person** · Signal · Outreach.
- **Rumah Admin** owns *operational & transactional* truth: Property/Inventory · Availability/Pricing · Deal/Placement · Tenant · Contract · Invoice — **plus the canonical operational derivations** (overdue/expiring/expected-revenue/owner-fee/pending-signing/attention).

**Live integration seams (ECR-0006):**
- **Reads = truth, events = triggers.** Admin `/v1/ops/*` + `/v1/finance/*` (authed `ops:read`, data-minimised) — **🟢 built + healthy in prod.** One canonical derivation in Admin; consumers never reimplement it, never touch Admin's DB.
- Admin→PLOS **business events** (invoice.overdue, contract.signed, payment.received, send_requested…) — producer **built**; PLOS-side relay/ingress drain **fails every tick** in prod (EMAXCONN + 3s timeout). PULL transport (founder amendment 2026-06-13).
- Seam is **PII-free by construction** (refs only; executable validator `admin-plos-seam-v1.mjs` rejects PII; no version bump needed for contactId).

**Delivery OS as execution platform (engine reality):**
- **Orchestration:** real workflow engine (enqueue→plan→execute→complete), multi-agent/parallel, recovery/idempotency — all **PROVEN-capable**.
- **Verification:** T1 + T2–T4 + LLM-judge, advise-vs-gate, verify-LOOP (act→verify→retry→stop), author≠verifier gate operationally enforced (the framework dogfoods its own gate — `VERIFY-step3-dogfood`).
- **Capability management:** packs install **byte-identically** via os-inherit, drift-gated (`engine:drift:check` green); engine vendored into PLOS + Admin. This is the real mechanism behind "future systems = installed capability packs."
- **Memory:** three-tier memory + four registries (wiki retired at v4/F6).
- **Honest finding:** the engine is *capable* but **not yet in meaningful real operational usage** — see blockers (G1/G2 etc.).

---

## 3. Open regressions (introduced/exposed by the recent migration; all PLOS-side — PROVEN)

| # | Regression | Root cause | Status |
|---|---|---|---|
| R1 | **5/6 PLOS surfaces fail under concurrency** (Room/Floor/drain → 500 `EMAXCONN`) | **A — Postgres session-pooler 15-client cap** vs `(instances×3)+fan-out+drain` demand. One cause, six presentations (each route swallows it differently → looked "inconsistent"). | confirmed; band-aid only |
| R2 | **Dunning gates every real debtor** → runs go GREEN while nobody is reminded | **B — `customer_contacts` empty, no autonomous writer**; T1 verifier passes `gated_honestly`. "Technical completion, not business outcome." | **FIXED off-prod** (`edce74f`); prod source not wired |
| R3 | **Floor gets no new people; refill routes 503** | **C — `DISCOVERY_ENABLED` off by design** (founder intent) + capture never writes `contacts`. Product-intent conflict, not a defect. | by-design; founder decision pending |
| R4 | **All Room deep-links dead; events consumer intermittently "unreachable"** | **D — missing config** (`ADMIN_UI_URL` absent; `DEFAULT_TIMEOUT_MS=3000`) | config fix |
| R5 | **Mailbox `j.huisman@` unreachable; "never synced"** | **E — by-design (manual sync) + suspected DWD reauth-expiry** | partial / by-design |

> Rejected hypotheses (do **not** re-pursue): pool churn caused EMAXCONN (it's mitigation); "Admin is the problem" (Admin healthy); `customer_contacts` rebuildable via discovery (FALSE — disjoint tables, no join key); the dunning chain lives in Admin (FALSE — PLOS-only).

---

## 4. Open blockers

### Founder-action blockers (system cannot proceed without these)
1. **PLOS EMAXCONN — #1 LIVE.** Real fix = switch PLOS `DATABASE_URL` to the **transaction pooler (`:6543`)**. Blocked because `DATABASE_URL` is **Sensitive in Vercel** → founder must edit the port or provide the string.
2. **Prod DB read access** — `DATABASE_URL` Sensitive excludes it from `vercel env pull`; needed for live verification + prod recovery. Founder un-marks Sensitive or provides a read-only string.
3. **`customer_contacts` prod recovery** — tool built/proven; Admin contact-source (`ADMIN_CONTACT_SOURCE_URL/TOKEN`) **inert** until wired to a privileged Admin read; gated on **DPIA** + Admin prod tenant PII loaded.
4. **G2 engine heartbeat** — needs Supabase **`pg_cron` + `pg_net`** extensions enabled (founder dashboard), then a minute-job → `/api/cron/tick`. Until then runs don't self-advance in prod.
5. **Invoicing engine integration (rumah-admin)** — built + pure-verified (17/17), but DB-backed integration was blocked on a **full host disk (`C:` 0 GB free)**; migration 0009 unapplied/unverified. Needs disk space (now possibly stale — re-confirm).
6. **Secrets rotation** — DB passwords, JWT, Vercel/TICK/CRON tokens, Web OAuth client secret were exchanged in chat during setup → rotate.
7. **Mailbox connection** (G6) — one-time human OAuth consent; `j.huisman@` re-consent.

### Engine gaps blocking *real operational usage* (Delivery OS gap register)
- **G1 — per-run input not threaded to handlers** *(was TOP BLOCKER)* → **CLOSED** by `delivery-os@e812ea7` (threaded `run.input` into `StepContext`). *Verify it propagates to the deployed PLOS/Admin engine via os-inherit before relying on it.*
- **G2 — no automatic trigger/heartbeat** → runs don't start/progress on their own. (founder blocker #4)
- **G3 — no founder-facing trigger/visibility** → exactly what the Slack surface closes.
- **G4 — verifier verdict not on the run-read projection** → surfaces can't show pass/reasons.
- **G5 — no pending-approvals listing** → no founder approvals inbox.
- **G7 — human-JWT trigger path unverified in prod.**
- **G8 — dunning verifier is T1-only** → judgment flows need T2–T4 calibration before they can gate.

### Process blockers
- **Admin `dev`**: run `slice:close` green (gated migrations + product-quality surface) then push.
- **Auto-push not ecosystem-wide** — cross-blocked: committing the canonical post-commit hook to delivery-os needs a clean PLOS tree (held by Admin's gate-held engine-install work).

---

## 5. Ownership boundaries (and the live divergence I must surface)

**Settled & locked (one writer-of-record per entity; registry §6, ECR-0003):**
- Admin owns: Property/Inventory, Availability/Pricing, Deal/Placement, **Tenant**, Contract, Invoice, operational derivations.
- Spine/PLOS owns: Organisation, Lead, **Contact/Person**, Signal, Outreach.
- Website: writes inbound Leads only; reads Inventory read-only. Owns nothing canonical.
- Delivery OS: *the how*, not a registered *what* — owns execution/verification/capability packaging.

### ⚠ DIVERGENCE TO RESOLVE — "who owns contact data" (surfaced, not smoothed)
Three artifacts pull in different directions:
- **Founder briefing (today):** *"Admin is the canonical owner of tenants, customers and contact data whenever practical; PLOS should collect/enrich/use it rather than maintain an independent canonical contact system unless proven necessary."*
- **ECR-0007 (PROPOSED, unsigned; 4/4 §11 panel + founder "D1" ruling 2026-06-17):** the **opposite** — Contact stays a **PLOS System-of-Record + host**; Admin holds only an opaque `contactId`; "Founder OS" only *understands* contacts.
- **As-built code (`edce74f`):** does it the **briefing's** way — `customer_contacts` is a **rebuildable derivation of Admin canonical data**.

**Reconciliation already ratified (Delivery OS Handoff §11):** the contradiction is **partly resolved by scoping the words**:
- *"Admin owns contacts" = the **billing-email floor**, NOT a canonical identity model.* Admin is canonical for `tenant.email / contactName / contactEmail` (the seed). Admin has **no** person/identity model, no dedup/cardinality/resolver, no `customer_contacts`, no dunning (PROVEN: zero refs in `rumah-admin/src`).
- `customer_contacts` stays **PLOS-owned** but is a **derivation** of Admin's canonical tenant contacts (provenance curated|derived).
- End-state fit recorded: Admin-SoR-for-contacts = **PARTIAL** (billing floor yes; identity model stays PLOS).

**What remains genuinely OPEN for the founder to rule on:**
- The deeper **canonical-Contact-identity** question (one-person-spanning model, resolver, merge/un-merge) — ECR-0007 — is **unsigned**. The briefing's "PLOS should not maintain an independently curated canonical contact system unless proven" reads as *skepticism* toward exactly the PLOS-hosted canonical-Contact ECR-0007 proposes. **These need explicit alignment** before any identity build. ECR-0007 itself is gated to post-V6-proof + N=1 and authorises no code until signed.

---

## 6. Recommended priorities (to VALIDATE before implementation planning — not a plan)

Ordered to maximise *real operational usage · recoverability · Delivery OS alignment*:

1. **Unblock PLOS prod data plane (founder action).** Switch `DATABASE_URL` → transaction pooler `:6543` (fixes R1/EMAXCONN, the #1 live blocker) + grant prod DB read access. Nothing downstream is trustworthy under a broken pool.
2. **Land the heartbeat — G2.** Enable `pg_cron`+`pg_net`; wire `/api/cron/tick`. Without it the engine never self-advances → "execution platform" stays theoretical.
3. **First REAL operational dunning on prod** (real email → Admin payment read → decision → verify → complete) — now unblocked by G1 (closed) + G2. **This is the actual proof that Delivery OS is the canonical execution platform in live usage** (directly serves the session goal). Confirm G1 reached the deployed engine via os-inherit first.
4. **Wire `customer_contacts` prod recovery** (Admin contact-source + DPIA) — turns the proven-off-prod recoverability into live recoverability; closes R2 in prod.
5. **Resolve the contact-ownership divergence (§5) with the founder** — confirm "Admin = billing-email floor" scoping, and decide ECR-0007's fate (sign / amend / shelve) before any identity/resolver work. **No contact-identity code until this is ruled.**
6. **Founder surface — G4 + G5, then Slack** into `jarvis-slack-control-surface` (trigger + status + approvals + notifications + verdict display). Don't build the surface before the engine has verdict-in-projection (G4) and an approvals listing (G5), or it shows nothing real.
7. **Finish git/governance hygiene:** Admin `dev` `slice:close`+push; Admin verifies+commits the gate-held engine-install in PLOS → unblocks ecosystem-wide auto-push + the canonical post-commit hook into delivery-os; extend branch protection to website + working branches.
8. **Config + safety cleanups:** `ADMIN_UI_URL` (R4 dead deep-links), events-consumer timeout, **rotate the chat-exposed secrets**, re-confirm the rumah-admin invoicing disk blocker (may be stale).
9. **Then** capability growth: mailbox connect (G6), T2–T4 verifier calibration (G8), discovery-ON decision (R3), PLOS CAP-1…CAP-8 queue.

---

## 7. Root causes (the regressions reduce to five; PROVEN)

| ID | Root cause | Mechanism | Surfaces it explains |
|---|---|---|---|
| **A** | **PLOS Postgres session-pooler 15-client cap vs demand** (DOMINANT) | `getDb()` `max=3` per serverless instance + always-on admin-drain loop (`instrumentation.ts:40-98`, holds a pooled client/instance) + per-request fan-out (Floor home = 5 conns) → `(instances×3)+fan-out+drain > 15`. Each route swallows the same `EMAXCONNSESSION` into a different shape → looked "inconsistent." | Room/Floor/drain 500s; mailbox blank under load; PLOS-side event drain failing every tick |
| **B** | **`customer_contacts` empty, no autonomous writer** | Migration 0023 DDL-only; only writers were human gestures. Dunning gate (`mailbox-dunning.ts:319-331`) blocks every debtor; T1 verifier passes `gated_honestly` → GREEN with nobody reminded. | dunning no-op; "technical completion, not business outcome" |
| **C** | **`DISCOVERY_ENABLED` off by design** (founder intent) | 503-gates `/api/discover`, `/api/contacts/resolve`, `/api/research`. Capture (ungated) writes companies/leads/signals but never `contacts`. | Floor gets no new people; refill 503 |
| **D** | **Missing config** | `ADMIN_UI_URL` absent → Room `link.href` null; `DEFAULT_TIMEOUT_MS=3000` on events consumer → intermittent "unreachable" | dead deep-links; intermittent drain failures |
| **E** | **Mailbox by-design + suspected DWD expiry** | Manual sync (no cron); `j.huisman@` suspected DWD reauth-expiry | "never synced"; one mailbox unreachable |

> Rejected (do **not** re-pursue): pool churn caused EMAXCONN (it's mitigation); "Admin is the problem" (Admin healthy); `customer_contacts` rebuildable via discovery (FALSE — disjoint tables, no join key); dunning chain lives in Admin (FALSE — PLOS-only); `max:5` fixes it (it *exceeded* the cap).

## 8. Delivery OS alignment review (verified on disk this session)

| Repo | `.claude` kernel | verify-gate | vendored engine | INHERITED.json | CLAUDE.md | Verdict |
|---|---|---|---|---|---|---|
| **delivery-os** | ✅ | ✅ | n/a (source in `templates/`) | n/a | ✅ | **The platform** |
| **property-lead-os** | ✅ | ✅ | ✅ 27 files **byte-identical** | ✅ | ✅ | **Fully aligned** |
| **rumah-admin** | ✅ | ✅ | ✅ 27 files **byte-identical** | ✅ | ✅ | **Fully aligned** |
| **rumah-website** | ✅ | ❌ | ❌ | ✅ | ❌ | **Partial** (kernel + inherit only; no gate/engine — acceptable: no workflow runtime needed yet) |
| **jarvis** (control surface) | ❌ | ❌ | ❌ | ❌ | ❌ | **Unaligned** — zero Delivery OS install despite being the intended front door to the engine |

**Findings:**
- **The execution core is genuinely canonical:** both runtime consumers run the *byte-identical, drift-zero* engine (all 27 files), incl. the G1 fix. The "platform proves it once, consumers run the same thing" guarantee is real and current.
- **The framework dogfoods its own gate** (verify-gate active; `VERIFY-step3-dogfood` evidence). author≠verifier enforced.
- **Gap:** jarvis has no kernel/gate at all. Before it becomes the founder control surface it should at least install the kernel + be a disciplined HTTP-only client (the plan already mandates HTTP-only; the install is missing).
- **Minor:** website has no verify-gate/CLAUDE.md — fine while it has no workflow runtime, but it *does* now inherit contracts, so a kernel-lite + gate is worth considering.

## 9. Contact-ownership decision (RECOMMENDATION for founder ruling)

**The three-way tension** (briefing vs ECR-0007 vs as-built) is real. Recommended resolution, consistent with everything proven:

- **ACCEPT the §11-ratified scoping as the operating rule:** *"Admin is canonical owner of contacts" = the **billing-email floor*** (`tenant.email / contactName / contactEmail`) — the canonical *seed*. Admin holds **no** identity model (PROVEN: zero person/dedup/resolver/`customer_contacts`/`dunning` refs in `rumah-admin/src`). This satisfies the founder briefing ("Admin canonical whenever practical") *and* matches the as-built `edce74f` code.
- **`customer_contacts` stays PLOS-owned as a derivation** of Admin canonical data (provenance `curated` wins over `derived`). This is the founder's stated preference ("PLOS collects/enriches/uses rather than maintaining an independent canonical system") — **already true in code**.
- **Defer / likely SHELVE ECR-0007's heavy canonical-Contact-identity build** (person-spanning resolver, merge/un-merge, largest-PII-concentration). The briefing's "do not maintain an independently curated canonical contact system unless proven" reads as direct skepticism of exactly that. ECR-0007 is unsigned, gated to post-V6+N=1, and authorises no code. **Recommendation: do not sign it now**; record that the lightweight derivation path (`edce74f`) is the chosen direction unless/until a *proven* identity-resolution need appears.
- **This is a founder decision, not a code decision.** It is **Architecture Decision #1** below and **must be ruled before any contact-identity code.**

## 10. Architecture decisions required (founder must rule before implementation planning closes)

| # | Decision | Recommendation | Why it's blocking |
|---|---|---|---|
| **AD-1** | Contact ownership: lightweight Admin-seed + PLOS-derivation (accept §11 scoping) vs heavy PLOS canonical-Contact identity (ECR-0007) | **Lightweight derivation; do not sign ECR-0007 now** (§9) | Determines whether any resolver/merge code gets built; everything else about contacts hangs on it |
| **AD-2** | PLOS DB connection model: transaction pooler `:6543` (real fix) vs code-level demand reduction vs both | **Transaction pooler `:6543`** (`prepare:false` already set) + trim the drain-loop client hold | The #1 live regression; nothing downstream is trustworthy under a broken pool |
| **AD-3** | Engine trigger model: Supabase `pg_cron`→`/api/cron/tick` vs Vercel Cron (Pro) vs an always-on worker (the jarvis worker) | **`pg_cron`+`pg_net`** (cheapest; PLOS already on Supabase) | Without it the engine never self-advances → "execution platform" stays theoretical (G2) |
| **AD-4** | Dunning verifier policy: should a "gated" verdict PASS for a genuinely-overdue debtor? | Founder call — recommend **FAIL** (a gated real debtor = unmet business outcome) | Decides whether GREEN runs can hide unbilled debtors |
| **AD-5** | Discovery in prod: ON vs OFF | Founder call (currently OFF by design) | Gates whether the Floor people-graph self-refills |
| **AD-6** | jarvis alignment: install Delivery OS kernel into the control surface, HTTP-only | **Yes, install kernel; HTTP-only client** | The front door to the platform is currently unaligned (§8) |

## 11. Founder action checklist (the gated items only the founder can unblock)

- [ ] **PLOS `DATABASE_URL` → transaction pooler `:6543`** (or un-mark it Sensitive in Vercel so it can be edited). *Fixes the #1 live blocker.*
- [ ] **Grant prod DB read access** (un-mark `DATABASE_URL` Sensitive → `vercel env pull`, or provide a read-only string). *Needed for live verification + prod recovery run.*
- [ ] **Enable Supabase extensions `pg_cron` + `pg_net`** (dashboard) → then the engine heartbeat can be wired.
- [ ] **Wire the Admin contact-source** (`ADMIN_CONTACT_SOURCE_URL` / `_TOKEN`) to a privileged Admin tenant-contact read — **after the DPIA** + Admin prod tenant PII loaded. *Enables `customer_contacts` prod recovery.*
- [ ] **DPIA** for the contact backfill (GDPR Art. 35 — PII concentration).
- [ ] **Rotate chat-exposed secrets** (DB passwords, JWT, Vercel/TICK/CRON tokens, Web OAuth client secret).
- [ ] **One-time mailbox OAuth consent** (G6) + `j.huisman@` re-consent.
- [ ] **Rule AD-1…AD-6** above.
- [ ] **Re-confirm the rumah-admin invoicing disk blocker** (was `C:` 0 GB free; may be stale) before resuming invoicing integration.

## 12. Recommended implementation order (de-risked; for the NEXT session — NOT executed here)

1. **AD-2 → fix PLOS EMAXCONN** (pooler `:6543` + trim drain hold). Verify under burst. *(Unblocks every PLOS surface.)*
2. **AD-3 → land G2 heartbeat** (`pg_cron`+`pg_net` → `/api/cron/tick`). *(Runs self-advance.)*
3. **Confirm G1 reached the deployed engines** (already byte-identical in source — verify the deployed build carries it).
4. **First REAL operational dunning on prod**: real email → Admin payment read → decision → engine.verify → complete. **← the actual proof Delivery OS is the canonical execution platform in live use (the session goal).**
5. **Wire `customer_contacts` prod recovery** (AD-1 ruled + Admin source + DPIA). *(Live recoverability; closes R2 in prod.)*
6. **G4 (verdict on run projection) + G5 (pending-approvals listing)** — prerequisites for the founder surface.
7. **jarvis control surface** (AD-6): install kernel; build trigger + status + approvals + notifications + verdict display (HTTP-only worker).
8. **Capability growth:** G6 mailbox connect, G8 T2–T4 verifier calibration, AD-5 discovery decision, PLOS CAP-1…CAP-8.
9. **Hygiene throughout:** AD-4 verifier policy, config fixes (D), secrets rotation, ecosystem-wide auto-push, branch protection.

> **Gating rule:** steps 1–3 are infra/engine and must be green before step 4. Step 4 is the goal-defining proof. Steps 5+ build on a live engine. No contact-identity code until AD-1 is ruled.

## 13. Honest limits of this assessment
- Read-only; no live prod queries run (prod DB access is itself a blocker). Production claims rest on this session's recorded evidence, not my own live re-runs.
- Several "PROVEN" items are proven **off-prod** (recoverability, `customer_contacts` backfill); prod equivalence is explicitly **not yet** established.
- The contact-ownership divergence (§5) is a **founder decision**, not something to resolve in code — flagged, not adjudicated.
