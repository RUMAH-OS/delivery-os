---
slice: "operating-model-milestone-wiring — milestone-report.mjs gains a REPORTING-ONLY Operating-Model Check section (delivery-os side)"
verify_status: verified
author: "software-engineer subagent (build, 2026-06-15)"
verifier: "qa-test subagent (independent invocation a6739851, 2026-06-15)"
date: "2026-06-15"
independence_basis: "recorded-distinct-invocation (author≠verifier; the builder and verifier are separate dispatched subagents, neither is the orchestrator)"
machine_probe: "node ../delivery-os/templates/tools/milestone-report.mjs --self-test  # exit 0 = 23/23 incl operating-model reporting-only assertions"
---

# VERIFY — Operating-Model Check wiring into milestone-report.mjs (delivery-os)

Companion to the rumah-admin-side `docs/verify/VERIFY-operating-model-wiring.md` (same independent qa-test
invocation), recorded on the delivery-os side because `templates/tools/milestone-report.mjs` is a delivery-os
implementation file and the delivery-os verify-gate requires its VERIFY record here.

## What was verified (real output, independent qa-test invocation)
- `node templates/tools/milestone-report.mjs --self-test` → **exit 0, 23/23 PASS**, including the new
  assertions: the `OPERATING-MODEL CHECK` section header is emitted; the renderer produces the
  `| Area | Claude | Agents | Target | Status |` table from `operating-model-check --json`; TOOL-AUTOMATED and
  UNMEASURED honesty render correctly; unparseable input is tolerated; **graceful-skip** when the tool is absent.
- **REPORTING-ONLY guarantee (load-bearing):** `overallVerdict({capOk, expRan, expOk})` takes ONLY capability +
  experience inputs; the operating-model summary (`omSummary`) appears solely in the printed recap and is
  NEVER an input to the verdict. A negative self-test assertion confirms it. So a RED operating-model area can
  never fail a milestone.
- **Fail-open:** absent `operating-model-check.mjs` → logged skip, never a crash, never a fake Green.

## Verdict
PASS — `verify_status: verified`. The wiring is reporting-only, fail-open, and does not influence any gate or
verdict. (The role-area numbers themselves are verified separately in
rumah-admin `docs/verify/VERIFY-operating-model-check.md`.)
