---
review: founder
date: "2026-06-27"
change: "platform-health — the runtime health / diagnostics / rollback / self-healing layer of the Infrastructure Platform"
reviewer: "FOUNDER (pending — this package is prepared by the build agent for the founder to run; the author is NOT the reviewer)"
review_path: "LOCAL (one-command self-tests) now · PROD health endpoints after the per-app PRs deploy"
pass_fail: "PENDING"
---

# Founder Review — platform-health layer

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). The zero-technical-knowledge
> package you can act on alone. Implementation detail stays out; this is what changed, how to see it, and
> what (if anything) needs you.

## What changed (in plain language)
Your apps already had a "checklist before deploy" (config-doctor — it tells you exactly which settings are
missing before a deploy can even start). This change adds the OTHER half: the part that watches the apps
**while they are running**.

Three new things, shared across every app:
1. **One health page per app** (`/api/health/platform`) — a single report that checks the database, the
   background engine (heartbeat), the event queue, and the discovery pipeline, and gives ONE answer:
   healthy, degraded, or down. The same format for every app, so one dashboard can watch them all.
2. **A "why is it stuck?" answer.** Instead of a workflow silently stopping, you get a named cause —
   "database unreachable", "missing setting" (it points you back to the config checklist), "queue stuck",
   "engine heartbeat stopped", "an outside service failed" — plus the next thing to do.
3. **A rollback path.** If a deploy goes bad, one read-only command tells you the last deploy that WAS
   working and the exact command to switch back to it (it never switches for you — you stay in control),
   plus a written runbook.
4. **A post-deploy check** that runs after a deploy and raises an alarm if the app came up unhealthy —
   and confirms the system healed itself after an interruption.

Nothing here touches production data or secrets, and nothing deploys on its own.

## The links to open
- No production URL yet — this is the reusable engine + the per-app wiring, opened as PRs (NOT merged,
  NOT deployed). The live `/api/health/platform` URLs go live only after you approve the per-app PRs.
- To see it work locally right now (one command, no setup):
  `node templates/tools/platform-health.mjs --self-test`

## Click-by-click
1. Run `node templates/tools/platform-health.mjs --self-test` → you should see `30/30 passed`, including
   lines proving a failure is NEVER silent and a missing-setting fault is handed back to the config checklist.
2. Run `node templates/tools/rollback-helper.mjs --self-test` → `7/7 passed` (it correctly picks the last
   working deploy and refuses to count a broken one).
3. Run `node templates/tools/post-deploy-verify.mjs --self-test` → `10/10 passed` (a "down" app raises an alarm).

## ✅ Pass / ❌ Fail checklist
- [ ] The three self-tests above all pass on your machine.
- [ ] You agree every app reporting health in the SAME format (so one dashboard sees all of them) is what you want.
- [ ] You agree rollback stays a manual command you run (the tool never switches production by itself).

## What still needs YOU
- **Nothing to deploy now.** When you are ready, approving the three per-app PRs (delivery-os, PLOS,
  rumah-admin) wires the health endpoints and the post-deploy check into each app. Deploy stays gated on you.
- For the post-deploy rollback tool to read your Vercel deploys, it uses the SAME read-only Vercel token the
  deploy already uses — no new secret from you.

## Reviewer attestation (anti-rubber-stamp)
- [ ] I am the founder (or named delegate) and I am NOT the author of this change.
- [ ] I actually ran the three self-tests / opened the links above — this is not a sign-off from memory.
