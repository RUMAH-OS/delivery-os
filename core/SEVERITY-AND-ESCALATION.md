# Severity & Escalation

## Severity (use everywhere — findings, audits, risks)
- **Blocker** — cannot ship / data-loss / security hole / false-success / legal-financial defect. Fix now.
- **Should-fix** — a real defect that degrades the release. Fix before the milestone.
- **Safe-to-defer** — minor, cosmetic, or future-phase. **Log it** (with an id); never silently drop.

## Escalate ONLY for
1. **A genuine blocker** — cannot proceed without a decision/input.
2. **External access** — credentials, DNS, a console, an account, an approval you don't hold.
3. **A business decision** — scope, positioning, money, legal, or a one-way-door architecture call.

A completed slice, a passing QA, or a green validation is **not** an escalation — continue and **batch** the report.

## Reporting buckets (at milestones)
1. **Completed** · 2. **Built, awaiting credentials** · 3. **Still to implement** · 4. **Required before release** · 5. **Deferrable**

## Irreversible actions = always a human gate
Merges and outward/irreversible business actions (send, charge, publish, migrate, delete, DNS change) require explicit human approval and a captured rollback state — regardless of confidence.
