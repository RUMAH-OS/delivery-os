---
artifact: SPRINT 1.0 — ACTION 2 EVIDENCE (install enforceable CODEOWNERS) + a material discovery
id: SPRINT-1.0-ACTION-2-EVIDENCE
date: 2026-06-28
status: PARTIAL — done+verified on the 2 unprotected repos; the 3 live repos are gated on (a) the Builder PAT (PR-based install) and (b) reconciling pre-existing ORG-LEVEL protection. PO did not force prod pushes.
---

# Action 2 — CODEOWNERS install

## Done + verified (founder-authorized, Option 2)
| Repo | Branch | Result | Verified content |
|---|---|---|---|
| **delivery-os** | main | **updated** (commit `75b017896`) — replaced the role-token CODEOWNERS | `* @bkasanwiredjo` |
| **jarvis-slack-control-surface** | **master** | **updated** (commit `912ccfad4`) | `* @bkasanwiredjo` |

*delivery-os previously routed to **non-existent role handles** (`@software-engineer`, `@owner`, `@qa-test`,
`@integration-architect`) → its code-owner gate was theatre; now every path resolves to a real, enforceable
identity. jarvis's default branch is **`master`** (not `main`) — corrected in `branch-protection.json` for Action 3.*

## MATERIAL DISCOVERY — the live repos already have ORG-LEVEL protection
The direct CODEOWNERS push to **rumah-admin** was rejected by GitHub itself (not the Claude guardrail — the script
ran): **`409: Changes must be made through a pull request. Required status check "build-and-migrate" is
expected.`** Reconnaissance:
- `repos/RUMAH-OS/rumah-admin/branches/main/protection` → **404** (no *classic* branch protection).
- `repos/RUMAH-OS/rumah-admin/rulesets` → **empty** (no *repo-level* ruleset).
- `orgs/RUMAH-OS/rulesets` → **needs `admin:org` scope** (current token lacks it) — so the protection is an
  **org-level ruleset** I cannot currently introspect.
- delivery-os + jarvis pushes **succeeded** → the org ruleset targets the live repos (at least rumah-admin), not
  the framework/undeployed repos.

**Implications (affect Actions 2 + 3):**
1. **CODEOWNERS on rumah-admin / property-lead-os / rumah-housing-website must go via PR** (the correct flow) —
   which requires the **Builder PAT** in the session (the agent opens the PR as `rumah-os-builder`).
2. **Action 3 must RECONCILE, not duplicate.** The worker's `apply-branch-protection.sh` uses the *classic*
   protection API; the live repos are governed by an *org ruleset*. Applying classic protection on top would create
   two overlapping protection sources (confusing + drift-prone). The right move is to **read the existing org
   ruleset and extend it to the Sprint 1.0 standard** (add `require_code_owner_reviews` + the full required-check
   set + no-bypass), or deliberately choose repo-level — a decision that needs visibility into the org ruleset.

## Blocked-on-founder (two asks)
1. **Builder PAT** (already pending from Action 1) — fine-grained, `rumah-os-builder`, Contents+PRs write on the
   repos — so the live-repo CODEOWNERS land via PR (and for Action 6's blocked-self-merge proof).
2. **Org-ruleset visibility** — either `gh auth refresh -h github.com -s admin:org` (grant the scope so the PO can
   map + reconcile the org ruleset), or share the org ruleset config. Required to do Action 3 correctly.

## Action 2 DoD coverage
| Clause | Status |
|---|---|
| delivery-os `/CODEOWNERS` resolves to a real identity | **DONE** (`* @bkasanwiredjo`, verified) |
| jarvis `/CODEOWNERS` resolves to a real identity | **DONE** (verified, on `master`) |
| rumah-admin `/CODEOWNERS` | **DONE** — PR #23 (Builder→founder merge; required checks green; replaced theatre role-tokens) |
| rumah-housing-website `/CODEOWNERS` | **DONE** — PR #2 (Builder→founder merge; `verify` green) |
| property-lead-os `/CODEOWNERS` | **BLOCKED** — PR #230; `ci-static` "OS drift check" rejects real identities (see below) |

## Update (post standing-authorization; both gh identities available)
4 of 5 done: **delivery-os, jarvis** (direct, unprotected) + **rumah-admin #23, rumah-housing-website #2** (via PR
as Builder `rumah-os-builder` → reviewed+merged by founder `bkasanwiredjo`; author≠merger proven end-to-end). The
live-repo CODEOWNERS replaced the same **theatre role-tokens** (`@software-engineer`/`@qa-test`/`@founder`/`@owner`).

**PLOS BLOCKED — a real legacy conflict.** `ci-static` runs the vendored drift-lint `check-os-drift.mjs`, whose
CODEOWNERS check (`templates/tools/check-os-drift.mjs:29-37`) requires every handle to have a backing
`.claude/agents/<handle>.md`, exempting only the OLD role tokens (`owner`/`founder`, line 34) — so it **rejects the
real `@bkasanwiredjo`** ("void author≠verifier binding"). The legacy lint encodes the very theatre model we're
removing. **Fix:** make the human/real-identity exemption recognize real GitHub identities (project-configurable,
keeping delivery-os project-agnostic) — a delivery-os **source** change → re-vendor → re-tag (affects the Action-4
drift-gate pin: v5.0 → v5.1). Tracked as a deliberate slice; PLOS CODEOWNERS lands after it.

**Also surfaced:** rumah-admin's `validate prod config (fail-closed)` check **fails** (CI has empty
`VERCEL_TOKEN/ORG_ID/PROJECT_ID`) — pre-existing/environmental, **non-required** (didn't block #23) → tracked to
Sprint 1.1/1.2. And **Action 5 (production Environment) is blocked**: the GitHub plan doesn't support environment
required-reviewers (422) → founder decision (upgrade vs an alternative D7 gate).

**PO note:** the pre-existing org-level protection is a *good* find caught early — it prevents Action 3 from
creating conflicting protection. Action 2 proceeds to completion via PR on the live repos once the Builder PAT
lands; Action 3 is reframed as *reconcile the org ruleset*, pending `admin:org` visibility.
