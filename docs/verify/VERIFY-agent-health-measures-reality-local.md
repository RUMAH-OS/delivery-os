---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — agent-health measures the agent-orchestration system from REALITY

**Under test:** `templates/tools/agent-health.mjs` — read-only measurement tool. Classifies each
agent USED / IDLE / MISSING from a runtime telemetry corpus (`*.meta.json`), reports invocation
count + share, and emits orchestration signals (selection deterministic?, parallel-rate, measured).

**Independence:** verifier did not author the tool. All evidence below is from the verifier's own
runs against fixtures the verifier created. No production code was touched (fixtures lived under
`/tmp`, now cleaned). Not committed.

**Verdict: VERIFIED** — all four acceptance criteria hold; the load-bearing criterion 2 (counts +
parallel + IDLE/USED follow the corpus) is proven by mutation.

---

## Criterion 1 — self-test passes — PASS

`node templates/tools/agent-health.mjs --self-test` → exit 0, all 7 cases PASS incl. the
parallel-rate case (1/2):

```
agent-health --self-test (validate-the-validator):
  PASS  parse agentType (got qa-test, want qa-test)
  PASS  parse missing → null (got null, want null)
  PASS  installed + invoked → USED (got USED, want USED)
  PASS  installed + 0 → IDLE (got IDLE, want IDLE)
  PASS  built-in invoked, no .md → USED (got USED, want USED)
  PASS  not installed + 0 → MISSING (got MISSING, want MISSING)
  PASS  parallel-rate (got 1/2, want 1/2)
PASS: agent-health classifies all known states correctly — it measures reality.
EXIT=0
```

---

## Criterion 2 — Measures reality (mutation, LOAD-BEARING) — PASS

### Planted corpus (verifier-created)
Telemetry `/tmp/ah-tel`: 3× qa-test, 1× software-engineer, 1× Explore (Explore has NO .md).
Agents `/tmp/ah-agents`: `qa-test.md`, `software-engineer.md`, `reviewer-critic.md`
(reviewer-critic has NO telemetry).

| Agent             | Planted invocations | Expected status        | Reported           |
|-------------------|--------------------:|------------------------|--------------------|
| qa-test           | 3                   | USED  (3 / 60%)        | USED 3× (60%) ✓     |
| software-engineer | 1                   | USED  (1 / 20%)        | USED 1× (20%) ✓     |
| Explore           | 1 (no .md)          | USED  (built-in)       | USED 1× (20%) ✓     |
| reviewer-critic   | 0 (installed)       | IDLE                   | IDLE ✓             |

Reported output:
```
agent-health · agents=Local/Temp/ah-agents · telemetry=5 invocations
  [USED   ] qa-test                  — 3× (60% of spawns)
  [USED   ] Explore                  — 1× (20% of spawns)
  [USED   ] software-engineer        — 1× (20% of spawns)
  [IDLE   ] reviewer-critic          — installed, 0 invocations in window
```
Counts + shares EXACTLY match the plant. The no-telemetry installed agent reads IDLE; the
invoked-but-no-.md built-in (Explore) reads USED. ✓

### Mutation A — counts follow the corpus
Removed `q3.meta.json` (qa-test → 2) and `d2.meta.json`: total dropped 7 → 5, qa-test recomputed
to 2× (40%). Numbers tracked the file set, not hardcoded. ✓

### Mutation B — parallel detection (the parallel proof)
- 5 files at 5 DISTINCT seconds (touch -d 10:00:01..05) → `parallel: 0/5 ... (0% parallel)`,
  SUMMARY `parallel=NEVER`.
- ADDED `d1.meta.json` + `d2.meta.json` both forced to the SAME second `2026-01-01 10:00:09`
  (identical mtime via `touch -d`) → that one second now holds 2 agents:
  ```
  parallel:  1/6 spawn-moments launched >1 agent (17% parallel)
  ```
  6 distinct spawn-seconds, exactly 1 of them (10:00:09) launched >1 agent. ✓
- REMOVED one of the collision pair → `parallel: 0/5 ... NEVER`. The parallel moment vanished
  with the file. ✓

Parallel-rate is computed from real file mtimes bucketed per second — it follows the corpus.

---

## Criterion 3 — Selection signal follows evidence — PASS

```
--router /tmp/nope-does-not-exist.mjs  → selection: MODEL-DRIVEN (no agent-router ...)
--router /tmp/ah-agents/qa-test.md     → selection: DETERMINISTIC (agent-route present)
```
Signal is `existsSync(routerPath)` — flips on real path existence, not asserted. ✓

---

## Criterion 4 — No mutation of real data (read-only) — PASS

- Static: only read APIs imported — `readFileSync, existsSync, readdirSync, statSync`. Grep for
  write/mutate APIs (writeFile/appendFile/mkdir/unlink/rename/truncate/createWriteStream/
  chmod/utimes/openSync 'w') → NONE FOUND.
- Runtime: snapshotted the real `delivery-os/.claude/agents` dir (name+size+mtime) before/after a
  run against it → `diff` IDENTICAL (real agents dir untouched).
- Telemetry corpus: all `.meta.json` files byte+mtime identical before/after a read (the only diff
  in the raw listing was `/tmp`'s own `..` parent entry, unrelated to the tool).

---

## Defects
None. Behavior matches spec on every criterion.

## Notes / observations (non-blocking)
- All human-facing output goes to `stderr`; `stdout` is empty. Intentional (matches sibling
  evidence tools) — but a downstream consumer expecting machine-readable stdout would get nothing.
  Not a defect against this spec.
- `measured: YES` and the SUMMARY line are honest-reporting only (always exit 0); the tool is a
  measurement, not yet a fail-closed gate, as documented in its header.

## Cleanup
All `/tmp/ah-tel`, `/tmp/ah-agents`, and scratch files removed after verification. Nothing committed.
