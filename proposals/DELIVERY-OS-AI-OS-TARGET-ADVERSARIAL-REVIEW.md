# Delivery OS → AI-OS Target Architecture: Adversarial Review (Step 3)

> The same hostile scrutiny applied to the current state, now applied to the **proposed** target (`DELIVERY-OS-AI-OS-TARGET-ARCHITECTURE.md`). 5 blind lenses, each tasked to KILL a proposed element unless it earns its existence against an OBSERVED corpus failure and the simplest-sufficient bar. Date 2026-06-10. Branch `review/ai-os-hierarchy-alignment`. **For founder decision — nothing implemented.**

## Verdict: the target did NOT fully survive. Ratify a REDUCED CORE.
The proposal's **diagnosis is sound and corpus-verified**; its **response is over-built.** It adds ~12 mechanisms/layers; **5 are earned by observed failures, 5 should ship in a lighter form, 3 should be deferred (Waterline), 3 cut as speculative.** In trying to make the kernel "load-bearing," the target re-introduced exactly what the binding reference rejects — generators, a machine state-layer, a permission engine, a frontmatter taxonomy — *before the thing each governs exists.* **A reduced core fixes all six observed problems with one new build check and zero new machine layers, and is *more* faithful to the reference's "just folders and files" ethos than the full proposal.**

## The single fact that collapses most of Deliverables 4 & 6
**The §12 verify-gate has never fired in a real consumer.** On disk: `rumah-admin/.claude/` does not exist (no hooks, no skills, not even git); PLOS has 2 hand-built agents and a `settings.local.json` with **no hooks**; **0/7 skills installed anywhere**; the shipped `SKILL.md` files have **no `trigger:`/`mode:`/`detect:` field** — every "trigger block" in the proposal is net-new invention. The proposal's own migration guardrail says *"do not touch `core/` until §12 has caught a real turn."* **§12 has caught zero turns.** By its own bar, the entire mechanism-expansion program (skill-gate engine, require-mode for non-verify skills, Capability Manifest, core/ refactor) is premature — it generalizes one hook before that hook has run once.

## The observed problems the architecture MUST fix (verified on disk)
| # | Problem | Evidence |
|---|---|---|
| O1 | No consumer mounts the OS; all re-implement | rumah-admin `.delivery-os/` = flattened stale-v2 copy, no git/`.claude/`; PLOS `qa-tester`≠framework `qa-test` voids CODEOWNERS; `new-project.sh` never run anywhere |
| O2 | Kernel decorative; routers lie | rumah-admin `CLAUDE.md` §5/§6 advertise `.claude/skills`+`.claude/agents` that don't exist; deleting CLAUDE.md breaks nothing |
| O3 | 6/7 skills advisory | no `trigger:`/`mode:` in any SKILL.md; only verify-gate fires (via hook) |
| O4 | Knowledge layer empty in 100% of instances | no `wiki/` in PLOS or rumah-admin; real knowledge in `docs/`/`proposals/`/`case-studies/` |
| O5 | §12 inert where most needed | rumah-admin has `src/`+`migrations/`+`tests/` but no git/hook/`docs/verify/` |
| O6 | No version boundary | `delivery-os` has **zero git tags** — `checkout <tag>` is impossible; "submodule or copy" is the drift door |

## Per-element verdict (KEEP / SIMPLIFY / DEFER / CUT)
| Element | Verdict | Why |
|---|---|---|
| **Tag the framework `v3.0`/`v3.1`** | **KEEP** | One command; unblocks O6; prerequisite for any propagation |
| **Generate `.claude/`+router+CODEOWNERS from the OS (run the scaffolder)** | **KEEP** + **add an overlay/merge story** | Fixes O1/O2 root cause. BUT generation must NOT clobber PLOS's hand-built, specialized agents (`qa-tester.md` carries real `@plos/*` package rules + slice anchors). Need a base+local-overlay model, not pure `cp`. |
| **Derive §5/§6 from a directory scan (`ls .claude/`)** | **KEEP** | The kernel becomes load-bearing for the cheapest reason — a listing can't advertise an absent syscall. No state machine. |
| **router-vs-disk drift = build error** | **KEEP, narrowed** | Fail-closed ONLY on phantom-dispatch (router/CODEOWNERS names a skill/agent with no backing file) or vendored-OS≠tag. WARN on cosmetic staleness (the reference tolerates an imprecise router; failing the build on lag is self-DoS). |
| **`.os/state.json` + status-deriver hook** | **SIMPLIFY → reuse existing `.claude/.verify-state.json`** | A *new* machine layer + second status source is the very router-drift disease relocated one layer down. The verify-gate already computes the answer (`freshPassArtifact()`) and **discards it** — persist it to the file that already exists; render §9 from it. Or simpler still: a read-only lint computes it live, writes nothing. NO new source of truth. |
| **`skill-gate` engine (require/suggest/manual across 7 skills)** | **SIMPLIFY → at most `require` for 2, via the existing hook** | Generalizing one hook into a frontmatter dispatcher is a platform from a single consumer (Waterline). At most: extend the *existing* hook to fail-close on a `require:`+`artifact:` predicate for the 2 skills with a disk-observable artifact (principle-11 → `DECISION-REVIEW-*`; readiness → release). Leave 5 description-dispatched. **See open disagreement B — Mechanism lens argues even this is premature.** |
| **Mechanism/policy split** | **SIMPLIFY → a documented LENS, not a `core/` refactor** | The "key vs prompt" test is a genuinely good *admission filter* for what may become a mechanism. But re-architecting `core/` into two trees is a refactor against zero failures attributable to the current single floor — and contradicts the proposal's own "don't touch core/ yet" guardrail. Ship as prose in GOVERNANCE. |
| **Escalation ladder (self→independent→§11→key-absent)** | **SIMPLIFY → document; tiers 1–2 already exist** | verify-gate already exempts non-impl and blocks impl-without-independent-artifact. Tiers 1–2 are implemented. Tier 3 = the principle-11 `require` (disagreement B). Tier 4 (key-absent) defers with the Capability Manifest. |
| **8-cluster wiki + 5 new frontmatter keys** | **SIMPLIFY → `kind` + `as_of` only** | O4 is fixed by *populating* the wiki via `git mv` of homeless `docs/` narrative — that needs a wiki + `kind`. The 8-enum, `locked`/`frozen`, `confidentiality`, `segment_scope` are schema speculation ahead of data; add per cluster as real documents arrive. |
| **Connections layer (`connections/` registry + key-contract)** | **DEFER (Waterline)** | Zero `connections/` consumers anywhere. PLOS — the most connection-heavy project — already models ALL live connections (Supabase/SerpAPI/Anthropic/Gmail) as ordinary Zod-validated env vars in `packages/config/src/env.ts`. The evidence proves a *practice* ("scope keys when you wire data"), not a *layer*. Would duplicate the LOCKED `ecosystem-architecture/06-source-of-truth-registry.md` (§7 second-source defect). Earn it in rumah-admin (Spine/invoicing), promote when rumah-website pulls. |
| **Capability Manifest / per-agent scoped keys** | **DEFER (Waterline)** | 100% theoretical: no `.claude/settings.json` exists anywhere; no agent runs with a scoped key-set. Its one concrete claim (author≠verifier write-binding) is **already mechanized** by CODEOWNERS + verify-gate. Keep "keys not prompts" as the GOVERNANCE §6 principle + the preflight checklist. |
| **Cadence layer** | **DEFER (Waterline)** | The reference says cadence is *earned last*, after skills are battle-tested; none are. Empty `_index.md` placeholder at most. |
| **`manifest.json` (separate file)** | **CUT** | A version stamp is one line; fold into the existing `.verify-state.json` or a `.delivery-os-version` stamp. Redundant ceremony. |
| **`FEEDBACK.md` per-skill capture loop** | **CUT** | No skill has run enough to generate feedback; flagged as an author≠verifier concern. Add when a skill has a retro to capture. |
| **`segment_scope` frontmatter** | **CUT** | Justified only by "future B2B-platform/Content-OS consumers" — textbook speculative scaffolding, violating the project's own Waterline (§8). |

**Tally: KEEP 4 · SIMPLIFY 5 · DEFER 3 · CUT 3.** (Connections/Cadence survive only as empty placeholder files, not built layers.)

## The reduced architecture (concrete — fixes all 6 observed problems, no new machine layer)
```
<project>/
├── CLAUDE.md            # kernel. §1-3,7,8 HAND (intent). §5/§6 = render of `ls .claude/{skills,agents}`.
│                        #   §9 verify_status = render of .claude/.verify-state.json (file already exists)
├── .claude/
│   ├── skills/…  agents/…    # GENERATED from the pinned/copied OS (never hand-typed) + a local-overlay for project specializations
│   ├── hooks/verify-gate.mjs # EXISTING hook, two small extensions: persist its discarded result to .verify-state.json; optional require: check
│   ├── settings.json         # EXISTING default-deny allowlist = the "keys" floor for now
│   └── .verify-state.json    # EXISTING file — also holds active-slice + OS version stamp + drift flag
├── CODEOWNERS          # GENERATED; names match agent files by construction (kills the qa-test void)
├── wiki/               # POPULATED via `git mv` of homeless docs/ narrative; frontmatter = kind + as_of
├── docs/               # owned truth + ADRs (kernel POINTS)
└── delivery-os/        # the OS, versioned-copy-with-stamp + drift-lint (submodule = optional upgrade — see disagreement A)
```
Framework side: cut tag `v3.0`; stand up `delivery-os/.claude/` so the OS **dogfoods its own gate**; add ONE build check (router/CODEOWNERS names a skill/agent absent from `.claude/`, or copied-OS ≠ stamped version → fail). `core/` gains a prose mechanism/policy header — no tree split.

## The faithfulness inversion (the headline)
The reference prizes *"just folders and files," a hand-maintained router, "no generator reconciles it," "no database needed — just markdown," skills that can be "just a prompt."* The **full proposal violates this in four places** (`.os/` state-layer, Capability-Manifest engine, Connections registry, 5-key frontmatter) — it "starts with architecture," the exact thing the reference opens by rejecting. **The reduced architecture is more faithful**: the only generator is a directory scan + `git mv`; the only new state reuses a file already on disk; deferred layers are empty markdown placeholders. The **two** delivery-domain additions that genuinely exceed the reference are each forced by an observed failure: (1) the fail-closed verify-gate at kernel level (§12 / the Slice-1.0 incident / the reference's own "if it can, it will"), and (2) a version boundary, because a *live* invoicing/signatures system cannot absorb a silent `core/` change the way a solo creator's notes app can.

## Two residual disagreements for the founder to rule on (not smoothed)
**A. Consumption mechanism: versioned-copy-with-lint vs submodule-pin.**
- *Operability lens:* submodule-pinning is **not justified** — the operator is a solo founder + one human approver across three separate single-owner repos (the reference's own solo-creator case, which blesses copying). Submodules import detached-HEAD/two-step-commit/forgotten-recurse pain onto PLOS's currently clean zero-submodule pnpm monorepo, to buy a version boundary a **one-line version stamp + CI drift-lint** already buys. Recommend: **versioned copy + stamp + drift-lint now; submodule only if a second team/independent cadence appears.**
- *Minimal lens:* keep the submodule for a *live invoicing system* so a `core/` fix lands at a deliberate boundary.
- **My lean:** versioned-copy-with-lint (simpler, workable against the real repos today; the version boundary is preserved by the stamp). Submodule stays a documented future upgrade.

**B. `require`-mode for principle-11-review.**
- *Minimal lens:* SIMPLIFY — gate the 2 skills with disk-observable artifacts.
- *Mechanism lens:* CUT — §11 reviews **already happen by practice** (rumah-admin has 4 real `DECISION-REVIEW-*`/VERIFY artifacts produced with *no* gate). Gating it mechanizes a failure that has not been observed; contrast the verify-gate, earned by a *real* incident.
- **My lean:** Mechanism lens is more rigorous — **don't gate §11 yet.** Ship verify-gate to a real consumer, let it catch a real turn, and only add a new gate when an *observed* skip earns it. Gate what has failed, not what might.

## Recommendation
**Do not ratify the full target. Ratify the reduced core** (KEEP + SIMPLIFY) as the Step-3 dogfood scope, **defer** Connections/Cadence/Capability-Manifest behind empty placeholders (earn per Waterline), and **cut** `manifest.json` / `FEEDBACK.md` / `segment_scope`. This fixes all six observed problems, honors the reference's simplicity better than the proposal, and respects the project's own guardrail (don't expand mechanism until §12 has caught a real turn). The AI-OS *principles* (kernel-first, skills-first-class, knowledge-layer, consume-not-copy, keys-not-prompts) are all preserved; only the speculative *machinery* is shed.
**Next gate:** founder rules on A and B, then **Step 3 = dogfood the reduced core on the framework itself** (tag, stand up `delivery-os/.claude/`, generate-not-hand-type, populate the wiki) — the OS runs the model before any consumer adopts. Rumah Admin stays paused until step 8.
