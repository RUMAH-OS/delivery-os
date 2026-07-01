---
review: founder
date: "2026-06-27"
change: "platform DB-preflight hardening — the framework now catches the prod-hang class before deploy"
reviewer: "FOUNDER (pending — not the author)"
review_path: "LOCAL (one command, no app, no secrets)"
pass_fail: "PENDING"
---

# Founder Review — the framework now catches the prod-hang class before deploy

> Zero-technical-knowledge package. No app to run, no secrets, no production access. One command on your
> machine. Implementation detail stays out of this doc.

## What changed (in plain language)
A few weeks ago PLOS in production would sometimes "hang" — the page never loaded (a blank/timeout screen).
The deep cause was a database setting that was missing, plus a sneaky variant where an *empty* setting
silently switched the safety off. We fixed PLOS. This change teaches **the framework itself** to catch that
whole family of problem **before** any future app is deployed — so the next project can't ship the same hang.
It does three things: (1) a one-command **check** that inspects an app's database connection and refuses it
if the safety bound is missing; (2) it writes that safety down as the **standard** every new app inherits;
and (3) when something does go wrong at runtime, it now tells apart "the database is unreachable" from
"the database is fine but a query/queue got stuck" — two problems that look identical but need opposite fixes
(getting that wrong is exactly what nearly cost us another cycle on PLOS).

## The links to open
No links. This is a local command-line check (it does not touch any website or any production system).

## Click-by-click
Open a terminal in the `delivery-os` folder and run, one at a time:

1. `node templates/tools/platform-health.mjs --self-test`
   → you should see a final line like **`platform-health self-test: 46/46 passed.`**
2. `node templates/tools/config-doctor.mjs --self-test`
   → you should see **`self-test: 21/21 passed.`**
3. (Optional, the headline) Point the new check at the *old, broken* PLOS database file and the *fixed* one:
   - old → it should print **`RESULT: FAIL`** with a red ✗ (it caught the bug).
   - fixed → it should print **`RESULT: PASS`** with green ✓ (the standard is met).

## ✅ Pass / ❌ Fail checklist
- [ ] Step 1 ends in `46/46 passed.`
- [ ] Step 2 ends in `21/21 passed.`
- [ ] (Optional) the check FAILS the old database file and PASSES the fixed one.

## What still needs YOU
**Two decisions, when you're ready (nothing is blocked today):**
1. **Ratify this as an active framework capability** (it is built and reviewed; it awaits your go-ahead to be
   the standard every project is held to).
2. **Decide whether the check should BLOCK a deploy** (today it's a tool that must be run; making it a hard
   gate, and adding a runtime self-check that proves the safety is actually *on* — not just written down — is
   the named next step). No action needed to keep things safe now; this is about turning "can be run" into
   "is always run".

## Reviewer attestation (anti-rubber-stamp)
- [ ] I am the founder (or named delegate) and I am NOT the author of this change.
- [ ] I actually ran the commands above — this is not a sign-off from memory.
