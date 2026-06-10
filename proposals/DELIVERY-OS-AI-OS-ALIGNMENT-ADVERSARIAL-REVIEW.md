# Delivery OS — AI-OS Alignment: Adversarial Review + Proposed Target Architecture

> Re-run of the alignment review with the burden of proof INVERTED (deviations from the AI-OS axioms must be defended, not preserved). Method: a blank-slate counterfactual design + a misalignment red-team + bottom-up knowledge clustering (PLOS-heavy) + a capability/governance purist + a falsification lens that kills manufactured findings. 5 blind lenses, real corpus. Date 2026-06-10. Branch `review/ai-os-hierarchy-alignment`.
> **This is step 1 of the founder's sequence. It produces a *proposed* target architecture for step 2 (an independent Principle-11 review of that architecture). Nothing here is ratified or implemented.**

## The correction to the prior review
The earlier "~90% aligned" figure **conflated two axes and reported the flattering one**. Scored honestly and separately:

| Axis | Alignment | Basis |
|---|---|---|
| **Design / structure** (is the component model AI-OS-shaped?) | **~70–90%** | Kernel contract, native skills, write-back, worlds-routing all present; a from-scratch build converges on most of it. |
| **Implementation / runtime** (does it operate as an OS in its consumers?) | **~10–40%** | Measured on disk in the live consumers, the OS barely runs: no consumer mounts it; the kernel is decorative; the knowledge layer is empty; the enforcement gate is inert where it's needed. |

**An operating system is defined by its implementation.** The prior review answered "is the design AI-OS-shaped?" (largely yes) instead of the founder's actual question — *"if we built this from scratch on the axioms, would we build it the same way?"* On the runtime axis, no. The founder's distrust of the 90% was correct.

## Misalignments that SURVIVE falsification (real evidence AND a from-scratch build would differ)
| # | Finding | Class | Evidence |
|---|---|---|---|
| 1 | **Consumers re-implement snapshots; none consume a live OS.** `new-project.sh` was never run on any consumer. rumah-admin = flattened, gitignored, **stale-v2** `.delivery-os/` copy + hand-typed router that advertises `.claude/skills`+`.claude/agents` **that don't exist** (and no `.git` at all). PLOS = no router/skills/wiki; agent `qa-tester` ≠ framework `qa-test`, **voiding the CODEOWNERS binding**. | **STRUCTURAL (deepest)** | No runtime linkage: editing `core/` changes nothing in any consumer. A pattern library re-typed per project, not an OS. |
| 2 | **The kernel is decorative, not load-bearing.** False or absent in every instance with zero consequence. The real load-bearing element is the **hook**, not CLAUDE.md. The framework still has **no `delivery-os/.claude/`** — the live router I added this week *claimed* "dogfoods its own kernel"; that was false and is now corrected. | **STRUCTURAL** | Delete CLAUDE.md → nothing breaks. The process table (§9) is *narrated*, not derived. |
| 3 | **6 of 7 skills are advisory prose, not first-class.** Only verify-gate fires (via hook) — and even there the dependable thing is the artifact+hook, not the skill. 0/7 meet the full bar (deterministic invocation · composability · dependability). | **STRUCTURAL** | `skills/README.md:21` — dispatched "by matching the description" = model discretion. |
| 4 | **The "primary knowledge layer" (wiki) is empty in 100% of instances.** Real knowledge lives in `docs/`, `proposals/`, `case-studies/`. A whole category (dated, record-quoting findings) has no home in any taxonomy. | **STRUCTURAL** | PLOS: no wiki; rumah-admin: "no wiki pages yet"; the OS itself runs no wiki. |
| 5 | **MOST URGENT — §12 is INERT in the one consumer that needs it.** rumah-admin already has `src/`+`migrations/`+`tests/` on disk but no git, no `.claude/settings.json`, no `docs/verify/`. The "keystone... gate that fires without the orchestrator choosing to" did **not** fire in the exact project, on the exact failure class, it was written for. Its VERIFY artifact is mis-pathed outside the gate. *"Triggered by the founder, not by the framework — which is itself the finding."* | **STRUCTURAL + URGENT** | We hardened §12 into templates and never deployed it where it matters. The control built to make the failure "mechanically impossible" runs nowhere. |

## Findings that did NOT survive falsification (domain requirements, not misalignment — surfaced, not smoothed)
- **"Governance is the substrate, not a capability" / "governance-first"** — the AI-OS axiom says governance is subordinate; a *delivery* framework cannot make fail-closed enforcement optional (that is the literal Slice-1.0 failure). Where the axiom and the domain conflict, **the domain wins**. The honest fix is not to subordinate governance — it is the **mechanism/policy split** below.
- **"Wiki isn't sovereign"** — correct by design: a LOCKED single-owner ecosystem layer (ECR-0003) means a sovereign per-project wiki would *guarantee* §7 drift. Subordinate-and-point is right.
- **"Entry order is governance-first"** — false; effective entry is discovery/router-first. (The real nit — front door is *pack-selection*, not the kernel — folds into #2.)

## The one disagreement we did NOT smooth (Governance §11): is governance-as-substrate a misalignment?
- **Red-Team / Blank-Slate:** governance occupying `core/` as the dominant object is a structural deviation; a from-scratch build files it under `skills/governance/`.
- **Capability Purist / Falsification:** governance-*enforcement*-as-substrate is **correct** for a delivery domain (the §12 lesson). The AI-OS axiom is wrong here as literally stated.
- **Resolution (held, and load-bearing for the target architecture) — split MECHANISM from POLICY:**
  - The **enforcement MECHANISM** (the verify-gate hook · the scaffolder's git+CODEOWNERS+gate install · the derived-status engine) is genuinely **kernel/substrate-level and non-swappable**. Delivery OS is RIGHT to make it so and should **defensibly deviate** from the literal axiom here. Demoting it to a swappable capability re-licenses the consent-based gate that caused the incident.
  - The **POLICY** (which decisions are consequential · which lenses are required · which packs attach · where the waterline sits) **should be a swappable, versioned capability** — and largely already is (domain packs, `principle-11-review` frontmatter).
  - Delivery OS's actual flaw: it **bundles both into one undifferentiated `core/` floor and never draws the line**, so it reads as — and structurally is — "governance is the OS." The axiom, restated honestly, becomes one Delivery OS can pass: *"the enforcement mechanism is kernel-level; the policy it enforces is a capability."*

## Proposed Target Architecture (for the step-2 Principle-11 review — NOT ratified)
A from-scratch AI-OS-native Delivery OS, preserving everything proven (the corpus is seed data, nothing discarded):

1. **A load-bearing kernel.** `CLAUDE.md` per project + a live one for the framework, with §5/§6 (syscall surface) and §9 (process table / `verify_status`) **derived from disk**, not hand-narrated — so a router cannot lie. The verify-gate writes status into a state file the router *reads*.
2. **A thin MECHANISM substrate (kernel-level, non-swappable):** the verify-gate hook · `new-project.sh`'s git+CODEOWNERS+gate install · the derived-status engine. Named *substrate*, not "governance you can subordinate."
3. **A swappable POLICY plane (capability):** decision-classes, required lenses, domain packs, the waterline — versioned data + the review skills. This is where "governance is a capability" becomes true.
4. **Skills with real invocation contracts.** Extend the verify-gate pattern: the mandatory ones (§11 on a consequential-decision change; production-readiness on a release) **fire deterministically and are depended-upon** (a hook checks for the `DECISION-REVIEW-*`/readiness artifact), not description-matched. Composition/registry stays Waterline-deferred.
5. **Consumers MOUNT the OS, not copy it.** Tagged submodule (tag `v3.0`/`v3.1` first — currently impossible) or package dep; `.claude/` + router **generated** on install/update; router-vs-disk drift is a build error.
6. **A real knowledge layer**, populated by write-back from slice one; `proposals/`+`case-studies/` become *views into* it. Structure per the evidence below.

## Evidence-derived knowledge architecture (bottom-up from the corpus, PLOS-heavy)
Eight clusters emerged from the data — they do **not** map cleanly onto the current `templates/wiki/` or my prior proposal:
1. **Domain Intelligence** (market + customer + corridor **fused** — the data reads them as one demand picture; the prior proposal wrongly split `market`/`customers`).
2. **Dated Findings** (record-quoting, append-only, `as_of`-stamped, often **sensitive**) — *the single biggest homeless category* (PLOS `validation-review-2.2.1.md`, rumah-admin `INVESTIGATION-…`); no home in either taxonomy.
3. **Decisions** (ADR project-local / ECR cross-project — two tiers; stay with their owners, wiki points).
4. **Build-Process / framework learnings** (currently mis-filed *inside* PLOS `docs/`; had to be hand-promoted via `case-studies/` + `SECOND-SOURCE-REVIEW-plos.md`).
5. **Learnings / retros** (append-only; distinct from findings — portable lesson vs record-anchored evidence).
6. **Pre-registrations** (write-before-data, **frozen** lifecycle — `learning-review-preregistration.md`).
7. **Design-specs** (locked, owns-its-facts — `design/the-floor.md`).
8. **Work-specs / roadmap** (transient; excluded from the wiki).

- **Records vs understanding is a THREE-way split**, not binary: record (system-of-record) / **dated finding** (quotes record values as-of a date, filed as append-only evidence) / pure understanding. The dividing specimen is `validation-review-2.2.1.md`.
- **Natural layering by consumer-count:** project-local → ecosystem (multi-consumer) → framework (every-project). The corpus shows documented mis-filing in both directions (framework learnings trapped in projects; shared ICP duplicated across PLOS+Admin).
- **Machine-routability (reading-enforced, no pipeline):** `kind` {domain-intelligence·finding·decision·process·learning·preregistration·design-spec·spec} · mandatory `as_of`/`last_verified` on findings · `stability` extended with **`locked`** and **`frozen`** · `confidentiality`/`audience` (fail-closed for the sensitive findings) · **`segment_scope` {epc·segment-agnostic}** to make market-agnostic platform learnings extractable. No `content/` folder (no content artifact exists; Content OS is a future *consumer*, served by frontmatter, not a folder).

## What this means for the founder's sequence
This delivers **step 1** (alignment review). It does **not** conclude the question — it proposes a target architecture for **step 2** (an independent Principle-11 review of *that* architecture). Per the agreed sequence, no framework changes merge, and Rumah Admin stays paused, until the architecture is ratified (step 7). The most urgent real-world item (finding #5: §12 inert in rumah-admin) is **not** a reason to rush Rumah Admin work — it is evidence for *why* the pause is right: the enforcement substrate must be real before the at-risk project resumes.

**Recommended next step:** run the step-2 Principle-11 review on the Proposed Target Architecture (especially the mechanism/policy split and the consume-don't-reimplement model), then dogfood it on the framework itself, then the PLOS compatibility review.
