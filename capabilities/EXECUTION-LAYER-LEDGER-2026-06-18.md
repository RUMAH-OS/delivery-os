# Delivery OS V2 — Execution-Layer Capability Ledger + Promotion Plan (2026-06-18)

> **DESIGN / PLAN ONLY** — no code, no moves, no manifest edits in this pass. The build executes
> against this. Authored by lead-architect; **NOT self-certified** (queued for author≠verifier review).
>
> **Anchor:** `PHASE-2-EXECUTION-LAYER-READINESS-2026-06-18.md` (the evidence-based inventory). This
> doc does **not** re-do that inventory — it **formalizes its findings into a promotion ledger** with the
> exact os-inherit mechanic, a leverage×safety sequence, and an honest criteria mapping. It also reconciles
> with `CAPABILITY-LIFECYCLE.md` (the founder-ratified cross-PROJECT axis) and `CAPABILITY-PROMOTION-DISCOVERY.md`
> (the within-PROJECT promotion-to-shared axis) — it creates **no third lifecycle list**.
>
> **Governing constraint (do not violate):** this is **promotion + hardening of what EXISTS**, not new
> architecture. Where the readiness review found a runner/gate/router/record, this doc only moves it to a
> canonical home and pins it. The one genuinely-new build (the durable execution engine) is explicitly
> DEFERRED, per the readiness review sec5/sec9.
>
> **Two non-negotiable honest facts carried from the anchor:**
> 1. Delivery OS has a COMPLETE governance + routing layer and **NO execution ENGINE** — everything is a
>    checker/gate/router/record (anchor HEADLINE).
> 2. Cross-project sharing is **mirrored, not inherited** (each consumer hand-copies the contract); the only
>    real inheritance is delivery-os->Admin, **N=1** (anchor sec1, sec3). Proving cross-project is a **founder
>    decision** (unfreeze a 2nd consumer), not a build (anchor sec8).

---

## A. The Execution-Layer Capability Ledger

A row per execution-layer capability across all 8 scope areas. `file:line` evidence is real (verified on
disk 2026-06-18). Promotion-status legend:

- **ALREADY-CANONICAL** — listed in `os-foundation.manifest.json` AND sha-pinned in a project's `INHERITED.json`.
- **ADMIN-LOCAL-PROMOTABLE** — built + working in Admin, pure/portable enough to promote; not yet manifest-bound.
- **FRAGMENTED-NEEDS-STANDARDIZE** — exists but duplicated/inconsistent; unify before promoting (don't rebuild).
- **GAP-NEEDS-BUILD** — genuinely missing; a new build.
- **BLOCKED-CROSS-PROJECT** — cannot be proven/closed without unfreezing a 2nd consumer (founder decision).

### Scope 1 — Workflow execution (the 9 gates + slice lifecycle)

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| seam contract gate | gate (fail-closed envelope/registry/PII check) | `.claude/os/tools/seam-gate.mjs` (vendored); canon `delivery-os/templates/tools/seam-gate.mjs` | yes | integration-architect | **ALREADY-CANONICAL** (manifest + INHERITED.json sha `cbcf6c14...`) | none (byte-current) | `os-inherit check` GREEN + gate red on a contract break |
| lifecycle-completeness gate | gate (build->reachable->continuable) | `templates/tools/lifecycle-gate.mjs` -> vendored `.claude/os/tools/lifecycle-gate.mjs` | yes | lead-architect | **ALREADY-CANONICAL** (sha `799ed822...`) | none | gate red on an unreachable surface |
| cross-repo workflow-completeness gate | gate (`fullyProven:false` on unmet peer obligation) | `templates/tools/workflow-gate.mjs` -> `.claude/os/tools/workflow-gate.mjs` | yes | integration-architect | **ALREADY-CANONICAL** (sha `83064367...`) | none (tool); the *peer-obligation it checks* is BLOCKED-CROSS-PROJECT until a 2nd consumer exists | reports `fullyProven:true` on a live round-trip |
| experience / founder-ready gate | gate (founder-burden) | `templates/tools/experience-gate.mjs` -> vendored (sha `99da9773...`) | yes | founder-experience-reviewer | **ALREADY-CANONICAL** | none | gate red on a regressed founder surface |
| skill-frontmatter gate | gate (skill schema) | `templates/tools/skill-frontmatter.mjs` -> vendored (sha `7e357990...`) | yes | knowledge-engineer | **ALREADY-CANONICAL** | none | gate red on malformed SKILL.md |
| agent-frontmatter gate | gate (agent schema) | `templates/tools/agent-frontmatter.mjs` -> vendored (sha `2d2bb8c0...`) | yes | knowledge-engineer | **ALREADY-CANONICAL** | none | gate red on malformed agent.md |
| verify gate (author!=verifier) | record + gate (pending->verified) | `.claude/hooks/verify-gate.mjs` (Admin hook) | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | gate logic portable; the VERIFY corpus is project-local data. Promote tool, keep data per-project | independent verifier flips a slice pending->verified |
| deploy-debt gate | gate (git-ref debt) | `delivery-os/templates/tools/deploy-lane.mjs` (canon present) | yes | lead-architect | **FRAGMENTED-NEEDS-STANDARDIZE** | canon exists upstream but is **not in `os-foundation.manifest.json`** and not in Admin's INHERITED.json — bind + pin | `os-inherit check` GREEN after binding |
| milestone-retro / learning gate | skill + gate (mandatory post-milestone) | `delivery-os/.claude/skills/learning-review/SKILL.md` -> vendored (sha `15ceb6c2...`) | yes | knowledge-engineer | **ALREADY-CANONICAL** (the one skill in the manifest) | none | learning-review recorded post-milestone |
| slice-close orchestration | runner-shaped CHECKER (sync spawnSync; runs registry+route+curator report-only sections) | `scripts/slice-close.mjs` (L192/L213/L231 host the sections) | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | reads project-local slice records; promote the harness, keep records per-project. NOTE: synchronous, no resume (anchor sec3 gap) | a slice close emits the sections + writes a `status:closed` record |

### Scope 2 — Lifecycle management (capability promotion + discovery + governance ladder)

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| capability manifest standard | standard (5 facets, invoke iface, provenance) | `delivery-os/capabilities/CAPABILITY-MANIFEST-STANDARD.md`; 11 manifests `.claude/capabilities/*.json` | yes | lead-architect | **ADMIN-LOCAL-PROMOTABLE** (standard is canon; manifests are project data) | promote nothing structural; manifests stay per-project | `validateManifest` passes on all 11 |
| capability-registry (scan->validate->catalog->drift) | runner (report-only, exit 0) | `scripts/capability-registry.mjs` | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | pure tool; regenerable cache is project-local. Promote tool; the *canonical* catalog is a separate vendored artifact (Promotion&Discovery secA5) | registry validates all 11 + drift section runs |
| capability-route (query/discover) | router (ranked, deterministic) | `scripts/capability-route.mjs` | yes | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | pure/portable; promote tool, point at canonical catalog | `--discover "<intent>"` returns ranked matches |
| capability-invoke (plan/gate from `invoke`) | runner (describe-default, human-gated) | `scripts/capability-invoke.mjs` | yes | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | pure/portable | plans a call from a manifest's invoke descriptor, executes nothing |
| capability-consume (Jarvis loop) | runner (intent->discover->plan->GATED) | `scripts/capability-consume.mjs` | yes | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | pure/portable | end-to-end discover->plan with zero side effects |
| capability-ui (catalog render) | record->surface (HTML from manifests) | `scripts/capability-ui.mjs` -> `docs/capability-exposure.html` | yes | founder-experience-reviewer | **ADMIN-LOCAL-PROMOTABLE** | pure tool; output is project data | renders the 11-cap catalog with no per-cap UI code |
| promotion-to-shared lifecycle (enforced) | DESIGN only (v2, sec11 conditions applied) | `CAPABILITY-PROMOTION-DISCOVERY.md` | n/a (design) | lead-architect | **GAP-NEEDS-BUILD** | build the 4 report->enforce gates on Admin's 11 caps (registration/reference/drift/PII) | gates run on the 11 caps; catalog promoted+vendored |
| cross-PROJECT lesson->capability loop | mechanism (file-lesson->census->ledger->build->os-inherit) | `delivery-os/templates/tools/census-detector.mjs` (171L), `file-lesson.mjs` (166L); `CAPABILITY-LIFECYCLE.md` | yes | knowledge-engineer | **ADMIN-LOCAL-PROMOTABLE** (tools exist upstream, not manifest-bound) | bind census-detector + file-lesson into `os-foundation.manifest.json` + pin | a real lesson travels file->census->ledger with no human rediscovery |
| governance ladder (Built->Verified->Used->...) | standard | `delivery-os/capabilities/CAPABILITY-GOVERNANCE-LADDER.md` | yes | lead-architect | **ALREADY-CANONICAL** (doc canon) | none | a cap's status advances only on cited evidence |

### Scope 3 — Event architecture (outbox + drain + seam contract)

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| transactional outbox (durable, us-ordered) | record (table; `consumed_at` reserved-never-set) | `src/db/schema.ts:253` (table), `:260` (consumedAt) | with-standardization | integration-architect | **ADMIN-LOCAL-PROMOTABLE** (the PATTERN; the table is app data) | substrate is solid (anchor sec4); promote the *pattern/contract*, not the Admin table | outbox row written transactionally with the business write |
| inline event emitters (->1) | 20 hand-written `db.insert(outbox).values({...})` sites | `src/admin.ts` (19: L55,269,363,431,443,456,602,657,1035,1088,1138,1270,1476,1633,1766,1852,1859,1868,1894) + `src/signing-public.ts:104` | with-standardization | integration-architect | **FRAGMENTED-NEEDS-STANDARDIZE** | unify behind one `emit()` abstraction (typed against events-v1) — secC.1. NOT a rebuild | one emit path; a new type added in one place |
| event seam contract (envelope + registry + PII deny) | contract (executable, `.strict()`) | `.claude/os/tools/admin-plos-seam-v1.mjs` (vendored, sha `e078ef1b...`); also `src/contracts/events-v1.ts` | yes | integration-architect | **ALREADY-CANONICAL** (in `os-foundation.manifest.json contracts[]` + INHERITED.json) | none for the contract; see secC.2 for the stale catalog comment | seam-gate validates every drain response |
| events catalog (the type vocabulary) | record (Zod + prose CATALOG comment) | `src/contracts/events-v1.ts:15-39` (comment); emitted types verified on disk | with-standardization | integration-architect | **FRAGMENTED-NEEDS-STANDARDIZE** | CATALOG comment **STALE — 3 emitted types missing**: `contract.created`, `contract.expiring`, `contract.signed` (emitted in src, absent from comment). See secC.2 | comment <-> emitted set reconcile to 0 drift |
| event drain (`GET /v1/events`, PULL, cursor) | router/seam (opaque cursor, at-least-once) | `src/events-api.ts:1-34` (encode/decode cursor); ECR-0006 | with-standardization | integration-architect | **ADMIN-LOCAL-PROMOTABLE** (pattern); the live endpoint is Admin's | promote the PULL-drain *pattern/contract*; the route is app-specific | a live drain returns ordered events past a cursor |
| event lifecycle (retention/archival/DLQ/ack) | — (`consumed_at` reserved, never set; outbox grows unbounded) | n/a (anchor sec3 gap) | n/a | integration-architect | **GAP-NEEDS-BUILD** (SMALL-MEDIUM, conditional) | retention/ack/`consumed_at`; routing ONLY if a 2nd consumer appears | kill+resume drain; prove ack + bounded growth |

### Scope 4 — Agent orchestration (dispatch-route + 4 routers + ownership-policy + 18-agent roster)

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| **dispatch-route (orchestration runner)** | runner (plans; composes agent+ownership+skill+knowledge; Claude spawns) | `.claude/os/tools/dispatch-route.mjs` (header: *"NOT OS-owned ... lives ONLY in Admin ... not in os-foundation.manifest.json"*) — **a byte-identical copy ALSO sits at `delivery-os/templates/tools/dispatch-route.mjs` (1091L) carrying the SAME contradictory header** | yes (pure composer, zero new scorer) | lead-architect | **ADMIN-LOCAL-PROMOTABLE** (half-copied, NOT finished) | bind to `os-foundation.manifest.json` + sha-pin in INHERITED.json + **flip the "NOT OS-owned" header**. Copy-without-binding != promotion | `os-inherit check` GREEN; a 2nd project syncs it |
| agent-route (specialist selection) | router (advisory) | `.claude/os/tools/agent-route.mjs` (vendored, sha `9c934ce0...`) | yes | lead-architect | **ALREADY-CANONICAL** | none | dispatch picks the reconciled owner |
| skill-route (skill injection) | router | `.claude/os/tools/skill-route.mjs` (vendored, sha `5b4acd38...`) | yes | knowledge-engineer | **ALREADY-CANONICAL** | none | top skill injected into spawnPrompt |
| knowledge-route (KU injection) | router (fork of skill-route) | `.claude/os/tools/knowledge-route.mjs` (header: *"NOT OS-owned ... lives ONLY in Admin"*) | yes | knowledge-engineer | **ADMIN-LOCAL-PROMOTABLE** | promote (copy->`templates/tools/` + bind + pin + flip header). Pure/portable; the KU corpus is project data | `os-inherit check` GREEN |
| ownership-policy (work-type->required-owner) | record (declarative map + minOwnerContribution) | `.claude/ownership-policy.json` (reconciledFrom `G14-OWNERSHIP-ROUTING-POLICY.md`) | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | the SCHEMA is portable; the work-type->owner map is partly project-specific. Promote schema/loader; per-project overlay the map | dispatch reconciles owner from the policy |
| dispatch-coverage (routing-honesty denominator) | report-only checker (exit 0) | `.claude/os/tools/dispatch-coverage.mjs` | yes | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | promote with dispatch-route (same wave) | reports coverageRatio over build-bearing slices |
| 18-agent roster | agents (base+overlay) | `.claude/agents/*.md` (18 files) | with-standardization | lead-architect | **FRAGMENTED-NEEDS-STANDARDIZE** | 2 agents (`integration-architect`, `founder-experience-reviewer`) in `os-foundation.manifest.json agents[]`; other 16 Admin-local. Agents propagate via **os-sync (base+overlay)**, NOT os-inherit. Decide base vs overlay per agent | a 2nd project's `os-sync` pulls the base agents |

### Scope 5 — State management

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| slice state record | record (frontmatter; only value seen across 276 records = `status:closed`) | `docs/slices/*.md` frontmatter; read by `scripts/slice-close.mjs` | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** (schema portable; records are data) | promote the frontmatter schema; records stay per-project | a closed slice carries the schema |
| verify state record | record (pending->verified) | `.claude/hooks/verify-gate.mjs` + VERIFY docs | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | as above | a verify doc carries the state |
| dispatch-log | record (append-only, ~53 rows) | dispatch-log (written by dispatch-route) | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** (with dispatch-route) | promote alongside the runner | a dispatch appends a row |
| **durable execution state machine** (7 states: queued/planned/executing/blocked/failed/recovered) | — (only 2 binary states persist) | n/a (anchor sec1, sec3 — HIGH gap, conditional) | n/a | lead-architect | **GAP-NEEDS-BUILD (LARGE — DEFER)** | do NOT build speculatively. Founder-as-orchestrator works today (anchor sec8). Build only when *unattended* multi-step execution is a real requirement | (only if built) persist + resume a multi-step run |

### Scope 6 — Recovery / resilience

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| fail-closed gates (preventive) | gates (block bad state pre-merge) | the 9 gates above | yes | lead-architect | **ALREADY-CANONICAL** (the gates) | none — these are *preventive*, NOT operational recovery (anchor sec2) | a gate blocks a bad slice |
| `--force` override (logged cause) | record + escape hatch | dispatch/slice tooling (`--force` logged) | yes | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | promote with the host tools | a forced run logs its cause |
| tamper-detection (digest re-run) | checker | os-inherit drift / digest re-run | yes | lead-architect | **ALREADY-CANONICAL** (os-inherit mechanic) | none | a tampered vendored file fails `os-inherit check` |
| **automatic retry / resume / escalation** | — (recovery = human reads stderr, fixes, re-runs) | n/a (anchor sec3 — HIGH gap, conditional) | n/a | lead-architect | **GAP-NEEDS-BUILD (LARGE — DEFER)** | bundled with the durable engine (Scope 5). Defer with it | (only if built) auto-retry + resume-from-checkpoint |

### Scope 7 — Observability / tracing

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| execution-ledger (8-Q founder screen) | record->surface (HTML; computes nothing new) | `scripts/execution-ledger.mjs` -> `docs/execution-ledger.html` (32/46 objectives COMPLETE — honest) | yes | founder-experience-reviewer | **ADMIN-LOCAL-PROMOTABLE** | pure aggregator; output is project data. Promote tool | the screen answers the 8 Qs per objective in <2 min |
| operating-model-check | report-only checker (actor x role-area from transcripts) | `scripts/operating-model-check.mjs` | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | tool portable; the transcript corpus is project data | reports Green/Yellow/Red per role area |
| telemetry / evidence ladder (L1-L5) | records (dispatch/skill/knowledge/agent selection logs; 215 selection records, 66.8k transcript lines) | selection logs + transcripts (anchor sec2/sec4) | with-standardization | lead-architect | **ADMIN-LOCAL-PROMOTABLE** | the log SHAPES are portable; the logs are project data | a selection writes a typed record |
| health framework (1 check; aggregator) | individual checks built; aggregator NOT built | `scripts/mail-config-health.mjs` (+ `knowledge-health.mjs`, `skill-health.mjs`); upstream `delivery-os/templates/tools/capability-health.mjs` + `agent-health.mjs`; `delivery-os/capabilities/HEALTH-FRAMEWORK.md` = *"designed-not-built; `delivery-os/health/` does not exist"* | with-standardization | lead-architect | **FRAGMENTED-NEEDS-STANDARDIZE** + partial GAP | checks exist (mail/knowledge/skill/capability/agent-health) but **no aggregator + no `health-snapshot` rollup wired**. `health-snapshot.json` covers the 9 gates only. Standardize the check interface, then build the thin aggregator | one `health` command rolls all checks into one snapshot |
| **in-flight / live observability** | — (screen shows only CLOSED work) | n/a (anchor sec3 — MEDIUM gap) | n/a | founder-experience-reviewer | **GAP-NEEDS-BUILD (MEDIUM)** | extend execution-ledger from post-hoc to live in-flight view | the screen shows a running objective |

### Scope 8 — Cross-project execution / inheritance distribution

| Capability | Existing implementation | Source location | Reusable? | Canonical DOS owner | Promotion status | Remaining work | Validation method |
|---|---|---|---|---|---|---|---|
| os-inherit (single-author->vendored->sha-pinned->drift-gated) | mechanism (proven byte-current) | `delivery-os/templates/tools/os-inherit.mjs`; `os-foundation.manifest.json`; `.claude/os/INHERITED.json` (10 files pinned) | yes | lead-architect | **ALREADY-CANONICAL** (the mechanism) | none — this IS the promotion mechanic secB uses | `os-inherit check` GREEN; a sha drift fails |
| os-sync (agents base+overlay) | mechanism | `delivery-os/templates/tools/os-sync.mjs` | yes | lead-architect | **ALREADY-CANONICAL** | none | a 2nd project's agents merge base+overlay |
| live cross-project seams (Admin->PLOS, Admin->Rumah) | routers/records (wired consumers) | PLOS: `admin-events-consumer.ts` + `/v1/ops` drain; Rumah: `lib/inventory.ts` <- `/v1/inventory/properties` (anchor sec2); `/v1/inventory/units` built, consumer NOT wired | partly | integration-architect | **BLOCKED-CROSS-PROJECT** | contract is **mirrored** in consumers (hand-copied), not inherited. PLOS/Rumah have NO `INHERITED.json` (anchor sec1). Cannot make inherit-not-mirror without editing a frozen/off-limits repo | a consumer imports the *vendored* (sha-pinned) contract; drift-gate catches a change |
| inheritance distribution (seam cap #11 — app->app contract vendoring) | DESIGN intent (extend os-inherit to app->app) | anchor sec5 #1; `CAPABILITY-PROMOTION-DISCOVERY.md secA5/secC3` | yes (extends os-inherit) | lead-architect | **GAP-NEEDS-BUILD (SMALL-MEDIUM)** — but the *PROOF* is **BLOCKED-CROSS-PROJECT** | building the mechanism is small; **proving it (N=1 master gate) needs a 2nd consumer unfrozen** — a founder decision (anchor sec6, sec8) | a 2nd project gains an `INHERITED.json` + `os:check` PASS + a gate green |

---

### Ledger summary — counts per promotion-status

| Status | Count | Capabilities (abbrev.) |
|---|---|---|
| **ALREADY-CANONICAL** | **13** | 6 vendored gates (seam/lifecycle/workflow/experience/skill-fm/agent-fm) · learning-review skill · seam contract · agent-route · skill-route · governance-ladder · os-inherit · os-sync |
| **ADMIN-LOCAL-PROMOTABLE** | **23** | dispatch-route · dispatch-coverage · knowledge-route · ownership-policy · verify-gate · slice-close · manifest-standard/registry/route/invoke/consume/ui · census+file-lesson · cross-PROJECT loop · outbox pattern · drain pattern · slice/verify/dispatch state records · execution-ledger · operating-model-check · telemetry ladder · `--force` |
| **FRAGMENTED-NEEDS-STANDARDIZE** | **5** | deploy-debt gate (canon unbound) · inline emitters (20->1) · events catalog comment (3 missing types) · 18-agent roster (base vs overlay) · health framework (checks exist, no aggregator) |
| **GAP-NEEDS-BUILD** | **5** | promotion-enforcement gates (S-M) · event lifecycle (S-M) · in-flight observability (M) · durable state machine (L, defer) · auto-retry/resume/escalation (L, defer) |
| **BLOCKED-CROSS-PROJECT** | **2** | live cross-project seam (mirror->inherit) · inheritance-distribution PROOF (N=1 master gate) |

> **The honest shape of it:** the vast majority of the execution layer is **already canonical or trivially
> promotable** (36 of 48 rows). Only **5 are genuine new builds** — 2 of those (durable engine + auto-recovery)
> are LARGE and explicitly DEFERRED. The 2 truly hard items are **BLOCKED on a founder decision, not a build**.
> This matches the anchor's bottom line: *~1-2 well-chosen slices from a genuinely shared platform, not a
> big-engine rebuild away.*

---

## B. Promotion sequencing — the os-inherit mechanics

### B.0 The EXACT promotion mechanic (the one path, no parallel mechanism)

For every **ADMIN-LOCAL-PROMOTABLE** *tool* (and the FRAGMENTED ones once standardized), promotion is the
identical 5-step os-inherit ritual — the same one that already produced the 10 pinned files in `INHERITED.json`:

```
1. canonical source  -> copy the working Admin tool to delivery-os/templates/tools/<tool>.mjs
                        (single-authored, the ONE home; delete the Admin original after vendoring)
2. manifest binding  -> add "templates/tools/<tool>.mjs" to os-foundation.manifest.json tools[]
3. vendor            -> `os-inherit sync` writes .claude/os/tools/<tool>.mjs into each project
4. sha-pin           -> the sync stamps {rel, sha256} into that project's .claude/os/INHERITED.json
5. flip the header   -> change the tool's "NOT OS-owned / lives ONLY in Admin" banner to the
                        ALREADY-CANONICAL provenance banner; `os-inherit check` now guards it byte-current
```

**Pure/portable vs reads-project-local-data (decides tool-canonical vs data-per-project):**

| Class | Tools | Promotion shape |
|---|---|---|
| **Pure / portable** (no project-local read) | dispatch-route, dispatch-coverage, knowledge-route, capability-route/invoke/consume/registry, capability-ui, census-detector, file-lesson | **Tool fully canonical + vendored.** Clean promotion, all 5 steps. |
| **Tool-canonical, DATA-per-project** (the gate pattern — exactly like the 6 already-canonical gates, which read each project's own slices/contracts) | verify-gate, slice-close, ownership-policy (schema), execution-ledger, operating-model-check, telemetry ladder, outbox/drain pattern, manifest-standard | **Promote the TOOL/SCHEMA; the DATA stays per-project.** The vendored tool reads the host project's records; no project data travels. Established model — `seam-gate` is canonical yet reads Admin's own contract. |
| **os-SYNC not os-inherit** (agents) | the 18-agent roster (base + overlay) | **Different propagation path:** base agents via os-sync; project-specific agents stay overlay. Decide base-vs-overlay per agent; do NOT route agents through os-inherit. |

### B.1 Sequence by leverage x safety (lowest-risk, highest-value first)

| Wave | Item | Why this order | Risk |
|---|---|---|---|
| **W1** | **dispatch-route + dispatch-coverage** (+ knowledge-route, ownership-policy schema as companions it composes) | **RECOMMENDED FIRST.** Highest-leverage runner (composes all 4 routers — the orchestration spine); pure/portable; a byte-identical copy is ALREADY at `templates/tools/` so step 1 is half-done — promotion = finish binding + pin + header-flip. Lowest risk: no behavior change, only provenance. | LOW |
| **W2** | the remaining pure capability-* tools (registry/route/invoke/consume/ui) + census-detector + file-lesson | Pure/portable; completes the lesson->capability loop's executable hops. No data travels. | LOW |
| **W3** | tool-canonical/data-per-project: verify-gate, slice-close, execution-ledger, operating-model-check, manifest-standard, outbox/drain pattern | Proven gate pattern (data stays local); medium care because each reads project records. | LOW-MED |
| **W4** | FRAGMENTED standardizations (secC) THEN promote: deploy-debt binding, emitters->`emit()`, catalog-comment fix, health aggregator, agent base/overlay | Standardize before promoting — never promote a fragmented pattern. | MED |
| **W5** | GAP builds, gated: promotion-enforcement gates (report-only on Admin's 11 caps first), event lifecycle, in-flight observability | New builds; admin-first-proof; report->enforce. | MED |
| **DEFER** | durable execution engine + auto-recovery | LARGE; build only when *unattended* multi-step is a real requirement (anchor sec5/sec9). | HIGH if built speculatively |

### B.2 Wave 1 recommendation (concrete)

**Promote `dispatch-route` (the orchestration runner) — plus its inseparable companions `dispatch-coverage`,
`knowledge-route`, and the `ownership-policy` schema it composes.** Rationale:

- **Highest leverage:** dispatch-route is the single composer over agent-route + ownership-policy + skill-route
  + knowledge-route — promoting it makes the *entire* orchestration spine OS-owned in one move.
- **Highest safety:** thin composer with **zero new scorer** (its own header), and a **byte-identical copy
  already sits at `delivery-os/templates/tools/dispatch-route.mjs`** — so this is finishing a half-done
  promotion (bind + pin + flip the self-contradicting header), not a port. No behavior changes.
- **It exposes the exact anti-pattern to kill:** the upstream copy still says *"NOT OS-owned ... no delivery-os
  upstream"* while physically sitting in the upstream repo. **Copy-without-binding is not promotion.** Wave 1
  makes the mechanic honest and repeatable for every later wave.

---

## C. Standardization targets (unify fragmented patterns — do NOT rebuild)

### C.1 The 20 inline outbox emitters -> one `emit()` abstraction
**Evidence:** 20 hand-written `db.insert(outbox).values({...})` sites — 19 in `src/admin.ts`
(L55, 269, 363, 431, 443, 456, 602, 657, 1035, 1088, 1138, 1270, 1476, 1633, 1766, 1852, 1859, 1868, 1894)
and 1 in `src/signing-public.ts:104`. (The anchor estimated "15"; the real count is 20.)
**Target:** one typed `emit(type, aggregate, payload)` helper validated against `events-v1.ts`, so a new event
type is added in ONE place and every emit is contract-checked. **Consolidation, not a rebuild** — the outbox
table, transactional semantics, and seam contract are untouched.

### C.2 The stale `events-v1.ts` CATALOG comment (exactly 3 missing types — confirmed)
**Evidence:** the prose CATALOG comment at `src/contracts/events-v1.ts:15-39` is missing **3 emitted types**:
`contract.created`, `contract.expiring`, `contract.signed` (all three ARE emitted in `src/`, none appear in the
comment). **Target:** reconcile to 0 drift. Best done WITH C.1 — once `emit()` is the one path, the catalog can
be derived from the emitter registry instead of a hand-maintained comment, so it cannot drift again.

### C.3 deploy-debt gate — canon exists but is unbound
`delivery-os/templates/tools/deploy-lane.mjs` is present upstream but absent from `os-foundation.manifest.json`
and Admin's `INHERITED.json`. **Target:** bind + pin (no code change) — FRAGMENTED -> ALREADY-CANONICAL via secB.0.

### C.4 Health framework — checks exist, aggregator missing
Individual checks exist (`mail-config-health.mjs`, `knowledge-health.mjs`, `skill-health.mjs`; plus upstream
`capability-health.mjs` + `agent-health.mjs`). `HEALTH-FRAMEWORK.md` records it *designed-not-built*
(`delivery-os/health/` does not exist). **Target:** standardize the check interface (common JSON shape), then
build the thin **aggregator** rolling all checks into one `health-snapshot` — reuse the existing
`delivery-os/capabilities/health-snapshot.json` shape (today it covers the 9 gates only). One small build.

### C.5 Half-done promotions (dispatch-route / knowledge-route copies)
Both carry the self-contradicting *"NOT OS-owned / lives ONLY in Admin"* header while a byte-identical file sits
upstream. **Target:** finish the promotion (bind + pin + flip header) — handled by Wave 1.

### C.6 Agent roster base/overlay
18 agents; only 2 (`integration-architect`, `founder-experience-reviewer`) are in the foundation manifest.
**Target:** classify each agent base (every project) vs overlay (project-specific); propagate base via os-sync.
No rebuild — a classification + sync wiring.

---

## D. Honest criteria mapping — the founder's 8 success criteria

| # | Criterion | Verdict | Why (evidence) |
|---|---|---|---|
| **#7** | DOS ownership established | **ACHIEVABLE NOW** (this plan) | 13 rows already canonical; 23 promotable via the proven secB.0 os-inherit ritual. Wave 1 (dispatch-route) starts it with zero behavior risk. |
| **#8** | No duplicate implementations | **PARTIAL — split by axis** | **Admin<->DOS axis: ACHIEVABLE** — finish the half-done promotions (secC.5), bind the canon copies, and the Admin-local/upstream duplication collapses. **PLOS/Rumah MIRRORED-contract axis: BLOCKED** — the contract is hand-copied into frozen/off-limits consumer repos; de-duplicating requires *editing those repos* (off-limits). Stated plainly: cannot close without unfreezing a consumer. |
| **#6** | Cross-project execution proven | **BLOCKED (founder decision)** | The N=1 master gate (a 2nd project with `INHERITED.json` + `os:check` PASS + a gate green) is structurally unmeetable while PLOS is frozen + Rumah off-limits (anchor sec6, sec8). Building the distribution mechanism is SMALL; *proving* it needs a 2nd consumer unfrozen — **a decision, not a build.** |
| **#1** | Workflow execution proven | **PROVEN IN-ADMIN (as discipline); engine DEFERRED** | The 9 gates + slice lifecycle run green today (checkers, not a runner). *Unattended* multi-step execution needs the durable engine (LARGE) — defer until it's a real requirement (anchor sec5). |
| **#2** | Event architecture proven | **PROVEN IN-ADMIN** | Transactional outbox + cursor drain + executable seam contract are live and solid (anchor sec4). Hardening (lifecycle/ack) is a SMALL gap worth doing once a 2nd consumer exists. |
| **#3** | Multi-agent coordination proven | **PROVEN IN-ADMIN** | dispatch-route composes 4 routers + ownership-policy; 18-agent roster; measured by operating-model-check + dispatch-coverage. (Caveat: 2 idle specialists + 2 RED ownership areas — operating-model maturity, not a missing capability.) |
| **#4** | State management proven | **PARTIAL — 2 of 7 states only** | Only `created->closed` + `pending->verified` persist. The full 7-state machine is the LARGE deferred build (Scope 5). Honest: state is *recorded*, not *managed as a live machine*. |
| **#5** | Recovery / resilience proven | **NOT PROVEN (preventive only)** | Gates are preventive; recovery is human (read stderr, fix, re-run; `--force` logged). Auto-retry/resume/escalation is the LARGE deferred build (Scope 6). Honest: resilience today = fail-closed prevention + tamper-detection, NOT operational recovery. |

**One-paragraph honest summary for the founder:** **#7 is achievable now** and is what this plan executes
(promotion via os-inherit, Wave 1 = dispatch-route). **#8 is half-achievable** — the Admin<->DOS duplication can
be cleaned; the PLOS/Rumah mirrored-contract duplication is **blocked behind off-limits repos**. **#6 is blocked
on a single founder decision** (unfreeze a 2nd consumer) — not engineering. Of #1-5: **#2 and #3 are proven
in-Admin today**, **#1 and #4 are partially proven** (the durable engine is the missing-but-deferred piece), and
**#5 is not proven** (recovery is manual by design). Per the anchor, the durable execution engine that would
fully satisfy #1/#4/#5 is the **largest** gap but the **lowest-priority** one; building it speculatively is the
biggest risk on the board.

---

## E. The shortest-path completion roadmap (waves)

Reuses the anchor sec9 order. **[SAFE-AUTONOMOUS]** = no founder gate, no cross-project, no behavior change.
**[FOUNDER-GATED]** = needs an explicit founder decision.

| Wave | Work | Gate |
|---|---|---|
| **W1** | Promote **dispatch-route + dispatch-coverage + knowledge-route + ownership-policy schema** (finish the half-done promotion: bind -> vendor -> pin -> flip header). Proves the secB.0 mechanic. | **[SAFE-AUTONOMOUS]** |
| **W2** | Promote the pure capability-* tools + census-detector + file-lesson (completes the executable lesson->capability loop's hops). | **[SAFE-AUTONOMOUS]** |
| **W3** | Promote the tool-canonical/data-per-project set (verify-gate, slice-close, execution-ledger, operating-model-check, manifest-standard, outbox/drain pattern). | **[SAFE-AUTONOMOUS]** |
| **W4** | Standardize the 5 FRAGMENTED targets (secC): emitters->`emit()` + catalog-comment fix, deploy-debt binding, health aggregator, agent base/overlay. THEN promote. | **[SAFE-AUTONOMOUS]** (all in-Admin) |
| **W5** | Build the **promotion-enforcement gates** (registration/reference/drift/PII) **report-only on Admin's 11 caps**, then flip to enforce once precision is proven (admin-first). Promote the canonical catalog as a vendored artifact. | **[SAFE-AUTONOMOUS]** (report-only); enforce-flip autonomous after precision proof |
| **W6** | Event lifecycle (retention/ack/`consumed_at`) + in-flight observability (extend execution-ledger live). | **[SAFE-AUTONOMOUS]** in-Admin; the lifecycle is only *worth* doing once a 2nd consumer exists |
| **W7** | **Prove ONE seam end-to-end cross-project** — a live consumer round-trip with `workflow-gate fullyProven:true`, satisfying the N=1 master gate (criteria #6 / #8-PLOS-axis). | **[FOUNDER-GATED]** — requires unfreezing a 2nd consumer |
| **DEFER** | Durable execution engine + auto-retry/resume/escalation (criteria #1/#4/#5 full satisfaction). | **[FOUNDER-GATED]** — build only when unattended multi-step execution is a stated requirement |

**Bottom line (from the anchor, now executable):** Waves 1-4 are pure, safe, autonomous promotion +
standardization of what already exists — they establish DOS ownership (#7) and clean the Admin<->DOS duplication
(#8, near axis) with **zero behavior risk**. Wave 5 builds the only NET-NEW spine worth building now (promotion
enforcement), proven admin-first. Everything actually BLOCKED (#6, the PLOS/Rumah duplication axis, the durable
engine) is blocked on **founder decisions**, not engineering — and should NOT be force-built.
**Start with Wave 1: dispatch-route.**

---

> **Status:** DRAFT, lead-architect. NOT self-certified. An independent verifier must confirm: (a) no row
> proposes new architecture (promotion/hardening only), (b) the counts reconcile to the rows, (c) the
> file:line evidence is real, (d) nothing here forks the os-inherit propagation path or creates a third
> lifecycle list. **Built != Adopted:** this ledger is "adopted" only when Wave 1 lands (dispatch-route bound
> + pinned + header-flipped, `os-inherit check` GREEN) — not because this doc exists.
