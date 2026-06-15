# V6 End-State Filesystem — board-recommended layout (2026-06-15)

> Destination-only (no roadmap/timing). The board's concrete physical structure for "single OS, apps consume it."

## The honest headline (adversarial seat — must be stated plainly)
**"Zero copies on disk" is physically impossible** if an app's fail-closed gates must run in CI: a gate is code, code must be present to execute, so every mechanism (submodule checkout / npm `node_modules` / workspace symlink) materializes the OS bytes in each app. The achievable goal — and what the founder actually wants — is:

> **Single SOURCE of truth + ZERO HAND-MAINTAINED copies + drift-checked.** The OS is authored ONCE in `C:\rumah\delivery-os`; each app carries a mechanically-generated, checksum-verified PROJECTION (`.claude/os/`) that no human edits and that fail-closes if it diverges. The *intelligence* lives once; the *bytes* are projected. That is "no duplicated learning" — not "no bytes on disk."

## 1. Where Delivery-OS lives — `C:\rumah\delivery-os` (its own git repo, the single source)
```
C:\rumah\
├── delivery-os\          ← THE single source of truth (one repo = one brain)
├── rumah-admin\          ← app (carries a drift-locked projection)
├── property-lead-os\     ← app
├── content-os\           ← app (future)
└── ecosystem-architecture\  ← portfolio facts (separate concern; not the OS)
```

## 2. Delivery-OS internal layout (the brain)
```
C:\rumah\delivery-os\
├── VERSION  CLAUDE.md  CODEOWNERS  CHANGELOG\
├── manifest\            os-foundation.manifest.json · manifest.schema.json   (the inheritance set)
├── agents\             base\ · overlay\ · domain\        (roles; base+overlay split preserved)
├── skills\             <skill>/SKILL.md · platform\ · _archive\   (earned procedures)
├── capabilities\       CAPABILITY-LEDGER · LIFECYCLE · AUTO-EXEC-CRITERIA · SKILL-PROOF-ARCH · signals.jsonl
├── governance\         GOVERNANCE · DEFINITION-OF-DONE · OPERATING-LOOP · SEVERITY
├── operating-principles\  PRINCIPLES.md (A2 fail-closed, A4 read-canonical-first, Waterline…)
├── learning\           LEARNING-LOOP · promotion-gate.md (≥2-app reuse) · census\
├── lessons\            _inbox\ (app-submitted, unpromoted) · promoted\ (passed the gate)
├── wiki\               reusable cross-app knowledge pages (proven ≥2-app)
├── reviews\            principle-11\ · readiness\ · decision-reviews\ (OS-level)
├── trust\              TRUST-MODEL.md          adoption\   ADOPTION-MODEL.md
├── telemetry\          aggregated cross-app signals (derived only)
├── routing\            ROUTING-MODEL.md · kernel.tmpl.md (renders app CLAUDE.md sections)
├── autonomy\           AUTONOMY-MODEL.md       founder-experience\  FOUNDER-READY-GATE · founder-burden\
├── knowledge-graph\    GRAPH-MODEL.md · graph.json (lesson↔skill↔capability↔agent)
├── contracts\          admin-plos-seam-v1.mjs (executable cross-system seams)
├── tools\              gates\ · health\ · route\ · inherit\ · learning\ · deploy\   (the .mjs — was templates/tools)
│                       (inherit\ adds: foundation-digest.mjs + multi-consumer-xcheck.mjs — NEW)
├── templates\          app-skeleton\ · CLAUDE.md.tmpl · githooks\ · commands\ (scaffolding copied ONCE at init)
└── docs\               END-STATE-ARCHITECTURE · END-STATE-FILESYSTEM · V6-* · archive\
```

## 3. Application tree (Admin / PLOS / Content-OS — same skeleton, different domain nouns)
```
C:\rumah\rumah-admin\
├── CLAUDE.md            ← THIN manifest (§7 below)
├── package.json  tsconfig.json  CODEOWNERS
├── src\                domain code (Admin: invoices/tenants/owners/contracts/signatures)
├── tests\  migrations\  scripts\
├── workflows\          ← NEW: the founder's end-to-end workflows (invoicing run, signing re-send)
├── admin-ui\           domain SPA
├── docs\               PROJECT-BRIEF/MISSION/NORTH-STAR · adr\ · decision-reviews\ · verify\ · migration\ · slices\
└── .claude\
    ├── os\             ← DERIVED PROJECTION of the OS (drift-locked, NEVER hand-edited; runtime never reads it beyond execute)
    │   ├── INHERITED.json   (osVersion pin + foundation-digest + per-file sha256)
    │   ├── agents\ · skills\ · tools\ · contracts\   (the inherited subset, byte-current)
    │   └── telemetry\       (raw per-app stream → flows UP to OS telemetry\)
    ├── agents\         app-AUTHORED overlays only (often empty)
    ├── skills\         app-AUTHORED, not-yet-promoted domain skills only
    └── hooks\          app-local hooks that call .claude/os/tools/*
```
**GONE from each app:** any `.delivery-os/` flattened brain copy (the anti-pattern); hand-maintained CLAUDE.md §4/§5/§6/§8/§9; OS tools authored app-side.

## 4. Reference mechanism — board DECISION (honest split resolved on deployment reality)
The integration seat recommended **git submodule** (exact-sha pin); the adversarial seat **rejected it for THIS stack**: Vercel build sandboxes do NOT fetch submodules, and submodule auth/Windows is a solo-founder foot-gun; monorepo is rejected too (silent fan-out + lock-in vs the "avoid lock-in" invariant). **Decision: keep the `os-inherit` vendor+SHA model, elevated to full scale** — it is the only mechanism that runs **self-contained on Vercel/GitHub CI with no submodule-fetch, no registry, no symlinks**, and its one virtue gap (exact pin) is already delivered by `INHERITED.json`'s SHA manifest.
- **Single source:** canonical lives ONLY in `C:\rumah\delivery-os`. The app's `.claude/os/` is a SHA-verified projection, never an authority.
- **Local dev:** apps resolve the sibling `..\delivery-os` (the founder already has it).
- **If a named artifact is ever required:** publish the OS as an **exact-pinned** npm package consumed via lockfile (npm becomes the os-inherit transport). NEVER a `^`/`~` range (silent fan-out). Monorepo and branch-tracking submodule are rejected.

## 5–6. What stays in the app vs moves to the OS (ownership boundary)
| Concern | APPLICATION owns | DELIVERY-OS owns |
|---|---|---|
| Code/UI/tests/migrations/workflows | ✓ (domain) | tools' self-tests; test-harness template |
| Contracts | the types it PRODUCES (`src/contracts`) | the executable seam contract (vendored to apps) |
| Agents | app-authored overlays only | all definitions + base/overlay split |
| Skills | not-yet-promoted domain skills | all earned/reusable skills |
| Governance / operating-principles | app CODEOWNERS | the doctrine + rules |
| Lessons / wiki | raw at point-of-learning | promoted reusable lessons + wiki pages |
| Capabilities / trust / adoption / routing / autonomy / knowledge-graph | consumes + emits telemetry | the models + ledgers |
| Telemetry | raw per-app stream | aggregated cross-app |
| Founder-experience | runs the gate | the gate + methodology |
| Tools (.mjs) | EXECUTES vendored copies | AUTHORS them |
| Business truth / ADRs / decisions / evidence | ✓ | OS-level decision reviews only |
| Version pin | `.claude/os/INHERITED.json` | `VERSION` + `manifest\` |
Rule: *strip the domain nouns; if it still teaches a second app → OS; the noun-bound remainder stays app-side.* Default tie-breaker: **promote AND preserve** (LOST=0).

## 7. What remains in CLAUDE.md (thin manifest, ~1 screen; size-budget gated)
Identity · Mission · North-Star+invariants (domain, trimmed) · **OS-loader block** (OS_ROOT=`C:\rumah\delivery-os` + pinned osVersion + foundation-digest + vendored-mirror path) · "what-to-load by reference to the manifest@pin" · application manifest (domain surface) · agent entry point ("ask the OS") · **Active-Now** (the only substantive inline content). §4/§5/§6/§8/§9 are RENDERED from the OS, not hand-listed.

## 8–10. Reference · upgrade · dedup
- **Reference:** `OS_ROOT` + pin in CLAUDE.md; `.claude/os/` = the SHA-verified projection.
- **Upgrade propagation:** `os-inherit sync --from <OS_ROOT> --into .` → updates the projection + `INHERITED.json` in ONE reviewable, per-app, deliberate commit. Rollback = `git revert` that commit. No app moves until it runs the step (blast-radius isolated).
- **Dedup/anti-fork:** `os-inherit check` fail-closes on any byte drift between projection and canonical + the foundation-digest cross-check. **Real gap to close: `os:check` is currently NOT in CI** (drift caught only at pre-push) — add it so a hand-edited projection can't pass CI.

## 11. Historical v5/v6 preservation during migration
Promote-AND-preserve → Knowledge-Lost=0 (audit table: Artifact·Before·Migrated·Archived·Lost; LOST=0 gate). Preserve as first-class payload: earned-from provenance, git history, per-app trust telemetry. Precedent: `PLOS-V6-MIGRATION-AUDIT.md`. Adversarially verified, not self-attested.

## 12. Physical organization of skills/wiki/agents/governance/trust — see §2 (each is a top-level OS folder).

## 13. When the OS upgrades, what changes inside an app
**Only:** the projection bytes under `.claude/os/` + `INHERITED.json` (pin+digest) — regenerated by `os-inherit sync`, like a lockfile. Domain code untouched. The human decision is one line: the new pin.

## 14. Brand-new app, near-zero setup
```
copy the templates\app-skeleton\ tree  (src/tests/migrations/workflows/CLAUDE.md.tmpl)
node ..\delivery-os\tools\inherit\os-inherit.mjs sync --from ..\delivery-os --into .
node ..\delivery-os\tools\route\os-sync.mjs            # agents base+overlay
```
+ one-line CLAUDE.md OS-loader block (OS_ROOT + pin). The app now inherits every manifest-listed gate/contract/skill/agent at a pinned, drift-gated version, and runs green self-contained.

## Hard precondition (unchanged): N≥2 proof before cutover
This is the target layout. Physically moving Admin's brain into `C:\rumah\delivery-os` waits until a SECOND app (PLOS) inherits the core + runs green + one capability is demonstrably reused (can't validate "reused everywhere" at N=1).

---

## CLARIFICATION — `.claude/os` is a runtime projection, NEVER a second brain (2026-06-15)
**Rule 0: NOTHING in `.claude/os` is a source of truth. Ever. The source of truth is always `delivery-os`.**
`.claude/os` contains ONLY the EXECUTABLE bytes an app's CI must run self-contained, the pin receipt, and the app's own emitted telemetry. The KNOWLEDGE/DOCTRINE (the bulk of a mature brain) is NEVER projected — it lives only in `delivery-os` and is consulted from `OS_ROOT` during agent-work (where the OS is mounted), never needed by app CI.

### Per-category classification
| Category | In `.claude/os`? | Classification | Source of truth |
|---|---|---|---|
| agents | base = **read-only projection** (`.claude/os/agents/`); app overlay = **local app-owned** (`.claude/agents/`, NOT under os/) | 2 + 4 | delivery-os/agents |
| skills | only the INHERITED SUBSET the CI validates = **read-only projection**; not-yet-promoted = **local** (`.claude/skills/`) | 2 + 4 | delivery-os/skills |
| wiki | **NOT projected** — OS-only, consulted from OS_ROOT on demand | — | delivery-os/wiki |
| lessons | **NOT projected** — OS-only (promoted); app EMITS raw lessons UP via telemetry/signals | — | delivery-os/lessons |
| governance | DOCS **NOT projected** (OS-only); the enforcing TOOLS = projection (`tools/`) | 2 (tools only) | delivery-os/governance |
| trust | **NOT projected** — model OS-only; scores runtime-computed in OS | — | delivery-os/trust |
| adoption | **NOT projected** — model OS-only | — | delivery-os/adoption |
| routing | router TOOLS = projection (`tools/`); the MODEL OS-only | 2 (tools only) | delivery-os/routing |
| telemetry | YES (`.claude/os/telemetry/`) = **runtime-generated cache + app-emitted local** (gitignored); flows UP | 3 + 4 | the app emits; OS aggregates |
| capabilities | LEDGER **NOT projected** (OS-only); the executable gates = projection (`tools/`) | 2 (tools only) | delivery-os/capabilities |
| operating-principles | **NOT projected** — OS-only doctrine | — | delivery-os/operating-principles |

### The four buckets (where each thing lives)
- **(1) Source of truth — ONLY `delivery-os`** (all categories). Never `.claude/os`.
- **(2) Read-only projection — `.claude/os/`** = `tools/` (gates/routers/health/frontmatter) + `contracts/` + `skills/` (inherited subset) + `agents/` (base merge) + `INHERITED.json` (pin+digest+sha256). Drift-locked, never hand-edited; `os-inherit check` fail-closes on any byte change.
- **(3) Runtime-generated cache — `.claude/os/telemetry/`** = the app's emitted selection/usage signals (gitignored); the only thing the app WRITES under `os/`; flows UP to OS aggregated telemetry.
- **(4) Local application-owned data — NOT under `.claude/os/`** = `.claude/agents/` (app overlays) + `.claude/skills/` (not-yet-promoted) + `docs/` (domain). These flow UP via the promotion gate.

### Exact expected structure of `admin/.claude/os`
```
admin/.claude/os/
├── INHERITED.json        # (2) pin receipt: osVersion + foundation-digest + per-file sha256
├── tools/                # (2) the executable .mjs the app's CI runs self-contained (gates/routers/health)
├── contracts/            # (2) vendored seam contract(s) the app produces/consumes against
├── skills/               # (2) ONLY the inherited subset the app's skills:check validates
├── agents/               # (2) the base+overlay MERGE result (os-sync output) — read-only
└── telemetry/            # (3)+(4) app-emitted signals, GITIGNORED, runtime-only, flows UP
```
NOT present (lives only in delivery-os): wiki, lessons, governance docs, operating-principles, capability ledger, trust/adoption/routing/autonomy MODELS, reviews, learning, knowledge-graph.

### The verifiable invariant (so we can confirm alignment over time)
Today (measured): `.claude/os` = **116K / 12 files ≈ 6%** of `delivery-os` (**1.9M / 252 files**). **`.claude/os` size is bounded by what the app EXECUTES, decoupled from total OS KNOWLEDGE.** As the brain grows 10× (more wiki/lessons/skills/knowledge-graph — the knowledge bulk), `.claude/os` stays roughly FLAT (only the executable tool subset + the handful of skills the app actually uses). **If `.claude/os` ever grows proportionally with `delivery-os`, that is the alarm that it is becoming a second brain.**
**Proposed fail-closed gate (`projection-shape-check`):** `.claude/os` may contain ONLY {INHERITED.json, tools/, contracts/, skills/, agents/, telemetry/}; if a KNOWLEDGE category (wiki/lessons/governance-docs/principles/ledger/models/knowledge-graph) ever appears under `.claude/os/`, fail closed. This mechanically prevents the second-brain.
