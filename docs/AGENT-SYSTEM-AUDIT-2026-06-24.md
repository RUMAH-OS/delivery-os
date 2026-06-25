# Agent System Audit — catalogs, duplication, drift, and a migration to ONE canonical catalog (2026-06-24)

> Forensic audit (actual files, not roles). Determines: which agents exist · which are spawnable · which
> catalogs are used · duplicated/missing/unreachable/drifted · a concrete migration to a single canonical
> catalog · optimized for maximum parallel execution. Evidence = direct file enumeration across the 3 repos.

## The catalog topology (how an agent becomes spawnable)
Each repo uses a **3-layer os-inherit model**:
```
delivery-os/agents/<name>.md            ← AUTHORED canonical source (the framework writes these)
   │  os-inherit install (strips domain--/optional-- prefixes)
   ▼
<repo>/.claude/base/agents/<name>.md    ← BASE layer (vendored from the framework)
   +  <repo>/.claude/overlay/agents/    ← OVERLAY (repo-specific additions/overrides)
   ▼  (merge)
<repo>/.claude/agents/<name>.md         ← SPAWNABLE set (what the harness Task tool reads)
```

## What exists vs what is spawnable (the headline gap)
| Repo | Authored | Spawnable (`.claude/agents/`) | The gap |
|---|---|---|---|
| **delivery-os** | **16** in `agents/` | **7**: documentation · founder-experience-reviewer · integration-architect · lead-architect · qa-test · reviewer-critic · software-engineer | **9 authored agents are NOT spawnable** (below) |
| **property-lead-os** | (inherits) | **8**: api-integration · database-data · documentation · lead-architect · qa-test · reviewer-critic · security-compliance · software-engineer | no FX-reviewer, no integration-architect |
| **rumah-admin** | (inherits) | **18**: the 8 base **+ 10 custom** (frontend-architect · frontend-engineer · product-designer · ux-reviewer · customer-journey-reviewer · knowledge-engineer · workflow-reviewer · qa-reviewer · founder-experience-reviewer · integration-architect) | richest; 10 agents the others can't reach |

**Three repos, three *different* spawnable sets** — there is no single catalog. This is exactly why I fell back to `general-purpose` so often this session (the specialist I wanted wasn't spawnable in the repo I was in).

## Findings

### 1. MISSING / UNREACHABLE — 9 authored delivery-os agents never installed
`deployment-operator · domain--ai-product · domain--api-integration · domain--database-data · domain--security-compliance · optional--accessibility · optional--design-parity · optional--seo · project-manager` are authored in `delivery-os/agents/` but absent from `delivery-os/.claude/agents/` → **the framework cannot spawn its own domain/ops/coordination specialists.**

### 2. NAMING DIVERGENCE — `domain--X` / `optional--X` (authored) vs `X` (installed)
The authored source uses prefixes (`domain--database-data`, `domain--security-compliance`, `optional--seo`); the installed copies in PLOS/Admin are unprefixed (`database-data`, `security-compliance`). os-inherit strips the prefix on install. → the **same agent has two names** depending on the catalog — a reconciliation hazard and a reason cross-repo matching fails.

### 3. CONTENT DRIFT — the canonical source disagrees with itself, and Admin disagrees with the framework
- **delivery-os `agents/` ≠ `.claude/base/agents/`** for **software-engineer, lead-architect, reviewer-critic** — the *authored canonical* has drifted from the *installed base* inside the framework itself. (`qa-test` is consistent.)
- **rumah-admin base DRIFTED** from delivery-os base for those same 3 — Admin is on an older/modified base (consistent with "Admin adopting v3 as it enters git").
- **PLOS base == delivery-os base** — PLOS is in sync.
→ Migration must reconcile **content**, not just names/presence. There is no clean "single source" today — even the source is internally inconsistent.

### 4. CATALOG-ORPHAN — `founder-experience-reviewer` is installed but NOT authored
It exists in `delivery-os/.claude/base/agents/` + spawnable, but **not** in `delivery-os/agents/` (the authored source). It was added directly to the installed layer, bypassing the canonical source → it can't be re-synced and will be lost on a clean re-install.

### 5. VALUABLE CUSTOM AGENTS stranded in Admin (promotion candidates)
Admin authored 8 specialists the framework LACKS and the other repos can't reach:
`frontend-architect` · `frontend-engineer` (frontend build — the framework has **no** frontend agents) · `product-designer` · `ux-reviewer` (design/UX) · `customer-journey-reviewer` (cross-surface journey) · `knowledge-engineer` (knowledge layer) · `workflow-reviewer` (operator-workflow quality) · `qa-reviewer` (meta-QA / test strategy). These fill the exact frontend/design/UX gaps from the catalog review — **promote to canonical.**

### 6. DUPLICATION & CLUTTER
- Every agent is duplicated across `base/` + the merged `agents/` × 3 repos (the overlay model keeps both — by design, but ×3 unsynced).
- **70 stale worktree agent-dir copies** under `property-lead-os/.claude/worktrees/agent-*/` — orphaned snapshots from prior agent runs; pure unreachable clutter; should be GC'd.

## Migration plan → ONE canonical catalog (sequenced; each via engineer→QA→reviewer)
The target: **`delivery-os/agents/` is the single authoritative catalog; every consumer's spawnable set = the canonical base (prefix-normalized) + a small, declared, repo-specific overlay; a drift-gate keeps them in sync.**

**M1 — Reconcile the canonical source (fix the internal drift first).**
- For `software-engineer`, `lead-architect`, `reviewer-critic`: diff `delivery-os/agents/` vs `.claude/base/agents/`, decide the true canonical content (newer/intended), and make `agents/` authoritative. Add **`founder-experience-reviewer`** to `agents/` (it's only installed). *Output: `agents/` is internally consistent + complete.*

**M2 — Normalize names.** Pick one canonical name per agent (recommend the unprefixed installed form: `database-data`, `security-compliance`, `api-integration`, `ai-product`, `accessibility`, `design-parity`, `seo`). Either rename the authored files or make the prefix→name mapping an explicit, tested step in `os-inherit`. *Output: no name ambiguity across catalogs.*

**M3 — Promote the strays + fill gaps.** Bring Admin's 8 custom agents into `delivery-os/agents/` (frontend-architect, frontend-engineer, product-designer, ux-reviewer, customer-journey-reviewer, knowledge-engineer, workflow-reviewer, qa-reviewer) as **base** (frontend/design/QA-strategy are broadly reusable) or **optional packs** (attach by surface). Add the 3 net-new specialists from the catalog review (workflow-engine, operations/SRE, research-synthesist). *Output: the canonical catalog covers the full lifecycle.*

**M4 — Install the full canonical set in delivery-os.** Make all canonical agents spawnable in `delivery-os/.claude/agents/` (currently 7 of 16) — the framework must be able to spawn its own specialists.

**M5 — Re-sync the consumers via os-inherit.** Re-install the reconciled canonical base into PLOS + Admin; reduce each repo's `overlay/` to ONLY genuinely repo-local agents (e.g. admin-ui-specific tweaks). Admin's base drift is healed by the re-sync. *Output: 3 repos converge to canonical-base + declared overlay.*

**M6 — Add a drift-gate.** Extend the existing `check-os-drift` discipline to assert each consumer's `.claude/base/agents/*` is byte-identical to the canonical (catch the Admin-style base drift in CI), and that every spawnable agent traces to a canonical source or a declared overlay (no orphans like FX-reviewer). *Output: drift can't silently recur.*

**M7 — GC the clutter.** Remove the 70 stale `worktrees/agent-*` agent-dir copies in PLOS.

## Optimized agent roster for MAXIMUM parallel execution (post-migration)
Once the single catalog is spawnable everywhere, fan-out uses the *right* specialist in parallel (no `general-purpose` bottleneck):
| Phase | Parallel specialists (all spawnable in every repo) |
|---|---|
| **Research** | research-synthesist ∥ Explore ∥ domain readers (per subsystem) |
| **Planning** | lead-architect + project-manager (DoD/sequencing) + §11 blind-lens panel (database-data ∥ security-compliance ∥ api-integration ∥ ai-product) |
| **Implementation** | software-engineer ∥ database-data ∥ integration-architect ∥ ai-product ∥ frontend-engineer ∥ workflow-engine (file-disjoint or worktree-isolated) |
| **Verification** | qa-test ∥ reviewer-critic ∥ qa-reviewer (meta-QA) ∥ security-compliance ∥ founder-experience-reviewer ∥ ux-reviewer ∥ workflow-reviewer (author≠verifier, blind) |
| **Rollout** | deployment-operator + release-readiness panel ∥ security-compliance sign-off |
| **Operations** | operations/SRE ∥ workflow-engine ∥ knowledge-engineer (incident→knowledge) |
**Standing coordinator: `project-manager`** (decompose→fan-out→consolidate→verify — the loop I ran ad-hoc all session).

## Concrete answer to the audit questions
- **Available (authored):** 16 in `delivery-os/agents/` (+ FX-reviewer orphaned in `.claude`) + 8 Admin-custom = ~25 distinct roles.
- **Spawnable:** divergent — delivery-os **7**, PLOS **8**, Admin **18**. No single set.
- **Catalogs used:** the 3-layer os-inherit (authored `agents/` → `.claude/base/agents/` → +`overlay/` → spawnable `.claude/agents/`), independently per repo, + 70 stale worktree copies.
- **Duplicated:** base+merged ×3 repos; +70 worktree copies.
- **Missing/unreachable:** 9 authored delivery-os agents not installed; FX-reviewer not authored; database-data/security-compliance not spawnable in delivery-os; FX-reviewer/integration-architect not spawnable in PLOS; Admin's 8 custom agents unreachable from the framework + PLOS.
- **Drifted:** `agents/` ≠ base for 3 core agents (delivery-os internal); Admin base ≠ framework base for the same 3.

## Honest limits
- Drift was sampled on 4 core agents (qa-test consistent; software-engineer/lead-architect/reviewer-critic drifted) — M1 should diff the *full* set before declaring the canonical.
- Promotion of Admin's custom agents assumes they're reusable beyond Admin; M3 should confirm each is repo-agnostic vs admin-ui-specific before basing vs packaging it.
