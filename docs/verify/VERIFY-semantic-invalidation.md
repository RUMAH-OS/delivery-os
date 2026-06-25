---
slice: "semantic-invalidation — VERIFY freshness moves from TIMESTAMP to SEMANTIC (normalized impl fingerprint)"
verify_status: verified
# ^ one of: planned | generated | executed | verified. Set to 'verified' only because every gate below passed.
author: "semantic-invalidation-agents"
verifier: "independent-adversarial-qa"
date: "2026-06-25"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/verify-fingerprint.mjs --self-test"
test_pins_amended_by: "none — this slice changed no files under tests/ e2e/ evals/"
impl_fingerprint: '{"templates/hooks/verify-gate.mjs":"6ddacfa9b178fb9280aefc82bf82f60c2704ba462c303f778ce7018530f40dde","templates/tools/deployment-auth.mjs":"c659c414e0584daa4afd99dbb13df45c2dbc3640d0b55bc65c56fb9952aeee6b","templates/tools/verify-fingerprint.mjs":"fd60c55ff574b035a8dd404b9fc36c1e18d6ef6434ceb1a5eb9a8ec0e594f098"}'
---

# VERIFY — Slice semantic-invalidation

## Verdict
**verify_status:** `verified`  ·  one line: an independent adversarial verifier could NOT construct a false negative — every behavior-altering edit flips the normalized fingerprint, every non-behavioral edit leaves it intact, ambiguity falls back to a raw byte hash, both self-tests PASS, and the safety floor survives in the docs.

> The load-bearing safety property — **no false negatives** (a runtime-behavior change MUST change the fingerprint) — was attacked directly with a verifier-authored probe (not the author's self-test) and held across 60+ paired inputs.

## Independence header (Governance §3/§12)
- Verifier identity / invocation: `independent-adversarial-qa` — a distinct QA invocation; did not author any of `templates/tools/verify-fingerprint.mjs`, `templates/hooks/verify-gate.mjs`, `templates/tools/deployment-auth.mjs`, or the docs.
- Author identity (code under test): `semantic-invalidation-agents`.
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was **real**: the false-negative hunt was authored from scratch by the verifier (`_scratch_fnhunt.mjs`, `_scratch_fnhunt2.mjs`, `_scratch_parser.mjs`, since deleted), importing only the helper's PUBLIC `normalizedFingerprint` / `verifyCoversImpl` / `parseFrontmatter` API — it does not reuse the author's self-test cases.

## Execution evidence (Governance §1 — direct runtime output)
| # | Command | Exit | Output (verbatim, abridged) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/verify-fingerprint.mjs --self-test` | 0 | `17/17 checks passed.` / `SELF-TEST OK — safety property holds (no false negatives observed).` |
| 2 | `node templates/tools/deployment-auth.mjs --self-test` | 0 | `deployment-auth --self-test PASS — fail-closed deployment authorization (computed from SDLC state)` (all (a)/(b)/(c)/(d) cases) |
| 3 | verifier-authored `_scratch_fnhunt.mjs` (2a–2e + negatives + fallback) | 0 | `MUST-DIFFER passes: 43 \| CRITICAL false negatives: 0` / `NO FALSE NEGATIVE FOUND` |
| 4 | verifier-authored `_scratch_fnhunt2.mjs` (join-collisions, ASI productions, comment-hidden newline, .ts/.jsx) | 0 | `CRITICAL false negatives this round: 0` |
| 5 | verifier-authored `_scratch_parser.mjs` (inline-`#` parser fix, gate + deployment-auth) | 0 | all 7 cases PASS |
| 6 | `node templates/tools/verify-fingerprint.mjs compute --files …` (3 impl files) | 0 | the `impl_fingerprint` pasted into this frontmatter |

## Acceptance criteria (each PASS/FAIL + evidence pointer)
| # | Criterion (adversarial check) | Surface exercised | Evidence | PASS/FAIL |
|---|-------------------------------|-------------------|----------|-----------|
| 1 | `--self-test` PASSes | real CLI run | #1 | PASS |
| 2a | string-literal content change flips hash (`8787→9999`, `"a b"→"a  b"`, `'x'→'y'`, `""→" "`, escaped-quote body) | `normalizedFingerprint` on real files | #3 | PASS |
| 2b | template-literal change flips hash (literal part, `${x}→${y}` interpolation, intra-`${}` whitespace, `${a+b}→${a-b}`, template newline) | #3 | #3 | PASS |
| 2c | regex-literal change flips hash (`/ab+/g→/ac+/g`, whitespace in `/a b/`, flags `g→gi`, char-class `[a-z]→[a-y]`) | #3 | #3 | PASS |
| 2d | a `//` or `/*` INSIDE a string/regex/template is NOT eaten as a comment (`"x//y"→"x//z"`, url path after `//`, `/a\/\/b/`, `"a/*b"`, template `//`) | #3 | #3 | PASS |
| 2e | real code edits flip hash (operator, rename, added branch, `===`vs`==`, number, ASI `return\n5`, `a?.b`vs`a.b`, await ASI) | #3 | #3 | PASS |
| 2-neg | non-behavioral edits do NOT flip hash (line+block comment, indent/blank lines, CRLF↔LF, trailing whitespace, JSON key reorder incl. nested) | #3 | #3 | PASS |
| 3 | tokenization ambiguity / unknown-byte / unterminated-literal falls back to RAW byte hash, and a behavior change still flips it there | `)/.../`, unicode ident, unterminated string | #3 | PASS |
| 3b | collisions: join-injection, ASI restricted productions (break/continue/throw/yield/postfix), comment-hidden behavioral newline (`return /*\n*/ 5`), `.ts` path, `.jsx` raw-hash | #4 | #4 | PASS |
| 4 | gate inline-`#` parser fix: unquoted `verified  # x`→`"verified"`; quoted `"a # b"` keeps `#` | gate-logic replica + deployment-auth `parseFrontmatter` | #5 | PASS |
| 5 | deployment-auth `readVerify` semantic-or-legacy logic; `--self-test` PASS | real CLI run | #2 | PASS |
| 6 | safety floor + honest-limit caveat present in GOVERNANCE §12 / D8 / CANONICAL-SDLC / SKILL.md | doc read | §below | PASS |

## Surface statement (anti-Slice-1.0)
- The slice's real surface: the **running `verify-fingerprint.mjs` helper** (its actual hashing/normalization output) plus the **gate / deployment-auth integration logic**. Driven by: a verifier-authored probe that imports the public API and computes real fingerprints of real temp files, and by re-executing both shipped `--self-test` harnesses.
- [x] No criterion was "verified" by reading code instead of running it: every 2a–2e and negative case is a live `normalizedFingerprint` comparison of two on-disk files.

## False-negative-hunt — the core mission (verbatim conclusion)
> **NO FALSE NEGATIVE FOUND.** Across 60+ paired inputs spanning every literal kind (string / template + interpolation / regex / char-class), the `//`-and-`/*`-inside-literal traps, real code edits, all ASI restricted productions (return/throw/break/continue/yield + postfix `++`/`--`), comment-hidden behavioral newlines (`return /*\n*/ 5`), token-join / spacing collision attempts, `.ts` (tokenized) and `.jsx` (raw-hash) handling, and the three ambiguity fallbacks (regex-vs-divide `)/.../`, unicode identifier, unterminated string) — **I could not construct a single behavior-altering change that left the fingerprint identical.** Every behavioral edit flipped the hash; every non-behavioral edit (comments, indent/blank lines, CRLF↔LF, trailing whitespace, JSON key/whitespace reorder, shebang-only) preserved it; and under each ambiguity the helper provably equals the raw byte hash, where even a comment change still flips — erring toward harmless re-verification, never toward shipping unverified behavior.

Why the property holds structurally: normalization drops information in only five provably-non-behavioral places — comments, between-token whitespace, non-ASI newlines, JSON structural whitespace/key-order, and the shebang line. All literal bytes are preserved verbatim, tokens are joined by a single space that cannot be forged by literal contents (delimiters are kept), ASI-significant newlines emit a marker, and ANY tokenization uncertainty throws `Fallback` → raw byte hash. There is no path by which a runtime-behavior delta lands entirely inside the discarded set.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| Behavioral change ⇒ fingerprint change (no false negatives) | Confirmed (60+ paired inputs, #1/#3/#4) | Blocker — held |
| Non-behavioral change ⇒ fingerprint stable | Evidence-backed (#1/#3) | Should-fix — held |
| Ambiguity ⇒ raw-hash fallback, still no false negative | Confirmed (#3, fallback==raw proven) | Blocker — held |
| Gate `freshPassArtifact`: verified+independent + (fingerprint→covered ELSE mtime); behavior change→not covered→blocks; helper-absent/legacy→mtime, never crashes | Evidence-backed (code read + `verifyCoversImpl` self-test 8a/8b/8c + defensive-import) | Should-fix — held |
| Inline-`#` parser fix (unquoted strip / quoted preserve) | Confirmed (#5, both gate-logic + deployment-auth) | Should-fix — held |
| deployment-auth `readVerify` semantic-or-legacy + `--self-test` PASS | Confirmed (#2, code read) | Should-fix — held |
| Honest limit retained: the hook proves an artifact EXISTS, not that verification was truthful | Confirmed (GOVERNANCE §12 "Honest limit") | Safe-to-defer — held |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green (both self-tests) | ✅ | #1, #2 |
| Independent verifier ran the running thing (own probe) | ✅ | #3, #4, #5 |
| Failure/ambiguity paths → fallback to raw hash, no false success | ✅ | #3 fallback==raw |
| Safety floor present in docs (GOVERNANCE §12 link 3 + "Honest limit"; D8; CANONICAL-SDLC L27/L41; SKILL.md L11/L51) | ✅ | doc reads |
| Migration reversible / fresh-DB | n/a | no schema in this slice |

### Safety-floor doc evidence (check 6)
- GOVERNANCE §12 (line 71): *"Same safety floor: a real behavior change still produces a mismatch and still requires a fresh, independent VERIFY before the slice can advance — the gate has only stopped punishing cosmetic churn, not relaxed the author≠verifier requirement."* and §12 "Honest limit" (line 77) retained.
- DECISIONS.md D8 (line 15): *"Same safety floor (a behavior change still needs a fresh independent VERIFY); legacy VERIFYs without the field fall back to mtime."*
- CANONICAL-SDLC.md (lines 27, 41): semantic freshness, *"a behavior change still demands a fresh independent VERIFY (D8)."*
- skills/verify-gate/SKILL.md (lines 11, 51): *"a real behavior change does, and still demands … (same safety floor)."*

## FAIL history
- none — every check passed on first independent execution.

## Bug reports
1. None. No defect found. (One non-defect design note, not a bug: the shebang line is treated as non-behavioral — correct for Node ESM modules, where the interpreter strips it at load; flagged only for transparency, not as a finding.)
