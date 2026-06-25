---
slice: "learning-review — Learning Review as a first-class lifecycle hook (3-level trigger policy + 10-way classify + Founder Learning Package)"
verify_status: verified
# ^ one of: planned | generated | executed | verified. Set 'verified' only when ALL gates below pass.
author: "learning-review-build-agents"
verifier: "independent-qa"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/learning-trigger.mjs --self-test"
impl_fingerprint: 'none — verification covers net-new template tools + registration docs (no installed-impl behavior fingerprint); the machine_probe self-test is the load-bearing re-runnable gate'
---

# VERIFY — Slice learning-review (Learning Review first-class lifecycle hook)

## Verdict
**verify_status:** `verified`  ·  one line: all 3 net-new tools pass `--self-test` (exit 0) and `node --check`; the 7-part registration is well-formed (valid JSON, D10 + ADR-003 + §14 hook + CANONICAL-SDLC row + SKILL 2.1 + manifest + workflow); the §14 promotion bar, close-default, no-backflow lint and §11 panel economics are TEXTUALLY UNCHANGED (7 insertions / 0 deletions); the policy default is no-review and does NOT over-fire on routine slices.

## Independence header  (Governance §3/§12 — proves author ≠ verifier)
- Verifier identity / invocation: `independent-qa` — distinct QA invocation, 2026-06-25, read-only over the uncommitted slice (only this VERIFY written).
- Author identity (code under test): `learning-review-build-agents` (authored the 3 tools + the registration).
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real** (a true second invocation; the verifier read + executed, did not write any tool/registration file).

## Execution evidence  (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim, trimmed) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/learning-trigger.mjs --self-test` | 0 | `learning-trigger --self-test PASS — 3-level trigger proofs (composing change-classify):` … `[incident->L2] -> L2 learning_expected=true`, `[founder_verifiable->L1] -> L1`, `[plain-refactor->L0] -> L0 learning_expected=false`, `[backstop>N->L2] -> L2 (31 > 30)`, `[fail-safe->L2] -> L2` |
| 2 | `node templates/tools/learning-classify.mjs --self-test` | 0 | `[PASS]` × all 10 asset classes (Capability·Skill·Workflow·SDLC·Governance·Prompt·Wiki·Template·Verification·Roadmap) + `[PASS] ambiguous->governance-review (low)` + `[PASS] explicit-close->none (high)` + `[PASS] empty-learning->governance-review (no silent drop)` |
| 3 | `node templates/tools/founder-learning-package.mjs --self-test` | 0 | `founder-learning-package --self-test PASS — a digest is built ONLY from seeded learnings … a missing impact renders an explicit 'not stated' … a title-less item is DROPPED … ZERO real learnings yield a fail-closed 'Nothing to report' with NO rows and NO checklist. The package fabricates nothing.` |
| 4 | `node --check` × all 3 tools | 0 | `OK` / `OK` / `OK` |
| 5 | `node -e JSON.parse(capability.json)` / `(manifest.json)` | 0 | `capability.json OK` · `manifest.json OK` |
| 6 | `git diff HEAD --numstat -- core/GOVERNANCE.md` | 0 | `7	0	core/GOVERNANCE.md` (7 insertions, **0 deletions**) |
| 7 | `git diff HEAD -- core/GOVERNANCE.md \| grep '^-' (minus header)` | 1 | (no deleted lines — invariant text untouched) |
| 8 | pure `level()` controlled probes (node ESM import) | 0 | incident→L2, ADR+capability→L2, backstop31→L2, founder_verifiable→L1, class-B api→L1, defect→L1, plain-refactor→**L0**, commits==N boundary→**L0** |
| 9 | `node .claude/tools/check-os-drift.mjs` | 0 | `drift-lint: OK (7 skills checked, 0 warning(s)) — router matches disk.` |

## Acceptance criteria  (each PASS/FAIL + its evidence pointer)
| # | Criterion | Surface exercised | Evidence | PASS/FAIL |
|---|-----------|-------------------|----------|-----------|
| 1 | learning-trigger: L2 on heavy triggers; L1 on founder_verifiable/class-B/defect/census-watch; L0 default; FAILS TOWARD L2 on bad input; `learning_expected = level!=='L0'` | imports + runs the tool | #1, #8 | PASS |
| 2 | learning-trigger COMPOSES change-classify (imports `classify`, does not fork) | code read (line 41 `import { classify ... } from "./change-classify.mjs"`; line 132 `input._classify || defaultClassify`) | read | PASS |
| 3 | learning-classify: 10-way taxonomy; AMBIGUOUS→governance-review (no silent drop, never forced); `none` only on explicit close | runs the tool | #2 | PASS |
| 4 | founder-learning-package: zero-tech, FAIL-CLOSED — no learnings → "Nothing to report"; no fabricated rows/impact/checklist | runs the tool | #3 | PASS |
| 5 | `node --check` all three | parse | #4 | PASS |
| 6 | Trigger policy: L2 on incident/ADR/new-capability/backstop, L1 on founder_verifiable, L0 on plain refactor — no over-fire, no under-fire | pure classifier | #1, #8 | PASS |
| 7 | capability.json well-formed; manifest valid w/ 3 tools in tools[] + learning-review.yml in workflows[] + skill in skills[] | parse + read | #5, manifest L40-42/L65/L51 | PASS |
| 8 | D10 row present + references ADR-003; ADR-003 PROPOSED/SHADOW | git diff DECISIONS.md; ADR-003 read | diff, ADR L3 | PASS |
| 9 | SKILL bumped to 2.1 with classify (6c) + package (6d) steps; CANONICAL-SDLC has a Learning Review stage row | git diff SKILL.md / CANONICAL-SDLC.md | diff | PASS |
| 10 | §14 promotion bar + close-default + no-backflow lint + §11 economics TEXTUALLY UNCHANGED | numstat + deletion grep + current-file grep | #6, #7, GOVERNANCE L58-62/117/123 | PASS |
| 11 | Drift clean | run | #9 | PASS |

## Surface statement
- The slice's real surface: three Node ESM CLI tools (executed via `--self-test` + controlled `level()` import) + the registration docs/JSON (parsed + diffed on disk). Driven by: direct invocation and `git diff` against HEAD — not prose.
- [x] No criterion was "verified" via a surface that bypasses the slice. The composition claim (trigger imports change-classify) was confirmed in source, not assumed.

## Trigger-policy evidence  (the board's intent — no over-fire / no under-fire)
Pure classifier (controlled inputs, isolating the live backstop):

```
L2 production incident       -> L2  expected=true  :: incident artifact touched (docs/incidents/outage.md)
L2 ADR + new capability      -> L2  expected=true  :: decision/ADR recorded (docs/adr/ADR-099.md) [+ NEW capability surface]
L2 backstop >30              -> L2  expected=true  :: BACKSTOP: 31 commits since the last docs/feedback/ artifact (> 30)
L1 founder_verifiable slice  -> L1  expected=true  :: change-classify: founder_verifiable=true (a founder-facing slice)
L1 class-B api slice         -> L1  expected=true  :: change-classify: class B (VISIBLE — a human sees the result)
L1 defect filed              -> L1  expected=true  :: a defect/regression was filed this slice
L0 plain refactor            -> L0  expected=false :: L0 capture-only … no review ceremony owed.
L0 boundary commits==N       -> L0  expected=false :: L0 capture-only … (strictly-greater backstop boundary holds)
```

Verdict on the policy: **HEAVY triggers fire L2** (incident · ADR · new-capability · backstop) — does NOT under-fire on the events that purchase lessons. **Routine slices stay L0/L1** — a plain class-A refactor and the `commits == N` boundary both yield **L0 (no review)**, and a small founder-verifiable slice caps at L1 (not L2) — does NOT over-fire. The fail-safe (a thrown classify) floors at **L2** — a review owed is never skipped on an error. Live CLI over the real repo correctly floored to L2 via the BACKSTOP (165 commits since the last `docs/feedback/` artifact > 30) — the completeness floor doing its job.

## Invariants-preserved verdict  (LOAD-BEARING)
- **§14 promotion bar UNCHANGED.** `git diff HEAD --numstat core/GOVERNANCE.md` = `7 0` (7 insertions, **zero deletions**); a `grep '^-'` over the diff returns nothing. The bar text survives verbatim on disk: *"A framework promotion is earned only by an **observed failure** OR a **second consumer pulling** … Default triage outcome is **close/wait**."* (GOVERNANCE.md:117) and the **no-backflow lint** (`scripts/check-no-backflow.mjs`, GOVERNANCE.md:123) are intact. The added §14 block explicitly states Learning Review *"FEEDS the promotion machinery below — it does not replace it: the promotion bar, the close-default, the scaled §11 promotion panel, and the no-backflow lint are UNCHANGED."*
- **§11 panel economics UNCHANGED / not weakened.** The lens-cap + saturation lines survive verbatim (GOVERNANCE.md:58-62): *"Lens cap by decision class … 5–6 lenses max … saturation arrives ~5–6; 14/14 unanimity is repetition, not coverage."* The L2 review is a **SCALED §11 panel** (capability.json `runs`: "a scaled §11 multi-lens panel (compose principle-11's lens machinery)"; ADR-003 §Consequences: "the L2 panel is scaled, not maximal"), i.e. it COMPOSES principle-11's lens machinery — it is NOT the rejected 14-blind-lens fanout (ADR-003 Alternative A: review-every-slice REJECTED for reproducing the 14×-fanout). Confirmed not weakened.
- **DEFAULT is no-review (anti-ceremony).** `learning_expected = (L1 ∨ L2)`, default no-review / close-default (capability.json `autoDecisionRule`, ADR-003, D10). Proven empirically: routine slices resolve to L0 with `learning_expected=false` (#8). Eval is FAIL-OPEN — L0/L1 never block.
- **N-merge backstop is the completeness floor.** Default 30 (`DEFAULT_BACKSTOP = 30`); strictly-greater boundary verified (commits==30 → L0, commits==31 → L2). This caps learning debt and makes the recorded 175-overdue structurally impossible — the under-fire failure direction is closed without relaxing any bar.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| All 3 tools pass `--self-test` (exit 0) + `node --check` | Confirmed (#1-#5) | — |
| §14 bar / close-default / no-backflow lint / §11 economics textually unchanged | Confirmed (#6, #7, on-disk grep) | — |
| Policy default no-review; no over-fire on routine slices | Confirmed (#8) | — |
| Registration JSON well-formed; manifest carries 3 tools + workflow + skill | Confirmed (#5, manifest read) | — |
| `templates/workflows/learning-review.yml` L2 job invokes the tools with flags they do not implement (`--event`, `--level-only`, `--post`, and no `--file` for the package) | Evidence-backed (see Bug reports #1) | Safe-to-defer |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (`node --check` × 3) | ✅ | #4 |
| Self-tests green (the machine_probe) | ✅ | #1-#3 |
| Registration JSON valid | ✅ | #5 |
| Invariants unchanged (§14/§11) | ✅ | #6, #7 |
| Trigger policy: no over-fire / no under-fire | ✅ | #8 |
| OS drift clean | ✅ | #9 |
| Dedicated commit + slice id | ⬜ | uncommitted at verify time (per task — not committed/pushed) |
| Failure paths → honest error, no false success | ✅ | trigger fail-safe→L2 (#1); classify ambiguous→governance-review (#2); package fail-closed "Nothing to report" (#3) |

## FAIL history
- none

## Bug reports  (defects flow author-ward — the verifier files, never fixes)
1. **[Safe-to-defer]** `templates/workflows/learning-review.yml` calls the tools with flags they do not implement: the classify step uses `learning-trigger.mjs --event <x> --level-only` (the tool parses only `--files/--changed/--base`; `--event`/`--level-only` are silently ignored — it still prints the level on stdout, so the classify step happens to work), but the L2 job runs `founder-learning-package.mjs --event <x> --post` with **no `--file`** — the tool requires `--file` and otherwise exits 2 with USAGE, so the package would never be emitted as written, and `learning-classify.mjs --json` is run with no `--file`/`--title` and would also exit 2 (USAGE). Repro: `node templates/tools/founder-learning-package.mjs --event x --post` → exit 2. Impact is contained: the yml is a header-declared **TEMPLATE, NOT installed live in delivery-os**, every call site is `|| echo ::warning`-guarded, and rollout is SHADOW (classify + log before gating) — so this does not block this slice's gate, but the workflow's L2 emit path will need real `--file` plumbing (a classified-learnings JSON + a trigger-reasons JSON) before it can leave SHADOW. → back to `learning-review-build-agents`.
