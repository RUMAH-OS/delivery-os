# Skills — earned, executable procedures (v4)

> A **Skill** is a *procedure* the build-time team runs — a reusable, versioned playbook that emits an
> artifact. v4's catalog is **earned, not scaffolded**: every skill cites the incident/usage record that pays
> its rent (`earned_from`), and the convergent twins from two consumers are merged as **unions** (technique-level,
> `earned_from` per technique — taking either side alone would silently discard half the doctrine).

## The harvest litmus (v4 — B30; replaces "orchestrates ≥2 agents")
A procedure becomes a skill iff **all three**: (1) **recurred ≥2 times**, (2) has a **named earning incident**,
(3) emits a **stable artifact shape**. *(The old "orchestrates ≥2 agents" test admitted two skills that never
ran and excluded the most-used real workflows.)* A skill scaffolded for something done once is rejected.
**N1 doctrine:** a packaging/process conversion is **unproven until it fires on real work** — projected savings
are not measurements; name the adoption moment that will test it.

## What a Skill is — and is NOT
A Skill is a **build-time procedure**. It is NOT a persona, a process doc, a template, or a runtime product feature.

| Primitive | What it is | Owns files? |
|---|---|---|
| **Agent** (`agents/`) | a *persona/lens* with a tool allowlist | yes (CODEOWNERS) |
| **Process** (`processes/`) | reference doctrine — read, not run | no |
| **Template** (`templates/`) | the *shape* of an output artifact | no |
| **Skill** (`skills/`) | a *callable procedure* that emits an artifact | **no** |
| **Command** (`templates/commands/`) | a one-keystroke *trigger* routing to a skill | no |

> **Skill vs runtime feature (the hard line):** a skill is a build-time procedure that owns no files and holds
> no outward/irreversible tool. Anything that **sends / posts / publishes / charges / deletes** is product
> runtime — human-gated per Governance §6, never a skill.
> **Skill vs program:** anything that must *fire* is a **hook/script, not a skill** — the merge gate and the
> write-back gate graduated to programs; the skill files document their procedure.

## Format — ONE hybrid dialect (B31, amended by C3; enforced fail-closed by `validate-skills.mjs`)
`templates/SKILL.md.template` is normative. Frontmatter: `name · description · version · stability ·
decision_class · inputs · outputs · earned_from (REQUIRED) · mechanical_spine (REQUIRED)`. Body anatomy:
Overview / When-to-use incl. NOT-cases / numbered Process / Red Flags with inline incident receipts /
Verification-of-own-output / Changelog. **Common-Rationalizations tables only where a named rationalization
incident exists** (C3 — the lean earned bodies that lost nothing are the exemplar, not the 300-line generic
ones). >100 lines → move detail to a supporting reference file.

**Description discipline (B32):** the `description` is the ONLY retrieval surface the harness reads — a
third-person capability sentence + explicit "Use when / BEFORE / MANDATORY when" triggers, ≤1024 chars,
**never process steps** (the agent may follow the summary instead of the skill).

**Trigger hierarchy (B33):** **hook** (must fire without consent) > **slash command** (one keystroke between
intent and procedure: `/friction` `/verify-slice` `/panel <class>` `/audit-peer` `/learning-review` `/ratify`)
> **prose description** (judgment-gated only). Authoring rule, enforced by the validator: *a skill with a
must-fire trigger and no named hook in `mechanical_spine` is rejected* — descriptions request attention, hooks
command it (every recorded missed-fire was a prose trigger: the zero-artifact interviewer, the readiness skill
idle at a real go-live, the alignment review that couldn't see incident 5 coming).
**Missed-fire-is-a-defect:** a moment where a skill should have fired and didn't is a friction-log defect;
remedy ladder: promote the trigger one tier, or return the skill's one-line trigger to the always-loaded router.

## Install model (B34 — fixes 3-of-7-inert in both consumers)
- **Always-on core pack** (every project): `verification` · `principle-11-review` · `executable-contracts` ·
  `cross-system-reality-audit` · `friction-triage` · `gate-ledger` · `instruments-audit` · `learning-review` ·
  `decision-ratification` · `write-back-gate` · `debugging-and-error-recovery` · `verify-gate` · `ecosystem-alignment-review`.
- **Phase packs** (pull at the phase): discovery = `discovery-interview` + `migration-assessment` (installed at
  scaffold — discovery is first) · migration/release = `legacy-migration-etv` + `cutover-execution`.
- **Platform packs** (`skills/platform/`, catalog-indexed, pull-on-need): `deploy-vercel-supabase` (the
  Vercel+Supabase plane). Platform foot-gun knowledge gets a standard home here (a named OS gap, closed).
- **Project-bound skills stay in project overlays** until §14 promotion. Catalog notes:
  - *ops-truth-integration* (S16): a consumer's operational-truth seam skill — stays project-bound (seam
    nouns); its meta-doctrines are already extracted (doctrine seed D-CONTRACT, D-ONEDERIVE, D-NARRATE, N7 in
    `executable-contracts`).
  - *interview-me mechanics* (S17): future — fold into a grill-me successor **iff** discovery recurs; strictly
    better than the retired zero-artifact form (`_archive/grill-me`).
  - Retired/folded: see `skills/_archive/README.md` (X2, X3 — archive-with-pointer, nothing silently deleted).

## Versioning & the improvement loop
SemVer + in-file `## Changelog`. **Bump-or-declare-no-learning (B16):** the learning-review forces every skill
used in a phase to either bump or record "no learning" — voluntary semver demonstrably produces 1.0.0-forever
while real procedures shadow-fork past their files. Project-agnostic improvements route via §14 (no direct
base writes); project-specific ones stay in the overlay. A skill is a verification instrument — the thing it
grades cannot rewrite its own ruler (author≠verifier).

## Negative doctrine — rejected with reasons (X11; nothing plugin-installed)
From the reference catalog review (#84 §7): **rejected** — ~300-line generic knowledge bodies (a 34-line
earned skill beat a 383-line generic one) · multi-tool packaging + session-injection payloads (solo operator,
one assistant per repo, token tax) · PRD-first posture (the spec-fiction incident; topology is never specified
up front) · context-engineering imports (the derived-state router + three-tier memory is ahead) · a separate
ADR skill (would deepen a live dialect fork — F3 ledger-fronts-both) · self-review-permitting code review
(doctrinally poisonous here: author≠verifier) · generic checklists. **Adopted from the reference:** the body
anatomy (as amended by C3) · `validate-skills` fail-closed lint · `debugging-and-error-recovery` (vendored,
provenance) · the description discipline. The reference has **no independence, peer-repo, or evidence-gate
concept anywhere** — that half of this catalog is genuinely novel and is the inheritance priority.
