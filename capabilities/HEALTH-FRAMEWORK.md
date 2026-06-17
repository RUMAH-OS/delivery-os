# Health Framework — Founder-Discovered Failures Become Monitored Failures (DRAFT)

> Author: lead-architect. **DRAFT — I design + sequence; the founder RATIFIES.** Read-only/planning pass.
> Initiative (founder directive, 2026-06-17): "continued health-framework design so founder-discovered
> failures become MONITORED failures."
>
> **The founder's governing pattern (verbatim framing):** "systems produce capabilities + state; Founder OS
> consumes, combines, reasons, and acts." Health is one of the 7 knowledge buckets
> (KNOWLEDGE-ARCHITECTURE.md bucket #5) — currently designed-not-built (the delivery-os/health/ dir
> does not exist; FOUNDER-OS-MIGRATION-PRINCIPLE.md records Health as MISSING / create-when-first-needed).
>
> **EXTENDS, does not replace:**
> - KNOWLEDGE-ARCHITECTURE.md — the 7-bucket structure; Health = bucket #5 (monitoring logic), routed via
>   the proposed health-route; the retrieval hierarchy (Health is consulted 3rd, after Skills + Workflows).
> - FOUNDER-OS-MIGRATION-PRINCIPLE.md — Health is a first-class shared structure; create-when-first-needed;
>   classify-dont-delete; gradual / no-big-bang; admin-first proving ground; PLOS frozen.
> - CAPABILITY-MANIFEST-STANDARD.md — every capability declares a health facet (its OWN probe). This doc
>   reconciles "the Health bucket" (cross-cutting monitoring rules) vs "a capability's health facet" (§1.3).
>
> **The one-line distinction this whole doc rests on:** a gate blocks a commit before it lands; a
> health check observes running/prod state after it has landed. The founder discovers failures in the
> SECOND space — things that were green at commit time and broke (or were never observable) in the running
> world. The Health Framework is the discipline that closes that second space.

---

## 0. The problem, stated from real failures (not abstractly)

Every failure the founder has personally discovered shares one shape: it passed (or was never checked by)
the commit-time gates, and surfaced only in the running/prod world, and was re-discovered by a human. The
evidence (all citations are real, on disk):

| Founder-discovered failure | Where it actually lives | Evidence (on disk) |
|---|---|---|
| **Email no-op / signing email redirect to a personal Gmail; /signing/send returns {success:true} after delivering zero emails** | running prod behavior — a false success; no gate watched the actual send outcome | rumah-admin/docs/INVESTIGATION-production-findings.md ITEM 1 (CCR; index.tsx:2683/2688/2830) |
| **Cleaning-PDF defect** (a cleaning/extra invoice rendered a contentless €0 PDF / no attachment) | consumer-side (PLOS) rendered no PDF; Admin producer path was actually correct — but NOTHING continuously asserted the rendered artifact | rumah-admin/docs/slices/SLICE-cleaning-pdf-guard.md; docs/verify/VERIFY-cleaning-pdf-guard.md |
| **/v1/inventory 500/404 regression** (empty-string slug → unhandled HTTP 500 for the WHOLE list) | running app behavior found by adversarial probing, not by a unit gate | rumah-admin/docs/verify/VERIFY-inventory-api-v1-local.md Round 1 |
| **Seam drift** (an emitted event diverges from the canonical contract) | cross-repo running behavior between two systems | .claude/os/tools/seam-gate.mjs; scripts/seam-check.ts (this one is ALREADY a gate — see §3) |
| **Seam-url mount drift** (a seam/contract url omits the real app mount prefix → consumer fetches a 404 and attaches nothing; pdfRef.url lacked `/admin`) | cross-system running behavior: a schema-valid url pointing at a route that does not exist on the real mount | rumah-admin/docs/verify/VERIFY-pdfref-seam-fix.md (Criterion 6 "matched a path that 404s at the real /admin"; Criterion 2); fixed commit 8ea0876; distilled rule wiki/ku-seam-url-must-match-app-mount |
| **Stale main / deploy-debt** (14 impl commits "closed" but never pushed → undeployed work the founder cannot use) | the gap between "done" and "deployed" | rumah-admin/scripts/deploy-debt.mjs (root-cause comment) |
| **Invoice duplicate-billing cluster** (4 extra-kosten invoices, empty tenantEmail, never deliverable yet persisted) | live data integrity, found by a read-only DB scan | INVESTIGATION-production-findings.md ITEM 3 + the 2026-06-10 live-DB verification |

**The pattern the founder named, applied:** these are all cases where a system produced state (a prod
endpoint, an emitted event, a rendered PDF, a row in the DB, a remote branch) and nothing consumed that
state, reasoned about whether it was healthy, and acted/alerted. The Health Framework is that consumer.

> **Two of these are already partly solved — and that is the point.** Seam drift now has seam:check (a
> gate). The cleaning-PDF lesson produced a CI guard. Deploy-debt has a detector. The framework's job is to
> (a) name the ones that are STILL only human-discovered (mail, the prod 404 on running state, the data
> integrity scan as a standing check), and (b) give all of them ONE artifact shape, ONE registry, and ONE
> roll-up so the founder sees one health view instead of re-discovering failures one at a time.

---

## 1. What a Health check IS (the artifact shape)

### 1.1 The artifact

A **Health check** is a small declarative unit that observes RUNNING or PERSISTED state and renders a
verdict. Its canonical home is delivery-os/health/<concern>/HEALTH.md (+ a sibling probe), routed via
health-route (bucket #5). The artifact shape:

```jsonc
{
  "id": "mail-config-health",            // stable kebab-case, unique across the Health bucket
  "domain": "mail",                       // one of the Health domains (§3): seam|ci|mail|oauth|deploy|linkedin|capability|agent|data
  "watches": "the live signing-send path actual delivery outcome + recipient",  // ONE honest sentence: what real-world state this observes
  "signal": {                             // HOW the state is sampled — the probe
    "kind": "code-invariant",             // enum: http-probe | db-scan | git-state | log-scan | event-conformance | code-invariant | telemetry-read
    "ref":  "asserts no unconditional recipient override + send returns a real delivered status",
    "sideEffect": "read"                  // MUST be read (CAPABILITY-MANIFEST-STANDARD §3.1: health observes, never mutates domain state)
  },
  "healthy":   "every signing send resolves to the verified intended recipient AND returns a true delivered=ok",
  "unhealthy": "a hardcoded recipient override is present OR send returns success while delivering zero emails",
  "severity":  "critical",               // enum: critical | high | medium | low  (critical = legal/financial/data-loss; cf. INVESTIGATION severity rollup)
  "ownerSystem": "admin",                 // who PRODUCES the watched state: admin | plos | founder-os | delivery-os
  "observedBy":  "founder-os",            // who CONSUMES/reasons/acts (always founder-os / delivery-os — the roll-up plane, §4)
  "cadence": "ci+prod-sample",            // when it runs: ci | prod-sample | slice-close | continuous
  "bornFrom": "INVESTIGATION-production-findings.md#item-1",  // PROVENANCE: the real failure that earned this check (§2 — REQUIRED)
  "verdict": "GREEN | RED | UNMEASURED"  // UNMEASURED fails closed (cannot-observe is NOT healthy)
}
```

**Load-bearing invariants** (inherited from the spine, not invented here):
- **UNMEASURED is RED, never GREEN.** "We could not observe this" is a failure, exactly as deploy-debt.mjs
  BLOCKS LOUDLY on an undeterminable pushed-state and agents-idle-check.mjs fails closed on no telemetry.
  A health check you cannot sample is itself unhealthy.
- **A Health check is sideEffect: read** (CAPABILITY-MANIFEST-STANDARD §3.1) — it observes; it may write its
  own log/snapshot artifact; it NEVER mutates domain state and (critically for PLOS, §4) NEVER writes into a
  system it only observes.
- **bornFrom is REQUIRED.** A Health check that does not cite the real failure it monitors is rejected — the
  framework exists to convert discovered failures, not to manufacture speculative checks (this is the §2
  standing rule, made structural).

### 1.2 How a Health check differs from a Gate (the core reconciliation)

| | **Gate** (already abundant in Admin) | **Health check** (this framework) |
|---|---|---|
| When | commit / pre-push / CI — BEFORE code lands | continuously / on a sample — AFTER it is running in prod |
| Acts on | a diff / a batch about to be emitted | the running endpoint, the live DB, the remote branch, the rendered artifact |
| On failure | **blocks** (exit non-zero; the change cannot land) | **observes + alerts/rolls-up** (RED in the health view; does not block — there is nothing to block) |
| Catches | "this change would be wrong" | "the live world drifted / was never observable / broke after landing" |
| Examples in repo | seam:check, lifecycle:check, workflow:check, experience:check, ownership-gate, verify-gate, the cleaning-PDF CI guard | (mostly MISSING today) mail-config-health, /v1/inventory-up, seam-freshness, deploy/stale-branch, data-integrity-scan |

**The cleaning-PDF case is the perfect teaching example of the boundary.** The founder discovered a no-PDF in
running behavior. The team response was to build a **CI guard** (a gate: tests/seam-conformance.test.ts
extended to assert real %PDF- bytes per kind). That gate is correct and prevents the Admin producer side
from regressing. But the actual defect was **consumer-side (PLOS) rendering** — which an Admin commit gate
can never see. The missing piece is a **Health check** that samples the rendered artifact in the running
world and goes RED if a real issued invoice has no real PDF. **A gate guards the producer; a health check
watches the outcome.** Many founder failures need BOTH; the framework names the health half that is missing.

### 1.3 Reconciliation: the Health BUCKET vs a capability health FACET

These are two different things and the framework needs both — they compose:

- **A capability health facet** (CAPABILITY-MANIFEST-STANDARD.md §2/§3, the "health": <ref>|null
  field) is one capability OWN probe — "here is how you check whether THIS capability is alive." It is a
  property the capability declares about itself.
- **The Health bucket** (KNOWLEDGE-ARCHITECTURE.md #5) is the cross-cutting monitoring layer — the set of
  Health-check artifacts for whole CONCERNS (mail, seam, deploy), many of which span systems and are NOT owned
  by any single capability (e.g. seam-freshness watches the boundary BETWEEN Admin and PLOS).

**The composition rule:** a capability health facet, when present, **registers into the Health bucket** as
a domain: capability check (§3) — i.e. the per-capability probe is a feeder of the bucket, exactly as a
KU source-provenance feeds the Wiki. The bucket is the union of (a) standalone concern-level checks and (b)
every capability declared health facet. The roll-up plane (§4) consumes both. This is the same
producer->consumer shape one level down: capabilities produce a health facet; the Health bucket consumes,
combines, and rolls up.

---

## 2. The standing rule: founder-discovered-failure -> monitored-failure pipeline

This is the **defining mechanism** of the framework — the analog of "every retro yields a KU" and "every
learning-bearing slice promotes its lesson." Stated as a permanent rule:

> **Every founder-discovered failure (or postmortem/incident) MUST yield a registered Health check before the
> incident is closed — or an explicit, recorded waiver.** A failure the founder found once and that nothing
> now watches is an un-promoted lesson, and a learning-bearing close cannot be DONE with it outstanding.

The loop:

```
1. DISCOVER     a failure surfaces (founder friction · prod incident · adversarial probe · DB scan)
2. ROOT-CAUSE   what actually broke + where the watched state lives  (the INVESTIGATION-findings discipline)
3. AUTHOR       write a Health check: {domain, watches, signal, healthy/unhealthy, severity, bornFrom=<the failure>}
4. REGISTER     land it in delivery-os/health/<concern>/  (proven in Admin first — §6)
5. SURFACE      it rolls up into the cross-system health view (§4); RED is visible to the founder, not re-found by them
6. CLOSE        the incident closes only when (3)+(4) exist, OR a recorded waiver says why no check is feasible
```

**Tie-in to existing failure records (no new ledger).** The pipeline reuses what already exists:
- INVESTIGATION-production-findings.md is the canonical incident record; each ITEM is a bornFrom source.
  ITEM 1 -> mail-config-health. ITEM 2/3 -> invoice-integrity-health (the duplicate-number / duplicate-
  (contract,period) / unsent-unpaid scans the doc already SPECIFIES as read-only DB queries — they become a
  STANDING check instead of a one-time verify-now).
- The learning-review skill (already stable, already fires at milestones) is the natural place to RUN step 3
  — it already converts experience into CAPABILITY; "did this lesson yield a Health check?" becomes one of its
  outputs, the health analog of "did this yield a KU?"
- The slice-close trio (capability_health / agent_health / founder_experience in every SLICE-*.md) is
  the natural place to ENFORCE step 6 (report-only first, per admin-first, §6).

**This rule is what makes the founder directive structural rather than aspirational:** "founder-discovered
failures become MONITORED failures" is not a hope — it is a close condition with a named artifact and a named
provenance field (bornFrom).

---

## 3. The Health domains — have vs missing (the honest table)

For each domain the founder named, plus the two telemetry domains already live: what real signal EXISTS today,
what is MISSING, and whether it is observable now (Admin-internal, ungated) or needs prod/PLOS (gated, §6).

| Domain | Real signal that EXISTS today | What is MISSING (the Health check to build) | Observable now? |
|---|---|---|---|
| **seam** | seam:check (Admin producer gate, CI-wired) + seam-gate.mjs (canonical, vendored) validate emitted events vs the contract AT COMMIT | (a) **seam-url-mount-health** — the RECOMMENDED SECOND check (§5): static-scan that every seam/contract url field carries the producer's real app MOUNT PREFIX and resolves to an actual route, never a bare path that 404s at the real mount (the pdfRef-vs-`/admin` drift class; bornFrom VERIFY-pdfref-seam-fix.md); (b) a **standing seam-FRESHNESS health check** that observes the running drain (GET /v1/events) over time and goes RED if live events drift or the drain stalls — gate != continuous observation | **YES** (Admin-internal; the emitters, gate, contract + drain are Admin-owned) |
| **ci** | capability-health ALREADY checks every capability is "wired-to-run (ALIVE)" in CI (SLICE-cleaning-pdf-guard.md shows 9/9 ALIVE); health-snapshot.json is its persisted snapshot | a check that the CI actually ran green on the deployed SHA (wired != last-run-green); regression-since-snapshot is partly there (MOVED/REGRESSED) | **YES** (Admin-internal; capability-health is the seed of this domain) |
| **mail** | gmail-oauth-mint.mjs exists (token minting); INVESTIGATION ITEM 1 fully root-caused the no-op | **mail-config-health** — assert no unconditional recipient override + send returns a TRUE delivered status (the email no-op). The single highest-value check (§5) | **PARTIAL** — the code-invariant half is observable now (Admin source); the live-delivery half needs prod/Resend-or-Gmail logs (gated) |
| **oauth** | the mint flow + a live GMAIL_REFRESH_TOKEN in the secret store | a **token-freshness/expiry** health check (refresh-token still valid; OAuth not silently revoked) — currently discovered only when a send fails | **PARTIAL** — needs a live token probe (prod credential; gated) |
| **deploy** | deploy-debt.mjs ALREADY detects closed-but-unpushed impl commits and BLOCKS LOUDLY on undeterminable state | promote the detector output into the **standing health roll-up** (it is a detector today, surfaced at push; make stale-branch a continuous health signal) + a **deployed-SHA-matches-main** check | **YES** (Admin-internal; pure git read-only) |
| **linkedin** | none in Admin (this is a PLOS/demand-side concern) | a read-only observation of PLOS LinkedIn integration health | **NO** — PLOS-owned; observe read-only only, gated (§4/§6) |
| **capability** (telemetry) | capability-health (re-run-verified, anti-tamper) — the strongest live health signal in the system | roll its per-capability verdicts into the cross-system view as domain: capability checks (the §1.3 facet feed) | **YES** (Admin-internal; already running every slice-close) |
| **agent** (telemetry) | agent-health (REPORT; 423-invocation window in the latest slice) + agents-idle-check.mjs (fail-closed) | agent-health is report-only by design; the Health bucket consumes its REPORT as a domain: agent signal (idle/idle-specialist = a health concern, not a blocker) | **YES** (Admin-internal; telemetry already collected) |

**Reading of the table:** **5 of 9 domains are fully observable Admin-internal RIGHT NOW** (seam, ci, deploy,
capability, agent) — several already have a live signal that just needs rolling up rather than building.
**3 are partial** (mail, oauth — the code-invariant half is free, the live-prod half is gated). **1 is PLOS-
owned** (linkedin — observe-only, gated). This is why the framework can prove itself immediately on a real
past failure without touching prod or PLOS (§5).

---

## 4. The aggregation / consumption plane

> "Systems produce state; Founder OS consumes, combines, reasons, and acts."

Each system PRODUCES health state (per-domain checks, per-capability health facets, per-system telemetry).
**Founder OS / Delivery OS is the single CONSUMER** that combines them into ONE cross-system health view. The
mechanism mirrors the existing aggregators (capability-registry.mjs, dispatch-route.mjs,
knowledge-health.mjs): a deterministic reader, not a new judgment engine.

```
   Admin            PLOS (frozen — observe-only)        delivery-os
   produces:        produces:                            produces:
   - seam state     - linkedin state                     - capability facets
   - mail/oauth     - (its own health, read via the      - agent telemetry
   - deploy/ci        read seam ONLY — never write)
   - data integrity                  |
        |                            |                        |
        +--------------+-------------+------------------------+
                       v
            health-route / health-aggregate.mjs   (the CONSUMER plane — read-only, fail-closed)
            combines per-domain + per-capability checks -> ONE health roll-up
                       v
            cross-system health view  ->  feeds the future DOS UI / North-Star founder screen
            (the "is everything healthy?" answer; RED items the founder NEVER has to re-discover)
```

**Design properties:**
- **Reuse the spine, no new scorer.** The aggregator is the deterministic-reader pattern already proven by
  capability-registry (scan -> validate -> aggregate -> report-only) and knowledge-health (roster + verdicts
  + --json, exit-2-when-unmeasured). Health gets health-aggregate.mjs + health-route on the SAME
  conventions; zero forks.
- **The roll-up is the North-Star feed.** The v6-north-star-founder-screen memory defines success as ONE
  founder screen answering 8 questions in <=2 min. "Is the running system healthy, and if not WHERE" is the
  health portion of that screen. This roll-up is its data contract (a facets.ui DATA-contract per
  CAPABILITY-MANIFEST §2 — a typed view-model the shell renders, never a component).
- **PLOS is observed READ-ONLY (hard rule).** Per admin-first-proof-directive + PLOS-frozen: Health checks
  for PLOS-owned concerns (linkedin, PLOS own handoff health) **observe PLOS state through its read seam and
  go RED in Admin/Founder-OS view — they do NOT build anything in PLOS.** A Health check
  sideEffect: read makes this structural: a check that watches PLOS cannot, by its own contract, write to
  PLOS. This is the seam-monitor / handoff-health idea, but as a one-directional observation only while PLOS
  is frozen.
- **Severity drives the roll-up, not raw count.** A single critical RED (mail no-op = legal/GDPR;
  cf. INVESTIGATION severity rollup) dominates the view over many low greens — the founder sees the worst
  thing first. The roll-up verdict = worst non-UNMEASURED severity, with UNMEASURED itself surfaced as a RED
  blind-spot (fail-closed).

---

## 5. First concrete checks to build (Waterline — concrete before abstract)

Ranked by (real-failure provenance x observable-now x severity). Every candidate cites a REAL past failure
(bornFrom) — no speculative checks.

| Rank | Health check | bornFrom (real failure) | Severity | Observable now? | Why this rank |
|---|---|---|---|---|---|
| **1** | **mail-config-health** — no unconditional recipient override + send returns a TRUE delivered status | INVESTIGATION ITEM 1 (the email no-op / false {success:true}) | **critical** | code-invariant half: **YES, Admin-internal** | Highest severity (legal e-sign validity + GDPR), founder pain #1 (mail), and the code-invariant half is fully observable today with zero prod/PLOS coupling |
| **2 (recommended SECOND — stands up the aggregator)** | **seam-url-mount-health** — every seam/contract url field encodes the producer's real app MOUNT PREFIX and resolves to an ACTUAL route, never a bare path that 404s at the real mount | **pdfRef seam-URL bug** (`pdfRef.url` omitted the `/admin` mount → PLOS fetched a 404, attached no PDF; fixed commit 8ea0876) — see `../rumah-admin/docs/verify/VERIFY-pdfref-seam-fix.md` (Criterion 6: "matched a path that 404s at the real /admin"; Criterion 2: corrected /admin urls accepted + old un-prefixed rejected, both kinds, vs live emitters src/admin.ts:1581/1713) | high | code-invariant half: **YES, Admin-internal** (static-scan the emitters' url construction + the seam-gate regex against the real mounted routes) | The cleanest SECOND real failure: distinct class from mail (a contract-url-vs-real-route drift, not a delivery no-op), fully observable on Admin source today, and — per the Waterline note (§5) — being the **second** real check it is the one that forces the `delivery-os/health/` **aggregator** (health-route / health-aggregate) into existence, generalizing the bucket beyond a single check. Distilled rule: `wiki/ku-seam-url-must-match-app-mount` |
| 3 | **seam-freshness-health** — running drain conforms + does not stall over time | seam drift | high | **YES, Admin-internal** | The seam already has a gate; this adds the continuous-observation half the gate cannot give, on Admin-owned state |
| 4 | **inventory-up-health** — /v1/inventory list returns a valid envelope, never a 500/404 on the whole list | VERIFY-inventory-api-v1 Round 1 (empty-slug 500) | high | needs a running endpoint (local CI now; prod gated) | A real regression the founder-style adversarial probe caught; a standing http-probe prevents re-discovery |
| 5 | **deploy-stale-branch-health** — no closed-but-unpushed commits; deployed SHA matches main | deploy-debt (14 unpushed) | medium | **YES, Admin-internal** | The detector EXISTS (deploy-debt.mjs); this is mostly rolling its output into the standing view, low effort |
| 6 | **invoice-integrity-health** — no duplicate invoice numbers, no duplicate (contract,period), no persisted-undeliverable invoices | INVESTIGATION ITEM 2/3 + the live 2026-06-10 scan | high | needs prod DB read (gated) | The INVESTIGATION already wrote the exact read-only queries; turning them into a STANDING check is the cleanest "verify-now -> monitored" conversion |

> **The recommended SECOND check (spec, not yet built): `seam-url-mount-health`.** After `mail-config-health`
> (#1) creates the `delivery-os/health/` bucket, build `seam-url-mount-health` next. Per the Waterline note
> below, the SECOND real check is also what forces the **aggregator** (`health-route` / `health-aggregate.mjs`)
> into existence — one check is a unit, two checks make the roll-up shape concrete (exactly how
> capability-registry generalized after its first concrete proofs). Artifact spec:
> `{ id: "seam-url-mount-health", domain: "seam", watches: "every seam/contract url field encodes the
> producer's real app mount prefix and resolves to an actual route (not a bare path that 404s at the real
> mount)", signal: { kind: "code-invariant", ref: "static-scan the live emitters' url construction + the
> seam-gate regex; assert each REQUIRES the real mount prefix and REJECTS the un-prefixed form, per kind, with
> a golden fixture", sideEffect: "read" }, healthy: "every seam url carries the real mount prefix and matches
> a real route", unhealthy: "any seam url omits the mount prefix / matches a route that 404s at the real
> mount / the gate regex is bound to an assumed (not real) path", severity: "high", ownerSystem: "admin",
> observedBy: "founder-os", cadence: "ci", bornFrom:
> "rumah-admin/docs/verify/VERIFY-pdfref-seam-fix.md#criterion-6", verdict: "GREEN | RED | UNMEASURED" }`.
> Distilled rule + how-to-apply: `wiki/ku-seam-url-must-match-app-mount`. **Spec only — do NOT build the check
> in this pass.**

### The minimal first check — RECOMMENDATION

**Build mail-config-health first, as the code-invariant half only (Admin-internal, ungated).**

- It proves the framework on the founder single most consequential discovered failure (the email no-op,
  critical severity, ITEM 1).
- The code-invariant probe — "assert no unconditional recipient override exists in the send path AND the send
  function returns a real delivered status, not an unconditional {success:true}" — is **observable today
  against Admin source**, needs **no prod credentials, no Resend/Gmail logs, no PLOS**. It is purely
  Admin-internal, satisfying the gating completely.
- It is the cleanest possible end-to-end proof of the WHOLE pipeline on a REAL past failure:
  DISCOVER (done — ITEM 1) -> ROOT-CAUSE (done — index.tsx:2683) -> AUTHOR (the check) -> REGISTER
  (delivery-os/health/mail/ — the first real unit that CREATES the bucket) -> SURFACE (first entry in the
  roll-up). One real failure, one real check, the bucket born from a genuine need.

> Waterline: this is concrete-before-abstract. We do NOT build health-route / health-aggregate / the full
> 9-domain bucket first. We build ONE check on ONE real failure, which forces the bucket into existence
> (create-when-first-needed), and only generalize the aggregator once a second and third check make the shape
> obvious — exactly how capability-registry was proven on Admin own capabilities before generalizing.

---

## 6. Reconciliation + sequencing

**Gating (all honored, no contradiction):**
- **Post-V6 + N=1 + PLOS frozen + Admin proving ground.** Every first check runs in Admin on Admin-owned
  state. PLOS-owned concerns (linkedin, PLOS handoff health) are **observe-only, read seam, never build in
  PLOS** — and the sideEffect: read contract makes that structural, not merely a promise.
- **Create-when-first-needed.** The delivery-os/health/ dir + the health-route/health-aggregate tools do
  NOT exist yet and are NOT built speculatively. The first real check (mail-config-health) CREATES the
  bucket; the aggregator is built when >=2-3 checks make its shape concrete.
- **Report-only first, then forcing (admin-first-proof-directive).** A RED health check SURFACES first (in the
  roll-up + slice-close report); it escalates to a close-blocking condition only after the pipeline is proven
  on one real check — the same staged escalation the directive applies to ownership/routing gates.

**Promotion to delivery-os canonical** (same ladder as the harvester/registry):
- A Health check is PROVEN in Admin (status: built -> verified via author!=verifier), then PROMOTED to
  delivery-os/health/<concern>/ canonical and inherited (os-inherit, drift-gated) once it clears the
  proven-reuse gate. The concern-AGNOSTIC machinery (health-route, health-aggregate) is shared
  intelligence (Founder OS migration set); the APP-SPECIFIC checks that watch Admin own domain
  (mail/invoice-integrity) stay anchored to Admin state but register into the shared bucket — the same
  "shape is shared, the thing is the app" split as FOUNDER-OS-MIGRATION-PRINCIPLE.md.

**Composition with the capability platform (#1-#5) + the consumption loop:**
- The Health bucket is the **runtime-observation counterpart** to the capability platform commit-time
  declaration. A capability declares a health facet (#1 manifest); the Health bucket (#5 = this doc) is
  where those facets, plus standalone concern checks, are CONSUMED and rolled up.
- The roll-up plane (§4) is a read capability that itself declares a manifest and feeds the future DOS UI
  surface (facets.ui DATA-contract) — closing the loop to the North-Star founder screen.
- It reuses the spine end-to-end: the deterministic-reader pattern (capability-registry/knowledge-health),
  --json/--self-test/fail-closed/Windows-safe conventions, author!=verifier on every promotion, and the
  learning-review rhythm as the place step 3 of the pipeline runs.

---

## 7. Verdict (DRAFT — founder ratifies)

**BUILD THE FIRST HEALTH CHECK NOW — mail-config-health (code-invariant half, Admin-internal).** Do NOT
design-only this pass.

Rationale: the framework whole value is "discovered failures become MONITORED failures," and the cheapest,
most honest way to prove it is to convert the founder single most consequential discovered failure (the
email no-op, ITEM 1, critical) into a standing check — on Admin-owned source, with zero prod/PLOS coupling,
fully inside the gating. One real check on one real failure creates the bucket (create-when-first-needed) and
proves the pipeline end-to-end, exactly as capability-registry was proven on a real, concrete set before any
generalization. The aggregator, health-route, and the remaining 8 domains stay design-only until >=2-3 real
checks make the shape concrete (Waterline). **Gate verdict: right shape (gate vs health-check distinguished;
facet vs bucket reconciled), right order (concrete real-failure check before abstract framework), evidence-
based (every check cites a real on-disk failure).**

## 8. Status & the author!=verifier gate on THIS doc
DRAFT design by the lead-architect. NOT self-certified. Done for this pass when: structured (this artifact +
pipeline + domains table) · provenance-bound (extends the three named docs; every check cites a real failure)
· non-duplicative (the Health bucket #5 design; sibling to KNOWLEDGE-ARCHITECTURE, not a competitor) · queued
for independent review — the founder ratifies the artifact shape + the standing pipeline rule + the
build-mail-config-health-now verdict; an independent verifier checks that the proposed tooling reuses the
spine without forking it. **Built != adopted:** the framework is adopted only when a real RED health check
surfaces a real running failure the founder did NOT have to re-discover.
