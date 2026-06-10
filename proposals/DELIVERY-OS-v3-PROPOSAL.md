# Delivery OS v3 — Proposal (Principle-11 reviewed)

> **Status: DRAFT proposal for founder decision. Uncommitted — not pushed.** Produced via an independent Principle-11 design panel (5 lenses, blind to each other): Lead Architect · Reviewer/Critic · Knowledge/Data · Skills/Platform · Ecosystem/Integration. Full findings + dissents recorded inline. Date: 2026-06-10.
>
> Governance §11 applied to the review of §11's own framework. The panel **decides nothing** — this is for founder ratification.

---

# ★ REVISION 2 (2026-06-10) — Operability-first + Minimal Implementation

> Founder steering: **v3 is NOT a bigger governance framework — it makes Delivery OS *easier for Claude to operate inside* (lower cognitive load, better retrieval/routing/reuse). "Claude should not need to remember where things are."** Re-reviewed by a second blind Principle-11 panel (Architect · Reviewer/Critic · Skills/Platform · Knowledge/Ecosystem). This section **supersedes** the framing in §0–§8 below where they differ; §0–§8 remain as the detailed appendix.

## R2.1 The reframe + the cardinal rule

v3 is an **operability layer over v2's intact spine** — a *navigation kernel*, not new process. The whole design rests on one enforceable rule that reconciles "lean into the AI-OS model" with "no second source of truth":

> **POINTS, never RESTATES.** An *address* is a pointer with no payload (allowed, near-zero drift). A *duplicate* is a payload with no owner (forbidden — a Governance §7 defect). Every line in every v3 artifact must be classifiable as an **address** or a **fact-this-file-owns**; a line that *restates a fact another file owns* is rejected. The router/wiki/worlds-map **point**; `docs/` and `ecosystem-architecture/` **own**.
>
> Corollary: a duplicate is *more* to keep in sync — i.e. **more** cognitive load. So "points-never-restates" is not just §7 hygiene; it is the operability goal itself.

**Panel concession (Reviewer/Critic, who argued NARROW-FIRST in R1):** the router and skills are **earned now, not premature** — there is no `CLAUDE.md` in any of the five worlds today, so re-discovery cost is paid every session; the "second consumer" the Waterline asks for is *every future session*. Verdict: **APPROVE-WITH-GUARDRAILS.**

## R2.2 Delivery OS → Four-C (mnemonic; where v3 closes the gap)

| C | The operability question | Gap today | v3 closes it by |
|---|---|---|---|
| **Context** | Can Claude *find* the truth without remembering? | rich but **un-addressed**; market/customer knowledge **homeless** | router `## Sources of Truth` makes it addressable; `wiki/` houses the homeless narrative |
| **Connections** | Does Claude *explicitly* understand the 5 worlds? | relationships are **discovered accidentally** | router `## Worlds` = explicit edge declarations pointing to `ecosystem-architecture` |
| **Capabilities** | Can Claude *call* a procedure, or re-derive it? | best assets (interview, §11 panel, audits) are **inert prose** — the **weakest C** | promote to callable **Skills** |
| **Cadence** | Does the knowledge layer *stay* true? | strong task-cadence, **no knowledge write-back** → decay | one **Write-back** step in the loop |

## R2.3 The minimal implementation (what the founder asked to see)

**The whole operability layer = a router that points + skills that are callable + a thin home for homeless knowledge + a one-line write-back step.** Nothing that requires CI (rumah-admin has none — so CI-gated machinery would "fail silently," violating honest-failure; minimal is hand-maintained + reading-enforced).

### (a) `CLAUDE.md` — the router (9 questions → 9 sections; worlds are a SECTION, not a separate file → one entrypoint). Filled, real, for rumah-admin:

```markdown
# Rumah Admin — Router
> Delivery OS v3 router: the single entrypoint. It ANSWERS or POINTS, never restates.
> Canonical truth = docs/ (project) + ecosystem-architecture/ (portfolio). If this file
> disagrees with a canonical source, the canonical source WINS — fix this file.
> Last reconciled: 2026-06-10.

## 1. Identity
Rumah Admin — operational **execution engine** of the Rumah ecosystem (property·inventory·
availability·placements·contracts·signatures·invoicing). In PRODUCTION; under v2/v3 reassessment.
Stack: Vite/React SPA + one Supabase Edge Function + KV store. → docs/PROJECT-BRIEF.md

## 2. Mission
Make the **correct strategic decision** (Keep/Modernize/Partial/Full) — correctness over rebuild.
→ docs/PROJECT-MISSION.md   ·   Direction (7-lens convergence): **Partial migration / strangler.**

## 3. North Star
Single writer-of-record Property→Inventory→Availability→Placement→Contract→Signature→Invoice.
→ docs/NORTH-STAR.md   ·   Invariants: no data loss · keep operating · single writer-of-record ·
contracts+signatures never regress · stay extensible/owned · avoid lock-in.

## 4. Wiki  (project-local HOMELESS knowledge ONLY — narrative/learnings/ops; no records, no cross-project facts)
→ wiki/_index.md

## 5. Skills  (.claude/skills/ — callable; installed from delivery-os/skills/)
| Skill | Use when | Status |
|---|---|---|
| discovery-interview | founder discovery → BRIEF/MISSION/NORTH-STAR | stable |
| grill-me | adversarial follow-up to confidence thresholds | experimental |
| migration-assessment | read-only 7-audit + capability register | stable (ran 2026-06-10) |
| principle-11-review | independent multi-lens review of a consequential decision | stable (ran 2026-06-10) |
| production-readiness-review | pre-cutover go/no-go | stable |
| ecosystem-alignment-review | owns/consumes vs registry; ECR conflicts | stable |

## 6. Agents  (.claude/agents/ — lean default + packs)
software-engineer · qa-test · reviewer-critic · lead-architect · documentation
Packs: internal-admin · contracts-signatures · invoicing · security-compliance (+ db/security/api domain roles)
Loop: delivery-os/core/OPERATING-LOOP.md · Author≠verifier (CODEOWNERS) · consequential → run principle-11-review.

## 7. Worlds  (POINTERS only — ecosystem-architecture/ OWNS these facts; I declare only my own edges)
| World | Path | My edge |
|---|---|---|
| ecosystem-architecture | ../ecosystem-architecture/ | registered-in (portfolio truth; governs all) |
| Demand/CRM Spine (PLOS) | ../property-lead-os/ | I CONSUME Organisation/Contact/Lead (not integrated yet) — see 06 + ECR-0003 |
| Rumah Website | ../rumah-website/ | I EXPOSE read-only Inventory API (ECR-0002) — currently blocking it |
| delivery-os | ./delivery-os/ | I follow it (execution standard) |

## 8. Sources of Truth  (one home per concern — this router caches none of it)
| Concern | Canonical home |
|---|---|
| Business truth (what/mission/north-star/invariants) | docs/PROJECT-BRIEF·MISSION·NORTH-STAR.md |
| Owns/consumes, no-two-owner rule, glossary | ecosystem-architecture/06 · 10 |
| Cross-project decisions | ecosystem-architecture/decisions/ECR-0002, ECR-0003 |
| Migration assessment + capability register | docs/MIGRATION-ASSESSMENT.md · DECISION-REVIEW-2026-06-10-*.md |
| Production bugs (decoupled, do NOT block gate) | docs/INVESTIGATION-production-findings.md |

## 9. Active Now
**Phase: Discovery — GATE-READY, awaiting founder approval.** No roadmap/ADR/code until approved.
→ docs/DISCOVERY-GATE-CHECKLIST.md   ·   Blocking: (1) approve 3 docs (2) re-platform-now vs modernize-first (3) ecosystem registration.
```

~70 lines / <1k tokens, always-loaded, every answer ≤1 hop to a canonical file.

### (b) Skills — **6, not 8** (fold architecture-review + roadmap-review into `principle-11-review`, parameterized by decision-class). Reuse Claude Code's **native** skills mechanism (`.claude/skills/<name>/SKILL.md`, frontmatter `name`+`description` = the dispatch) — **no custom router, no registry, no resolver.** 4 of 6 are file-moves of existing prose (discovery-interview ← FOUNDER-INTERVIEW; migration-assessment ← the rumah-admin play; principle-11-review ← GOVERNANCE §11; ecosystem-alignment-review ← DISCOVERY §6). Versioning = a `version` + `stability` frontmatter field + an in-file `## Changelog`; improvement is **human-gated** (author≠verifier — a skill never self-tunes).

### (c) Wiki — thin home for **genuinely homeless** knowledge only. **Drop `decisions`/`glossary`/`projects`** (LOCKED duplicates of `ecosystem-architecture`). Earned, not scaffolded: only `_index.md` + `_pointers.md` exist at adoption; a page appears when write-back first needs it. Folders: `company/ market/ customers/ processes/ learnings/`. Every page carries `source_of_truth:` + `last_verified:` frontmatter. **`customers/` is playbook/narrative ONLY, keyed by the Spine `Organisation` ID — zero record fields (ECR-0003 LOCKED).** The rule "records vs understanding": records → system-of-record; *understanding* → wiki.

### (d) Knowledge-cadence — **one step in the existing loop**: `… Documentation → Status → ▸Write-back◂ → Continue`. `memory/` is the universal inbox (WAL, never authority); the write-back step routes each learning to its **single** durable home: project decision→ADR · cross-project decision→**ECR only** (never a project file) · homeless knowledge→`wiki/` · better technique→bump a **Skill** version · else→stays in memory. Freshness = visible `stability: stale` flag + a milestone context-hygiene pass (manual where no CI — honest, not hidden).

## R2.4 Complete minimal file manifest (~1–1.5 days, dominated by grill-me)

**Framework `delivery-os/`:** `skills/{discovery-interview,migration-assessment,principle-11-review,ecosystem-alignment-review}/SKILL.md` (MOVE) · `skills/{production-readiness-review,grill-me}/SKILL.md` (NEW; grill-me experimental) · `CLAUDE.md.template` (NEW) · `wiki/_index.md.template` (NEW) · `scripts/new-project.sh` (EDIT: copy skills→.claude/skills/, write router, scaffold wiki index).
**Project `rumah-admin/`:** `CLAUDE.md` (rewrite stub→router) · `.claude/skills/*` (install) · `wiki/_index.md` (+ pages as write-back lands them). `docs/`, `memory/` unchanged.
**Deliberately CUT from R1's maximalist design:** `sync-router.sh`+CI `--check`, freshness/link linters, a separate `ECOSYSTEM.md`/`WORLDS.md`, `wiki/_templates/` 7-folder scaffold, version resolver/registry, per-skill `CHANGELOG.md`, any multi-agent "alignment layer", Four-C folders.

## R2.5 The three guardrails (keep it operability, not governance)

1. **POINTS-NEVER-RESTATES** (R2.1). Enforced by reading discipline + `source_of_truth:` banners + the router's "canonical wins" header (CI linter *later*, when a project has CI).
2. **No wiki folder shadows a LOCKED registry; `wiki/customers` stores zero records** (ECR-0003 / `06`).
3. **Skills/§11 get *easier to invoke*, never *more-often required*; the router POINTS, never adjudicates** — it never pre-concludes or anchors the blind §11 lenses (preserves §11 independence).

## R2.6 The two surfaced disagreements (resolved)

- **Worlds: a SECTION of `CLAUDE.md` (Skills/Platform) vs a separate `ECOSYSTEM.md` (Architect, Knowledge/Ecosystem).** **Resolved → a section, for the minimal build** — once the CI machinery is cut there's no reason to split, and the founder wants *one entrypoint / low cognitive load*. Promote to a separate `ECOSYSTEM.md` only if it grows or once CI exists (then it gets linter-verified own-edges).
- **CI-generated router blocks + linters (Architect) vs hand-maintained + reading-enforced (Skills/Platform).** **Resolved → hand-maintained for minimal** (rumah-admin has no CI; a CI-gated check that can't run is dishonest-failure). The router is short, changes rarely, carries a visible "Last reconciled" date, and the write-back step keeps it current. Add the CI checks when CI exists.

## R2.7 Open decisions for the founder (unchanged, refined)
1. **Adopt R2's minimal operability layer** (router + 6 skills + thin wiki + write-back step)?
2. **Worlds as a section of `CLAUDE.md`** (recommended, minimal) — confirm, vs a separate `ECOSYSTEM.md`?
3. **Sequencing:** build v3-minimal **after** rumah-admin clears its Discovery Gate (recommended — v3 must not block the gate)?
4. On go-ahead, I implement v3-minimal on a **branch in `delivery-os/`** for review before any push; rumah-admin adopts its `CLAUDE.md`+skills at a milestone boundary.

---

# ★ REVISION 3 (2026-06-10) — Ecosystem & future-roadmap evaluation (Content OS leverage)

> Founder consideration: evaluate v3 **within the broader ecosystem + future roadmap**, not in isolation — including a likely future **Content OS** ("turn ecosystem execution into distribution": content extraction, knowledge-to-content, automated posting, avatar/voice). The AI-OS model appears optimized for *knowledge capture/retrieval/reuse/transformation*, not only software delivery; **strategic leverage for future projects is a POSITIVE signal, not out-of-scope.** Re-reviewed by a blind Principle-11 panel (Architect · Reviewer/Critic · Knowledge/Ecosystem · Skills/Platform).

## R3.1 Verdict: POSITIVE leverage — and it **ratifies** v3-minimal, it does not expand it

The founder's thesis is **architecturally correct**: v3's router + skills + wiki + write-back **is** a *knowledge-capture-and-transformation kernel* — which is the **upstream half** of a future Content OS. But the panel is unanimous: **the leverage is leverage-of-shape, not of built surface.** v3-minimal is *already ~90% the right substrate*, by accident of hygiene the design already requires for Governance §7 + operability (provenance frontmatter, stable IDs, single-home write-back, native skills). **Content OS is confirming evidence that the minimal shape is right and worth keeping clean — not a second consumer that has earned new platform.**

**The framing discipline (Reviewer/Critic):** "future leverage is a positive signal" is a license to *pre-think*, not to *pre-build*. It operates **inside the envelope** of the founder's prior steering ("minimal, not a bigger framework") — leverage is a tie-breaker among already-minimal options, never a reason to add a plane. Content OS is **Status-Future / Priority-Medium / not even in the registry** → by the Waterline Rule (`GOVERNANCE §8`) it is **not a pulling second consumer** and earns **zero** speculative build. (Contrast the router/skills, which *are* earned because "every future session" is a present, recurring pull.)

## R3.2 Capability mapping — consume the upstream, build the downstream

The decisive boundary already exists in `processes/ai-product-engineering.md §1`: **build-time procedures (skills) vs runtime product features.** Mapping Content OS's five capabilities:

| Content OS capability | Plane | Skill? | Governance |
|---|---|---|---|
| Content **extraction** (pipeline) | runtime service | No (a draft-only extraction *procedure* could be a thin skill) | grounding evals |
| **Knowledge→content** workflow | build-time *(the one skill-shaped sliver)* | Partial — **draft only** | agent drafts, human publishes (§6) |
| Automated **posting/publishing** | runtime + **hard human gate** | **No** | §6 + `ai-product §5` — "no unguarded post/publish tool"; §11 outward action |
| **Avatar** generation | runtime media pipeline | No | `ai-product §4/§6` |
| **Voice cloning** | runtime + consent/PII | No | §11 **security + data-sensitive**; §6 identity action |

**0 of 5 are clean reusable skills; 3 (post, avatar, voice) are irreversible/outward/identity → human-gated by §6 + §11.** So Content OS creates **no pressure to bloat the skills mechanism** with API-calling, file-owning, irreversible "skills." It **consumes** the upstream substrate (router/skills mechanism/wiki-as-corpus/write-back) and **builds** its downstream half (synthesis, distribution) on the **runtime plane** — for which `ai-product-engineering.md` *already exists*; **Content OS is the canonical consumer that process was written for.**

## R3.3 The consume pattern — read-only, like the Website reads Inventory (ECR-0002)

Content OS reads the knowledge layer **read-only**, resolving `source_of_truth:` so it never mistakes a pointer for a master, honoring `stability: stale` as *do-not-distribute*, and it **writes nothing back** into `wiki/`, `docs/`, or `ecosystem-architecture/`. Its only writes are to its **own** `Content/Asset` store. Three hard refusals (Knowledge/Ecosystem):
1. **No caching extracts back into the wiki** (a duplicate with no owner — §7 defect).
2. **No storing produced posts/assets in the wiki** — a content asset is a *record* with a lifecycle; `Content/Asset` is mastered **in Content OS** (its own §6 source-of-truth row when promoted). *records→system-of-record; understanding→wiki* — unchanged.
3. **Contract/Invoice are a hard no-extract zone** (sensitive, Admin-only — ECR-0003 §5). The content banner does **not** relax `wiki/customers` = zero-records.

## R3.4 Cheap-now affordances (the only design delta — all justified TODAY, none speculative)

Each passes the test: *would I add this unchanged even if Content OS never existed?* Yes — each is justified now by security/operability/clarity; Content OS merely makes the value obvious.

1. **`audience:` / `confidentiality:` tag** in wiki frontmatter + the write-back routing (one field). Justified **today** by ECR-0003 / `06:30` (sensitive data fail-closed) — makes the corpus *publish-safe-by-construction* and hard-protects the records/narrative boundary from ever leaking. *(The one genuinely new field.)*
2. **`author:` / `attributed_to:` + a stable page `id` slug** in wiki frontmatter (two fields). Attribution + dedup; owned facts → near-zero drift; also serve the existing freshness story.
3. **Write the wiki frontmatter schema down once** as a named ~5-line contract (`source_of_truth · last_verified · stability · author · id · audience`) — rigor, not scope; so a second consumer can rely on it.
4. **One sentence in the skill-authoring note** defining the skill-vs-runtime boundary: *a skill is a build-time procedure that owns no files and holds no outward/irreversible tool; runtime features (API calls, generation, send/post/publish/charge) live in the product under `ai-product-engineering.md`, human-gated per §6.* Prevents a future author cramming a `post-to-linkedin` skill into `.claude/skills/`.
5. **One sentence of design intent** in this proposal: the knowledge plane is intentionally a clean, ID-keyed, provenance-tagged corpus that future knowledge-products may **consume read-only** — so a later author doesn't "tidy away" the optionality.

These amend **R2.3(c)/(d)** (a few frontmatter fields + two doc sentences). The R2 build manifest is otherwise **unchanged**.

## R3.5 The lines NOT to cross in the name of Content OS (hard refusals)
- **No artifact whose only present consumer is Content OS** — no `content/`/`corpus/`/`distribution/` folder, no avatar/voice/posting/extraction scaffolding, no `publishable:`/distribution-status frontmatter, no media store. (`GOVERNANCE §8` + `OPERATING-LOOP:10`.)
- **No publish/post skill; no skill I/O-schema/resolver/registry; no content-skill template.** (Runtime + §6; and R2 already cut the resolver.)
- **The wiki does not re-inflate under a content banner; `customers` stays zero-records.** Pages are still earned by a *today* write-back, never by anticipated extraction.
- **v3's justification stays "operability for today's work," never "positioning for Content OS."** Free leverage is a side-effect, never the purpose.

## R3.6 Register Content OS (cross-project fact → owned by `ecosystem-architecture`, awaiting founder go-ahead to push)

Prepared entry for `ecosystem-architecture/03-future-projects-registry.md`:
```markdown
## Content OS (future — candidate)
- Purpose: turn ecosystem execution into distribution (extraction · knowledge→content ·
  automated posting · AI avatar/voice).
- Owns (target SoT): Content/Asset (draft→approved→posted→performance) — its ONLY mastered
  entity; needs a row in 06 when promoted.
- Consumes (READ-ONLY): the knowledge layer — project wiki/ (understanding), docs/, this
  ecosystem-architecture/ (06/10/11), existing project outputs. Resolves source_of_truth/
  last_verified; honors stability:stale as do-not-distribute. Writes nothing back (ECR-0002
  read-only-consumer pattern).
- Produces: Content/Asset records (own store) + posting actions (human-gated, §6/§11).
- Dependencies: Delivery OS, Ecosystem Architecture, existing project outputs.
- Hard constraints: MUST NOT extract/distribute Contract/Invoice (ECR-0003 §5); MUST NOT
  write to wiki/docs/ecosystem-arch; MUST NOT become a 2nd master of any record it reads.
- Status: ⚪ candidate (not a project yet). Trigger: founder commits to distribution AND ≥1
  project has a steady stream of write-back'd understanding worth distributing.
```
Plus a future `06-source-of-truth-registry.md` row (when promoted): `Content / Asset → Content OS → Content OS writes → analytics reads → ⚪ future`.

## R3.7 Net
**The honest answer to "does the AI-OS model improve ecosystem-wide knowledge management + future knowledge-to-content?": YES — and that validates the minimal design rather than enlarging it.** The same discipline that prevents §7 drift and protects ECR-0003 is exactly what makes a future content product easy to build. Build v3-minimal well and clean (with the 5 cheap affordances above); **build nothing content-specific now**; Content OS adds its own content-skills + runtime services (under the already-existing `ai-product-engineering.md`) when it earns a brief and pulls.

**New open decisions:** (5) adopt the 5 cheap affordances into v3-minimal? (6) OK to register **Content OS** as a candidate in `ecosystem-architecture/03` (separate repo — needs go-ahead to push)?

---

## 0. Headline: what the panel converged on, and where it split  *(R1 — see Revisions 2 & 3 above for the current recommendation)*

**Convergent finding (strong, 5/5 in substance):** the founder's instinct — *"v2 is weak on persistent operational context"* — points at a real gap, but the **highest-leverage fix is not "build more stores." It is "make the context that already exists *addressable*, and the procedures that already exist *callable*."** v3 should be an **additive strangler over v2's intact execution plane**, not an "AI OS" rewrite.

**The single most important correction the panel made to the brief** [Architect, echoed by Reviewer + Knowledge + Ecosystem]:

> Much of the proposed v3 **already exists** and would be **duplicated**, not created:
> - **`ecosystem-architecture/` IS already the portfolio wiki** — it holds the LOCKED source-of-truth registry (`06`), project registries (`02/03/09/11`), the canonical glossary (`10`), the integration map (`05`), and the ECR decision log. The proposed `wiki/{decisions,glossary,projects}` are **louder duplicates** of locked artifacts → a guaranteed drift defect (violates Governance §7).
> - **v2's best capabilities** (the §11 panel, the founder interview, the audits) **already exist — as inert prose.** They aren't missing; they're *un-callable*.

**The sharpest disagreement (surfaced, not smoothed):**

| | Reviewer/Critic | Architect / Skills / (Knowledge, Ecosystem in middle) |
|---|---|---|
| Overall | **NARROW-FIRST.** Most asks are premature/duplicative; approve only a thin CLAUDE.md index + a grill-me addendum; reject the rest until a 2nd consumer earns it. | **Adopt a *narrowed* v3 now.** The Router + Skills are *earned* because the procedures and stores already exist — generalization is *pull*, not speculation. |
| "Context is the weak C?" | Four-C is just renaming. | **No — *Capabilities* is the weakest C** (procedures trapped as prose). Promoting them to Skills is higher-leverage than any wiki folder. |

**Consolidated resolution:** a **NARROWED v3** that adopts what is earned (Router, Skills, grill-me, a thin ecosystem pointer, and a *thin* project-local wiki for genuinely-homeless knowledge), explicitly **rejects** the duplicative/speculative pieces (parallel wiki of ecosystem facts, a multi-"world" router, a Four-C reorg, a multi-agent "alignment layer"), and adds **one gap nobody asked for but everyone's logic implies: knowledge-cadence** (a write-back loop step so the whole thing doesn't rot).

---

## 1. Delivery OS → the Four-C framework (mapping + gaps)

| C | v2 today | Verdict | Gap v3 must fill |
|---|---|---|---|
| **Context** (what's true) | `docs/` discovery trio + `project-context.md`; `ecosystem-architecture/`; native `memory/`. Real and rich — but **siloed, un-addressed**; market/customer knowledge homeless. | **Partially weak — mis-located.** Context mostly *exists*; it's *unaddressed*, plus 2 genuinely-absent domains. | **Routing/addressing** + complete `market`/`customers`. |
| **Connections** (how worlds link) | `ecosystem-architecture/` is mature & LOCKED (06/05/09/11 + ECRs). | **Strongest C.** | The project→ecosystem link is **manual prose** → a thin **pointer router**. |
| **Capabilities** (reusable verbs) | The interview, the §11 panel, the audits — **inert documentation, not callable/versioned/improvable.** | **WEAKEST C** [Architect reframe]. | **First-class Skills** (the biggest-leverage win). |
| **Cadence** (recurring rhythm) | Operating loop, DoD, §11, slices, release gates. Strong **task**-cadence. | **Strong — but task-only.** | **Knowledge-cadence:** a write-back loop step + a "context hygiene" review so the wiki/skills stay fresh. |

**Founder thesis tested:** *partly right.* The weak C is **Capabilities** (inert prose), and Context's true gap is **addressing + two missing domains**, not absence. The uncovered gap is **knowledge-cadence**.

---

## 2. Per-ask verdicts (consolidated, with the dissents)

| # | Founder ask | Verdict | Consolidated form |
|---|---|---|---|
| 1 | **CLAUDE.md as Router** | **ADOPT (narrowed)** | A per-project **router/index**: identity+phase, Active-Skills table, Agents table, §11 Decision-Routing table, Gate, Invariants, **Sources-of-Truth table**. **Generated between markers + CI `--check` anti-drift.** Reviewer's caveat honored: it **indexes/points, it does not "dispatch"** — addresses only, never content (token-budget discipline). |
| 2 | **Wiki layer (7 folders)** | **ADOPT — heavily narrowed to 4** | **Drop `decisions`/`glossary`/`projects`** (duplicate LOCKED `ecosystem-architecture`). Keep only **homeless project-local** knowledge: `company/`, `market/`, `customers/` *(playbook/narrative only — **NOT** a CRM master; record data = Demand/CRM Spine per ECR-0003)*, `processes/` *(business processes; engineering processes point to `delivery-os/processes/`)*. Plus `_index.md` + `_pointers.md`. Strict `source_of_truth` frontmatter + `last_verified` + a freshness linter. **Content earned, not scaffolded.** *(Dissent: Reviewer would extend `ecosystem-architecture` in place rather than add a project `wiki/` root — see §6 open decision.)* |
| 3 | **Skills layer** | **ADOPT** | Promote existing v2 procedures into **native Claude Code skills**, framework-shipped in `delivery-os/skills/`. A Skill = a *procedure* (the **3-yes litmus**: repeatable + orchestrates ≥2 agents/§11 + improvable), never a persona, owns no files. Lightweight `version` + `CHANGELOG`; **improvement is a human-gated retro action** (author≠verifier applies). *(Dissent: Reviewer says versioning is premature — resolved by keeping it a single field + changelog, **no resolver/registry**, which the Skills lens also recommends.)* |
| 4 | **Ecosystem Router ("other worlds")** | **ADOPT as a THIN pointer; REJECT as a new store** | A per-project **`ECOSYSTEM.md`** that **POINTS** to `ecosystem-architecture` (which **OWNS**). Records: its own role + sibling **pointers** (path, consume/expose, governing ECR) — **never restates cross-project facts.** Reconciliation git-sha + link-resolution CI check. *(Reviewer: there are only 3 sibling projects, no real "other worlds" — so this stays a thin pointer, not a multi-world routing engine.)* |
| 5 | **Four-C framework** | **ADOPT as a lens, REJECT as structure** | Use Four-C as a **diagnostic mnemonic** (this proposal §1) and a one-paragraph README mapping. **No new folders, templates, or "Four-C assessment" ceremony** [Reviewer]. |
| 6 | **Grill-Me** | **ADOPT (experimental)** | A deep, adversarial follow-up interview to **measured confidence thresholds** (0–3 rubric per load-bearing field; per-field 3-push cap; **honest below-threshold ledger** instead of infinite loop). Reviewer/Critic is the **blind skeptic** (author≠verifier on elicitation). Output = hardened BRIEF/MISSION/NORTH-STAR + a **Confidence Ledger** the discovery gate reads. Ship `stability: experimental` until calibrated on ≥3 projects. |
| 7 | **Multi-agent alignment** | **ADOPT as a context-resolution contract; REJECT as a new "alignment layer"** | Do **not** build an orchestration layer that could anchor blind lenses or let the orchestrator pre-conclude (would erode §11). Instead define a **deterministic READ chain** and **WRITE-back targets** (below), and let **Skills encode the §11 panel** — making §11 *runtime-verifiable*. Memory = **continuity, never authority**; cross-project writes go via **ECR only**. |

---

## 3. The v3 architecture (narrowed)

Seven asks collapse into **three planes over the intact v2 execution plane**:

```
ROUTING PLANE (always-loaded, addresses-only, cheap)
  CLAUDE.md  ── router/index: phase · skills · agents · §11 routing · gate · invariants · SoT table
        └─► ECOSYSTEM.md ── thin pointer to ecosystem-architecture (registry OWNS; router POINTS)

KNOWLEDGE PLANE (pulled on demand; one home per fact — "points-to, never copies")
  ecosystem-architecture/   = PORTFOLIO truth (LOCKED): SoT registry, ECRs, glossary, maps   [CANONICAL]
  docs/                      = PROJECT business truth: BRIEF/MISSION/NORTH-STAR, ADRs, roadmap [CANONICAL]
  wiki/ (thin)               = project-local HOMELESS knowledge: company/market/customers/processes
  memory/MEMORY.md           = agent cross-session continuity — a WAL/index, DERIVED, never authority

CAPABILITY PLANE (callable, versioned, improvable)
  skills/  = discovery-interview · grill-me · migration-assessment · architecture-review ·
             roadmap-review · production-readiness-review · ecosystem-alignment-review
             (one §11 engine, parameterized by decision-class)

EXECUTION PLANE (v2, UNCHANGED)
  agents/ (lean default + pack roles) · core/ (loop · DoD · §11 · severity)
```

**Context-resolution order (the ask-7 answer — read chain, nearest-authoritative-first):**
`CLAUDE.md` (how to behave) → `ECOSYSTEM.md` (which world owns a fact) → `ecosystem-architecture/*` (the cross-project fact) → `docs/*` (project business truth) → `wiki/*` (project-local narrative) → agent role → `memory/` (continuity only).

**Write-back targets (one home per output class):** code/tests → repo trees · project decision → ADR · **cross-project decision/ownership → ECR + registry (never a project file)** · §11 review → `docs/DECISION-REVIEW-*` · durable org knowledge → `wiki/` · agent recall → `memory/` · reusable technique → a **Skill** (bump version).

**The non-negotiable invariant of the whole knowledge plane:** **one source of truth per concern (Governance §7).** `ecosystem-architecture` and `docs` are canonical; `wiki` and `memory` may only **point/index/cache**, never restate a canonical fact. Enforced by frontmatter `source_of_truth:` + a freshness/link linter in CI.

---

## 4. Folder structure

**Framework (`delivery-os/`):**
```
delivery-os/
├── CLAUDE.md.template          ★ router/index template (markers for generated blocks)
├── ECOSYSTEM.md.template       ★ thin pointer template
├── skills/                     ★ the agnostic, versioned capabilities (clean-room)
│   ├── discovery-interview/    (promotes discovery/FOUNDER-INTERVIEW.md)
│   ├── grill-me/               (NEW: confidence-ledger deep interview)
│   ├── migration-assessment/   (packages the rumah-admin play)
│   ├── architecture-review/  roadmap-review/  production-readiness-review/  ecosystem-alignment-review/
│   │   └── each: SKILL.md · CHANGELOG.md · examples/
├── wiki/_templates/            ★ schema + page templates ONLY (company/market/customers/processes)
├── templates/                  + migration-assessment.md, decision-review.md, confidence-ledger.md
├── scripts/
│   ├── new-project.sh          ★ also scaffolds CLAUDE.md, ECOSYSTEM.md, .claude/skills/, wiki/
│   └── sync-router.sh          ★ regenerates + `--check`s CLAUDE.md generated blocks (CI)
├── core/ agents/ processes/ checklists/ domain-packs/ case-studies/   (UNCHANGED)
└── discovery/                  (thinner: workflow+checklist stay; interview → skills/)
```

**Project (`rumah-admin/`):**
```
rumah-admin/
├── CLAUDE.md          ★ router/index (generated blocks + hand-written identity/invariants)
├── ECOSYSTEM.md       ★ thin pointer to ecosystem-architecture + siblings
├── wiki/              ★ company/ market/ customers/ processes/ + _index.md + _pointers.md  (thin, earned)
├── docs/              BRIEF·MISSION·NORTH-STAR·ADRs·roadmap·STATUS·DECISION-REVIEW   (business SoT — exists)
├── .claude/
│   ├── agents/        lean default + pack roles   (v2)
│   └── skills/        installed skills (from framework)
├── memory/            MEMORY.md + one-fact files (continuity; exists)
├── delivery-os/       framework (submodule, pinned)  — pick ONE mechanism (retire the flat .delivery-os cache)
└── CODEOWNERS         author≠verifier (v2)
```

---

## 5. Migration path from v2

**Shape: additive strangler — zero changes to `core/`, `agents/`, governance, or CODEOWNERS.** The new planes sit *above* the intact execution spine and *invoke* it. Per-project adoption rides the existing Upgrade Path (`GETTING-STARTED §Upgrade`): bump the submodule, re-run the scaffolder, read `CHANGELOG-v3.md`. **In-flight projects (rumah-admin, gate-stage) adopt at a milestone boundary, never mid-slice.**

| Component | Classification | Notes / break-risk |
|---|---|---|
| `skills/` folder | net-new, low risk | parallel to `agents/`; clean-room extends naturally |
| discovery-interview, migration-assessment, ecosystem-alignment | **file-move** | content exists (FOUNDER-INTERVIEW, the rumah-admin play, DISCOVERY §6) |
| architecture/roadmap/production-readiness reviews | net-new, medium | seeded by §11 + the "multi-reviewer readiness" prompt |
| grill-me | net-new, **highest effort** | the confidence loop/scoring is genuinely new → ship experimental |
| CLAUDE.md router | rewrite of the scaffolder's prose CLAUDE.md | **#1 break-risk:** generator must preserve hand-written sections outside `BEGIN/END GENERATED` markers, fail-closed if markers missing |
| ECOSYSTEM.md | net-new, low | thin pointer; link-resolution CI check |
| wiki/ (thin) | net-new schema | content earned; linter for drift/staleness |
| CI checks (`sync-router --check`, link-resolution, freshness) | net-new | **unenforced where a project has no CI** (rumah-admin has none today) → Router/wiki degrade to best-effort there; honest limitation |

---

## 6. Risks (consolidated top 6)

1. **Four-source-of-truth collision / duplication-drift** — the cardinal risk (all 5 lenses). `wiki` + `docs` + `memory` + `ecosystem-architecture` overlapping. **Mitigation:** *points-to-never-copies*; `ecosystem-architecture`/`docs` canonical; `source_of_truth:` frontmatter + CI link/freshness linter; **drop the 3 duplicative wiki folders**.
2. **`wiki/customers` becoming a second CRM master** — violates LOCKED ECR-0003. **Mitigation:** playbook/narrative only, keyed by the Spine `Organisation` ID, hard banner `source_of_truth: demand-crm-spine`, linter rejects record-like fields.
3. **Router/wiki rot + generator clobbering hand edits** — **Mitigation:** generated-between-markers + CI `--check` (fail-closed); but **degrades silently where no CI exists** → gate "Router trusted" on CI presence.
4. **Scope creep into bureaucracy + §11 independence erosion** — a multi-agent "alignment layer" could anchor blind lenses / let the orchestrator pre-conclude. **Mitigation:** no alignment layer; skills encode §11 but agents stay blind; **no self-tuning skills** (author≠verifier); Four-C stays a mnemonic.
5. **grill-me non-termination / founder fatigue** — **Mitigation:** per-field 3-push cap + global cap + honest below-threshold ledger; `experimental` until calibrated on ≥3 projects; transparent 0–3 rubric (no opaque ML score).
6. **Skill sprawl / version overhead** — **Mitigation:** 3-yes litmus gates new skills; single `version` + changelog, **no resolver/registry**; framework-owned, human-gated improvement, back-ported under the clean-room rule.

---

## 7. Recommended implementation order (cheapest-and-most-unblocking first)

1. **CLAUDE.md router/index template + `sync-router.sh` + CI `--check`.** Cheapest, unblocks everything (every other layer plugs into its address table). *(Enriches the prose CLAUDE.md the scaffolder already writes.)*
2. **ECOSYSTEM.md thin pointer + link-resolution check.** Cheap; kills accidental cross-project coupling immediately.
3. **Promote the 4 review skills** (migration-assessment, architecture-review, production-readiness-review, ecosystem-alignment-review) + their 2 output templates. **Biggest leverage:** turns §11 from a remembered principle into a runnable, success-criteria-checked, CI-verifiable procedure. Risk-first (a broken consequential-decision skill is the most dangerous).
4. **discovery-interview skill, then grill-me (experimental).** grill-me extends the proven base; both feed BRIEF/MISSION/NORTH-STAR; gate reads the Confidence Ledger.
5. **Thin wiki schema** (company/market/customers-playbook/processes-business) + `_pointers.md` + `source_of_truth` frontmatter + freshness linter. **Schema first; content earned per §8.**
6. **Knowledge-cadence:** add the **write-back step** to the operating loop (Documentation → Status → **Write-back** → Continue) + a recurring **context-hygiene** review (re-confirm SoT, harvest learnings into wiki/skills, bump skill versions).
7. **Four-C README mnemonic** (doc-only). Backfill `wiki/market`+`customers` content per real need.

---

## 8. Open decisions for the founder (Principle 11 — the human merge gate decides)

1. **Scope posture:** adopt the **NARROWED v3** above (panel consensus) — or the Reviewer's even-tighter **NARROW-FIRST** (only CLAUDE.md index + grill-me addendum now, everything else deferred until a 2nd consumer)?
2. **Wiki home (the one genuine split):** a **thin project-local `wiki/`** for homeless knowledge (Architect/Knowledge) — *or* **extend `ecosystem-architecture/` in place** and have projects only point to it (Reviewer/Ecosystem)? *(Recommendation: project-local `wiki/` for **project-local** narrative only; **all cross-project facts stay in `ecosystem-architecture`** — this satisfies both camps if the boundary is enforced by the linter.)*
3. **Sequencing vs the live work:** v3 is framework work that **must not block the rumah-admin Discovery Gate** (still awaiting your approval). Recommend: ratify v3 scope now, **implement after** rumah-admin clears its gate.
4. **Build & push:** shall I turn the ratified scope into actual framework changes (skills, templates, scripts) on a branch in `delivery-os/` for review before any push?
