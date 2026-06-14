# OS v6 — Architecture & Implementation Plan (design of record)

> Output of the v6 multi-agent redesign (charter: `V6-REVIEW-CHARTER.md`; evidence: 3 ingest corpora +
> `V6-FOUNDER-VALIDATION-FRICTION-LOG.md`). **Implementation is success, not this doc.** Every item below is a
> capability (skill/agent/automation/gate) or a removal — judged by: does the system get EASIER to operate as it
> learns, with fewer manual steps and fewer workflow failures?

## Architecture (skill-first · agent-first · workflow-owned)
One rule: **state is derived, intent is hand-authored, every lesson routes to a CAPABILITY or a REMOVAL — never to
more CLAUDE.md/kernel/memory prose.** Three rings:
- **Ring 1 — Skills are the unit of capability.** Each skill folder's `SKILL.md` frontmatter is a machine-parseable
  contract (`name, kind, capabilities[], triggers[], inputs[], outputs[], earned_from, hooks.pre/post`), JSON-schema
  validated, drift-lint fail-closed. CLAUDE.md §5/§6 become **derived** (render-kernel) — never authored. A
  deterministic skill-router ranks by `capabilities[]/triggers[]` (replaces founder recall). **Reject** ruflo's
  Thompson-sampling/confidence-as-gate — a single-writer-of-record never tolerates N wrong routes to learn; the
  router only ranks already-safe earned skills; author≠verifier + §11 remain the only quality gates.
- **Ring 2 — Agents own WORKFLOWS, not just components.** New base owners rendered into every repo close the
  crystallized root (seam/deploy/handoff/founder-experience owned by no one): **integration-architect** (the shared
  seam contract + seam-gate), **deployment-operator** (a founder-pre-authorized, audited deploy lane),
  **founder-experience-reviewer** (drives the real surface as a user before handoff). Admin adopts PLOS's
  base+overlay + runtime/delivery split; Admin invariants move from CLAUDE.md prose into agent overlays.
- **Ring 3 — Knowledge is executable + self-correcting.** The cross-repo seam is one executable versioned contract
  both repos test; PII-scan + parity extracted once into a `parity-oracle` skill; a ≥3× census-detector (post-task
  hook) refuses to let learning-review close while an un-triaged candidate exists (prose retro → system behavior);
  wiki = executable playbooks a skill loads, not a static site.

**Preserved (non-negotiable):** author≠verifier + verify-gate · §11 blind review + refusal discipline ·
earned-never-scaffolded · three-tier memory + learning loop + incident-provenance · determinism/provenance ·
boundary-first. **Net test for every asset: it must SUBTRACT a rule/step while closing a repeated/expensive gap.**

## Build backlog (prioritized; high-leverage first)
| # | Capability | Kind | Repo | Lev | Kills |
|---|---|---|---|---|---|
| 1 | Shared per-event-type **seam contract** (executable, versioned, incl. content-encoding) | skill | delivery-os | H | FV-4/5 root: `events-v1.ts` payload is `z.record` → HTML/text + missing-notice passed component QA, detonated at live |
| 2 | Cross-repo **seam-gate** (workflow-scoped, fail-closed before live, drives real Admin→PLOS path) | gate | delivery-os | H | the crystallized root (validates components not workflows) |
| 3 | **integration-architect** base agent (owns the seam producer+consumer) | agent | all | H | nobody owns the cross-repo seam |
| 4 | **parity-oracle** skill (PII-scan + derivation-parity + payload-parity) | skill | delivery-os | H | re-implemented 3×+ each, never extracted |
| 5 | **founder-burden-gate** + recorded v5 baseline | gate | delivery-os | H | "easier as it learns" is ungated |
| 6 | Ratified **SKILL.md frontmatter contract** + JSON-schema | convention | delivery-os | H | skill selection by recall; can't match task→skill |
| 7 | **deployment-operator** agent + standing audited deploy lane (`.deploy-lane.json`, ratified once) | agent | all | H | FV-3: per-action auth dance; no deploy owner |
| 8 | deterministic **skill-router** (`skill-route.mjs`) | automation | delivery-os | M | founder is the dispatcher |
| 9 | **founder-experience-reviewer** agent + founder-ready check (UI-state↔backend) | agent | all | M | FV-1/2 found by founder in minutes |
| 10 | auto-emitting **≥3× census-detector** wired to the learning loop | automation | delivery-os | H | lessons → prose; top-3 lessons never built |
| 11 | Promote render-kernel/check-os-drift/os-sync to delivery-os **canonical base** | automation | delivery-os | M | divergent per-repo copies; stale §5/§6 |
| 12 | **Admin agent overlays** (runtime/delivery split, ported from PLOS) | convention | rumah-admin | M | Admin invariants live only in CLAUDE.md prose |
| 13 | skill-lifecycle **hook runner** (hooks.pre/post) | convention | delivery-os | M | automation lives in one external hook |
| 14 | §6 agents **derived index** + drift-lint | automation | all | L | §6 hand-typed, disagrees with disk |
| 15 | semantic/auto-synced **memory retrieval** seam | automation | delivery-os | L | hand-curated MEMORY.md index |
| 16 | **lifecycle-completeness validation** (the Product-Reality / Workflow track inspects WHOLE business lifecycles, not just events) | gate+agent | all | H | LC-1 root: per-event seam-gate (#2) proves every component correct yet cannot prove a *lifecycle* correct — a missing inverse transition (`contract.reinstated`) is invisible to event-shape validation |

## Lifecycle-completeness validation (#16) — the Product-Reality / Workflow track
**Founder mandate (2026-06-14):** *validate complete business lifecycles, not only individual events.* A founder
does not think in events; they think in business reality (a contract is active → terminated → reinstated). The
system must stay correct across the **whole** lifecycle, not only at individual event boundaries. This is a
distinct dimension from the per-event seam-gate (#2): #2 proves each event's *shape*; #16 proves the *set* of
events faithfully mirrors the reversible real-world process (every state transition an operator/founder/customer
can perform has a correct, round-tripping representation and downstream effect). Owned jointly by
**integration-architect** (the seam side) and **founder-experience-reviewer** (#9, the real-surface side); it runs
as a workflow-scoped check, not a component check. LC-1 (`contract.reinstated` absent) is the seed evidence.

**The lifecycles it must inspect end-to-end** (each as a real operator/founder/customer would experience it):
contract creation · contract extension · contract signing · contract termination · contract reinstatement ·
invoice creation · invoice delivery · payment follow-up · customer communication. For each: enumerate every state
+ transition (including the *reversible/undo* ones), and assert the lifecycle is correct and complete — not just
that each event validates. **Net test:** business workflows drive the architecture; an event exists because a real
workflow needs it — never "because we can."

## New agents (responsibility map)
- **integration-architect** (NEW) — the cross-repo seam end-to-end (contract + producer golden fixture + seam-gate); CODEOWNERS binds the seam dir so author≠verifier holds at the seam.
- **deployment-operator** (NEW) — the founder-pre-authorized scoped audited deploy lane; executes in-scope without per-action prompts, logs everything; out-of-scope still needs explicit yes.
- **founder-experience-reviewer** (NEW, runtime-class) — the real founder-facing surface before handoff + the UI-state↔backend consistency assertion (FV-2 class); distinct from qa-test.
- **software-engineer / qa-test** (existing) gain Admin overlays (invariants moved out of CLAUDE.md). **reviewer-critic, verify-gate, lead-architect, documentation, database-data, security-compliance** preserved; **api-integration** is now intra-repo only.
- **os-upgrade-agent** (NEW) — deterministically + idempotently upgrades a repo v5→v6.

## Removal ledger (proof the core thins)
CLAUDE.md §5 skills table + §6 agents paragraph → **derived** (render-kernel, drift-lint fail-closed) · Admin
invariant prose (§3) → **agent overlays** · ad-hoc SKILL.md frontmatter → **one ratified schema** · prose "Use when"
routing → **skill-router** · per-skill prose setup/teardown → **hooks.pre/post** · 3×-reimplemented PII/parity code
+ prose checklists → **parity-oracle skill** · ECR-0006 §4 prose evolution rule → **executable seam contract** ·
founder-as-integration-point → **seam-gate** · manual census step → **census-detector** · per-deploy auth dance →
**deploy-lane** · divergent per-repo tool copies → **one canonical base**.

## Migration (staged, fail-closed, each stage SUBTRACTS before it adds)
**Stage 0 (delivery-os foundation):** freeze the frontmatter contract+schema; promote the kernel tools to the
canonical base; extend render-kernel (project capabilities[] into §5, regen §6) + check-os-drift (fail-closed on
hand-edits); author the 3 new agents + seam-contract + parity-oracle + seam-gate + founder-burden-gate +
census-detector + skill-router + hook-runner. **Stage 1 (rumah-admin — baseline repo first):** os-sync the tools +
agents; populate overlays (move invariants out of CLAUDE.md); migrate all SKILL.md frontmatter; record the v5
founder-burden baseline; wire the seam-gate (Admin producer side) + founder-burden-gate; re-render so §5/§6 derive.
**Stage 2 (property-lead-os):** os-sync; replace PLOS's hand-invoked seam validator with the shared contract +
consumer side of the seam-gate. **Stage 3 (close):** seam-gate green end-to-end (Admin drain→PLOS real consumer);
founder-burden-gate confirms the invoice-delivery count dropped toward open-URL→click→expect-X (the acceptance
test); census first pass. Each repo upgrade is run by the **os-upgrade-agent** (deterministic, idempotent,
verify-gate-gated) — not the founder.

## os-upgrade-agent (the migration agent, spec)
Deterministically + idempotently upgrades one repo v5→v6 and PROVES the core thinned. Steps (each idempotent):
os-sync canonical tools+agents (remove divergent copies) → migrate every SKILL.md to the frozen frontmatter (HALT +
emit a candidate if `earned_from` is missing — never invent provenance) → populate overlays by MOVING repo
invariants out of CLAUDE.md (leave INTENT untouched) → render-kernel so §5/§6 derive (assert the authored tables are
GONE) → wire seam-gate + founder-burden-gate + census hook → record the burden baseline. **Refuses to report
success unless §5/§6 derive cleanly AND ≥1 rule/step was removed** (the subtract-or-fail test). Fail-closed; never
scaffolds a skill; never weakens author≠verifier (an independent verify-gate pass gates the migration commit).

## Status
v6 design ratified by the multi-agent redesign. **Building now, highest-leverage first:** #1 seam contract + the
Admin producer-side conformance check (the exact fix for the HTML/text + missing-notice class). Then #4
parity-oracle, #5 founder-burden-gate. Each lands as verified capability, not doctrine.
