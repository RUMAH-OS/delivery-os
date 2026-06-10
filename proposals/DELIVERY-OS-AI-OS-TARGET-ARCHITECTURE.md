# Delivery OS → AI Operating System: Target Architecture (Step 2)

> Principle-11 DESIGN review producing the target architecture, against the binding reference `proposals/reference/AI-OS-REFERENCE-MODEL.md` (the "Four C's": Context→Connections→Capabilities→Cadence; CLAUDE.md = kernel). Foundational assumption held: **CLAUDE.md is the kernel** — burden of proof on every deviation. 4 blind design lenses (Kernel/Four-C · Mechanism/Policy/Permission · Skill/Cadence · Knowledge/Consumption/Propagation), grounded in the real corpus. Date 2026-06-10. Branch `review/ai-os-hierarchy-alignment`. **For founder ratification (sequence step 2). Nothing implemented — step 3 is "dogfood it," post-ratification.**

## The blank-repo answer (asked first, because it frames everything)
> *"If we started from a blank repository today, would we build the current Delivery OS structure?"*

**No.** We would build a **kernel-first, Four-C operating system**, not a governance-spine framework with a router bolted on. Concretely, three things would be structurally different from day one:
1. **The kernel would be load-bearing and derived-from-disk** — not a hand-maintained doc that can (and does) lie. Today you can delete `CLAUDE.md` and nothing breaks; in the target, deleting/contradicting it fails the gate closed.
2. **Governance would be split into a thin non-swappable *mechanism* substrate + a large swappable *policy* capability** — not one monolithic `core/` floor that makes governance read as "the OS."
3. **Consumers would *mount* the OS (pinned tagged submodule, generated `.claude/`+router)** — not hand-copy stale snapshots that drift and over-claim.

**But this is reorganize-not-restart: ~80% of the content is preserved and elevated.** The delivery spine becomes the policy plane + the mechanism substrate; the knowledge corpus becomes the populated wiki; the skills become load-bearing capabilities; nothing earned is discarded. We would build a *different shape from the same material.*

---

## Deliverable 1 — Target AI-OS Architecture (the structure)
The Four C's become the organizing frame; CLAUDE.md is the kernel at the root; each C has one top-level home it points to.

```
<project|framework>/
├── CLAUDE.md                 # ▓ THE KERNEL ▓  loaded first · load-bearing · syscall surface + process table
├── .os/                      # the kernel's machine layer (what makes the kernel honest)
│   ├── state.json            #   DERIVED process table: verify_status · open gates · active slice · drift flag
│   ├── manifest.json         #   the OS version/tag this project MOUNTS (consume-provenance)
│   └── (hooks wired via .claude/settings.json → the mechanism substrate)
│   ── C1 CONTEXT (second brain · static understanding) ──
├── wiki/                     # homeless project-local understanding (the 8 clusters); _index.md = master index
├── docs/                     # owned business truth + ADRs (kernel POINTS; records stay with owner)
│   ── C2 CONNECTIONS (second brain · live data) ── NEW; Delivery OS has none today
├── connections/              # registry of live sources: CLI/API · scoped read-key · owner (NO secrets)
│   ── C3 CAPABILITIES (skills · agents) ──
├── .claude/
│   ├── skills/<name>/SKILL.md #   callable verbs (generated from the mounted OS, not retyped)
│   ├── agents/<name>.md       #   lenses/personas (CODEOWNERS-bound)
│   └── settings.json          #   wires the mechanism hooks (verify-gate / skill-gate / status-deriver)
│   ── C4 CADENCE (earned automation) ──
├── cadence/                  # registered automations: trigger {manual|event|schedule} · owner · autonomy tier
├── CODEOWNERS                # generated; author≠verifier as a write-key
└── delivery-os/  (mounted)   # the OS itself, pinned tagged submodule — consumed, not copied
```
- **Ordering reconciliation:** the reference's "starts with a default, not architecture" + "second-brain-first" do **not** conflict with Delivery OS's discovery-first onboarding — discovery-interview *is* the behavioral default that first writes the second brain (it emits BRIEF/MISSION/NORTH-STAR). Discovery-first wins; what dies is the *hand-narrated* state in §9.
- **Empty-but-present** Connections/Cadence sections cost nothing (render from empty `_index.md`) and their absence is exactly why the adversarial review scored "Connections = the missing layer."

## Deliverable 2 — Kernel definition
`CLAUDE.md` is a kernel (not a doc) iff it has all four properties, each kept honest mechanically:
| Property | Made true by |
|---|---|
| **Loaded first** | structural (the harness reads it first) — already true |
| **Load-bearing** | the verify-gate reads `.os/state.json`; a kernel↔disk **drift fails the gate closed** → the kernel can no longer be deleted "without consequence" |
| **Syscall surface** (what's callable) | §5 Skills + §6 Agents **rendered from `.claude/` scan** — can't advertise a syscall it can't dispatch |
| **Process table** (current state) | §9 Active-Now **rendered from `.os/state.json`**, written by the status-deriver hook |

**The inversion:** today the hook is load-bearing and the kernel decorative. In the target, **the hook writes the kernel's state, and the kernel's state arms the hook** — neither is decorative. The status-deriver reuses the verify-gate's *existing* truth computation (`freshPassArtifact()` already reads `verify_status`); today it discards that result, in the target it persists it to `.os/state.json` and the kernel renders it.

## Deliverable 3 — CLAUDE.md responsibilities (the canonical contract)
**The governing rule: a kernel line is hand-maintained iff it is INTENT; derived iff it is STATE.** This keeps the reference's "hand-maintained router" simplicity exactly where it's safe and removes hand-maintenance precisely from the sections that lied.

| § | Section | Zone | Points to |
|---|---|---|---|
| 0 | Kernel banner (first-file · POINTS-never-RESTATES · OS tag) | HAND | `.os/manifest.json` |
| 1–3 | Identity · Mission · North-Star + Invariants | HAND (intent) | `docs/…`, `core/GOVERNANCE.md` |
| 4 | Context/Knowledge (wiki path · hot cache · master index · how to search) | HAND ptr → DERIVED index | `wiki/_index.md` |
| 5 | **Skills** (syscall surface) | **DERIVED** | `.claude/skills/` |
| 6 | **Agents** (syscall surface) | **DERIVED** | `.claude/agents/`, `core/OPERATING-LOOP.md` |
| 7 | Worlds (my consume/expose edges) | HAND edges | `../ecosystem-architecture/` |
| 8 | Sources of Truth (governance is *pointed to*, not the front door) | HAND | `docs/`, `core/`, ECRs |
| 9 | **Active Now** (process table: active slice · verify_status · open gates · last review) | **DERIVED** | `.os/state.json` |
| 10 | **Connections** (live sources · scoped-key contract · NO secrets) | **DERIVED** | `connections/_index.md` |
| 11 | **Cadence** (registered automations · trigger · owner · autonomy tier) | **DERIVED** | `cadence/_index.md` |

- **Keys:** the kernel **names the doors with their scope, never holds the keys** (secrets live in the key-store). "Permission = keys, not prompts."
- **Other entrypoints justified-or-eliminated:** only the *bootloader* (`new-project.sh`) legitimately precedes the kernel (it writes it), and only the *enforcement mechanism* (hooks) legitimately sits below it (it must fire without consent) — both are *reachable/exposed from* the kernel. Governance's `core/` stops being a front door; the kernel §3/§8 point to it.

## Deliverable 4 — Mechanism vs Policy split (the hard line)
**Unifying axis: mechanism = key; policy = prompt.** A *prompt* is consent-based, swappable, silent-on-failure → it can only ever be policy. Anything that must hold under "if it can, it will" must be a mechanism. An element is a **KERNEL MECHANISM** only if it is substrate-level **and** non-swappable **and** fires-without-consent **and** fails-closed.

| KERNEL MECHANISM (thin, non-swappable) | GOVERNANCE POLICY (large, versioned, swappable) |
|---|---|
| verify-gate hook · git substrate (no-git⇒no-build) · committed `pre-push` · derived-`verify_status` engine · **key/capability-scoping** · author≠verifier *structural write-binding* · the logged bypass | decision-classes · required-lens panels · domain packs · the waterline · operating doctrine (§1/§2/§5/§7/§9/§10) · reusable prompts |
| *enforcement halves* of §6 (no key in any build agent's set) · §11 (*that* a review artifact is required) · CODEOWNERS (the git-enforced binding) · DoD rows 3/4a/9 | *content halves* of those: *which* actions are irreversible · *which* decisions are consequential · *which* paths→roles · the reviewer/docs/status checklist rows |

**This corrects the actual flaw:** today `core/` bundles both planes into one floor, so governance reads as the OS. Split, **the kernel is thin and non-swappable; the policy plane is large and swappable** — i.e. "a thin enforcement substrate runs a large governance capability," which is the AI-OS axiom satisfied for ~80% of governance and defensibly overridden only for the thin mechanism floor.

**The permission model ("keys not prompts" mechanized):** a **Capability Manifest** — each agent/role holds a scoped, default-deny, least-privilege set of tools/keys (sourced from the existing `preflight-credentials-and-env.md` names+scopes table, realized in `.claude/settings.json`). Danger is removed by **deleting the key, never adding a warning**. **author≠verifier becomes a write-key** (the verifier's write-scope excludes `src/`). §6 irreversible actions have **no key in any build agent's set** — the human merge gate releases them. It composes with the verify-gate orthogonally: **key-scoping gates ACTION (pre-act); verify-gate gates COMPLETION (post-build)** → a fail-closed envelope around every slice.

**The self-verify ↔ independent-verify escalation (the key tension, resolved):** the reference's self-verify (70→92%, personas) is the **floor**; Delivery OS's independent verification is the **ceiling**; they are one ladder, not a contradiction. The bridge is continuous: **persona → debating sub-agent → independent verifier with a disjoint write-key.** Escalation is **triggered mechanically by what the slice touches, ratchets up, and cannot be self-demoted:**
| Slice surface | Tier | Fired by |
|---|---|---|
| no impl files (discovery/docs/spike) | self-verify (lightweight, no artifact) | verify-gate exempt |
| any impl files (`src app lib api migrations db`) | independent verify — fresh `VERIFY-<slice>.md`, author≠verifier | verify-gate blocks |
| consequential decision (arch/migration/release/security/data) | + §11 blind panel — require a `DECISION-REVIEW-*` artifact | skill-gate (Deliverable 6) |
| irreversible capability (send/charge/publish/delete/prod-migrate) | + human merge gate; **key absent from all build agents** | key-scoping |
The "it's just scaffolding" demotion is itself author≠verifier-gated (the Slice-1.0 failure was exactly a data+migrations slice mis-self-classified). **Defensible deviations from the reference: exactly two** — (a) independent-verify for high-stakes surfaces, (b) a non-swappable fail-closed substrate at kernel level — both *bounded* to the thin floor + high-stakes surfaces. On "keys not prompts" and "earn cadence" there is **no** deviation — Delivery OS adopts them wholesale and uses the latter to *justify* the former.

## Deliverable 5 — Consumption model: OS → consume → inherit
Replaces the current "framework → copy → diverge" (three different broken modes on disk today: delivery-os has no `.claude/`; PLOS re-implemented with `qa-tester`≠`qa-test` voiding CODEOWNERS; rumah-admin carries a flattened gitignored stale-v2 copy + a hand-typed router that advertises absent skills/agents).
- **Pin the framework as a tagged submodule** (read-only; editing inside = fork). **GENERATE** `.claude/` + CODEOWNERS + router from the pinned OS — never hand-type or flatten-copy → the rumah-admin lie and the PLOS name-mismatch become impossible by construction.
- **Mount sibling *worlds* for read-reach** (the agent `cd`s into PLOS to read the Spine schema) — the reference's "other worlds" benefit, preserved as kernel §7 pointers.
- **The rule: mount the worlds, pin the OS.** Mono-mount is right for a solo creator; a production-grade, independently-versioned portfolio (Rumah Admin is *live* with signatures/invoicing) requires framework-as-pinned-dependency so a fix lands **deliberately at a version boundary**, never silently into production.
- **Fork-drift = build error:** router names a skill/agent absent from `.claude/` · agent name ≠ CODEOWNERS handle · vendored OS ≠ pinned tag → failed build. The router and CODEOWNERS are **derived artifacts that cannot lie.**

## Deliverable 6 — Skill model
**Why only 1/7 is load-bearing (0/7 in consumers):** dispatch-by-description = model discretion; no trigger binding to the event each skill names; no dependability check (nothing can REQUIRE a skill ran); static (no point-of-use capture). Only verify-gate has a hook.
**The first-class contract (4 clauses):** (1) stable versioned name; (2) a `trigger:` block with a **disk-observable** `detect:` predicate + `mode: require|suggest|manual` — generalizing the verify-gate hook into one **`skill-gate.mjs`** dispatcher; (3) for `require`, an `artifact:` the hook **fail-closes** on (freshness + frontmatter predicate = `freshPassArtifact()` made declarative) — dependability **without a registry/resolver** (Waterline-deferred); (4) a `FEEDBACK.md` capture path.
**Improvement loop reconciled with "no self-tuning":** split **CAPTURE** (every use → append-only observation, mechanical) from **APPLY** (the existing human-gated retro that bumps the version). Capture never touches the ruler; only the human moves it → "update the skill every use" and "author≠verifier / skills never self-tune" are **both** true.
**Per-skill target (honest target = 5 fired/suggested + 2 manual-by-design, NOT "7 mechanical"):**
| Skill | Target mode |
|---|---|
| verify-gate | require ✅ (the reference implementation) |
| principle-11-review | **require** (biggest 0→1 win: its success-criteria are already an artifact spec a hook can check) |
| production-readiness-review | **require** (a release is a disk/command-observable event) |
| ecosystem-alignment-review | suggest (escalates to require via the §11 edge) |
| migration-assessment | suggest (enforces rigor through its §11 edge) |
| discovery-interview | **manual-by-design** (auto-firing a live founder interview is a category error) |
| grill-me | manual-by-design (experimental; not yet earned) |

## Deliverable 7 — Knowledge model (the second brain = two first-class roots)
- **CONTEXT** (static understanding): the wiki of homeless knowledge + `docs/`/ecosystem pointers, typed by **8 corpus-validated clusters** (Domain-Intelligence [market+customer+corridor *fused*] · Dated-Findings [the biggest homeless category] · Decisions [ADR/ECR, stay with owners] · Build-Process/framework-learnings · Learnings/retros · Pre-registrations [frozen] · Design-specs [locked] · Work-specs [transient, excluded]). Retrieval surface = **wiki path · hot cache (`memory/MEMORY.md` = the WAL) · master index (`wiki/_index.md`)**.
- **CONNECTIONS** (live data — the layer Delivery OS entirely lacks): a **scoped-read-key registry** over Spine/Stripe/DB/comms via CLIs/APIs; reaches *records*, **never caches them into Context** (the records-vs-understanding rule forbids it); write-keys inherit the irreversible-action gate. This is what lets the OS answer "what's our occupancy / unpaid invoices right now" — the "stranger vs co-founder" gut-check needs both roots.
- **Records / finding / understanding is three-way, not binary** — the dated finding (quotes a record value as-of a date, append-only evidence) is the bridge object needing its own `kind`.
- **Frontmatter additions (each with a live specimen):** `kind` (8-value enum) · mandatory `as_of` on findings · `stability` + **`locked`/`frozen`** lifecycle states · fail-closed `confidentiality` · **`segment_scope` {epc·segment-agnostic}** (makes market-agnostic platform learnings extractable — the Waterline, and the future B2B-platform/Content-OS consumers, served by *frontmatter, not a folder or pipeline*).

## Deliverable 8 — Update-propagation model
- **Cut annotated tags** (`v3.0`,`v3.1`…) — the missing prerequisite (today `checkout <tag>` is impossible; "or copy" in the scaffolder is the drift door).
- **Consumers pin the tag; regenerate `.claude/`+router on bump at a milestone boundary** (never mid-slice — consistent with the context-hygiene pass).
- **"Am I behind?" is a mechanical signal** — a version-stamp vs latest tag, surfaced by the same router-vs-disk build check (`BEHIND v3.x`) — so a `core/` fix reaches consumers deliberately and visibly, never silently into the production invoicing system and never only "when the founder notices."
- **Mount-for-reach, pin-for-truth** — the reconciliation of the reference's mono-OS sync with this portfolio's production-grade, independently-versioned reality.

## Deliverable 9 — Migration strategy (reorganize, not restart)
Per the founder's sequence (step 3 onward), executed as a knowledge migration:
1. **Dogfood the framework first (step 3).** Stand up the real `delivery-os/.claude/` (install the hooks the framework ships), tag `v3.0`/`v3.1`, make the framework's own kernel load-bearing and derived. The OS must run the model before any consumer adopts it.
2. **Build the kernel machine-layer + skill-gate + Connections/Capability-Manifest** as ratified slices, each verified through the very gate they implement (dogfooding the escalation rule).
3. **PLOS compatibility review → PLOS adopts (steps 4–5).** Pin the OS submodule; generate `.claude/`+router+CODEOWNERS (fixing the `qa-tester` void); populate the wiki by `git mv` of homeless `docs/` narrative (provenance preserved via `--follow`; ADRs/ECRs/reviews stay with owners — only pointers move).
4. **Lessons flow back → ratify (steps 6–7).**
5. **Only then Rumah Admin (step 8)** — into git, mount the OS, the gate now live, Slice 1.0 to genuinely verified.
**Guardrails:** `git mv` not retype; atomic pointer-fixes; proposals/case-studies/changelogs append-only; honor the prior ratified rulings (POINTS-never-RESTATES, wiki-not-sovereign, no speculative scaffolding); **do not touch `core/` until §12 has caught a real turn.**

## Deliverable 10 — Corpus evidence (anchors)
Reference: `proposals/reference/AI-OS-REFERENCE-MODEL.md`. Keys-not-prompts proven in-corpus: `rumah-admin/docs/INVESTIGATION-production-findings.md` (IDOR, anon-key, role in user-editable metadata) + PLOS `the-floor.md` D2/D9 (no send tool; public-lane only). 8 clusters: PLOS `customer-intelligence.md` (fused domain-intel), `analysis/validation-review-2.2.1.md` (dated finding), `learning-review-preregistration.md` (frozen), `design/the-floor.md` (locked+supersession), `floor-friction-log.md` (learnings≠findings); `ecosystem-architecture/decisions/ECR-*` + `rumah-admin/docs/adr/*` (two decision tiers); `SECOND-SOURCE-REVIEW-plos.md` (bidirectional mis-filing). Consumption defects: disk state of all three repos. Mechanism/policy: `core/GOVERNANCE.md §1-12`, `templates/hooks/verify-gate.mjs`, `scripts/new-project.sh`.

## Disagreements we did NOT smooth (§11)
1. **Is `.os/state.json` + a status-deriver "speculative scaffolding"** (Waterline)? Kernel lens: 3 proven consumers (all 3 routers lied) → the burden is on *not* building it. **Held as the strongest seam** — the founder should rule.
2. **Connections/Cadence as first-class homes** — premature for a framework with zero live connections today? Resolution: *empty-but-present sections cost ~nothing and their absence is the documented gap.*
3. **Skill `FEEDBACK.md` capture on a `require`-run** — does a skill stamping its own feedback violate author≠verifier? Skill lens: evidence-not-ruler. **Flagged for the ratification panel to adjudicate.**
4. **require-mode chains** (§11→readiness→release) — need a resolver? Skill lens: single-edge artifact checks compose without a graph; resolver stays Waterline-deferred. Knowledge lens concurs.

## Recommended next step
This completes **step 2** (the target architecture). It is **not** ratified and **nothing is implemented**. Per your sequence, the next gate is your **ratification of this architecture**, then **step 3: Delivery OS dogfoods it** (the framework stands up its own real kernel + hooks + tags before any consumer adopts). Rumah Admin remains paused until step 8.
