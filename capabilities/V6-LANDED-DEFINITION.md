# V6 Landed in Practice — the canonical, final definition (2026-06-15)

> Founder-ratified definition. This is the ONE definition of "V6 Landed in Practice." It is not to be
> re-litigated. "V6 mechanism built" ≠ "V6 landed in practice." V6 is landed in practice ONLY when ALL FOUR
> pillars are true AND durable (sustained over ≥M milestones of real product work). A technically correct
> system is not automatically an operationally usable OS — the founder must be able to operate, understand,
> and trust it.

## The FOUR pillars (all four required; the 4th was the missing one)

### Pillar 1 — MECHANISM COMPLETE  ✅ (done)
The enforced operating model is built + independently verified (author≠verifier).
- **Evidence exists:** G1–G14 — slice-gate, cadence, capability/agent/experience health, learning loop,
  product-quality, agent-selection, anti-idle, knowledge layer, skill-usage-proof, knowledge-engineer,
  build-ownership, ownership routing+gate+contribution, dispatch-runner. All block-demonstrated + verified.
- **Missing:** none material (the G9 away-mode envelope is consciously out — see Exclusions).
- **Blocking:** No (complete).

### Pillar 2 — ECOSYSTEM PROOF  🔴
The model is proven in a SECOND app, not just N=1 Admin; knowledge propagates + is reused across apps.
- **Evidence exists:** Admin-side seam hash-checked; runner composes the routers.
- **Missing (PASS bars):** G8.1 seam single-sourcing (PLOS imports the vendored contract, drain calls
  `validateSeamBatch`, a known-bad event FAILs in PLOS, CI `seam:check`); G8.2 PLOS inherits + runs the full
  gate suite GREEN (cannot complete a slice without delivery evidence); E2 update-propagation + multi-consumer
  cross-check (KU bump propagates byte-current; stale consumer FAILs); E3 cross-system reuse (a shared KU
  authored once, retrieved+cited@hash in PLOS on real work).
- **Blocking:** YES. Highest priority.

### Pillar 3 — ADOPTION PROOF  🔴
Over SUSTAINED real product work (in PLOS), the intended operating model is what actually happens.
- **Evidence exists:** mechanism + initial proving-only events (Admin dogfood).
- **Missing (PASS bars, measured by the standing checks over a window of ≥N real product slices):**
  - specialist ownership: contribution-weighted Claude **build** share ≤10%; all 3 specialists (FE/DB/API)
    off-idle owning their turf (ownership-gate PASS, not TOKEN).
  - skills: ≥K skills at HABITUALLY-PARTICIPATES (organic, ≥2 distinct real slices, cited@hash).
  - knowledge: ≥K KUs at HABITUALLY-PARTICIPATES (organic, cited@hash).
- **Blocking:** YES. (Cannot be demonstrated in Admin — requires real PLOS product execution over time.)

### Pillar 4 — FOUNDER EXPERIENCE / OPERATING REALITY  🔴 (the pillar that was missing)
The founder can OPERATE, UNDERSTAND, and TRUST the OS — a technically-correct system that the founder can't
read is not a landed OS.
- **Evidence exists (mechanisms):** ownership-gate Required/Actual/Contribution; dispatch-log (what was
  auto-injected); agent-route `why` rationale; the standing slice/milestone reports; gates fail-closed +
  founder ratifies consequential decisions; away-mode kill-switch (designed).
- **Missing (PASS bar — FOUNDER-JUDGED; cannot be self-certified by Admin/Claude):** a recurring **Founder
  Operability Review** where the founder, UNPROMPTED, from the standing reports ALONE, can answer for a real
  slice/milestone: (1) which specialist owned the work · (2) which skills were used · (3) which knowledge was
  retrieved/cited · (4) WHY each routing/ownership decision was made · (5) "do I trust this without playing
  detective?" — answered YES, **repeated over ≥M milestones** (durable trust), AND demonstrated **founder
  control** (the founder can stop / redirect / override — kill-switch + ratification exercised on real work).
- **Blocking:** YES. PASS = the founder's repeated sign-off, not a tool's green.

## "V6 Landed" vs "AI Operating System" — RESOLVED (founder-ratified 2026-06-15)
The earlier contradiction (this doc excluding autonomy vs `AUTO-EXEC-CRITERIA.md` pre-registering it) is
resolved by SEPARATING the two claims — not by softening either:
- **V6 LANDED = the 4 pillars above (Mechanism · Ecosystem · Adoption · Founder Experience).** Autonomous
  execution is **NOT a blocker for V6 Landed.** When the 4 pillars are GREEN + durable, the V6 roadmap is complete.
- **"AI Operating System" is a SEPARATE, STRONGER claim**, earned POST-V6 via a concrete **Founder Absence
  Test** (the autonomy cluster D/F/H/J — see `AUTONOMOUS-EXECUTION-DEFINITION.md`). Until that test passes, the
  honest label is **"landed V6 delivery model / orchestration layer," not "AI Operating System."**

## EXCLUSIONS (conscious, not oversights)
- **Autonomous self-spawning execution (I)** is OUT permanently: the harness only lets the main loop spawn
  agents; the founder ruled self-spawning is not the success criterion.
- **Autonomous operation (D/F/H/J)** is OUT of the V6-Landed definition but is the **post-V6 milestone** that
  earns the "AI Operating System" claim (Founder Absence Test). Conscious defer, founder-ratified — not a softened bar.
- **Causal/DECISIVE influence (ablation)** is OPTIONAL rigor; TRUST-level (cited@hash + fingerprint) is the
  default bar for "influence." Founder may elect ablation later.

## Ratifiable thresholds (set once, then fixed)
N (real product slices = "sustained") · M (milestones = "durable/normal") · K (skills/KUs = "habitual count")
· Claude-build-share target ≤10%. Proposed: N≥10, M≥3, K≥3, ≤10%. (Founder to confirm/adjust.)

## THE canonical statement
> **V6 is LANDED IN PRACTICE when, durably over ≥M milestones of real product work in a second app (PLOS):
> (1) the mechanism is built+verified [done], (2) the ecosystem runs the same machine with cross-app
> knowledge propagation+reuse, (3) specialists habitually own the work and skills+knowledge are habitually
> retrieved+cited@hash in normal execution (not demos), and (4) the founder can operate, understand, and
> trust the OS from its standing reports alone — without playing detective — and can control it.**
> Mechanism-built is necessary but never sufficient. Autonomous self-spawning is explicitly out of scope.
