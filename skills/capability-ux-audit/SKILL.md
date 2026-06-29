---
name: capability-ux-audit
version: 1.0.0
stability: experimental
description: >
  Read-only, parallel backend + UX audit of ONE named product capability against an explicit quality bar,
  ending in a single synthesized findings report — per-surface as-built (file:line cited), gaps-vs-bar with
  severity, prioritized P0/P1/P2 recommendations, and reusable-extraction candidates. Generic and
  parameterized by capability name + its surfaces — NOT tied to any one capability. Invoke when a capability is
  declared "backend-complete" and must be checked for user-facing completeness BEFORE it is called done, when a
  shipped capability must be measured against an enterprise/quality bar, or via the Slack Control Surface as an
  `audit-capability` goal. Read-only — it never modifies the capability under audit.
decision_class: verification
inputs:  [the TARGET capability name, its SURFACES (HTTP endpoints · UI routes · PDF/exports · events · data-model files), the QUALITY BAR verbatim (the founder's/accounting/UX criteria the capability must meet), a READ-ONLY copy of the repo(s), the active domain packs]
outputs: [docs/audits/CAPABILITY-AUDIT-<capability>-<date>.md — one synthesized findings report (per-surface as-built with file:line · gaps-vs-bar table with severity · prioritized P0/P1/P2 recommendations · reusable-extraction candidates · explicit PASS/FAIL per bar item), backed by the per-lens audit notes it consolidates]
earned_from: "Recurred ≥2× as an ad-hoc coordination before this skill existed: (1) the Owner-Invoices enterprise overhaul 2026-06-27 (rumah-admin docs/audits/OWNER-INVOICES-{BACKEND,UX}-AUDIT — two parallel read-only audits to an explicit enterprise bar found a backend-complete-but-user-facing-incomplete capability: no detail page, a grouped view computed-then-dropped at the adapter, a list that would crash on the first real invoice — every gap then closed one-for-one and independently verified PASS); (2) the Admin→PLOS invoice-delivery pipeline 2026-06-26 (8 parallel specialist audits → one decision package). Named earning incident + ≥2 recurrences + a stable artifact shape (the per-surface-cited findings report) → passes the harvest litmus."
mechanical_spine: "Agent fan-out is orchestration + judgment (no must-fire hook — the synthesis is a §11-style consolidation, not an automatable check). The ONE mechanical surface is the invocation seam: registered as a goal-routable capability (v6 capabilities/triggers below) so the Slack Control Surface can enqueue an `audit-capability` goal that fans out the read-only audit lenses and emits the report. The capability is READ-ONLY by construction (no src/** or admin-ui/** writes; writes only the report under docs/audits/), so it is safe on the unattended/Slack/goal path — unlike money-mutating goals it needs no human gate to RUN (its recommendations still gate any build/go-live)."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: verification
capabilities: [audit-capability, capability-ux-audit]
triggers:
  - "audit the <capability> capability"
  - "is <capability> user-facing complete / does it meet the bar"
  - "run a capability UX + review audit"
  - "audit-capability"
hooks:
  pre: []
  post: []
---
# Capability UX + Review Audit

## Overview
The repeatable form of the audit-then-fan-out coordination proven on the Owner-Invoices enterprise overhaul
(`rumah-admin/docs/audits/OWNER-INVOICES-{BACKEND,UX}-AUDIT-2026-06-27.md` → an independently-verified PASS).
Given **one named capability + its surfaces + an explicit quality bar**, it runs a **backend/finance audit** and
a **UX/design audit IN PARALLEL** (plus pack-conditional lenses), then a **single synthesis** consolidates them
into one findings report: per-surface as-built (cited), gaps-vs-bar with severity, prioritized recommendations,
and reusable-extraction candidates. It exists because a *correct backend can still ship an incomplete
capability* — the user-facing layer is the thing this audit refuses to let slip. **Read-only — never modifies
the capability under audit** (same discipline as `migration-assessment`).

## When to use (and NOT)
- **Use when:** a capability is declared "backend-complete" and you must check user-facing completeness BEFORE
  calling it done; a shipped capability must be measured against an enterprise/accounting/UX bar; or the founder
  invokes `audit-capability` from the Slack Control Surface.
- **NOT** for: a *consequential design decision* (→ `principle-11-review`); a *whole legacy system*
  keep/modernize/rebuild call (→ `migration-assessment` — that dispositions every capability; this audits ONE
  against a bar); a *single defect* (→ `friction-triage`); the *independent verification of a built slice*
  (→ `verify-gate` — this finds gaps to build; verify proves a build closed them); a *go/no-go release*
  (→ `production-readiness-review`). It produces findings, it does not build, verify, or merge.

## Process
1. **Frame the audit (cited, read-only).** Pin the TARGET capability name, enumerate its SURFACES (HTTP
   endpoints · UI routes · PDF/exports · events · data-model/migration files), and capture the QUALITY BAR
   **verbatim** (the founder's words / the accounting / UX criteria). The bar is the rubric every lens scores
   against — no bar ⇒ ask for it, never invent one.
2. **Fan out the lenses IN PARALLEL (read-only, each cites `file:line`; unknowns = `TBD — verify`):**
   - **Backend / finance lens** (`software-engineer` + pack-conditional `database-data` for data systems ·
     `security-compliance` for money/PII/e-sign · `api-integration` for integrations): data model, calculation
     pipeline, generation/idempotency/immutability, events/seam, surfaces, payment/audit trail, reusability.
     → as-built + gaps-vs-bar with severity.
   - **UX / design lens** (`design-parity` against a reference, else `accessibility`): every surface as-built
     (what it shows per row/screen/document), gaps-vs-bar (grouped-not-flat, breakdown visible, contracts
     visible, **scale to dozens**), and which reusable UI primitives are missing. → as-built + gaps with
     severity.
   - Each lens works from the bar, not from the other's draft (no anchoring).
3. **Synthesize (the consolidator — `reviewer-critic` + `lead-architect`; author ≠ each lens).** Cross-cut and
   de-duplicate gaps, **surface every disagreement between lenses — never smooth them**, assign a final severity,
   and produce an **explicit PASS/FAIL per bar item**. Name the **reusable-extraction candidates** (shared
   primitives/abstractions a future capability would inherit).
4. **Prioritize.** Order recommendations P0 (blocks the bar) / P1 (scale + correctness edges) / P2 (polish), each
   pointing at the gap it closes and the `file:line` it touches. Decouple operational bug findings from the bar
   verdict when they don't change it.
5. **Emit the report** `docs/audits/CAPABILITY-AUDIT-<capability>-<date>.md` — the single artifact. The build is a
   SEPARATE slice; the verification of that build is `verify-gate`, not this skill.

## Red flags
- A bar invented by the auditor instead of taken verbatim from the founder/criteria (then every "gap" is the
  auditor's taste, not a real miss — the Owner-Invoices bar was the founder's exact words and that is what made
  the gaps undeniable).
- A finding with no `file:line` (or honest `TBD — verify`) — invention dressed as audit.
- The backend lens and UX lens collapsed into one pass — the whole earning incident was that a *backend-complete*
  capability hid a *user-facing-incomplete* one; one lens cannot see both.
- "Computed-then-dropped" missed: a field the backend produces that **no surface consumes** is a gap, not a
  non-issue (the grouped owner roll-up was built and silently discarded at the API adapter).
- A lens disagreement smoothed into a single voice (§11 — surface it).
- The auditor modifying the capability (writing `src/**`/`admin-ui/**`) — this is read-only; it finds, it does
  not fix.
- Severity sold as volume — one HIGH that blocks the bar outranks ten LOW polish notes.

## Verification (of this skill's own output)
- Every gap cites `file:line` or `TBD — verify`; the QUALITY BAR appears verbatim with an explicit PASS/FAIL per
  item.
- Both the backend AND the UX lens ran (the report carries both as-built sections); pack-conditional lenses ran
  where the surface demanded (money/PII → security-compliance; data → database-data; integrations →
  api-integration).
- Recommendations are prioritized P0/P1/P2 and each names the gap it closes.
- Reusable-extraction candidates are named (or an explicit "none").
- The report wrote ONLY under `docs/audits/` — no production file changed (read-only honored).

## Changelog
- 1.0.0 — new (experimental). Extracted from the Owner-Invoices enterprise overhaul 2026-06-27 (the named
  earning incident — two parallel read-only audits to an explicit founder bar → independently-verified PASS) and
  the Admin→PLOS invoice-delivery pipeline 2026-06-26 (8-audit recurrence). Generic/parameterized by capability
  name + surfaces; registered as a goal-routable `audit-capability` capability for the Slack Control Surface
  (read-only by construction, safe on the unattended path). Sibling to `migration-assessment` (one-capability
  vs whole-system) and upstream of `verify-gate` (finds gaps; verify proves the build closed them). Slack wiring
  is a later slice; design + definition only (see `DESIGN.md`).
