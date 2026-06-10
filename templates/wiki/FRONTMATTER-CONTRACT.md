# Wiki — the knowledge layer (frontmatter contract + boundary)

> The wiki is a **navigable home for genuinely homeless, project-local knowledge.** It is **not** a second source of truth. Its value is *inversely proportional to how much it restates* — where a fact has a canonical home, the wiki **POINTS**; it only **OWNS** knowledge that has nowhere else to live.
>
> **Design intent (do not "tidy away"):** the wiki is deliberately a clean, ID-keyed, provenance-tagged corpus. A future knowledge-product (e.g. **Content OS**) may **consume it read-only** (the way the Website consumes Inventory — ECR-0002). That optionality is a *side-effect* of good hygiene, never a reason to add content-pipeline machinery here.

## What lives here vs. what POINTS elsewhere (one source of truth per concern — Governance §7)
| Concern | Home | Wiki does |
|---|---|---|
| **Project narrative, learnings, retros** | `wiki/` | **OWNS** |
| **Market understanding** (segment/competitor/corridor *intelligence*) | `wiki/market/` | **OWNS** |
| **Customer understanding** (ICP playbook, persona narrative, objection handling) | `wiki/customers/` | **OWNS — playbook only** |
| **Business processes** (operational SOPs) | `wiki/processes/` | **OWNS**; engineering processes → POINT to `delivery-os/processes/` |
| **Company / operational context** | `wiki/company/` | **OWNS** (strategy → POINT to ecosystem `08`) |
| Owns/consumes, source-of-truth, glossary, projects, integration, decisions | `../ecosystem-architecture/` (06/10/02/05/09/11, ECRs) | **POINT, never restate** |
| Business truth (BRIEF/MISSION/NORTH-STAR/ADRs) | `docs/` | **POINT** |
| **Records** (Organisation, Lead, Property, Deal, Contract, Invoice…) | their system-of-record | **POINT** — never store a record |
| Agent cross-session continuity | `memory/` | the inbox, **derived** — wiki never caches memory |

**The dividing line, in one sentence: records vs. understanding.** A *record* belongs to a system of record (the Spine, the app DB). *Understanding* is homeless → the wiki. The wiki may **reference a record by its stable ID** but storing record-shaped fields makes it a second master — forbidden.

## Folders (earned, not scaffolded)
Only `_index.md` exists at adoption. A folder/page is created the first time a **Write-back** (operating loop) has real content for it — *not* in anticipation. (`OPERATING-LOOP.md`: no empty speculative folders.)
```
wiki/
├── _index.md      # the navigable map the CLAUDE.md router (§4) points to; one line per page
├── company/  market/  customers/  processes/  learnings/   # created on first real content
```

## The frontmatter contract (every page carries it)
```yaml
---
title: <human title>
id: <stable-slug>                 # never changes; links + dedup target
kind: learning                    # domain-intelligence | finding | learning | process | design-spec | preregistration | index
source_of_truth: this-file        # OR a pointer: docs/NORTH-STAR.md | ecosystem-architecture/06 | demand-crm-spine
as_of: YYYY-MM-DD                 # the AS-OF date the content was true (alias: last_verified) — freshness anchor
last_verified: YYYY-MM-DD         # last re-confirmation (may equal as_of)
author: <who asserted it>         # attribution
stability: current                # current | stale | locked | frozen | superseded-by:<id>
audience: internal                # internal | shareable  — coarse distribution boundary
confidentiality: normal           # normal | sensitive    — sensitive = legal/financial/PII, fail-closed
review_cadence: 90d               # 30d | 90d | 180d | event-driven
references_ids: []                # stable Organisation/Contact/Property IDs this page CITES (never stores)
---
```
**Field rules:**
- `kind` ⇒ the cluster a page belongs to (the taxonomy emerged from the real corpus). It makes the corpus **machine-routable by type** without folder-as-type (lifecycle cuts across topic folders). Mandatory. **`kind: finding`** additionally **requires `as_of`** and is **append-only** (a finding quotes record values as-of a date; it is never edited, only superseded).
- `stability` ⇒ `locked` = a controlled artifact that changes only via a dated supersession (e.g. a locked design-spec); `frozen` = append-only-amendments-only (e.g. a pre-registration frozen once the first outcome is logged). These are *lifecycle states with edit rules*, not just "more stable than current".
- `source_of_truth ≠ this-file` ⇒ the page is a **pointer/narrative**; it must **not** introduce a fact absent from its cited source (drift = defect).
- `last_verified` + `stability` ⇒ a page past its `review_cadence` is flagged `stale`; **a recalled fact is a time-stamped belief — verify before relying** (the memory rule, applied to the wiki). The reader (Claude) renders a stale hit with an explicit "as of <date>, may be outdated" wrapper.
- `audience` / `confidentiality` ⇒ the **publish-safe-by-construction** guardrail. `sensitive` is never `shareable`. *(Justified today by ECR-0003 / `06` sensitive-data rules; also what makes the corpus safe for any future read-only consumer.)*
- `references_ids` ⇒ a customers/market page may *cite* an Organisation by its shared platform ID, but storing record fields (status, score, email, deal stage) is rejected — **`wiki/customers` is zero-records (ECR-0003 LOCKED).**

## AI-OS reference-model alignment
- **Maps to:** the OS "Context" layer — durable, navigable knowledge.
- **Deviation:** we **do not** create a full wiki tree; we drop `decisions`/`glossary`/`projects` and forbid record storage. **Why:** the ecosystem layer already owns those (LOCKED) — a parallel copy is a §7 drift defect. The wiki holds *only* homeless understanding. Burden of proof is on adding any folder that shadows a canonical store — unmet.
