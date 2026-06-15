---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — agent-route + agent-frontmatter (canonical OS tools) OPERATE (local, independent)

Canonical-side record of the independent verification of the deterministic agent-routing
tools in `delivery-os/templates/tools/`. The verifier ran every command itself from the
delivery-os checkout; the author did not supply results. The Admin-side consumption +
CI-gate proof is recorded in `rumah-admin/docs/verify/VERIFY-agent-route-orchestration-local.md`.

## Scope
- `templates/tools/agent-route.mjs` — `loadAgents` · `routeTask` (per-token-deduped scoring; `why` rationale) · `appendSelection` · `readSelections` · CLI · `--self-test`
- `templates/tools/agent-frontmatter.mjs` — `readAgentFrontmatter` · `validateAgentFrontmatter` (name=stem, kind="agent", non-empty capabilities[]+triggers[])

## Verdict: verified (7/7; load-bearing routing + per-token dedup + fail-closed gate all PASS)

## Evidence (verifier's own runs)
- `node templates/tools/agent-route.mjs --self-test` → exit 0.
- Routing against `../rumah-admin/.claude/agents` (deterministic, identical on repeat):
  - "independently verify this slice" → **qa-test 19.0** (`trig:independently/verify/slice`)
  - "review this auth and invoice payment slice for security" → **security-compliance 18.5**
  - "write a database migration for the new schema" → **database-data 12.5**
  - "implement this vertical slice" → **software-engineer 19.0**
- Per-token dedup: a spam agent repeating "slice" across 5 triggers + 3 capabilities scored
  exactly **3** (one deduped shared token) vs a genuine phrase match at **19** — the previously
  fixed repetition bug stays closed.
- `validateAgentFrontmatter` rejects missing name / name≠filename / kind≠agent / empty
  capabilities / empty triggers (unit-driven).
- `appendSelection`/`readSelections` round-trip a 2-record JSONL selection log.
- Fail-closed gate proven Admin-side (agents:check): broken frontmatter → FAIL exit 1;
  a generic colliding trigger → routing self-consistency FAIL exit 1.

## Defects
None.
