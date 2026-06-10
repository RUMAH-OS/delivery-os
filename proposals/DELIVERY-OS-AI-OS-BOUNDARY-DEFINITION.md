# Delivery OS → AI-OS: Boundary Definition (Step 2b supplement)

> Before choosing a consumption mechanism or deciding §11 enforcement, define the architectural boundary: **what is consumed, at what layer, and what Principle 11 is.** 3 blind lenses (Boundary Architect · §11 Classifier · Boundary Skeptic), real corpus. Date 2026-06-10. Branch `review/ai-os-hierarchy-alignment`. **For founder decision — nothing implemented. This completes Step 2b's boundary question; the mechanism choice (disagreement A) and §11 enforcement (disagreement B) become *derivable* from it.**

## The headline correction: the surviving boundary is AUTHORSHIP, not EXECUTION
"Operating System vs consumer" is largely **aspirational metaphor**. The framework does not dogfood (`delivery-os/.claude/` does not exist — it cannot dispatch a single skill/agent it defines); the proposal itself ships **copy, not runtime** ("versioned-copy-with-stamp"). A thing you `cp` into a project is a **vendored library**, not an OS the project runs. What is genuinely real and survives attack:
- **An authorship/ownership boundary** — framework-maintained, variant-neutral files (`core/GOVERNANCE.md:3`: *"Copy as-is; they name no project"*) vs consumer-authored, project-specific files.
- **A version boundary** — a *live* invoicing/signatures system cannot absorb a silent `core/` change, so the framework must be **tagged** (it has zero tags today). This is the one place the delivery domain genuinely needs more than the reference's solo-creator copy model.

So: keep the AI-OS *principles* and the "kernel/skills/knowledge" *vocabulary*, but do not over-build machinery on the metaphor of a runtime that isn't there. The honest noun is **a versioned, agnostic convention library, consumed by copy, with a local-overlay for specialization.**

## Answering the 7 boundary questions
1. **What constitutes the OS** — the variant-neutral delivery corpus that names no project: `core/` (loop · DoD · GOVERNANCE · severity) + capability *definitions* (`skills/`, `agents/`) + the mechanism substrate (`verify-gate.mjs`, `pre-push`, `settings.json` template) + the bootloader (`new-project.sh`, templates). Discriminator: if it carries a project/segment/variant assumption, it is **not** the OS (Waterline §8; `case-studies/` is the deliberate exception that names projects).
2. **What constitutes a consumer** — a project that **owns** its business truth + `docs/`/ADRs + homeless `wiki/`, and reaches everything else **by reference** (the router rule: every line is an address, an owned fact, or a pointer — a restate is a defect). By that test there are **zero clean consumers today** (the O1/O2 finding).
3–7. **The five "layers" collapse to two storage layers + two derivations** (the Boundary Skeptic's decisive simplification — the proposed 5-verb model is *incoherent* because it lacks a base+overlay primitive, exactly where every real specialization lives):

| Boundary verb | Collapses to | What it is | Real example |
|---|---|---|---|
| **SHARED** | **POINTER** | a link to one canonical foreign instance; **no local artifact, never copied** | kernel §7/§8 → the **LOCKED** `ecosystem-architecture/06`/`10` |
| **INHERITED** | **COPIED-BASE** | the OS's agnostic source, copied unchanged from a **tagged** framework, version-stamped, **never hand-edited in place** | `core/`, base `agents/`, base `skills/` |
| **GENERATED** | **COPIED-BASE + OVERLAY MERGE** | the materialized `.claude/`/CODEOWNERS/kernel — produced by **merging** base with the consumer's overlay, **never overwriting the overlay** | `.claude/` installed by `new-project.sh` |
| **LOCAL** | **OVERLAY** | consumer-authored specialization, **never clobbered** | PLOS `qa-tester.md` Slice-2.1 anchor + `@plos/*` package rules |
| **PROJECTED** | **RENDER** | a read-only view recomputed from disk every read; holds no truth; mechanism-agnostic | §5/§6 = `ls .claude/`; §9 = read of existing `.verify-state.json` |

**The missing primitive the proposal lacked: BASE + OVERLAY.** PLOS's `qa-tester.md` is simultaneously inherited (the role), generated (the install), and local (the Slice-2.1 specialization the founder authored) — three conflicting claims, and the proposal's "regenerate on bump" would **clobber the local half** (`new-project.sh` is pure `cp`, no merge mode). The only coherent shape: a **copied base the consumer never edits in place + a local overlay generation merges but never overwrites.** This is the one layer that makes the real corpus coherent.

## What this makes derivable (disagreement A — the consumption mechanism)
**The OS↔consumer line runs between COPIED-BASE and OVERLAY — and the mechanism choice touches ONLY the base.** Three of the five verbs are mechanism-invariant: SHARED is always a foreign pointer; OVERLAY is always consumer-authored; RENDER is always derived-from-disk. So submodule-vs-copy was never the real question — **the real requirement is the base+overlay merge** (so specialization survives a framework bump), which *both* copy and submodule must provide and which the current `cp`-only scaffolder provides for *neither*. Given that, the simplest sufficient mechanism is **versioned copy of the base + a never-overwritten overlay + a version stamp + a drift-lint** — submodule-pinning adds git-submodule operational cost without solving the actual problem (overlay preservation). *Derived recommendation: copy-base + overlay + stamp + lint; submodule remains an optional future upgrade if a second team appears. The founder confirms.*

## What Principle 11 is (the classification that makes disagreement B answerable)
§11 is a **two-grain thing**, and a kernel gate on the wrong grain is a category error:
- **The norm** ("a consequential decision earns an independent, blind, multi-lens review with dissents surfaced") = **POLICY + CAPABILITY** — context-dependent, judgment-triggered, parameterized by *decision-class ∩ active packs*, scaled to stakes (`GOVERNANCE.md:48`). The reference casts this exact thing as the **thought-partner / sub-agents-debate** capability — invoked by judgment, not fired by a hook.
- **The enforceable shell** ("a fresh `DECISION-REVIEW` artifact must exist before a §11-class decision is done") = the only mechanism-eligible sliver — and even it can only check *existence*, not whether the review was blind/truthful/right-lensed (§12's own honest limit).

**Its layer:** the **§11 list + the two-lens floor are INHERITED, non-swappable** (the OS owns them — a consumer may **not** redefine "consequential" to exempt its own money/migration slice, or the gate is theater); only **panel depth ABOVE the floor is OVERLAY/local — tunable upward, never downward.** (The target proposal misclassified the whole list as swappable policy; that is the authority hole the Boundary Skeptic exposed.)

**Should it be mechanically enforced?** Classification answer:
- A gate on the **policy** = **CATEGORY ERROR** — you cannot hook-evaluate "is this consequential / which lenses / truly independent," and there is **no observed failure** to earn it (the opposite of §12). §11 is *succeeding by practice*: Rumah Admin has **3+ real `DECISION-REVIEW` artifacts produced with no gate**, which materially reversed single-agent drafts (the B1→B2 flip; the gmail/invoice correction). §12 was earned by a real incident (Slice-1.0); §11 has no equivalent.
- The **artifact-existence shell** is mechanism-*eligible* but **unearned** → keep it as a **DoD convention** ("a §11-class decision may not be marked ACCEPTED without a `DECISION-REVIEW` artifact"), escalate to a hook **only if** a §11-shipped-without-review failure is ever observed — exactly how §12 itself was earned.

*Derived recommendation (disagreement B): do NOT gate §11 now. Inherit the list+floor as non-swappable; keep artifact-existence as a DoD convention; gate only on an observed failure. The founder confirms.*

## §11 vs §12 (why one is a mechanism and the other isn't)
| | §11 | §12 |
|---|---|---|
| Kind | policy + capability; judgment-triggered; operative content resolved per-project | mechanism — the one *earned* enforcement |
| Earned by | **success** by practice (3+ real artifacts, no gate, no failure) | **failure** (Slice-1.0 incident — absence of mechanism caused harm) |
| Mechanizable | only the artifact-exists shell; the rest is a category error to hook | yes — fixed, disk-checkable condition, fail-closed |
| Verdict | inherit the floor; convention now; hook only if a failure appears | keep the hook; **dogfood it (it has caught zero real turns)** |

## Net: the boundary is settled; A and B are derivable, not votes
The simplest coherent architecture is **copied-base (tagged, agnostic) + local-overlay (never clobbered) + render (§5/§6/§9 from disk, no new state file) + pointer (shared facts → the LOCKED ecosystem repo)** — the reduced core, plus the **base+overlay primitive** the target architecture never named. Connections/Cadence stay deferred (Connections is additionally a §7 duplication of the LOCKED `06` registry, not merely premature). With this boundary, the consumption mechanism (A) and §11 enforcement (B) follow from the classification rather than needing a premature vote. **Next gate:** founder confirms the boundary + the two derived recommendations, then Step 3 = dogfood the reduced core on the framework itself.
