# VERIFY — ei-install-assets-p3-2-3 — bootstrap scripts + config templates (static)

- **slice:** `ei-install-assets-p3-2-3 — bootstrap scripts + config templates (static)`
- **author:** Builder (Sprints P3.2 install scripts + P3.3 config templates)
- **verifier:** qa-test (independent; author≠verifier) — 2026-06-30T06:38:34Z
- **independence_basis:** recorded-distinct-invocation (verifier re-ran every static check; did not reuse the Builder's results)
- **machine_probe:** `bash -n infrastructure/execution-node/bootstrap/*.sh` (+ `sh -n`, rendered-template parse battery, secret-literal grep)
- **repo HEAD:** `5a6c3d8`  ·  **branch:** `feat/governance-goal-delta-gate-clean`
- **scope note:** STATIC ONLY. No macOS / Neo / Tailscale / launchd here — these assets cannot execute on this host. Runtime behavior (real idempotent re-run, `launchctl bootstrap`, keychain seeding, `tailscale up`, the cold-boot test) is **DEFERRED to the founder's live macOS install** and is explicitly NOT covered by this verdict.

---

## VERDICT: `executed` — NOT `verified`

The scripts are syntactically clean, the templates render+parse, and there are **zero real credentials** in either directory. **But the P3.2↔P3.3 pair is not consistent:** every template path the scripts reference is wrong, and the renderer's placeholder vocabulary is missing the daemon plists' core placeholders. As shipped, `install-daemons.sh`, `join-tailnet.sh`, and `bootstrap-secrets.sh` cannot find or render any P3.3 template — they fall into the "P3.3 dependency missing" warn/skip branch **permanently, even though P3.3 has landed.** That is a real cross-slice mismatch (Criterion 3), so the gate is `executed` + bug, not `verified`.

---

## Criterion-by-criterion

| # | Criterion | Result |
|---|---|---|
| 1 | Syntax — `bash -n`/`sh -n` on every script; every template renders+parses | **PASS** |
| 2 | Secret hygiene — no real secret; System-keychain-only flow; private key never on Neo | **PASS** (1 LOW hygiene note: founder email) |
| 3 | Placeholder consistency across the pair (paths resolve; sed map matches template vocabulary; node-id variance) | **FAIL — BLOCKING** |
| 4 | Idempotency + fail-closed by inspection | **PASS** (with the caveat that the daemon render path is unreachable — see #3) |
| 5 | Security-posture honesty (manual labels; default-deny ACL with tests[]; no `0.0.0.0`) | **PASS** |

---

## 1. Syntax + parse battery — PASS

**`bash -n` and `sh -n` (GNU bash 5.2.26), all 8 scripts:**

```
PASS bash -n / sh -n : _lib.sh  bootstrap-secrets.sh  install-all.sh  install-daemons.sh
                       install-prereqs.sh  join-tailnet.sh  register-runner.sh  verify-health.sh
```

**Rendered-template parse battery** (placeholders substituted with the `node-config.env.example` defaults, then parsed with the strict tool for each kind):

```
PASS  com.deliveryos.worker.plist        plistlib
PASS  com.deliveryos.supervisor.plist    plistlib
PASS  actions.runner.plist               plistlib
PASS  com.colima.plist                   plistlib
PASS  tailscale-acl.hujson               strip-comments -> json.loads
PASS  healthchecks.config.example        strict json.loads
PASS  runner.config.example              strict json.loads
PASS  secret-registry.template.json      strict json.loads
PASS  colima.yaml                        yaml.safe_load
PASS  windows-watchdog.example           xml.dom.minidom (source is UTF-16, parses)
PASS  .env.shape                          NAME=VALUE shape
PASS  newsyslog.deliveryos.conf           renders clean (tabular)
```

> Note: a first pass reported a spurious FAIL on `runner.config.example`; the cause was the verifier's own naive `//`-comment stripper cutting inside the literal `https://github.com/...` URL in the file's `_README`. Re-parsed as **strict JSON** (the file has no real comments — its "comments" are a `_README` array) → **PASS**. The file is valid.

All scripts parse; every template renders to a parseable artifact under placeholder defaults.

## 2. Secret hygiene — PASS (one LOW note)

Grep of **both** directories for GitHub/Slack/OpenAI/AWS tokens, JWTs, PEM/`BEGIN … PRIVATE KEY` blocks, `postgres://user:pass@` creds, bearer literals, long hex (≥32) / base64 (≥40), and dotted-quad IPs:

```
CLEAN — no token/JWT/PEM/db-cred/bearer/long-hex/base64.
No IP literal other than the 127.0.0.1 / 0.0.0.0 sentinels in comments
(templates use {{TAILNET_BIND_ADDR}} — no 100.x or routable IP committed).
```

**Keychain flow is correct and honest:** `_lib.sh` pins `SYSTEM_KEYCHAIN=/Library/Keychains/System.keychain`; `keychain_has` probes presence only (never `-w`, so no value prints); `bootstrap-secrets.sh` writes with `security add-generic-password … -U "$SYSTEM_KEYCHAIN"` (never the login keychain), reads each value with `read -r -s` (no echo), scrubs+`unset`s it, writes nothing to a file or the tree, and runs a `gitleaks detect` self-check. The **Ed25519 break-glass private key never lands on Neo**: `bootstrap-secrets.sh` instructs generation on the founder device and seeds only `BREAK_GLASS_PUBKEY` (PUBLIC); `secret-registry.template.json` tags it `data_class: PUBLIC`. The `secret-registry` and `.env.shape` carry names/metadata only — no values.

- **LOW hygiene note (non-blocking):** the **real founder email** `brian.kasanwiredjo@gmail.com` is committed as a hardcoded default in two `bootstrap/` files — `_lib.sh:141` (`: "${DOS_FOUNDER_EMAIL:=…}"`) and `node-config.env.example:16`. It is PII/identity, **not a credential**, so it does not trip the BLOCKING "real secret" clause. The `config-templates/` tree itself is clean (uses `{{FOUNDER_EMAIL}}`). Recommend replacing both with a non-identifying placeholder (e.g. `founder@example.com`) so the founder's email is not a baked-in default. (Bug B3.)

## 3. Placeholder consistency across the pair — **FAIL (BLOCKING)**

Two independent breaks. Both are P3.2 (scripts) vs P3.3 (templates) coupling defects.

### B1 — every template path the scripts reference is MISSING (wrong dir + wrong basenames)

`_lib.sh` sets `TEMPLATE_DIR="$SUBSYS_ROOT"` (= `infrastructure/execution-node/`) and `require_template`/`render_template` resolve `"$TEMPLATE_DIR/$rel"`. The `rel` paths the scripts pass do not exist; P3.3 materialized the templates under `…/config-templates/` with **different basenames**:

| Script | Path it looks for (under `execution-node/`) | On disk? | Actual P3.3 file |
|---|---|---|---|
| `join-tailnet.sh` | `tailscale/acl.hujson.template` | **MISSING** | `config-templates/tailscale-acl.hujson` |
| `bootstrap-secrets.sh` | `config/secret-registry.neo.template` | **MISSING** | `config-templates/secret-registry.template.json` |
| `install-daemons.sh` | `colima/colima-profile.yaml.template` | **MISSING** | `config-templates/colima.yaml` |
| `install-daemons.sh` | `supervision/com.deliveryos.worker.plist.template` | **MISSING** | `config-templates/com.deliveryos.worker.plist` |
| `install-daemons.sh` | `supervision/com.deliveryos.supervisor.plist.template` | **MISSING** | `config-templates/com.deliveryos.supervisor.plist` |

(`execution-node/` contains only `adapters/ bootstrap/ ci-cd/ config-templates/` — none of the `tailscale/ config/ colima/ supervision/` subtrees the scripts expect.)

**Runtime consequence (the honesty problem):** each script guards its template with an `if [ -f … ]` that falls through to `log_warn "P3.3 dependency not yet on disk …"` and `return 0`. So on a real install **after P3.3 has shipped**, `install-daemons.sh` skips the worker+supervisor render entirely and **still exits 0** ("install-daemons complete"), having loaded **no daemons**. `join-tailnet.sh` skips the ACL render; `bootstrap-secrets.sh` silently falls back to a hardcoded key list instead of reading the registry template. The failure is eventually caught downstream (`verify-health.sh` check 6 fails when the supervisor isn't loaded), but the daemon-install step reports green while doing nothing — a false-success surface. The fix is a one-line `TEMPLATE_DIR="$SUBSYS_ROOT/config-templates"` **plus** reconciling all five `rel` basenames to the shipped names.

### B2 — `render_template`'s sed map omits placeholders the daemon plists require

`render_template` substitutes a fixed 25-key sed map. Cross-checking against the 29 placeholders actually used by the templates, **7 are not in the map**:

```
{{RUNTIME_TICK_ENTRY}}  -> com.deliveryos.worker.plist        (rendered by install-daemons)
{{WORKING_DIR}}         -> worker + supervisor plists         (rendered by install-daemons)
{{SUPERVISOR_ENTRY}}    -> com.deliveryos.supervisor.plist    (rendered by install-daemons)
{{RUNNER_HOME}}         -> actions.runner.plist               (reference; svc.sh-generated)
{{COLIMA_BIN}}          -> com.colima.plist                   (reference; brew-generated)
{{COLIMA_PROFILE}}      -> com.colima.plist                   (reference)
{{WATCHDOG_SCRIPT}}     -> windows-watchdog.example           (founder renders manually)
```

The first three are **blocking**: they appear in the two plists `install-daemons.sh` must render. Even if B1's paths are fixed, `render_template` would then hit its own fail-closed guard and `die "Unresolved placeholder(s) … {{RUNTIME_TICK_ENTRY}} {{SUPERVISOR_ENTRY}} {{WORKING_DIR}}"` — so the worker/supervisor daemons can never be rendered as the pair stands. (The other four live only in reference/manual templates the scripts don't feed through `render_template`, so they're lower severity, but they break a founder who renders those by the same mechanism.) Fix: add the seven `-e "s|{{…}}|…|g"` lines and their `DOS_*` defaults in `load_node_config`.

### Node-id variance (the requested call): a REAL, currently-unbridged mismatch

- P3.1 adapter (`adapters/neo/neo-execution-provider.ts:143`, `neo-health.ts:90`, and `worker-daemon.ts:121`) default `nodeId`/`service` = **`"neo-node-1"`** — this is what stamps `engine_heartbeat{nodeId}` and the `bus://evidence/neo-node-1/…` ref.
- P3.2/P3.3 default `{{NODE_ID}}` = **`neo-node2`** (`_lib.sh` `DOS_NODE_ID:=neo-node2`, `node-config.env.example`, every template example). `verify-health.sh` check 5 queries `engine_heartbeat for ${DOS_NODE_ID}` (=`neo-node2`), and the deadman check name is `{{NODE_ID}}-deadman` (=`neo-node2-deadman`).

**Is it safely bridged by the placeholder? No — not on disk today.** The bridge would require the composition root to read `process.env.DOS_NODE_ID` (set by the plist `EnvironmentVariables`) and pass it as `opts.nodeId` to the adapter. But: (a) `worker-daemon.ts`/`index.ts` contain **no `process.env` read at all** — `grep` finds zero `DOS_NODE_ID` consumers; (b) the plist-referenced entry files `worker-entry.mjs` / `runtime-tick.mjs` / `supervisor-entry.mjs` (where such wiring would live) **do not exist yet**; (c) the two subsystems ship genuinely *different* identifiers, with different spelling/numbering (`neo-node-1` vs `neo-node2`). If a daemon ran today against the existing adapter default, it would write heartbeats under `neo-node-1` while the go-live gate and the deadman both look for `neo-node2` → the node would be **misidentified at runtime** and the gate's heartbeat-freshness check would never see its own node. The placeholder makes the variance *bridgeable in principle*, but nothing in this slice (or on disk) bridges it, and the divergent defaults are a latent cross-sprint reconciliation gap. **Flag: reconcile to one canonical node id and make the adapter take it from `DOS_NODE_ID`.** (Bug B4.)

*(Placeholder count check: the `config-templates/README.md` inventory and FOUNDER-INSTALLATION-GUIDE §0 agree at 29 founder-filled placeholders; the scan's "30th" is the literal `{{PLACEHOLDER}}` token used in README prose. Inventory is internally consistent.)*

## 4. Idempotency + fail-closed (by inspection) — PASS (with #3 caveat)

Spot-checked 3 scripts — all follow the probe→action→verify triad and fail closed:
- **`install-prereqs.sh`** — `brew_pin` probes `brew list --versions` before install; verify loop `verify_tool` re-resolves each pin and `die`s on miss. Re-run = green no-op. ✓
- **`register-runner.sh`** — probes `svc.sh status` for online → early-exit no-op; missing token → `one_time_auth` banner + `die`; token handed straight to `config.sh`, then `unset REG_TOKEN`. ✓
- **`install-all.sh`** — `run_step` gates each step on the prior's exit code and `die`s with a `--from N` resume hint; pauses at the registration-token gate. ✓
- `render_template` correctly `die`s on any residual `{{…}}` (this is what would fire on B2). `config_gate` propagates config-doctor's non-zero exit as a hard `die`. ✓

Caveat: the fail-closed renderer is *correct*, but because of B1 the daemon templates are never reached, so the "render dies on unresolved placeholder" protection is never exercised on the real install path — the scripts skip instead. Real idempotent-re-run behavior is **deferred to the founder's macOS install**.

## 5. Security-posture honesty — PASS

- **Manual labels match the genuinely un-automatable:** Tailscale Device Approval + device approval = `MANUAL`/`1-TIME-AUTH`; ACL paste = `MANUAL`; GH registration token = `1-TIME-AUTH` (short-lived, founder-fetched); secret seeding = `MANUAL` (`read -s`); cold-boot/FileVault/parity = `FOUNDER-OK` ★. Each is correctly outside the automated body — none could be automated without a standing god-credential on Neo, which the model forbids. Honest.
- **`tailscale-acl.hujson` is genuinely default-deny:** explicit-allow `acls[]` only; `tag:ci-runner` has **no inbound line** (tailnet sink); `tag:external` is reachable only by `group:founder` (quarantined); `funnel:deny` pinned on `tag:ci-runner` via `nodeAttrs`; Tailscale SSH is keyless/ACL-governed with `check` re-auth for the founder. It ships **with a real `tests[]` block** asserting the watchdog→health allow and the ci-runner/external denies — an enforceable gate, not an assertion.
- **No script or template binds `0.0.0.0`:** plists bind `{{TAILNET_BIND_ADDR}}`; `colima.yaml` sets `network.address: false`; `join-tailnet.sh` actively asserts nothing listens on a wildcard (`lsof … grep '\*:|0\.0\.0\.0:'`). Comments only mention `127.0.0.1`/`0.0.0.0` as the *forbidden* sentinels.

---

## Bug reports (filed; not fixed — verifier does not patch the graded artifact)

- **B1 (BLOCKING):** `_lib.sh` `TEMPLATE_DIR="$SUBSYS_ROOT"` + the five script `rel` paths (`tailscale/acl.hujson.template`, `config/secret-registry.neo.template`, `colima/colima-profile.yaml.template`, `supervision/com.deliveryos.{worker,supervisor}.plist.template`) resolve to non-existent files; P3.3 shipped them at `config-templates/` with different basenames. Result: silent skip + false-green daemon-install step. Fix `TEMPLATE_DIR` → `$SUBSYS_ROOT/config-templates` and reconcile all five basenames.
- **B2 (BLOCKING):** `render_template` sed map lacks `{{RUNTIME_TICK_ENTRY}}`, `{{SUPERVISOR_ENTRY}}`, `{{WORKING_DIR}}` (used by the worker/supervisor plists it must render) — render would `die` fail-closed once B1 is fixed. Also add `{{RUNNER_HOME}}`, `{{COLIMA_BIN}}`, `{{COLIMA_PROFILE}}`, `{{WATCHDOG_SCRIPT}}` (+ matching `DOS_*` defaults in `load_node_config`).
- **B3 (LOW):** real founder email hardcoded as a default in `_lib.sh:141` and `node-config.env.example:16`; replace with a non-identifying placeholder.
- **B4 (MEDIUM):** node-id variance `neo-node-1` (P3.1 adapter/worker-daemon default) vs `neo-node2` (P3.2/P3.3 default) is not bridged on disk — no `DOS_NODE_ID` consumer exists and the entry files that would wire it are absent. Reconcile to one canonical id and have the adapter source it from `DOS_NODE_ID`.

## Re-verify conditions

`verify_status: verified` requires, on re-submission: all scripts still `bash -n`/`sh -n` clean **and** all templates render+parse **and** zero real secrets **and** (B1+B2) the scripts' template references resolve to the shipped files with a complete placeholder map — proven by a dry `render_template` of the worker+supervisor plists producing zero residual `{{…}}` — **and** (B4) the node-id is reconciled or its bridge is on disk. Runtime/idempotent-re-run validation remains DEFERRED to the founder's live macOS install.
