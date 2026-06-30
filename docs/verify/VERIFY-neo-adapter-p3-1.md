# VERIFY — neo-adapter-p3-1

> slice: **neo-adapter-p3-1 — infrastructure/execution-node Neo ExecutionProviderPort + Health adapter (EI keystone)**
> author: **Builder**
> verifier: **independent QA (author≠verifier)** — 2026-06-30
> independence_basis: **recorded-distinct-invocation** (verifier ran every probe + every grep directly against the working tree; did not modify the implementation)
> machine_probe: `node scripts/delete-test.mjs`
> verify_status: **verified**

---

## Verdict

**PASS / verified.** The Neo Execution-Infra adapter is the keystone proof of the inversion, and it holds three
ways: (1) **deleting the whole `infrastructure/` subsystem leaves Core building** — `tsc -p tsconfig.core.json`
→ 0 errors and all three Core self-tests green with the adapter gone (the load-bearing proof, and the
`execution-infrastructure` arm is now **LIVE, not SKIP**); (2) **the boundary is inward-only** — every real import
in the subsystem is `adapter → contract` or `adapter → sibling-adapter`; there is **no adapter → Core-internal
edge anywhere** (no static import, no dynamic import, no re-export, no require), and **Core imports nothing from
`infrastructure/`**; (3) the adapter **actually implements the contracts** — the self-test passes **28/28 with no
real process** spawned (stub spawner, injected clock, one-shot tick). The composition-root claim is **honest**:
`worker-daemon.ts` does **not** import `createGovernanceRuntime` or any Core organ — it depends on an injected
`RuntimeTick` seam, and the only references to `createGovernanceRuntime`/`<core>/runtime.js` in the subsystem are
**comment prose** documenting the unclassified launchd `WORKER_ENTRY`. No regression: the existing
`governance-postgres-adapter` Delete-Test arm and the boundary gate stay green, and both gates are **proven to
have teeth** (oracle + self-test).

Note on count: the brief said "expect 27/27"; the self-test actually has **28** checks and all 28 pass — a benign
over-count, not a defect.

---

## Criterion 1 — ★ The keystone: `rm -rf infrastructure/execution-node/` ⇒ Core builds — PASS

`node scripts/delete-test.mjs --subsystem execution-infrastructure` — the arm is **LIVE** (the live tree now has
`infrastructure/`, so it no longer SKIP-warns) and **PASSES** verbatim:

```
[execution-infrastructure]
  removed in worktree: infrastructure
  PASS  (a) Core builds — tsc --noEmit -p tsconfig.core.json -> 0 errors
  PASS  (b) self-test templates/governance-engine/scripts/self-test.ts
  PASS  (b) self-test templates/governance-engine/golden-master.ts
  PASS  (b) self-test templates/governance-engine/scripts/governance-runtime-self-test.ts
  => PASS
delete-test: CLEAN — the boundary held by construction for every present subsystem (exit 0)   EXIT=0
```

The oracle is the REAL `templates/governance-engine` Core (not a vendored adapter-free copy) — `tsc --noEmit`
plus three live Core self-tests run in a throwaway copy with `infrastructure/` deleted. The live tree is never
mutated (the `.delete-test/` worktree is pruned afterward — confirmed absent).

**Does Core build without the adapter? YES** — 0 tsc errors and all Core self-tests green with the entire
subsystem removed.

## Criterion 2 — Inward-only boundary (direction checked both ways) — PASS

`node scripts/arch-boundary-guard.mjs` → **CLEAN** (137 files: contracts 9, core 33, adapters 11, unclassified 84;
exit 0). The new files classify as **adapters** (`architecture.config.json` pins `infrastructure` → `adapters`
layer, `mayImport: [contracts, adapters]`).

Independent grep, **adapter → out** (every real import specifier in `infrastructure/`):

- `execution-provider-port.js`, `health-contract.js` — the **CONTRACTS** (`adapter → contract`, legal).
- `worker-daemon.js`, `neo-execution-provider.js`, `neo-health.js` — **sibling adapters** in the same subsystem (legal).
- `node:child_process` — node builtin, in the adapter layer where SDK/host detail is legal.
- The only Core-named specifiers (`<core>/runtime.js`, `<core>/adapters/postgres/index.js`) are **comment-only**
  (both on `//`-prefixed lines, with a `<core>` placeholder that resolves to no file) — documentation of the
  composition root, not code. The boundary guard strips comments before extraction, so it never sees them.

Independent grep, **Core → adapter** (reverse direction): the only `templates/` mention of `execution-node`/
`infrastructure` is a **doc comment** in `templates/governance-engine/ports.ts:311` ("…adapters may import them
(`adapter -> contract`)") — **not an import**. Repo-wide, **no file outside the subsystem imports
`infrastructure/execution-node`.**

**Is there any adapter → Core-internal edge? NO** — neither a static import, a dynamic `import()`, a `require`,
nor a re-export reaches a Core internal (organs / state-machine / runtime / reconciler / goal-contract).

## Criterion 3 — The composition-root claim is honest, not a dodge — PASS

The "unclassified composition root" is genuinely just documentation, not a hidden edge. The `<core>` wiring
example in `worker-daemon.ts` (lines 19–37) is entirely inside a comment block describing the launchd
`WORKER_ENTRY`; `index.ts` deliberately does **not** re-export it. Confirmed there is **no dynamic import**, **no
string-concatenated specifier**, and **no barrel re-export** that smuggles a Core symbol into the subsystem — the
adapter reaches Core **only** through the two published contracts (`execution-provider-port.ts`,
`health-contract.ts`), importing `isReady` as the one shared value (one source of truth, never re-derived).

**Daemon-import check (the named blocking condition):** `worker-daemon.ts` imports **only** type symbols from
`health-contract.js` (the contract). It does **NOT** `import { createGovernanceRuntime }` or any Core organ — the
runtime is injected as the minimal `RuntimeTick` interface. The inversion is intact.

## Criterion 4 — The adapter actually implements the contracts (no real process) — PASS

`tsx infrastructure/execution-node/adapters/neo/self-test.ts` → **28/28 PASS, exit 0**:

- **`execute`** returns an `ExecutionOutcome` with `evidenceRef` = `bus://evidence/neo-node-1/…` via the **STUB
  spawner** (invoked exactly once; budget timeout honored); a non-zero exit maps to `ok:false` and a real check
  failure is non-retryable (honest failure).
- **`canAccept`** accepts an eligible request, rejects unpublished resource_class / capability, and the
  **`data_class` gate fail-closes** (an `external` node refuses PII; a `trusted` node accepts it).
- **Health fold** produces `ok` / `degraded` (non-critical) / `down` (critical, fail-closed) with correct `isReady`
  (true for ok+degraded, false for down) and an injected-clock `checkedAt`.
- **Daemon** ticks once via injected clock + stub `RuntimeTick` — monotonic `tickSeq` 1→2, heartbeat emitted onto
  the sink seam, **no scheduler/loop started**.

**No real `child_process` spawned** — the spawner is injectable and the test injects a stub that records the spec
and returns a canned result; `defaultSpawner` (the real `node:child_process` path) is lazily imported and never
loaded under test.

## Criterion 5 — tsc + no regression — PASS

- **Adapter typechecks against the contracts:** full `tsc --noEmit` over `infrastructure/execution-node/**/*.ts` +
  the two contracts (finance-os-demo toolchain, Bundler resolution, `strict`, `verbatimModuleSyntax`) → **0 errors**.
- **No regression:** the full `node scripts/delete-test.mjs` keeps the pre-existing
  `governance-postgres-adapter` arm **PASS** and the two unbuilt arms SKIP; `node scripts/arch-boundary-guard.mjs`
  stays **CLEAN**. The change is purely additive — Core was untouched (the subsystem is a new untracked folder; no
  existing Core file was modified).

---

## Gate teeth (the verification is not vacuous)

- `node scripts/arch-boundary-guard.mjs --self-test` → **10/10** (planted core→adapter, adapter→core-internal,
  infra-SDK-in-core, and execFileSync-of-relative-tool offenders all caught; clean controls silent).
- `node scripts/delete-test.mjs --prove-oracle` → **ORACLE VALID** — a planted Core→adapter import makes BOTH the
  `tsc` build (TS2307) AND the runtime self-test (ERR_MODULE_NOT_FOUND) go red, proving the Delete-Test genuinely
  depends on the not-deleted Core (the WAVE1-CHALLENGE Attack-3c fix holds).

## Hygiene

No droppings left: `.delete-test/` pruned, the temp adapter-check tsconfig removed. `infrastructure/` is a new
untracked subsystem; no tracked file was mutated by verification.
