# Foundation Review — 2026-06-17 (pre-platform-layer stability gate)

> Founder gate: verify the foundation set is internally consistent + still valid BEFORE building more platform layers. Two independent lenses, blind + parallel: **reviewer-critic** (consistency/contradictions — did NOT author the docs) + **lead-architect** (forward gaps). Constraint honored: "do not redesign unless necessary." No redesign was necessary.

## Foundation set reviewed
ECR-0007 (canonical Contact / single comms) · KNOWLEDGE-ARCHITECTURE + KNOWLEDGE-MIGRATION-PLAN · CAPABILITY-FRAMEWORK-SUFFICIENCY (5-facet completeness standard) · CAPABILITY-MANIFEST-STANDARD · PLATFORM-READINESS-CAPABILITY-EXPOSURE. Cross-checked against the just-built reality (capability-registry + 9 manifests + corrected tool headers; knowledge Harvester/Curator; the ECR-0007 ruling).

## VERDICT: STABLE — build on it (after the fixes below, now applied)
- **Consistency (reviewer-critic): STABLE-WITH-FIXES.** The load-bearing spine is coherent; the founder's D1 ruling propagated correctly into the CANONICAL docs (ECR-0007, FOUNDER-OS-MIGRATION-PRINCIPLE). Issues were stale-prose-vs-built-reality drift + two overturned framings lingering in DERIVATIVE/historical docs. All prose fixes; no redesign.
- **Forward gaps (lead-architect): SUPPORTS-VISION, needs-additions, no structural gap.** PLOS-builds → Admin-makes-discoverable/exposable → Jarvis-consumes is a coherent, additive path on a proven spine. Discovery (declare→discover) already works for any system today. The only redesign-forcing corner — the `ui` facet being component-vs-data ambiguous — is foreclosed by a one-line guard (now applied).

## The founder's 5 focus areas — answered
1. **Contradictions between documents:** Yes, found and FIXED — chiefly F1 (3 docs asserted "OS-owned/vendored" as present-tense fact, false on disk, contradicting the 2 docs that correctly flag it as drift) + the §11 record carrying the overturned policy-owner/host framing + two definitions of "complete." All reconciled by additive prose.
2. **Assumptions invalidated by implementation:** PLATFORM-READINESS "no declare mechanism" is now PARTIALLY false (the registry/manifest was built) — stamped. The mirror-KU=duplicate assumption was pre-empted (captured as a Curator rule: contentHash-locked mirrors = intended vendoring, not dups).
3. **Missing for Delivery OS UI exposure:** the DOS UI shell/host (ranked platform gap #2/#3 — no `delivery-os/ui` exists), AND the `ui` facet must be a DATA-contract (typed view-model over an authenticated read-seam), NEVER a component ref — else cross-system render is impossible. The data-driven intent is now LOCKED in the standard; the full shape is finalized when the shell is built (Waterline).
4. **Missing for Jarvis consumption:** the command/invocation seam (ranked #4 — seam is read+events only), AND the manifest `invoke` descriptor is a locator not an interface (it forced `mail.capability.json` to falsely declare `kind:"none"`). The fix is an additive `invoke` extension (`input/output/sideEffect/idempotent`) built WITH the command seam; `health` similarly gains a typed probe shape WITH the observation aggregator. Both deferred per Waterline; noted in the standard so current `none` reads as "deferred," not "uninvocable."
5. **Does the model still support the long-term vision?** YES. Ownership boundary holds across every doc (Admin=platform, PLOS=operational, Founder OS=intelligence-above); simplicity/Waterline respected (buckets/UI/engine built concrete-before-abstract); the only two strain points (`invoke`, `ui`) are fixable by ADDITIVE extension (unknown fields allowed → existing 9 manifests stay valid). No structural gap; no forced redesign.

## Findings + fixes (all applied 2026-06-17)
| # | Sev | Finding | Fix applied |
|---|---|---|---|
| F1 | Blocker | "OS-owned/vendored" asserted present-tense in KNOWLEDGE-LAYER-ARCHITECTURE/ARCHITECTURE/MIGRATION-PLAN — false on disk; contradicts the manifest+sufficiency docs | Changed to future/conditional ("WILL BE once promoted; today Admin-only; manifest is provenance") |
| F2 | Should | PLATFORM-READINESS "no declare mechanism" invalidated by the built registry | Dated status banner: P1 MISSING→BUILT-not-enforced |
| F3 | Should | §11 record carries the overturned policy-owner/host-split/step-8 framing, unstamped | Top banner: founder ruling final; that phrasing is the panel proposal NOT adopted |
| F4 | Should | "complete" defined two ways (5-facets vs 5-facets+promoted+propagated) | Standard §2 note: manifest = facets+status; propagation = registry/os-inherit job |
| F5 | Nice | bucket numbering 1–8 vs "7 buckets" mismatch | numbering note added (CLAUDE.md=#1 not a target; 7 destinations #2–#8) |
| F6 | Nice | mirror-KU=vendoring not captured as a Curator rule | Curator rule added: contentHash-locked mirrors excluded from merge; escalate only on hash divergence |
| SG | Now-guard | `ui` facet component-vs-data ambiguous = the only redesign-forcing corner | Standard: `facets.ui` is a DATA-contract `{kind,dataContract,route}`, never a component ref; `invoke.none` note |

## Conclusion
Foundations are stable to build the next platform layer on. The fixes were drift-stamps + one corner-foreclosing prose guard — no architecture changed. The two manifest fields that will need additive extension (`invoke`, `ui`) are flagged to extend WITH their consuming primitive (command seam / DOS UI shell), per Waterline — not pre-built abstractly. Remaining founder gate: ratify the foundation set (these docs are DRAFT/PROPOSED).
