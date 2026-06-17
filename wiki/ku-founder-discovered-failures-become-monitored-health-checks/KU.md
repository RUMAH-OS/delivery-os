---
kuId: ku-founder-discovered-failures-become-monitored-health-checks
title: Every failure found in real operation must become a registered Health check
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "Every failure discovered in real operation (founder friction, prod incident, adversarial probe, data scan) MUST yield a registered Health check that auto-detects the same failure next time, before the incident is closed — or an explicit recorded waiver. This is the health analog of 'every retro yields a KU': a failure a human found once that nothing now watches is an un-promoted lesson, so a learning-bearing close cannot be DONE while it is outstanding. A Health check observes running/prod state (after code lands), distinct from a gate (which blocks a change before it lands)."
triggers:
  - "we found a failure in prod — now what"
  - "how do we stop re-discovering the same failure"
  - "should this incident become a monitored check"
  - "founder-discovered failure"
  - "gate vs health check"
  - "can we close this incident"
  - "what's the health analog of every retro yields a KU"
  - "make discovered failures monitored"
topics:
  - discovered-failure-becomes-health-check
  - founder-discovered-to-monitored
  - health-check-vs-gate
  - every-retro-yields-a-ku-analog
  - incident-close-requires-a-check
evidence-strength: runtime-evidenced
cited-quote: "the analog of \"every retro yields a KU\""
source-provenance:
  earned-from: "Founder directive 2026-06-17 ('founder-discovered failures become MONITORED failures') + the Health Framework design that makes it a standing rule"
  source-file: "../delivery-os/capabilities/HEALTH-FRAMEWORK.md"
  anchor: "§2 'The standing rule' (line 134 — the analog of 'every retro yields a KU'; the DISCOVER→ROOT-CAUSE→AUTHOR→REGISTER→SURFACE→CLOSE loop); §1.2 gate-vs-health-check distinction; bornFrom REQUIRED (§1.1)"
  signal-pattern: null
  ratification-note: "Canon source HEALTH-FRAMEWORK.md is a DRAFT (Health Framework, founder-ratification pending) — so this KU is held at runtime-evidenced, NOT founder-ratified. Promote to founder-ratified when the founder ratifies the Health Framework."
related:
  - ku-first-real-use-surfaces-invisible-gaps
  - ku-real-usage-gaps-outrank-design-assumptions
  - ku-implemented-is-not-operationally-proven
  - ku-fail-closed-gates
tags: [health, monitoring, incident-close, gate-vs-health, retro-to-capability, founder-os]
---

# Every failure found in real operation must become a registered Health check

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** Every failure discovered in **real operation** — founder friction, a prod incident, an
adversarial probe, a data scan — MUST yield a **registered Health check** that auto-detects the same failure
the next time, before the incident is closed (or an explicit, recorded waiver saying why no check is feasible).
This is the standing health-side discipline, deliberately built as

> the analog of "every retro yields a KU"

A failure a human found once that nothing now watches is an **un-promoted lesson** — and a learning-bearing
close cannot be DONE while it is outstanding.

**Gate vs Health check (the distinction the rule rests on).** A **gate** blocks a change *before* it lands
(commit/CI; on failure it blocks). A **Health check** observes *running or persisted* state *after* code has
landed (continuously / on a sample; on failure it surfaces + rolls up, it does not block — there is nothing to
block). The founder discovers failures in the second space: things that were green at commit time and broke, or
were never observable, in the running world. A gate guards the producer; a health check watches the outcome.

**Why (the non-obvious reason).** Commit-time gates can only catch what they were written to assert about a
diff; the highest-cost failures are the ones that pass (or were never checked by) those gates and surface only
in production — an email that returns `{success:true}` while delivering zero emails, a list endpoint that 500s
on an empty slug, a persisted-but-undeliverable invoice. If the team's only response is to fix the one instance
and close the incident, the *class* of failure remains unwatched and the founder re-discovers the next instance
by hand. Converting each discovered failure into a standing check is what stops re-discovery — and making it a
*close condition* (with a required `bornFrom` provenance field) is what makes "discovered failures become
monitored failures" structural rather than aspirational. UNMEASURED must count as RED (cannot-observe is not
healthy), or the discipline silently degrades into green-by-blindness.

**How to apply (reusable — the pipeline).**
1. **DISCOVER** — a failure surfaces in real operation.
2. **ROOT-CAUSE** — identify what actually broke and *where the watched state lives* (the running endpoint, the
   live DB row, the rendered artifact, the remote branch).
3. **AUTHOR** — write a Health check: what it watches, the probe, healthy/unhealthy, severity, and
   `bornFrom = <the failure>` (provenance is REQUIRED — a check that cites no real failure is rejected).
4. **REGISTER** — land it in the Health bucket so it runs on a cadence.
5. **SURFACE** — it rolls up into the cross-system health view; RED is visible to the founder, never re-found.
6. **CLOSE** — the incident closes only when (3)+(4) exist, OR a recorded waiver explains why no check is
   feasible. UNMEASURED fails closed (RED, not GREEN). A Health check is read-only — it observes, never mutates
   the domain it watches.

**The test.** Ask: *"for this failure I found in real operation, is there now a registered check that will
auto-detect it next time — or a recorded waiver? If not, the incident is not DONE."* Closing a real-operation
incident with nothing now watching its class violates the rule.

**Runtime evidence anchor (the load-bearing instances — Rumah Admin).** The Health Framework table catalogs
real founder-discovered failures that nothing standing watched: the **email no-op** (signing send returns
`{success:true}` after delivering zero emails — ITEM 1 → `mail-config-health`), the **/v1/inventory 500 on an
empty slug** found by adversarial probing → an `inventory-up` http-probe, and the **duplicate-billing /
undeliverable-invoice cluster** found by a read-only DB scan → a standing `invoice-integrity-health`. Each
becomes a check whose `bornFrom` cites the real incident — the framework's whole value being "a real RED
surfaces a real running failure the founder did NOT have to re-discover."

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the founder's 2026-06-17
directive ("founder-discovered failures become MONITORED failures") and the Health Framework design that makes
it a standing rule, `../capabilities/HEALTH-FRAMEWORK.md` (§2 the standing rule + the DISCOVER→…→CLOSE pipeline,
§1.2 gate-vs-health-check, §1.1 the REQUIRED `bornFrom` provenance, UNMEASURED-is-RED), which STAYS as the
detailed source. Sibling loop-units: `ku-first-real-use-surfaces-invisible-gaps` and `ku-real-usage-gaps-
outrank-design-assumptions` (usage → learning); this KU is the failure → monitoring leg of the same loop. This
KU is the retrievable distilled form; the framework doc is preserved, not replaced.
