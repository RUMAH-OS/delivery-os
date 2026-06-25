# ADR-002 — The verification-enforcement layer: server-side binding gate, local hook demoted to advisory

- **Status:** **ACCEPTED — 2026-06-25.** The binding verification gate is the required CI `verify-coverage` status check + GitHub branch protection + CODEOWNERS review at the PR/merge; the local verify-gate hook is demoted to a non-blocking advisory + auto-verifier. In effect now, inherited by every repo with git + CI.
- **Date:** 2026-06-25
- **Supersedes/evolves:** `core/GOVERNANCE.md` §12 (the prior "the verify-gate hook fires without the builder's consent" enforcement framing) — *evolves; the author≠verifier invariant and the semantic-fingerprint freshness rule (D8) are untouched.* Relates to `DECISIONS.md` **D9**.
- **Decision class:** CONSEQUENTIAL (architectural ∩ kernel ∩ security-sensitive ∩ production-readiness — Governance §11/§13). It changes where the OS's flagship safety control fires.
- **Panel:** a 4-lens governance board — architecture · PR-lifecycle+governance · security · production-readiness. **Unanimous** for Alt 5 (server-side binding + local advisory). No single agent adjudicated. Founder-approved.

## Context
The local verify-gate hook (`PreToolUse` deny on `git commit`/`git push` · `Stop` block on turn-end · `PostToolUse` warn) was the OS's primary mechanism for §12 "verification is operationally enforced, not remembered." Field operation surfaced five findings that the board treated as load-bearing:

1. **Wrong act gated.** The hook **blocked a REVERSIBLE commit** while leaving the **IRREVERSIBLE merge** to a weaker check. A commit can be amended, reset, or rebased away at no cost; the merge to main is the act that cannot be taken back. A safety control should bind tightest at the irreversible boundary, not at the cheap, recoverable one.
2. **Bypassable (4+ paths).** `git commit --no-verify`, `DELIVERY_OS_GATE_BYPASS=1`, an **unconfigured clone** (the hook simply isn't installed), and any **web / non-Claude merge** (GitHub UI, a different client) all sail past the local hook. A control with four bypass doors is policy wearing a mechanism's clothes.
3. **Cannot prove independence (§12 Honest Limit).** A local hook in a single-agent runtime can confirm an independence-*claimed* artifact **exists**; it cannot prove the verification was genuinely independent. The §12 Honest Limit already stated that only CODEOWNERS-on-a-real-PR can.
4. **False positives bred habituated bypass — a safety regression.** Dozens of blocks per goal, **>60% of them on non-functional churn** (docs, governance, formatting, rebases, merge commits). Operators learned to reach for `--no-verify`/the bypass env var reflexively — habituation that *weakens* the floor the hook was meant to raise.
5. **Manufactured fake boundaries (§16 contradiction).** The `Stop`-block halted turns at points that were **not real founder boundaries**, manufacturing pre-boundary boundaries the goal could never autonomously clear — the same idle-loop class §16 names (the "merged to main" Stop-hook loop).

## The board verdict (unanimous — Alt 5)
All four lenses independently converged on the same architecture and surfaced no dissent worth preserving:
- **Server-side branch protection makes author≠verifier a PLATFORM invariant** — GitHub itself bars a self-approval; independence stops depending on a remembered choice or a trusted local runtime.
- **A required CI status check re-runs the `machine_probe` on neutral hardware** — off the author's machine, so "part of the evidence still passes" is verified by an independent runner.
- **The semantic fingerprint makes it near-zero-false-positive** — coverage is checked against the normalized `impl_fingerprint` (D8), so non-functional churn does not fire it, killing finding 4 at the source.
- **The local hook becomes the honest advisory it can be** — a fast, cheap nudge + auto-verifier that helps the author *not forget*, without pretending to be the binding control (§13: mechanism belongs where it is model-independent).

## Decision
Two layers, cleanly split:
1. **BINDING (server-side, un-bypassable):** a REQUIRED CI status check **`verify-coverage`** (`.github/workflows/verify-coverage.yml`) + **GitHub branch protection** (provisioned by `setup-branch-protection.mjs`) + **CODEOWNERS review** at the PR/merge. The check (a) confirms a fresh, independent `VERIFY-<slice>.md` **semantically covers** the changed impl via the normalized fingerprint (`verify-fingerprint.mjs`) and (b) **re-runs the slice's `machine_probe`** on the runner (exit 0 required). Branch protection bars self-approval and merge-on-red; CODEOWNERS binds a second principal. This is the model-independent, irreversible-act-bound layer the §12 Honest Limit pointed to.
2. **ADVISORY (local, never blocks):** the verify-gate hook is demoted to `PostToolUse` baseline + advisory warn + an **auto-verify** nudge that offers to produce a missing VERIFY. It surfaces a coverage gap early and cheaply. It carries **no** `PreToolUse` deny and **no** `Stop` block — it cannot halt a commit, a turn, or a goal.

The author≠verifier invariant (§3) is **unchanged and now PLATFORM-enforced**. The semantic-fingerprint freshness rule (§12, D8) is **unchanged** and is exactly what makes the binding check low-noise.

## Consequences
- **Positive:** verification is enforced where it is **un-bypassable and model-independent**; the irreversible act (merge) is the gated act; false positives collapse to near-zero (semantic fingerprint), ending habituated bypass; the §16 manufactured-boundary idle loop is closed; the §12 Honest Limit is **resolved for any git+CI repo** (CODEOWNERS-on-PR is the independent layer it named).
- **Negative / accepted:** the binding gate requires git + CI + branch protection to exist — so a **no-VCS / single-principal** context retains the old Honest Limit and falls back to a *separate verifier run* as the strongest available form (§12). This is why git remains mandatory (§12 link 1), not advisory. The local hook no longer stops a determined bypass at commit time — acceptable, because the server-side gate stops it at merge time, which is the act that matters.
- **The honest limit (residual):** survives **only** in the no-VCS fallback; everywhere git + CI exist, the platform enforces independence.

## Migration sequence (safety-sequenced — order is load-bearing)
1. **CI gate FIRST.** Land `.github/workflows/verify-coverage.yml`, mark it a **required** status check, and provision branch protection + CODEOWNERS (`setup-branch-protection.mjs`) — so the binding floor exists **before** the local floor is lowered.
2. **THEN demote the local hook** to advisory + auto-verify (remove the `PreToolUse` deny + `Stop` block). Never demote first — that would leave a window with no binding verification gate.
3. **THEN inherit** — propagate the workflow (the `workflows` manifest class) + the demoted hook to every repo via the scaffolder / `os-inherit`, so new repos are born with the binding gate server-side and the advisory hook local.

## What is UNCHANGED (explicit)
- **The C6 human-merge gate is UNCHANGED.** A merge still requires a founder-approved label applied by a CODEOWNER. This ADR **strengthens the verification floor; it does NOT authorize lights-out auto-merge.** The D3 Class-A auto-merge remains DEFERRED (ADR-001).
- **author≠verifier (§3)** — unchanged in substance; now platform-enforced rather than hook-enforced.
- **Semantic-fingerprint VERIFY freshness (§12, D8)** — unchanged.
- **The Class C / irreversible-business-act human gate (§6/§11/§16)** — unchanged.

## References
- `.github/workflows/verify-coverage.yml` (the required CI check — owned/built by the CI-tools track)
- `setup-branch-protection.mjs` (branch-protection provisioning — owned by the CI/deployment track)
- `verify-fingerprint.mjs` / `templates/tools/verify-fingerprint.mjs` (the normalized semantic fingerprint, shared with §12/D8)
- `core/GOVERNANCE.md` §12 (enforcement), §13 (mechanism/policy line — canonical example), §16 (boundary)
- `DECISIONS.md` D9 · `capabilities/CANONICAL-SDLC.md` (verify-coverage rows) · `skills/verify-gate/SKILL.md`
