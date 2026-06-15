# Definition of Done (pluggable)

**Core rows always apply. The active domain pack(s) contribute extra rows.** A slice is DONE only when every applicable row is ✅; the Project Manager / merge gate refuses otherwise.

## Core rows (every slice)
| # | Step | Evidence |
|---|---|---|
| 1 | Implemented to slice scope | code |
| 2 | Build/validate gate green (typecheck, lint, build, tests, validation harness) | CI/local output |
| 3 | Dedicated commit + slice id | hash |
| 4 | **Independent QA** pass (author ≠ verifier; runtime-verified, not just read) | validation report + classified findings |
| 4a | **Verification artifact exists** — a fresh, passing `docs/verify/VERIFY-<slice>.md` authored by the verifier (≠ author): real run-evidence (commands + exit codes + output), per-criterion pass/fail on the slice's **real surface**, classified open assumptions, gate ledger. **No artifact ⇒ the slice cannot pass "ready for QA"; the verify-gate hook (Governance §12) blocks commit/turn-end.** | `templates/VERIFY.md.template` |
| 5 | **Reviewer/Critic** verdict: conformant + **simple** + **scope-held** | review note |
| 6 | **Stakeholder acceptance** (human walkthrough on the running thing) | acceptance note (`templates/acceptance-walkthrough.md`) |
| 7 | **Write-back** — any canonical doc / binding decision the slice falsifies is amended (or carries a dated IOU) **in the same PR**; a decision made → a `DECISIONS.md` ledger entry. A slice that contradicts a standing spec is not done while the spec stands unamended. | amendment diff / ledger entry (write-back-gate) |
| 8 | **Audit-before-assume** (cross-system slices only) — any gate/blocker resting on a **peer repo's** state cites a same-day read-only audit of that repo's actual disk (`cross-system-reality-audit`), never a registry/router claim | audit citation in the slice/VERIFY |
| 9 | **Human merge VIA the merge gate** (`merge-pr` — machine-read checks API, all-green, no override flag; no self-merge) | gate output + merge |

**Phase-0 row (non-waivable, precedes every other slice of an operating system):**
| 0 | **Durability** — data the project's doctrine declares irreplaceable sits on managed storage with PITR/backups **and a TESTED restore** — or a founder-signed risk amendment exists. Earned: a raw-forever preservation doctrine ran for weeks on an unbacked-up, hand-migrated local database. | restore-test evidence / signed amendment |

**Telemetry row (projects with measurement/capture claims):**
| 10 | **Verify the instruments** — new capture/measurement instrumentation is proven *recording* (a live row exists) before anything relies on it; the cadenced instruments-audit (loop standing beat) is scheduled | live-row evidence + audit schedule |
| 11 | **Adoption Evidence (Completion Report Gate)** — a slice is DONE only when its slice-record carries a **COMPLETE Adoption Evidence report** (the 5 sections — Capability · Agent Usage · Skill Usage · Wiki Usage · Auto-Exec — **plus the Standing Question** "did each capability affect an outcome, or merely exist?"), auto-generated from runtime data by `adoption:report` and embedded by `slice:close`. **Fail-closed: the Completion Report Gate (`slice-gate` pre-push + `slice:check`) BLOCKS the push when any section / the Standing Question is missing or `REPORT STATUS = INCOMPLETE`.** This makes Adoption Evidence part of the Definition of Done, enforced by the OS — not by memory. | slice-record `## Adoption Evidence` region with `REPORT STATUS = COMPLETE` (Completion Report Gate) |

> **DoD hygiene rule (v4):** **no row without an enforcement surface.** Every row names the mechanism or artifact that proves it; a row nobody can mechanically or artifact-wise check is deleted, not kept as aspiration. (Earned: two doc-status rows were *required, nonexistent, and unnoticed* for an entire project — unenforced rows train DoD-skimming. Those rows are deleted in v4; their job is done by derived state, git history, and the `DECISIONS.md` ledger.)

## Status vocabulary  (derived, never self-asserted — Governance §12)
A slice carries `verify_status`, **computed from evidence by the verify-gate**, never hand-set by the author:

| `verify_status` | Means | Proven by | May claim it |
|---|---|---|---|
| `planned` | spec + acceptance criteria written; no code | `slice.md` exists | author |
| `generated` | code/scaffold exists — **not run** ("a clean scaffold") | files on disk | author |
| `executed` | it **ran**; real command output + exit codes captured — but **not** independently confirmed against acceptance on its real surface | `VERIFY-<slice>.md` with run-evidence, verdict incomplete | author or verifier |
| `verified` | an **independent verifier (≠ author)** confirmed every acceptance criterion PASS on the slice's **real surface**, all load-bearing claims Confirmed/Evidence-backed, required gates closed | a complete, fresh, passing `VERIFY-<slice>.md` | **verifier only** |

Engineer asserts **"ready for QA"** (never "done"). **`generated` and `executed` are not `verified`** — the Slice-1.0 lesson: a scaffold that compiles, or migration DDL that runs, is `executed` at best until an independent lens confirms the *actual slice surface* meets acceptance. Only `verified` + a **human merge** makes a slice "done." A builder may never report a slice as "done"/"complete" while its derived status is below `verified`.

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

## Lightweight vs full — risk-scaled verification (v5: A2)
Early scaffolding may use lightweight self-QA **only when a second lens confirms the slice touches no data, no user-facing surface, and no money/auth/PII** — that "it's just scaffolding" declaration is itself author≠verifier-gated, because the Slice-1.0 failure was exactly a *data store + migrations* slice mis-self-classified as mere scaffolding. From the first user-facing or data-touching slice (which includes any schema/migration/store work), **independent QA + a `VERIFY-<slice>.md` artifact (row 4a) are mandatory**, and pack rows attach as the matching surface appears.

**v5 generalizes this one clause into a risk-scaled rubric — it ADDS rigor, it never subtracts below the gate floor** (the §11 v5 ratification's blocker condition, earned by N20's per-slice double-verify cost; the failure it must not reproduce is N19, where independent QA on the *running thing* caught what a thin self-authored artifact would have passed):
- **The verify-gate is the floor, not a dial.** A slice that changes implementation files **always** produces a fresh, passing, independent `VERIFY-<slice>.md` (row 4a). The rubric tunes *who/how-much effort*; it **never** decides *whether* an independent pass runs. "Cheaper" is never an acceptance criterion (the A3 cost instrument is read-only telemetry — never a DoD/gate/`verify_status` input).
- **Down-classification is fail-closed.** "This slice is trivial → lightweight self-QA" is a **second-lens-confirmed declaration recorded in the VERIFY artifact** (the scaffolding precedent, generalized). A **contested or unrecorded** classification **defaults UP to full independent verification**; a down-classification with no recorded second-lens sign-off is a drift defect, logged in the friction log as a missed-control fire.
- **`tests/` is never "trivial-exempt."** A tests-only slice **retains author≠verifier** — §12 link 3 *hardened* the test tree precisely because authors amended QA pins (incident 8). Tests-only ≠ free zone.
- **Parallel verification stays independent.** Batching independent verifications into one message (the de-Rufloed "1 message = all related ops") is a *scheduling* optimization only — each verifier is a **distinct invocation that did not author the code under test** and does not anchor on another verifier's draft (§3, §11 blind, §12 no-VCS fallback).
- **Composition floor (C7).** Any batch that, **in aggregate**, touches a load-bearing/cross-system/schema/money/auth/PII surface gets a **full independent pass regardless of how its sub-slices were classified** — A1 (direct-edit tier) + A2 (risk-scaling) + slice-batching must not compound into a silent under-verification at their seams.
