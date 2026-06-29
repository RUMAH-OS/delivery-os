# Design — `capability-ux-audit` (the reusable Capability UX + Review Audit)

> Brief design doc for the skill defined in `SKILL.md`. Scope of THIS doc: the generic parameterization, the
> agent fan-out topology, the I/O contract, and the Slack/goal invocation seam. **Implementation of the Slack
> wiring is a later slice** — this is design + the skill definition.

## 1. The problem it generalizes

On the Owner-Invoices enterprise overhaul (2026-06-27) we ran, by hand, two parallel read-only audits — a
finance/backend lens and a UX/design lens — against the founder's explicit enterprise bar, then synthesized the
gaps and built against them. It worked: it caught a *backend-complete but user-facing-incomplete* capability (no
detail page; a grouped view computed-then-dropped at the API adapter; a list that would crash on the first real
invoice) and the fixes were independently verified PASS. The same audit-then-fan-out shape had already paid out
on the 2026-06-26 invoice-delivery pipeline (8 parallel specialist audits → one decision package).

The recurring thing is **not** Owner-Invoices — it is the *coordination*: *given any capability + its surfaces +
a bar, run parallel backend + UX audits and synthesize a prioritized findings report.* This skill makes that a
one-call, parameterized, Slack-invokable platform capability instead of re-orchestrating it every time.

## 2. Generic parameterization (what makes it NOT Owner-Invoices-specific)

The skill takes the capability as **data**, never hardcodes it:

| Parameter | Example (Owner-Invoices) | Example (a future capability) |
|---|---|---|
| `capability` (name) | `owner-invoices` | `deposit-settlement`, `owner-payouts` |
| `surfaces.http` | `GET /admin/owner-invoices/:id`, `POST …/generate` | the capability's own endpoints |
| `surfaces.ui` | `owner-invoices`, `owner-invoices/:id` routes | the capability's routes |
| `surfaces.docs` | the management-fee PDF | exports / statements |
| `surfaces.events` | `owner_invoice.*` outbox events | the capability's events |
| `surfaces.data` | `0047/0048/0049` migrations, snapshot shape | the capability's model |
| `bar` (verbatim) | "IMMEDIATELY show owner · period · properties · contracts · fee · VAT · subtotal · total · full breakdown; GROUPED not flat; scales to dozens" | whatever the founder/criteria state |
| `packs` | finance → security-compliance + database-data | derived from the surfaces |

The bar is the **rubric**; the surfaces are the **map**. Both are inputs, so the procedure is identical across
capabilities.

## 3. Agent fan-out topology

```
                       ┌─ capability-ux-audit (coordinator) ─┐
                       │  frame: name + surfaces + BAR        │
                       └──────────────┬──────────────────────┘
                  ┌───────────────────┴───────────────────┐   (parallel, read-only, blind to each other)
                  ▼                                         ▼
   BACKEND / FINANCE lens                          UX / DESIGN lens
   software-engineer                               design-parity (if a reference exists)
   + database-data   (data systems)                else accessibility
   + security-compliance (money/PII/e-sign)        → surfaces as-built (per row/screen/doc)
   + api-integration (integrations)                → gaps vs bar (grouped? breakdown visible?
   → data model · calc pipeline · idempotency        contracts visible? scale to dozens?)
     · immutability · events/seam · payment         → missing reusable UI primitives
     · audit · reusability
   → as-built + gaps (file:line, severity)         → as-built + gaps (file:line, severity)
                  └───────────────────┬───────────────────┘
                                      ▼
                          SYNTHESIS (consolidator)
                          reviewer-critic + lead-architect   (author ≠ each lens)
                          · cross-cut + de-dupe gaps
                          · SURFACE every lens disagreement (never smooth — §11)
                          · explicit PASS/FAIL per bar item
                          · prioritize P0/P1/P2
                          · name reusable-extraction candidates
                                      ▼
                  docs/audits/CAPABILITY-AUDIT-<capability>-<date>.md
```

- **Lenses are read-only and independent** (no shared draft → no anchoring), mirroring `principle-11-review`.
- **Pack-conditional lenses** are selected from the surfaces, not always-on: money/PII ⇒ security-compliance;
  data model/migrations ⇒ database-data; cross-repo events/seam ⇒ api-integration.
- **The consolidator is not a lens** — it owns no findings of its own, only the synthesis + prioritization, and
  it must surface disagreements rather than average them.

## 4. I/O contract

**Input** (a goal payload or a direct invocation):
```json
{
  "capability": "owner-invoices",
  "surfaces": {
    "http": ["GET /admin/owner-invoices/:id", "POST /admin/owner-invoices/generate"],
    "ui":   ["owner-invoices", "owner-invoices/:id", "owner-invoices/generate"],
    "docs": ["management_fee PDF (src/invoice-pdf.ts)"],
    "events": ["owner_invoice.*"],
    "data": ["migrations/0047_owner_fee.sql", "snapshot partySnapshot.ownerFee"]
  },
  "bar": "<verbatim founder/quality criteria>",
  "repo": "rumah-admin",          // read-only checkout
  "packs": ["security-compliance", "database-data"]   // optional; else derived from surfaces
}
```

**Output:** one report `docs/audits/CAPABILITY-AUDIT-<capability>-<date>.md` containing:
1. TL;DR verdict + the bar verbatim.
2. Per-surface **as-built** (backend + UX), every claim `file:line`-cited (`TBD — verify` when unknown).
3. **Gaps-vs-bar** table with severity (HIGH/MEDIUM/LOW) and the lens that found it.
4. **Explicit PASS/FAIL per bar item.**
5. **Prioritized recommendations** P0/P1/P2, each pointing at the gap + `file:line`.
6. **Reusable-extraction candidates** (shared primitives/abstractions).
7. Lens disagreements, surfaced.

The report is the *only* artifact; the build is a separate slice and its proof is `verify-gate`.

## 5. Slack Control Surface invocation (the `/v1/goals`-style seam)

The skill is registered as a **goal-routable capability** (v6 `capabilities: [audit-capability]` +
`triggers`). The founder types into Slack, e.g.:

> `/goal audit the deposit-settlement capability against the enterprise bar`

Flow (the wiring is a later slice; this is the contract):
1. The Control Surface parses intent → enqueues an `audit-capability` goal with the input payload above (the
   founder gives the capability name + bar in words; surfaces are resolved from the capability's registered
   surface map, or the engine asks one clarifying question).
2. The engine routes the goal to this capability (the same `OWNER_INVOICE_PACK`-style goal→handler routing the
   project already uses for engine packs).
3. The coordinator fans out the read-only lenses, synthesizes, and writes the report.
4. The engine returns the **TL;DR verdict + P0 list** to the Slack thread, with a link to the full report
   artifact.

**Why it is safe on the unattended/Slack path:** the capability is **read-only by construction** — it writes
only `docs/audits/**`, never `src/**`/`admin-ui/**`/`tests/**`, and holds no outward/irreversible tool (it
sends/posts/charges nothing). Unlike money-mutating goals (which are dry-run-only + human-gated, e.g.
owner-invoice generation), `audit-capability` needs **no human gate to RUN** — its *recommendations* still gate
any subsequent build/go-live, but producing them is harmless. So it can live on the prod goal roster even while
the capabilities it audits stay off it.

## 6. Relationship to existing skills (no overlap)

- `migration-assessment` — dispositions **every** capability of a whole system (keep/modernize/rebuild). This
  audits **ONE** capability against **a bar**. Sibling, narrower.
- `verify-gate` — proves a *built slice* closed its gaps (author≠verifier). This is **upstream**: it finds the
  gaps to build. A typical loop: `capability-ux-audit` (find) → build slice → `verify-gate` (prove).
- `principle-11-review` — adjudicates a *consequential decision*. This audits *as-built reality*; it may feed a
  P11 if a gap forces a consequential call (e.g. a model change for per-property VAT).
- `production-readiness-review` — the *go/no-go*; this is one of its inputs, not a replacement.

## 7. Open design choices (flagged, not pre-decided)

- **Surface resolution.** Does the founder always supply surfaces, or does the engine maintain a per-capability
  surface registry it reads (less founder effort, more upkeep)? Recommended: a registry with a one-question
  fallback — decided at the wiring slice.
- **Default packs.** Derive pack lenses purely from surfaces (automatic) vs. let the goal override. Recommended:
  derive + allow override.
- **Multi-repo capabilities** (e.g. an Admin↔PLOS seam capability): the fan-out must accept >1 read-only repo
  and add the `api-integration` seam lens — supported by the input contract (`repo` → `repos[]` at the wiring
  slice).
