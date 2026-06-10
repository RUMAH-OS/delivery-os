# Delivery OS — AI-OS Hierarchy Review (Principle-11, the framework on itself)

> Question: *"If the AI Operating System architecture is presumed correct, what would Delivery OS look like if CLAUDE.md became the primary system and all other components became subordinate to it?"*
> 5 independent blind lenses — AI-OS Architect · Conservator/Historian · Knowledge Architect · Reviewer/Critic · Operations/Migration — reading the real corpus (delivery-os, ecosystem-architecture, PLOS, rumah-admin). Date 2026-06-10. Branch `review/ai-os-hierarchy-alignment`. **For founder ratification — nothing reorganized.**

## Headline finding
**The structural premise is ~90% already satisfied.** Delivery OS v3 *was itself* an AI-OS-alignment effort, ratified through three Principle-11 panels, with an explicit per-component mapping (`proposals/DELIVERY-OS-v3-AI-OS-ALIGNMENT.md`) that already maps **CLAUDE.md→kernel, Skills→capabilities, Wiki→context, Worlds→other-worlds, Governance→invoked-substrate**. The proposed hierarchy *is the existing router's section order*. The perceived "governance-first" is **textual prominence mistaken for structural primacy** — the actual entrypoints (`README`→`PROJECT-SELECTION`→discovery interview→scaffolder NEXT) are discovery/router-first, not governance-first.

**But the panel found one genuinely structural gap (unanimous) + concrete fidelity drift:**
1. **The framework does not dogfood its own kernel** — there was no live `delivery-os/CLAUDE.md` and no `.claude/`. A kernel shipped as a template but never run is a spec, not an OS. *(Fixed on this branch: a live `delivery-os/CLAUDE.md` now exists as the reference implementation.)*
2. **Routers over-claim on-disk reality** — rumah-admin's `CLAUDE.md` advertises `.claude/skills` + `.claude/agents` that are absent; its vendored `.delivery-os/` is a flattened, gitignored, **stale-v2** copy; PLOS has no router/skills/wiki and 2 ad-hoc agents.
3. **No git tags** (`v3.0`/`v3.1` are commit subjects) → the documented `git checkout <tag>` upgrade path is unrunnable. **README still says "v2."** The AI-OS identity lives in `proposals/` (draft), not `core/`.

## The 12 questions, answered
1. **Current hierarchy.** *Effective* entry order: `README(v2) → PROJECT-SELECTION → GETTING-STARTED §1.5 discovery gate → BOOTSTRAP interview → scaffolder "start discovery"`. Discovery/router-first in practice; governance is *invoked* (GETTING-STARTED §2.A), not the door. Governance's only real primacy is **volume** (12 dense principles + the new §12).
2. **Proposed hierarchy.** `CLAUDE.md(kernel) → Skills → Wiki → Projects → Governance(enforced floor)`. Already the router's section order and the AI-OS-ALIGNMENT mapping. Adopting it = **make it true of the framework itself + state it once explicitly**, not restructure.
3. **Already aligns.** Component model (router/skills/wiki/worlds/write-back planes); native first-class skills; POINTS-never-RESTATES; the §11/§12 enforcement plane; the per-component AI-OS mapping. *Most of it.*
4. **Conflicts.** Only fidelity/ordering: no live framework kernel; README "v2"; AI-OS identity in `proposals/` not `core/`; entry docs surface the discovery *gate* as the experience; consumer routers over-claim disk.
5. **Retain.** The entire delivery spine — loop, DoD (+row 4a), §3 author≠verifier, §11 blind-panel, §12 verify-gate, severity, packs — and the append-only provenance corpus (proposals, case-studies, changelogs). **Freeze §12 until it has caught a real turn.**
6. **Restructure.** Editorial only: re-front README on the kernel; add one ordering sentence; fold the AI-OS mapping from `proposals/`→`core/` (or `ARCHITECTURE.md`). **No corpus reorg.**
7. **Dogfood a live CLAUDE.md?** **Yes — the highest-leverage move.** Done on this branch for the framework; recommend the same for PLOS (and reconciling rumah-admin's) at a milestone boundary.
8. **Skills truly first-class?** First-class in *format* (native `.claude/skills`, installed, versioned, human-gated) and now in *invocation* for **one** skill (verify-gate's hook). The other six are callable-by-description but **not mechanically fired** — first-class format, advisory trigger. Honest state, deferrable (Waterline) until a second consumer pulls.
9. **Wiki serving the correct role?** Directionally yes, but the template is **over-folded and under-served** vs the real corpus. Evidence-derived fix: **add `findings/`** (validation/evidence reviews + investigations — today's single biggest homeless category), **fold `mistakes`→`learnings` as `kind: defect-log`**, keep `processes/`, **drop `decisions` and `content`** (all decision material has canonical owners; *no content artifact exists anywhere*). Add two enums — **`kind`** and **`scope`** — for type-routability and layer-selection. Boundary: understanding in wiki; records in systems-of-record; cross-project facts owned by ecosystem-architecture (never duplicated). **Promotion = generalized statement + pointer to the lower-layer evidence, never a copy.**
10. **Governance too prominent?** Not *structurally* — it's already subordinate-and-invoked. It is *textually* prominent. Fix by re-fronting docs, **not** by demoting governance's authority. Hard ruling: **§12's verify-gate is a kernel-level mechanical property, NOT "governance you can subordinate."** "Context-first" must never license a consent-based gate again.
11. **Knowledge migration.** `git mv` only (preserve `--follow`); atomic pointer-fixes in the same commit; **ADRs/ECRs/§11-reviews/business-truth stay with their owners — only genuinely homeless `docs/` narrative moves into a project wiki**; add frontmatter on move; sensitive investigations get `confidentiality: sensitive`. Proposals/case-studies/changelogs are **append-only** (supersede by dated successor, never rewrite). Adopt per project **at milestone boundaries, never mid-slice**.
12. **Content OS / B2B platform.** Future *consumers*, not present structure-drivers (already adjudicated: Waterline §8; parked in `03-future-projects-registry`). **Pre-think freely; pre-build nothing.** The 5 cheap frontmatter affordances (+ the two new enums) make the corpus content-extractable read-only later with **zero pipeline built now**. Hold this line.

## Recommendation — minimal-sufficient, in two tiers
**Tier 1 — do now (additive, framework-repo-only, zero product risk):**
- ✅ **Live `delivery-os/CLAUDE.md`** (done on this branch) — dogfood the kernel; reference implementation.
- **Re-front `README.md`** (drop "v2"; lead with the kernel + component planes) + **one ordering sentence** in GETTING-STARTED.
- **Fold the AI-OS mapping into `core/`** (or `ARCHITECTURE.md`) so the OS identity is canon, not a draft proposal.
- **Tag the framework** `v3.0` and `v3.1` so the upgrade path is runnable.
- **Adopt the wiki refinement spec** (add `findings/`; fold `mistakes`→`learnings`; drop `decisions`/`content`; add `kind`+`scope`) into `templates/wiki/` — template-only, no corpus touched.

**Tier 2 — ratify first (touches in-flight projects; milestone-boundary):**
- **rumah-admin:** reconcile its router to reality and run `new-project.sh` *for real* as it enters git (cheapest moment — pre-git); switch the flattened stale vendor to a **tagged submodule**.
- **PLOS:** add a router + reconcile agents at its next merged-slice boundary (highest retrofit cost; never on a live branch).
- **Knowledge migration** of homeless `docs/` narrative into the refined wiki — per project, one PR, QA'd like a slice, after Tier-1 success metrics are green.

## Success metrics (so this is migration, not churn)
One-hop cold-start (phase · open gates · `verify_status` · owns/consumes · blocked-on-whom from CLAUDE.md +≤1 link) · **pointer-integrity = 0 broken links** (fails for rumah-admin today) · router-reality parity (claims = disk) · `git log --follow` proves moves not retypes · ≤2-hop skill invocation · zero duplicated owned facts. *Files moved but pointers still red = churn.*

## Disagreements we did NOT smooth (§11)
- **Magnitude.** Reviewer/Critic: premise **FALSE**, reorg **cosmetic** → REJECT the reorganization, accept only the one-file add. AI-OS Architect: mostly perceptual **but one real structural gap** (dogfooding). Conservator: adopt as **editorial re-confirmation + freeze the spine + honor 9 prior rulings**. **Resolution (held):** the *reorganization as framed* (re-order the corpus, promote the wiki to a sovereign Context layer) is **rejected as unnecessary and risky**; the *intent* (kernel-first, governance-invoked) is **accepted and ~90% shipped**; the *delta* is dogfooding + fidelity + the wiki refinement — Tier 1/2 above.
- **Enforcement vs subordination.** Unanimous flag: "governance subordinate" must never become "governance optional." §12 is fenced off as kernel-level and mechanical.

## Prior rulings the reorg must honor (Conservator)
POINTS-never-RESTATES · wiki-subordinate-not-sovereign / no duplication of ecosystem-architecture · `wiki/customers` zero-records (ECR-0003) · no speculative scaffolding (Waterline) · native-skills-no-registry / six-not-eight / never-self-tuning · Worlds-is-a-section-until-earned · hand-maintained-router-not-CI-generator · CI machinery deferred-not-reversed. **Do not touch `core/` or the scaffolder until §12 has caught a real turn.**
