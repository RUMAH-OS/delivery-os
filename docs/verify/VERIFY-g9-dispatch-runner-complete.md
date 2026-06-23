---
slice: g9-dispatch-runner-complete
commit: 1c4f5cfa8ad57262a45a10dacf09111388907b22
verify_status: verified
author: "software-engineer · session a5bed7aa72bdc676e"
verifier: "qa-test · independent · session qa-g9-dispatch-runner"
date: "2026-06-23"
---

# VERIFY — G9 dispatch-runner complete (knowledge-route + ownership-gate)

## Scope

Independent QA of commit `1c4f5cfa` (NOT pushed; HEAD of `main`), which completes the
canonical G9 dispatch-runner by building the two modules `dispatch-route.mjs` imported but
which never existed (the `ERR_MODULE_NOT_FOUND` BLOCKER recorded in
`VERIFY-canonical-tools-promotion-engine-ownership.md`).

Author ≠ verifier. No production code was touched by the verifier. Every claim below was
re-driven from a clean checkout of the commit; exit codes and key output are real captures.

## Change set (independently confirmed — exactly 4 files, nothing sneaked in)

`git show --stat 1c4f5cfa`:

| File | Type | Lines |
|---|---|---|
| `templates/tools/knowledge-route.mjs` | NEW | +274 |
| `scripts/ownership-gate.mjs` | NEW | +222 |
| `templates/tools/dispatch-route.mjs` | EDIT | +36 / -7 (single hunk @@ -84,16 +84,38) |
| `capabilities/os-foundation.manifest.json` | EDIT | +1 (knowledge-route added to tools[]) |

No other files in the commit. (An unstaged `examples/engine-demo-app/.claude/os/INHERITED.json`
osVersion bump exists in the working tree but is NOT part of this commit and does not touch any
verified file — incidental vendored-example drift, out of scope.)

## Evidence table

| # | Check | Command | Result | Exit |
|---|---|---|---|---|
| 1a | parse knowledge-route | `node --check templates/tools/knowledge-route.mjs` | parses | 0 |
| 1b | parse ownership-gate | `node --check scripts/ownership-gate.mjs` | parses | 0 |
| 1c | parse dispatch-route | `node --check templates/tools/dispatch-route.mjs` | parses | 0 |
| 2 | dispatch-route self-test | `node templates/tools/dispatch-route.mjs --self-test` | **67 assertions, all PASS**; green summary line printed | 0 |
| 3a | knowledge-route self-test | `node templates/tools/knowledge-route.mjs --self-test` | PASS (routing + dedup + proofId determinism + marker shape + bodyOf/contentHash + log round-trip) | 0 |
| 3b | ownership-gate self-test | `node scripts/ownership-gate.mjs --self-test` | **23 assertions, all PASS** (default-policy resilience · keyword+glob detect · order preserved · work-type→owner · unknown→null · no false-positive) | 0 |
| 4 | change-set integrity | `git show --stat 1c4f5cfa` | exactly the 4 files above | — |
| 4 | dispatch-route diff scope | `git show 1c4f5cfa -- templates/tools/dispatch-route.mjs` | single hunk; ownership-gate import only; **no routing/scoring/firewall logic changed** | — |
| 5a | OS drift (consumer) | `node .claude/tools/check-os-drift.mjs` | `drift-lint: OK (7 skills, 1 warning) — router matches disk` (warning = pre-existing version-stamp note) | 0 |
| 5b | OS drift (canonical) | `node templates/tools/check-os-drift.mjs` | `drift-lint: OK` | 0 |
| 5c | manifest phantom check | all `tools[]` entries `existsSync` on disk | all 11 OK incl. knowledge-route.mjs — **no phantom dispatch** | — |
| 6 | knowledge corpus routing | `routeKnowledge("verify the seam by one real round trip…", loadKnowledge("wiki"))` | 17 KUs loaded; **#1 = `ku-verify-seam-by-one-real-round-trip` score 18** (runner-up 9.5) — claim CONFIRMED | 0 |

(No `package.json` / `pnpm` workspace at repo root — `engine:drift:check` / `typecheck` / `test`
scripts do not exist here; the modules' own `--self-test` suites are the executable gate and all pass.)

## dispatch-route edit — behavior-neutrality assessment (independently judged)

**The depth argument holds.** Re-derived on disk: from the CANONICAL location
`delivery-os/templates/tools/`, the prior static import `../../../scripts/ownership-gate.mjs`
resolves to `C:\Users\brian\RUMAH\scripts\...` — *one level above the repo*, `existsSync=false` —
which is exactly the `ERR_MODULE_NOT_FOUND` that made the canonical `--self-test` un-loadable.
From the VENDORED location `<project>/.claude/os/tools/`, the same `../../../scripts/` correctly
resolves to `<project>/scripts/`. A single static import cannot serve both depths. The new
resolver tries **vendored-depth FIRST** (preserving the authored runtime intent), then canonical.

**Behavior-neutral for the real path:** in production the vendored candidate exists and is loaded
first, so the runtime loads the same module the old static import did. The self-test
`reconcile: policy required owner = frontend-engineer` PASS proves the *real* ownership-gate
loaded (not the fallback). No routing/reconcile/C2-firewall assertion changed — all 67 pass,
including the C1 conformance, R2 routerCorrect, and C2 firewall-by-shape checks.

**Fail-closed nuance (honest caveat, not a defect):** if `ownership-gate.mjs` exists at NEITHER
depth, the fallback returns `loadPolicy → {workTypes:[]}`, `detectWorkTypes → []`,
`requiredOwner → null`. Behaviorally this means dispatch still produces an owner
(`reconciled = selected || "software-engineer"` — never routes to nobody, never crashes), but the
**policy-wins reconcile is bypassed** — i.e. ownership *enforcement* is dropped while *routing*
continues. The engineer's "routing never disabled" is accurate; the precise reading is "the
dispatcher never fails open to no-owner, but ownership correction is absent if the gate file is
entirely missing." This path only triggers when the file is absent at both depths — not the
canonical or vendored layout — so it is a genuine last-resort, not the operating path.

## Caveat the engineer flagged — confirmed honest

Standalone `ownership-gate.detectWorkTypes` classifies `ux` somewhat broadly
("fix a UX issue…" → `["ux"]`; "redesign admin-ui/…" → `["ux","frontend"]`). This breadth is
**contained at the dispatch-route reconcile layer**: the self-test proves an explicit
work-type (`verify`/`review`/`backend`) suppresses any ux-panel (`defect/verify`,
`defect/review`, `defect/explicit-wins` all PASS). The standalone breadth does not leak into
wrong panel-spawns at the dispatch gate.

## Verdict

**VERIFIED.** All six checks pass genuinely on the committed code. The change set is exactly the
4 declared files. The dispatch-route edit is confined to ownership-gate import resolution and is
behavior-neutral on the real runtime path (proven by the full 67-assertion self-test plus the
on-disk depth re-derivation). The knowledge-route corpus claim is confirmed against the real
`wiki/` (17 KUs, target KU top-ranked by a clear margin). No drift, no phantom dispatch.

Not pushed (per instruction). Re-verify required only if any of the 4 files change.
