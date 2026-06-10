# Delivery OS v3.1 — Verification Enforcement (Corrective Action of Record)

> Principle-11 review **of the framework itself**. 5 independent blind lenses — Architect · Reviewer/Critic · QA/Verifier · Platform/Automation · Operations — on the question: *"What controls must exist so the Slice-1.0 failure mode cannot silently recur across any project?"* Date 2026-06-10. Branch `fix/operationalize-author-verifier`. **Not auto-merged — for founder ratification.**

## 1. Framework Defect Report
**Defect:** Delivery OS v3 *documented* Author≠Verifier (§3) and consequential-review (§11) but had **zero mechanical enforcement** — every gate was consent-based and conditional on a precondition the incident proved is not guaranteed:
- §3 enforced **only** by CODEOWNERS-on-a-git-PR → inert with no git (the live case).
- CI checks → "degrade silently where no CI."
- Skills dispatched by **native description-matching = model discretion, no hook**.
- The scaffolder wrote **no `git init` and no `.claude/settings.json`**; `.claude/` was never created in the failing project.

A grep of the framework for `hook|settings.json|PreToolUse|git init` returned **zero** real matches — confirming no enforcement plane existed. **Result:** one orchestrator played author, verifier, and reporter; a generated, unexecuted scaffold was presented as progress; recurrence was *guaranteed*, prevented only by memory. Full incident: `case-studies/2026-06-10-author-verifier-not-operationalized.md`.

## 2. The 8 candidate controls — verdicts (consolidated across 5 lenses)
| # | Control | Verdict | Note |
|---|---|---|---|
| 1 | No Git = No Project | **ACCEPT (modified → "No Git = No *Build*")** | `git init` is free and unconditional at scaffold; the gate only bites at the first implementation commit. Discovery/docs/spikes exempt. Scaffolder-enforced, fail-closed. |
| 2 | No Verify Artifact = No Completed Slice | **ACCEPT** | But the artifact must be the **captured output of a real independent run**, never a hand-authored form (else it's the same self-attestation in new clothes). |
| 3 | Author≠Verifier Fallback | **ACCEPT — load-bearing** | The literal hole. No-VCS ⇒ a *separate verifier run* (distinct invocation) authors the artifact. Expires into CODEOWNERS where git exists. |
| 4 | `verify_status` tracking | **ACCEPT only as DERIVED** | A hand-edited field = self-attestation again (Reviewer/Critic REJECTed the stored-and-edited form; §7 "duplicate with no owner"). Machine-computed from evidence; never author-set. |
| 5 | Router Visibility | **ACCEPT as advisory (zero enforcement credit)** | Visibility didn't fail; *enforcement* did. Useful to surface; must be machine-written, never a hand-kept gate. |
| 6 | Automatic Verify Gate (hook) | **ACCEPT — keystone** | The only model-independent element. Makes the other seven real. |
| 7 | Definition of Done | **ACCEPT (amend, don't duplicate)** | Add row 4a + close the self-QA loophole on the existing DoD; the hook checks rows 3/4/4a/9. |
| 8 | Status Language | **ACCEPT (extend, don't fork)** | `planned→generated→executed→verified` extends the existing ladder; derived, not self-declared. Encodes Executed≠Verified — the exact lie that occurred. |

**No rejects of the *intent*; four MODIFYs**, all the same caution: do not add a field/file/word the same single actor must remember to honor — that *is* the incident, re-shipped.

## 3. Corrective Action Plan (shape: 3 gates · 2 hooks · 1 status spine)
- **Project-entry gate** (control 1) — scaffolder `git init` + `main`/`dev` + installs the hook; fails closed.
- **Slice-completion gate** (controls 2+3+7) — the hook refuses `verified` without an independent `VERIFY-<slice>.md` satisfying the DoD.
- **Phase-advancement gate** (controls 4+5) — derived `verify_status`, surfaced in the router; can't advance while `unverified`.
- **The two structural enforcers**: control 1 (scaffolder) + control 6 (the hook). Controls 2,3,4,5,7,8 are conventions those two mechanically check for.

## 4–7. Proposed Delivery OS Changes (implemented on the branch)
| Plane | Change | File |
|---|---|---|
| **Governance** | **§12** — verification is operationally enforced (chain + honest limit) | `core/GOVERNANCE.md` |
| **DoD** | **Row 4a** (VERIFY artifact mandatory) + derived status table + closed self-QA loophole | `core/DEFINITION-OF-DONE.md` |
| **Operating Loop** | Status ladder (derived) + the verify-gate section | `core/OPERATING-LOOP.md` |
| **Hook (new plane)** | `verify-gate.mjs` (Node, cross-platform) + `settings.json` template + committed `githooks/pre-push` | `templates/hooks/`, `templates/settings.json.template`, `templates/githooks/pre-push` |
| **Artifact** | Falsifiable `VERIFY-<slice>.md` template (execution evidence · independence header · per-criterion-on-real-surface · classified assumptions · gate ledger) | `templates/VERIFY.md.template` |
| **Scaffolder** | `git init` + `main`/`dev` + install hook + `core.hooksPath` + fail-closed asserts + install `verify-gate` skill | `scripts/new-project.sh` |
| **Router** | Always-on rule ("no slice reported the turn it was authored") + verification-status line | `templates/CLAUDE.md.template` |
| **Skill** | New `verify-gate` skill; (self-check note to review skills — follow-up) | `skills/verify-gate/SKILL.md` |
| **Changelog / Case study** | v3.1 entry + lesson-learned | `CHANGELOG-v3.md`, `case-studies/2026-06-10-…md` |

## 8. Migration Strategy
1. **Delivery OS first** (this branch) — ship + dogfood the gate (confirm it actually blocks a turn). Nothing downstream is real until this lands.
2. **PLOS** — already satisfies 1/6-substrate/7 (git, CI, CODEOWNERS); retrofit = drop the hook into `.claude/settings.json` + adopt `docs/verify/VERIFY-<slice>.md` naming + confirm branch protection is *on*, not just documented. Adopt at a milestone boundary.
3. **Rumah Admin** — the hard case (no git, unverified scaffold). `git init` → `main`/`dev` → first commit of existing docs/ADRs/VERIFY/scaffold (message states "Slice 1.0 NOT verified") → install `.claude/` + hook → private GitHub repo (`gh`) → branch protection + real CODEOWNERS handles → then bring Slice 1.0 to `verified` via its 6 builder-controllable steps (drizzle bump, src-importing app/API tests, rollback test, FK tightening, real green CI) under the now-live gate.
4. **The Floor / Content OS (future)** — born correct through the fixed scaffolder; no retrofit ever.

## Mandatory vs advisory — and what prevents recurrence
- **Mandatory / mechanical (prevent recurrence):** **1** (git substrate), **6** (the hook), **3** (independent verifier, hook-checked), **2** (the artifact the hook checks for). This quartet makes "generated scaffold presented as done by a single identity" *mechanically impossible* at commit/push/turn-end.
- **Mandatory but derived:** **4** (verify_status, machine-written), **7** (DoD amended), **8** (status ladder).
- **Advisory / ergonomics (no enforcement credit):** **5** (router visibility — points to derived status).
- **Rejected forms:** hand-edited `verify_status`; hand-authored VERIFY form; "No Git = No Project" applied to discovery; per-slice rubber-stamp templates.

## The one disagreement we did NOT smooth (Governance §11)
The **Architect** ACCEPTed controls 4 & 5 as-is (machine-written); the **Reviewer/Critic** REJECTed them as *stored/hand-edited self-attestation* — "the same failure wearing a name tag," and a §7 duplicate-with-no-owner. **Resolution (held, not buried):** both are right about different forms. We ACCEPT 4/5 **only in the derived, machine-written form** (QA + Platform + Architect all converge here) and **REJECT any hand-edited form** (the Reviewer's actual target). The status spine is *computed by the gate from git/artifact evidence and displayed*, never authored by the actor being verified.

## Honest limit (stated, not hidden — Governance §5)
A hook proves a fresh, passing, independence-*claimed* artifact **exists**; it cannot prove the verification was *truthful* or genuinely independent inside a single-agent runtime. The committed `pre-push` hook and CODEOWNERS-on-a-real-PR-with-a-second-reviewer are the only fully model-independent layers — which is why git (control 1) is mandatory, not advisory. The gate raises faking from "forgetting" to "deliberate, logged bypass."
