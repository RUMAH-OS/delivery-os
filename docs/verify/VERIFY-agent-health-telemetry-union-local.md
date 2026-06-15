---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — agent-health telemetry-window UNION (canonical) OPERATES (local, independent)

Canonical-side record of the independent verification of the telemetry-union fix in
`delivery-os/templates/tools/agent-health.mjs`. Full block-demo evidence (incl. the Admin-side
idle-check that consumes it) is in `rumah-admin/docs/verify/VERIFY-anti-idle-enforcement-local.md`.

## Bug fixed
The subagent telemetry corpus is split across multiple per-session dirs
(`~/.claude/projects/<project>/<session>/subagents`). Reading ONE (most-recent) made the rest of
the window invisible and false-flagged used agents as IDLE. The window is now the UNION of all
resolved dirs (`--telemetry` repeatable + `--telemetry-glob`; `readTelemetryUnion` dedups by path).

## Verdict: verified
- self-test PASS incl. the union case (2 temp dirs, counts sum + dedup) + `expandTelemetryGlob`.
- Union SUMMARY against the real corpus: named agents now show USED (`19 used · 0 idle`, 295
  invocations) where the old single general-purpose-only dir read `2 used · 17 idle` — the
  false-idle the union fixes. Load-bearing criterion (union fixes false-idle) PASS.
- Backward-compatible: a single `--telemetry <dir>` still reads exactly that dir.

## Defects
None. (One advisory: a prior spec's hard-coded "2 idle" expectation was stale — the 2 agents
accrued real records this session and are correctly USED on the true window.)
