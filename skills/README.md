# Skills — first-class, callable capabilities

> A **Skill** is a *procedure* the build-time team runs — a reusable, versioned playbook that orchestrates agents and emits an artifact. Skills are v3's **Capability plane**: they make Delivery OS's best procedures (the founder interview, the §11 panel, the audits) **callable** instead of inert prose. *(Capabilities was the weakest "C" in the Four-C review — procedures existed but weren't invokable.)*

## What a Skill is — and is NOT (the boundary that prevents bloat)
A Skill is a **build-time procedure**. It is **NOT** a persona, a process doc, a template, or a runtime product feature.

| Primitive | What it is | Owns files? |
|---|---|---|
| **Agent** (`agents/`, `.claude/agents/`) | a *persona/lens* with a tool allowlist | yes (CODEOWNERS) |
| **Process** (`processes/`) | "how we do X" reference doctrine — read, not run | no |
| **Template** (`templates/`) | the *shape* of an output artifact | no |
| **Skill** (`skills/`, `.claude/skills/`) | a *callable procedure* that orchestrates agents → emits an artifact | **no** (it invokes agents who do) |

**The 3-yes litmus** (all three required, or it's not a Skill): (1) a repeatable procedure with a trigger + a defined output artifact; (2) orchestrates ≥2 agents **or** runs a §11 panel; (3) improvable from project learnings. *(A static template fails #3; a single-agent one-shot fails #2.)*

> **Skill vs runtime feature (the hard line — keep build-time and runtime on separate planes, per `processes/ai-product-engineering.md §1`):** a skill is a **build-time procedure that owns no files and holds no outward/irreversible tool.** Runtime product features — API calls, generation pipelines, and any **send / post / publish / charge / delete** — are **NOT skills**; they live in the product and are **human-gated** per Governance §6 + reviewed per §11. *(This is why a future Content OS's "auto-posting / avatar / voice" are product runtime, not skills.)*

## Where skills live & how they're installed (reuse the native mechanism)
- **Shipped (clean-room, names no project):** `delivery-os/skills/<name>/SKILL.md` — the source of truth.
- **Installed (per project):** `.claude/skills/<name>/SKILL.md` — copied by `scripts/new-project.sh`; Claude Code discovers `.claude/skills/` natively and dispatches by matching the `description`.
- **No custom registry, resolver, or dependency-solver.** Lifecycle order is enforced by the **gate** (discovery → architecture → release), not by inter-skill dependencies.

## File format (a superset of the native `name`+`description`)
```yaml
---
name: <kebab-name>
version: <semver>          # MAJOR=output shape / required-lens change · MINOR=new criterion · PATCH=wording
stability: experimental | stable | deprecated
description: >             # native dispatch key — name the TRIGGER condition, not just the capability
  <when to invoke this skill>
decision_class: architecture | migration | production-readiness | security | data | none   # for §11 skills
required_lenses: [<agent>, ...]        # the panel this skill convenes (§11)
inputs:  [<what it needs>]
outputs: [<the artifact(s) it emits, by path/template>]
---
# <Skill> — runbook (numbered steps) · success criteria · honest-failure rule · ## Changelog
```

## Versioning & the improvement loop
SemVer in frontmatter + an in-file `## Changelog`. **Improvement is a human-gated retro action, never self-tuning** (author≠verifier — a skill is a verification instrument; the thing it grades cannot rewrite its own ruler). A skill run that produced a correctable outcome (a §11 panel forced a correction; a Reviewer dissent; a founder rejection at a gate) becomes a new success-criterion or step at the slice/decision **retro**, version bumped. Project-agnostic learnings back-port to `delivery-os/skills/`; project-specific ones stay local.

## AI-OS reference-model alignment
- **Maps to:** the OS "Capabilities" layer — reusable verbs the system can invoke.
- **Deviation:** we **reuse Claude Code's native skill mechanism** rather than build a bespoke skill runtime/registry. **Why:** the native mechanism already provides discovery + dispatch; a custom registry would be speculative platform (Waterline) with no second consumer. The burden of proof is on building one — unmet today.
