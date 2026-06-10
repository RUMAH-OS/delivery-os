# Delivery OS v3 — what changed and why

> v3 = v2's intact delivery spine **+** an **operability layer** that makes Delivery OS easier for Claude to *operate inside*: lower cognitive load, better retrieval/routing/reuse. Target philosophy: the **AI Operating System** reference model. **v3 is NOT a bigger governance framework** — it is a *navigation kernel* over the execution plane v2 already does well.
>
> Ratified after three independent Principle-11 panels (proposal: `proposals/DELIVERY-OS-v3-PROPOSAL.md`, Revisions 2 & 3). Per-component AI-OS mapping + deviations: `proposals/DELIVERY-OS-v3-AI-OS-ALIGNMENT.md`.

## The one rule the whole layer rests on
**POINTS, never RESTATES.** An *address* is a pointer with no payload (allowed; near-zero drift). A *duplicate* is a payload with no owner (forbidden — a Governance §7 defect, and *more* to keep in sync = *more* cognitive load). Every v3 artifact line is an address, an owned-fact, or a named pointer.

## What's new (the minimal, earned operability layer)
- **CLAUDE.md = the Router** (`templates/CLAUDE.md.template`). The single always-loaded entrypoint; answers 9 questions (identity · mission · north-star · wiki · skills · agents · worlds · ecosystem docs · active-now) by **pointing**, ≤1 hop to a canonical file. Supersedes the prose `CLAUDE.md` the scaffolder used to emit.
- **Skills = first-class callable capabilities** (`skills/`). Six procedures promoted from existing v2 prose into Claude Code's **native** skill mechanism (`.claude/skills/<name>/SKILL.md`): `discovery-interview · grill-me · migration-assessment · principle-11-review · production-readiness-review · ecosystem-alignment-review`. No custom registry/resolver. Versioned by a `version`+`stability` field; improvement is **human-gated** (author≠verifier — a skill never self-tunes).
- **Wiki = a navigable home for genuinely homeless project-local knowledge** (`templates/wiki/`). Narrative · learnings · market · customers (playbook, **zero records**) · processes · operational context. **Cross-project facts stay owned by `ecosystem-architecture/`**; the wiki points, never duplicates. Frontmatter contract: `templates/wiki/FRONTMATTER-CONTRACT.md`.
- **Knowledge cadence = a Write-back step in the loop** (`core/OPERATING-LOOP.md`). `… Documentation → Status → Write-back → Continue`. Memory is the inbox; each learning routes to its single durable home; a periodic context-hygiene pass prevents rot.
- **Ecosystem awareness = explicit Worlds routing** (router §7). Delivery OS · Ecosystem Architecture · Rumah Website · Property Lead OS · Rumah Admin · future projects are **routable and discoverable** — each project declares *its own edges* and points to the `ecosystem-architecture` registries that own the cross-project facts.

## The 5 cheap affordances (from the Content OS evaluation — each justified *today*)
`audience` · `confidentiality` · `author` · stable page `id` · a **documented frontmatter contract**. All are wiki-frontmatter metadata justified now by security (ECR-0003 sensitive data), operability, and clarity — they *also* make the knowledge layer a clean read-corpus a future knowledge-product (e.g. **Content OS**) could consume read-only. **No content-specific build now** — Content OS is a future *consumer* of this substrate, not a thing we build (see `proposals/DELIVERY-OS-v3-PROPOSAL.md` R3 + `ecosystem-architecture/03`).

## What v3 deliberately does NOT add (cut as speculative / governance-bloat)
Multi-world routing *engine* · separate `ECOSYSTEM.md`/`WORLDS.md` (worlds is a router *section*) · CI-generated router blocks + linters (added when a project has CI) · skill version resolver/registry · `wiki/{decisions,glossary,projects}` (LOCKED duplicates of `ecosystem-architecture`) · any content/distribution/avatar/voice scaffolding · a multi-agent "alignment layer". The burden of proof is on every deviation; see the alignment doc.

## Unchanged from v2 (the intact spine)
`core/` (loop + DoD + GOVERNANCE incl. §11 + severity) · `agents/` (lean default + pack roles, author≠verifier) · `processes/` · `domain-packs/` · `checklists/` · `case-studies/`. v3 sits *above* this and *invokes* it; it changes none of it except adding the Write-back step to the loop.

## Migration
Additive strangler — no breaking change. Per-project adoption at a milestone boundary (re-run the scaffolder; write the router; install skills). In-flight projects adopt *after* their current gate, never mid-slice.
