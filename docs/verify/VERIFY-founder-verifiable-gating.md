---
slice: "founder-verifiable-gating — Founder Review fires only on founder-verifiable changes"
verify_status: verified
author: "canonicalization-agents"
verifier: "independent-qa-subagent"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"   # the QA subagent did NOT author the change; it ran the probes on the uncommitted tree
machine_probe: "node templates/tools/change-classify.mjs --self-test"
test_pins_amended_by: "independent-qa-subagent — the change-classify.mjs self-test (the in-file test surface) was authored by the canonicalization agent; QA verified, did not amend"
---

# VERIFY — Slice founder-verifiable-gating

## Verdict
**verify_status:** `verified`  ·  one line: the classifier self-test passes (exit 0), Class C (the safety floor) is provably UNCHANGED (only an orthogonal `founder_verifiable` field was ADDED), the package generator is fail-closed (self-test exit 0, no fabricated urls/steps/screenshots), the workflow gate is fail-closed, and all six docs state the same rule without overturning the deferred D3.
> A verdict of `verified` is permitted ONLY if every acceptance criterion PASSes on its OWN surface, every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and the verifier was a REAL distinct lens from the author.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: independent-qa-subagent · distinct QA invocation · 2026-06-25 · ran probes against the UNCOMMITTED working tree on branch `feat/sdlc-release-smoke-cap`
- Author identity (code under test): canonicalization-agents (three agents made the uncommitted changes)
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation; the QA lens executed each tool and read each diff, it did not write the change).

## Execution evidence  (Governance §1 — direct runtime output, never a description)
| # | Command | Exit | Output (verbatim / log path) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/change-classify.mjs --self-test` | 0 | `change-classify --self-test PASS — fail-safe + C-wins + A-opt-in proofs:` … incl. `[founder-verifiable] src/pages/Dashboard.tsx -> founder_verifiable=true`, `[founder-verifiable] src/api/users.ts -> founder_verifiable=false`, `[founder-verifiable] src/pages/Pricing.tsx -> founder_verifiable=true + class=C (ORTHOGONAL: both gates fire)`, and the PRE-EXISTING `[C-wins/keyword]`, `[C-wins/control]`, `[A-optin/clean]`, `[A-optin/proof]`, `[oversize->B]`, `[novel->B]`, `[visible->B]`, `[ambiguous->B]`, `[parse-err->B]` lines |
| 2 | `node templates/tools/change-classify.mjs --founder-verifiable --files src/components/Button.tsx` | 0 | stderr `founder_verifiable=true: founder-facing surface(s) touched: src/components/Button.tsx`; stdout `true` |
| 3 | `node templates/tools/change-classify.mjs --founder-verifiable --files src/api/users.ts` | 0 | stderr `founder_verifiable=false: not founder-verifiable: no founder-facing surface (UI/email/public) touched`; stdout `false` |
| 4 | `git diff HEAD -- templates/tools/change-classify.mjs` | 0 | diff is purely ADDITIVE: a `founder_verifiable`/`founder_verifiable_why` block + its presence on the `mk()` return + new self-test assertions + the `--founder-verifiable` CLI flag. The A/B/C routing (classify() steps 1–5) and the `controlPlaneC`/`denyC`/`keywordsC`/`visibleB`/`reviewB`/`autoA` tables are UNCHANGED. |
| 5 | `node --check templates/tools/founder-review-package.mjs` · `node --check .claude/tools/founder-review-package.mjs` · `node --check templates/tools/founder-review-env.mjs` | 0 | `pkg-template OK` · `pkg-claude OK` · `env OK` |
| 6 | `diff templates/tools/founder-review-package.mjs .claude/tools/founder-review-package.mjs` ; `sha256sum` both | 0 | `IDENTICAL (diff empty)`; both `423515e4fcfeb448c42b7e494c6d6a637c9f0f55af231f346e0daaf7ca90fccd` |
| 7 | `node templates/tools/founder-review-package.mjs --self-test` | 0 | `founder-review-package --self-test PASS — the simplest review path is CHOSEN for the founder … REAL urls … never a placeholder link; the business summary, click-by-click and explicit ✅/❌ checklist are engineer-SEEDED … NEVER invented … --post step is gated …` |
| 8 | `node templates/tools/founder-review-env.mjs --self-test` | 3 | `[founder:review] FAIL-CLOSED: this project has no .delivery-os/founder-review.json — it needs one to enable local review. Falling back to DEV (no local URLs printed; none are fabricated).` — fail-closed by design (non-zero, honest, no fabrication) |

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence (→ cmd #) | PASS/FAIL |
|---|-----------|-------------------|--------------------|-----------|
| 1 | Classifier self-test PASS; `.tsx`→`founder_verifiable=true`; `api/*`/`migrations/`→`false`; pricing `.tsx`→`true` AND `class=C`; pre-existing A/B/C + fail-closed self-tests still pass; CLI seam emits clean `true`/`false` | `node` runtime, the classifier + its in-file self-test + the `--founder-verifiable` CLI | #1, #2, #3 | PASS |
| 2 | Safety floor intact — `founder_verifiable` did NOT relax Class C; migrations/auth/money/contracts/control-plane still C; no C change auto-continues; diff shows only an ADDED orthogonal field | the git diff of change-classify.mjs + the C-asserting self-test rows (migration→C, payment→C, prompt→C, env→C, CODEOWNERS→C, keyword→C, pricing-tsx→C, parse-err-does-not-suppress-C) | #1, #4 | PASS |
| 3 | Package generator — both copies `node --check`-clean AND byte-identical; env tool `--check`-clean; spec implemented (business summary, exact URLs, local-or-DEV choice, click-by-click, pass/fail checklist, real-or-N/A screenshots, rollback-if-relevant, links-only-for-real-actions, impl hidden) and FAIL-CLOSED (no fabricated urls/steps/screenshots) | `node --check`, `diff`, `sha256sum`, the generator self-test, source + SKILL.md read | #5, #6, #7, #8 | PASS |
| 4 | Workflow gating — founder-review-package step gated `if: …founder_verifiable == 'true'`; classify runs first; FAIL-CLOSED (classify error/missing/unexpected → founder_verifiable=true / review); valid YAML | read of `templates/workflows/dev-preview.yml` | (read) | PASS |
| 5 | Docs consistency — CANONICAL-SDLC §2a, ADR-001 (2026-06-25 refinement), DECISIONS D6, GOVERNANCE §16, GOAL-EXECUTION-CONTRACT, CLAUDE.md.template state the SAME rule; do NOT overturn deferred D3; template's derived §5/§6/§9 NOT hand-edited | diffs of all six docs | #4-class (D3) + doc diffs | PASS |

## Surface statement  (anti-Slice-1.0)
- The slice's real surface: the `change-classify.mjs` classifier (a pure function + CLI), the `founder-review-package.mjs`/`founder-review-env.mjs` generators (run under `node`), the `dev-preview.yml` CI gate, and six governance docs. Driven by: actually EXECUTING each tool (self-tests, `node --check`, the `--founder-verifiable` CLI, `diff`/`sha256sum`) and READING each diff/file — not paraphrasing.
- [x] No criterion was "verified" via a surface that bypasses the slice: the classifier was RUN (not just read) for criteria 1–2; the generators were RUN for criterion 3; the byte-identity was proven by `diff`+`sha256sum`.

## Classified open assumptions
| Claim | Confirmed / Evidence-backed / Assumption / Unverified / Failed | Severity |
|-------|---------------------------------------------------------------|----------|
| The classifier self-test passes (machine_probe) | Confirmed (cmd #1, exit 0) | Blocker (the gate re-runs it) |
| Class C is unchanged — only an orthogonal field was added | Confirmed (cmd #4 diff + the C-asserting self-test rows in #1) | Blocker |
| The package generator never fabricates urls/steps/screenshots/checklist (fail-closed) | Confirmed (cmd #7 self-test pins mode-none/no-stub/no-checklist fail-closed; cmd #8 env tool fails closed) | Blocker |
| Both generator copies are byte-identical | Confirmed (cmd #6 empty diff + matching sha256) | Should-fix (drift would break inheritance) |
| The CI gate is fail-closed (classify error/missing/unexpected → review) | Evidence-backed (dev-preview.yml lines 149–177: three fallbacks all write `founder_verifiable=true`) | Should-fix |
| Docs do not overturn the deferred D3 auto-merge | Confirmed (ADR-001 explicitly: "does not overturn the deferred D3 auto-merge … the D3 auto-merge stays DEFERRED"; DECISIONS D3 row unchanged; the new D6 row is additive) | Should-fix |
| The template's auto-rendered §5/§6/§9 derived sections were NOT hand-edited | Confirmed (the only template hunk adds one pointer row to the hand-authored Sources-of-Truth table, between §6 and §9 — not inside a derived section) | Safe-to-defer |

## Safety floor verdict  (load-bearing — the explicit ask)
**SAFETY FLOOR PRESERVED — Class C UNCHANGED.** The `git diff` of `change-classify.mjs` is purely additive: the new `founder_verifiable` field is computed in its own block and attached to the `mk()` return value; the C-winning logic (control-plane C → deny C → keyword C, evaluated first and short-circuiting at classify() step 1) and every C/B/A glob table are byte-for-byte unchanged. The self-test still proves migration→C, payment→C, prompt→C, `.env`→C, CODEOWNERS(control-plane)→C, money-keyword→C, control-plane-workflow→C, and that a `classification.json` parse error does NOT suppress C. `founder_verifiable` is a VALIDATION signal (does the founder need to look?) orthogonal to the CONSEQUENCE signal (A/B/C): the self-test pins `src/pages/Pricing.tsx → founder_verifiable=true AND class=C` (both gates fire) and `db/migrations/… → founder_verifiable=false AND class=C` (not founder-facing, still human-gated). Nothing makes a C change auto-continue. The change narrows *review interruptions*; it relaxes no safety gate.

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (all tools `node --check`-clean; self-tests pass) | ✅ | →cmd #1, #5, #7 |
| Dedicated commit + slice id | ⬜ | NOT committed (per instruction: do NOT commit/push) — changes verified on the working tree |
| CI green — machine-read at merge | ⬜ | not applicable at this stage (uncommitted) |
| Migration reversible + applies-clean-on-fresh-DB | n/a | no DB migration in this slice |
| Failure paths → honest error, no false success | ✅ | env tool fails closed exit 3 (#8); classifier parse-error floors at B but still C (#1); generator mode-none/no-stub fail-closed (#7); CI gate fail-closed to review (dev-preview.yml) |
| Class C safety floor unchanged (orthogonality) | ✅ | →cmd #1, #4 (see Safety floor verdict) |
| Both tool copies byte-identical + `node --check`-clean | ✅ | →cmd #5, #6 |
| Docs single-rule consistent + D3 not overturned | ✅ | six doc diffs; ADR-001 explicit D3-deferred statement |

## FAIL history
- none — verified on first independent run.

## Bug reports
1. None — no defect found. (Non-blocking observation, NOT a defect: the `--founder-verifiable` CLI seam reads paths via `--files`, not positional args; passing a bare path returns `false` because the change is read as empty. This is consistent with the tool's documented `--files`/git-diff input model and is how `dev-preview.yml` invokes it — `--base`, no positional path. No action required.)
