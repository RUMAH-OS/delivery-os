# Incident Ledger — June 2026 (the provenance of the v4.0 doctrine)

> **Incidents are the provenance of doctrine** (X8). Every v4.0 promotion cites a row here; the doctrine seed
> (`templates/memory/doctrine-seed.md`) and the skills' `earned_from` fields point at these anchors. Sources:
> property-lead-os `docs/reviews/os-retrospective-and-v2.md` (#76, incl. its incident ledger),
> `docs/reviews/cross-system-os-assessment.md` (#84), `docs/reviews/consolidated-inheritance-recommendation.md`
> (#85), rumah-admin `docs/RETROSPECTIVE-2026-06-12.md`. Case studies may name projects; doctrine never does.

<a id="the-split"></a>
## The split — the one finding everything else rides on
Across two independent implementations of the same OS (PLOS ~3.5 weeks incl. 15 verified slices in 3 days;
rumah-admin discovery→production cutover): **every mechanical, fail-closed link held with zero violations**
(verify-gate, banned-identifier scans, GET-only pins, append-only stores, deterministic comparators);
**every prose / honor-system / hand-maintained link produced a named incident** (the ten below).
→ doctrine D-MECH; Governance §15 mechanism-over-prose law (K13).

## The ten incidents (PLOS #76, verbatim ledger compressed)
<a id="incident-1"></a>
**1 — PR #54 merged on red CI.** The merge — the only transition minting "done" — had no machine-read check;
an orchestrator pipe swallowed the failing status. Hotfixed in #55; the mechanical merge gate
(`scripts/merge-pr.mjs`, promoted to base at v4 as `templates/tools/merge-pr.mjs`) has gated every merge since #82. → B4, T3.

<a id="incident-2"></a>
**2 — S31/S32 cross-test race found by CI, not review.** Per-slice QA was deep; cross-slice interaction
probing was nobody's job. Third recurrence destroyed a test DB → run-unique tokens + machine-guard preamble. → B25.

<a id="incident-3"></a>
**3 — an engineer branch-switch broke the founder's live dev server.** Worktree isolation was an instruction,
not a setup default. → B20 (worktrees day 1).

<a id="incident-4"></a>
**4 — a dependency's `@ts-expect-error` landmine broke typecheck repo-wide.** No clean-machine install arbiter. → B20.

<a id="incident-5"></a>
**5 — THE BIG ONE: days of PLOS planning behind an "Admin infra" gate while Admin's Operational Truth API sat
shipped and verified on disk.** Root cause: two hand-maintained routers + a hand-reconciled registry — a stale
cache with no TTL — and the skill built to prevent exactly this (`ecosystem-alignment-review`) had a
consent-based "on change" trigger that cannot fire when the change is what you don't know. Caught only by a
founder-demanded code audit. The router template's own header — *"hand-maintained — no generator reconciles
it"* — is this incident's root cause self-documented, and it had been propagated verbatim into both consumers.
Witnessed from the other side of the seam (Admin): every relayed-prose claim contained a false statement;
every contract+token request worked first time. → K3/K4, B5–B9, S4, S5, D-AUDIT, D-EVIDENCE, D-CONTRACT.

<a id="incident-6"></a>
**6 — the founder asked the same boundary question (#65) twice.** Panel output landed as a repo doc; no
question-keyed asked→answered ledger. → B18 (DECISIONS.md), §11 ledger pre-read.

<a id="incident-7"></a>
**7 — ~10 panels / ~75 blind lens-runs in ~3 days against 8 operating replies.** Nothing rate-limited the
genre; the founder had to say "diminishing returns" himself. Plus the cleanest falsification on record:
13 lens-runs across two panels locked a daily-surface placement; the founder's first real morning reversed it
(one mount change — the reversal was pre-registered, which is the half that worked). → B10, B11, D-REVERSIBLE.

<a id="incident-8"></a>
**8 — QA-owned test pins edited by authors repeatedly.** The verify-gate's non-implementation regex exempts
exactly `tests/` — where the author/verifier boundary lives. → B2 (write-scoping).

<a id="incident-9"></a>
**9 — verify-gate fails closed on PATH-stripped shells; locked worktree dirs accumulate; CRLF churn.**
Environment lessons learned by breakage; hooks never smoke-tested against stripped shells. → B20.

<a id="incident-10"></a>
**10 — both evidence gates (taxonomy ~20; learning review ≥10) remained UNFIRED while consumption machinery
compounded** (a re-analysis CLI, query pack, and index built for a 6-conversation corpus). "Gate unfired ⇒
design doc only" was a judgment call, not a rule; counters were unbuilt, so the gates could not even fail
honestly. The one correct pre-gate build was capture-only (S29/S30). → B13 (evidence governor), S7, D-GATES.

## Named exhibits beyond the ten

<a id="s37"></a>
### S37 — the author≠verifier crown-jewel rejection
The author's 57 tests passed green; the independent verifier's constructed probe found the capped-fallback
lane silently storing ZERO on re-press while toasting success — silent data loss on exactly the lane a real
month-long gap rides. REJECTED; fixed by a second engineer; re-verified forensically (sha256 anchors + an
mtime audit proving exactly three files changed). One rejection in 16 artifacts is the right rate — a verifier
that never rejects is decoration. → S1 (verification 2.0), D-AV.

<a id="dual-contract"></a>
### The dual-contract incident
On the same day, two FROZEN contracts for the same PLOS↔Admin events seam were created in parallel and
contradicted each other on transport, vocabulary, persistence, and join keys (#73 vs ECR-0006) — and the
ratified one silently pre-decided two open founder-gated questions while citing no document from the consuming
repo. #73's own opening line ("parallel design is the failure mode this document exists to prevent") describes
what then happened. Still the open F4 obligation. → S3 (executable-contracts), T7.

<a id="n13-self-destruction"></a>
### N13 — self-inflicted data destruction (the most expensive defect class)
Under a raw-forever preservation doctrine: timestamp clobbering, draft destruction at send, and CASCADE paths
through append-only stores — all permanent, all invisible to green tests, found by audit not by QA. The same
doctrine ran for weeks on an unbacked-up, hand-migrated local Postgres (D3/F5 — durability still the largest
unpriced risk and the named exhibit for the Phase-0 row). → K10, B14.

<a id="instruments"></a><a id="metrics"></a>
### The instruments audit (N16) — and conversations-not-data
The most instrumented part of the company had produced no verdicts, while its own instruments were broken
without detection: `prompt_version` mis-stamped on all AI rows, the Q5 capture dormant at 296/298 pending,
5 destroyed bodies, 47% of sends unscored — every one found by ONE founder-improvised read-only audit, not by
QA, the gate, or any panel. *"Capture everything" shipped; "verify the instruments" was missing from the
loop.* The north-star discipline that survives this: success is measured at replies → meetings → customers,
never at data/supply volume. → S8, DoD row 10, D-NORTHSTAR.

<a id="emergent-assets"></a>
### N14 — plans under-predict emergent assets
Conversation-content-as-asset appears NOWHERE in the original planning docs; it became the company's deepest
moat thesis. The first conversation-intelligence panel got its timing verdict wrong and the founder's addendum
overrode it — the founder out-judged the machinery on the strategic call. Learning reviews exist to catch what
planning structurally cannot. → S9, D-PRESERVE.

<a id="n15-founder-hybrid"></a>
### N15 — credit recorded correctly: events-for-deltas / reads-for-truth
The one cross-system design decision both retrospectives independently call unambiguously correct — events
trigger, reads decide — was **the founder's own observation**, not a panel product. → D-EVENTS.

<a id="ownership"></a>
### Ownership under contact
Customer-as-state, two-Projects, revenue-never-in-PLOS, corpus-never-in-Admin all survived implementation
untouched. The razor-sharp split: every ownership rule with a mechanical enforcement has a zero-violation
record; every prose-only rule drifted within ~48h. The PLOS seam needed zero new business logic
(one-derivation-many-consumers). → D-OWNER, D-ONEDERIVE.

<a id="relayed-prose"></a>
### Relayed prose vs contracts+probes (both sides of the same seam)
Admin's record: every cross-system request arriving as relayed prose contained at least one false claim (a
"live" URL, a "pre-rotation" secret); every request grounded in contracts and tokens worked first time. One
relayed message asked for an action on another workload's process — correctly refused and verified
independently. The LLM-narrates-tools rule is the runtime twin: operational facts are always tool calls;
figures render from tool JSON. → K16, K30, D-CONTRACT, D-NARRATE.

<a id="cutover"></a>
### The Admin cutover — the positive exhibit
Drift sentinels bracketing the window · same-day rehearsal with identical tooling · one-transaction load ·
reconciliation exact to the cent across €11,311 (zero deltas) · at least one number hand-derived from raw due
dates · legacy preserved as fallback · the production run was boring. Operating began at a NAMED moment, which
is why the readiness machinery actually fired there and never fired at the sibling (the trigger, not the
checklist, was the missing piece). The lookalike-IBAN catch (NL13… vs NL33…) happened only because both
verbatim values were printed side by side. → S10–S12, K20–K26, D-CUTOVER, D-REHEARSE, D-DERIVE.

<a id="migration-fidelity"></a>
### Migration fidelity notes
Schema was once applied into the live legacy production project on an unverified "fresh project" assumption
(harmless, but an unverified assumption acted on). ~150KB of source data was hand-transcribed twice because
programmatic access wasn't secured day one. Under-merge proved recoverable; over-merge co-mingles history.
→ D-ENV, D-RECOVER, S11.

<a id="platform"></a>
### Platform-conventions archaeology done late
Three deploy cycles lost to documented platform behavior (framework preset, --scope, IPv6-only direct DB,
pooler prepare:false), plus a BOM-corrupted env var from a legacy-shell pipe and an all-zeros password from a
missing RNG API. → D-PLATFORM, S15, Governance §15 byte/secret rule.

<a id="long-pole"></a>
### Founder acts are the long pole
The operating bottleneck was never lead volume — it was founder send-time and credential/approval latency
(room-phase bottleneck #1; S43). The permission classifier acted as a correct fourth enforcement layer: a
refused token mint and two refused premature production actions. → K24, K31, D-LONGPOLE, D-CREDS.

<a id="held-invariants"></a>
### What held untouched (the never-moves list earns its place)
The §0 invariant block (D1–D9-class) survived 75 PRs essentially untouched and compounded — later capabilities
rode append-only + provenance designed before their consumers existed. Deterministic-over-LLM held 100% in
both repos under pressure. The waterline held through an actual segment pivot. → K1, K14, D-SPINE.

<a id="reversals"></a>
### Pre-registered reversals made being wrong cheap
S41→S42→S44: three behavioral pivots, one mount change each, because every bet shipped with its reversal
pre-registered — arguably v1's deepest strength: every wrongness was survivable, findable, one commit from
fixed. The S44 verification mechanically rehearsed the reversal (R1/R2, sha256-identical restore). → K18, T2, S1.

<a id="decision-packages"></a>
### Pre-framed decision packages (second witness)
Admin: 17 surfaced decisions cleared in two founder messages (D1–D10 + session). PLOS independently named the
same pattern the single most effective founder-workload reduction. Refusal-gated execution (`--ack-decisions`)
converted "did we agree?" from memory into mechanism. → S10, D-OVERASK, D-REFUSE, D-SURFACE.

<a id="n1-unproven-packaging"></a>
### N1 — the skills-first conversion (earned content, unproven packaging)
Admin's 7 earned skills (each with `earned_from`, practices fired 6/3/2/3/2/2/1 times pre-codification) were
shipped in its repo's FINAL commit (`43fcd53`); no work has executed on top. The "~3 hours faster" claim is a
projection, not a measurement — and the conversion itself bypassed §14 and minted a version label from an
overlay. Verdict carried into v4: adopt the content now; the packaging's first real test is the named adoption
moment (Admin: the June invoicing run). → N1, F1, S9 red flag.
