---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — census-detector + file-lesson idempotency (canonical) OPERATE (local, independent)

Canonical-side record of the independent verification of the G4 idempotency fixes. Full block-demo
evidence is in `rumah-admin/docs/verify/VERIFY-learning-enforcement-local.md`.

## Scope
- `templates/tools/census-detector.mjs` — `--append` is now IDEMPOTENT (reads the ledger, skips
  patterns already present, keyed by norm(pattern); marker block). Re-runs are no-ops.
- `templates/tools/file-lesson.mjs` — append skips a signal whose {pattern, source} already exists.

## Verdict: verified
- census `--self-test` + file-lesson `--self-test` exit 0.
- Idempotency proven (independent QA): same candidate appended 1×/2×/100× → exactly ONE ledger row;
  same {pattern,source} filed 2×/100× → ONE signal; a distinct source still appends (correct).
- End-to-end loop proven: retro lessons → file-lesson → signals → census --append → candidate row;
  re-run → no duplicate. This makes the lesson→capability ledger AUTO-FED without duplication.

## Honest boundary
Layer-A enforcement wiring (triggered by slice-close/push), NOT A3 autonomous agent execution.
