# Delivery OS — Capability Ledger (the deterministic chain, tracked)

> The spine of: **Founder Reality → Capability Backlog → candidate (skill/agent/gate/automation) →
> Verified capability → OS Foundation → OS Upgrade Path → every project inherits.**
> Every founder pain earns a row; the row advances left→right until every project inherits the fix.
> FED BY: `learning-review` (post-milestone) + `census-detector` (≥3× pattern). PROMOTED BY: the
> OS upgrade path (os-sync). The goal: future projects get harder to break because every lesson
> becomes a capability and every proven capability becomes part of the OS.

**Chain stages:** `founder-reality` → `candidate` → `building` → `verified` (independent QA) →
`in-OS` (canonical in delivery-os) → `propagated` (every project inherits via the upgrade path).
**Class:** `OS-foundational` = inherited by every project · `project-earned` = stays local (earned per project).

## Verified capabilities (proven; chain status)
| Capability | Founder reality that earned it | Kind | Class | Status | Canonical home / provenance |
|---|---|---|---|---|---|
| seam-gate + executable seam contract (#1/#2) | HTML/text + missing-notice reached the live send | gate | OS-foundational | **in-OS** (used by Admin+PLOS; not yet propagated by upgrade path) | `templates/tools/seam-gate.mjs` + `contracts/admin-plos-seam-v1.mjs` |
| integration-architect (#3) | nobody owned the cross-repo seam | agent | OS-foundational | **propagated** (os-sync handles agents) | `.claude/agents/integration-architect.md` |
| lifecycle-gate (#16) | LC-1: `contract.terminated` had no `contract.reinstated` (reversible lifecycle broke) | gate | OS-foundational | **in-OS** | `templates/tools/lifecycle-gate.mjs` |
| workflow-gate (#16 cross-repo) | cross-repo workflow failures (Invoice→Delivery→Outcome) seen only at founder use | gate | OS-foundational | **in-OS** | `templates/tools/workflow-gate.mjs` |
| skill frontmatter contract + router (#6/#8) | founder recall required to pick a skill | skill+automation | OS-foundational | **in-OS** (proven on Admin's 14 skills) | `templates/tools/skill-frontmatter.mjs` + `skill-route.mjs` |
| experience-gate (Track B floor) | 56s mailbox · Room offline · ASK offline-but-input-enabled | gate | OS-foundational | **in-OS** | `templates/tools/experience-gate.mjs` |
| founder-experience-reviewer (#9) | the founder was the FIRST user of broken surfaces | agent | OS-foundational | **in-OS** (proven in PLOS PR #127) | `.claude/agents/founder-experience-reviewer.md` |
| experience-review harness | 56s mailbox discovered by founder, not system | automation | OS-foundational | **verified** (PLOS PR #127) → promote the pattern to OS | PLOS `scripts/experience-review.mjs` (vendored gate) |

## Open backlog (candidates — feed the chain forward)
| Item | Founder reality | Kind | Priority | Why |
|---|---|---|---|---|
| **Upgrade path for skills+tools** (extend os-sync beyond agents) | proven capabilities are Admin/PLOS-local; a NEW project inherits none of them | automation | **HIGH** | This is the broken half of the chain — "every project inherits" is not true today. Without it, every project re-earns the gates by hand. |
| **Mandatory post-milestone learning-review** (promote + enforce) | lessons stay as prose / aren't systematically converted | skill+gate | **HIGH** | the feedback engine of the chain (this turn: promoted to OS, made mandatory, backlog-feeding) |
| **census-detector (#10)** | a ≥3× repeated pattern stays manual, never auto-extracted | automation | HIGH | auto-appends candidates to THIS ledger (extraction over accumulation, mechanized) |
| **Standing experience-review wiring (PLOS)** | the reviewer runs on-demand, not on every change + cadence | automation+gate | HIGH | makes discovery automatic (the system is the first user, never the founder) |
| **Mailbox fix (PLOS)** | 56s mailbox | fix | HIGH | list-only first paint; the experience-review harness is its acceptance test (flips to PASS) |
| **deployment-operator + audited lane (#7)** | deployment ownership confusion; per-action auth dance | agent+automation | MED | the founder-burden lane (one-time ratification) |

## The anti-decay rule (why the system gets harder to break over time)
Every founder-discovered issue a capability FAILED to catch becomes a new/strengthened capability row here
(the learning-review's "which capability failed to catch this?" question + the census-detector). Coverage only
grows. The founder's discovery rate must trend toward zero — that is the single success metric for this ledger.
