# VERIFY — execution-contracts-p2-1

> slice: **execution-contracts-p2-1 — ExecutionProviderPort + Health-Emission contracts (Core-owned, host-agnostic, additive)**
> author: **Builder**
> verifier: **independent QA (author≠verifier)** — 2026-06-30
> independence_basis: **recorded-distinct-invocation** (verifier ran every probe directly against the working tree; did not modify implementation)
> machine_probe: `node scripts/arch-boundary-guard.mjs`
> verify_status: **verified**

---

## Verdict

**PASS / verified.** The two new Core-owned Execution-Infra contracts leak **no host concept** into Core, are **purely additive** (every verified organ self-test holds at its documented baseline count, no organ references the new contracts), pass the **boundary gate + Delete-Test (oracle proven valid)**, and the `architecture.config.json` reclassification into the `contracts` layer is **honest** (both files import only Core types / nothing — neither imports an adapter or infra SDK). The one failing test (`postgres-faithfulness-self-test`) is confirmed **pre-existing + environmental** (missing `postgres` driver in the demo toolchain, adapter-layer, not in the Delete-Test oracle set, unrelated to P2.1).

Implements the **WAVE1-CHALLENGE Attack-4 must-fix** verbatim: "Make `resource_class` an opaque string … do not enumerate `"macos"/"gpu"` in a Core type." On disk `resource_class: string` (opaque) — not a closed host/hardware union.

---

## Criterion 1 — Host-agnostic (the load-bearing property) — PASS

Case-insensitive grep of BOTH new files for `macos|gpu|neo|docker|tailscale|launchd|colima|runner|socket|container`:

- `execution-provider-port.ts`: 6 hits — lines 12, 47, 64, 75, 87, 97. **ALL in comment prose, every one a negation** ("NO field names a host, a socket, a container …", "NEVER an infra handle (no host/socket/token)", "it OUTLIVES an ephemeral runner; evidence is NOT a CI artifact").
- `health-contract.ts`: 1 hit — line 25, comment ("…an address; no field names a host/socket/monitor").
- **Grep excluding comment lines → `NO NON-COMMENT MATCHES`.** Zero host tokens appear in any type, field name, or string-literal value.

Type read confirms opacity:
- `resource_class: string` — **opaque string, NOT a closed union** of OS/hardware nouns. (This is the Attack-4 fix.)
- `capabilities?: string[]`, `labels?: string[]` — opaque capability strings, matched structurally by the selector.
- `ExecutionKind = "build" | "verify" | "deploy" | "supervise" | "migrate" | "probe"` — **process-shaped, not host-shaped** (none names a machine).
- `TrustDomain = "trusted" | "contractual" | "external"` (abstract posture); `lane = "short" | "long"`; `isolation = "shared" | "dedicated"` (abstract work classes) — none enumerates a host/hardware/network.

**Can the Runtime tell which host it runs on? NO.** Every placement field is an opaque string Core never enumerates; node adapters publish their own opaque labels and the selector matches structurally. Core is unable to distinguish Neo vs Linux vs cloud — the string is the entire coupling.

## Criterion 2 — Additive, ZERO Runtime-behavior change — PASS

No organ or script file references the new contracts (grep for `ExecutionProviderPort|PlacementPort|ExecutionRequest|HeartbeatRecord|PlatformHealthReport|isReady|execution-provider-port|health-contract` across `templates/governance-engine/**`, excluding the two new files + the `ports.ts`/`index.ts` barrels) → **NONE**. The change is the two new files + re-export lines in `ports.ts` and `index.ts` only; the organs reach nothing new.

Organ self-tests — **IDENTICAL pass counts to the documented baseline (no changed verdict):**

| self-test | baseline | observed | diff |
|---|---|---|---|
| goal-supervisor-self-test | 39/39 | **39/39** | unchanged |
| po-autoloop-self-test | 42/42 | **42/42** | unchanged |
| governance-runtime-self-test | 10/10 | **10/10** | unchanged |
| reconciler | 25/25 | **25/25** | unchanged |
| sprint-engine | 45/45 | **45/45** | unchanged |
| golden-master | PINNED | **PINNED (exit 0)** | unchanged |
| self-test.ts | all-hold | **ALL PROOFS HOLD (exit 0)** | unchanged |

**Did any organ behavior change? NO** — every self-test count is byte-for-byte the baseline. (Note: the whole `templates/governance-engine/` tree is git-untracked, so a HEAD byte-diff is not available; the proof of unchanged behavior is the identical self-test counts + the zero-reference grep + the additive-only edit surface.)

## Criterion 3 — Contracts pass the gate + Delete Test — PASS

- `node scripts/arch-boundary-guard.mjs` → **CLEAN — no boundary violations** (132 files: contracts 9, adapters 6, core 33). exit 0.
- `node scripts/arch-boundary-guard.mjs --self-test` → **10/10 passed.** exit 0.
- `node scripts/delete-test.mjs` → **CLEAN** (governance-postgres-adapter subsystem PASS; execution-infra/slack/monitoring SKIP-armed). exit 0.
- `node scripts/delete-test.mjs --prove-oracle` → **ORACLE VALID** — the planted Core→adapter leak FAILS both tsc (TS2307) and the runtime self-test (ERR_MODULE_NOT_FOUND), proving the oracle has teeth against the real tree. exit 0.
- `tsc --noEmit -p tsconfig.core.json` → **0 errors.** exit 0.

## Criterion 3b — `architecture.config.json` reclassification is HONEST — PASS

Independently read the imports of both reclassified files:

- `execution-provider-port.ts`: **one import** — `import type { DataClass } from "./ports.js"` (a Core type). No adapter, no infra SDK.
- `health-contract.ts`: **zero imports** (pure types + the pure `isReady` predicate).

Both are genuine pure type/interface surfaces importing only Core types (or nothing). **Neither imports an adapter or infra SDK** — the `contracts`-layer classification hides nothing. (The boundary gate independently agrees: classifying these `contracts` keeps the tree CLEAN; a smuggled adapter/infra import would have tripped `arch-boundary-guard` or the Delete-Test oracle.)

## Criterion 4 — Pre-existing failure confirmed — CONFIRMED (environmental, out of scope)

`postgres-faithfulness-self-test.ts` → `Error: Cannot find module 'postgres'`, thrown from `templates/governance-engine/adapters/postgres/probe-reader.ts` (the reference adapter requiring the `postgres` driver, which is absent from the demo toolchain's devDeps: only `@types/node`, `tsx`, `typescript`).

- **Pre-existing / independent of P2.1:** P2.1 touched only the two new contract files + re-export lines + `architecture.config.json`. None of those touch the postgres adapter or this test; the failure mode (missing npm driver) is identical with or without P2.1.
- **Environmental:** a missing toolchain dependency, not a logic defect.
- **Adapter-layer, not Core:** the test imports `../adapters/postgres/index.js`; it is **not** a Core self-test and is **not** in the Delete-Test oracle set (`coreSelfTests` = `self-test.ts`, `golden-master.ts`, `governance-runtime-self-test.ts` — confirmed `postgres-faithfulness` is NOT listed in `architecture.config.json`).
- **Not referenced by the new files.**

This is a regression-watch note, not a gate failure for this slice.

---

## Evidence summary (independently executed)

- host-token grep (both files): host tokens appear **only in comment-prose negations**; `NO NON-COMMENT MATCHES`.
- self-test-count diff: **unchanged** across all 7 (39/39 · 42/42 · 10/10 · 25/25 · 45/45 · golden PINNED · self-test all-hold).
- contracts' import list: **Core-only** — `execution-provider-port.ts` → `type DataClass from ./ports.js`; `health-contract.ts` → none.
- arch-boundary-guard CLEAN + `--self-test` 10/10; delete-test CLEAN + `--prove-oracle` ORACLE VALID; `tsc -p tsconfig.core.json` 0 errors.
- Can the Runtime tell which host it runs on? **No.** Did any organ behavior change? **No.**
