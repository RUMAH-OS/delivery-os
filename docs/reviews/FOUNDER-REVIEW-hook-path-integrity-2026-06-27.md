---
review: founder
date: 2026-06-27
change: "hook-path integrity fix + a guard that makes a broken Founder Action Package impossible to ship again (commit 778f51f)"
reviewer: "founder (or named delegate) — NOT the author of the change"
review_path: "LOCAL (one-command harness — no deploy, nothing touches production)"
pass_fail: PENDING
verdict: "GO pending founder tick — the break is fixed and a permanent guard is in place"
---

# Founder Review — Founder Action Package fix (and a guard so it can't break again)

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). The zero-technical-knowledge
> package you can act on alone. Implementation detail (diffs, file paths, CI) stays OUT of this doc.

## What changed (in plain language)

One of the framework's own tools — the **Founder Action Package** (the thing that produces the plain-language
"here's what needs YOU" hand-off) — was quietly broken. When you ran it, instead of doing its job it stopped
with a "file not found" error. The work it depends on was never actually missing; the tool was just **pointing
at the wrong place** for its own helpers — like a correct phone number dialled with the wrong area code.

Two things were done:

1. **The pointer was fixed** so the tool finds its helpers and runs cleanly again.
2. **A permanent guard was added** that automatically checks, before anything can be shipped, that every one
   of these tools actually points at something real and can run. If a tool ever points at the wrong place
   again, shipping is **blocked on the spot** — this exact kind of break can no longer reach you.

Nothing here touches customers, money, or production. This is the framework keeping its own house in order.

## The links to open

No reviewable web surface — this is an internal framework tool, not a website or app. The "proof it works" is
a one-command check you (or a delegate) can run locally, below. No deploy, no production.

## Click-by-click

1. Open a terminal in the `delivery-os` folder.
2. Run the check command: `node scripts/check-hook-paths.mjs`
   → you should see: **`check-hook-paths: 34 reference(s) — 0 broken — PASSED`** and it exits cleanly.
3. (Optional) Run the guard's own self-test: `node scripts/check-hook-paths.mjs --self-test`
   → you should see it confirm it **catches** a deliberately-broken pointer (so you know the guard really bites).

If you would rather not touch a terminal: the same two commands were already run by an independent checker and
recorded as PASS in the verification report — you can simply tick the box below on that basis.

## ✅ Pass / ❌ Fail checklist

- [ ] The Founder Action Package no longer errors out — it runs cleanly.
- [ ] The live check reports **34 references, 0 broken, PASSED**.
- [ ] The guard's self-test confirms it **catches** a broken pointer (it isn't a rubber stamp).
- [ ] I understand a misreferenced tool can no longer be shipped — shipping is blocked automatically if one is.

## What still needs YOU

Nothing further to build or deploy. The only action is your **review tick** above (or a delegate's), which
ratifies this change and lets it merge. There is no production step, no migration, and no customer impact.

## Reviewer attestation (anti-rubber-stamp)

- [ ] I am the founder (or named delegate) and I am NOT the author of this change.
- [ ] I actually ran the check / read the recorded PASS — this is not a sign-off from memory.
