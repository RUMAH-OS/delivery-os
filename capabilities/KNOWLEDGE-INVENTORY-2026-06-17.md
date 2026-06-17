# Knowledge Inventory & Classification — 2026-06-17

> First inventory pass for the Founder OS knowledge migration (founder initiative 2026-06-17).
> This is the human-readable SUMMARY. The exhaustive per-file classification is to become the
> Knowledge Harvester's structured manifest (`knowledge-inventory.jsonl`) — NOT a 700-row markdown
> (that would re-commit the disease). Method = manual fan-out (3 Explore lenses); this is the
> baseline the Harvester re-runs against. Companion: KNOWLEDGE-ARCHITECTURE.md (system) +
> KNOWLEDGE-MIGRATION-PLAN.md (sequencing).

## Headline
**~700 knowledge markdown files** across three repos. ~430 carry durable knowledge; **~270 are archive-only** point-in-time records (VERIFY docs, slice charters, dated assessments/reviews) whose durable learning must be harvested, then the source archived. This is the founder's stated risk, quantified.

## Per-repo totals
| Repo | Files (knowledge) | Durable | Archive-only | Notes |
|---|---|---|---|---|
| rumah-admin | ~325 | ~167 | ~158 | 150+ VERIFY-* (archive); 14 earned skills; 10 ADRs; 8 discovery deep-reads (Wiki); 3 §11 reviews |
| delivery-os + ecosystem-architecture | ~156 | ~89 | ~64 | ecosystem = ~20 CONTRACT docs (registry 01–11 + ECR-0001..0007) LOCKED; delivery-os core/skills/templates already canonical; ~13 capabilities/*.md are point-in-time (G8–G14, readiness assessments) |
| property-lead-os | ~196 | ~140 | ~4 + 83 VERIFY + 29 slices (reference) | execution-heavy; 4 ADRs; wiki earned-empty by design; 16 cross-repo merge candidates |

## Bucket distribution (approximate, ecosystem-wide)
- **Wiki** (reusable claim/principle/architecture) — ~60: business truth (NORTH-STAR/MISSION/BRIEF), discovery deep-reads, core/ (OPERATING-LOOP, GOVERNANCE, DoD, SEVERITY), V6-ARCHITECTURE, design docs.
- **Skill** (executable procedure) — ~35 earned across repos (Admin 14, delivery-os 24+ incl. domain packs, PLOS 7) — already the strongest, never-archived bucket.
- **Workflow** (object lifecycle) — ~25: templates + lifecycle docs + runbooks; the named lifecycles (lead/tenant/invoice/payment/contract) mostly IMPLICIT, not yet structured Workflow artifacts.
- **Health** (monitoring rule) — ~15 durable + the VERIFY-* archive layer; named health domains (seam/CI/mail/OAuth/LinkedIn/deploy) partly exist as tools, not as Health artifacts.
- **Objective** (completion/success/attention) — ~30: PROJECT-BRIEF/MISSION/NORTH-STAR, AUTO-EXEC-CRITERIA, V6-LANDED-DEFINITION, CAPABILITY-LEDGER, DoD.
- **Contract** (event schema/API/shared model) — ~47: the ecosystem registry (01–11) + all ECRs + the admin-plos seam + inventory-api + templates. Already the most rigorously canonical (locked by ECRs).
- **Archive-only** — ~270: VERIFY-* (≈270 across repos), slice charters, dated assessments/feedback/postmortems, superseded proposals.

## Cross-repo merge clusters (the Curator's first targets — "one canonical answer per concept")
1. **The knowledge-system docs themselves (the meta-disease):** `KNOWLEDGE-ARCHITECTURE.md` (new) ↔ `KNOWLEDGE-LAYER-ARCHITECTURE.md` (existing board seam contract) ↔ `KNOWLEDGE-ADOPTION-GAP.md` ↔ `G12-KNOWLEDGE-ENGINEERING-GAP.md`. **Action:** new ARCHITECTURE supersedes/absorbs the gap docs; reconcile with the LAYER seam contract (it owns the executable seam). Do this FIRST — dogfood the Curator on its own house.
2. **Admin↔PLOS integration contract (ECR-0006):** `rumah-admin/docs/contracts/*` ↔ `property-lead-os/docs/contracts/plos-event-consumer-contract.md` ↔ `ecosystem-architecture/decisions/ECR-0006` + `06-registry`. Hand-synced + drifting → collapse to ONE canonical Contract (the executable `admin-plos-seam-v1.mjs` is source of truth; prose consumes it).
3. **Identity/Contact boundary:** Admin tenant ↔ PLOS `0003-identity-boundary` ↔ the in-flight ECR-0007. Keep distinct concerns but single-source the boundary.
4. **Mailbox/OAuth:** PLOS `mailbox-auth-permanent-model` + OAuth decision reviews ↔ Admin's (now-stood-down) mailer. PLOS-local product-ops; Admin references.
5. **V6 readiness/assessment snapshots (delivery-os):** OPERATIONAL-READINESS-*, PLOS-V6-MIGRATION-AUDIT, RUNNER-SPAWNER-ASSESSMENT, G8/G9/G13/G14 → archive (live measurement = capability-health/agent-health telemetry).
6. **Retrospectives/feedback:** Admin RETROSPECTIVE-2026-06-12/13/15 + delivery-os OS-FEEDBACK-* → mine for lessons → KU/Skill, then archive.

## Highest-value durable knowledge to harvest first
- **Objective/Wiki:** NORTH-STAR · PROJECT-MISSION · PROJECT-BRIEF (Admin); AUTO-EXEC-CRITERIA · V6-LANDED-DEFINITION · CAPABILITY-LEDGER (delivery-os); project-vision (PLOS).
- **Skill (already earned, just register/cite):** verification-playbook · legacy-migration-etv · cutover-execution · decision-ratification · ops-truth-integration · contract-grounding · principle-11-review.
- **Wiki (business rules):** invoicing-gap-analysis · contract-signing-current-state · invoice-immutability · owner-fee-billing · management-fee-vat (Admin).
- **Contract:** the ecosystem registry (06) + the admin-plos seam + ECRs — already canonical; bind citations.

## Notable gaps the inventory exposed (durable knowledge that does NOT yet exist as a structured artifact)
- **Workflow bucket is thin** — the named object lifecycles (lead/tenant/invoice/payment/contract) live as prose/code, not as Workflow artifacts.
- **Health bucket is thin** — named health domains exist as tools/VERIFY records, not as Health-rule artifacts.
- **Objective bucket** — completion/success/attention logic is scattered across BRIEF/DoD/AUTO-EXEC; not consolidated.
These are "create-when-first-needed" per the migration principle — the Harvester surfaces the demand.

## Status
DRAFT baseline. The exhaustive per-file classification is in the three 2026-06-17 inventory passes and will be codified as the Harvester's `knowledge-inventory.jsonl` (the structured, re-runnable home). Founder ratifies the architecture + plan; implementation gated post-V6 + N=1, but the Harvester+Curator can be BUILT now and run report-only (per KNOWLEDGE-MIGRATION-PLAN sequencing: Curator/filter before Harvester/firehose).
