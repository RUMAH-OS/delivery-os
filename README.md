# Delivery OS v2

> A reusable, **project-agnostic** multi-agent delivery framework. Copy it into any repo and a new project starts with a mature delivery system on **day one**. Distilled from two real projects — **Rumah Website** (CSR→SSR rebuild, launched) and **Property Lead OS** (AI agent platform) — but the **core references neither**. Project knowledge lives in the separate **Ecosystem Architecture** layer, never here.

**Clean-room rule:** nothing in `core/`, `agents/`, `processes/`, `templates/`, `checklists/`, or `domain-packs/` names a specific project. The only place real projects appear is `case-studies/`.

---

## The shape of v2
```
core/         the agnostic spine — loop, governance, definition-of-done, severity
agents/       roles — a LEAN DEFAULT that scales up to a full roster
processes/    "how we do X" — testing, ai-product, deployment, migrations, api, security
templates/    artifacts you create on day one (+ as needed)
checklists/   red-team QA, release/cutover, security, migration, api-change, preflight
domain-packs/ opt-in bundles that ACTIVATE the right agents + gates + checklists + processes
case-studies/ the two source projects (the only project-specific content)
```
**Core vs domain-packs is the whole idea:** the core is identical for every project; the **domain pack** is what makes it fit a web app, an internal admin, a CRM, a contracts/invoicing system, an API backend, or an AI product.

## The core loop (unchanged truth, refined)
```
Implement → Commit (hash) → Independent QA → Domain Review → Documentation → Status → Continue
```
Delivery unit = a **vertical slice** (one PR, reviewable in one sitting, demonstrable end-to-end). For systems with a deterministic core and a probabilistic/AI layer, **prove the deterministic spine first** (no AI/integrations) before layering the rest. See [core/OPERATING-LOOP.md](core/OPERATING-LOOP.md).

## Agent roster — lean default, scales up
**Lean default (start here, every project):**
- **Software Engineer** — builds; owns production code.
- **QA / Test** — validates independently; owns `tests/ e2e/ evals/`.
- **Reviewer / Critic** — conformance + **simplicity** + **scope-held**; owns no files (verdicts only).
- **+ a human merge gate** (the irreversible-action approval).

This three-role model + human merge (from Property Lead OS) is, in practice, sharper than a large roster. **Add roles as the project grows:**
- **Standard add-ons:** Lead Architect, Documentation, Project Manager.
- **Optional:** SEO, Design-Parity, Accessibility.
- **Domain:** Security-&-Compliance, Database/Data, API-&-Integration, **AI-Product**.

The defining structural rule (also from PLOS): **author ≠ verifier, enforced by file ownership** (CODEOWNERS) — the verifier physically cannot edit what it grades. See [agents/README.md](agents/README.md).

## Domain packs (pick one or more)
Each pack lists the agents, DoD gates, processes, and checklists it activates. See [domain-packs/PACKS.md](domain-packs/PACKS.md).
`public-web` · `internal-admin` · `crm` · `contracts-signatures` · `invoicing` · `api-first` · `ai-product`

## What's new in v2 (vs v1)
See [CHANGELOG-v2.md](CHANGELOG-v2.md). Headlines: **core + domain-packs** split · **launch→release** governance (DNS cutover is one annex) · **structural author≠verifier + Reviewer/Critic** · **vertical slices + deterministic-spine-first** · **Stakeholder Acceptance gate** · an entire **AI-Product pillar** (build-time vs runtime agents, **evals**, determinism, agent-run audit, human-gated actions) · **pre-registered decision reviews** · generalized **testing** (unit/property/contract/integration/e2e/evals) and **migrations/API/deployment** processes.

## → Install & adopt: **[GETTING-STARTED.md](GETTING-STARTED.md)**
A complete copy/paste guide: Quick Start (≤30 min from an empty repo), bootstrap, Claude integration, ecosystem registration, the recommended workflow, a worked **Rumah Admin** example, and the **Upgrade Path**. One-command scaffold: `bash delivery-os/scripts/new-project.sh "<Project>" "<packs>"`.

## Day-one bootstrap (summary — full version in GETTING-STARTED.md)
1. Copy `delivery-os/`; read `core/GOVERNANCE.md` + `core/DEFINITION-OF-DONE.md`.
2. Pick your **domain pack(s)** ([domain-packs/PACKS.md](domain-packs/PACKS.md)); copy the activated agents into `.claude/agents/`.
3. Write `project-context.md` (business source of truth) from the template.
4. Draft `master-roadmap.md` (phases → vertical slices); write the first ADRs (stack, hosting, data).
5. Stand up `STATUS.md`, `project-log.md`, and the **validation harness in CI** (fails the build on any invariant violation).
6. Run the **credentials/env preflight** ([checklists/preflight-credentials-and-env.md](checklists/preflight-credentials-and-env.md)) — request all external access **now**.
7. **De-risk early:** ship a thin vertical slice to the **real target environment** (deploy + CI + one real end-to-end transaction) in Phase 1–2.
8. Provision the **toolchain before the first build** so the builder can self-verify (a lesson both source projects hit).
