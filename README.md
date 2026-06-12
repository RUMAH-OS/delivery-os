# Delivery OS

> A reusable **AI operating system / delivery framework**. Clone it, scaffold a project, and that project starts on day one with a delivery system whose lessons are **enforced, not documented** — verification, author≠verifier, and drift-protection fire automatically, without anyone remembering to run them. Distilled from two real projects (**Rumah Website**, **Property Lead OS**); the core **names neither** — project knowledge lives in the separate **Ecosystem Architecture** layer.

**Current baseline: v3.6** (this README current as of v3.7). The architecture below is what every new project **inherits automatically** — proven end-to-end (clone GitHub `main` → `scripts/new-project.sh` → a fully-enforced project, no manual setup). Evidence: independent verification records in [`docs/verify/`](docs/verify/); the full review trail in [`proposals/`](proposals/) (start with [the architecture lock](proposals/DELIVERY-OS-AI-OS-ARCHITECTURE-LOCK.md)).

**Clean-room rule:** nothing in `core/`, `agents/`, `skills/`, `processes/`, `templates/`, `checklists/`, or `domain-packs/` names a specific project. The only place real projects appear is `case-studies/`.

---

## 1. The kernel — `CLAUDE.md`
**The entrypoint is `CLAUDE.md`, the always-loaded router.** Open it and you understand a project immediately: identity · mission · north-star · skills · agents · knowledge · ecosystem edges · open gates · verification status. Its **state** sections (§5 Skills / §6 Agents / §9 verification) are **derived from disk** by `.claude/tools/render-kernel.mjs` — so the router **cannot lie** about what it can dispatch; its **intent** sections are hand-authored. The framework runs its own live kernel (this repo's [`CLAUDE.md`](CLAUDE.md)). *(Pack selection — "what am I building?" — is a pointer: [PROJECT-SELECTION.md](PROJECT-SELECTION.md). It is no longer the entrypoint; the kernel is.)*

## 2. The enforced core (fires without you remembering)
These are **mechanisms**, not conventions — they activate whether or not anyone chooses to invoke them, and they fail closed.

- **Verify-gate** ([`templates/hooks/verify-gate.mjs`](templates/hooks/verify-gate.mjs)) — blocks an in-session turn **and** a commit when implementation files changed without a fresh, **verified, independent** `docs/verify/VERIFY-<slice>.md`. A committed `pre-push` hook (`core.hooksPath`) is the **model-independent backstop**: it inspects the **committed push range**, so a change committed via bare git and pushed with a clean tree is still caught. It is monorepo-aware (`apps/**`, `packages/**`, `services/**`) by default.
- **Author ≠ Verifier (operationalized — Governance §12)** — author≠verifier is a **structural write-binding** (the verifier cannot edit what it grades), realized by CODEOWNERS-on-a-PR where git exists and a **distinct verifier run** where it doesn't. Status (`planned → generated → executed → verified`) is **derived from evidence, never self-asserted**. *Honest limit (stated, not hidden):* the gate proves a verified independent artifact **exists**; it cannot prove the verification was *truthful* — which is why git + branch protection matter.
- **Drift detection** ([`templates/tools/check-os-drift.mjs`](templates/tools/check-os-drift.mjs)) — fails the push if the router or CODEOWNERS advertises a skill/agent not on disk (phantom dispatch) or a void ownership handle.
- **Version boundary** — annotated tags + an `os_version` stamp recording the OS version a project **consumed**, with "behind" detection.
- **Mechanism vs Policy (Governance §13)** — one line: **mechanism = key; policy = prompt**. The thin kernel mechanisms above are non-swappable; the large governance *policy* (which decisions are consequential, which review lenses, which packs, where the Waterline sits) is versioned and swappable. **Principle 11** (independent review of consequential decisions) is policy — its list and two-lens floor are inherited and non-swappable, but it is not a hook.

## 3. How a project consumes the OS
- **Copied-base + Local-overlay.** A consumer receives the framework's generic agents/skills/tools/hooks as **base** (`.claude/base/`, never hand-edited in place) and writes its specializations as **overlay** (`.claude/overlay/`). `os-sync` merges them into `.claude/agents/` — so **a project's specializations survive a framework version bump** instead of being clobbered. *(This replaces the old flat "copy agents into `.claude/agents/`" model.)*
- **Skills (v4)** — the earned catalog in `.claude/skills/`: an **always-on core pack** (verification · principle-11-review · executable-contracts · cross-system-reality-audit · friction-triage · gate-ledger · instruments-audit · learning-review · decision-ratification · write-back-gate · debugging-and-error-recovery · verify-gate · ecosystem-alignment-review) + phase packs (discovery; migration = legacy-migration-etv + cutover-execution) + platform packs (`skills/platform/`). Trigger hierarchy: hook > slash command (`.claude/commands/`) > description ([`skills/README.md`](skills/README.md)). *(grill-me retired; production-readiness-review folded into the panel — `skills/_archive/`.)*
- **Knowledge layer (v4)** — three-tier memory (`memory/doctrine/` seeded from [`templates/memory/doctrine-seed.md`](templates/memory/doctrine-seed.md) · `memory/<project>/` · state always derived) + the four registries (`docs/{DECISIONS,INVARIANTS,gates,friction-log}.md`). *(The wiki layer is retired — F6; see `case-studies/2026-06-wiki-citation-survival.md`.)*

## 4. Dogfooding — the framework runs its own architecture
Delivery OS is its own first consumer: it has a live `.claude/` with the verify-gate wired (`core.hooksPath`), and the gate has **caught real turns** on this repo (it blocked this very effort's changes until an independent verifier signed off). Every step of the v3 review was independently verified (author≠verifier); each verification repeatedly *found real defects* (a gitless gate, an `untagged` stamp, a missing wiki contract, a working-tree-only backstop) — each fixed and folded back. That fail→detect→incorporate loop is the operating model.

## 5. The shape
```
CLAUDE.md     the kernel (the framework's own live router)
core/         the agnostic spine — loop, governance (incl. §12 enforcement, §13 mechanism/policy), DoD, severity
agents/       roles — a LEAN DEFAULT that scales up (installed as copied-base; specialized via overlay)
skills/       callable capabilities (.claude/skills) — verify-gate fires mechanically
templates/    what the scaffolder installs: hooks/ (verify-gate, sibling-probe, pre-push) · tools/ (os-sync, check-os-drift, render-kernel, validate-skills, merge-pr) · commands/ · memory/ (doctrine seed) · registries · CLAUDE.md.template
processes/ · checklists/ · domain-packs/   how we do X · red-team/release/security · opt-in bundles
case-studies/ the source projects (the only project-specific content)
```

## 6. The core loop
```
Implement → Commit (hash) → Independent QA (VERIFY artifact, author≠verifier) → Domain Review → Documentation → Status → Write-back → Continue
```
Delivery unit = a **vertical slice** (one PR, demonstrable end-to-end). For a deterministic core + a probabilistic/AI layer, **prove the deterministic spine first**. The **Write-back** step routes each lesson to its one durable home. See [core/OPERATING-LOOP.md](core/OPERATING-LOOP.md), [core/DEFINITION-OF-DONE.md](core/DEFINITION-OF-DONE.md).

## 7. Agent roster & domain packs
**Lean default (every project):** Software Engineer (builds; owns production code) · QA/Test (validates independently; owns `tests/ e2e/ evals/`) · Reviewer/Critic (conformance + simplicity + scope; verdicts only) · **+ a human merge gate**. Add roles as needed (Lead Architect, Documentation; Security-&-Compliance, Database/Data, API-&-Integration, AI-Product). **Domain packs** activate the right agents/gates/checklists per surface: `public-web · internal-admin · crm · contracts-signatures · invoicing · api-first · ai-product` ([domain-packs/PACKS.md](domain-packs/PACKS.md)).

## 8. Install
**One command installs the *enforced* baseline** (git-init + `main`/`dev`, copied-base + overlay dirs, skills, the verify-gate hook + committed `pre-push` + `core.hooksPath`, the tools, vendored doctrine, the wiki contract, CODEOWNERS, the router) — **fail-closed** if any mechanism is missing:
```
bash delivery-os/scripts/new-project.sh "<Project>" "<packs>"
```
Then the discovery-first flow: Claude conducts a **[Founder Discovery Interview](discovery/FOUNDER-INTERVIEW.md)** and generates `PROJECT-BRIEF/MISSION/NORTH-STAR` from your answers, founder-approved before any roadmap/architecture/code. Full guide: [GETTING-STARTED.md](GETTING-STARTED.md).

## 9. What's enforced vs. by-design
- **Enforced (cannot be silently lost):** verify-gate (in-session + pre-push range backstop) · author≠verifier · drift detection · version stamp · base+overlay survival · git substrate. A new project inherits all of these automatically.
- **By-design / external:** CODEOWNERS needs **GitHub branch protection** enabled by you; 6 of 7 skills are model-dispatched (judgment, not a defect); wiki-page compliance is a discipline (the contract is provided); a non-standard impl layout (e.g. `supabase/functions/`) needs `impl_extra` in `.claude/.verify-config.json`.

History: [CHANGELOG-v3.md](CHANGELOG-v3.md) · [CHANGELOG-v2.md](CHANGELOG-v2.md). The v3 AI-OS review trail and ratified architecture: [proposals/](proposals/).
