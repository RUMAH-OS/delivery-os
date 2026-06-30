# Wave-1 Architecture — Independent Challenge / Refutation

**Role:** independent verification/challenge agent (author≠verifier). **Default posture: skeptical.**
**Date:** 2026-06-30. **Mode:** READ-ONLY. No code changed; this document is the only artifact.
**Under test:**
- `docs/architecture/REPOSITORY-AUDIT-subsystem-map.md` (the audit: 22 subsystems, "zero violations", the layout, F1–F8)
- `docs/architecture/DEPENDENCY-ENFORCEMENT-and-delete-test.md` (the boundary gate + the standing Delete Test + wiring)
- `docs/architecture/neo/07-execution-infrastructure-complete.md` + `neo/templates-and-scripts-inventory.md` (the contracts + bootstrap + supervision + CI/CD)
- `CLAUDE.md §3` (the new Repository-Principle invariant)
- Grounding: `docs/architecture/PRINCIPLE-repository-and-dependency-rule.md`

**Verdict legend:** SURVIVES (claim holds under independent re-verification) · WEAKENED (true but overstated/unproven/scoped narrower than claimed) · REFUTED (false, invalid, or load-bearing on something absent).

---

## Attack 1 — "Zero dependency-direction violations"

**Claim (audit §3, §6):** zero direction violations in either direction; the governance-engine organ surface is residency-clean; the only `postgres` imports are in the sanctioned reference adapter.

**Independent re-verification (not trusting the audit):**
- `grep` of `templates/workflow-engine/**.ts` for `governance-engine|/tools/|postgres|pg|dockerode|tailscale|@slack|@actions|@octokit` → **zero import hits.** SURVIVES.
- `grep` of `templates/governance-engine/**.ts` for a real `import … from "postgres"|"pg"|"dockerode"|…` **excluding `/adapters/`** → **zero hits.** The one suspicious file, `metric-probe.ts:5`, names `import postgres from "postgres"` **inside a comment** describing the *admin* module; this module imports only `./ports.js` (read it — lines 5–16, 37). The residency claim holds for the organ surface.
- Composition root `runtime.ts` imports only sibling `./*.js` organs (lines 36–56) and the port types — no adapter import. SURVIVES.

**On the residency-guard's OWN exclusions (the real attack):** `residency-guard.mjs:55` `SKIP_DIR = {node_modules,.git,dist,build,adapters}`. The guard **excludes `adapters/` by design** and does **not** walk `examples/`. So the "CLEAN 32-file" verdict is a verdict over the *organ surface only*. That is the correct scope for "Core imports nothing outward" — but it means the clean verdict is **scope-limited, not whole-repo**, and a leak that lived in an excluded path would be invisible. I checked the excluded paths anyway: `adapters/postgres/**` legitimately imports `postgres` (sanctioned); `examples/finance-os-demo/vendor/governance-engine/` has **no `adapters/` dir at all** (pure in-memory). No hidden leak found.

**On the designed-not-built `ExecutionProviderPort`:** `grep ports.ts` → the port does **not exist yet** (0 hits). The *design* puts it Core-side in `ports.ts` with opaque-string `labels`/`capabilities` and a PII-free `payload` — so by construction it would not introduce a direction violation. **But** see Attack 4: the port's *type* leaks host vocabulary (`resource_class: "macos"`), which is a knowledge-boundary blemish the residency-guard would never catch (it greps imports, not type literals).

**Verdict: SURVIVES** for the runtime as it exists today (the strongest, best-evidenced claim in the wave). **Caveat:** "zero violations" is true over the *organ surface the guard scans*, not "the whole repo is proven clean" — and nothing yet enforces it (Attack 3). The clean state is real but **un-gated**.

**Corrected claim:** "The governance/workflow organ surface imports nothing outward (independently re-verified, comments excluded). This is true by current discipline; it is **not yet guaranteed by construction** — no gate runs, and the verdict's scope is the organ surface, not the whole tree."

---

## Attack 2 — The proposed repo layout (runtime/adapters/execution-infrastructure/tooling)

**Claim (audit §5, F4):** split `templates/` into `runtime/ + adapters/ + execution-infrastructure/ + tooling/`, leaving `templates/` for inert scaffolding; "minimal, mechanical" moves.

**Independent assessment of the churn:**
- `os-foundation.manifest.json` carries **39** `templates/tools/*` path entries + the engine `source: templates/workflow-engine`. The full F4 rename rewrites **every one of those 39 entries** plus the engine source path. "Minimal, mechanical" undersells it: it is a 40+ path-string atomic rewrite of the single file that *defines the install set*.
- Path refs to the engine folders also live in `templates/tools/os-inherit.mjs` (the installer itself). A rename means the installer's own path logic + the manifest must change in lockstep, behind the verify-gate, in one slice — or a half-applied rename **breaks `os-inherit sync` for every consumer**.
- **Does the rename break vendoring?** Partially de-risked, not zero-risk. The consumer-side `INHERITED-engine.json` sha-record is **content-keyed** (byte-identical *directory*, per `enginesNote`), and the only such records on disk live under `examples/engine-demo-app/.claude/os/` — i.e. the vendored copy's integrity is keyed on engine *content*, not delivery-os's internal path. So renaming `templates/workflow-engine → runtime/workflow-engine` does **not** invalidate an already-vendored copy's sha. **What it does break** is the `source`/`--from` resolution: `os-inherit sync` reads `source: "templates/workflow-engine"`; PLOS/admin `engine:install` wiring points at that path. Those break the instant the folder moves and the manifest/installer aren't updated together. The risk is **install-path coupling**, not sha drift — real, but narrower than "breaks vendoring."

**Is it worth it for a solo founder?** The audit itself concedes the lighter alternative in §5.2: an **in-place sub-folder split inside `templates/tools/`** (`tools/core/`, `tools/adapters/`, `tools/gates/`) achieves the path-legibility F4 wants **without the cross-repo install-path churn**, plus the cheap top-level lift of the design-only `neo/` docs. F4's "move it all to top-level `runtime/`+`adapters/`" is **over-engineered relative to the stated benefit** (legibility) and the stated constraint (solo founder, anti-third-fork, no cross-repo drift). The expensive part (engine folder rename) buys legibility that the cheap sub-folder split also buys.

**Verdict: WEAKENED.** The layout is *architecturally* coherent and the audit is honest about the path-cost in §5.2 — but the headline recommendation ("split the vendorable `runtime/` from top-level `adapters/`") is the high-churn option, and the audit's own §5.2 minimum (sub-folder split + lift the design-only docs) delivers the legibility for a fraction of the blast radius. "Minimal, mechanical" is the wrong adjective for a 40+ path atomic rewrite of the install manifest + installer.

**Corrected claim / must-fix:** Adopt the §5.2 **minimum** (in-place `templates/tools/{core,adapters,gates}/` split + lift `neo/` docs to a top-level `execution-infrastructure/design/`), defer the `runtime/` engine rename until/unless a second engine and a real second consumer make the legibility pay for the install-path churn. If the full rename is taken, it MUST be one atomic slice rewriting `os-foundation.manifest.json` + `os-inherit.mjs` + every `--from` together, behind the verify-gate, with an `os-inherit sync` dry-run on a consumer as the acceptance gate.

---

## Attack 3 — The dependency gate + the standing Delete Test

**Claim (enforcement design §1–§4, §6):** a config-driven static gate catches the realistic leak; the Delete Test is the defense-in-depth twin that catches what the static resolver misses.

### 3a. The static gate
- **Does it catch the realistic leak (a Core file importing a Neo/Docker SDK)?** By design, yes — the planted-violation self-test (§1.4) fires on `core→adapters` and `dockerode` in a `denyInfraSdk` layer, and the detector generalizes the proven residency-guard. The *design* is sound. **But it is 100% unbuilt:** `architecture.config.json` does **not exist** (confirmed absent), `scripts/arch-boundary-guard.mjs` does **not exist**, and `residency-guard` is referenced by **nothing** in `.githooks / .claude / scripts / templates/workflows` (grep → only its own file). `.githooks/pre-push` has **Gates 1–4 only — no Gate 5** (read it). So the gate's *catching power* is entirely prospective.
- **Honest-limits gap bigger than admitted?** §6 admits dynamic imports + the composition root. The composition-root concession is correct and not under-stated: `createGovernanceRuntime` *does* wire concrete adapter instances into Core through ports at runtime — that is the intended inversion, an instance edge not an import edge, so the static gate rightly won't flag it. The residual risk (an adapter re-coupled into Core at the composition root through a port whose *implementation* reaches back) is real but is exactly what the Delete Test is supposed to cover — which brings us to the fatal flaw.

### 3b. The Delete Test — two load-bearing assertions, both currently broken
1. **"Core builds" (`tsc --noEmit` against `tsconfig.core.json`)** — `tsconfig.core.json` **does not exist** (confirmed absent; the design admits this in §2.3 as "the one piece of new scaffolding"). So the *only* assertion with real teeth **cannot run today.** The audit's confidence and the kernel's "guaranteed by construction" both rest on a file that isn't there.
2. **"Core self-tests pass" (`examples/finance-os-demo → npm run finance:proof`)** — **REFUTED as a valid oracle.** I traced it: `run-finance-os.ts:21` imports `./vendor/governance-engine/index.js` — finance-os-demo runs against its **own vendored copy**, and that vendor copy **has no `adapters/` directory at all** (it's pure in-memory). The Delete Test (§2.1–§2.2) deletes `execution-infra/` + `templates/governance-engine/adapters/postgres` **in a worktree**, then runs `finance:proof`. But `finance:proof` never touches `templates/governance-engine` — it imports `vendor/`. **So the proof is GREEN no matter what you delete from `templates/`.** It proves the vendored copy is self-contained; it proves **nothing** about whether the *live* `templates/governance-engine` still works with the adapter gone. The oracle is decoupled from the subject under test — the prompt's hypothesis is confirmed.

**Net:** as designed today, the Delete Test's buildability assertion **can't run** (no `tsconfig.core.json`) and its self-test oracle **tests the wrong tree** (vendored copy, adapter-free, unaffected by the deletion). The "defense in depth" the audit leans on for the composition-root residual risk is currently **neither depth nor defense.**

**Verdict: REFUTED (as currently designed/wired).** The static gate is a sound *design* but unbuilt and unwired; the Delete Test as specified is invalid (wrong oracle) and unrunnable (missing tsconfig). The headline that converts the boundary from "true by discipline" to "guaranteed by construction" is, on disk, **discipline only.**

**Corrected claim / must-fix:**
- The self-test oracle MUST run against the **tree under deletion**, not a vendored copy. Either (a) add an in-repo Core liveness proof that imports `templates/governance-engine` directly (not `examples/**/vendor`), or (b) have the Delete Test *re-vendor from the post-deletion worktree* before running the proof, so the proof actually exercises the deleted state.
- `tsconfig.core.json` (core+contracts, adapters excluded) is a **prerequisite**, not a footnote — without it there is no "Core builds" assertion at all.
- Until both exist + Gate 5 is wired, the kernel §3 must not say the principle is "enforced by … the standing Delete Test" (Attack 6 / most-dangerous-gap).

---

## Attack 4 — The Execution-Infra contracts' host-agnosticism

**Claim (NEO-EXEC-07 §2):** no field names a host/socket/container/tailnet; `labels`/`capabilities` are opaque strings; the Health contract is emit-only from Core; `runSprint`→`ExecutionRequest` re-expression is "zero Runtime-behavior change" (the §44 acceptance test).

**Independent read of the proposed shapes (NEO-EXEC-07 §2.1):**
- `payload: Record<string,unknown>` "OPAQUE, PII-free" + `jobId/goalId/kind/budget` — clean, no host leak. SURVIVES.
- `labels`/`capabilities?: string[]` — opaque, matched by the selector. SURVIVES as a mechanism.
- **`placement_req.resource_class: "cpu-small" | "cpu-large" | "gpu" | "macos" | "any"`** — **this is a host/hardware vocabulary baked into a Core-owned closed type union.** `"macos"` is an operating system; `"gpu"` is hardware. The design's own discriminator (§2.1, boxed) insists "It never writes `"neo"` … the *string* `"macos"` matched against a *label* is the entire coupling" — but a *free string* matched against a label is opaque; a **closed union member `"macos"` in a Core type** is Core *enumerating* host classes. That is a knowledge leak: Core now names a host OS in its contract. The worked example literally hard-codes `resource_class:"macos"` and `capabilities:["pg"]` / `["docker","vercel-token"]` — concrete-environment nouns surfacing in Core-side code samples.
- **Health contract emit-only?** Read §2.2: `HeartbeatEmitterPort.emit`, `PlatformHealthProvider.buildReport/liveness`, and `isReady(report)` are all emit/compute-side, Core-owned; the consume side (Healthchecks pusher, Windows pull, status page) is 100% adapter. This one **SURVIVES** cleanly — Core names no monitor; `isReady` is a pure predicate shared by construction. Good design.
- **§44 "zero Runtime-behavior change"?** This is an *acceptance test the design proposes*, not a demonstrated fact — the port is unbuilt (confirmed: absent from `ports.ts`). The re-expression replaces the `SprintExecutor{admitToExecuting,runSprint}` seam (`po-autoloop.ts:112–118`) with a `PlacementPort` + `ExecutionProviderPort` registry. The back-compat story (null registry ⇒ `{halt:"no-eligible-node"}` ⇒ governance still ticks) is *plausible* and maps to today's `DEFERRED_EXECUTOR` throw-by-default — but it **changes the controller's seam shape** (the controller stops holding a `SprintExecutor`). "Zero behavior change" is an unproven assertion about a refactor that alters the public executor contract; it cannot be graded SURVIVES until the acceptance test actually runs.

**Verdict: WEAKENED.** The Health contract is genuinely host-agnostic (SURVIVES). The `ExecutionProviderPort` is *mostly* clean but **leaks host vocabulary** via `resource_class: "macos"/"gpu"` in a Core-owned union, contradicting the design's own "no field names a host" claim. The §44 "zero behavior change" is an unproven acceptance test, not a result.

**Corrected claim / must-fix:** Make `resource_class` an **opaque string** (like `labels`) or an adapter-owned vocabulary the selector matches structurally — do not enumerate `"macos"/"gpu"` in a Core type. Re-grade §44 only after the acceptance test runs green against the real controller.

---

## Attack 5 — FileVault / bootstrap / CI kill-switch soundness

**Claims (NEO-EXEC-07 §3–§8):** `fdesetup authrestart` brings the daemon up unattended after a planned reboot; `vars.CI_RUNNER` is a real UI kill-switch; the bootstrap is idempotent.

- **FileVault / authrestart:** `fdesetup authrestart` stages a one-time unlock for the *next* boot, so a **planned** reboot comes up unattended — this is correct and the design scopes it honestly: §4, §8, and NEO-OPS-06 explicitly carve out the **unplanned** reboot (power loss) as "a paged manual-login event" because no key is staged. The claim is **not over-stated** — the still-open unplanned case is admitted, not hidden. **SURVIVES (honestly scoped).** Residual: a solo-founder node that loses power while the founder is away is *down until a human logs in* — an availability fact the design owns but does not solve.
- **`vars.CI_RUNNER` kill-switch:** the expression `runs-on: ${{ vars.CI_RUNNER == '' && 'ubuntu-latest' || fromJSON(vars.CI_RUNNER) }}` is evaluated **at job-start from the repo variable**, so flipping the variable in the UI **does** reroute **future and queued** runs with no commit, no Neo dependency. **But** it does **not** reroute a job **already executing** on a runner — an in-flight job on a dead Neo runs until it times out. The prompt's "in-flight" criterion is **not** met. **WEAKENED:** real kill-switch for future/queued runs (the important case), but the "reroute in-flight" framing is an over-reach — in-flight jobs drain/timeout on the old runner.
- **Bootstrap idempotency:** the probe→action→verify triad (§3.2) is genuinely re-runnable for the AUTOMATED steps (prereqs, daemons, health-verify). The SEMI/MANUAL steps (device approval, registration token, secret seeding) are idempotent only in the weak sense of "prompt only for what's missing" — they are **not unattended-re-runnable** (a human must act). §8 owns this as "the founder is the SRE." So "the bootstrap is idempotent end-to-end" is true for *convergence/no-op-when-satisfied* but **not** for *unattended* re-run. **WEAKENED (scoped):** idempotent as a convergence property; not unattended.

**Verdict: WEAKENED overall** — each sub-claim is honestly designed but the headline framings ("unattended", "in-flight", "idempotent") are each one qualifier too strong. No hidden defect; calibration issues.

**Must-fix:** none blocking — adjust the language: kill-switch reroutes *future/queued* runs (in-flight drains); bootstrap is *convergent/no-op-when-satisfied*, with a named manual residual; the unplanned-reboot availability gap remains an accepted founder-SRE cost.

---

## Attack 6 — What four separate streams collectively missed

1. **The kernel now advertises enforcement that does not exist on disk.** `CLAUDE.md §3` (read it) states the principle is "enforced by the dependency-direction gate + the standing Delete Test." Present tense. On disk: no `architecture.config.json`, no `arch-boundary-guard.mjs`, no `tsconfig.core.json`, no Gate 5, no `.github/workflows/` in delivery-os at all (CI exists only as vendorable *templates*). **The kernel asserts an operational enforcement that is 100% unbuilt** — the exact North Star §12 failure mode ("verification is operationally enforced, not remembered") the principle invokes to justify itself. And `check-os-drift.mjs` (Gate 2) covers skills/agents drift, **not** this principle — so nothing catches this kernel-vs-disk lie. **This is the most dangerous gap.**
2. **Two un-drift-gated subsystems compound (F2 + the proposed `infrastructure/`).** `governance-engine` appears **nowhere** in `os-foundation.manifest.json` (grep → 0), so the second engine propagates with no sha-record and no `engine-check` — the `examples/finance-os-demo/vendor/governance-engine/` copy is a literal hand-copy. The proposed `infrastructure/execution-node/` folder would be born the same way: un-manifested, un-drift-gated. The platform's own anti-pattern (vendored-engine drift, the live PLOS/admin `engine-check` failure the principle cites) is being **re-created**, not closed.
3. **The dangling `goal-progress.mjs` (F3) is a live foot-gun, not cosmetic.** `os-foundation.manifest.json:33` lists `templates/tools/goal-progress.mjs`; the file is **absent**. os-inherit treats the manifest as the install set, so a fresh consumer `sync` references a missing tool — and `check-hook-paths` (Gate 4) is exactly the class of gate that would block on a missing tool reference. This blocks `engine:install`/`sync` hygiene **today**.
4. **Circular ordering — the build cannot start cleanly.** The enforcement gate's `architecture.config.json` layer folders point at `templates/governance-engine` etc.; if F4's rename happens those paths change → the config must be written *after* the layout decision. The layout rename needs the manifest fixed first (F2 add governance-engine, F3 remove goal-progress). The manifest fix needs a founder a/b call (rename now vs. sub-folder split; add second engine entry). So: **enforcement depends on layout, layout depends on manifest, manifest depends on a founder decision** — none of the four streams owns the sequencing, and each assumes the others land first.
5. **No delivery-os CI exists to host the "binding re-run on neutral hardware."** The enforcement design (§4.2) and the verify-gate posture both lean on a CI `architecture-boundary` + `delete-test` job "on neutral hardware." delivery-os has **no `.github/workflows/`** of its own. The binding copy has no home until either delivery-os grows real CI or the self-hosted Neo runner (itself unbuilt, gated behind this very principle) exists — a second circular dependency (the Delete Test's "free on the self-hosted runner tomorrow" mitigation depends on the runner that this principle is meant to govern).

---

## Scorecard

| # | Load-bearing claim | Verdict |
|---|---|---|
| 1 | Zero dependency-direction violations (runtime, today) | **SURVIVES** (organ-surface scope; un-gated) |
| 1b | Clean verdict is whole-repo proof | **WEAKENED** (guard excludes `adapters/`+`examples/`; scope = organ surface) |
| 2 | Repo layout split is "minimal, mechanical", worth the churn | **WEAKENED** (§5.2 sub-folder split delivers the benefit at a fraction of the blast radius) |
| 2b | The rename breaks vendoring | partially conceded: breaks **install-path** resolution, not content sha records |
| 3 | Static gate catches the realistic leak | **SURVIVES as design** / unbuilt + unwired |
| 3b | Delete Test "Core builds" assertion | **REFUTED today** (no `tsconfig.core.json`) |
| 3c | Delete Test "self-tests pass" oracle (finance:proof) | **REFUTED** (tests the vendored copy, adapter-free — green regardless of deletion) |
| 4 | ExecutionProviderPort names no host | **WEAKENED** (`resource_class:"macos"/"gpu"` enumerated in a Core type) |
| 4b | Health-Emission contract is emit-only from Core | **SURVIVES** (clean) |
| 4c | §44 "zero Runtime-behavior change" | **WEAKENED** (unproven acceptance test; the seam shape changes) |
| 5 | `fdesetup authrestart` unattended after reboot | **SURVIVES** (planned only; unplanned admitted) |
| 5b | `vars.CI_RUNNER` reroutes in-flight + future runs | **WEAKENED** (future/queued only; in-flight drains) |
| 5c | Bootstrap is idempotent | **WEAKENED** (convergent/no-op; not unattended) |
| 6 | Kernel §3: principle "enforced by" the gate + Delete Test | **REFUTED** (zero enforcement on disk; kernel advertises vapor) |

---

## The single most dangerous gap

**The kernel (`CLAUDE.md §3`) and the audit both assert the Repository Principle is "enforced … operationally, not remembered" — and on disk it is enforced by nothing.** No `architecture.config.json`, no `arch-boundary-guard.mjs`, no `tsconfig.core.json`, no Gate 5 in `.githooks/pre-push`, no delivery-os CI at all. Worse, the one enforcement that was *designed* to be the safety net — the standing Delete Test — is, as specified, **invalid** (its `finance:proof` oracle runs against a vendored, adapter-free copy and is green no matter what is deleted) and **unrunnable** (its `tsc` assertion needs a `tsconfig.core.json` that does not exist). So the wave has (a) ratified a kernel invariant that claims present-tense enforcement, (b) backed it with an audit that says "guaranteed by construction", while (c) the construction guarantees nothing yet — and (d) `check-os-drift` does not cover this principle, so the kernel-vs-disk gap is itself un-gated. This is precisely the North Star §12 failure mode the principle was written to abolish, reproduced inside the principle's own rollout.

## Overall verdict: **ACCEPT-WITH-CHANGES (rework the enforcement stream before it is trusted)**

The *analysis* is strong and largely honest: the runtime cleanliness is independently confirmed (Attack 1 SURVIVES), the Health contract is well-designed (Attack 4b), and the design docs are unusually candid about their own limits. The audit's findings F1–F8 are accurate. What must not be accepted is the **claim that the boundary is enforced** and the **Delete Test as currently specified**.

**Must-fix before acceptance (blocking):**
1. **Fix the kernel claim.** `CLAUDE.md §3` must say the principle is *to be* enforced (designed, not yet wired) — or wire it — but it may not assert present-tense enforcement that does not exist on disk. Add this principle to `check-os-drift` coverage so the lie can't recur.
2. **Fix the Delete Test oracle.** Its Core liveness proof must exercise the **tree under deletion** (import `templates/governance-engine` directly, or re-vendor from the post-deletion worktree) — not a static vendored copy that is structurally immune to the deletion.
3. **Add `tsconfig.core.json`** (core+contracts, adapters excluded) — the "Core builds" assertion has no teeth without it.
4. **Manifest hygiene first (F2+F3):** register `governance-engine` as a second engine (sha-record + DDL-parity) and remove/restore the dangling `goal-progress.mjs:33` — both block clean propagation today and must precede any layout move.

**Should-fix (non-blocking):**
5. Adopt the §5.2 **minimum** layout (in-place `templates/tools/{core,adapters,gates}/` split + lift `neo/` docs) instead of the high-churn `runtime/` rename, unless/until a real second engine + consumer justify the install-path churn; if the full rename is taken, do it as one atomic manifest+installer+`--from` slice with an `os-inherit sync` dry-run as the gate.
6. Make `resource_class` opaque (drop `"macos"/"gpu"` from the Core union).
7. Re-grade §44 only after the back-compat acceptance test runs; calibrate the §5/§7 language (kill-switch = future/queued; bootstrap = convergent-not-unattended; unplanned-reboot availability gap accepted).
8. Resolve the **circular ordering** explicitly: founder a/b call on layout → manifest fix → write `architecture.config.json` → build gate → build Delete Test (with the corrected oracle) → wire Gate 5 + delivery-os CI. No stream may assume another has landed.

*Challenge performed read-only on 2026-06-30. All paths, line numbers, and grep results are as found on disk that day. Repo: `C:\Users\brian\RUMAH\delivery-os`.*
