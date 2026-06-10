---
slice: "enforcement-vs-memory — what fires without remembering vs what relies on discipline"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-enforcement"
date: "2026-06-10"
independence_basis: "recorded-distinct-invocation"
---

# Enforcement vs Memory — final founder-level QA pass (Delivery OS v3.4)

**Single question:** for a brand-new project scaffolded from v3.4, which AI-OS lessons are
MECHANICALLY ENFORCED (fire without anyone remembering) and which still RELY ON A HUMAN
REMEMBERING?

**Method.** Scaffolded a disposable project with
`bash scripts/new-project.sh "Final Check" ""` (clean exit 0; os_version stamped
`v3.4-1-g847b4dc`). No post-scaffold patching. For each item I ran a test that distinguishes
mechanical enforcement from discipline. Classification: **MECHANICAL** (fires without consent /
fails closed), **PARTIAL** (mechanical in one direction only, or needs external config), or
**RELIES-ON-MEMORY** (present but compliance is a human/Claude choice).

`verify_status: verified` — the classification is complete and honest. One real limitation was
found (the pre-push backstop inspects the working tree, not the push commit range), but it does
NOT silently void anything *claimed* mechanical: the in-Claude commit gate still fires, and the
gap is in a backstop layer whose strength was overstated, not falsified. It is recorded below as
an undocumented limitation that should be fixed or documented; it is reported, not hidden.

## Per-item results

| Item | Class | Exact test + result | Mechanism / gap |
|---|---|---|---|
| **Verify-gate (in-Claude, stop/commit)** | **MECHANICAL** | `mkdir src; echo x>src/a.ts`; `echo '{}' \| verify-gate.mjs stop` → `{"decision":"block",…}`. `{command:"git commit"}` pre-commit with uncommitted impl → `permissionDecision:"deny"`. Wired in `.claude/settings.json` PreToolUse(Bash)+Stop+PostToolUse. | Fires without orchestrator consent; fails closed (errors → deny on commit/stop). Guards the **working tree** only (`git status --porcelain`). |
| **Verify-gate (committed pre-push backstop)** | **PARTIAL** | `git config core.hooksPath` → `.githooks` (real, travels in repo). With **uncommitted** impl + no VERIFY, `git push` → "✗ push blocked … verify-gate" (push fails). With impl **committed** + clean tree, the SAME unverified change `git push` → **succeeds** (new branch pushed). pre-push feeds a hardcoded `{command:"git push"}` and the gate inspects `git status` (working tree), never the push commit range. | Mechanical for working-tree dirt; **blind to committed-but-unverified history** when the tree is clean. See "Real limitation" below. |
| **Author ≠ Verifier (gate side)** | **MECHANICAL** | VERIFY artifact with `author==verifier` (both "same-person"), fresh, `verified` → still `deny`. With `author!=verifier`, fresh, `verified` → allowed (empty output). `verify_status: failed` → `deny`. | Independence is a structural pass condition in the gate. Honest limit (documented §12): it checks the fields *differ*, cannot prove a single agent didn't fill both. |
| **CODEOWNERS (write-binding side)** | **PARTIAL** | `CODEOWNERS` present, one owner per path, verifier handles (`@qa-test`) scoped off code. drift-lint FAILS if a CODEOWNERS handle has no `.claude/agents/<h>.md`. But CODEOWNERS enforces nothing on merge without **GitHub branch protection**, which the scaffolder cannot enable. | Mechanical only once the founder enables branch protection on a real remote. |
| **CLAUDE.md kernel — dispatch-lie (over-advertise)** | **MECHANICAL** | Injected phantom row `\| phantomskill \|` into §5; `check-os-drift.mjs` → `FAIL … phantom dispatch`, **exit 1**. Same for `rm -rf .claude/skills/grill-me` while router still lists it → exit 1. pre-push runs drift-lint as gate-2. | Router cannot advertise a skill/agent absent from disk; build/push blocked. |
| **CLAUDE.md kernel — under-advertise (real skill, not rendered)** | **PARTIAL** | Added real `.claude/skills/newskill/SKILL.md`, did NOT render. `check-os-drift.mjs` → **OK, exit 0** (does not catch it). Only `render-kernel.mjs` adds it to §5 (verified: count 7→8). | drift-lint is **one-directional**. A genuinely-installed-but-unadvertised skill is invisible until someone *remembers* to run render-kernel. |
| **Consumes vs reimplements (vendored doctrine)** | **MECHANICAL (present)** | `delivery-os/core/GOVERNANCE.md`, `DEFINITION-OF-DONE.md`, `SEVERITY-AND-ESCALATION.md`, `discovery/*` vendored into the project. os_version stamped in `.claude/.verify-state.json` + `.verify-config.json` (`v3.4-1-g847b4dc`). | Doctrine is consumed/cached, not reimplemented; version boundary recorded at scaffold. |
| **Base + overlay survives upgrade** | **PARTIAL** | Added `.claude/overlay/agents/qa-test.md`; os-sync → overlay marker present. Appended to `.claude/base/agents/qa-test.md`; re-ran os-sync → **both** base change and overlay survive. FAILURE path: hand-overwrote rendered `.claude/agents/qa-test.md` → overlay **lost**. | Survives **iff** the upgrade goes through os-sync. `.claude/agents/` are rendered artifacts; a naive hand-edit/overwrite silently loses specialization. Relies on following the documented bump process. |
| **Drift detection (removed skill)** | **MECHANICAL** | `rm -rf .claude/skills/grill-me`; `check-os-drift.mjs` → exit 1; pre-push gate-2 runs it. | Fails closed on removed-but-advertised skill. |
| **Version boundary — stamp** | **MECHANICAL** | `.verify-state.json.os_version = v3.4-1-g847b4dc` — a **real OS tag**, not `untagged`. | Real version recorded at scaffold via `.verify-config.json`. |
| **Version boundary — "behind" detection** | **RELIES-ON-MEMORY / inert** | drift-lint WARN path: `git describe --tags --abbrev=0` run in the **consumer** repo, which has no OS tags → `latest='?'` → the "may be BEHIND" warning **can never fire** in a scaffolded project (confirmed: stamp forced to `v3.0`, still OK, no warn). | Behind-detection is effectively inert in consumers (works only inside the OS repo). Upgrading on time relies on a human checking the OS. |
| **Wiki frontmatter contract** | **RELIES-ON-MEMORY** | `wiki/FRONTMATTER-CONTRACT.md` present. `grep -rl wiki .claude/tools .claude/hooks .githooks` → **no validator**. | Pure human discipline; nothing checks a wiki page obeys the contract. |
| **Skills present / fired** | **By design** | 7 SKILL.md present (discovery-interview, ecosystem-alignment-review, grill-me, migration-assessment, principle-11-review, production-readiness-review, verify-gate). Only verify-gate is hook-fired (settings.json). | The other 6 are model-discretion / description-match BY DESIGN — advisory, not a defect. |
| **Dogfooding** | **MECHANICAL** | OS repo `delivery-os/.claude/` exists with settings.json + hooks + tools; `git config core.hooksPath` in OS → `.githooks` with pre-push. OS `.verify-config.json` extends impl surface (`scripts/`, `templates/hooks/…`). New project runs its own gate (tested above). | The OS gates itself with the same machinery it ships. |

## Real limitation found (reported, not hidden)

**The committed pre-push backstop is blind to clean-tree pushes of unverified commits.**
The `.githooks/pre-push` hook is a genuine, repo-travelling git hook (`core.hooksPath=.githooks`),
but it does not consume the ref range git hands a pre-push hook on stdin and does not diff the
push range (`@{push}..HEAD`). It feeds verify-gate a hardcoded `{command:"git push"}`, and the
gate's change detector is `git status --porcelain` — the **working tree**. Demonstrated: an
implementation change committed (bare `git commit`, which is NOT gated outside Claude — only
pre-push is committed, there is no committed pre-commit hook) and then `git push`ed with a clean
tree **pushed successfully with no fresh VERIFY**. This behavior is **not acknowledged** anywhere
in `core/` or `docs/` (the documented "Honest limit" covers only truthfulness/independence).

**Severity assessment:** does NOT block baseline. Rationale: (1) within Claude, `git commit` is
itself gated, so the normal authoring path cannot easily produce the unverified commit in the
first place; (2) the documented model-independent second layer is "CODEOWNERS on a real PR with a
second reviewer," which the committed-clean-tree push does not bypass; (3) nothing *claimed*
mechanical is silently falsified — the gate does exactly what its code says, the OVERSTATEMENT is
in the prose ("backstops it for *any* git client") implying push-range coverage it does not have.
**Recommended fix:** make pre-push read its stdin ref range (or `git diff --name-only @{push}..HEAD
/ origin/<branch>..HEAD`) and feed that file list to the gate, so committed-but-unverified impl in
the push range is caught; OR explicitly document that the gate guards the working tree only and
rely on branch protection + CODEOWNERS for committed history. Until then, classify the pre-push
backstop as **PARTIAL**, not full.

## The two explicit lists

### Mechanically enforced (cannot be silently lost — fires without anyone remembering)

1. **Verify-gate in-Claude** (stop + `git commit`/`git push` deny on changed working-tree impl
   with no fresh/passing/independent VERIFY) — fires via settings.json without consent, fails closed.
2. **Author ≠ Verifier as a gate pass-condition** — `author==verifier` blocks even when fresh/verified.
3. **verify_status discipline** — only `verified` passes; `failed`/missing blocks.
4. **Freshness** — a VERIFY older than the changed impl does not count (stale → blocked).
5. **Dispatch-lie / phantom-dispatch drift** — router §5 or CODEOWNERS advertising a skill/agent
   not on disk → drift-lint exit 1; pre-push runs it as gate-2.
6. **Removed-skill drift** — deleting an advertised skill fails the build (exit 1).
7. **os_version stamp** — a real OS tag recorded at scaffold.
8. **Vendored doctrine** — GOVERNANCE/DoD/severity/discovery consumed, not reimplemented.
9. **Dogfooding** — the OS repo runs the same gate + pre-push on itself.
10. **pre-push for *uncommitted* working-tree impl** — genuinely blocks bare-git pushes when the
    tree is dirty (the partial half of the backstop that IS mechanical).

### Relies on a human / process remembering

1. **pre-push for committed-clean-tree pushes** — **REAL undocumented limitation** (see above).
   The backstop inspects the working tree, not the push commit range. *Fix or document; do not
   leave the "any git client" claim standing.* Does not block baseline (mitigated by in-Claude
   commit gate + PR/branch-protection layer), but it is a genuine gap, not a judgment call.
2. **Kernel under-advertising (real skill not rendered into §5)** — *documented-process item*:
   only render-kernel fixes it; drift-lint is one-directional by construction. Relies on running
   render-kernel after adding a skill.
3. **CODEOWNERS enforcement** — *documented limitation*: inert until the founder enables GitHub
   branch protection on a real remote. By-design external dependency.
4. **Base+overlay survival** — *documented-process item*: survives only if upgrades go through
   os-sync; a naive hand-overwrite of `.claude/agents/*` silently loses the overlay.
5. **"Behind" version detection** — *real-but-minor gap*: the WARN can never fire in a consumer
   repo (no OS tags → `latest='?'`). Upgrading on time relies on human vigilance. Cosmetic by the
   OS's own framing, but worth noting it is effectively inert where it matters most (consumers).
6. **Wiki frontmatter contract** — *by-design human discipline*: present as a contract, no validator.
7. **6 of 7 skills (discovery-interview, grill-me, migration-assessment, principle-11-review,
   production-readiness-review, ecosystem-alignment-review)** — *by-design judgment items*:
   model-discretion / description-match, not hook-fired. Not a defect.

## Verdict

The kernel's core promise — "a slice cannot be marked done, committed, or have its router lie,
without a fresh independent verification existing" — is **mechanically enforced in the in-Claude
authoring path and fails closed**. The genuinely model-independent layer (committed pre-push) is
**weaker than its prose claims**: it catches uncommitted working-tree impl but not committed
history on a clean-tree push. That is the one real, undocumented limitation. It does not falsify
any mechanical claim and is mitigated by the in-Claude commit gate and the PR/branch-protection
path, so it does **not** block baseline status, but it should be fixed (read the push range) or
the "any git client" wording corrected. Everything else classifies cleanly into mechanical vs
by-design-discipline, with no silent-loss defect in anything claimed enforced.
