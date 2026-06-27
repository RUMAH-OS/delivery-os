---
review: foundation
date: "2026-06-27"
change: "config-doctor TEMPLATE sensitive-env false-negative fix — port of the merged PLOS PR #205 (sensitive-aware classifyVercelEnv + github-secret process.env fallback) into templates/tools/config-doctor.mjs so the bug cannot re-vendor into future scaffolded projects"
verdict: "STABLE"
lenses: "reviewer-critic (consistency/contradictions) + lead-architect (forward gaps) — worked blind, then consolidated"
---

# Foundation Review — config-doctor TEMPLATE sensitive-env fix

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2) — a change to the control-plane
> tooling family (`templates/tools/**`). Question: **are the foundations this change builds on still internally
> consistent + still valid?** Two INDEPENDENT lenses worked BLIND (reviewer-critic = contradictions/consistency ·
> lead-architect = forward gaps), then consolidated. No single agent concludes alone (§11). Constraint: do not
> redesign unless necessary.
>
> HONEST AUTHORSHIP NOTE: this Foundation Review was drafted by the build agent (the change's author). The
> consistency claim it rests on is independently checkable against an artifact that already passed an
> independent lens — the MERGED PLOS PR #205 (`property-lead-os/infra/config-doctor.mjs` on PLOS main). It is
> the parity of this template against that already-reviewed source that makes the foundation assessment
> verifiable rather than self-asserted.

## Foundation set reviewed
The load-bearing foundations this change rests on, cross-checked against the just-built reality:
- **The merged, independently-reviewed PLOS fix** — `property-lead-os/infra/config-doctor.mjs` (PR #205, on
  PLOS main). The canonical resolution of the sensitive-env false-negative. This template change is a PORT of
  that source, not a new design.
- **Vercel REST contract reality** — `GET /v9/projects/:id/env` returns `type:"sensitive"` vars with
  `value:""` BY DESIGN (the secret value is never returned). The whole bug is that the prior template read
  `value===""` as "blank/unset". This is a fixed, externally-documented platform behavior.
- **The config-doctor architecture itself** (`docs/verify/VERIFY-config-doctor.md`, the
  config-registry/config-doctor layer) — DECLARE/VALIDATE/RESOLVE, READ-ONLY, never prints a secret value.
- **The parity convention** (`.gitattributes` — `templates/tools/** text eol=lf`; the byte-exact drift gate)
  and the scaffolder (`scripts/new-project.sh`) that re-vendors this template into every new project — the
  reason a template-level bug propagates and must be fixed AT the template.
- **The review-class trigger + verify-gate** (the floor gating this change's own merge).

## VERDICT: STABLE

- **Consistency (reviewer-critic):** The change RESTORES consistency rather than introducing it. Before the
  fix, the template and the merged PLOS source DISAGREED on the single most load-bearing line — how to read a
  Vercel env entry's presence. The template called a sensitive secret (`value:""`) "blank → MISSING"; PLOS
  (post-#205) calls it "PRESENT-but-unreadable". That divergence is a real contradiction with the platform
  contract and with the already-reviewed sister implementation, and it is exactly the class of silent
  false-negative that fails a deploy gate on DATABASE_URL/SUPABASE_URL even when correctly set. The port aligns
  the template byte-for-logic with the reviewed source: `classifyVercelEnv()` (sensitive ⇒ not blank),
  the sensitive-vs-encrypted PRESENT detail string, and the github-secret `process.env` fallback. No new
  contradiction is introduced; the self-test now pins the rule (20/20, matching PLOS).
- **Forward gaps (lead-architect):** The model still supports the vision (one registry-backed, read-only
  infra config doctor every project inherits). The fix is purely ADDITIVE to the rule engine (one pure
  function + four self-test assertions + one fallback branch) — no schema change, no new owner type, no I/O
  surface added. One forward gap remains, recorded not closed: there is no automated PARITY guard that asserts
  `templates/tools/config-doctor.mjs` and the consumers' vendored copies stay logic-equivalent over time
  (today it is convention + the byte-exact engine drift gate, which does not cover this tool). That is the
  generalized root cause — a template bug silently diverged from an already-fixed consumer — and it is a
  Learning Review candidate (see the Learning Review), not a blocker for this change.

## Findings + fixes
| # | Sev | Finding | Fix applied / required |
|---|-----|---------|------------------------|
| F1 | Should (fixed) | Template judged Vercel env presence by `value!==""`, mis-reading `type:"sensitive"` (value:"" by design) as MISSING/BLANK — re-vendors into every scaffolded project | Ported the merged PLOS `classifyVercelEnv()` (sensitive ⇒ not blank, distinct from genuinely-absent) into the template; PRESENT detail now distinguishes SENSITIVE from encrypted |
| F2 | Should (fixed) | github-secret keys reported MISSING(unverified) in a Vercel runner that cannot `gh secret list` even when injected into the job env | Ported the PLOS `process.env[key.name]` fallback — a direct presence check before reporting unverified |
| F3 | Should (fixed) | No regression test locked the sensitive/blank classification | Added the 4 PLOS classification self-test cases; `--self-test` now 20/20 (was 16/16), matching PLOS |
| F4 | Nice (recorded) | No automated parity guard keeps the template + vendored consumer copies logic-equivalent | Learning Review candidate — convention + byte-exact drift gate today do not cover config-doctor |
| F5 | n/a (verified) | Could a vendored copy in delivery-os drift from this template? | Audited: the ONLY config-doctor.mjs in delivery-os is the template itself — no `.claude/tools/` or other vendored copy to update in lockstep |

## Conclusion
The foundations are **STABLE to build on**. This is a consistency-RESTORING port of an already-merged,
independently-reviewed fix (PLOS #205) onto the template that seeds every future project — additive to the rule
engine, no redesign, self-test 20/20. The one open item (no automated template↔vendored parity guard, F4) is a
recorded forward gap routed to the Learning Review, not a defect in this change. No redesign required.
