# Semantic-Compatibility Inheritance Gap — RCA + Recommendation

> integration-architect (seam/propagation owner) · 2026-06-16 · **DRAFT for independent verifier.**
> Read-only investigation. Decision-grade. Gates the V6 inheritance-machinery hardening item.
> Companion to G8-SEAM-RCA.md (same class, cross-repo edge); this is the intra-OS propagation edge.

## Verdict (one line)
An `os-inherit sync` re-vendored a **stale canonical `skill-route.mjs`** over the locally-evolved
copy, dropping exports the dispatch-runner imports → the runner crashed at load — **and every
inheritance guard stayed GREEN**, because the entire propagation path verifies *byte-currency*
(`sha(vendored) == sha(canonical)`) and **nothing verifies that importers' required exports still
exist**. Byte-identical is not semantically compatible. This is a NEW propagation/inheritance
validation gap, distinct from drift (G8 was a consumer that never inherited; this is a consumer that
inherited *correctly* and was still broken).

---

## 1. Root-cause review — the precise mechanism

Four steps, each individually defensible, compose into a silent break:

**(a) Local evolved beyond canonical (gained semantic surface).**
The live `skill-route.mjs` exports `loadSkills`, `routeTask`, `scoreSkill`, `mintProofId`,
`injectionMarker`, `appendSelection`, `readSelections` (templates/tools/skill-route.mjs:40–121). The
dispatch-runner imports a subset of these. At some point the *local* copy carried exports the
*canonical* copy did not yet have — local evolution outran the canonical it was vendored from.
("Propagate UP before sync" was not enforced, so canonical lagged.)

**(b) Sync re-vendored canonical → vendored, byte-for-byte.**
`doSync` writes `writeFileSync(dest, buf)` — exact bytes from canonical — and records
`sha256(canonical)` into INHERITED.json (os-inherit.mjs:76–77). The vendored copy is now byte-current
with a canonical that is *behind* what the importer needs. The locally-evolved exports were
overwritten away.

**(c) `os:check` verifies BYTE-CURRENCY, not export-currency.**
`doCheck` is exactly: `if (sha(read(dest)) !== sha(read(it.src))) violations.push("DRIFT…")`
(os-inherit.mjs:94–98). PASS literally means "vendored bytes == canonical bytes." After the sync,
that equality held perfectly. The check passed *because* the bad sync did its job correctly.

**(d) A stale-but-self-consistent canonical passes every gate while breaking a dependent.**
There is no step anywhere in `sync` or `check` that loads the tool, enumerates its exports, or runs
the importer. So a canonical that is internally valid and byte-vendored faithfully sails through —
the break only surfaces at *runtime*, when the runner does `import { … } from "skill-route.mjs"` and
the named export is `undefined`. That is precisely the V6 anti-pattern: caught by the founder/runtime
at integration, not by CI before the send.

### Why each existing guard was blind (named, honestly)

| Guard | What it actually asserts | Why it stayed GREEN |
|---|---|---|
| `os-inherit check` (os:check) | `sha(vendored) == sha(canonical)` for each manifest file (os-inherit.mjs:94–98) | The sync made them byte-equal **by construction**. A correct re-vendor of a stale source is, to this check, a PASS. It cannot see exports. |
| `INHERITED.json` hash | Records `sha256` of each vendored file (os-inherit.mjs:77) | It is a *byte fingerprint*. It was byte-current the whole time — that is the point of the finding. A hash of the wrong-but-consistent bytes is a correct hash. |
| `drift-lint` (check-os-drift.mjs) | Router §5 skill rows ↔ `.claude/skills/<name>/SKILL.md` exist; CODEOWNERS `@handle` ↔ agent file exists; version-stamp WARN (check-os-drift.mjs:23–48) | It validates **existence of files behind names** (phantom-dispatch), not **existence of exports behind imports**. `skill-route.mjs` existed and was byte-current; drift-lint never opens it for its export surface. |

The common blind spot: **all three operate on file *identity/existence*, none on the *semantic
contract a file offers to its importers*.** The thing that broke (an export an importer depends on)
is invisible to every one of them.

---

## 2. The class of regression — generalize beyond skill-route

This is not a `skill-route` bug. It is a **propagation-path class**:

> **Any sync where canonical lags local evolution, OR where a tool/contract's SEMANTIC surface
> changes incompatibly while its bytes stay self-consistent, passes every byte-based guard and
> detonates at the importer.**

The semantic surface that byte-checks cannot see:
- **Tool exports** — a removed/renamed `export function` (this incident).
- **Function signatures** — a changed arity/argument shape; importer compiles, fails at call.
- **Schema/contract fields** — a renamed or retyped field on the seam contract.
- **Behavior/encoding** — a field's encoding flips plain-text↔HTML (FV-4) with the *shape* unchanged.

**This is the same disease as the seam contract** (G8): a contract field rename is *byte-current per
consumer* (the consumer's vendored copy matches canonical exactly) yet *semantically breaking* (the
producer now emits `foo`, the consumer validates `bar`). Per-side byte equality and even per-event
shape conformance are necessary, not sufficient — exactly the capability-#16 "validate workflows, not
just events" lesson, now generalized to **"validate the importer's contract, not just the file's
bytes."** Byte-identical ≠ semantically compatible, at the tool seam and at the data seam alike.

Two directions of the same gap, both unguarded today:
- **Stale-canonical (this incident):** canonical behind local → sync *removes* needed surface.
- **Breaking-canonical (the future one):** canonical changes surface incompatibly → sync *delivers*
  a faithful copy of a break. The byte-check happily confirms the break is byte-current.

---

## 3. Recommendation — a fail-closed SEMANTIC-COMPATIBILITY check in the propagation path

Three candidates were on the table; pick the strongest **and** smallest.

**(a) Export-contract manifest per inherited tool.** A declared list of exports/signatures importers
depend on, verified post-vendor. *Strong, but* it adds a second source of truth that itself drifts
(who updates the manifest when an export is added?) and it cannot catch *behavioral* breaks — it
re-checks shape, the thing byte-checks almost already imply.

**(b) Post-sync importer self-tests.** Every manifest-tracked tool already ships a `--self-test`
that exercises its real exports through its real importers (skill-route.mjs:124–163 is a worked
example: it imports and calls `routeTask`, `mintProofId`, `injectionMarker`, `appendSelection`,
`readSelections` and asserts behavior). Run each tool's `--self-test` against the **vendored** copy
as part of `os-inherit sync` (and `os-inherit check`). A dropped/renamed export → the self-test
throws on import → **the sync exits non-zero and the vendor is rejected.** This catches (a)'s cases
*and* behavior, reuses an existing convention, and keeps truth in ONE place (the test next to the
code). It is also self-reinforcing: the manifest already lists the tools; we just *run* them.

**(c) "Propagate UP before sync" made enforceable.** The durable fix: local evolution must reach
canonical first. Enforce by having `sync` refuse if the vendored copy carries exports the canonical
lacks (canonical is behind local). Good discipline, *narrow* — it only catches the stale-canonical
direction (a), not the breaking-canonical direction, and not behavior.

**STRONGEST + SMALLEST → (b), with (c) folded in as a free consequence.**
A semantic self-test of the vendored copy fails BOTH when canonical dropped an export the importer
needs (the propagate-up direction) AND when canonical introduced an incompatible change — one
mechanism, both directions, plus behavior. It reuses the `--self-test` convention that already
exists, adds no second source of truth, and is small.

### Design (fail-closed, not full build)
1. **Manifest annotation:** mark which manifest tools carry a runnable contract — e.g.
   `"selfTest": ["templates/tools/skill-route.mjs", …]`. (Tools without one are exempt but *named*,
   so "no self-test" is a visible, deliberate state, not a silent gap.)
2. **`os-inherit sync`:** after writing vendored bytes, for each self-test tool run
   `node <vendored-path> --self-test`. **Any non-zero → the sync FAILS, exits non-zero, and the
   vendor is not recorded as good.** A stale/breaking canonical can no longer be vendored silently.
3. **`os-inherit check`:** same self-test pass appended to the existing byte-currency loop — so CI
   re-asserts semantic compatibility, not just byte-currency, on every run. The PASS line changes
   from "byte-current with the OS" to "byte-current **and** semantically compatible with the OS."
4. **Importer reach (the load-bearing part):** the self-test must exercise the exports the *real
   importers* use, through `import` — not a token-grep. A self-test that does not import the surface
   the runner imports proves nothing (the same trap as "vendoring bytes nobody imports closes
   nothing," G8 §3.2). Where an importer is in a *different* repo/file (the dispatch-runner), the
   tool's own self-test must cover that export surface, or a thin importer-smoke is added.

### Fail-closed (per ku-fail-closed-gates)
A semantic break must **BLOCK** the sync/push, never warn. `sync` exits non-zero and does not leave a
"good" INHERITED.json; `check` exits non-zero in CI. No `--force` default. Contrast the current
`drift-lint` version-stamp path, which is deliberately a WARN (check-os-drift.mjs:46) — that
tolerance is correct for *cosmetic* staleness but is exactly the wrong posture for a *load-bearing
export*. The new gate sits on the fail-closed side of that line.

### Smallest proving slice
**One tool, one negative test, in Admin (N=1 master), end-to-end through the real path:**
1. Add `"selfTest"` for `skill-route.mjs` to `os-foundation.manifest.json`.
2. Teach `os-inherit sync` + `check` to run each self-test tool's `--self-test` on the **vendored**
   copy; non-zero → fail-closed exit.
3. **Negative test (the proof):** temporarily vendor a `skill-route.mjs` with `routeTask` removed
   (a stale canonical) → assert `os-inherit sync` AND `os-inherit check` BOTH exit non-zero with a
   "semantic-compat" violation, where today both pass GREEN.
4. **Positive test:** current canonical → self-test passes → sync/check GREEN.
This proves the exact incident is now caught in CI before a runtime crash, using the self-test the
tool already ships. Hand to QA to re-run the negative test independently (author≠verifier).

---

## 4. Severity + placement

- **Class:** V6 inheritance-machinery / mechanism hardening — NOT a feature, NOT a rollout-scope
  change. It hardens the *guard* on the propagation path the OS already uses.
- **Severity: High (latent-systemic).** The immediate incident was already handled by the
  runner-repair (the crash fixed; the durable "propagate-up" applied for skill-route specifically).
  But that repair fixed *one tool*; the **systemic guard is still absent** — the next stale/breaking
  canonical sync of *any* manifest tool or the seam contract reproduces the exact silent break with
  every gate GREEN. The risk is meta (the same shape as G8 R7 and the V6 founder-burden mandate:
  "validates components not WORKFLOWS → founder becomes the integrator").
- **Placement: V6-completion item, prove in Admin first (N=1 master gate, per the v6 end-state
  architecture note).** Land the smallest slice in Admin's inheritance path; only after it is
  proven (negative test red→green) does it propagate as canonical OS machinery. Sequence after the
  current G8 seam MUST-set; this and G8 are the two faces — tool-seam and data-seam — of one law:
  **byte-identical ≠ semantically compatible; the propagation path must verify the importer's
  contract, fail-closed.**
- **NOT to do now:** build the check (this is design only); commit anything; gold-plate an
  export-contract manifest when the self-test convention already exists.

---

## Citations
- [skill:migration-assessment#0f029ee0bec9] — judged PARTIAL relevance: framed as a capability-by-
  capability audit of an inherited mechanism (the guard set: os:check / INHERITED.json / drift-lint
  audited one-by-one in §1), but this is a single-gap RCA, not a full inherited-system audit; used as
  lens, not template.
- [knowledge:ku-fail-closed-gates#f5759bfc76fe] — RELEVANT, applied in §3: the proposed
  semantic-compat check must BLOCK (non-zero exit) the sync/push, never warn; contrasted against the
  deliberately-WARN version-stamp path in drift-lint.
- Code anchors (read, this session): os-inherit.mjs:76–77 (byte vendor), :94–98 (byte-only check),
  :77 (sha record); check-os-drift.mjs:23–48 (existence/phantom checks, :46 WARN-only stamp);
  skill-route.mjs:40–121 (export surface), :124–163 (existing `--self-test` to reuse).
- Companion: capabilities/G8-SEAM-RCA.md (cross-repo data-seam face of the same class).
