# The Capability Lifecycle — how a lesson in one project becomes every project's capability

> **v6 operating-model element (founder-ratified 2026-06-15).** A lesson MUST NOT stay project-local. The
> canonical loop makes every major delivery-os upgrade make *all* projects smarter, because they inherit what
> was learned elsewhere. Admin learns from PLOS; PLOS learns from Admin; future projects learn from both without
> rediscovering the same failures.

## The canonical path (no shortcuts, no parallel mechanisms)
```
Project discovers a lesson / recurring failure / workflow insight
   → file-lesson         (UPSTREAM hop: tag it with the project, record in the canonical signals corpus)
   → census-detector     (aggregate ACROSS projects; ≥3× distinct sources OR ≥2 projects = candidate, fail-closed)
   → CAPABILITY-LEDGER   (the ONE queue: candidate → building → verified → in-OS)
   → build + verify in delivery-os   (author≠verifier; it becomes CANONICAL — a tool/skill/agent/gate)
   → OS release          (version bump of delivery-os)
   → os-inherit          (DOWNSTREAM hop: every project re-syncs → inherits the new capability)
   → ALL projects now operate with the lesson baked in
```
Every hop is **executable**, not a convention to remember:

| Hop | Mechanism (canonical, in delivery-os) | Gate |
|---|---|---|
| capture a lesson | `learning-review` (post-milestone) · `file-lesson.mjs` (ad-hoc) | learning-review is mandatory post-milestone |
| route up, cross-project | `census-detector.mjs` over `capabilities/signals.jsonl` (project-tagged) | fail-closed: un-triaged ≥3× or ≥2-project pattern blocks |
| queue | `capabilities/CAPABILITY-LEDGER.md` (the ONE ledger) | every candidate has a destination + owner |
| build canonical | the responsible agent (e.g. integration-architect) builds it IN delivery-os | author≠verifier + §11 |
| release | delivery-os version bump | the upgrade is the release event |
| propagate down | `os-sync` (agents) + `os-inherit` (tools/skills/contracts), drift-checked | `os-inherit check` fail-closed |

## Cross-project learning (the point)
The signals corpus is shared + **project-tagged**. A pattern that appears in **≥2 projects** is auto-flagged
`CROSS-PROJECT → promote to delivery-os` by census — because a failure hitting two projects is generalizable and
belongs in the OS, not re-solved twice. That is the mechanical form of *"Admin learns from PLOS, PLOS learns from
Admin, future projects learn from both."*

## Ownership / scope (founder-ratified 2026-06-15 — PLOS is a product, not a proving ground)
- **delivery-os = canonical OS** — the only home of built capabilities, the only ledger, the only propagation path.
- **Admin = THE proving ground** — new/immature capabilities are deliberately built, used, and matured HERE against
  Admin's real surfaces until the maturity progression is proven. Admin may hold partially-complete v6 work.
- **PLOS = a product; it RECEIVES mature capabilities only** — never a discovery ground. NO half-migrations into
  PLOS while a capability's behavior is still being figured out. PLOS inherits a capability via os-inherit ONLY
  after it is Built → Verified → **Used in Admin** → maturity-progression-validated → behavior-proven → in-OS.
- **Future projects = inherit** — a fresh project runs the sync and starts with the accumulated, MATURE learning.

## The mandatory sequence before any major PLOS propagation
```
Capability → Build → Verify → USE IN ADMIN → validate maturity progression → prove the intended behavior
   → add to delivery-os foundation (in-OS) → THEN inherit into PLOS
```
The bar is **evidence the capability genuinely OPERATES (in Admin), not evidence it can be copied.** A capability
that is only "verified" or only "copied into a project" has not earned PLOS. PLOS receives maturity, never
discovery.

## The standing test (re-run every milestone)
The loop is operating only when: a real lesson this milestone was **filed → flagged → queued → built in
delivery-os → released → inherited by the other project** with no human re-discovery. Anything that stalled at
"project-local" is a broken loop — route it up.
