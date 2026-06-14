# v6 Founder-Validation Friction Log (live evidence for the review)

> Real issues found during the invoice-delivery milestone validation — the measured benchmark slice. Direct
> evidence for the v6 review (charter §1/§5). Per-entry: what · when discovered · who should have owned it · why
> not caught earlier · missing capability. This is a CAPABILITY-shaped capture (a friction log, the proven PLOS
> pattern), not doctrine. Grows during validation; the review consumes it.

| # | What | When discovered | Who should own | Why not caught earlier | Missing capability |
|---|---|---|---|---|---|
| FV-1 | **ASK appears non-functional** (The Room / Advisor) | Founder validation, within minutes | PLOS (Advisor surface) + a Founder-Experience owner | No end-to-end "founder opens it and it works" gate; component-level QA passed | Founder-Ready gate + e2e workflow validation on the real surface before handoff |
| FV-2 | **ASK reports offline while still exposing an active input** | Founder validation, within minutes | PLOS (Advisor surface) | UI state vs backend availability not validated together; a disabled-state contract is unowned | Workflow-state consistency check (surface availability ↔ control state) as part of founder-ready |
| FV-3 | **Repeated prod deploy/migration authorization block** — even with founder authorization present, the harness denied agent execution 3× (0029 migration ×2, general "proceed" ×1) until a *specific* per-action yes | This milestone, repeatedly | Deployment-ownership model (none exists) | No pre-authorized deployment lane; safety guardrail has no "founder-authorized → agent executes" path | A scoped, audited, standing deployment lane (the v6 deployment-ownership model) |
| FV-4 | **HTML-vs-text seam mismatch** (Admin emitted notice.body as HTML; PLOS sends text/plain) | At PLOS's first live-send prep — after both sides' component QA passed | Integration owner (none exists) | No cross-repo seam test asserting content *encoding*, only field presence | Integration Agent + producer-emitted fixture the consumer's CI runs (catch before founder) |
| FV-5 | **send_requested carried no Admin notice** → first live send would skip | At PLOS's first live-send prep | Integration owner | Event contract frozen against Admin's *model* of PLOS's need, not validated end-to-end | End-to-end workflow validation (Admin emits → PLOS consumes → real send) before "done" |

**Recurring signal (corroborates the charter root):** every entry except FV-3 is a *workflow / cross-system* failure that survived *component* QA — discovered at the founder's live validation, the latest/most-expensive point. FV-3 is the deployment-ownership gap. Both are co-equal v6 targets: **workflow-quality** AND **founder-burden** (not "too much documentation").
