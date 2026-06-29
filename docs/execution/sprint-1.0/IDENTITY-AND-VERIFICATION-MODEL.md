---
artifact: IDENTITY & VERIFICATION MODEL (Sprint 1.0 policy — DRB §6 made concrete)
id: SPRINT-1.0-IDENTITY
date: 2026-06-28
status: FOUNDER-DECIDED (2026-06-28) — **Option A as the current minimal binding, designed onto a durable three-identity abstraction (Builder · Verifier · Project Owner) that evolves to dedicated Runtime identities WITHOUT architectural change** (§2). Still PENDING founder application of the GitHub settings (FOUNDER-ACTIONS.md). Author≠verifier: authored by the builder; the PO/founder verifies against the Sprint 1.0 DoD.
authoritative inputs (frozen): DRB-v1 §6 (author≠verifier redefined), §4 (gate sequence), §13 (founder-approval rule); IMPL-TRACKER Sprint 1.0.
---

# Identity & Verification Model

> The keystone of the safety floor: **a slice cannot be approved by the identity that authored it**, and
> "verification" means **independent re-execution on neutral hardware with a class-appropriate adversarial probe**,
> *not* "a second agent of the same model looked at it." This document is policy only — it applies no GitHub
> settings (those are founder-gated, see `FOUNDER-ACTIONS.md`).

## 1. The two things this model must guarantee (DRB non-negotiable #2)
1. **PR-author identity ≠ approver identity** — mechanically, at the merge gate. Self-merge must be *impossible*,
   not discouraged.
2. **Verification independence = substrate + probe, not agent identity** — two sessions of the same model share
   blind spots and a prompt-injection surface, so "another agent reviewed it" is **not** independence. The binding
   verifier is `verify-coverage`'s `machine_probe` **re-run on neutral CI hardware** with the **class-appropriate
   probe** (concurrency/abort for C12 stores · real-surface round-trip for the admin↔PLOS seam · planted
   fail-closed for gates · golden-master replay for the discovery port). **Mocks are banned at seams and at the
   verify step.** The verifier session writes only to a **disjoint scope** (`tests/`, `e2e/`, `evals/` — §C5).

## 2. The three Runtime identities (the durable abstraction — founder directive 2026-06-28)
The identity system is designed, from the start, around **three distinct Runtime principals** — **Builder**,
**Verifier**, **Project Owner** — that the gate logic references **by role, never by a hardcoded account**. The
N=1 *binding* of each role to a concrete identity is the cheapest practical one today, but the **abstraction does
not assume a single GitHub user forever**: it evolves to dedicated Runtime identities by **re-binding (config),
with zero architectural change** (§2.2).

### 2.1 The three principals, their current binding, and their target binding
| Runtime principal | Responsibility | Write-scope | **Current binding (N=1, minimal — Option A)** | **Target binding (evolved)** |
|---|---|---|---|---|
| **Builder** | authors slices (the untrusted actor; local-green has zero binding value) | production code (`apps/**`,`src/**`,`packages/**`,config) — **never** `tests/**`/`e2e/**`/`evals/**` | **`rumah-os-builder`** (GitHub user id `297716141`) — a dedicated machine account, **Write (not admin)** on all 5 RUMAH-OS repos; commit-author identity set per-repo via `git config --local`; push/PR-open via the Builder's fine-grained PAT (Contents+PRs write) in the agent session *(provisioning pending — see ACTION-1-EVIDENCE.md)* | a **dedicated Builder Runtime identity** (per-principal token via a GitHub App), one per concurrent build lane — same role, re-bound by config |
| **Verifier** | independent verification — the only binding judgment | mechanical: runs checks; human: merge approval only | **neutral CI hardware** (`verify-coverage` + the class-appropriate probe) **+ the founder `bkasanwiredjo` as the CODEOWNERS approver / verifier-of-last-resort** | neutral CI (unchanged) **+ a dedicated Verifier Runtime identity** as the CODEOWNERS approver; the founder retreats to verifier-of-last-resort only for non-mechanically-settleable properties |
| **Project Owner** | plans · dispatches · monitors · validates against DoD · allows completion (never lets a Builder self-complete) | orchestration state; no production-code write | the **orchestrator session under the founder's authority** (this PO loop) | a **dedicated Project-Owner Runtime identity** (the C2 organ, once P3/P5 land) holding its own scoped credential |

**The invariant that makes verification real (DRB §6, unchanged across the evolution):** *the Builder identity may
never equal the Verifier-approver identity, and verification independence = neutral-hardware re-execution + a
class-appropriate adversarial probe* — not "another same-model agent looked at it."

### 2.2 The evolution rule (no architectural change required later)
The three principals are **fixed**; only their concrete identity *bindings* change. The migration from the N=1
binding to dedicated Runtime identities is **purely configuration**:
- CODEOWNERS routes approval to a **role** (today `@bkasanwiredjo`; later the dedicated Verifier identity) — a
  one-line owner change, no workflow/architecture change.
- Branch-protection requires *"a CODEOWNERS approval by an identity ≠ PR author"* — **identity-agnostic by
  construction**; it never names the Builder or Verifier account, so adding dedicated identities needs no
  protection rewrite.
- The Builder's credential is a **session-scoped token** today and a **per-principal GitHub-App token** later —
  same gate, different secret. (Dedicated AI bot accounts / the GitHub App stay **DEFERRED** until founder-review
  is *provably* the throughput bottleneck — DRB §15; the abstraction is ready for them, but Waterline says don't
  build them at N=1.)
**Acceptance test for the design:** introducing a dedicated Builder/Verifier/PO identity later changes **only**
CODEOWNERS owners + token config — **no change to branch protection logic, the gate sequence, or any Runtime
component.** That is what "do not assume a single GitHub user forever" requires, and this design meets it.

## 3. The single-identity collapse — **RESOLVED 2026-06-28: Option A (minimal), on the §2 three-identity design**
> **Founder decision (2026-06-28):** implement **Option A** as the temporary binding (Builder commits under a
> distinct GitHub identity; `bkasanwiredjo` is the Verifier-approver), **and** design the identity system from the
> start around the three separate Runtime principals (§2) so it evolves to dedicated identities without
> architectural change. The remaining founder action is operational: **provision the distinct Builder identity +
> its session token** (FOUNDER-ACTIONS Action 1), then apply the settings.

**Today the git identity is `bkasanwiredjo` for BOTH the agent's commits AND the founder/approver.** If a PR is
authored *and* approved under one identity, CODEOWNERS review is **theatre** and DoD-6 collapses to honor-system
(DRB §6, Risk #1). This is **THE** Sprint 1.0 risk and it is a **founder checkpoint** — the worker does **not**
resolve it.

How the collapse actually manifests under the branch protection this sprint sets (GitHub already forbids a PR
author from approving their own PR):
- If the **agent commits as `bkasanwiredjo`** and the **only CODEOWNERS approver is `bkasanwiredjo`**, then every
  agent PR is **un-approvable** (the author cannot self-approve, and `enforce_admins=true` blocks an admin
  override) → **deadlock**: nothing merges. Fail-closed, but it halts all work.
- The *theatre* failure (silent self-approval) only appears if `enforce_admins` is OFF or the approval requirement
  is weakened — which is exactly why **no-admin-bypass is part of the floor**.

**The two options (founder decides — cheapest first):**

| Option | What it is | Cost | Recommendation |
|---|---|---|---|
| **A — distinct builder identity** | the agent commits/opens PRs under a **distinct GitHub identity** (a second personal account the founder owns, or a machine user) while `bkasanwiredjo` stays the CODEOWNERS approver | one account + a PAT/token the agent's session uses; **no GitHub App, no bot fleet yet** | **RECOMMENDED — cheapest sufficient.** Restores a real author≠approver split today without deferring the floor. |
| **B — founder-only approval, agent stays `bkasanwiredjo`** | accept that agent PRs are un-approvable by the agent; the founder reviews+approves every PR from a *different* logged-in identity/session | zero new accounts, but every merge needs the founder, and it only works if the founder's approving session is a **provably different identity** from the one that authored | weaker: if the founder ever lets the agent push under the founder identity, it silently collapses; and it makes the founder the throughput bottleneck immediately |

**Dedicated AI bot accounts / a GitHub App are DEFERRED** (DRB §15, §6b) until founder-review is *provably* the
throughput bottleneck. Do not build them now (N=1 Waterline). Option A is the minimum that makes the split real.

## 4. How this binds at the gate (cross-reference)
- The merge gate (DRB §4 "pre-merge"): all REQUIRED checks green **AND** a **CODEOWNERS approval by an identity ≠
  PR author** · linear history · no direct push · **no admin bypass**. Encoded in `branch-protection.json`
  (`require_code_owner_reviews: true`, `dismiss_stale_reviews: true`, `require_last_push_approval: true`,
  `enforce_admins: true`).
- `require_last_push_approval: true` strengthens the split: if the author pushes after an approval, the approval is
  dismissed and a fresh non-author approval is required — closing the "approve then sneak a commit" gap.
- The CODEOWNERS routing that names the approver lives in `CODEOWNERS.delivery-os` / `CODEOWNERS.template`.

## 5. What this sprint does NOT decide (out of scope — do not build)
Dedicated bot accounts / GitHub App (deferred); the full D7 state machine (Sprint 2.1); the actual CI job bodies
for `verify-coverage`/`secret-scan`/`config-gate`/migration-runner (land with 1.1/1.2/1.4 — only their *names* are
reserved here so branch protection can require them when they exist).

## 6. The binding proof (Sprint 1.0 DoD)
A **deliberate self-merge attempt is blocked**: a test PR authored under one identity cannot be merged without a
CODEOWNERS approval from a *different* identity, and an admin cannot bypass it (`enforce_admins=true`). That blocked
test-PR transcript is the binding evidence the PO verifies against — not any worker self-assessment.
