---
event: "architecture-review"
date: "2026-06-27"
change: "config-doctor TEMPLATE sensitive-env false-negative fix — port of merged PLOS PR #205 into templates/tools/config-doctor.mjs"
triaged_by: "build agent (software-engineer lens), reconstructed from artifacts (PLOS PR #205, the template diff, the self-test run)"
milestone: "config-doctor template hardening (post-Infrastructure-Platform milestone)"
---

# Learning Review — config-doctor TEMPLATE sensitive-env fix

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Converts experience into ROUTED
> CAPABILITY. "No framework lessons discovered." is a valid answer — but here there IS a real one.

## 1. Reconstruct from artifacts (commits · VERIFY docs · decision/gate ledgers)
- PLOS hit a real false-negative: `config-doctor` reported `DATABASE_URL`/`SUPABASE_URL`/`TICK_TOKEN` as
  MISSING/BLANK even though they were correctly set in Vercel as **Sensitive** variables. Root cause: the
  Vercel list API returns `type:"sensitive"` vars with `value:""` BY DESIGN; the tool read `value===""` as
  "unset". PLOS fixed it in PR #205 (merged to PLOS main): a sensitive-aware `classifyVercelEnv()` plus a
  `process.env` fallback for VERCEL_* github-secrets the runner can't `gh secret list`.
- The SAME defective logic lived in `delivery-os/templates/tools/config-doctor.mjs` — the MASTER COPY the
  scaffolder (`scripts/new-project.sh`) re-vendors into every new project. The fix existed in one consumer but
  NOT at the source, so every future scaffolded project would have been born with the bug.
- This change ports the #205 corrections to the template, adds the 4 regression self-test cases (now 20/20,
  matching PLOS), and audits for vendored copies inside delivery-os (none — the template is the only copy).

## 2. Were any framework-level lessons discovered?
Yes — one structural lesson: **a fix applied only in a consumer does not protect future scaffolded projects;
a template bug must be fixed AT the template, and template↔consumer parity is currently unguarded for the
vendored TOOLS** (the byte-exact drift gate covers the workflow-engine, not `templates/tools/config-doctor.mjs`).

## 3. Capability impact (the §14 routing)
| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| Vercel `type:"sensitive"` returns `value:""` by design — presence ≠ non-empty value | Delivery OS | doctrine/code (config-doctor rule + self-test) | This template fix + the locked-in `classifyVercelEnv` self-test cases (done in this change) |
| A consumer-only fix leaves the template (and all future projects) defective — backport to the template is owed whenever a vendored tool is fixed downstream | Delivery OS | process/lint | OS-FEEDBACK candidate: a "downstream-fix → template-backport" checklist step; a parity guard for `templates/tools/**` vs known consumer copies |
| `templates/tools/**` parity is not mechanically enforced (only convention + the engine-only byte drift gate) | Delivery OS | lint/gate | Candidate: extend a drift/parity check to the vendored tool templates (design-first, not written from this retro) |

## 4. Did any EXISTING capability fail to catch this?
Yes. The byte-exact **engine drift gate** (`os-inherit engine-check`) covers `templates/workflow-engine/**`
and the contracts, but NOT `templates/tools/config-doctor.mjs`, so the template silently diverged from the
already-fixed PLOS copy with nothing flagging it. The review-class trigger DID correctly fire L2 on this
change (it classifies `templates/tools/**` as control-plane) — that capability worked.

## 5. Blast-radius fork
- **Project-local lessons** → none beyond this change; PLOS already shipped #205.
- **OS-base / cross-system lessons** → DESIGN-FIRST via `docs/feedback/OS-FEEDBACK-*.md` (do NOT write the
  base from this retro): (a) a "downstream-fix ⇒ template-backport" step in the delivery loop, and (b) a
  parity guard extending drift coverage to `templates/tools/**`. Both are candidates for the founder/OS triage,
  not implemented here.
