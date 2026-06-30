---
slice: "monitoring-watchdog-p3-6 — off-Neo pull-watchdog + status surface (two-domain dead-man)"
verify_status: verified
author: "Builder (software-engineer build session)"
verifier: "qa-test (independent) — 2026-06-30T00:00Z (claude-opus-4-8, distinct invocation)"
independence_basis: "recorded-distinct-invocation — verifier re-ran every machine probe from a clean checkout in a session distinct from the build; no implementation file was modified by the verifier."
machine_probe: "node monitoring/pull-watchdog.mjs --self-test"
date: "2026-06-30"
---

# VERIFY — Slice monitoring-watchdog-p3-6 (off-Neo pull-watchdog + status surface)

## Verdict
**verify_status:** `verified` — the watchdog is off-Neo / read-only / pages correctly, the status surface
leaks no secret and renders, the boundary + Delete Test hold, and no regression was observed. Every
acceptance criterion was re-run by an independent lens and reproduced PASS. Runtime under a real Windows
Scheduled Task against a real tailnet is **DEFERRED to founder install** (out of scope, see Deferred).

## Acceptance criteria — result

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | Failure-domain independence: `monitoring/` sibling of `infrastructure/`, no Neo-local dep, no internal loop, durable streak store | PASS | `monitoring/` is a top-level sibling; Neo node folder is `infrastructure/execution-node/` (watchdog is NOT inside it). Imports are `node:http/https/fs/path/url` only — zero npm, zero infra SDK, zero Core import. No `setInterval`/`while(true)` in the watchdog (OS scheduler owns cadence). Streak persists via `fileStore()` JSON (`pull-watchdog.mjs:191`). |
| 2 | Watchdog behaves (self-test): healthy silent · N misses page once · de-dupe · recover + re-arm · 503/down = miss · injected fetch+clock+store, no net/loop/disk · default notifier inert · all seams injectable | PASS | `node monitoring/pull-watchdog.mjs --self-test` → ALL PROOFS HOLD, exit 0 (22 checks). Default notifier is `consoleNotifier()` (stderr only, no secret). `fetchReady`/`notifier`/`store`/`now`/`probes` all injected in `pollOnce()`. |
| 3 | Read-only on Neo (GET `/ready` only, no mutation) | PASS | `defaultFetchReady` issues `method: "GET"` only (`:145`); grep found no POST/PUT/DELETE/PATCH anywhere in the watchdog. No restart/promote/write-Neo path exists. |
| 4 | Status surface leaks nothing + renders (mirror verdict verbatim, unreachable→DOWN still renders, age buckets, no secret, well-formed HTML, same-origin fetch, no creds) | PASS | `node monitoring/status-page/status.mjs --self-test` → ALL PROOFS HOLD, exit 0. `headline === report.verdict` (never re-derived); `neoReport:null` ⇒ `down` + still renders. `index.html` is well-formed, imports `./status.mjs`, fetches same-origin `./status.json`→`./status.sample.json`, no embedded creds. Secret grep: NONE. |
| 5 | Boundary + Delete Test (guard CLEAN, files = adapters, contract-only; delete-test PASS monitoring arm; guard self-test 10/10) | PASS | `arch-boundary-guard.mjs` → CLEAN (adapters: 14). `--self-test` → 10/10. `delete-test.mjs --subsystem monitoring` → PASS (Core tsc 0 errors + 3 Core self-tests pass with `monitoring/` removed) → exit 0. |
| 6 | Push-domain gap honestly closed (on-Neo push complete; real gap was missing PULL domain; cosmetic POST-comment/GET-code noted non-blocking) | PASS | `infrastructure/execution-node/bootstrap/supervisor-entry.mjs` push side present + `/ready`-gated + keychain-only URL. Confirmed the cosmetic discrepancy: header says "POST the…HC_PING_URL" (`:11`) while code issues `method: "GET"` (`:69`). Healthchecks accepts both — non-blocking. |

## Primary probe — watchdog self-test (verbatim, exit 0)
```
pull-watchdog self-test — miss fires / healthy silent (injected fetch + clock + store, no net/loop)
[1] a READY node is silent (no page)                          PASS x2
[2] N consecutive misses fire the notifier once (de-dupe)     PASS x7
    miss 1/2 no page; miss 3 PAGE; count+threshold; injected clock ts; ECONNREFUSED detail; sustained de-dupes to ONE
[3] recovery pages once, then re-arms                         PASS x4
[4] a 503 down body is a miss; verdict surfaced               PASS x2
[5] supplementary probe failure flips ready→miss             PASS x2
[6] decidePoll() pure-fold invariants                        PASS x5
pull-watchdog self-test: ALL PROOFS HOLD (exit 0)
```

## Failure-domain-independence assessment (the point of the sprint)
INDEPENDENT — and structurally enforced, not just asserted:
- **Location:** `monitoring/` is a top-level sibling of `infrastructure/`. Neo's node code lives under
  `infrastructure/execution-node/`; the watchdog is NOT nested there, so it cannot ride the box it watches.
- **No shared failure domain:** the watchdog imports only Node built-ins (`node:http/https/fs/path/url`).
  No import of any `infrastructure/` file, no infra SDK, no npm dependency, no Core internal — confirmed by
  the arch-boundary-guard classifying it `adapters` (CLEAN) and by the Delete Test (Core builds with
  `monitoring/` removed). It is designed to run on the Windows box (`windows-node1`) per
  `config-templates/watchdog/windows-pull-task.xml.template`.
- **No internal clock:** no `setInterval`/`setTimeout`/`while(true)` — `pollOnce()` runs exactly once per
  invocation; the OS Scheduled Task owns the cadence. The consecutive-miss streak therefore lives in a
  durable JSON store (`fileStore`) between runs, so independence does not cost memory.
- **Partner domain:** the on-Neo PUSH dead-man (`supervisor-entry.mjs` → Healthchecks.io) is the second,
  separate off-Neo domain. The two share nothing but the founder's phone — a single fault (Neo dead OR
  Healthchecks down) still pages. This sprint closes the previously-missing PULL domain.

## Read-only assessment
Confirmed read-only on Neo: the only network verb is `GET /ready` (with a 5s timeout, 64KB body cap). No
POST/PUT/DELETE/PATCH, no restart, no promote, no write of Neo state anywhere in the module. A dumb timer
that pages a human (NEO-HBM §4.3).

## Secret grep (`monitoring/`)
NONE. All keyword hits ("secret"/"token") are documentation prose asserting *absence* of secrets. No UUIDs
(the Healthchecks ping-URL secret shape), no public IPs, no base64/hex blobs, no `user:pass@` URLs, no
embedded creds in `index.html`. Credentials are deferred to the host store at the notifier/collector edge.

## Delete-test result
`node scripts/delete-test.mjs --subsystem monitoring` → PASS (exit 0): with `monitoring/` removed in a
worktree, Core builds (`tsc --noEmit -p tsconfig.core.json` → 0 errors) and all three Core self-tests pass.
The `monitoring` arm is now active and green — Core does not depend on this adapter.

## Non-blocking observations (not defects; no cap)
1. **JSDoc `.js` typedef vs `.ts` file.** Both adapters reference `import("…/health-contract.js")` in a
   JSDoc `@typedef` while the on-disk contract is `health-contract.ts`. This is editor/type-resolution only
   — the runtime never imports it (consume-by-shape), self-tests pass, the boundary guard is CLEAN. Cosmetic.
2. **supervisor-entry POST-comment / GET-code.** As the Builder honestly flagged: comment says "POST",
   code does GET; Healthchecks accepts both. Lives in `infrastructure/execution-node/`'s surface, not this
   subsystem's — left untouched. Recommend a one-word comment fix for honesty. Non-blocking.

## Deferred to founder install (out of scope, correctly Waterlined)
- Real Windows Scheduled Task registration (`windows-pull-task.xml.template`) and a real tailnet poll.
- A real notifier channel (Slack/email/SMS) with its credential from the Windows credential store.
- The off-Neo collector that writes the live `status.json`, and static-host deploy of `status-page/`.
These are install steps, not code gaps; the interfaces (`status.json` = `status.sample.json` shape; the
notifier/probe seams) are fixed, so standing them up later re-architects nothing.

## Regression
None observed. Boundary guard CLEAN across 143 files; guard self-test 10/10; Delete Test CLEAN for every
present subsystem including the new `monitoring` arm; both new self-tests green; no production code touched.

## Blocking issues
None.
