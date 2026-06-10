---
slice: "framework-update — operationalize surviving AI-OS findings into Delivery OS"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-framework-update"
date: "2026-06-10"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — Slice framework-update: operationalize surviving AI-OS findings into Delivery OS

## Verdict
**VERIFIED.** Claims 1–7 all pass. The AI-OS findings are operationalized into actual
framework files (not paper): consumer-installable tools, a self-contained base+overlay sync
that survives a version bump, a scaffolder that wires every mechanism with fail-closed asserts,
the paper findings landed in `core/GOVERNANCE.md` / `templates/wiki/FRONTMATTER-CONTRACT.md` /
`templates/CLAUDE.md.template`, a drift-enforcing `pre-push`, green dogfooding with
canonical==installed parity, and a verify-gate that correctly blocks the dirty impl surface.
No internal inconsistency found (no phantom installs, no canonical≠installed drift, no `>`/`<…>`
placeholder rows in the framework's rendered §5, no §5 skill missing from disk).

This artifact attests the mechanisms EXIST, are well-formed, and RUN green — it does not (and
under §12 cannot) prove every design intention is fully captured; see Assumptions.

## Execution evidence (command · exit · output excerpt)

| # | Command | Exit | Output excerpt |
|---|---|---|---|
| 1 | `node --check templates/tools/{os-sync,check-os-drift,render-kernel}.mjs` | 0,0,0 | all three `OK exit=0` |
| 2 | bump sim: append sentinel to `.claude/base/agents/qa-test.md` → `node .claude/tools/os-sync.mjs` | 0 | `os-sync: 4 base + 1 overlay`; installed qa-test had BUMP-SENTINEL **and** FRAMEWORK-LOCAL (both count=1) |
| 2b | restore (remove sentinel) + re-sync | 0 | installed sentinel count=0, FRAMEWORK-LOCAL count=1 — overlay survives, base clean |
| 3 | read `scripts/new-project.sh` | n/a | sub-points (a)–(f) all present (lines quoted below) |
| 4a | `grep "Kernel mechanism vs governance policy" core/GOVERNANCE.md` | 0 | `## 13. Kernel mechanism vs governance policy (the hard line)` (line 62) |
| 4b | `grep -E "kind:\|as_of\|locked\|frozen" templates/wiki/FRONTMATTER-CONTRACT.md` | 0 | `kind:` (l35), `as_of` (l37), `locked`/`frozen` in `stability:` enum + rules (l40,49) |
| 4c | `grep -E "DERIVED\|render-kernel" templates/CLAUDE.md.template` | 0 | KERNEL RULE comment names §5/§6/§9 as STATE + `render-kernel.mjs` (l27-31); §5 header "(DERIVED … run render-kernel.mjs)" |
| 5 | read `templates/githooks/pre-push` | n/a | Gate 2 runs `check-os-drift.mjs`; `if ! node … >&2; then … exit 1` (l16-20) |
| 6a | `node .claude/tools/os-sync.mjs` | 0 | `os-sync: 4 base + 1 overlay → .claude/agents/ (os_version=v3.2)` |
| 6b | `node .claude/tools/render-kernel.mjs` | 0 | `§5 rebuilt from 7 installed skills; §9 derived line refreshed` |
| 6c | `node .claude/tools/check-os-drift.mjs` | 0 | `drift-lint: OK (7 skills checked, 0 warning(s)) — router matches disk.` |
| 6d | `diff templates/tools/{os-sync,check-os-drift,render-kernel}.mjs .claude/tools/…` | 0,0,0 | all three IDENTICAL (canonical==installed) |
| 6e | `diff templates/hooks/verify-gate.mjs .claude/hooks/verify-gate.mjs` | 0 | IDENTICAL |
| 7 | `echo '{}' \| node .claude/hooks/verify-gate.mjs stop` (dirty tree, pre-artifact) | 0 | `{"decision":"block",…}` listing changed impl (scripts/new-project.sh, pre-push, the 3 moved tools) |

### Claim-3 quoted lines (`scripts/new-project.sh`)
- (a) base agents: `for a in software-engineer qa-test reviewer-critic lead-architect documentation; do cp "$DOS/agents/$a.md" ".claude/base/agents/$a.md"` (l28-30)
- (b) tools: `cp "$DOS/templates/tools/os-sync.mjs" .claude/tools/os-sync.mjs` (+ check-os-drift, render-kernel) (l91-93)
- (c) config: `printf '{"impl_extra":[]}' > .claude/.verify-config.json` (l95)
- (d) overlay: `mkdir -p .claude/base/agents .claude/overlay/agents …` (l25)
- (e) run: `node .claude/tools/os-sync.mjs` / `render-kernel.mjs` / `check-os-drift.mjs` (l99-101)
- (f) fail-closed: `for f in … .claude/tools/os-sync.mjs … check-os-drift.mjs … render-kernel.mjs .claude/.verify-config.json; do [ -f "$f" ] || { echo "FATAL …"; exit 1; }; done` (l109-113) and `[ -d .claude/base/agents ] || { echo "FATAL: base+overlay not wired…"; exit 1; }` (l114)

## Per-finding operationalization

| Finding | Framework file | Operationalized? |
|---|---|---|
| Tools are consumer-installable (3 mjs) | `templates/tools/{os-sync,check-os-drift,render-kernel}.mjs` | yes — exist, `node --check` clean |
| Self-contained base+overlay sync surviving a bump | `templates/tools/os-sync.mjs` (base→`.claude/base/agents`, overlay→`.claude/overlay/agents`, out→`.claude/agents`) | yes — bump sim kept BOTH base + overlay |
| Scaffolder wires it for consumers | `scripts/new-project.sh` (l25-30, 91-95, 99-101, 109-114) | yes — all 6 sub-points + fail-closed asserts |
| Kernel-mechanism-vs-policy hard line | `core/GOVERNANCE.md` §13 (l62) | yes |
| Frontmatter contract `kind`/`as_of`/`locked`/`frozen` | `templates/wiki/FRONTMATTER-CONTRACT.md` (l35,37,40,48-49) | yes |
| §5/§6/§9 are DERIVED state | `templates/CLAUDE.md.template` KERNEL RULE (l27-31) | yes |
| pre-push enforces drift | `templates/githooks/pre-push` Gate 2 (l16-20) | yes — non-zero exit on drift |
| Framework dogfoods green + canonical==installed | `.claude/tools/*` + `.claude/hooks/verify-gate.mjs` | yes — 3 tools green, drift 0, 4 diffs IDENTICAL |
| Verify-gate fires on framework impl surface | `.claude/hooks/verify-gate.mjs` + `.claude/.verify-config.json` (impl_extra adds `templates/tools/`) | yes — blocks dirty tree |

## Adversarial sweep (no inconsistency found)
- Every tool/skill/agent the scaffolder copies has a source under `templates/tools/`, `skills/<n>/SKILL.md`, `agents/<n>.md` — checked, all 3 tools + 7 skills + 5 lean agents present. No phantom install.
- Fail-closed assert list (l109-114) references only files the scaffolder actually creates. No missing-file assert.
- `diff` canonical vs installed: identical for all 3 tools + verify-gate hook. No canonical≠installed drift.
- Framework's rendered `CLAUDE.md` §5 has 7 real rows, no `>`/`<stable>`/`<…>` placeholder rows; all 7 match `.claude/skills/` on disk. `drift-lint` exit 0 confirms router==disk for §5/§6.
- `.verify-config.json` change is correct and load-bearing: it adds `templates/tools/` to `impl_extra` so the gate now protects the new home of the moved tools (verified the gate flags exactly those files).

## Classified assumptions
- **Verified by execution:** claims 1, 2, 5(read+logic), 6, 7; scaffolder source-file existence; canonical==installed; drift==0; no placeholders.
- **Verified by inspection (read, not run):** claim 3 (scaffolder not end-to-end executed in a clean temp repo — it does `git init`/`commit`; reading + per-line existence checks substitute), claim 4 (presence + content of paper findings).
- **Honest limit (§12):** this gate/artifact attests the mechanisms EXIST and RUN; it cannot prove each finding's full design intent is captured, nor that a clean-room `new-project.sh` run produces a flawless scaffold (not executed in isolation).
- **Environment:** os_version stamped `v3.2`; `git status --porcelain` is the change detector (tree is dirty as expected).

## Bugs filed author-ward
None blocking. One **observation** (non-blocking, author-discretion): `templates/CLAUDE.md.template` §5 ships literal `<stable>`/`<experimental>` placeholder rows in its skills table — correct for a *pre-render template*, since `render-kernel.mjs` rewrites them in the consumer's real `CLAUDE.md` (and the framework's own rendered §5 has no placeholders). If a consumer never runs `render-kernel.mjs`, those placeholders persist — but the scaffolder runs render at l100 and `drift-lint` would catch advertised-but-absent skills, so the risk is contained. No fix required.
