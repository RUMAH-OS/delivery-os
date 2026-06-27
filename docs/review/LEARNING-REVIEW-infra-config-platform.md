---
event: "new-capability"
date: "2026-06-27"
change: "Infrastructure Config Platform — config-doctor + registry + deploy gates + consolidated FAP"
triaged_by: "qa-test landing lens (reconstructed from commits + VERIFY docs + the infra inventory, not memory)"
milestone: "infra-config-cutover (config layer landed across delivery-os + PLOS + rumah-admin; founder cutover pending)"
---

# Learning Review — Infrastructure Config Platform

> Auto-triggered by the Review-Class Trigger (Governance §14 · ADR-003 L2). Converts experience into routed
> capability — not a feelings document.

## 1. Reconstruct from artifacts
- The recurring pain: repeated prod-deploy failures with cryptic messages (`Invalid environment configuration:
  DATABASE_URL is required / SUPABASE_URL: Invalid url` → `Failed to collect page data`) and a connection-exhaustion
  503, plus a stream of one-off "set this one variable" founder asks (`FAP-platform-hardening-v6.md`).
- The build (commit `de1f695` delivery-os; `4775e75` PLOS; `afb1d61` rumah-admin): a declarative
  `config-registry.json` per service derived from each app's real env schema, a read-only `config-doctor.mjs` that
  validates live Vercel prod state, CI gates (PLOS pre-build step; rumah-admin `config-gate.yml`), and ONE
  consolidated `FAP-infra-config-cutover.md`.
- Independent verification (this pass, `VERIFY-infra-config-platform.md`): self-test 16/16; PLOS prod FAIL=8 keys,
  rumah-admin prod FAIL=4 keys (exactly the FAP's sets); pooler-6543 rule encoded; gates fail-closed; no phantom keys.
- The infra inventory (`docs/audits/INFRASTRUCTURE-INVENTORY-2026-06-27.md`, finding D2) proved BOTH apps deploy to
  the TEAM scope `team_1CSTFxqvnOe9lvHtCsPHSeax` — exposing that the FAP was silent on scope and a sibling doc named
  the wrong personal scope.

## 2. Were any framework-level lessons discovered?
Yes, two:
- **L-A:** Config that BLOCKS production should be DECLARED (a registry derived from the real env schema) and machine-
  validated at the deploy gate, not discovered one cryptic crash at a time. This generalizes to any Delivery OS
  consumer on Vercel+Supabase.
- **L-B:** The TARGET of a founder action (which Vercel scope/project) is itself load-bearing config that drifts. A
  founder-action package must name the exact scope, proven from disk, or the action silently no-ops.

## 3. Capability impact (the §14 routing)
| Lesson | Layer | Asset | Destination |
|--------|-------|-------|-------------|
| L-A: declare+gate blocking config | Delivery OS | tool (`config-doctor.mjs`) + template (`config-registry.schema.json`) + process (CI gate) | framework base — landed under `templates/tools/` + adopted by 2 consumers; reusable for future consumers (the-floor / content-os born-correct via the scaffolder) |
| L-B: founder-action must name the proven deploy scope | Delivery OS | doctrine + template hardening (FAP must carry the canonical scope) | additive FAP correction this series; candidate: add a "canonical scope, proven from disk" required line to the FAP template |

## 4. Did any EXISTING capability fail to catch this?
- The **deploy pipeline** previously failed CLOSED but ILLEGIBLY (cryptic crash, no complete list) — the config-doctor
  is the strengthened capability that turns that into a clear, complete diagnostic. (This is exactly how this review's
  own trigger was earned: a mechanically-invisible-but-major change.)
- The **FAP authoring** capability did not require naming the proven Vercel scope, so the scope drift reached a
  founder-facing doc — caught only by the independent inventory + this verification, not by an automated check.
  Candidate: a lint/template-rule that a FAP touching Vercel must name a disk-proven `team_*` scope.

## 5. Blast-radius fork
- **Project-local lessons** (implemented in this series): the PLOS + rumah-admin registries + gates are in place; the
  FAP scope correction is applied.
- **OS-base / cross-system lessons** (DESIGN-FIRST, never written from a retro): the reusable config-doctor + schema
  now live in `templates/tools/`. The "FAP must name the disk-proven deploy scope" doctrine is a candidate for an
  OS-FEEDBACK triage + the FAP template before it becomes a hard rule — recorded here, not silently committed to base.
