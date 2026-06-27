---
review: founder
date: "2026-06-27"
change: "config-doctor TEMPLATE sensitive-env false-negative fix (port of merged PLOS PR #205) — branch fix/config-doctor-sensitive-env"
reviewer: "PENDING — the founder (Brian) has not yet run this review"
review_path: "LOCAL (one-command self-test harness — no deploy, no credentials needed)"
pass_fail: "PENDING"
---

# Founder Review — config-doctor TEMPLATE sensitive-env fix

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). The zero-technical-knowledge
> package the FOUNDER can act on alone. This is the manual-template fallback. PENDING until the founder runs it.

## What changed (in plain language)
The "config doctor" is the little tool that checks, before a deploy, whether all the required settings
(database URL, secret keys, etc.) are actually in place — so a deploy fails with a clear list instead of a
cryptic crash. There was a bug in the MASTER COPY of that tool (the template every new project is built from):
it asked Vercel "is this secret set?" and treated Vercel's answer of "I won't show you the value" as if the
secret were MISSING. So real, correctly-set secrets (like the database URL) were being falsely reported as
absent. PLOS already found and fixed this in its own copy (PR #205, already merged). This change copies that
exact, already-reviewed fix into the master template, so no future project inherits the bug.

## The links to open
No web link to open — this is a command-line tool, and the fastest founder-verifiable check is one command
(no deploy, no secrets, no accounts). Run it from the `delivery-os` folder:

```
node templates/tools/config-doctor.mjs --self-test
```

## Click-by-click
1. Open a terminal in the `delivery-os` project folder.
2. Run the command above.
3. You should see a list of checks, each with a `✓`, ending in `self-test: 20/20 passed.`
4. Specifically look for these four lines (the bug this change fixes):
   - `✓ sensitive var (value omitted as '') is PRESENT, not blank`
   - `✓ encrypted var with ciphertext value is PRESENT, not blank`
   - `✓ non-sensitive var with empty value IS blank`
   - `✓ sensitive flag is carried through`

## ✅ Pass / ❌ Fail checklist
- [ ] The command prints `self-test: 20/20 passed.`
- [ ] The four "sensitive/blank" lines above are present and show `✓`.
- [ ] (Optional, technical) The template now matches the merged PLOS fix in
      `property-lead-os/infra/config-doctor.mjs`.

## What still needs YOU
Two real one-time founder actions:
1. Run the one command above and tick the checklist (this is the founder verification).
2. This change ships as a PR with `NO merge` — the merge into `main` is a founder decision after an
   INDEPENDENT QA verifier has produced a passing `VERIFY-config-doctor.md` (the author cannot self-verify).
   Nothing here touches production.

## Reviewer attestation (anti-rubber-stamp)
- [ ] I am the founder (or named delegate) and I am NOT the author of this change.
- [ ] I actually ran the command / ran the checklist above — this is not a sign-off from memory.
