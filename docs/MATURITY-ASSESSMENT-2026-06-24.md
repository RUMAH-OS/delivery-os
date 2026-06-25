# Maturity Assessment — PLOS + Delivery OS as a daily-driver operating system (2026-06-24)

> Question answered: **what is still required before PLOS + Delivery OS can be used daily as the primary operating system?**
> Scope: founder-facing regressions · end-to-end workflows · Admin→PLOS integration · Workflow Engine maturity ·
> approval flows · operational usability. **Jarvis is explicitly out of scope here.**
> Companion to `ECOSYSTEM-STATE-ASSESSMENT-2026-06-24.md` (full state) — this adds the *daily-driver readiness* lens + the forward plan.
> Ratings: **READY** (usable daily) · **PARTIAL** (works but with a gating gap) · **NOT-YET** (cannot be relied on daily).

## Headline
**Delivery OS is a mature execution CORE that is not yet an OPERATIONAL system.** Every engine behaviour is proven;
the gap to "daily driver" is **operational**, not architectural: (1) the engine doesn't run itself (no heartbeat live),
(2) the #1 surface-breaking regression fix isn't merged, (3) the one capability that produces founder value (dunning)
no-ops until its recipient data is wired in prod, and (4) there's no founder trigger/visibility surface in scope (Jarvis paused).
Three of these four are **one founder action away each**; the assessment is "well-positioned, days-not-months from daily use."

## Maturity by dimension

| Dimension | Rating | Why |
|---|---|---|
| **Workflow Engine — core** | **READY** | enqueue→plan→execute→verify→complete, multi-agent/parallel, recovery, idempotency — all proven by proof scripts + independent VERIFYs; byte-identical across consumers (zero drift). **G1** (per-run input) closed. |
| **Workflow Engine — self-running** | **NOT-YET** | **G2 heartbeat not live** — nothing schedules `/api/cron/tick`, so runs don't self-advance in prod. SQL+runbook prepared (`scripts/setup-engine-heartbeat.sql`); needs `pg_cron`/`pg_net` enabled. |
| **Workflow Engine — verification** | **PARTIAL** | T1 (deterministic) solid + gating. **T2–T4 judgment verifiers uncalibrated (G8)** — they must pass eval-the-evaluator before they can gate judgment flows; until then those flows are advise-only/fail-closed. |
| **Workflow Engine — visibility** | **PARTIAL→READY** | **G4 (verdict on run-read) + G5 (pending-approvals listing) built + verified** (delivery-os PR #1) — closes the two read-projection gaps. *Activates on merge + redeploy.* |
| **End-to-end workflows (dunning)** | **PARTIAL** | Dunning is **code-complete and proven GREEN** (16 unit + 2 integration tests vs a real DB; reconciliation correct — the prior "RED" was stale). But it **no-ops in prod** until `customer_contacts` is populated (gated) AND the heartbeat runs (G2). The *first real, non-no-op prod run* is the milestone. |
| **Founder-facing surfaces (Floor/Room/Mailbox)** | **PARTIAL** | Broken under load by **EMAXCONN** (the dominant regression). **Fix built + verified, in PLOS PR #181** (session→transaction pooler, in code). *Activates on merge + redeploy.* Room deep-links dead until `ADMIN_UI_URL` set (config). |
| **Recovery / resilience** | **PARTIAL** | PLOS degrades-then-refills (never crashes) on an empty DB; `customer_contacts` rebuilds from Admin canonical — **PROVEN off-prod** (`run-recoverability-proof`). Prod rebuild **not yet run** (Admin contact-source unwired + DPIA). Founder-curated rows are PLOS-only (lost on reset unless backed up). |
| **Admin→PLOS integration** | **PARTIAL→GOOD** | **`/v1/ops` + `/v1/finance` read seam LIVE + healthy** (truth source). Event producer built; **PLOS-side drain fails every tick** (EMAXCONN — fixed by #181). Contact-source backfill (light path) built; prod wiring gated. |
| **Approval flows** | **PARTIAL** | Human gate is **solid** (verified-human only, machine roles rejected by construction, single-use, fail-closed audit). **G5 listing built** (PR #1) → inbox is now queryable. **G7: human-JWT trigger path unverified in prod.** Founder approval *surface* is Jarvis (paused). |
| **Operational usability (daily driver)** | **NOT-YET** | Sum of the above: no self-running engine, keystone fix unmerged, dunning no-ops, no in-scope founder surface. Usable daily only after the priorities below land. |

## Remaining blockers

### Founder-gated (only the founder can clear)
1. **Merge PLOS #181 + delivery-os #1** — deploys the EMAXCONN keystone + G4/G5 visibility. *(author≠verifier blocks self-merge — by design.)*
2. **PLOS prod DB**: confirm/keep the transaction pooler (`:6543`) engaged + prod read access (the fix auto-rewrites a session-pooler URL).
3. **Enable Supabase `pg_cron` + `pg_net`** → then the prepared heartbeat SQL is applied (engine self-runs).
4. **Wire Admin contact-source** (`ADMIN_CONTACT_SOURCE_URL/TOKEN`) + **DPIA** → populate prod `customer_contacts` (unblocks dunning + recovery in prod).
5. **Mailbox OAuth consent** (+ `j.huisman@` re-consent) — for mailbox-driven workflows.
6. **Rotate chat-exposed secrets.**
7. **Set `ADMIN_UI_URL`** (Room deep-links) — env value.

### Buildable (no founder gate; through the engineer→QA pipeline)
- **G8 — calibrate T2–T4 judgment verifiers** (eval-the-evaluator) before any judgment flow can gate.
- **Config-D hardening** — events-consumer timeout posture (do *after* the pooler fix, not before — it's entangled with EMAXCONN).
- **Back up founder-curated `customer_contacts`** off-PLOS (they're PLOS-canonical; lost on reset).
- **Rich triggers** — LLM-assisted goal→structured-input selection (a natural-language goal can't yet produce a domain workflow's structured payload).
- **(Out of scope here) the founder control surface** — Jarvis; paused.

## Gaps & missing capabilities (the "primary OS" bar)
- **No self-running loop in prod** (G2) — the single biggest "is it an OS" gap.
- **No business triggers** — no scheduled dunning sweep / mailbox-event trigger; runs must be started, they don't fire on real-world events yet.
- **No founder operational surface in scope** — without Jarvis, the founder has no trigger/approve/observe surface except raw HTTP; "daily use" needs one (re-scope Jarvis when ready, or an interim CLI).
- **Judgment not yet trustworthy to gate** (G8) — only deterministic (T1) flows can complete autonomously today.
- **Identity/contact**: AD-1 ruled **B** (two records; Admin owns billing contact, PLOS owns prospect graph) — record as **ECR-0008**; no identity-resolver build needed.

## Recommended priorities (ordered; each gates the next)
1. **Merge #181 + #1, redeploy** → Floor/Room/Mailbox stop failing; engine read surfaces the verdict + approvals inbox. *(founder: 2 clicks)*
2. **Enable extensions → apply the heartbeat** → engine self-advances in prod. *(founder: 2 toggles + 2 vault secrets; then me)*
3. **Wire Admin contact-source + DPIA → run `customer_contacts` prod recovery** → dunning has real recipients.
4. **First REAL operational dunning run on prod** (real overdue invoice → Admin read → decide → prepare reminder → verify pass → complete). **This is the "it's operational" proof.**
5. **G8 verifier calibration** → judgment flows can gate (expands what can run autonomously).
6. **A founder operational surface** (re-scope Jarvis or an interim CLI) → daily trigger/approve/observe.
7. **Config-D + curated-row backup + secret rotation** → hardening.

## Next implementation plan (slices; engineer → QA → reviewer-critic, builder never grades own work)
- **S1 (founder action):** merge #181 + #1 → redeploy PLOS + the chosen engine mount. *Gate: Floor burst-test green; `GET /workflow/runs/:id` returns `verify`; `GET /approvals` responds.*
- **S2 (me, post-extensions):** apply `setup-engine-heartbeat.sql`; verify `cron.job_run_details` succeeds; confirm a queued run self-advances. *Gate: a run goes queued→completed with no manual tick.*
- **S3 (me, post contact-source+DPIA):** run the `customer_contacts` backfill on prod; idempotent re-run; curated-row preservation check. *Gate: ≥1 tenant resolves a recipient.*
- **S4 (me):** drive the first real prod dunning run end-to-end; capture the run-read `verify` verdict as evidence. *Gate: a real reminder prepared (not `gated`), verify pass, run completed.*
- **S5 (me):** ECR-0008 (AD-1=B scoping) written + ratified; then any contact-derivation cleanups it authorizes.
- **S6 (me):** G8 — build the eval set + calibrate one T2 verifier; gate-eligibility only on passing calibration.
- **S7 (founder decision):** re-scope the founder surface (Jarvis/CLI) → trigger + status + approvals + verdict.

## Honest limits
- Live-prod claims (pooler engaged, extensions, table counts) are **unverified from here** — they need the merges + a prod read; the harness gates prod-secret reads pending explicit approval.
- "Proven" items (dunning, recovery, G4/G5) are proven **off-prod / in-PR**; prod equivalence is established only after S1–S4.
- Verifier judgment (T2–T4) is **not yet trustworthy to gate** — treat judgment-flow outputs as advisory until G8.
