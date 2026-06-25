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

> **2026-06-25 — Canonical SDLC merged to `main` (#5 + #8), founder-approved → status `in-OS`.** The
> SDLC lifecycle capabilities advanced `candidate → verified → in-OS`: ci-release-orchestrator,
> repo-governance-auditor, founder-review-package, release-notes, smoke (+ the os-inherit `workflows`
> class). All independently verified (author≠verifier); post-merge smoke = 5/5 tool self-tests PASS.
> Registered in `os-foundation.manifest.json` (25 tools, 7 skills, 3 workflows). Next stage `propagated`
> = `os-inherit sync` into PLOS/Admin (runs in the consumer repos). Release notes: `docs/RELEASE-NOTES-canonical-sdlc.md`.

## THE single canonical path (founder-ratified 2026-06-14 — no parallel mechanisms)
**delivery-os is the source of truth. PLOS consumes. Future projects inherit automatically.** One path:
```
delivery-os (canonical: contracts + gates + skills + agents)
   → os-sync   (agents, base+overlay)   +   os-inherit (tools/contracts/skills, vendored + drift-checked)
      → a project is SELF-CONTAINED (gates run in its CI, no OS mounted)
         → a fresh project inherits the whole foundation by running the same sync
```
There is exactly ONE propagation mechanism (os-sync + os-inherit) and ONE capability ledger (this file).
- **Admin** has consumed it (vendored `.claude/os/`, gates auto-execute in CI) — the proof it operates.
- **PLOS** consumes the SAME path. PLOS's local queue `property-lead-os/docs/capability-backlog.md` (CAP-1…7) and its
  `docs/v6-adoption-status.md` "Inheritance ledger gap" feed THIS ledger; **that documented gap ("delivery-os does
  not yet propagate skills/gates/learning-loops") is CLOSED by os-inherit** — so PLOS's "Move 2 = promote into
  delivery-os" is satisfied by *running os-inherit*, not by building a second promotion. Convergence, not duplication.
- PLOS-domain CAP rows worth promoting to OS-foundational once proven: CAP-1 founder-ready DoD gate + CAP-2 Jarvis
  product-reality review (overlap the existing founder-experience-reviewer/experience-gate — reconcile, don't fork).

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
| **OS upgrade path (os-inherit)** | proven capabilities were trapped in one project — depending on memory/discipline | automation | OS-foundational | **verified** (independent QA; sync/check/drift/missing all proven) — the `In OS → every project inherits` link now EXISTS | `capabilities/os-foundation.manifest.json` + `templates/tools/os-inherit.mjs` |
| **capability-health** (governance; validate-the-validator) | a system can REPORT green while the behavior isn't happening (the maturity-matrix lesson) | gate | OS-foundational | **verified** (measures wired-vs-INERT reality; mutation-proven to FOLLOW real CI wiring; `--self-test` re-proves its own accuracy) — proven in Admin: now 9/9 ALIVE incl. agent-orchestration | `templates/tools/capability-health.mjs` |
| **agent-orchestration** (agent-route + agent-frontmatter) | agents were the MOST-used part of the OS (110+ spawns/session) yet UN-governed: selection was private judgment, never logged/testable; agent usage never measured | skill+automation | OS-foundational | **verified** (deterministic per-token-deduped routing + self-consistency gate; selection log = the "why"; agents:check Auto-executed in Admin CI; in manifest+capability-health → 9/9 ALIVE) | `templates/tools/agent-route.mjs` + `agent-frontmatter.mjs` |
| **agent-health** (governance; the 7-question milestone report) | founder Q's: which agents available/selected/why/how-often/parallel/material-effect/never-chosen — nothing answered them | gate | OS-foundational | **verified** (reads roster+telemetry+transcripts+selection log; material-effect classifier mutation-proven; `--self-test` 15/15) — live: 81% decisive, 1 IDLE, parallel still 0% (honest) | `templates/tools/agent-health.mjs` |

## Open backlog (candidates — feed the chain forward)
| Item | Founder reality | Kind | Priority | Why |
|---|---|---|---|---|
| **APPLY the upgrade path to Admin + PLOS** (run os-inherit; repoint sibling-imports → vendored `.claude/os/tools/`; wire `os-inherit check` into CI/pre-push) | the mechanism exists but the live projects don't consume it yet | automation | **HIGH** | makes Admin/PLOS self-contained (gates run in their CI — closes #11) and byte-current with the OS; turns the proven mechanism into actual inheritance |
| **census-detector (#10)** | a ≥3× repeated pattern stays manual, never auto-extracted | automation | HIGH | auto-appends candidates to THIS ledger (extraction over accumulation, mechanized) |
| **Standing experience-review wiring (PLOS)** | the reviewer runs on-demand, not on every change + cadence | automation+gate | HIGH | makes discovery automatic (the system is the first user, never the founder) |
| **Mailbox fix (PLOS)** | 56s mailbox | fix | HIGH | list-only first paint; the experience-review harness is its acceptance test (flips to PASS) |
| **deployment-operator + audited lane (#7)** | deployment ownership confusion; per-action auth dance | agent+automation | MED | the founder-burden lane (one-time ratification) |
| **cross-repo seam-contract hash check (Admin↔PLOS)** | api-integration agent review (2026-06-15): the seam contract is vendored per-repo with NO mechanism ensuring both copies are identical bytes; a new valid event type Admin ships would be silently REJECTED by a stale PLOS copy until it hits prod | gate | MED | the seam-gate proves producer↔contract conformance within a repo, but nothing proves Admin's contract == PLOS's contract; os-sync the contract + fail CI on a vendored-hash mismatch |
| **ci-release-orchestrator** (watch CI · diagnose red→named root-cause+owner-ward fix · safe infra fixes auto · gate merge on the verify floor · watch deploy · route release go/no-go to §11) | the founder polled `gh run watch` by hand, learned of red builds late, re-diagnosed the same CI failure classes (stale conformance pins · next-build OOM · Vercel node-24 · merge conflict) ad hoc, and merged-when-green from memory with no record the verify floor / readiness gate was actually closed | skill+automation | MED | turns the by-hand CI-watch + merge-when-green loop into a read-and-recommend procedure (`templates/tools/ci-release-orchestrator.mjs`) that CITES verify-gate (merge floor) and routes release go/no-go to principle-11-review; effectful steps stay human-gated. Field-earned 2026-06-24/25; independent QA `docs/verify/VERIFY-ci-release-orchestrator.md` (verified) |
| **repo-governance-auditor** (audit branch+PR health · squash-merge-aware merged detection · the 3/5 PR-limit · superseded auto-close + merged-branch delete SAFE-TO-AUTO · merge/consolidate/close-abandoned NEEDS-APPROVAL) | PRs + branches accumulated unbounded (PLOS: 195 remote branches, only ~13 ancestry-detectable because squash-merge hides the rest; 7 open PRs over the soft-limit of 5; superseded duplicates closed by hand); no continuous audit kept a repo release-ready | skill+automation | **HIGH** | the Repository-Governance lifecycle of the canonical SDLC — keeps every repo at ≤3 active PRs with no stale branches; reuses `decideMerge`/`merge-pr.mjs` (human merge gate, no override). Field-earned 2026-06-25; independent QA `docs/verify/VERIFY-repo-governance-auditor.md` (verified) — human-only-merge + squash-merge guard hold |
| **founder-review-package** (on a slice's PR, generate the Founder Review Package: what/why/changed/decisions/risks/screenshots/links + a zero-tech numbered test guide; post as a PR comment) | the founder reviewed prod by hand with no structured package — no what-changed/why/how-to-test/links artifact; review happened against main at the merge gate, not on a DEV deploy | skill+automation | **HIGH** | the Founder Review lifecycle of the canonical SDLC — the DEV-first founder-facing artifact. Testing guide is engineer-seeded + URL-interpolated (NEVER diff-invented); screenshots real-or-explicit-N/A; the `--post` comment is effectful + fail-closed. Field-earned 2026-06-25; independent QA `docs/verify/VERIFY-founder-review-package.md` |

## Maturity stage tracker (the victory-gate — updated every milestone; no early wins)
Stage ladder: **Documented → Built → Verified → Used → Inherited → Auto-executed.** A capability still
left of `Inherited`/`Auto-executed` is still dependent on human memory. v6 is NOT landed until the
OS-foundational rows reach **Auto-executed in BOTH Admin and PLOS**. Current honest stage (2026-06-14):

| Capability | Current stage | Gap to Auto-executed everywhere |
|---|---|---|
| seam-gate + contract | **Auto-executed (Admin CI)** ✅ | PLOS not yet inherited/auto-run |
| lifecycle-gate | **Auto-executed (Admin CI)** ✅ | PLOS pending |
| workflow-gate | **Auto-executed (Admin CI)** ✅ | PLOS pending |
| os-inherit (upgrade path) | **Used (applied to Admin)** ✅ | not yet applied to PLOS |
| skill-router + frontmatter | **Inherited (Admin); Verified — NOT auto-dispatched** | no real routing happens in work (tested only); needs a routing invocation hook + log |
| learning-review (OS) | **Auto-executed (Admin CI)** ✅ — fail-closed gate (commits-since-retro); currently RED = overdue (28>25), the loop demanding its retrospective | PLOS pending; the gate fires but a human still authors the retro |
| census-detector (#10) | **Verified — INERT** | wired into NO CI/hook; never actually runs (corrected from an earlier "Used" over-claim) |
| file-lesson / cross-project census | **Verified** | not yet invoked in a real project's flow |
| experience-gate | **Auto-executed (Admin CI)** ✅ — boots the app, judges Admin's real read surfaces (13–487ms, all within budget) every push | PLOS standing pending |
| founder-experience-reviewer | **Used 1× manual** | not standing; not auto-triggered |
| experience-review (PLOS) | **Used 1×** | merged #127, but no cadence/pre-handoff (on-demand) |
| capability ledger | **Used (manual)** | not auto-fed (census-detector inert) |
| agent-route + agent-frontmatter | **Auto-executed (Admin CI)** ✅ — agents:check (frontmatter contract + routing self-consistency) runs every push; selection is now deterministic+testable. **Used (selection-logged)**: routing real work through agent-route is the behavioral step in progress | PLOS pending; selection log accrues as real tasks are routed |
| agent-health (7-question report) | **Measured** ✅ — milestone report reads roster+telemetry+transcripts+selection log; in capability-health (9/9 ALIVE) | run after every milestone; PLOS pending. Gaps it honestly surfaces: parallel ~0%, 1 IDLE agent |

**Honesty correction (2026-06-15, from the Capability-Health investigation):** the gate family is genuinely
**Auto-executed (Admin CI)**, artifact-backed. But census-detector, learning-review, skill-router, and file-lesson
are **built+verified yet NOT operating** (inert / manual / tested-only) — and there is **no runtime telemetry**, so
"Used" must be evidence-backed (a real invocation), not asserted. **v6 is NOT landed:** the right-hand columns are
green only for the Admin gate family. Remaining: wire the inert capabilities to auto-run, apply os-inherit to PLOS,
and add the 3 telemetry logs (gate-runs · skill-routes · founder-issues) so health is measured, not narrated.

**Target end-state (the only definition of "v6 landed"):** every OS-foundational row = **Auto-executed**, in
Admin AND PLOS, propagating to a fresh project automatically. Until then the work is not done.

## The anti-decay rule (why the system gets harder to break over time)
Every founder-discovered issue a capability FAILED to catch becomes a new/strengthened capability row here
(the learning-review's "which capability failed to catch this?" question + the census-detector). Coverage only
grows. The founder's discovery rate must trend toward zero — that is the single success metric for this ledger.
