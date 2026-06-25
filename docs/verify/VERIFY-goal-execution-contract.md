---
verify_status: verified
slice: goal-execution-contract
author: implementation-session(coordinated)
verifier: independent-qa-subagent
date: 2026-06-25
machine_probe: node templates/tools/goal-stop.mjs --self-test
---

# VERIFY — goal-execution-contract

## Evidence (verbatim)

### Command 1: goal-init self-test
```
goal-init --self-test PASS — clears_on is ALWAYS the invariant structural pair [objective_complete, valid_fap_at_boundary] and never names a human-gated terminal (the §5 infinite-idle fix); --id overrides the slug; the H1 cap defaults apply and partial overrides merge; a resume carries the prior FAP signature for H7 de-dup; an empty objective fails closed.
```

### Command 2: goal-stop self-test
```
goal-stop --self-test PASS — no active goal allows the stop; an active goal with no FAP BLOCKS (continue); a fresh valid boundary FAP CLEARS; H4 a no_tool-ALONE FAP is REJECTED (and no_tool+hard-kind is accepted); a stale or evidence-less FAP does not clear; H1 the wall-clock/turn cap trip BLOCKS demanding a cap_tripped failure FAP, and stop_hook_active=true ALWAYS allows the stop (no re-entrant loop); H7 a duplicate-boundary resume escalates unless escalated:true; H6 a `complete` FAP needs verify_clean:true.
```

### Command 3: boundary-classify self-test
```
boundary-classify --self-test PASS — H3 permanent/authorization denials (gate/credential/classifier) classify as boundary; rate-limit/5xx/timeout/network classify as transient (retry, no FAP); a retriable class with its budget exhausted becomes a failure; H4 no_tool-alone is a boundary terminal but NEVER warrants a clearing FAP (soft-flagged); an unclassified error defaults to transient (the H1 cap, not a fake boundary, ends it).
```

### Command 4: node --check syntax validation
```
ALLCHECK-OK
```

### Command 5: manifest registration check
```
tools 28 goalstop true fapskill true
```

## Per-claim
- goal-init self-test: PASS
- goal-stop self-test (asserts H1 cap-trip, H4 no_tool-reject, clear-on-valid-FAP, block-no-FAP, H6, H7): PASS
- boundary-classify self-test (H3 permanent/transient, H4): PASS
- node --check all three: PASS
- manifest-registered (goal-stop + founder-action-package): PASS

## Honest limits
- H2 (verify-gate FAP-awareness) is spec-only this slice (docs/H2-verify-gate-fap-awareness.md) — a known follow-up, not a defect.
- goal-stop proves a FAP exists + is well-formed with re-checkable evidence; it cannot prove the boundary JUDGMENT is honest (contract §7) — backstopped by the permission classifier + the founder reading the FAP.
