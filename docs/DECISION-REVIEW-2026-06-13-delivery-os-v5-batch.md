# DECISION-REVIEW — Delivery OS v5 promotion batch (F2 consolidated §11 ratification)

> §11 consolidated ratification of the v5 promotion batch (`docs/DELIVERY-OS-V5-ADOPTION-PLAN.md`) before it lands
> in the base. **Independence note:** three lenses ran BLIND to each other (lead-architect · reviewer-critic ·
> qa-test/verification), distinct invocations. The batch author (the orchestrator) **does not adjudicate** — this
> consolidation reports the lenses faithfully and surfaces every dissent unsmoothed; **the founder merge-gate
> decides** (§11 + §12 Honest-limit: a single-agent runtime cannot self-certify independence — the founder is the
> real adjudicator).

## Consolidated verdict: **RATIFY-WITH-CONDITIONS**
All three lenses converged: the batch is **sound in shape, real in evidence, and preserves every invariant IN
MECHANISM** — but **A2 (and, lesser, A1/A3) ship a PROSE-only safety bound**, which is precisely the failure class
the OS polices. **Do not land the base changes until conditions C1–C9 are written into the plan/DoD.** No candidate
was rejected; the keystone (A4) is sound. The panel itself caught a defect that, unfixed, would have weakened §12's
*trigger* — the ratification earned its keep.

## Convergence (all three lenses agree)
- **SOUND:** A4 (keystone), A6, BOUNDARY, REPRO — and A6/REPRO **strengthen** verification (they codify the very
  discipline that caught this phase's worst bugs).
- **Every promotion cites a real observed failure** (N17–N22) — the §14 promotion bar is met; no imagined counterfactual.
- **Ruflo rejections R1–R6 are correct** — including witness-manifest-as-verification (rejecting it *defends* §12).
- **A4's hook-deferral is exemplary** — faithful to §13/§14 (policy now; hook only when an observed skip earns it,
  the way §12 was earned). No candidate is wrongly proposed as a mechanism; none should be a mechanism now.
- **The rubric-blind gate is the structural safety** (qa verified at the byte level: `verify-gate.mjs` fires on
  `isImpl(f) && !NONIMPL.test(f)` with zero knowledge of the trivial/load-bearing rubric — so A1/A2 cannot, by
  construction, suppress the gate on implementation-file changes).

## Dissents & conditions (surfaced unsmoothed)

**C1 — A2 (BLOCKER; raised by qa + reviewer-critic, CONCERN by architect).** A2's self-check rests on a **false
claim**: that the gate's non-impl exemption "already contemplates" the relaxed set. It does not — **tiny-UI lands
in `src/`/`app/` so the gate FIRES on it**, and **tests-only was HARDENED by §12 link 3** (the test tree is a
boundary, not a free zone — incident 8). A2 introduces a *new policy axis* (rigor-by-risk-class), it does not
inherit an existing exemption. Required before A2 operates:
  - (a) **Fix the false exemption claim**; state A2 as a new axis layered on §3/§12.
  - (b) **A2 only ADDS rigor above the gate floor, never subtracts below it** — a "trivial" slice **still produces
    a fresh, passing, independent VERIFY**; A2 changes *who/how-much*, **never whether**.
  - (c) **Down-classification is second-lens-confirmed + recorded in the VERIFY artifact + fail-closed-by-default**
    (contested ⇒ defaults UP to full verification) — inheriting the DoD "Lightweight vs full" precedent
    (the "it's just scaffolding" declaration is itself author≠verifier-gated; earned by the Slice-1.0 failure).
    **tests-only RETAINS author≠verifier.**
  - (d) **Parallel-batching = distinct non-author verifier invocations, no author/verifier context collapse, no
    cross-verifier anchoring** (§11 blind; §12 no-VCS fallback).

**C2 — A1 (Should-fix).** "Anything touching impl files still trips the gate" is true **only inside the gate regex**
(`src/ app/ lib/ api/ migrations/ db/` + `impl_extra`). Define "mechanical" **closed** (rename/move, formatting,
comment/doc text, codemods whose full diff a human reads); **exclude** edits to `.verify-config.json`,
`.claude/settings.json`, gate/hook scripts, CODEOWNERS, and multi-file codemods (kernel-adjacent or scope-broad →
keep a verifier).

**C3 — A4 single canonical home (Should-fix; the irony condition).** A4 currently lands in 4 places (§15 +
audit-before-assume + skill + DoD) with no named source-of-truth — a §7 drift risk inside a *contract-grounding*
candidate. **Name ONE canonical home** (the normative clause "a contract existing ≠ a contract read" in §15); make
the loop step, the skill, and the DoD line **pointers/operationalizations** of it.

**C4 — A6 (Should-fix).** The clean-frontmatter fix is a **KERNEL change** (the `verify_status` parser, §13), not
just a checklist. Label it as such and add **parser-side tolerance** (strip a trailing `# …`) — defense-in-depth,
because "please write clean frontmatter" is prose and §15 says the durable fix is in the program.

**C5 — A3 (Should-fix; G5).** The token/cost instrument is **read-only telemetry — never a gate/DoD/verify_status
input**; "cheaper" is never an acceptance criterion. Keep it a flat counter; **register it in the instruments-audit
cadence / `gates.md`** so it fails honestly if it stops being written (else it becomes the dormant-capture class the
instruments-audit beat exists to catch). Cost may steer A1/A2 *classification*; it may **never** steer *whether a
required independent pass runs*.

**C6 — A5 orphaned (Should-fix).** A5 (engineer→verifier handoff) appears in the case-study + phasing but has **no
candidate card** — an unmapped lesson (F2: an unmapped lesson blocks the merge). **Give it a card or explicitly
defer it** in the ledger.

**C7 — composition floor (architect; Should-fix).** A1 + A2 + slice-batching stack toward fewer independent passes.
Add a floor: **any batch that, in aggregate, touches a load-bearing/cross-system/schema/money/PII surface gets a
full independent pass regardless of how its sub-slices were classified.** No candidate currently owns this seam.

**C8 — doc-integrity (qa; Should-fix).** The plan references `skills/verification-playbook/`; disk has
`skills/verification/`. Resolve target paths before merge (a promotion naming a non-existent target is the §7 drift
class). (`case-studies/2026-06-incident-ledger.md` confirmed to exist.)

**C9 — F2 mechanization gap (architect; note).** "An unmapped lesson blocks the merge" is currently prose. Name it
a **human-verifier responsibility in the §11 consolidation step** so it doesn't drift on the next batch.

## What this means for implementation
RATIFY-WITH-CONDITIONS = the batch's **shape and evidence are approved**; before any base file changes the plan +
DoD must be revised to fold in C1–C9 (C1 is the blocker — it closes the one place §12's trigger could be quietly
weakened). Then: implement the (conditioned) promotions → `CHANGELOG-v5` + tag (F1) → consumers adopt by pin.
**No kernel mechanism is removed or weakened by the conditioned batch** — A2 becomes "adds rigor, fail-closed
down-classification," strictly stronger than the prose version.

## Founder merge-gate decision (sign-off required)
The panel informs; you decide. Recommended: **approve RATIFY-WITH-CONDITIONS** — I fold C1–C9 into the adoption
plan + DoD, then implement the conditioned batch and cut v5. (Lenses: architect = READY-WITH-CONDITIONS;
reviewer-critic = RATIFY-WITH-CONDITIONS, C1 blocker; qa = preserved-or-strengthened *conditional on G1–G5*.)
