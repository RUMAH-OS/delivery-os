---
review: founder
date: "2026-06-27"
change: "Infrastructure Platform milestone — config-doctor + registry + fail-closed config-gate, health/rollback/diagnostics layer, infra inventory + drift register, A-to-Z e2e verification"
reviewer: "PENDING — the FOUNDER signs (NOT the author of the milestone)"
review_path: "LOCAL (read-only artifacts + self-tests) — no prod, no deploy"
pass_fail: "PENDING"
---

# Founder Review — Infrastructure Platform

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). The zero-technical-knowledge
> package you can act on alone. Implementation detail stays out. **Status PENDING — this is yours to sign.**
> The author does not pass this. NO production was touched; nothing here changes prod.

## What changed (in plain language)

Last time a deploy went wrong, you found out about the problems **one at a time** — fix one, the build fails
again on the next hidden problem, fix that, it fails on the next. Four separate failures, hours apart, before
the real one (a missing database address) finally showed up. That is the experience this milestone is built to
end.

We built a **config doctor**: one checklist of exactly what each app needs to run (the "registry"), and a
**gate** that runs BEFORE a build and tells you **every missing or broken setting at once**, instead of
drip-feeding them. It already proved itself: on one app it **refused the build and listed all 4 missing keys
together** — the opposite of the old one-at-a-time pain.

We also added **health checks, a rollback helper, and a post-deploy verifier** (so a bad deploy can be spotted
and undone), and we did a **full inventory** of where everything actually lives. The inventory found a few
things worth your eyes (below). Finally, an **independent tester walked the whole system end-to-end** without
touching prod and confirmed the workflow logic works.

## The links to open

This milestone is read-only artifacts + local self-tests — there is **no live web surface to click** (no
deploy was performed; that is intentional). The reviewable surfaces are the documents in this PR:
- The drift inventory: `docs/audits/INFRASTRUCTURE-INVENTORY-2026-06-27.md`
- The end-to-end test report: `docs/verify/E2E-WORKFLOW-VERIFICATION-2026-06-27.md`
- This milestone's lessons + capability ledger: `docs/reviews/LEARNING-REVIEW-infrastructure-platform-2026-06-27.md`
- The cutover action package (in the app repo): `FAP-infra-config-cutover.md`

## Click-by-click (read-only)

1. Open the **inventory** → see the "Top findings (TL;DR)" → you should see the **pooler inversion**, the
   **Vercel team-vs-personal scope** note, and the **direct-host gap** clearly listed with plain rationale.
2. Open the **e2e report** → "OVERALL VERDICT" → you should see **workflow logic PASS** and **4 tracked
   conditions** (3 are test-housekeeping; 1 — BUG-4 — is the config-doctor "not yet on the deploy branch").
3. Open the **FAP** (cutover package) → you should see the short list of **one-time actions only you can do**
   (set the real database address, confirm the Vercel project, confirm the app's plan vs the 5-minute timer).

## ✅ Pass / ❌ Fail checklist

- [ ] The config-gate listing **all missing keys at once** is what I want as the standard (no more one-at-a-time).
- [ ] I accept the **pooler difference between the two apps is deliberate and correct** (recorded, not "fixed").
- [ ] I understand **BUG-4**: the config-doctor must be **merged onto the branch that deploys** before I rely on it in prod.
- [ ] I have noted the **three things that need me** (below) and will action them at cutover time.

## What still needs YOU (the real one-time actions — do these at cutover, not now)

1. **Confirm the Vercel project is the TEAM one** ("Ruma Housing" `team_1CST…`), not the personal one — two
   docs still name the personal scope, and setting a secret on the wrong project leaves prod broken.
2. **Set the real `DATABASE_URL`** on the correct project (the genuinely-missing required secret from the saga).
3. **Confirm the app's Vercel plan** — the Admin 5-minute heartbeat timer needs the Pro plan; on the free plan
   it only runs once a day.

(These are listed in full, with the exact steps, in `FAP-infra-config-cutover.md`. Nothing here is automatable
— that is why it waits for you. Do NOT do them as part of approving this review; approving just confirms the
capability is what you want.)

## Reviewer attestation (anti-rubber-stamp)
- [ ] I am the founder (or named delegate) and I am NOT the author of this milestone.
- [ ] I actually opened the documents / read the verdicts above — this is not a sign-off from memory.
