# Delivery OS v3 — Review Packet (for the merge decision)

> Implementation of the ratified v3 scope on branch `v3`. Built per `DELIVERY-OS-v3-PROPOSAL.md` (R2/R3), Principle-11 applied throughout. **Not merged, not pushed** — awaiting founder merge decision. The Rumah Admin Discovery Gate is independent and unaffected by this branch.

## 1. Branch summary
- **Branch:** `v3` (in `delivery-os`), base = `e16136f` (the Governance §11 commit on `main`).
- **Commits:** `cf74e7f` (the operability layer) · `504495b` (implementation-review fixes).
- **17 files, +~900 lines, breaking changes: none.** New: `CHANGELOG-v3.md`, `templates/CLAUDE.md.template`, `skills/README.md` + 6 `skills/*/SKILL.md`, `templates/wiki/{FRONTMATTER-CONTRACT.md,_index.md.template}`, `proposals/DELIVERY-OS-v3-{PROPOSAL,AI-OS-ALIGNMENT,REVIEW-PACKET}.md`. Modified: `core/OPERATING-LOOP.md` (Write-back step), `scripts/new-project.sh` (scaffolds router+skills+wiki; + a one-char fix to a pre-existing pack-agent bug).
- **Separate repo:** `ecosystem-architecture` commit `c4af401` registers **Content OS** as a future candidate (03-future-projects-registry). Local, not pushed.
- **Validation:** scaffolder run in a throwaway dir produced a clean project (router + 6 skills + wiki index + docs stubs).

## 2. Architecture summary
Three planes over v2's **intact execution plane** (core governance/agents/packs unchanged except the loop's Write-back step):
- **Routing plane** — `CLAUDE.md` is the single always-loaded **router** (9 sections / 9 questions), answering by **POINTING** (≤1 hop to a canonical file), never restating. Worlds (the 5+ "other worlds") are router **§7**, own-edges-only, pointing to the ecosystem registries that own the cross-project facts.
- **Knowledge plane** — `docs/` (project truth) + `ecosystem-architecture/` (portfolio truth) stay **canonical**; the project `wiki/` holds only **homeless** understanding (narrative/learnings/market/customers-playbook/processes), zero records, with a `source_of_truth`/`last_verified` frontmatter contract; `memory/` is the derived inbox.
- **Capability plane** — six callable **skills** via Claude Code's native mechanism (no registry/resolver), making §11 + the discovery/audit procedures *invokable* instead of inert prose.
- **Knowledge cadence** — a **Write-back step** in the operating loop routes each learning to its single durable home; a context-hygiene pass prevents rot.

The cardinal invariant: **POINTS, never RESTATES** (a duplicate is a §7 defect *and* more cognitive load). Per-component AI-OS mapping/deviation/why: `DELIVERY-OS-v3-AI-OS-ALIGNMENT.md` — every deviation is a *narrowing toward minimal* with a named governing principle; the burden of proof is on the deviation.

## 3. Migration path from v2
- **Additive strangler — no breaking change.** The new planes sit *above* the v2 spine and *invoke* it; the only change to existing core is the loop's Write-back step.
- **Per project, at a milestone boundary (never mid-slice):** bump the `delivery-os` submodule to v3 → re-run `scripts/new-project.sh` (or hand-add) to get `CLAUDE.md` (router), `.claude/skills/`, and `wiki/_index.md` → read `CHANGELOG-v3.md`.
- **In-flight projects (e.g. Rumah Admin):** adopt **after** the current gate closes. Rumah Admin's router would be filled from its existing `docs/` (the R2.3a example shows the exact content) — *not* done now, to keep v3 from preceding its Discovery Gate.
- **Deferred-until-earned (documented triggers):** CI router-generator + linters (when a project has CI); a separate `ECOSYSTEM.md` (when the worlds list grows); any content-specific build (when Content OS earns a brief and pulls).

## 4. Review checklist (for the merge decision)
- [ ] Router template reads as a true entrypoint; the 9 questions each resolve in ≤1 hop (`templates/CLAUDE.md.template`).
- [ ] Skills' `description` triggers are clear enough for native dispatch; no skill owns files or holds an outward/irreversible tool (`skills/*/SKILL.md`, `skills/README.md`).
- [ ] Wiki contract holds the line: zero-records `customers`, `source_of_truth` discipline, earned-not-scaffolded folders (`templates/wiki/FRONTMATTER-CONTRACT.md`).
- [ ] Write-back routing table has exactly one home per learning class; cross-project → ECR not wiki (`core/OPERATING-LOOP.md`).
- [ ] Every deviation in the alignment doc cites a sound governing principle (`DELIVERY-OS-v3-AI-OS-ALIGNMENT.md`).
- [ ] Content OS entry is a candidate registration that points (not a build) (`ecosystem-architecture/03`).
- [ ] Confirm the scaffolder change is acceptable (router replaces the prose CLAUDE.md; pre-existing `.md` bug fixed).
- [ ] Decide: push the `v3` branch (+ the `ecosystem-architecture` registration) for GitHub review, or review locally.

## 5. Open questions
1. **Push or local review?** The branch + the Content OS registration are committed **locally, not pushed.** Want them pushed for GitHub review (the registration is a separate repo/commit)?
2. **`principle-11-review` dispatch:** it subsumes architecture-review and roadmap-review via `decision_class`; confirm at first real use that native dispatch fires for an "architecture decision" now that those words aren't skill names.
3. **grill-me thresholds** (mean ≥2.3, per-field ≥2) are provisional — calibrate on ≥3 real projects; shipped `experimental`.
4. **The pre-existing scaffolder `.md` bug** was fixed on this branch — confirm you want that fix carried in v3 (it's outside v3's authored scope but high-impact and one-char).
5. **Rumah Admin adoption timing** — confirm it happens *after* the Discovery Gate closes (recommended), and that I fill its router from existing `docs/` at that point.

## 6. Principle-11 implementation review (deliverable #6)
Independent, blind 3-lens panel reviewed the **committed branch** against the ratified scope and guardrails:
- **Reviewer/Critic — APPROVE-FOR-MERGE.** Conformance PASS (all R2/R3 items present); scope held (15 files, nothing speculative smuggled — no ECOSYSTEM.md, no linter, no registry, no content folders, no duplicate wiki folders); POINTS-never-RESTATES holds across router/wiki/Content-OS; all guardrails enforced in-artifact; every deviation's burden met. No blockers/should-fixes.
- **Lead Architect — APPROVE-FOR-MERGE.** Faithfully realizes the AI-OS model; the five components cohere into one acyclic ownership graph; every deviation is a sound *narrowing*, none a capability loss; the layer **subtracts more weight than it adds** (8 skills→6; prose CLAUDE.md superseded; all CI/registry/separate-file machinery cut). grill-me + write-back are bounded. Top risk: discipline is reading-enforced (no CI) — the honest-minimal posture the founder ratified; mitigated by the Write-back step + reconcile date.
- **Skills/Platform — APPROVE-WITH-CONDITIONS (now met).** v3-authored surface mechanically correct, format-consistent, no false-enforcement. Conditions: (a) pre-existing scaffolder `.md` bug → **fixed** (`504495b`); (b) grill-me `required_lenses` name both roles → **fixed** (`504495b`); (c) router "hand-maintained" note → **added** (`504495b`).

**Consolidated verdict: APPROVE FOR MERGE.** The build is a faithful, minimal, scope-disciplined realization of the ratified v3; the two conditions raised are resolved on the branch. The merge decision is the founder's (human gate); recommended sequencing: merge after Rumah Admin's Discovery Gate is closed, so the business project stays first.
