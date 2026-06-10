---
slice: "apps-impl-surface — verify-gate protects monorepo apps/packages by default"
verify_status: verified
author: "orchestrator-build-session"
verifier: "independent-qa-subagent-apps-impl"
date: "2026-06-10"
independence_basis: "recorded-distinct-invocation"
---

# VERIFY — apps-impl-surface

Independent QA of the verify-gate fix that widened the implementation-surface matcher so a
monorepo's `apps/<name>/`, `packages/<name>/`, `services/<name>/` code no longer silently
bypasses the gate. The change is in `templates/hooks/verify-gate.mjs`:

```
IMPL_BASE = /^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\//
NONIMPL   = /(^|\/)(tests?|e2e|evals|docs|\.claude|node_modules|dist|build|\.next|out|coverage)\/|\.(test|spec)\.|\.md$/
```

The verifier did NOT author the fix and patched nothing. Tested against the framework hook as
inherited by (A) a freshly scaffolded project and (B) a hand-assembled PLOS-like monorepo, both
with `impl_extra` EMPTY (no per-project config).

## Path A — brand-new scaffold inherits the fix automatically

Scaffolded via `scripts/new-project.sh "App A" ""` (founder path, no patching). The scaffolded
`.claude/hooks/verify-gate.mjs` contains the widened matcher:

```
$ grep -n "apps|packages|services" .claude/hooks/verify-gate.mjs
32:const IMPL_BASE = /^(src|app|lib|api|migrations|db)\/|^(apps|packages|services)\/[^/]+\//;
$ cat .claude/.verify-config.json
{"impl_extra":[],"os_version":"v3.5"}     # no impl_extra entries
```

A1 — monorepo impl change, no impl_extra, MUST block:
```
$ mkdir -p apps/web/lib; echo "export const x=1" > apps/web/lib/score.ts
$ echo '{}' | node .claude/hooks/verify-gate.mjs stop
{"decision":"block","reason":"BLOCKED by Delivery OS verify-gate ... (apps/web/lib/score.ts) ..."}
```
→ BLOCKED, naming `apps/web/lib/score.ts`. Correct.

A2 — exempt file only (.ts reverted first), MUST NOT block:
```
$ rm -f apps/web/lib/score.ts; echo hi > apps/web/README.md
$ echo '{}' | node .claude/hooks/verify-gate.mjs stop
            # empty stdout = pass-through, no block
```
→ NO BLOCK. Correct.

**Path A verdict: PASS — a brand-new project gates monorepo `apps/<name>/` impl by default and exempts `.md`.**

## Path B — mature monorepo inherits the fix during adoption (no impl_extra)

Built `apps/web/lib`, `apps/worker/src`, `packages/core/src`, `pnpm-workspace.yaml`; copied ONLY
the framework hook + `{"impl_extra":[]}`; `git init -b main`. Tested the model-independent
`pre-push` backstop on the committed push RANGE.

B1 — impl change in push range, no impl_extra, MUST exit 1 (the exact PLOS gap):
```
$ echo x > apps/web/lib/a.ts; git add -A; git commit -q -m impl
$ printf "refs/heads/main %s refs/heads/main %s\n" "$(git rev-parse HEAD)" "$(git rev-parse HEAD~1)" \
    | node .claude/hooks/verify-gate.mjs pre-push
BLOCKED by Delivery OS verify-gate ... (apps/web/lib/a.ts) ...
EXIT=1
```

B2 — add verified, independent `docs/verify/VERIFY-x.md` (verify_status: verified, author A,
verifier B), commit, re-feed range, MUST exit 0:
```
$ git add -A; git commit -q -m "verify x"
$ printf "refs/heads/main %s refs/heads/main %s\n" "$(git rev-parse HEAD)" "$(git rev-parse HEAD~2)" \
    | node .claude/hooks/verify-gate.mjs pre-push
EXIT=0
```

B3 — exempt-only change (`apps/web/.next/cache.js`, `apps/web/__tests__/x.test.ts`, `docs/y.md`),
MUST not block:
```
EXIT=0
```

B4/B5 — other monorepo impl trees MUST be gated:
```
packages/core/src/index.ts  → EXIT 1 (blocked)
services/api/server.ts      → EXIT 1 (blocked)
```

B6 — vendored/build trees MUST be exempt:
```
node_modules/pkg/index.js + dist/bundle.js  → EXIT 0 (no block)
```

Over-reach check — top-level meta files MUST NOT block:
```
README.md + package.json     → EXIT 0
vite.config.ts (repo root)   → EXIT 0
```

**Path B verdict: PASS — a mature monorepo gates `apps/`/`packages/`/`services/` impl by default with NO impl_extra; exemptions and over-reach boundaries correct.**

## Adversarial findings

Classification probe over 33 paths (matcher replicated, `impl_extra` empty) — 0 mismatches. Old vs
new matcher diff — 0 regressions; the fix is purely additive (everything the root-anchored matcher
gated, the new one still gates).

Paths that STILL bypass by default (honest disclosure) — all are by-design `impl_extra` territory,
NOT the gap this fix claimed to close:
- `supabase/functions/edge/index.ts` — the legacy Rumah Admin layout. Lives outside src/apps/packages/services,
  so it bypasses unless the consumer adds `impl_extra:["supabase/functions/"]`. The code comment explicitly
  documents this escape hatch ("implementation lives elsewhere ... extends the surface via impl_extra").
- `server/`, `functions/`, Nx-style `libs/` (plural), `modules/`, `backend/`, `cmd/` — same category: alternate
  impl roots, the consumer's responsibility via `impl_extra`. The fix targeted the dominant Next.js/Turborepo/
  pnpm-workspace `apps/`+`packages/` convention, which is now covered.
- In-tree NONIMPL-segment collisions: `apps/web/src/out/gen.ts`, `apps/web/src/build/x.ts` (a real impl dir
  literally named `out`/`build`) are exempted by NONIMPL. This is PRE-EXISTING behavior (the old matcher
  exempted `src/out/x.ts` identically) — not introduced by this change. Low likelihood; noted, not blocking.

No over-reach found: top-level `README.md`, `package.json`, root `vite.config.ts`, and `apps/web/README.md`
all pass through. `apps/`-without-a-`<name>/`-subdir (`apps/page.tsx`) is correctly NOT gated (matcher
requires `apps/<name>/`).

## Verdict

- Path A (fresh scaffold): PASS — inherits widened matcher; gates `apps/<name>/` impl by default, exempts docs.
- Path B (mature monorepo): PASS — gates apps/packages/services impl by default with empty impl_extra; exemptions and over-reach boundaries correct.

The fix genuinely closes the silent under-protection for the targeted monorepo conventions, is purely
additive (no regression), and both inheritance paths work automatically. Residual bypasses are the
documented `impl_extra` extension surface, not the gap under test. **verify_status: verified.**
