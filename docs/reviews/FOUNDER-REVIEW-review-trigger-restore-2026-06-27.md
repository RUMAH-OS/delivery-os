---
review: founder
date: 2026-06-27
change: "Restore reliable auto Foundation/Founder/Learning trigger on significant architectural work (+ a guard so it can't silently break again)"
reviewer: "founder (or named delegate) — NOT the author of the change"
review_path: "LOCAL (one-command self-tests — no deploy, nothing touches production)"
pass_fail: PENDING
verdict: "GO pending founder tick — the regression is fixed and a permanent guard is in place; awaiting your confirmation"
---

# Founder Review — the three reviews fire again on significant architectural work

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Zero-technical-knowledge package.
> Nothing here deploys; nothing touches production. This is a local check you can run in one command.

## What changed (in plain language)
You reported that the three safety reviews (Foundation, Founder, Learning) were no longer reliably triggered when
real architectural work happened. We found the cause: the automatic trigger only recognised *app* changes (billing,
invoices, migrations) as "significant". It did **not** recognise changes to the framework's **own machinery** — the
rulebook (`core/`), the recorded decisions (`proposals/`), and the safety gates themselves. So editing the rules that
govern everything else counted as "small" and asked for no review. We taught the trigger to treat that machinery as
significant, and we added a permanent self-check (a "regression guard") so this exact gap cannot quietly come back.
Small bug-fixes and visual tweaks are unaffected — they still pass without demanding three reviews.

## The links to open
No reviewable web surface — this is an internal safety mechanism, not a user-facing feature. Verify it locally instead
(below). If you prefer, the same checks run automatically in CI on the pull request.

## Click-by-click
1. Open a terminal in `delivery-os` → run `node templates/tools/learning-trigger.mjs --self-test` → you should see
   `--self-test PASS` and an exit with no error.
2. Run `node templates/tools/review-trigger.mjs --self-test` → `--self-test PASS`.
3. (Optional) On the pull request, the "verify" checks run the same self-tests — they should be green.

## ✅ Pass / ❌ Fail checklist
- [ ] Both self-tests print `PASS`.
- [ ] You are satisfied that "significant architectural work now reliably asks for the three reviews, while small
      bug-fixes and UI tweaks do not" is the intended behaviour.

## What still needs YOU
One decision, no action required to merge: the gate can prove the three reviews *exist and are fresh*, but it cannot
prove a review was *actually done thoughtfully* rather than rubber-stamped — that part stays with you and the team.
Nothing else needs you. (The branch is **not** merged and **not** deployed — author ≠ verifier; QA verifies next.)

## Reviewer attestation (anti-rubber-stamp)
- [ ] I am the founder (or named delegate) and I am NOT the author of this change.
- [ ] I actually ran the self-tests above — this is not a sign-off from memory.
</content>
