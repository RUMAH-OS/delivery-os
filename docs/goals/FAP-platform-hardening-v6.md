---
goal_id: platform-hardening-v6
disposition: boundary
boundary_class: deploy-auth
boundary_evidence_kind: tool_denial
boundary_evidence: "Founder-authorization-class action denied: per the standing security constraint I cannot set production secrets, upgrade the paid plan, apply production migrations, or deploy to production without explicit per-instance founder authorization. Corroborated by gate_state: Vercel prod deploy runs 28285543827 + 28286295259 FAILED on 'DATABASE_URL is required; SUPABASE_URL: Invalid url' (prod env vars blank — only the founder can set them)."
founder_burden_category: per_action_authorization
autonomous_work_done: true
verify_clean: true
resume_goal: "/goal resume FAP-platform-hardening-v6"
---

# Founder Action Package — platform-hardening-v6

> I ran the autonomous part of this objective as far as a machine can. The next required step is a
> **founder action** — something only you can do (it touches production secrets, billing, and a live
> customer-comms deploy). Reaching this point is the goal **succeeding** at its job. Do the actions in §5,
> then paste the resume line in §7 to continue.

## 1. Status (one screen)
The entire platform hardening is **built, independently verified, and merged** — 12 PRs into `main` across
three repos with zero gate bypasses. The autonomy you asked for (Admin heartbeat/scheduler, recovery/retry/
settlement, the continuous Discovery sweep, exactly-once delivery, restored governance auto-trigger) is
**code-complete but dormant**: it cannot run until PLOS is deployed to production, and the PLOS production
deploy is blocked on **founder-only Vercel infrastructure** (prod secrets + a paid plan + applying prod
migrations). That is the single boundary.

## 2. What I completed (real references)
- **delivery-os** — hook-path integrity + regression gate (PR #13); **governance auto-trigger RESTORED + regression-guarded** so it can never silently regress (PR #14, `VERIFY-review-trigger.md`); engine G4/G5 visibility (PR #1).
- **rumah-admin** — Owner-Invoices enterprise overhaul (PR #15, `VERIFY-owner-invoices-enterprise-final.md`); **reliability keystone** — heartbeat/scheduler + scheduled-send no-op fix + event-drain poison-pill fix + dedup-race fix (PR #16, `VERIFY-keystone-reliability-p0s.md`).
- **PLOS** — invoice-delivery A=b (PR #196); deploy node-pin (#191); deploy path-doubling fix (#197); CI orchestrator (#193); **Discovery continuity** — was 5 disconnected manual stages + a missing promotion; now a continuous, idempotent, actionable-error sweep (#198, `DISCOVERY-PIPELINE-AUDIT-2026-06-27.md`); db-pooler (#181); verify-parallel CI (#192).
- **PLOS-side reliability P0s** built + QA-verified, held for the coordinated deploy: real-customer double-send → atomic claim-before-send; callback desync → persist + reconcile; silent drain → liveness alarm; capture idempotency (PR #199, `VERIFY-plos-reliability-p0s.md`, migrations 0036–0039).
- **Audits** — `PLATFORM-OBSERVABILITY-AUDIT-2026-06-27.md` (silent-failure + idempotency backlog). Stale PR #5 closed (superseded); #175/#174 surfaced as real out-of-scope capability gaps.

## 3. What remains (the next autonomous segment, after §5)
Merge PR #199 in lockstep with its migrations · confirm each PLOS prod deploy goes green · run the live
**Wave-1** walkthrough with real data (contract → invoice → Admin → PLOS → Review → Confirm → customer
mailbox → callback → lifecycle completion) · execute the final full-platform regression + post-merge
production verification. All staged; all autonomous once production exists.

## 4. WHY I stopped (the boundary)
The next step is **bringing PLOS to production** (set prod secrets, upgrade the plan, apply prod migrations,
deploy); only you can do it because these are **founder-authorization-class** actions — setting production
secrets, billing changes, and a live customer-comms deploy are not things I may perform.
- **Boundary class:** `deploy-auth` · **evidence kind:** `tool_denial` (corroborated by `gate_state`)
- **Evidence:** Vercel prod deploy runs `28285543827` + `28286295259` FAILED — `DATABASE_URL is required; SUPABASE_URL: Invalid url` (the prod env vars are blank in the Vercel project; only you can set them). Setting prod secrets / upgrading the paid plan / applying prod migrations / deploying are founder-only per the standing security constraint.

## 5. Exactly what to do (zero technical knowledge)
1. **Vercel → project `property-lead-os` → Settings → Environment Variables → Production.** First confirm the project is the one the deploy uses (scope **`bkasanwiredjos-projects`**). Set:
   - **`DATABASE_URL`** *(required — the actual blocker)* → your real Supabase **production** Postgres URL, **pooled, port 6543**. The build only checks the format; it does not connect.
   - **`SUPABASE_URL`** → your real `https://<ref>.supabase.co`, **or delete** the empty variable.
   - **`TICK_TOKEN`** → a real secret of **16+ characters**, **or delete** the empty variable.
   - **`CRON_SECRET`** → a secret (the crons fail-closed without it). (Set the same in the rumah-admin Vercel project.)
   - **Success looks like:** none of the three are blank empty strings. ✅
2. **Vercel → upgrade to a paid plan (Pro).** Hobby caps you at **2 crons, once/day** — too few/slow for the Admin heartbeat, the delivery drain, and the Discovery sweep. This is the structural switch that makes "survives without manual intervention" actually true. **Success:** crons can run on a `*/5`-style schedule. ✅
3. **When you want Discovery to run + spend:** set `DISCOVERY_ENABLED=1`, `DISCOVERY_SWEEP_ENABLED=1`, and confirm `A2_DAILY_SPEND_CAP_EUR` (the autonomous daily ceiling). It stays inert until set. ✅
4. **Tell me you've done 1–2 (and 3 if enabling Discovery).** I then merge #199, apply the migrations **in lockstep with** its deploy (rumah-admin reliability + PLOS `0036–0039`), watch every deploy go green, and run the live Wave-1 walkthrough + final verification. **Do not** merge #199 yourself ahead of the migrations — prod would crash on missing columns; I sequence that.

## 6. Rollback (if relevant)
Nothing to undo — this is forward provisioning, not a destructive change. Every merged PR is a true merge
commit on `main` and individually revertable; no production state has been altered (the deploys have been
failing, so prod is unchanged). The migrations (`0036–0039`, rumah-admin reliability) each ship a `down/`.

## 7. Resume the next autonomous phase
Paste this one line (after doing §5 steps 1–2) to start the next autonomous segment — it picks up exactly where I stopped:

```
/goal resume FAP-platform-hardening-v6
```
