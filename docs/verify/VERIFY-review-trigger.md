---
verify_status: verified
slice: review-triggering capability (ADR-003 L2 made binding — the three-review gate)
author: review-trigger agent
verifier: independent-qa
date: 2026-06-26
machine_probe: node templates/tools/learning-trigger.mjs --self-test && node templates/tools/review-trigger.mjs --self-test && node .claude/tools/review-trigger.mjs --self-test
---

# VERIFY — Review-Class Trigger (capability/architecture/integration auto-triggers the three reviews)

Independent QA (author ≠ verifier). I did NOT author this capability. All evidence below was
**executed**, not read. The gate was driven end-to-end against an **isolated throwaway git repo**
(`_gatefix`, since removed) carrying byte-copies of the real tools + config, so real commits and real
`git show <tip>:<path>` tree reads exercised the live code paths.

**VERDICT: VERIFIED.** The classifier is correct, the detector blocks/passes correctly, the live gate
hard-blocks an L2-missing-reviews push (exit 1) and passes bug-fixes (exit 0), and the anti-rubber-stamp
floor rejects stale / empty-shell / unfilled-template artifacts. One documented honest limit (a
structurally-valid but vacuous review passes — the same §12 limit) and one design observation (posture
coupling in the v4 templates copy) are recorded below; neither blocks the verdict.

## Files under verification
- `templates/tools/learning-trigger.mjs` (classifier — new L2 markers: class-C, integration, workflow)
- `templates/tools/review-trigger.mjs` + `.claude/tools/review-trigger.mjs` (fail-closed detector; **byte-identical** — `diff -q` = IDENTICAL)
- `.claude/hooks/verify-gate.mjs` + `templates/hooks/verify-gate.mjs` (both wire the review-trigger block)
- `templates/{FOUNDATION,FOUNDER,LEARNING}-REVIEW.md.template`, `core/GOVERNANCE.md` §14, `docs/adr/ADR-003-learning-review.md`

---

## 1. Classifier correctness — EXECUTED

`node templates/tools/learning-trigger.mjs --self-test` → **PASS, exit 0** (incident→L2, founder_verifiable→L1,
plain refactor→L0, backstop>N→L2, fail-safe→L2, plus the new class-C/integration/workflow proofs).

Driving the **pure `level({ changedFiles })`** — the exact shape the gate calls (no live git/backstop
signals, which the CLI otherwise injects) — produced:

| Change-set | Want | Got | Why (reason[0]) |
|---|---|---|---|
| `contracts/admin-plos-seam-v1.mjs` (THE MOTIVATING MISS) | L2 | **L2** | CONSEQUENTIAL — change-classify class C `[deny-list]` |
| `contracts/invoice-delivery-v1.mjs` | L2 | **L2** | class C |
| `packages/seam/fixtures.json` | L2 | **L2** | cross-system integration / seam contract |
| `db/migrations/0042_invoice_lifecycle.sql` (money/SoR) | L2 | **L2** | class C |
| `src/server/billing/invoice.ts` | L2 | **L2** | class C |
| `templates/workflows/promote.yml` | L2 | **L2** | new/changed workflow or lifecycle pack |
| `src/lib/parser.ts` + commitSubject `fix: a regression…` | L1 | **L1** | a defect/regression was filed this slice |
| `src/pages/Dashboard.tsx` (UI tweak) | L1 | **L1** | founder_verifiable=true |
| `src/lib/util.ts` (trivial maintenance, class A) | L0 | **L0** | capture-only |
| `.github/workflows/ci.yml` (routine CI) | L0 | **L0** | capture-only (NOT a workflow-pack marker) |
| `docs/notes.md` + `tests/unit/x.test.ts` | L0 | **L0** | capture-only |

The motivating miss (Admin→PLOS `contracts/admin-plos-seam-v1.mjs`) now classifies **L2** — the recorded
hole is closed. Note: a **bare** `src/lib/parser.ts` path with no defect signal is genuinely class A → L0;
the L1 "regression" classification requires the defect signal (commit subject `fix:`/`regression`, the
`defectFiled` flag, or a `docs/defects/**` path) — all three confirmed → L1. This is correct, not a defect:
L0 and L1 both sit **below** the L2 gate, so either way a bug-fix passes the review-trigger untouched.

## 2. Detector + anti-rubber-stamp — EXECUTED

`node templates/tools/review-trigger.mjs --self-test` → **PASS, exit 0**.
`node .claude/tools/review-trigger.mjs --self-test` → **PASS, exit 0**.

Driven against real commits in the isolated repo (`review-trigger.mjs gate --tip <sha>`):

- **L2 change, NO reviews** (`contracts/admin-plos-seam-v1.mjs`) → **BLOCKED, exit 1**, naming all 3 missing reviews.
- **L2 change, all 3 fresh + well-formed reviews** (Foundation + Founder + Learning, authored from the templates) → **"L2 satisfied", exit 0**.
- **STALE** — reviews present in the tip tree but NOT in the changeset → **BLOCKED, exit 1** (3 missing: "each change asks its own questions").
- **EMPTY SHELL** — a `FOUNDER-REVIEW-shell.md` with no frontmatter, fresh → Founder ✗, **exit 1**.
- **VERBATIM TEMPLATES** — the 3 raw `*.md.template` files copied unfilled (`date: "<YYYY-MM-DD>"` etc.) → **all 3 rejected, exit 1** (the `!/^<.*>$/` placeholder floor fires).

## 3. Gate wiring (the live block) — EXECUTED

Fed the **REAL `.claude/hooks/verify-gate.mjs pre-push`** a git ref line for a range containing the L2
file:

- Range `BASE..TIP` with `contracts/admin-plos-seam-v1.mjs`, no reviews → **HARD-BLOCK, exit 1** (the
  full "BLOCKED by Delivery OS — Review-Class Trigger" message, 3 missing reviews). This is the live wiring
  firing through `verify-gate` → `review-trigger.mjs gate`, not the detector in isolation.
- Bug-fix-only / non-impl range → review-trigger reports `L0`/`L1` "(no full review owed)" and **exit 0**.
- Posture `enforce` confirmed in `.claude/.verify-config.json` (real repo: `{"review_trigger":"enforce"}`).
- Posture flipped to `shadow` → the detector prints "SHADOW (would block; not blocking — ADR-003 posture)"
  and **exit 0** (advisory). `off` short-circuits to exit 0.
- Classifier reuse confirmed: `.claude/tools/review-trigger.mjs` has no sibling classifier, so its
  `loadLevel()` resolves the canonical `templates/tools/learning-trigger.mjs` (printed by `check` mode) —
  it does NOT fork the classifier.

## 4. Templates satisfiable — EXECUTED

Reviews authored from each of the 3 templates with real frontmatter (Foundation: `date`+`verdict`;
Founder: `date`+`reviewer`/`pass_fail`; Learning: `date`+`event`/`triaged_by`) **satisfy** the detector's
`valid(fm)` floor and pass the gate (Test in §2/§3). The templates' own placeholder values
(`<YYYY-MM-DD>`, `<PASS|FAIL>`, …) are correctly rejected until filled (§2 verbatim-template test).

## 5. Reuse-not-fork — VERIFIED

- The detector calls `learning-trigger.level()` (defensive import across install locations), and its
  self-test proves an embedded fallback that fails TOWARD review only when the canonical classifier is
  absent. It mirrors the §14 OS-FEEDBACK review-artifact detector pattern (existence + freshness +
  well-formedness; content stays human judgment) rather than building a parallel gate.
- The `.claude` vs `templates` review-trigger copies are **byte-identical** (`diff -q` = IDENTICAL); both
  verify-gate copies wire the block (`grep -c "REVIEW-CLASS TRIGGER"` = 1 each). Self-install lag noted.

---

## Findings (non-blocking)

**OBS-1 (honest limit, documented).** A **structurally-valid but vacuous** rubber-stamp passes: three
reviews carrying only `date` + a verdict/reviewer field and an empty body → **"L2 satisfied", exit 0**.
This is the same §12 honest limit the code explicitly states ("whether a review is TRUTHFUL … is the same
honest limit §12 states — flagged, not claimed"). The **freshness** requirement raises the cost (a stale
review cannot be reused; the rubber-stamper must author a NEW dated review per change), and the Founder
template carries an author-distinct attestation checkbox — but the gate does **not** mechanically compare
reviewer-to-author. Acceptable and disclosed; recorded so it is not later mistaken for a guarantee.

**OBS-2 (design inconsistency, templates copy only).** In `templates/hooks/verify-gate.mjs` (the v4
advisory-posture copy) every sibling §14 trigger was converted to ref-gated `enforce()` (hard-block
protected refs `dev/main/release/tags`, advisory on feature branches per board 2026-06-25), but the
**review-trigger block alone** uses an unconditional `catch { process.exit(1) }`. It instead relies on its
own `review_trigger` posture switch. Net effect: a feature-branch push of an L2 change with missing reviews
is hard-blocked locally — **stricter** than the surrounding advisory posture (the safe direction for the
founder's fail-closed requirement), so not a correctness defect, but the coupling is worth a deliberate
note. The live `.claude/hooks/` copy hard-blocks the whole pre-push unconditionally, so it is internally
consistent there.

## Verdict

**VERIFIED.** Every acceptance criterion met with executed evidence: the classifier is correct
(L2/L1/L0 as specified, the motivating miss now L2), the detector blocks/passes correctly, the live
`.claude/hooks/verify-gate.mjs pre-push` hard-blocks an L2-missing-reviews push (exit 1) and passes
bug-fixes (exit 0), and the anti-rubber-stamp floor rejects stale, empty-shell, and unfilled-template
artifacts. The two findings are documented limits/observations, not unmet criteria.

---

## Addendum — 2026-06-27 (ENGINEER increment; PENDING independent re-verification)

> Scope note (honest, author≠verifier): the VERIFIED verdict above belongs to independent-qa and covers the
> 2026-06-26 slice (class-C / integration / workflow markers + the binding gate). The increment described here
> — the **`controlplane` L2 marker** + the **regression guard** — was authored by the **engineer**, so the
> evidence below is an **engineer self-check, NOT independent verification**. It is recorded as such and is
> flagged for QA to re-verify. It does **not** extend the independent VERIFIED verdict above.

**The second recorded miss (founder, 2026-06-27).** Significant architectural work ON THE FRAMEWORK fired no
review: the framework's own surfaces matched none of the consumer-app markers. Demonstrated against the pure
`level({ changedFiles })` (the exact shape the gate calls — no live backstop/census signals): `core/GOVERNANCE.md`
→ **L1**, `templates/tools/change-classify.mjs` → **L1**, `proposals/*` → **L1**, and the INSTALLED gate logic
`.claude/tools/learning-trigger.mjs` → **L0** (class A, auto-safe). The fix adds a `controlplane` marker family.

After the fix (re-probed, pure `level`): `core/GOVERNANCE.md` · `core/OPERATING-LOOP.md` · `proposals/*` ·
`templates/tools/change-classify.mjs` · `.claude/tools/learning-trigger.mjs` · `.claude/hooks/verify-gate.mjs`
→ **all L2**; exemptions HOLD: `src/lib/util.ts` → **L0**, `src/pages/Dashboard.tsx` → **L1**,
`apps/web/src/core/util.ts` (a consumer app's own core/) → **L1** (NOT swept in — the marker is repo-anchored).

**Regression guard (the founder's explicit requirement) — EXECUTED.** New `// REGRESSION GUARD (2026-06-27)`
assertions in `learning-trigger.mjs --self-test` (framework surfaces → L2; consumer `src/core/` NOT swept; exemptions
still below L2) and in `review-trigger.mjs --self-test` (embedded fallback fails toward review on `core/`/`proposals/`/
control-plane tools). `node templates/tools/learning-trigger.mjs --self-test`, `node templates/tools/review-trigger.mjs
--self-test`, `node .claude/tools/review-trigger.mjs --self-test`, `node templates/tools/change-classify.mjs --self-test`
→ all **PASS, exit 0**. The two `review-trigger.mjs` copies remain **byte-identical** (`diff` = IDENTICAL).
