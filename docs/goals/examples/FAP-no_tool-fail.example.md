---
goal_id: ship-invoicing
disposition: boundary
boundary_class: physical
boundary_evidence_kind: no_tool
boundary_evidence: "no tool can press the physical reset button on the office router"
founder_burden_category: manual_setup_step
autonomous_work_done: true
verify_clean: true
resume_goal: "/goal resume FAP-ship-invoicing"
---
# Founder Action Package — ship-invoicing  (FIXTURE: FAIL — H4)

> FIXTURE (FAIL). This FAP claims a boundary on `no_tool` ALONE — an unbounded negative the Stop-hook
> cannot re-check. Under H4 a `no_tool` kind is INVALID unless it co-occurs with a hard re-checkable kind
> (credential_absent | gate_state | tool_denial | cap_tripped). goal-stop REJECTS this: it does NOT clear
> the goal — it blocks and (per §6.2) the claim is flagged for the friction log + a spot-check.
>
> To make it valid you would have to either (a) it genuinely IS automatable (then do the work, no FAP), or
> (b) co-occur a hard kind, e.g. `boundary_evidence_kind: no_tool, credential_absent`.

## 4. WHY I stopped (the boundary)
"No tool exists to do X" — with no credential probe, no gate state, no verbatim denial. This is exactly the
abuse vector the contract closes: a soft negative posing as a mechanism (judgment, not evidence — §6.2/H4).
