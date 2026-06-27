---
review: founder
date: "2026-06-27"
change: "Infrastructure Config Platform — the config-doctor + the ONE consolidated Founder Action Package"
reviewer: "PENDING — founder (package prepared by the qa-test landing lens; NOT yet run by the founder)"
review_path: "LOCAL (one command per repo) — least founder effort; no deploy needed to review"
pass_fail: "PENDING"
---

# Founder Review — Infrastructure Config Platform

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). This is the zero-technical-knowledge
> package you (the founder) can act on alone. It was PREPARED during independent verification; it is PENDING until
> you run the checklist. No implementation detail below — only what to open and what to decide.

## What changed (in plain language)
There is now a single, reliable "config doctor" in both apps. Before a deploy, it checks — against the real Vercel
production settings — every secret/setting your apps need, and if anything is missing it tells you EXACTLY what and
where to fix it, instead of the old cryptic build crash. It also replaced the pile of scattered "please set this one
variable" notes with ONE list, grouped by where you click. The doctor proved that PLOS production is missing 8 settings
and rumah-admin is missing 4 — which is why those deploys have been failing.

## The links to open
This review is LOCAL — no website to visit. In a terminal:
- PLOS:        `cd property-lead-os && node infra/config-doctor.mjs --env production`
- rumah-admin: `cd rumah-admin && node infra/config-doctor.mjs --env production`
- The ONE action list: open `delivery-os/docs/goals/FAP-infra-config-cutover.md`

## Click-by-click
1. Run the PLOS command → you should see `RESULT: FAIL — 8 required key(s) MISSING` with a clear FIX line under each.
2. Run the rumah-admin command → you should see `RESULT: FAIL — 4 required key(s) MISSING` with a FIX under each.
3. Open the FAP → section 3 lists every variable grouped by platform, and a bold note names the correct Vercel TEAM
   ("Ruma Housing", `team_1CSTFxqvnOe9lvHtCsPHSeax`) — NOT your personal Vercel.

## ✅ Pass / ❌ Fail checklist
- [ ] The PLOS command prints a clear FAIL with 8 named, fixable items (not a cryptic crash).
- [ ] The rumah-admin command prints a clear FAIL with 4 named, fixable items.
- [ ] The FAP reads as ONE list I can finish per platform in one sitting, and it names the Ruma Housing team Vercel.
- [ ] I understand the single remaining action is mine: enter the production secrets, upgrade the team plan, apply the migrations.

## What still needs YOU
The ONE real action: complete `delivery-os/docs/goals/FAP-infra-config-cutover.md` — enter the production secrets in
the **Ruma Housing team** Vercel projects, upgrade that team to Pro, and apply the prod migrations. Then re-run either
command above (or just re-deploy — the gate runs it for you); a green PASS means the cutover is complete.

## Reviewer attestation (anti-rubber-stamp)
- [ ] I am the founder (or named delegate) and I am NOT the author of this change.
- [ ] I actually opened the links / ran the checklist above — this is not a sign-off from memory.

> Honesty note: the two boxes above are intentionally UNCHECKED. This package was prepared and verified by the
> independent qa-test lens; only the founder may check them. Until then this review is PENDING, not PASS.
