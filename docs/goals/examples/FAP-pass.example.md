---
goal_id: ship-invoicing
disposition: boundary
boundary_class: merge-to-main
boundary_evidence_kind: gate_state
boundary_evidence: "merge-pr.mjs exit 1: required checks green but no founder-approved label (gh api repos/.../labels => [])"
founder_burden_category: per_action_authorization
autonomous_work_done: true
verify_clean: true
resume_goal: "/goal resume FAP-ship-invoicing"
---
# Founder Action Package — ship-invoicing

> FIXTURE (PASS). A well-formed boundary FAP: a recognized §3 class (merge-to-main), a hard re-checkable
> evidence kind (gate_state) with non-empty evidence, a resume_goal, and verify_clean:true. The goal-stop
> Stop-hook VALIDATES this and CLEARS the goal (boundary = STOP = SUCCESS).

## 1. Status (one screen)
The invoicing feature is built, independently verified, and live in DEV. It is waiting only for your
go-ahead to merge to production.

## 2. What I completed
- Built the invoicing slice — commit `abc1234`, PR #12.
- Verified it independently — `docs/verify/VERIFY-invoicing.md` (verify_status: verified).
- Deployed to DEV and posted the founder review package.

## 3. What remains
After you approve, the next autonomous segment merges to prod, runs the smoke battery, cuts release notes,
and files the learning review.

## 4. WHY I stopped (the boundary)
The next step is **merging the PR to production**; only you can do it because the merge gate is fail-closed
on a CODEOWNER `founder-approved` label that no automation may apply.
- **Boundary class:** `merge-to-main`  ·  **evidence kind:** `gate_state`
- **Evidence:** `merge-pr.mjs exit 1: required checks green but no founder-approved label (gh api labels=[])`

## 5. Exactly what to do (zero technical knowledge)
1. Open the PR: **https://github.com/RUMAH-OS/example/pull/12**.
2. Click the **Labels** gear (right side) and add **`founder-approved`**.
3. **Success looks like:** the label appears and the merge check turns green. ✅

## 6. Rollback (if relevant)
N/A — approving the label does not deploy anything; the next /goal resume does, with its own DEV-verified gate.
The safe restore point is `abc1234`.

## 7. Resume the next autonomous phase
```
/goal resume FAP-ship-invoicing
```
