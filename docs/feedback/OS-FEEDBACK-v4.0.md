# OS-FEEDBACK — v4.0 release triage (Governance §14)

**Release:** v4.0 (the consolidation release) · **Date:** 2026-06-12 · **Filed by:** claude-orchestrator (PLOS), as release executor under the founder's consolidation directive.

## 1. Were any framework-level lessons discovered this cycle?

Yes — discovered DURING the v4.0 verification itself (four rounds, two rejections; full record in
`docs/verify/VERIFY-v4.0-consolidation.md`):

1. **The scaffolder's documented layout was never exercised by its own release process** — the
   self-copy crash (finding 1) was latent since v3.8 because no release ran the acceptance test
   in the layout the docs describe. Lesson (no project noun): *a release that ships an
   installation path must execute that path in every documented layout before tagging.* Landed
   in v4.0 itself: the acceptance test is now part of the verification scope (§84 step 9 made
   mandatory, both layouts).
2. **Claim≠content in a fix commit is a first-class defect** (finding 6) — a silent string-replace
   no-op produced a commit whose message asserted a fix its diff did not contain; caught only
   because the re-verifier diffed the range instead of trusting the message. Lesson: *verifiers
   diff the range first; fix authors prove the diff exists before writing the claim.* Landed in
   the verification skill's red-flag table ("prose is not evidence — including commit messages").
3. **A lint that parses its own doctrine prose will eventually eat it** (finding 7) — the
   os_version regex first-matched the rule's own explanation, blocking every fresh project's
   first push. Lesson: *derived-state extractors anchor on value shape, never on keyword
   proximity; adversarially probe a lint with the text that DESCRIBES it.* Landed in v4.0
   (anchored regex + the round-4 adversarial-probe pattern recorded).

## 2. Are there any OS Candidates?

One, non-blocking, recorded for v4.1 (`os_candidate: true` on the round-4 note in the VERIFY
artifact): harden the router-§9 redundancy check to FAIL when the derived line yields no
version-shaped capture at all (the current anchor tolerates a hand-edited non-version value;
the stamp≠pin check still holds, so this is hardening, not a hole).

## 3. Routing

| Lesson | Layer | Destination |
|---|---|---|
| Release must execute its own documented install paths | Delivery OS | verification scope (this release); acceptance test in `VERIFY-v4.0-consolidation.md` §10–12 as the worked example |
| Claim≠content / verifiers diff the range first | Delivery OS | `skills/verification/SKILL.md` red flags; case study = VERIFY-v4.0 FAIL history |
| Lint anchors on value shape, never keyword proximity | Delivery OS | `templates/tools/check-os-drift.mjs` (fixed in-release); v4.1 candidate above |
| The three consumer retrospectives feeding this release | Delivery OS | already triaged: `OS-FEEDBACK-RETRO-ADMIN-2026-06-12.md`, `OS-FEEDBACK-RETRO-PLOS-2026-06.md`, `OS-FEEDBACK-CONSOLIDATION-2026-06.md` |
