---
kuId: ku-attribute-contribution-by-commit-diff-not-lifetime
title: Attribute who did the work by the commit's diff, not by lifetime file weight — a confidently-wrong metric is worse than none
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "To measure who performed a unit of work, attribute by the CHANGE — the diff lines/char-weight introduced in that commit/slice — not by lifetime whole-file weight, because lifetime attribution credits whoever created or last touched the file regardless of who did this work; and because a confidently-wrong attribution metric is worse than none (it launders a false credit into a trusted number), it must be scoped to the change and stamped with what it actually measures."
triggers:
  - "who did this work"
  - "how do I attribute contribution"
  - "measure contribution by file or by diff"
  - "the metric credited whoever created the file"
  - "lifetime file weight vs commit diff"
  - "ownership contribution percentage"
  - "is this contribution metric trustworthy"
  - "char-weight volume proxy"
  - "who owns this slice's build"
topics:
  - attribute-contribution-by-commit-diff
  - lifetime-weight-is-wrong-attribution
  - scope-the-metric-to-the-change
  - confidently-wrong-metric-worse-than-none
  - stamp-what-the-metric-measures
  - contribution-volume-proxy
evidence-strength: runtime-evidenced
cited-quote: "Contribution % is a VOLUME proxy — the char-weight of each mutation … on these exact files, NOT a measure of effort or correctness."
source-provenance:
  earned-from: "ownership-contribution slice (G14 ownership-gate) 2026-06-15 — contribution measured per-commit diff, not lifetime file weight"
  source-file: "../rumah-admin/docs/slices/SLICE-ownership-contribution.md"
  anchor: "Ownership Gate caveat (line 291, char-weight of each mutation on these exact files); Build Ownership caveat (line 276, Contribution % is a VOLUME proxy); VERIFY-ownership-contribution.md case #7 real commit ed11f6c (2% token owner → FAIL)"
  signal-pattern: null
related:
  - ku-specialist-ownership-requires-enforcement
  - ku-injection-is-not-adoption
  - ku-record-only-state-the-action-achieved
tags: [metric, attribution, contribution, ownership, diff-not-lifetime, goodhart, honest-measurement]
---

# Attribute work by the commit's diff, not lifetime file weight — a confidently-wrong metric is worse than none

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** To measure who actually *did* a unit of work, attribute by the **change** — the diff
lines / char-weight a commit (or slice) introduced — not by **lifetime whole-file weight**. Lifetime
attribution credits whoever created or last rewrote the file, regardless of who performed *this* work. The
metric must be scoped to the change and honestly stamped with what it measures:

> Contribution % is a VOLUME proxy — the char-weight of each mutation … on these exact files, NOT a measure of effort or correctness.

And because a *confidently-wrong* attribution metric is worse than no metric — it launders a false credit into
a trusted number that decisions are then made on — getting the scope right is load-bearing.

**Why (the non-obvious reason).** Lifetime/whole-file attribution feels more "complete": sum up who owns the
bytes of the file and you get a tidy ownership percentage. But "who owns the file's current bytes" answers a
different question than "who did this work" — a specialist can make the substantive change of a slice (the
new logic, the real diff) inside a file that someone else originally authored, and a lifetime metric will
credit the *original author* while the real contributor reads as ~0%. The error is invisible because the
number looks authoritative: a precise percentage carries false confidence, and once it is on a dashboard or
feeding a gate, it is *believed* — a wrong attribution is now a trusted fact that misroutes credit, hides an
idle specialist behind an inherited file, or passes a token one-line touch as ownership. That is why a
confidently-wrong metric is *worse* than none: no-metric prompts a human to look; wrong-metric suppresses the
look. The non-obvious move is to measure the **delta this work introduced**, and to *label the metric as a
volume proxy* so nobody mistakes byte-weight for effort or correctness.

**How to apply (domain-stripped, reusable).**
1. **Scope attribution to the change, not the artifact.** Compute contribution from the diff of *this*
   commit/slice (lines or char-weight introduced on the touched files in that change), never from the lifetime
   composition of the whole file. "Who wrote the bytes currently in the file" is the wrong denominator.
2. **Attribute per-commit / per-author-of-the-change.** Tie the weight to the author of the mutation in that
   commit (e.g. the agent/owner who emitted the Write/Edit), so the credit follows the work, not the file's
   origin.
3. **Stamp the metric with exactly what it measures — and what it does NOT.** Label it a VOLUME PROXY
   (char/line weight), explicitly "NOT a measure of effort or correctness." A token-sized touch must read as
   token (e.g. FAIL TOKEN-CONTRIBUTION), never as ownership.
4. **Prefer no number over a confidently-wrong one.** If the change can't be cleanly attributed, report
   UNMEASURED rather than a precise-but-false percentage. A trusted wrong number propagates; an honest
   UNMEASURED invites a human check.

**The test for any contribution / ownership metric.** Ask: *"if a specialist makes the real change inside a
file someone else created, does this metric credit the specialist (correct) or the original author (wrong)?"*
If it credits the file's creator, it is measuring lifetime composition, not this work — a confidently-wrong
attribution. Lifetime-weight masquerading as contribution is the failure mode this unit exists to prevent.

**Runtime evidence anchor (the load-bearing instance).** The G14 ownership-gate computes Contribution % from
the **char-weight of each mutation on the exact files changed in the slice** — explicitly stamped "NOT a
measure of effort or correctness." Its independent verification drove the load-bearing case on REAL commits
the author did not pick: commit `ed11f6c` showed a ~2% token owner → **FAIL TOKEN-CONTRIBUTION** (not a false
PASS), and `44f4f59` flagged a wrong-owner at 0% — proving the metric credits the change, not the file. An
earlier framing that weighed lifetime file char-weight would have credited "whoever created the file," which
is the precise confidently-wrong attribution this unit warns against.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the ownership-contribution
slice + its independent verification, which STAY as the detailed source:
`../rumah-admin/docs/slices/SLICE-ownership-contribution.md` (the Ownership Gate + Build Ownership caveats:
"Contribution % is a VOLUME proxy — the char-weight of each mutation on these exact files, NOT a measure of
effort or correctness") and `../rumah-admin/docs/verify/VERIFY-ownership-contribution.md` (the real-commit
token-owner → FAIL cases #7/#8). The principle it encodes — measure the diff of the change, not the lifetime
of the file — is the canonical home for the broader Founder-OS lesson. This KU is the retrievable distilled
form; the slice/verify docs are preserved, not replaced.
