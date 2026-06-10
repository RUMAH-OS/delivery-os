# Project Selection — start here

> **Read this first.** Answer a few questions about what you're building and walk away knowing: which **domain packs** to install, which **agents** to activate, which **governance rules** matter most, and which **architecture risks** to watch — *before* reading the rest of the framework.

The lean default is always: **Engineer · QA · Reviewer-Critic + human merge** (`agents/README.md`). Domain packs are **additive** on top. Packs: `public-web` · `internal-admin` · `crm` · `contracts-signatures` · `invoicing` · `api-first` · `ai-product` (`domain-packs/PACKS.md`).

---

## Quick answer (the question matrix)
| If your project… | Use pack | Jump to |
|---|---|---|
| is a **public site** that wins via search | `public-web` | [#1](#1-marketing--seo-website) |
| is an **internal tool behind login** | `internal-admin` | [#2](#2-internal-admin-platform) |
| is a **system of record for customers/contacts/leads** | `crm` | [#3](#3-crm-system) |
| handles **legally-binding documents/signatures** | `contracts-signatures` | [#4](#4-contracts--signatures-platform) |
| handles **money / invoices** | `invoicing` | [#5](#5-invoicing--billing-platform) |
| is an **API/backend** as the product (little/no UI) | `api-first` | [#6](#6-api-first-backend) |
| has **AI/agents as a core capability** | `ai-product` | [#7](#7-ai-product--agentic-system) |
| is **>1 app sharing business entities** | Ecosystem layer + per-app packs | [#8](#8-multi-application-platform) |
| is a **brand-new, unproven product** | lean + **one** core pack | [#9](#9-greenfield-startup-product) |
| is **replacing/migrating an existing system** | audit first, then target packs + `database-data` | [#10](#10-existing-system-modernization--migration) |

## Decision tree — "What am I building?"
```
START
│
├─ Public website to attract/convert via search? ───────────────▶ public-web                    (#1)
│
├─ Backend/service whose product IS its API (little/no UI)? ─────▶ api-first                     (#6)
│     └─ has AI features? ─ add ─▶ ai-product
│
├─ Product whose core value IS an AI/agent capability? ──────────▶ ai-product (+ crm / api-first)(#7)
│
├─ Internal tool behind login (ops/admin)? ─────────────────────▶ internal-admin                (#2)
│     ├─ manages customers / leads / contacts? ─ add ─▶ crm
│     ├─ issues legally-binding documents? ───── add ─▶ contracts-signatures
│     └─ bills money / invoices? ─────────────── add ─▶ invoicing
│
├─ System of record for customers / contacts / leads? ──────────▶ crm                           (#3)
│
├─ More than one app sharing business entities? ────────────────▶ Ecosystem layer + per-app packs (#8)
│
├─ Brand-new product, validating a bet, small team? ────────────▶ Greenfield: lean + ONE pack    (#9)
│
└─ Replacing / modernizing an existing system? ─────────────────▶ Audit → target packs + migrations (#10)
```
**Combine freely.** Real projects are unions — an admin that issues contracts and invoices = `internal-admin` + `contracts-signatures` + `invoicing`. Take the union of packs, agents, DoD rows, and processes.

---

## 1. Marketing / SEO Website
**Why:** the whole point is being found and converting via organic search — indexability is the product surface, not a nice-to-have.
- **Packs:** `public-web`. **Optional:** `ai-product` (AI content/chat), `api-first` (headless CMS/commerce). **Don't use:** `invoicing`, `contracts-signatures` (unless true e-commerce).
- **Agents:** lean default + `seo-validation` + `design-parity` (or `accessibility`); add `lead-architect`, `documentation`.
- **ADRs:** stack/hosting (SSR/SSG framework); metadata/canonical convention; redirect & sitemap strategy; analytics/consent (GDPR).
- **Day-one docs:** `project-context` (audience → **intent** → page); `master-roadmap`; declare the **indexability invariant** the CI harness enforces.
- **DoD adds:** SEO/indexability pass; canonical/robots/sitemap correct; design-parity (no unapproved Material Difference).
- **Architecture:** SSR/SSG (not a CSR shell); **one metadata helper** so pages are *born indexable*; **one route manifest** feeding sitemap+nav+redirects; **host-scoped** noindex for previews.
- **QA focus:** verify on **view-source**, not the hydrated DOM; canonical/robots/sitemap correctness; redirects; Core Web Vitals; the `check:seo`-style harness in CI.
- **Common mistakes:** a CSR app that never indexes; **canonical inheritance** (every page → homepage); a preview `noindex` leaking to prod; per-page metadata in `useEffect`; treating launch as "just deploy" (on an existing domain it's a **search-recovery event** — GSC, sitemap, redirect map).
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "Marketing Site" "public-web"`

## 2. Internal Admin Platform
**Why:** value is operational, behind authentication — so authorization, audit, and release discipline dominate; SEO is irrelevant.
- **Packs:** `internal-admin`. **Optional:** `crm`, `contracts-signatures`, `invoicing`, `api-first` (add the ones it actually does). **Don't use:** `public-web` / SEO; usually not `design-parity` (no reference design).
- **Agents:** lean default + `security-compliance` + `database-data`; add `lead-architect`.
- **ADRs:** stack; **auth/RBAC model**; **data ownership** (what it owns vs **consumes**); audit-logging approach.
- **Day-one docs:** `project-context`; the RBAC model; a **source-of-truth statement** (owns vs consumes — must match the Ecosystem registry).
- **DoD adds:** RBAC/authz proven (no IDOR); audit log for sensitive actions; reversible migrations.
- **Architecture:** RBAC + audit log; **release ≠ DNS cutover** (continuous/flagged); **consume shared data via the owning service — don't duplicate it** into a second store.
- **QA focus:** authz on **every record** (try another tenant's id); audit completeness; migrations; failure paths.
- **Common mistakes:** treating "launch" as a big-bang cutover; **building a second CRM/source-of-truth** instead of consuming one; a missing authz check (IDOR); no audit trail on sensitive actions.
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "Admin" "internal-admin"`  *(append `,crm` / `,contracts-signatures` / `,invoicing` as needed)*

## 3. CRM System
**Why:** it's a system of record for people/orgs — identity, dedup, and one-writer-per-entity are the make-or-break concerns.
- **Packs:** `crm`. **Optional:** `ai-product` (enrichment/scoring agents), `api-first` (exposes APIs), `internal-admin` (ops UI). **Don't use:** `public-web` / SEO.
- **Agents:** lean default + `database-data` + `security-compliance` (PII) + `api-integration` (enrichment/providers).
- **ADRs:** data model + **entity ownership** + **stable shared IDs**; identity-resolution/dedup strategy; integration strategy (shared owning-DB vs API — "cheapest sufficient level").
- **Day-one docs:** entity model/glossary; **source-of-truth registry** (one writer per entity); data-import plan.
- **DoD adds:** identity/dedup correct (stable IDs); data-import validated; GDPR (export/erasure/retention).
- **Architecture:** **one writer-of-record per entity**; stable shared IDs so a person/org is provably one record; person/org **resolution**; handle **multi-writer convergence** (inbound + outbound both create leads).
- **QA focus:** dedup/identity-resolution; import integrity; GDPR flows; authz on PII.
- **Common mistakes:** **two owners for one entity** → drift; no stable IDs → duplicate people/orgs; **building a second CRM beside an existing one** (consume the spine instead); PII with no retention/erasure.
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "CRM" "crm"`

## 4. Contracts & Signatures Platform
**Why:** outputs are **legally binding** — non-repudiation, immutability, and provider correctness aren't features, they're the liability surface.
- **Packs:** `contracts-signatures` + usually `internal-admin`. **Optional:** `invoicing` (contract → invoice), `api-first`. **Don't use:** `public-web` / SEO.
- **Agents:** lean default + `security-compliance` + `database-data`.
- **ADRs:** e-sign provider + **legal assurance level** (e.g. eIDAS tier); immutable storage + hashing; retention policy; audit trail.
- **Day-one docs:** `threat-model`; `project-context`; retention/legal policy.
- **DoD adds:** required legal assurance level; immutability + tamper-evidence; signer identity; retention; **e-sign provider integration test** (sandbox).
- **Architecture:** **immutable** signed records + document **hashing**; tamper-evidence; provider behind **ports & adapters**; fail-closed.
- **QA focus:** immutability; tamper-evidence; signer identity; retention; provider integration (idempotent, **webhook verified**); abuse cases (tamper/replay).
- **Common mistakes:** mutable signed documents; weak non-repudiation / no audit trail; not testing the provider integration in sandbox; treating a signed doc as ordinary editable data.
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "Contracts" "contracts-signatures,internal-admin"`

## 5. Invoicing / Billing Platform
**Why:** money is unforgiving — exact arithmetic, idempotency, and an immutable ledger prevent the defects that become financial/legal incidents.
- **Packs:** `invoicing` + usually `internal-admin`. **Optional:** `contracts-signatures`, `api-first` (payment webhooks). **Don't use:** `public-web` / SEO.
- **Agents:** lean default + `security-compliance` + `database-data` + `api-integration` (payment providers).
- **ADRs:** **money representation** (exact decimals, currency); **idempotency** design; **immutable ledger**; tax/VAT; **invoice numbering**.
- **Day-one docs:** `threat-model`; `project-context`; reconciliation plan.
- **DoD adds:** exact decimals; **idempotent money ops**; immutable ledger; sequential numbering; tax/VAT; **reconciliation tests**.
- **Architecture:** exact **decimal** types (never floats); **idempotency keys**; **append-only ledger**; payment providers via ports; a **reconciliation** job.
- **QA focus:** money math (**property tests**); idempotency/replay (no double-charge); ledger immutability; numbering gaps; reconciliation; webhook verification.
- **Common mistakes:** floats for money; non-idempotent charges (double-charge on retry); a mutable/over-writable ledger; gaps in invoice numbering; no reconciliation; **unverified** payment webhooks.
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "Billing" "invoicing,internal-admin"`

## 6. API-First Backend
**Why:** the product *is* the contract — versioning discipline, contract tests, and integration reliability are what consumers depend on.
- **Packs:** `api-first`. **Optional:** `ai-product` (AI endpoints), the **domain pack it serves** (`crm`/`invoicing`/…), `internal-admin` (admin UI). **Don't use:** `public-web` / SEO; `design-parity` (no public UI).
- **Agents:** lean default + `api-integration` + `database-data` + `security-compliance`.
- **ADRs:** API style; **versioning + deprecation policy**; standard **error model**; auth; **contract (OpenAPI/types) as source of truth**.
- **Day-one docs:** `api-contract` template; `project-context`; versioning/deprecation policy.
- **DoD adds:** contract tests green; **no breaking change** (or versioned + deprecation path); idempotency; webhooks verified.
- **Architecture:** the **contract is authoritative**; versioning; **idempotency** on state/money writes; integration reliability (retries, timeouts, circuit-breaking).
- **QA focus:** contract tests; versioning/backward-compat; idempotency/replay; integration + webhook; auth.
- **Common mistakes:** **silent breaking changes**; no contract tests → consumers break; non-idempotent writes; unverified webhooks; thinking "thin slice to prod = view-source" — for an API it's **deploy + one real authenticated request through the contract**.
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "API" "api-first"`

## 7. AI Product / Agentic System
**Why:** AI products fail in ways tests don't catch — non-determinism, hallucination, and ungated actions — so evals, a determinism boundary, and human gates are the core discipline.
- **Packs:** `ai-product` + usually `crm` and/or `api-first` (its data + endpoints). **Optional:** `internal-admin` (ops UI). **Don't use:** `public-web`/SEO/`design-parity` unless there's a public marketing surface.
- **Agents:** lean default + `ai-product` (**runtime** agents) + `database-data` (agent-run audit) + `api-integration`. *(Keep build-time agents separate from the product's runtime agents.)*
- **ADRs:** **build-time vs runtime agents**; the **determinism boundary** (what's pure code vs the LLM); model/provider; **eval strategy**; human-gated actions.
- **Day-one docs:** `project-context`; an `evals/` scaffold; a **determinism-boundary** note; `decision-preregistration` (if it learns).
- **DoD adds:** **evals pass** (golden + grounding); **determinism** holds where required; agent-run audit; **no unguarded irreversible tool**; graceful degradation; explainability.
- **Architecture:** keep deterministic logic (scoring/money/ranking) **in pure code, never the LLM**; build-time vs runtime planes; **evals as a test type**; agent-run audit; **agents draft, humans act**; graceful degradation on provider failure.
- **QA focus:** **evals** (golden/grounding/exact-match); determinism; agent-run audit; human-gate enforcement; degradation on failure.
- **Common mistakes:** deterministic logic *inside* the LLM (irreproducible); no evals → silent quality regression; **hallucinated facts** (no grounding/source); an agent holding a send/charge tool (no human gate); **auto-feeding outcomes back to the model**; fitting the interpretation to the data (no pre-registration).
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "AI Product" "ai-product,crm,api-first"`

## 8. Multi-Application Platform
**Why:** the risk moves *between* apps — entity ownership, integration boundaries, and avoiding premature coupling. This is governed by the **Ecosystem Architecture** layer, not a single pack.
- **Packs:** the **union per app** (each app picks its own). **Optional:** a shared `api-first` for a contracts package; identity/notifications as shared services **when a 2nd consumer earns them**. **Don't use:** a "platform pack" — there isn't one; compose per app.
- **Agents:** per-app rosters + a **Lead Architect across the portfolio**.
- **ADRs / ECRs:** per-app ADRs **+ cross-project ECRs** (in the Ecosystem repo): **one source of truth per entity**; **integration strategy** (shared owning-DB + schema-as-contract vs versioned APIs — *cheapest sufficient level*); **stable shared IDs**.
- **Day-one docs:** stand up the **Ecosystem Architecture layer** (registries, source-of-truth, integration map, ECRs) **before the 2nd app**.
- **DoD adds:** per pack **+ "registered in ecosystem; source-of-truth review passed."**
- **Architecture:** **bounded contexts**; one SoR per entity; **integrate at the cheapest sufficient level** (don't go API-first-everywhere prematurely); earn a versioned API per **second independent-lifecycle** consumer; the **Waterline** (keep the shared spine variant-neutral).
- **QA focus:** cross-app **contract/integration** tests; identity dedup across apps; no entity drift/two-owner conflicts.
- **Common mistakes:** **API-first everywhere** before it's earned; a **shared DB written by multiple owners**; two owners for one entity; duplicating CRM/inventory across apps; building the platform **before there are two real apps**.
- **Bootstrap:** per app: `bash delivery-os/scripts/new-project.sh "<App>" "<packs>"`, then create/maintain the `ecosystem-architecture` repo and **register each app** (see `GETTING-STARTED.md §4`).

## 9. Greenfield Startup Product
**Why:** the enemy is premature everything. Start lean, prove the bet, and **activate capabilities on bottleneck** — not up front.
- **Packs:** **one** pack matching the core value (often `api-first`, `ai-product`, or `crm`); defer the rest. **Optional:** add packs as you validate. **Don't use:** heavy packs (`contracts-signatures`, `invoicing`) until there's a real legal/revenue need; **no** multi-app/platform until a 2nd app exists.
- **Agents:** lean default + `lead-architect`; add domain agents **when a bottleneck appears**.
- **ADRs:** stack; the **riskiest assumption**; data model. Keep them few.
- **Day-one docs:** `project-context` (the bet + success metric); a **thin-slice-to-prod** plan; `decision-preregistration` if you're testing a hypothesis.
- **DoD adds:** core pack rows only — keep governance light early.
- **Architecture:** **simplest thing that works**; deterministic-spine-first; provider-agnostic seams; **Waterline** (don't lock to your first segment); one deployable until scale demands more; **no empty speculative folders**.
- **QA focus:** the **core value path** end-to-end; failure paths; the validation harness from day 1 (even if tiny).
- **Common mistakes:** premature platform/microservices; building ahead of need; over-governance for a 2-person team; **skipping the thin-slice-to-prod**; no evidence loop (build a probe before you guess).
- **Bootstrap:** `bash delivery-os/scripts/new-project.sh "Startup" "<core-pack>"`  *(e.g. `ai-product` or `api-first`; add packs later)*

## 10. Existing System Modernization / Migration
**Why:** the dominant risks are data loss and a botched cutover — so audit-first, reversible migrations, and de-risking early govern everything.
- **Packs:** the **target system's** pack(s) + a heavy `database-data` emphasis. **Optional:** `api-first` (a **strangler-fig** façade over the legacy). **Don't use:** anything you can't tie to the target architecture; resist scope-creeping new features into a migration.
- **Agents:** lean default + `lead-architect` (**runs the audit**) + `database-data` + `security-compliance` (if data/PII) + `api-integration` (legacy integration).
- **ADRs:** **repair-vs-rebuild** decision *with evidence*; **migration strategy** (expand→contract / strangler-fig); **data-migration plan**; **rollback**.
- **Day-one docs:** an **audit** doc; `data-migration-plan`; **capture current-state / rollback baseline**; source-of-truth review (does the legacy own entities others consume?).
- **DoD adds:** reversible migrations + applies-clean-on-fresh-DB + **backup before**; **parity** with legacy where required; per target pack.
- **Architecture:** **strangler-fig** (incremental cutover, not big-bang); **expand→contract** migrations; capture rollback state first; **de-risk early** (thin slice to the real target env); extract the reusable spine cleanly (Waterline).
- **QA focus:** **data-migration validation** (row counts, reconciliation); **parity vs legacy**; **rollback rehearsal**; the de-risk transaction in the real environment.
- **Common mistakes:** a **big-bang rewrite**; a one-way-door migration with no backup/rollback; not capturing current state; assuming "new build == old behavior" without **parity tests**; discovering "it's never run in the target env" at the end.
- **Bootstrap:** **audit first** (Lead Architect), then `bash delivery-os/scripts/new-project.sh "<System> v2" "<target-packs>"` with `database-data` emphasis.

---

> **Note:** pack selection here is a **provisional triage** to bootstrap correctly. The mandatory **Discovery phase** (next) confirms or adjusts it — e.g. the mission reveals the project also bills money → add `invoicing`.

## After you've chosen
1. Run the bootstrap command for your type (scaffolds agents + CODEOWNERS + `CLAUDE.md` + day-one docs).
2. **▶ DISCOVERY FIRST (mandatory).** Tell Claude *"Install Delivery OS and initialize this repository"* ([BOOTSTRAP-PROMPT.md](BOOTSTRAP-PROMPT.md)) → it runs the **[Founder Discovery Interview](discovery/FOUNDER-INTERVIEW.md)** and generates **PROJECT-BRIEF / PROJECT-MISSION / NORTH-STAR** from your answers, then reviews ecosystem alignment. **Gate:** [PROJECT-DISCOVERY-CHECKLIST.md](discovery/PROJECT-DISCOVERY-CHECKLIST.md). No roadmap/architecture before this is approved.
3. Add your pack's **DoD rows** (`domain-packs/PACKS.md`) and wire its **processes/checklists**.
4. Write the recommended **ADRs** (tracing to BRIEF/MISSION); stand up CI + the **validation harness**.
5. **Register the project** in the Ecosystem layer (`GETTING-STARTED.md §4`) — especially the **source-of-truth review**.
6. Continue with the full **[GETTING-STARTED.md](GETTING-STARTED.md)**.

> Governance rules that matter for **every** type (don't skip): **author ≠ verifier** (structural), **honest failure** (never a false success), **irreversible actions are human-gated**, **one source of truth per entity**, **de-risk early** (thin slice to prod), and **evidence over assumptions** (probe before you guess).
