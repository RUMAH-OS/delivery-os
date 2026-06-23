---
slice: "canonical-tools-promotion + engine-ownership enforcement — in-range impl of origin/main..main"
verify_status: executed
author: "delivery-os (local development)"
verifier: "qa-test · independent recovery verification · session 2026-06-23-recovery"
date: "2026-06-23"
independence_basis: "recorded-distinct-invocation"
machine_probe: "node templates/tools/dispatch-route.mjs --self-test"
---

# VERIFY — Canonical-tools promotion + engine-ownership enforcement (in-range impl)

## Verdict
**verify_status:** `executed` · one line: 2 of 3 in-range implementation files PASS genuine
execution-based verification; **1 (`templates/tools/dispatch-route.mjs`) FAILS — it is un-loadable
because of a static import of a module (`./knowledge-route.mjs`) that does not exist anywhere in the
repo.** Per the template rule, a verdict of `verified` is **not** permitted while any covered file fails;
this caps at `executed`. This artifact therefore does **not** satisfy the §12 push gate, by design.

## Scope statement (what was / was not covered)
The §12 pre-push gate classifies exactly **3** of the 147 in-range changed files as implementation
(via `IMPL_BASE` regex + `impl_extra` = `["scripts/","templates/hooks/","templates/githooks/","templates/tools/"]`,
minus `.md`/`.claude/`/`docs/`/tests). The large `examples/engine-demo-app/.claude/os/**` and
`templates/workflow-engine/**` trees are gate-EXEMPT (`examples/…` does not match `IMPL_BASE` and is under
`.claude/`; `templates/workflow-engine/` is not in `impl_extra`). The 3 gate-classified impl files:

1. `templates/hooks/verify-gate.mjs`   — PASS
2. `templates/tools/os-inherit.mjs`     — PASS
3. `templates/tools/dispatch-route.mjs` — **FAIL (blocker, filed below)**

NOT covered (out of gate's impl surface, not independently re-verified here): the `contracts/*.mjs`,
the engine source `templates/workflow-engine/**`, and the full `examples/engine-demo-app/**` app — except
insofar as os-inherit's checks exercise the demo-app install (see evidence #2/#3).

## Independence header (Governance §3/§12)
- Verifier identity / invocation: qa-test · independent recovery-verification session · 2026-06-23 · distinct from the build sessions that authored these commits.
- Author identity (code under test): delivery-os local development (commits `e4bf8d7`, `a3e1406`, `07fbfb4`, et al. on `main`, ahead of `origin/main` by 45).
- [x] I assert: the verifier did **not** author the production code under test.
- [x] Independence was real: a separate invocation driving the real tools, not the build context restyled.

## Execution evidence (Governance §1 — verbatim runtime output)
| # | Command | Exit | Output (verbatim, abridged) |
|---|---------|------|------------------------------|
| 1 | `node templates/tools/dispatch-route.mjs --self-test` | **1** | `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…\templates\tools\knowledge-route.mjs' imported from …\templates\tools\dispatch-route.mjs` |
| 2 | `node templates/tools/os-inherit.mjs engine-check --from . --into examples/engine-demo-app` | 0 | `os-inherit engine-check · OS v5.0-126-ga35c466 · 1 engine(s) · 27 installed engine file(s)` / `PASS: every installed engine is byte-current with canonical … AND the applied DDL is structurally equivalent …` |
| 3 | `node templates/tools/os-inherit.mjs check --from . --into examples/engine-demo-app` | 0 | `os-inherit check · OS v5.0-126-ga35c466 · 14 inherited file(s)` / `PASS: every inherited capability is byte-current with the OS.` |
| 4 | `node --check templates/hooks/verify-gate.mjs` | 0 | (no output — parses clean) |
| 5 | gate pre-commit, sibling-mounted clean engine install, planted LOCAL DRIFT on `.claude/os/engine/engine.ts` | n/a (emit) | `⛔ Engine is owned by Delivery OS. Do not edit \`.claude/os/engine/\` directly. … (drifted: .claude/os/engine/engine.ts)` / `LOCAL DRIFT: .claude/os/engine/engine.ts — the INSTALLED copy differs from the recorded hash …` |
| 6 | gate pre-commit, same sandbox, engine byte-current (clean) | n/a (emit) | NO `⛔ Engine is owned` block emitted (the only block reached was the §12 VERIFY block on the sandbox's untracked migrations) → `engineDriftBlock()` returned null = PASS path |
| 7 | gate pre-commit, installed engine but canonical NOT reachable as `../delivery-os` sibling | 0 | `[verify-gate] ⚠ ENGINE DRIFT NOT VERIFIED LOCALLY … Local ownership enforcement is SKIPPED — CI enforces engine drift hard …` (loud warn, no block — per design) |

Machine-guard note: evidence #2/#3 ran against the real committed `examples/engine-demo-app` install
(no shared mutable store/port). Evidence #5/#6/#7 ran in a disposable sibling sandbox built from the
real committed engine + a copied INHERITED-engine.json/engine.config.json; the sandbox was deleted after.
Node v22.22.3.

## Per-file verdict
| File | Surface exercised | Evidence | PASS/FAIL |
|------|-------------------|----------|-----------|
| `templates/tools/os-inherit.mjs` | real `engine-check` (3-way hash lock + DDL structural parity) + `check` (tools/contracts/skills drift) against the committed demo-app install | #2, #3 | **PASS** |
| `templates/hooks/verify-gate.mjs` | parse + behavioral exercise of the NEW `engineDriftBlock()` across all 3 designed paths (clean→no block, local-drift→block, unreachable→warn) | #4, #5, #6, #7 | **PASS** |
| `templates/tools/dispatch-route.mjs` | `--self-test` (the file's own built-in suite) — canonical AND byte-identical vendored copy | #1 | **FAIL** |

## Surface statement (anti-Slice-1.0)
- os-inherit was verified by **running** it against a real install, not by reading it.
- verify-gate's engine-ownership logic was verified by **driving the gate** and observing the block
  flip between the engine block and no-block under a planted vs reverted drift — not by inspection.
- dispatch-route was verified by attempting its real `--self-test`; it cannot even load.
- [x] No criterion was "verified" via a bypassing surface.

## Classified open assumptions
| Claim | Status | Severity |
|-------|--------|----------|
| `os-inherit.mjs` engine-check + check pass on a real install | Confirmed (evidence #2/#3) | — |
| `verify-gate.mjs` engine-ownership enforcement blocks local drift, passes clean, warns when canonical unreachable | Confirmed (evidence #5/#6/#7) | — |
| `dispatch-route.mjs` is loadable / self-testable | **Failed** (evidence #1) — hard import of non-existent `./knowledge-route.mjs` | **Blocker** |
| the engine-ownership block in `verify-gate.mjs` is also in the ACTIVE `.claude/hooks/verify-gate.mjs` | Failed assumption — the change is **template-only**; the active gate gating THIS push does not yet carry it (takes effect only when next vendored) | Safe-to-defer (informational) |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| os-inherit drift/engine checks green on real install | ✅ | #2, #3 |
| verify-gate engine-ownership behavior correct | ✅ | #5, #6, #7 |
| dispatch-route loadable / self-test green | 🔴 | #1 |
| §12 push gate satisfiable by this VERIFY | 🔴 (intended) | this verdict is `executed`, not `verified` |

## BUG REPORT — BLOCKER
**Title:** `templates/tools/dispatch-route.mjs` is un-loadable — static import of non-existent `./knowledge-route.mjs`.
**Where:** `templates/tools/dispatch-route.mjs` line 75–84 (`import { … } from "./knowledge-route.mjs";`).
Identically propagated into the vendored copy `examples/engine-demo-app/.claude/os/tools/dispatch-route.mjs`.
**Symptom:** `node dispatch-route.mjs --self-test` → `ERR_MODULE_NOT_FOUND: Cannot find module '…knowledge-route.mjs'` (exit 1) in BOTH the canonical location and the demo-app vendored location.
**Root cause:** `knowledge-route.mjs` was never committed — it does not exist in `main` HEAD, in git history (`git log --all -- '*knowledge-route.mjs'` empty), in the manifest, or anywhere on disk. `dispatch-route.mjs` (committed in `e4bf8d7`) depends on it at module-load via a top-level static ESM import, so the module cannot be imported by anything and its self-test cannot run.
**Impact:** the canonical orchestration runner (capability #9) is dead code as shipped; any consumer that `os-inherit sync`s it gets a tool that throws on import. The `os-inherit check` PASS only proves byte-identity, not loadability — so the drift gate alone will not catch this.
**Fix (for the author — I do not patch production code):** either commit the missing `knowledge-route.mjs` (and add it to `os-foundation.manifest.json` tools so it co-vendors), or remove/guard the dependency in `dispatch-route.mjs`. Re-run `node dispatch-route.mjs --self-test` to green before re-submitting for QA.

## Conclusion
This recovery verification **does not authorize a push** of `origin/main..main` as it stands: a §12-classified
impl file fails genuine verification. No `verify_status: verified` artifact is written. The push must remain
blocked until the dispatch-route blocker is fixed and re-verified. No bypass was used.
