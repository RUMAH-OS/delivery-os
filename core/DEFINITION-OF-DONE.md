# Definition of Done (pluggable)

**Core rows always apply. The active domain pack(s) contribute extra rows.** A slice is DONE only when every applicable row is ✅; the Project Manager / merge gate refuses otherwise.

## Core rows (every slice)
| # | Step | Evidence |
|---|---|---|
| 1 | Implemented to slice scope | code |
| 2 | Build/validate gate green (typecheck, lint, build, tests, validation harness) | CI/local output |
| 3 | Dedicated commit + slice id | hash |
| 4 | **Independent QA** pass (author ≠ verifier; runtime-verified, not just read) | validation report + classified findings |
| 5 | **Reviewer/Critic** verdict: conformant + **simple** + **scope-held** | review note |
| 6 | **Stakeholder acceptance** (human walkthrough on the running thing) | acceptance note (`templates/acceptance-walkthrough.md`) |
| 7 | Docs updated (`project-log` w/ hash + statuses; ADR if a decision) | doc diff |
| 8 | Status updated (`STATUS.md`) | dashboard |
| 9 | **Human merge** (no self-merge) | merge |

## Status vocabulary
Engineer → "ready for QA" (not "done"). QA → "verified." Merge → "done." Only QA may assert verified; only a merge makes it done.

## Pack-contributed rows (activate per domain pack)
| Pack | Adds |
|---|---|
| `public-web` | SEO/indexability pass; canonical/robots/sitemap correct |
| `internal-admin` | RBAC/authz proven; audit log for sensitive actions |
| `crm` | identity/dedup correct; data-import validated |
| `contracts-signatures` | legal-validity + immutability + tamper-evidence + retention; e-sign provider test |
| `invoicing` | money ops idempotent + exact decimals; immutable ledger; numbering; reconciliation |
| `api-first` | contract tests green; **no breaking change**; versioning/deprecation honored |
| `ai-product` | **evals pass** (golden + grounding); **determinism** holds; agent-run audited; **no agent has an unguarded irreversible-action tool**; graceful degradation |
| (UI) | design-parity (no unapproved Material Difference) / accessibility |
| (data) | **reversible migration** + applies-clean-on-fresh-DB + **backup before** |

## Severity
**Blocker** (can't ship / data-loss / security / false-success) · **Should-fix** (real, ship-degrading) · **Safe-to-defer** (minor/future — logged, never silently dropped). See `SEVERITY-AND-ESCALATION.md`.

## Lightweight vs full
Early scaffolding may use lightweight self-QA. From the first user-facing or data-touching slice, **independent QA is mandatory**, and pack rows attach as the matching surface appears.
