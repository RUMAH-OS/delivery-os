# Delivery OS → AI-OS: Architecture Lock (the spec Step 3 dogfoods)

> The ratifiable result of Steps 1–2b. This is the FIXED target the framework will prove on itself in Step 3. Goal shift (founder, 2026-06-10): *"no longer to design the architecture — to prove it."* Supersedes the speculative machinery in `DELIVERY-OS-AI-OS-TARGET-ARCHITECTURE.md`; that doc remains as the design record, this is the locked subset. Branch `review/ai-os-hierarchy-alignment`.

## 1. The boundary (locked)
The surviving boundary is **authorship + version, not a runtime OS**. Delivery OS = a versioned, variant-neutral convention library consumed by copy, with a local overlay for specialization. Every concern is exactly one of:
- **COPIED-BASE** — `core/` + base agents/skills, copied from a **tagged** framework, version-stamped, **never hand-edited in place**.
- **LOCAL-OVERLAY** — consumer-authored specialization (e.g. PLOS's `qa-tester` Slice anchors, real CODEOWNERS handles, `docs/`, the wiki body). **Generation merges base+overlay; it never overwrites the overlay.** (The primitive the target architecture lacked.)
- **RENDER** — read-only views from disk, no new state file: §5/§6 = `ls .claude/`; §9 `verify_status` = read of the existing `.claude/.verify-state.json`. **No `.os/state.json`.**
- **POINTER** — shared facts → the LOCKED `ecosystem-architecture/06`/`10`, **never copied**.

## 2. Consumption mechanism (disagreement A — locked)
The OS↔consumer line runs between COPIED-BASE and OVERLAY; the mechanism touches **only the base**. The real requirement is **base+overlay merge** (so specialization survives a framework bump) — which submodule does not solve and the current `cp`-only scaffolder provides for neither. **Locked: versioned copy-of-base + never-overwritten overlay + version stamp + drift-lint.** Submodule remains an optional future upgrade if a second maintaining team appears.

## 3. Principle 11 (disagreement B — locked)
§11 is **policy + capability** (a judgment-triggered norm), with only a thin **artifact-existence** shell that is mechanism-eligible. **Locked:**
- The **§11 decision-class list + the two-lens floor are INHERITED and non-swappable** (a consumer may tune panel depth *upward*, never exempt its own slice downward).
- **§11 is NOT a mechanical gate.** Gating the policy is a category error; §11 succeeds by practice (real DECISION-REVIEW artifacts, no observed failure). The artifact-existence check stays a **DoD convention** ("no §11-class decision marked ACCEPTED without a `DECISION-REVIEW`"), escalated to a hook **only if** a §11-skip ever causes harm — the way §12 was earned.

## 4. Connections (final resolution — locked)
"Connections" was two concepts; disentangling them locks the question permanently:
- **Live-data plumbing** (scoped keys/CLIs) = a **PRACTICE, not a layer.** Owned by GOVERNANCE §6 + `checklists/preflight-credentials-and-env.md`. PLOS already realizes it as ordinary env config. **Never a first-class Delivery OS layer.**
- **The Market → Organisation → Person → Conversation → Outcome → Learning spine** = the **shared relationship/entity model**, and it is **already first-class — in the POINTER/SHARED layer owned by `ecosystem-architecture`** (the Demand/CRM Spine). `10-shared-business-entities.md` already models Signal→Organisation→Contact→Lead→Outreach(="a contact attempt + its outcome … produces outcomes for learning")→Deal→Contract→Invoice with stable shared IDs. Organisation/Person/Conversation are canonical today; Outcome is referenced; **only Learning is not yet a first-class entity.**

**Resolution:** the foundational concept the founder anticipates **already has a first-class home that already exists**, and it grows by the mechanism we already have. The Waterline earn-trigger (PLOS + The Floor + Contact/Outreach Intelligence + Feedback Capture converging on Conversation→Outcome→Learning) promotes it **into the ecosystem shared-entity registry via an ECR** — adding Conversation/Outcome/Learning as canonical entities with owners and shared IDs — **never into a Delivery OS `connections/` folder** (which would duplicate the LOCKED map, §7). 

**The principle that keeps the architecture from sprawling:** *Delivery OS is the how-we-build framework; the Market→…→Learning spine is what-we-build-about, owned by the ecosystem layer.* Delivery OS points to it and stays lean. **The architecture is provably extensible to "Connections as foundational" with zero new Delivery OS layer and zero rewrite** — the extension point is the ecosystem entity model, designed to grow by ECR. No Delivery OS change is needed now or later to accommodate it.

## 5. What Step 3 dogfoods (the reduced-core change list)
The framework proves the locked architecture **on itself** before any consumer adopts:
1. **Tag the framework** (`v3.0`, `v3.1`) — the version boundary; currently zero tags.
2. **Stand up `delivery-os/.claude/`** — install its own verify-gate hook + settings; the OS finally runs its own §12 gate. **(§12 has caught zero real turns anywhere — this is the actual first proof.)**
3. **Generate-not-hand-type with a real base+overlay**: a scaffolder mode that copies the base and **merges, never clobbers,** a local overlay; render §5/§6 from `ls .claude/` and §9 from `.verify-state.json` (extend the hook to persist the result it already computes and discards).
4. **One drift-lint** (read-only): router/CODEOWNERS names a skill/agent absent from `.claude/`, or copied-OS ≠ stamp → warn; phantom-dispatch / void-CODEOWNERS-handle → fail.
5. **Populate the framework's own knowledge** via `git mv` of homeless narrative; frontmatter = `kind` + `as_of` only.
6. **Correct the kernel's own POINTS-never-RESTATES violation** (the inline invariant restate flagged by the boundary skeptic).
**Deferred (Waterline, not in Step 3):** Connections-as-layer (resolved above — never), Cadence, Capability Manifest, skill-gate engine, mechanism/policy `core/` refactor (stays a documented lens). **Cut:** `.os/state.json`, `manifest.json` (fold the stamp into `.verify-state.json`), per-skill `FEEDBACK.md`, `segment_scope`.

## 6. Sequence (locked)
Ratify this lock → **Step 3: Delivery OS dogfoods it** → prove on Delivery OS (the gate catches a real turn; the base+overlay survives a simulated bump; the lint catches a planted drift) → lessons flow back → **PLOS compatibility review** → PLOS adopts → only then **Rumah Admin resumes** (step 8). The goal is to prove the architecture, not extend it.
