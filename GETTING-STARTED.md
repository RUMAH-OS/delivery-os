# Getting Started — install & adopt Delivery OS (≤ 30 min)

From an **empty repository** to a fully operational Delivery OS project. Optimized for copy/paste. Commands assume `git` + bash (Git Bash on Windows is fine).

> **Mental model:** **Delivery OS** = *how* you build (copy it in; clean-room). **Ecosystem Architecture** = *what/why* the project is + how it relates to others (register the project there). You touch both during setup.

---

## 1. Quick Start (the 30-minute path)

```bash
# 0. New repo
mkdir my-project && cd my-project && git init

# 1. Add Delivery OS (submodule = pinned + upgradeable). Copy alternative below.
git submodule add https://github.com/bkasanwiredjo/delivery-os delivery-os

# 2. Scaffold: agents + CODEOWNERS + day-one docs. Pick your pack(s).
#    packs: public-web internal-admin crm contracts-signatures invoicing api-first ai-product
bash delivery-os/scripts/new-project.sh "My Project" "internal-admin,crm"

# 3. Commit the skeleton
git add -A && git commit -m "chore: adopt Delivery OS + scaffold project"
```

That gives you: `.claude/agents/` (lean default + pack agents), `CODEOWNERS` (structural author≠verifier), and `docs/` (project-context, master-roadmap, STATUS, project-log, release-readiness, adr/).

**Then (the human 20 min):** fill `docs/project-context.md`, write `docs/adr/0001-*`, sketch `docs/master-roadmap.md` as vertical slices, add your **pack's DoD rows**, wire a CI **validation harness**, and **register the project** in `ecosystem-architecture` (§4). Done — Delivery OS is operational.

**Copy alternative (no submodule):**
```bash
# Vendored copy instead of a submodule (simpler; upgrade = re-copy — see §Upgrade Path)
git clone --depth 1 https://github.com/bkasanwiredjo/delivery-os _dos && rm -rf _dos/.git && mv _dos delivery-os
bash delivery-os/scripts/new-project.sh "My Project" "internal-admin,crm"
```

### What to copy vs keep project-specific
| Copy in (from delivery-os) | Keep project-specific (you write) |
|---|---|
| Selected **agents** → `.claude/agents/` (lean default + pack) | `docs/project-context.md` (your business truth) |
| `CODEOWNERS` block | `docs/master-roadmap.md`, your slices |
| `templates/` you instantiate into `docs/` | your **ADRs** (`docs/adr/`) |
| Reference: `core/`, `processes/`, `checklists/`, `domain-packs/` (via submodule/copy) | your code, tests, `evals/`, CI, the **validation harness** |
> Don't edit files **inside** `delivery-os/` in your project — treat it as a dependency. Your customizations live in `docs/`, `.claude/agents/`, and CI.

---

## 2. Project Bootstrap Guide (first day)

**A. Read the rules (5 min):** `delivery-os/core/GOVERNANCE.md` + `core/DEFINITION-OF-DONE.md` + `core/OPERATING-LOOP.md`.

**B. Initial documents** (the scaffolder created stubs in `docs/`):
1. `project-context.md` — **the business source of truth.** Who it's for, positioning, success metric, in/out of scope, the waterline (what's reusable vs variant-specific). Everything escalates against this.
2. `master-roadmap.md` — phases → **vertical slices**. Put a *thin slice to the real target environment* in Phase 1–2.
3. `STATUS.md` + `project-log.md` — live from day one.
4. `release-readiness.md` — fill as you approach release.

**C. Initial ADRs** (`docs/adr/`, from `0000-template.md`):
- `0001-stack-and-hosting.md` — language/framework, hosting, CI.
- `0002-data-and-source-of-truth.md` — your DB; **which entities you own vs consume** (must match the Ecosystem source-of-truth registry).
- `0003-<the-first-hard-call>.md` — whatever's genuinely non-obvious.
> Significant *project* decisions = ADRs here. *Cross-project* decisions = **ECRs** in `ecosystem-architecture`, not ADRs.

**D. Agent setup** — done by the scaffolder; see §3 to verify/extend.

**E. Governance setup:**
- Confirm `CODEOWNERS` is committed (it makes author≠verifier structural).
- Turn on **branch protection** + **PR-required + human approval before merge** (the irreversible-action gate).
- Stand up **CI**: typecheck → lint → build → test → **validation harness** (a script that fails the build on any project invariant — see `processes/qa-and-testing.md`).
- Run the **preflight**: `delivery-os/checklists/preflight-credentials-and-env.md` — request every external credential/account **today**.

---

## 3. Claude Integration Guide

**Where agents live:** Claude Code loads subagents from **`.claude/agents/`** in the repo root. The scaffolder copied the lean default + your pack's agents there (prefixes like `domain--` stripped). Each file's YAML `name:`/`description:`/`tools:` is what Claude uses.

**Lean default (always):** `software-engineer`, `qa-test`, `reviewer-critic` (+ `lead-architect`, `documentation` copied for convenience). **+ a human merge gate.**

**Selecting domain packs:** open `delivery-os/domain-packs/PACKS.md`, pick the pack(s) matching your project, and the scaffolder's pack argument pulls in the right agents. To add a pack later:
```bash
cp delivery-os/agents/domain--ai-product.md .claude/agents/ai-product.md   # example: add the AI-product agent
```
Then add that pack's **DoD rows** (from `PACKS.md`) to your Definition of Done, and wire its **processes/checklists**.

**How to introduce Delivery OS into a session:** point Claude at the framework once:
> "This project follows Delivery OS (`delivery-os/`). Use the agents in `.claude/agents/`, the loop in `delivery-os/core/OPERATING-LOOP.md`, and the Definition of Done in `delivery-os/core/DEFINITION-OF-DONE.md` plus the `<pack>` rows. Build in vertical slices; author≠verifier; nothing is 'done' until QA verifies + I merge."

**The structural rule:** production code and tests live in **different trees owned by different agents** (CODEOWNERS). The Engineer never writes `tests/ e2e/ evals/`; QA never writes production code; defects flow author-ward.

---

## 4. Ecosystem Integration Guide (register the project)

A new project must be **registered** in `ecosystem-architecture` so the portfolio knows it exists and how it connects.

```bash
cd ../ecosystem-architecture   # the portfolio repo
```
Then:
1. **Promote it into the Active registry** — copy `templates/project-registry-entry.md` into `02-active-projects-registry.md` and fill: purpose, status, repo, stack, **owns (source of truth)**, exposes, consumes, external deps, constraints, "follows Delivery OS ✅ + pack". (If it was in `03-future-projects`, move it.)
2. **Source-of-truth review (required)** — open `06-source-of-truth-registry.md`. For **every** entity the project touches, confirm it either **owns** it (writer-of-record) or **consumes** it from the owner. **No entity may have two owners.** If ownership changes, write an **ECR** in `decisions/`.
3. **Dependency mapping** — add the project to `09-project-dependency-map.md` (who it depends on, direction, nature, status) and the integration points to `05-integration-map.md`.
4. **Responsibilities & boundaries** — add a row to `11-project-responsibilities.md` (what it's responsible for / not).
5. Commit + push:
```bash
git add -A && git commit -m "docs(ecosystem): register <project> + source-of-truth review" && git push
```
> **Rule:** the project's `docs/adr/0002-data-and-source-of-truth.md` (project) must agree with `06-source-of-truth-registry.md` (ecosystem). If they disagree, the ecosystem registry wins and the conflict is an ECR.

---

## 5. Recommended workflow

**Project creation** → §1 + §2 (adopt, scaffold, project-context, first ADRs, CI + harness, register in ecosystem).

**Roadmap creation** → break the work into **vertical slices** (one PR each, demonstrable end-to-end). Sequence by dependency **and de-risking value**; ship a thin slice to the real target env early; build the **deterministic spine before AI/integrations**; activate capabilities on bottleneck (don't build ahead).

**Slice (work-order) lifecycle:**
```
1. Lead Architect / you   → write the slice (objective, scope, acceptance criteria) from templates/slice.md
2. Software Engineer       → implement + migration; self-verify (typecheck/lint/build/run green); open PR; mark "ready for QA"
3. QA / Test               → independent validation (functional, e2e, evals, failure paths); PASS or FAIL+bugs
4. Reviewer / Critic        → conformance + simplicity + scope-held verdict (APPROVE / request-changes)
5. Stakeholder (human)     → acceptance walkthrough (templates/acceptance-walkthrough.md) → APPROVE
6. Human                    → merge   →  slice is DONE
7. Documentation           → project-log entry (commit hash + statuses) + STATUS update
```
Status words: Engineer says **"ready for QA"**; only QA says **"verified"**; only merge says **"done."** Defects flow author-ward (graders never patch).

**QA flow** → author≠verifier (QA owns `tests/ e2e/ evals/`); verify at **runtime**, not by reading; test the **failure paths** + abuse; determinism/evals where relevant; regressions become permanent harness/eval entries; re-verify raised conditions. (`processes/qa-and-testing.md`.)

**Release flow** → `processes/deployment-governance.md` + `checklists/release-cutover.md`: promote a validated build; pass the hard gates (runs in target env, CI green in cloud, **one real end-to-end transaction**, honest-failure confirmed, monitoring + rehearsed rollback, pack sign-offs); capture rollback state first; validate production with the harness.

---

## 6. Worked example — bootstrapping **Rumah Admin**

Rumah Admin (per the ratified Ecosystem model): owns **Property/Inventory/Availability/Deals/Contracts/Invoices/Operations**, and **consumes** CRM entities from the shared Demand/CRM Spine.

```bash
# 1. Create + adopt
mkdir rumah-admin && cd rumah-admin && git init
git submodule add https://github.com/bkasanwiredjo/delivery-os delivery-os

# 2. Scaffold with the right packs (admin + crm now; contracts/invoicing later)
bash delivery-os/scripts/new-project.sh "Rumah Admin" "internal-admin,crm"
#   → .claude/agents/: software-engineer qa-test reviewer-critic lead-architect documentation
#                      security-compliance database-data api-integration
git add -A && git commit -m "chore: adopt Delivery OS (internal-admin + crm)"
```

**project-context.md (fill):** "Internal operations app + system of record for property inventory and the deal/contract/invoice flow. Consumes CRM (Organisation/Lead/Contact) from the Demand/CRM Spine. Out of scope: lead *acquisition* (PLOS + Website) and CRM ownership."

**First ADRs:**
- `0001-stack-and-hosting.md` — e.g. Next.js + the same Postgres as the Spine (read CRM, own Property tables).
- `0002-data-and-source-of-truth.md` — **owns** Property, Unit, Availability, Deal, Tenant, Contract, Invoice; **consumes** Organisation/Lead/Contact from the Spine (schema-as-contract, per ECR-0003). *Do not create a second CRM.*
- `0003-spine-access.md` — how Admin reads/writes the Spine (same DB / access service; single-writer-of-record per entity).

**First slice (deterministic spine first, no integration):**
> **S01 — "Property capture → list → detail."** Create a Property + Unit with availability/pricing in code, see it in a list, open a detail page. Proves the schema + ops UI spine. No Spine integration, no contracts/invoices yet.
Acceptance (QA): persisted with constraints; list renders; detail shows fields; migration forward-only + applies-clean; RBAC on the write (internal-admin DoD row).

**Add packs as you reach them:** when contracts arrive →
```bash
cp delivery-os/agents/domain--security-compliance.md .claude/agents/security-compliance.md   # (already present)
# add contracts-signatures DoD rows from delivery-os/domain-packs/PACKS.md; use processes/security-and-compliance.md + templates/threat-model.md
```

**Register in ecosystem (§4):** move Rumah Admin from `03-future-projects` to `02-active-projects`; confirm `06-source-of-truth-registry.md` already has it owning Property/Deal/Contract/Invoice and consuming CRM (it does — locked by ECR-0003); add it to `09`/`11`. Commit + push.

→ Rumah Admin is now a first-class Delivery OS project, consistent with the locked architecture.

---

## Delivery OS Upgrade Path (for existing projects)

Delivery OS is **versioned**; existing projects adopt new versions deliberately.

**If you used a submodule (recommended):**
```bash
cd delivery-os && git fetch && git checkout <new-tag-or-main> && cd ..
git add delivery-os && git commit -m "chore: upgrade Delivery OS to <version>"
```
Then **re-run the scaffolder's agent copy** for any changed/added agents you use (it overwrites `.claude/agents/` copies), and read the new `CHANGELOG-vN.md` for **new DoD rows / processes / packs** to wire in. Your `docs/`, code, and CI are untouched.

**If you vendored a copy:** re-copy the framework folder (`git clone --depth 1 … && replace delivery-os/`), then the same agent re-copy + CHANGELOG review.

**Adoption rules:**
1. **Core changes** (loop/governance/DoD) — adopt at a natural milestone boundary, not mid-slice.
2. **New domain pack or process** — opt in when a project actually needs it; don't retrofit everything.
3. **Breaking changes** are called out in `CHANGELOG-vN.md` with a migration note; treat a major upgrade like a slice (QA the result — does CI still pass, do the agents still load?).
4. **Pin per project**: a project tracks one Delivery OS version at a time; upgrade is a dated entry in that project's `project-log.md`.
5. **Never edit `delivery-os/` inside a project** — customizations live in `.claude/agents/`, `docs/`, and CI, so upgrades stay clean.

> Improvements discovered in a project flow **back** to the Delivery OS repo (a PR there), then **out** to other projects via this upgrade path — the same way v2 was distilled from two projects.
