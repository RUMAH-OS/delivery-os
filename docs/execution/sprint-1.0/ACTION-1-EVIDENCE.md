---
artifact: SPRINT 1.0 — ACTION 1 EVIDENCE (builder/verifier identity configured, Option A)
id: SPRINT-1.0-ACTION-1-EVIDENCE
date: 2026-06-28
status: Action 1 DECISION + IDENTITY EXISTENCE + COMMIT-IDENTITY CONFIG = DONE & verified. One operational prerequisite remains before the floor can be PROVEN (Action 3/6): the Builder push/PR credential in the agent session.
verified by: PO (against the Sprint 1.0 Action-1 DoD), via live `gh`/`git` queries — not assumed.
---

# Action 1 evidence — Option A on the three-identity abstraction

## Decision (recorded)
**Option A** (Builder commits/opens PRs under a distinct identity; `bkasanwiredjo` is the Verifier-approver),
implemented on the durable **three-identity abstraction** (Builder · Verifier · Project Owner) per the founder
directive (2026-06-28). See `IDENTITY-AND-VERIFICATION-MODEL.md` §2.

## Verified facts (live queries)
| Fact | Value | Source |
|---|---|---|
| Builder account exists + named | `rumah-os-builder` | `gh api users/rumah-os-builder` |
| Builder GitHub user id | **297716141** (type `User`) | same |
| Builder permission — delivery-os | **write** (NOT admin) | `gh api repos/RUMAH-OS/delivery-os/collaborators/rumah-os-builder/permission` |
| Builder permission — rumah-admin | **write** | same endpoint |
| Builder permission — property-lead-os | **write** | same |
| Builder permission — jarvis-slack-control-surface | **write** | same |
| Builder permission — rumah-housing-website | **write** | same |
| Builder commit identity (delivery-os, LOCAL) | `rumah-os-builder` / `297716141+rumah-os-builder@users.noreply.github.com` | `git config --local --get user.name/.email` |
| Founder global git identity | unchanged (`Brian` / `briankas@live.nl`) | `git config --global` |
| Founder GitHub user id (resolves `FOUNDER_ID` for the production Environment, Action 5) | **17454051** | founder noreply email |

**Least-privilege confirmed:** the Builder is **Write, never Admin** on all 5 repos — it cannot bypass branch
protection or change settings (the model's requirement; the earlier `[true]` in a batch query was a `jq` quirk, not
admin — the canonical `/permission` endpoint says `write`).

## Configured this step
- **Builder commit-author identity** set **locally** in delivery-os (`git config --local`) — so future agent commits
  here are authored by `rumah-os-builder`. The founder's **global** identity is untouched (no cross-contamination).
- *Each repo the Builder works in gets the same one-time `git config --local` (a per-repo step, done as work reaches that repo).*

## The one operational prerequisite remaining (founder-provided secret)
**The Builder's push/PR-open credential is NOT yet in the agent session** (`gh auth status` shows only
`bkasanwiredjo`; no `GH_TOKEN`/`GITHUB_TOKEN` set). This matters because GitHub's self-approval block keys on the
**PR-author = the authenticated account that *opens* the PR**, not the commit author. So until the agent
authenticates as `rumah-os-builder` for push + `gh pr create`, a PR would be *opened by* `bkasanwiredjo` →
`bkasanwiredjo` could not approve it → the very deadlock the floor is designed around.

**Founder step (secure — do NOT paste the token here):** mint a **fine-grained PAT** for `rumah-os-builder`
(scope: **Contents: write + Pull requests: write** on the 5 repos, nothing else) and add it to the agent session as
the Builder identity — e.g. `gh auth login --with-token` (or `gh auth login` as `rumah-os-builder`) so git uses it
as the credential helper, with `gh auth switch` selecting the Builder for build/PR operations. This is **required
before Action 3's branch-protection test and Action 6's blocked-self-merge proof** (it is not required for Action 2,
which only routes CODEOWNERS approval to the founder).

## Action 1 DoD coverage
| Action 1 DoD clause | Status | Evidence |
|---|---|---|
| identity model decided (A or B) + recorded | **DONE** | this file + tracker + IDENTITY-MODEL §3 |
| the distinct builder identity exists + is named | **DONE** | `rumah-os-builder` (id 297716141) |
| builder is least-privilege (write, not admin) | **DONE** | per-repo `/permission` = write |
| builder commit identity configured | **DONE** (delivery-os; per-repo as reached) | `git config --local` |
| builder can *act* as author (push/open PR) | **PENDING** founder PAT → required for Action 3/6 | — |

**PO verdict:** Action 1's decision, identity, least-privilege, and commit-identity configuration are **verified
DONE**. We may proceed to **Action 2 (install CODEOWNERS)** now — it does not depend on the Builder PAT. The PAT is
the next operational prerequisite and must land before Action 3 (apply protection) / Action 6 (prove the floor).
