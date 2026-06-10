---
slice: "os-feedback-loop — Delivery OS learns from consumers (mechanical trigger, human judgment)"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-feedback-loop"
date: "2026-06-11"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — OS Feedback Loop (Delivery OS v3.8)

Independent QA. The author was a separate build session; this verifier ran every mechanism in an
isolated repo and adversarially probed for bypasses. The founder-ratified core requirement —
**the trigger is a mechanism, the judgment is human** (a release-class event mechanically requires
an OS-feedback triage to *exist*; a release may still validly conclude "no framework lessons") — is
the object of verification.

## Method
Isolated repo `/tmp/fbtest`: copied `templates/hooks/verify-gate.mjs` → `.claude/hooks/`, wrote
`{"impl_extra":[]}` → `.claude/.verify-config.json`, `git init` + commit. Tag pushes were simulated
by feeding git's pre-push ref-line protocol on stdin:
`refs/tags/<T> <tagsha> refs/tags/<T> 0000…0000 | node .claude/hooks/verify-gate.mjs pre-push`.
No-backflow lint and drift gate were run against the real framework working tree (revert after each
adversarial mutation).

## Evidence table

| # | Item | Command (abridged) | Exit | Expected | Verdict |
|---|------|--------------------|------|----------|---------|
| 1a | Release tag, **NO** `OS-FEEDBACK-T.md` | `pre-push` feed tag T | **1** | 1, blocks, names §14 | PASS |
| 1b | Tag T **with** `docs/feedback/OS-FEEDBACK-T.md` (content `None.`) | `pre-push` feed tag T | **0** | 0, allowed | PASS |
| 2  | "No lessons" valid — same artifact contained only `None.` | (1b) | **0** | existence, not verdict | PASS |
| 1c | Branch push `refs/heads/main …`, **no tag** | `pre-push` feed branch | **0** | 0, only tags trigger | PASS |
| 1d | Tag V2 with generic `OS-FEEDBACK-something.md` (NOT tag-named) | `pre-push` feed tag V2 | **0** | 0, fallback allows | PASS |
| 3a | No-backflow lint, framework clean | `node scripts/check-no-backflow.mjs` | **0** | 0 clean-room holds | PASS |
| 3b | Plant `@plos/test` in `core/SEVERITY-AND-ESCALATION.md` | lint | **1** | 1, names file:line | PASS |
| 3c | `git checkout` revert + re-run | lint | **0** | 0 | PASS |
| 3d | Tech name `Supabase`/`BullMQ` in a clean-room doc | lint | **0** | 0, no false-positive | PASS |
| 3e | `case-studies/` (holds `property-lead-os.md`, `rumah-website.md`) + `proposals/` not flagged | lint clean (3a) | **0** | exempt by DIRS scope | PASS |
| 4  | Doctrine + touchpoints exist (grep) | see below | — | all present | PASS |
| 5a | Framework drift gate | `node .claude/tools/check-os-drift.mjs` | **0** | 0 (1 advisory warn) | PASS |
| 5b | `node --check` hook + lint | node --check ×2 | **0** | parse OK | PASS |
| 6  | Non-regression: branch push of `src/x.ts`, **no VERIFY** | `pre-push` feed branch | **1** | 1, §12 impl-gate blocks | PASS |

### Item 4 touchpoint grep results (all found)
- `core/GOVERNANCE.md:70` — `## 14. Delivery OS learns from its consumers (the OS Feedback Loop)` (full doctrine body: mechanism/policy split, no-backflow guardrail, §11-gated promotion, "not assumed a skill").
- `core/OPERATING-LOOP.md:39` — `os_candidate: true` write-back row; line 41 — the §14 hygiene sweep ("sweeps open `os_candidate` flags to triage them (§14)").
- `skills/production-readiness-review/SKILL.md:26` — step 5 OS-feedback triage; states the tag is "mechanically blocked"; "No framework lessons discovered." valid.
- `templates/OS-FEEDBACK.md.template` — present (1462 B).
- `docs/feedback/OS-FEEDBACK-v3.8.md` — present (the dogfood; answers all three triage questions, routes one lesson → doctrine, one → lint, one → documented bound, none → skill).

## Adversarial findings

| Probe | What was attempted | Result | Assessment |
|-------|--------------------|--------|------------|
| A | Place `OS-FEEDBACK-P.md` at **repo root** (not under `docs/feedback/`) to satisfy the gate | Still blocked | Gate is correctly path-scoped via `git ls-tree … -- docs/feedback`; root file ignored. |
| A2 | Clean tree (no impl), feedback **only at root** → isolate the §14 path | §14 block, exit 1 | Confirms A: misplaced feedback never satisfies the release gate. |
| C | Decoy non-matching filename `docs/feedback/README.md` only | §14 block, exit 1 | Fallback regex `/OS-FEEDBACK-.*\.md$/i` is specific; a non-matching name in the dir does not count. |
| Tech-FP | `Supabase`/`BullMQ` in a clean-room doc | lint exit 0 | No tech false-positive — DENY list is project nouns only, not technologies. |
| BYPASS | `DELIVERY_OS_GATE_BYPASS=1` on a tag with zero feedback | exit 0, **loud stderr warning** | **Documented, intentional, logged** escape hatch (hook header lines 13-14, code 139-141). NOT a hidden bypass — it prints `⚠ DELIVERY_OS_GATE_BYPASS=1 … This bypass is logged. Remove before shipping.` Consistent with the §12 pattern. |

**No hidden bypass found.** The only way past the release gate is the documented, self-announcing
`DELIVERY_OS_GATE_BYPASS=1` env var. **No lint false-positive** (tech names pass) and **no false-negative**
(planted `@plos/test` caught at file:line; misplaced/decoy feedback files rejected).

### Notes / honest bounds (not defects)
- The gate proves the triage **exists and is named/located correctly**, not that it is *insightful* —
  this is the stated "Honest limit (same as §12)" in GOVERNANCE §14; the §11 promotion panel is what
  gives the answer teeth. Verified as designed, not a gap.
- The `anyFeedback` fallback (1d) intentionally allows ANY `docs/feedback/OS-FEEDBACK-*.md` to satisfy a
  tag, not only the tag-named one. This is a deliberate convenience fallback per the prompt; it slightly
  weakens per-release strictness (an old feedback file could satisfy a new tag) but is the documented
  designed behavior, not a defect.
- `check-os-drift` emits one advisory WARN (consumer stamped v3.4 vs latest tag v3.7) but exits 0 —
  pre-existing version-stamp advisory, unrelated to this slice.

## Verdict
**verified.** Release-tag gate blocks-without / allows-with the triage; "no lessons" (`None.`) still
passes; branch pushes are unaffected; the no-backflow lint blocks a planted project noun and passes
clean with no tech false-positive and no `case-studies/` false-positive; doctrine and all five
touchpoints exist; the §12 impl-VERIFY gate and the drift gate are non-regressed. The only escape is
the documented, loud `DELIVERY_OS_GATE_BYPASS=1`. **The trigger is a mechanism; the judgment is human —
as ratified.**
