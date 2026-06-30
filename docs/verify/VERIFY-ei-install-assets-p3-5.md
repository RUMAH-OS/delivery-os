# VERIFY — ei-install-assets-p3-5 — reconciled bootstrap↔templates + composition root + composition layer

- **slice:** `ei-install-assets-p3-5 — reconciled bootstrap↔templates + composition root + composition layer`
- **author:** Builder (Sprint P3.5 — reconciliation of the P3.2↔P3.3 integration defects + the composition root + the `composition` boundary layer)
- **verifier:** qa-test (independent; author≠verifier) — 2026-06-30T07:04:43Z
- **independence_basis:** recorded-distinct-invocation (the verifier re-derived every check from disk — re-ran the guard, exercised `render_template` directly, planted the adapter→core attack against the REAL config, ran the delete-test + adapter self-test; reused none of the Builder's results)
- **machine_probe:** `node scripts/arch-boundary-guard.mjs` (+ `--self-test`; `render_template` fail-closed harness; in-memory `classify`/`detectBoundaryViolations` attack on the real `architecture.config.json`; `node scripts/delete-test.mjs`; `tsx adapters/neo/self-test.ts`; `bash -n`; PII/secret grep)
- **repo HEAD:** `5a6c3d8`  ·  **branch:** `feat/governance-goal-delta-gate-clean`
- **scope note:** STATIC + repo-local machine checks ONLY. No macOS / Neo / launchd / Tailscale / colima here. **Runtime behavior — real `launchctl bootstrap`, keychain seeding, `colima start`, the cold-boot test, and a true idempotent re-run — is DEFERRED to the founder's live macOS install** and is explicitly NOT covered by this verdict.

---

## VERDICT: `verified`

The four blocking defects from the prior `executed` verdict are killed and independently re-proven: (B1) every template path the scripts reference now resolves on disk; (B2) the render map covers every `{{token}}` in all 12 templates with zero residual on a dry-render; (B4) the node-id is unified to one canonical `neo-node2` consumed from `DOS_NODE_ID`; (B3) the hardcoded founder email is gone. The deeper `render_template` false-green (fall-through to `sed` on a missing/empty `src`) is killed — it now `die`s (exit 1) with zero artifact. The NEW `composition` boundary layer is **honestly scoped to exactly the 3 composition-root files**: a planted `createGovernanceRuntime` import in a non-composition adapter still fires the guard, and path-prefix games do not earn the privilege. The keystone holds: `rm infrastructure` ⇒ Core still builds.

---

## Criterion-by-criterion

| # | Criterion | Result |
|---|---|---|
| 1 | ★ False-greens KILLED — template paths resolve; install-daemons can't exit 0 with zero daemons; render_template fail-closed on missing/empty src | **PASS** |
| 2 | Render map complete — every `{{token}}` ⊆ map; zero residual on dry-render of all 12 | **PASS** |
| 3 | ★ `composition` layer HONEST — scoped to the 3 roots; planted adapter→core still fires; no prefix-game escape | **PASS** |
| 4 | Composition root genuinely needs both layers — worker-entry imports Core+adapter; supervisor imports Contract+adapter; runtime-tick pure glue; `node --check` all 3 | **PASS** |
| 5 | Node-id unified — one `neo-node2`; zero `neo-node-1` in the impl surface; `DOS_NODE_ID` consumed + passed through; adapter self-test green | **PASS** |
| 6 | No regression + PII clean — `bash -n` all; self-test 10/10; delete-test PASS (incl. rm infrastructure); PII/secret CLEAN | **PASS** |

---

## 1. ★ The false-greens are KILLED (the critical re-test) — PASS

**(a) Every referenced template path EXISTS.** `_lib.sh` now sets `TEMPLATE_DIR="$SUBSYS_ROOT/config-templates"` (was `$SUBSYS_ROOT`). Every literal template-rel the scripts pass resolves under `config-templates/<subfolder>/…template`:

```
EXISTS  colima/colima-profile.yaml.template                  (install-daemons.sh:49)
EXISTS  config/secret-registry.neo.template                  (bootstrap-secrets.sh:34)
EXISTS  supervision/com.deliveryos.worker.plist.template      (install-daemons.sh:88)
EXISTS  supervision/com.deliveryos.supervisor.plist.template  (install-daemons.sh:89)
EXISTS  tailscale/acl.hujson.template                         (join-tailnet.sh:77)
```

**(b) `install-daemons.sh` can no longer exit 0 with zero daemons loaded.** Two independent gates, both present: the render front-gate — `install_daemon` calls `rendered="$(render_template …)"` whose `require_template`/`render_template` `die` (exit 1) under `errexit` on a missing template, halting the install before any "complete" log; and the verify back-gate — `verify_daemon` increments `DAEMON_FAILS` for any label not actually loaded, and the script ends with `if [ "$DAEMON_FAILS" -ne 0 ]; then die …`. A genuinely-absent required plist HALTS; there is no warn-skip→green path.

**(c) The deeper `render_template` false-green is KILLED (PRIMARY PROBE).** Exercised the real plain-assignment call shape (`rendered="$(render_template …)"`) directly:

- **MISSING template** → both `require_template` and the re-asserted `[ -z "$src" ] || [ ! -f "$src" ]` guard `die`; **OUTER-EXIT=1**, render dir empty (no artifact).
- **EMPTY src** (simulated swallowed-die: `require_template` returns `""`, exit 0) → the `-z "$src"` guard catches it and `die`s; **OUTER-EXIT=1**, no artifact.

Neither path falls through to `sed` to emit an empty file at exit 0. The false-green is genuinely closed.

## 2. Render map complete — PASS

Union of distinct `{{TOKEN}}` across all 12 `*.template` files = 29 tokens (`{{PLACEHOLDER}}` is README prose in `config-templates/README.md`, not a template file). All 29 are present in the `render_template` sed map (the map is a superset: it also carries `NODE_VERSION`, `VERCEL_CLI_VERSION`, `VERCEL_PROJECT_ID` not used by current templates — harmless). A dry-render of **every** template produced `RENDERED-CLEAN` for all 12 with **ZERO residual `{{…}}`** across all rendered artifacts. The B2 blocking placeholders (`{{RUNTIME_TICK_ENTRY}}`, `{{SUPERVISOR_ENTRY}}`, `{{WORKING_DIR}}`) are now in the map with `DOS_*` defaults in `load_node_config`.

## 3. ★ The `composition` layer is HONEST, not a gate loophole — PASS

**Config inspection.** `architecture.config.json` layer `composition` lists ONLY the 3 exact files (`worker-entry.mjs`, `runtime-tick.mjs`, `supervisor-entry.mjs` under `bootstrap/`) with `mayImport: [core, contracts, adapters, composition]`. The `adapters` layer still claims `infrastructure` broadly.

**Clean baseline.** `node scripts/arch-boundary-guard.mjs` → **CLEAN, exit 0**, reporting `composition 3, adapters 12, core 33, contracts 9`. Classification confirms the 3 roots = `composition` while `adapters/neo/neo-execution-provider.ts` and `worker-daemon.ts` = `adapters` (longest-prefix: the exact-file entries out-specific the `infrastructure` folder claim, so ONLY those 3 files reclassify).

**The ATTACK (against the REAL config, in-memory — no disk mutation):**
- **(a) Planted `import { createGovernanceRuntime }` into `neo-execution-provider.ts` (a NON-composition adapter)** → the guard **FIRED**: `[direction] adapters→core (adapters.mayImport = [contracts, adapters]; got edge adapters -> core)`. **The loophole is scoped — a real adapter→core import still trips.**
- **(b) Path-prefix games** — `bootstrap/worker-entry.mjs.evil.ts` and `bootstrap/worker-entry/sneaky.ts` both classify as `adapters` (the exact-file entry `worker-entry.mjs` only matches `p===e` or `p.startsWith(e+"/")`, so neither sibling earns the privilege) and **both FIRED** adapters→core. No prefix-game escape.
- **Control** — the REAL `worker-entry.mjs` importing Core produced **0 findings** (correctly privileged as the composition root).

A `composition` rule broad enough to shield a real adapter→core import would be BLOCKING; it does not — the privilege is enumerated, file-by-file, to exactly the 3 roots.

## 4. The composition root genuinely needs both layers — PASS

- **`worker-entry.mjs`** imports BOTH Core (`createGovernanceRuntime` from `governance-engine/runtime.js`) AND the adapter (`NeoExecutionProvider`, `NeoHeartbeatEmitter`/`NeoHealthProvider`, plus the Postgres adapter) and WIRES them in `main()` — a real composition root, not an empty privilege grab.
- **`supervisor-entry.mjs`** imports the Core CONTRACT `isReady` (from `health-contract.ts`, classified `contracts`) AND the adapter `NeoHealthProvider`, and does real work (tailnet-only `/health`+`/ready`, `/ready`-gated Healthchecks push). It imports only what it needs.
- **`runtime-tick.mjs`** imports NOTHING gated — pure glue receiving the already-wired `runtime`+`registry`.
- `node --check` → **OK** on all three.

## 5. Node-id unified — PASS

`grep` over `infrastructure/` finds the canonical `neo-node2` only; **zero `neo-node-1`** in the implementation surface. The `DOS_NODE_ID` consumer EXISTS and is the single source: the adapter (`neo-execution-provider.ts:145`, `neo-health.ts:92`), `worker-daemon.ts:123`, and the self-test all read `opts.nodeId ?? process.env.DOS_NODE_ID ?? "neo-node2"`. The composition root passes it through (`worker-entry.mjs:42`, `supervisor-entry.mjs:29` → injected into `NeoExecutionProvider`/`NeoHealthProvider`/`WorkerDaemon`), and the worker+supervisor plist templates inject `<key>DOS_NODE_ID</key>` so launchd sets it. The neo adapter **self-test ran green — ALL PROOFS HOLD (exit 0)**, including "heartbeat stamps the canonical node id" and the `bus://evidence/${DOS_NODE_ID}/` evidenceRef. B4 resolved.

*(Non-blocking: two prior verify reports — `docs/verify/VERIFY-ei-install-assets-p3-2-3.md`, `VERIFY-neo-adapter-p3-1.md` — still mention `neo-node-1`; they are historical verification artifacts describing the old state, not the code under test.)*

## 6. No regression + PII clean — PASS

- `bash -n` → PASS on all 8 scripts (`_lib.sh`, `bootstrap-secrets`, `install-all`, `install-daemons`, `install-prereqs`, `join-tailnet`, `register-runner`, `verify-health`).
- `node scripts/arch-boundary-guard.mjs --self-test` → **10/10 passed**.
- `node scripts/delete-test.mjs` → **CLEAN (exit 0)**: `governance-postgres-adapter` PASS and `execution-infrastructure` (`rm infrastructure`) PASS — Core builds (`tsc -p tsconfig.core.json`) + all 3 governance self-tests green with `infrastructure/` deleted. **The composition root did not break the keystone.**
- **PII/secret grep CLEAN:** the prior B3 hardcoded `brian.kasanwiredjo@gmail.com` default is GONE (`_lib.sh` + `node-config.env.example` now use `founder@example.com`). No token/JWT/PEM/db-cred literal; no routable IP literal. *(Non-blocking: a GitHub/Vercel username `bkasanwiredjo` appears in a ci-cd deploy doc — an identity reference in prose, not a credential, pre-existing and outside the bootstrap/template surface.)*

---

## Bug reports

None blocking. Two non-blocking observations carried forward:

- **N1 (INFO):** prior verify reports (`VERIFY-ei-install-assets-p3-2-3.md`, `VERIFY-neo-adapter-p3-1.md`) still reference the retired `neo-node-1` id. Historical artifacts; consider a one-line "superseded by neo-node2 at P3.5" note for provenance hygiene.
- **N2 (INFO):** `infrastructure/execution-node/ci-cd/deploy/DEPLOY-JOB.md` names the founder's `bkasanwiredjo` username (identity, not a secret). Pre-existing; out of this slice's surface.

## Re-verify / deferral note

`verify_status: verified` for the **static + repo-local** surface only. **Runtime + idempotent re-run remain DEFERRED to the founder's live macOS install** — real `launchctl bootstrap` load, `colima start`, System-keychain seeding, `tailscale up`, the cold-boot/FileVault test, and a true green-no-op re-run are not executable on this host and are explicitly NOT asserted by this verdict.
