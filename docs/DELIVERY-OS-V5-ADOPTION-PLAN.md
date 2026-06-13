# Delivery OS v5 — Adoption Plan (promotion batch + translation ledger)

> Founder adoption-phase directive (2026-06-13). **We are adopting proven ideas, not Ruflo.** Objective: Delivery
> OS **v5** = v4 + tightening. Run through the OS's own machinery: §14 promotion batch, F2 single consolidated §11
> ratification, version bump minted by the base (F1), consumers adopt by pin. **Non-negotiable:** no lesson lost,
> no doctrine weakened, no safety invariant removed, no verification discipline reduced, no boundary blurred —
> everything compounds.
> Provenance: `case-studies/2026-06-13-company-os-phase.md` (incidents N17–N22 + Ruflo) +
> `case-studies/2026-06-incident-ledger.md`. Source recommendations:
> `rumah-admin/docs/DELIVERY-OS-V5-RECOMMENDATIONS-2026-06-13.md`.

## The mapping (v4 → learning → Ruflo → v5)
```
Delivery OS v4 (skills-first; verify-gate §12; §11 panels; §14 OS-feedback; §15 earned doctrine; 3-tier memory)
   │
   ├─ Learning review N17–N22  ──┐
   │                            ├──►  Delivery OS v5 = v4 + { A4 gate · risk-scaled+parallel verification ·
   ├─ Ruflo ideas (filtered)  ──┘                            token-cost instrument · test-hygiene standard ·
   │                                                          boundary-first · runtime-repro }  — KEEP all v4 invariants
   └─ Ruflo anti-patterns ──► explicitly REJECTED + recorded (so they are never re-litigated)
```
v5 is a **tightening, not an expansion.** v4's mechanism-over-prose core is kept whole; Ruflo is a *source of ideas
+ negative control* (it validated our discipline, see case study).

## KEEP UNCHANGED (the never-weaken list — re-asserted as adoption pre-condition)
Author≠verifier (§3) · verify-gate driving the running thing (§12) · §11 consequential-review · §14 OS-feedback +
promotion bar · §15 earned doctrine + mechanism-over-prose · earned-never-scaffolded skills · git-as-substrate ·
no-backflow + drift lints · irreversible-action human gate · gestured-pull default. **No v5 change may relax any
of these.** Each candidate below carries a self-application check proving it does not.

## Promotion candidates (each = problem · evidence · benefit · risk · migration · rollback · target · self-check)

### P-A4 — Read-canonical-first / contract-grounding gate **(the keystone)**
- **Problem:** building a cross-system surface against a *model* of a contract instead of its bytes.
- **Evidence:** N18 (PULL-built-vs-PUSH-ratified + envelope divergence + duplicate doc; consumer-contract drift; producer-ranks-attention misstep) — continues the June dual-contract incident (F4).
- **Benefit:** kills the phase's most expensive defect class (contract/consumer/assumption drift) → less rework, less founder mediation. (safety + founder-leverage)
- **Risk:** adds a pre-build step that could feel like ceremony on intra-repo work. *Mitigation:* scoped to **cross-system** producer/consumer surfaces only (a project's own internal slice is exempt, like §12's non-impl exemption).
- **Migration:** add a loop step ("Ground" before "Implement" for cross-system slices) in `core/OPERATING-LOOP.md`; strengthen §15 *contracts+probes* + the *audit-before-assume* beat with the clause "a contract existing ≠ a contract read"; new earned skill `contract-grounding` (read canonical + consumer + SoT, record the shape, then build); a DoD line requiring a grounding note on cross-system slices.
- **Rollback:** it is doctrine + a skill + a DoD convention (policy, §13) — revertible by doc revert + version-pin; no mechanism removed. Mechanization (a hook) is **deferred until an observed §11-style skip earns it** (the way §12 was earned), stated honestly per §13.
- **Target layer:** `core/OPERATING-LOOP.md` + `core/GOVERNANCE.md` (§15) + `skills/contract-grounding/` + `core/DEFINITION-OF-DONE.md`.
- **Self-check:** strengthens, never weakens, §15 + audit-before-assume; no invariant relaxed. ✅

### P-A2 — Risk-scaled + parallel-batched verification
- **Problem:** the per-slice double-subagent verify cycle is the dominant token spend; full independent QA on *trivial* slices is overkill.
- **Evidence:** N20 (~15 slices × engineer+qa(+re-verify), cold re-reads).
- **Benefit:** same quality, materially less token + wall-clock; independent subagents batched in one message (Ruflo's "1 message = all related ops", de-Rufloed). (token + speed)
- **Risk (the dangerous one):** eroding §3/§12 if mis-applied. *Mitigation / SELF-CHECK (hard line):* independence stays **non-negotiable** for load-bearing/cross-system/schema/prod/money/PII slices; A2 only relaxes **trivial** slices (tests-only, tiny-UI, docs) which the gate's non-impl exemption already contemplates. A2 is a **rubric for when to spend a full independent pass, never a license to skip one where the classes require it.**
- **Migration:** a verification-rigor rubric in `core/DEFINITION-OF-DONE.md` (class → required rigor) + an operating-loop note to parallel-batch independent verifications; update `verification-playbook` skill.
- **Rollback:** doc/rubric revert; the gate itself is unchanged (still fires on impl changes).
- **Target:** `core/DEFINITION-OF-DONE.md` + `core/OPERATING-LOOP.md` + `skills/verification-playbook/`.
- **Self-check:** §3/§12 untouched; relaxation bounded to trivial; gate still fires. ✅

### P-A1 — Deterministic / direct-edit tier before spawning agents
- **Problem:** spawning a build subagent for mechanical/trivial edits.
- **Evidence:** N20; Ruflo's Tier-1 codemod idea (concept only).
- **Benefit:** mechanical work done directly (or via codemod) at ~0 agent cost; agents reserved for genuine build+verify. (token)
- **Risk:** a "trivial" misjudgment skips needed rigor. *Mitigation:* A1 routes *mechanical* edits only; anything touching impl files still trips the gate → still needs verification.
- **Migration:** operating-loop doctrine line ("direct/deterministic tier before agents for mechanical work").
- **Rollback:** doc revert.
- **Target:** `core/OPERATING-LOOP.md`.
- **Self-check:** the gate still fires on impl changes; no independence relaxed. ✅

### P-A3 — Token / cost observability instrument **(the genuinely-new primitive)**
- **Problem:** the OS measures `verify_status`, drift, gates, evidence counters — **everything except token cost**; the double-subagent spend was invisible while it happened.
- **Evidence:** N20; Ruflo's Cost-Tracker (concept only — we have none).
- **Benefit:** visibility into where the system spends (per slice / role / verification), so A1/A2 can be steered by data, not guess; a founder-facing cost line. (token + founder-leverage)
- **Risk:** over-engineering into a framework. *Mitigation:* a **lightweight accounting line**, not a daemon/queue (honors the gestured-pull / zero-background-process default, §15).
- **Migration:** a small instrument (a per-slice cost note in the VERIFY/loop artifact, or a `cost.md`-style counter), aligned with the existing `instruments-audit` cadence; design first, mechanize lightly.
- **Rollback:** remove the instrument; nothing depends on it for correctness.
- **Target:** a new lightweight tool/template + `instruments-audit` skill note. (design before mechanizing)
- **Self-check:** no background process; doesn't gate correctness; additive. ✅

### P-A6 — Test-fixture hygiene standard + clean-frontmatter rule
- **Problem:** shared-DB fixture accumulation + cap-dependent assertions → flaky full-suite (fixed twice); an inline-comment frontmatter broke the gate parser.
- **Evidence:** N21.
- **Benefit:** stable suite, CI parity, less repeated friction; gate robustness.
- **Risk:** low.
- **Migration:** a `checklists/test-hygiene.md` (tag-scoped teardown; cap-independent count-delta assertions on shared DBs; run-unique tokens — extends June B25); a clean-VERIFY-frontmatter rule (no inline comment on `verify_status`) in the gate/template.
- **Rollback:** checklist/template revert.
- **Target:** `checklists/` + `templates/OS-FEEDBACK`/VERIFY template + `skills/verification-playbook/`.
- **Self-check:** strengthens verification reliability; weakens nothing. ✅

### P-BOUNDARY — Boundary-first doctrine
- **Problem:** cross-system ownership boundaries emerged through founder correction mid-phase.
- **Evidence:** N22 (producer-owns-facts/consumer-owns-ranking; don't-edit-sibling; don't-build-what-the-consumer-replaces).
- **Benefit:** fewer rework round-trips + less founder mediation; a one-line work-prioritization lens ("does this help the consumer understand/operate?"). (founder-leverage)
- **Risk:** low (doctrine).
- **Migration:** a doctrine line in `core/GOVERNANCE.md` (alongside §8 Waterline / §7 ownership) + folded into the `contract-grounding` skill.
- **Rollback:** doc revert.
- **Target:** `core/GOVERNANCE.md` + `skills/contract-grounding/`.
- **Self-check:** complements §7/§8; weakens nothing. ✅

### P-REPRO — Runtime-repro + checked-in guard (fold into deploy/cutover skills)
- **Problem:** prod bugs "fixed" from assumptions/curl; the same class recurred 3×.
- **Evidence:** N17 (pooler saga).
- **Benefit:** prod bugs reproduced on the running thing under load; a permanent regression guard. (safety)
- **Migration:** update `deploy-vercel-supabase` (session-pooler-not-transaction-pooler foot-gun; post-deploy concurrency smoke; migrate-then-deploy expand pattern; the harness blocks the *agent* from prod migrations → human runs them) + `cutover-execution`; a doctrine line under §1.
- **Rollback:** skill version revert (skills are versioned).
- **Target:** `skills/deploy-vercel-supabase/`, `skills/cutover-execution/`, `core/GOVERNANCE.md` §1.
- **Self-check:** strengthens §1 evidence; weakens nothing. ✅

## REJECTED (recorded so they are never re-litigated) — Ruflo anti-patterns
| Rejected | Why (cited) | Doctrine |
|---|---|---|
| Adopt Ruflo package / agent-execution core | Independent audit: core non-functional ("the wire is missing"); would inherit theater + token-noise memory | D-NEGATIVE-CONTROL |
| Federation / consensus (Raft/Byzantine/Gossip) / trust scoring / PII pipeline | No cross-org/multi-machine trust boundary in a solo Company OS | §8 no-premature-platform |
| Surface-area scaling (45 agents / 314 tools) | Inverts earned-never-scaffolded; ~10 functional | N1, D-MECH |
| SONA / opaque neural self-optimization | Opaque, unverifiable, audit-reported non-functional | §1 evidence |
| Witness-manifest "verify" as work-verification | Conflates byte-integrity with correctness; would dilute §12 | §12 |
| Uncurated auto-recall vector memory | Audit: injected ~15–25k duplicate-noise tokens/session — worsens the pain it claims to fix | 3-tier memory (human-auditable) |

## Overall migration & rollback strategy
- **Path:** doctrine-first, code-light, through §14 → **one consolidated F2 §11 ratification** over this batch (per-promotion evidence travels in the changelog; the translation ledger above maps every lesson; an unmapped lesson blocks the merge) → **base mints the v5 version** (F1: changelog + tag + the §14 trigger) → consumers adopt by **pin** (`.claude/.verify-config.json os_version`) at named moments.
- **Phasing:** Phase-0 (doctrine + skills: A4, A2-rubric, A6, BOUNDARY, REPRO — highest leverage, lowest risk) → Phase-1 (light tooling: A3 cost instrument, A1 habit, A5 handoff convention) → Phase-2 (evaluate a live conformance signal only if Phase-0/1 pay off).
- **Rollback:** every candidate is policy/doctrine/skill/checklist (revertible) or a versioned skill bump; **no kernel mechanism is removed or weakened**, so rollback = doc revert + staying on the v4 `os_version` pin. The version namespace (F1) makes the whole batch rollbackable to a tag.

## Consumer flow (success criteria 6–8) — Delivery OS first, then identify flow
PLOS should inherit from Delivery OS; never the reverse. After the base lands v5 + the §11 ratification:
- **All consumers (Admin, PLOS, future Company-OS):** A4 contract-grounding (any cross-system surface), A6 test-hygiene, A2 risk-scaling, A3 cost visibility — adopt by pin.
- **Admin-specific:** P-REPRO (the pooler/session-pooler foot-gun lives in its deploy reality); D-BOUNDARY (Admin=facts already adopted locally — promote the noun-free form).
- **PLOS-specific:** A4 most acutely (it consumes Admin truth); D-BOUNDARY (consumer-owns-ranking).
- **Future Company-OS:** all of the above inherited at scaffold via the version pin — the point of promoting to the base.
- **Identification only here** — actual per-consumer adoption is a pinned, named moment each consumer chooses (not done from the base).

## Self-application verdict
Every candidate was checked against the lessons; none weakens an invariant (the hard one, A2, is bounded to trivial
slices with independence non-negotiable for the load-bearing classes). No conflict found that requires stopping.
The batch is ready for the single consolidated §11 ratification before any base file changes.
