# VERIFY — validation-tooling-p3-7 — validate-node harness + runbook (objective-evidence acceptance)

- **slice:** validation-tooling-p3-7 — `validate-node.mjs` (the live-node objective-evidence harness) + `VALIDATION-RUNBOOK.md`
- **author:** Builder
- **verifier:** qa-test (independent; author≠verifier) — 2026-06-30
- **independence_basis:** recorded-distinct-invocation (verifier ran the builder's self-test independently AND wrote a separate adversarial faker probe importing the module's exported `runValidation`/`CHECKS`, distinct from the in-file `--self-test`)
- **machine_probe:** `node validate-node.mjs --self-test`
- **verify_status: verified**
- **scope note:** real-node runtime (live tailnet `/ready`, real `gh` Actions runs, real reboot/page) is **DEFERRED to post-install** — the founder + PO walk the RUNBOOK once Neo is up. This verification covers the *instrument*: that it cannot fake a green, both branches fire, the 9-box mapping matches §11, the probes are read-only, and the boundary/Delete-Test hold.

---

## Verdict

**PASS / verified.** The harness is an honest instrument, not a faker. Every acceptance criterion is met, proven by the builder's offline self-test (re-run independently, exit 0) **and** by a separate verifier-authored adversarial probe (4 attacks, all repelled). No path produces a green without real evidence; the boundary holds and no secret is embedded.

---

## 1. Can it fake a green? (the load-bearing property) — NO

Self-test `node validate-node.mjs --self-test` → **exit 0, ALL PROOFS HOLD** (re-run by verifier). Plus an independent verifier probe (`runValidation`/`CHECKS` imported directly) attempting four fake-green paths — all repelled:

- **ATTACK 1** — feed `--attest <id>=yes` for *every* box id while all probes are red ⇒ zero OBJECTIVE boxes green, gate **NO-GO**. Founder attestation cannot green an objective box (objective verdict is decided solely by `obs.ok`; attest only touches `FOUNDER-ATTEST` boxes).
- **ATTACK 2** — empty config (`repo:""`, `statusPageUrl:""`) + unreachable probes + attest-everything ⇒ **never GO**, zero objective greens. Missing config **fails closed** (`notConfigured()` returns `ok:false`).
- **ATTACK 3** — a probe that *throws* ⇒ caught as **FAIL** (`probe threw: …` evidence), never crashes into green.
- **ATTACK 4** — all objective probes green but **no** attestation recorded ⇒ both `FOUNDER-ATTEST` boxes stay **AWAITING-ATTEST** (not green), gate **INCOMPLETE** (distinct from GO). The two attest boxes also emit a `[ATTEST …]` prompt each.

The self-test's own `[1]/[3]/[4]` blocks corroborate: `watchdog-pages` / `reboot-survival` stay `AWAITING-ATTEST` on green probes (no auto-pass); `--attest id=yes → ATTESTED-PASS`, `=no → ATTESTED-FAIL`; missing `DOS_GH_REPO`/`DOS_STATUS_PAGE_URL` → the box `FAIL`s carrying the named env var. **No silent green exists.**

## 2. PASS and FAIL branches both fire — YES

- **Green probes** → all 7 objective boxes `PASS`; `cicd-roundtrip` evidence cites the `node: neo-node2` marker.
- **Red probes** → all 7 objective boxes `FAIL`, each with a *named* evidence line (e.g. heartbeat names the `503/down/unreachable` cause; boundary-gate surfaces `exit 1` + the violation text) — not a generic failure.
- **Gate computes distinctly:** GO (9 green, exit 0) / INCOMPLETE (attests open, exit 3) / NO-GO (a real FAIL, exit 1). `GO requires exactly 9 green` is asserted.

## 3. 9-box mapping matches FOUNDER-INSTALLATION-GUIDE §11 — YES (no box missing, none dropped)

| §11 acceptance box | Harness check | tag |
|---|---|---|
| Runner executes a build (ephemeral re-register) | `runner-build` (a) | OBJECTIVE |
| CI/CD round-trips — `node: neo-node2` (physical author≠verifier) | `cicd-roundtrip` (b) | OBJECTIVE |
| Deploy completes — token-attributed, binding post-deploy-verify | `deploy-attributed` (c) | OBJECTIVE |
| Heartbeat / `/ready` green | `heartbeat-ready` (d) | OBJECTIVE |
| Watchdog pages on synthetic miss | `watchdog-pages` (e) | FOUNDER-ATTEST |
| Off-Neo status surface renders | `status-page` (f) | OBJECTIVE |
| Delete Test passes | `delete-test` (g) | OBJECTIVE |
| Dependency-direction gate (Runtime infra-independent) | `boundary-gate` (h) | OBJECTIVE |
| Cold-boot / reboot-survival | `reboot-survival` (i) | FOUNDER-ATTEST |

All nine present; the two that genuinely need the founder's eyes (a real page, a real physical reboot) are correctly `FOUNDER-ATTEST`, the other seven objective.

## 4. Objective probes are real + READ-ONLY — YES

- **Real mechanisms:** `gh api <path>` (GitHub Actions API: runners, workflow runs, jobs, job logs), tailnet/status `GET` (`node:http`/`node:https`, `method:"GET"`), and local `exec` of `scripts/delete-test.mjs`, `scripts/arch-boundary-guard.mjs`, `monitoring/pull-watchdog.mjs --self-test`.
- **Never mutates Neo:** no POST/PUT/DELETE, no `--method`, no reboot, no daemon stop, no deploy/promote. The grep hits for `POST/reboot/launchctl/fdesetup/deploy` are all in **comments, titles, or self-test mock data** — never an executed verb. `gh` is read paths only; `httpGet` is GET-only; `exec` runs read-only local gates. The destructive steps (stop supervisor, power-cycle) are the founder's hands per the RUNBOOK; the harness records post-conditions + attestation.
- **Ambient auth, no embedded secret:** `gh` carries its own auth (`defaultGh` runs `gh api` with no token arg); tailnet/status GETs are unauthenticated. Every knob is env/flag (`configFromEnv`). Secret-literal grep over both files → **NONE**.
- **No Core-internal runtime import:** the only `import`s are six `node:` built-ins. `PlatformHealthReport` is a JSDoc `@typedef` (type-checker shape only); the runtime keys on `verdict` exactly as the contract's `isReady` does — it never re-derives health.

## 5. Boundary + no regression + no secrets — YES

- `node scripts/arch-boundary-guard.mjs` → **exit 0, CLEAN** (validation classified `adapters` under `infrastructure` per `architecture.config.json`; longest-prefix excepts only the 3 composition-root entry files).
- `node scripts/delete-test.mjs` → **exit 0** — deleting `infrastructure` (which **includes** `validation/`) leaves Core building (`tsc -p tsconfig.core.json`) + all Core self-tests green.
- `node --check validate-node.mjs` → **OK**.
- Secret-literal grep (`ghp_`/`github_pat_`/`sk-`/`xox`/`AKIA`/PEM/`token=`/JWT…) → **NONE**.
- Does not duplicate `bootstrap/verify-health.sh`: this is the end-to-end §11 acceptance layer above the on-node subsystem checks (confirmed by reading both — different concern, no overlap).

---

## Non-blocking observation (not a gate failure)

`FOUNDER-INSTALLATION-GUIDE.md` §11 names the dependency-direction gate `residency-guard.mjs`, which does **not** exist on disk; the canonical/used script is `scripts/arch-boundary-guard.mjs` (which the harness correctly invokes and which runs CLEAN). The drift is in the **guide's** §11 prose, not in the validation tooling under test. Recommend reconciling the §11 line to `arch-boundary-guard.mjs`. Does not affect this slice's verdict — the harness uses the correct, existing script.

## Evidence summary

| Probe | Result |
|---|---|
| `node validate-node.mjs --self-test` | exit 0 — ALL PROOFS HOLD (PASS+FAIL branches, attest prompts, fail-closed config, report render) |
| verifier adversarial probe (4 attacks via imported `runValidation`) | exit 0 — harness CANNOT be faked green |
| `node scripts/arch-boundary-guard.mjs` | exit 0 — CLEAN |
| `node scripts/delete-test.mjs` | exit 0 — Core builds with `infrastructure` (incl. validation) deleted |
| `node --check validate-node.mjs` | OK |
| secret-literal grep | NONE |
| 9-box §11 cross-check | 9/9 mapped, none dropped |
| read-only audit (imports + mutating-verb grep) | node built-ins only; no real POST/reboot/daemon-stop; ambient `gh` auth |

**Real-node runtime DEFERRED to post-install** (live tailnet/gh/reboot). The instrument is verified.
