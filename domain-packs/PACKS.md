# Domain Packs — the catalog

Each pack = **agents to add · DoD rows to add · processes/checklists**. All are additive over the lean default (Engineer · QA · Reviewer/Critic · human merge).

---

## `public-web` — marketing/content sites (search-driven)
- **Agents:** `seo-validation`, `design-parity` (or `accessibility`).
- **DoD adds:** SEO/indexability pass; canonical/robots/sitemap correct; design-parity (no unapproved Material Difference).
- **Processes/checklists:** `processes/seo.md`; `checklists/release-cutover.md` (incl. DNS annex + indexability audit).
- **Watch:** host-scoped noindex; one-page-one-intent; search-recovery on existing domains.

## `internal-admin` — internal tools behind auth
- **Agents:** `security-compliance`; `database-data`; (drop SEO/parity unless there's a reference design).
- **DoD adds:** RBAC/authz proven (no IDOR); audit log for sensitive actions.
- **Processes/checklists:** `security-and-compliance.md`; `database-migrations.md`. **Release ≠ DNS cutover** — continuous/flagged release (`deployment-governance.md`).

## `crm` — customer/contact/lead systems
- **Agents:** `database-data`; `api-integration`; `security-compliance` (PII).
- **DoD adds:** identity/dedup correct (stable shared IDs); data-import validated; GDPR (export/erasure/retention).
- **Processes/checklists:** `database-migrations.md`, `integration-testing.md`, `security-and-compliance.md`.
- **Watch:** one writer-of-record per entity; person/org resolution; multi-writer convergence.

## `contracts-signatures` — legally-binding documents
- **Agents:** `security-compliance`; `database-data`.
- **DoD adds:** required legal assurance level; immutability + tamper-evidence; signer identity; retention; e-sign provider integration test.
- **Processes/checklists:** `security-and-compliance.md`, `integration-testing.md`, `templates/threat-model.md`.
- **Watch:** non-repudiation, immutable audit trail, document hashing, fail-closed.

## `invoicing` — money / billing
- **Agents:** `security-compliance`; `database-data`; `api-integration` (payment providers).
- **DoD adds:** exact decimals; **idempotent money ops**; immutable ledger; sequential numbering; tax/VAT; **reconciliation tests**.
- **Processes/checklists:** `security-and-compliance.md`, `integration-testing.md`, `database-migrations.md`.
- **Watch:** no float rounding; no double-charge on retry; negative-amount abuse.

## `api-first` — backend / platform APIs (no/limited UI)
- **Agents:** `api-integration`; `database-data`; `security-compliance`.
- **DoD adds:** contract tests green; **no breaking change** (or versioned + deprecation); idempotency; webhooks verified.
- **Processes/checklists:** `api-governance.md`, `integration-testing.md`, `checklists/api-change.md`, `templates/api-contract.md`.
- **Drop:** SEO + design-parity (no public UI). "Thin slice to prod" = deploy API + one real authenticated request through the contract.

## `ai-product` — products containing AI agents
- **Agents:** `ai-product` (runtime-agent governance); `database-data` (agent-run audit); usually `api-integration`.
- **DoD adds:** **evals pass** (golden + grounding); **determinism** holds where required; agent-run audit; **no unguarded irreversible tool** (draft, don't act); graceful degradation; explainability.
- **Processes/checklists:** `ai-product-engineering.md`, `pre-registered-decisions.md` (for learning), `qa-and-testing.md` (evals).
- **Watch:** deterministic core out of the LLM path; build-time vs runtime agents; human-gated actions; no auto-feedback to models.

---
### Combining packs
Real projects combine: an admin that issues contracts and invoices = `internal-admin` + `contracts-signatures` + `invoicing`; an AI lead platform = `ai-product` + `crm` + `api-first`. Take the **union** of agents, DoD rows, and processes.
