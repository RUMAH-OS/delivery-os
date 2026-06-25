---
name: founder-review-package
version: 2.0.0
stability: experimental
description: >
  Turn a slice's PR into the EXACT zero-technical-knowledge review package a founder can act on alone —
  a FOUNDER-FACING markdown artifact plus an engineer-facing PR comment. The founder doc gives a
  plain-business-language summary, the simplest review path CHOSEN for them (LOCAL when a one-command
  harness needs nothing from them, else the live DEV preview), REAL urls (never placeholders),
  click-by-click steps, what to expect, an explicit ✅ PASS / ❌ FAIL checklist, real-or-N/A screenshots,
  rollback only if relevant, and "what still needs YOU" with a direct link ONLY for a real one-time
  founder action. Implementation detail (diffs, env vars, CI, repo plumbing) stays OUT of the founder doc,
  in the PR comment. Every section cites a source; the summary, clicks and ✅/❌ checklist are
  engineer-SEEDED, screenshots real-or-N/A, urls real-or-fail-closed, and posting the comment is
  effectful + fail-closed.
decision_class: production-readiness
inputs:  [the slice's PR (gh pr view), git log/diff base..head, the PR body (## Founder summary / ## Risks), docs/verify/VERIFY-<slice>.md, the engineer-seeded docs/review/review-steps-<slice>.md stub (## Business summary / ## Click-by-click / ## Expected results / ## Pass/Fail checklist / ## Rollback / ## What still needs you), the per-project .delivery-os/founder-review.json local-review config, the DEV deployment URL]
outputs: [a durable FOUNDER-FACING docs/review/REVIEW-<pr>-<slice>.md package (plain language · the chosen LOCAL/DEV review path · REAL urls · click-by-click · explicit ✅/❌ checklist · impl detail hidden), an engineer-facing condensed PR comment (printed by default; posted only with --post; carries the diff/ADR/CI/links), an advisory impl-detail-leak warning, and an honest fail-closed message wherever an input source is absent (no fabricated urls/steps/screenshots/checklist)]
earned_from: "CANDIDATE — the recurring founder reality of a slice landing in DEV with nothing the founder can actually review: a raw diff, no plain-language summary, no clickable test steps, no record of the risks or where to look. The package makes the review surface a SYSTEM artifact instead of an ad-hoc hand-write — while refusing to invent the two things a generator must never fake: the exact test clicks (engineer-seeded product knowledge) and the screenshots (real or an explicit N/A). Promotes to verified after an independent QA run drives the live gather->build->effect path on a real PR."
mechanical_spine: "templates/tools/founder-review-package.mjs — the zero-dep generator (gh/git/fs via execFileSync, no shell) — plus templates/tools/founder-review-env.mjs, the project-agnostic one-command LOCAL review harness (data-driven by .delivery-os/founder-review.json; starts/migrates/seeds a REAL reviewable artifact and prints the exact local urls; fail-closed to DEV when unconfigured — never fabricates urls). This skill is their human-readable half; the one effectful step (posting the PR comment) is NEVER taken without an explicit --post and is refused under --dry-run (read-only)."
# --- v6 frontmatter fields (capability-routable; per skill-frontmatter.mjs #6) ---
kind: execution
capabilities: [generate-review-package, post-review-comment]
triggers:
  - "generate the review package"
  - "what did this slice change"
  - "review package"
  - "prepare the founder review"
hooks:
  pre: []
  post: []
---
# Founder Review Package (v2.0 — v6 execution skill)

## Overview
A slice lands and the founder is handed a Pull Request — a diff they cannot read, with no
plain-language summary, no clickable way to try it, and no record of the risks. This skill is the
single procedure that turns that PR into the **EXACT zero-technical-knowledge package a founder can act
on alone**: a durable FOUNDER-FACING artifact (`docs/review/REVIEW-<pr>-<slice>.md`) plus an
engineer-facing PR comment. It is **data-driven and fail-closed**: every section is pulled from a CITED
source and, where a source is absent, the package says so honestly rather than guessing. Its executable
spine is `templates/tools/founder-review-package.mjs` (the generator) plus
`templates/tools/founder-review-env.mjs` (the one-command LOCAL review harness).

Load-bearing design rules (the reason this is a capability, not a prompt):
- **The simplest review path is CHOSEN for the founder.** The generator decides LOCAL vs DEV by least
  founder effort: **LOCAL** when the project has a `.delivery-os/founder-review.json` harness (it needs
  NOTHING from the founder — no passwords, no Vercel settings, no deploy wait), **else DEV** when a DEV
  url is known, **else fail-closed** "no reviewable surface" with **no fabricated urls**. The chosen
  path is stated with a one-line why. LOCAL references the one-command harness (`founder-review-env.mjs`)
  that seeds a REAL reviewable artifact (e.g. a valid token) and prints the exact local urls.
- **The business summary, the exact clicks and the ✅/❌ checklist are engineer-SEEDED, never
  diff-invented.** They are product knowledge a diff cannot supply, read from the per-slice stub
  (`docs/review/review-steps-<slice>.md` — sections `## Business summary`, `## Click-by-click`,
  `## Expected results`, `## Pass/Fail checklist`, `## Rollback`, `## What still needs you`), with
  `{REVIEW_URL}` interpolated to the chosen base. **No stub -> fail-closed "Testing guide unavailable";
  no checklist section -> fail-closed "checklist not seeded" — never a hallucinated guide or invented
  ✅/❌.**
- **URLs are real-or-fail-closed; impl detail is HIDDEN.** Urls are `base + path` from real config —
  never a placeholder pretending to be a link. The founder doc carries NO GitHub/Vercel/token/env-var/
  API/CI/diff/ADR plumbing (an advisory leak-scan flags any that slip through); that detail lives in the
  PR comment. **Direct links appear in the founder doc ONLY for a real one-time founder action** (the
  seeded `## What still needs you`, e.g. a merge link).
- **Screenshots are real-or-explicit-N/A, never fabricated.** A UI diff (`apps/web/**`, `*.tsx`,
  `admin-ui/**`) yields a placeholder list of the changed routes to capture by hand; a backend slice
  yields literally `N/A — backend slice (no UI surface changed)`. No image is ever invented.
- **Posting the comment is effectful + fail-closed.** The default **prints** the comment (and writes
  the artifact); it **posts** to the PR only with an explicit `--post`. `--dry-run` is fully read-only
  (writes nothing, posts nothing); `--post` under `--dry-run` is refused.

## Process
1. **Gather (cited, read-only).** `gh pr view` the PR; `git log/diff <base>..<head>`; read
   `docs/verify/VERIFY-<slice>.md`, the seeded `docs/review/review-steps-<slice>.md` stub, and the
   per-project `.delivery-os/founder-review.json`.
2. **Choose the review path FOR the founder.** LOCAL if the config has a harness (needs nothing from
   them), else DEV if a url is known, else fail-closed "no reviewable surface" (no fabricated urls).
   `--prefer local|dev` overrides but still fails closed.
3. **Build the FOUNDER-FACING artifact.** Plain-language summary · chosen path + one-line why · REAL
   urls · seeded click-by-click (`{REVIEW_URL}`-interpolated) · expected results · explicit ✅/❌
   checklist · real-or-N/A screenshots · rollback-if-relevant · "what still needs YOU" (links only for
   a real action) · LOCAL restart note. Each absent source -> a fail-closed message, never a guess.
   Implementation detail is rendered into the engineer-facing PR comment, not the founder doc.
4. **Effects (gated, fail-closed).** Default writes the artifact + PRINTS the comment; `--post` posts it;
   `--dry-run` writes/posts nothing; `--post` under `--dry-run` is refused.
5. **(LOCAL) run the harness.** `founder-review-env.mjs` runs the project's declared setup/seed/servers,
   waits on health, and prints the exact local urls (Ctrl+C tears down).

## When to use (and NOT)
- **Use when:** a slice's PR is in DEV and the founder needs to review it ("prepare the founder
  review" / "review package"), someone asks "what did this slice change?", or a DEV deployment is
  ready and the founder should try it themselves.
- **NOT** a replacement for: the **VERIFY artifact** (this skill READS `VERIFY-<slice>.md` for the
  residual-risk line; it does not author or replace independent verification — author≠verifier, §3/§12);
  the **human merge gate** (a package is a review aid, not a merge); **ci-release-orchestrator** (CI
  watch / merge-when-green — this skill describes the slice, it does not gate CI); or a **design
  review** of the UI itself. It does NOT invent test steps or screenshots — absent inputs are reported
  honestly.

## The FOUNDER-FACING package (exactly these sections, each from its cited source)
1. **Title + intro** — the plain title (`.delivery-os/founder-review.json` `review.title`/`app` or the PR
   title) and, for LOCAL, the zero-setup banner + the one-line "I set this up on your own computer because…".
2. **The links to open** — REAL urls (chosen base + each `review.urls[].path`); never a placeholder. Mode
   `none` -> fail-closed, no fabricated link.
3. **What changed (in plain language)** — the seeded `## Business summary` (or PR body `## Founder summary`/
   `## Summary`; honest fallback to the PR title, flagged un-seeded).
4. **Click-by-click** — the seeded `## Click-by-click` (or the whole stub, back-compat), `{REVIEW_URL}`-
   interpolated. **Absent stub -> fail-closed "Testing guide unavailable", never hallucinated.**
5. **What you should see** — the seeded `## Expected results` (omitted when absent — optional).
6. **✅ Pass / ❌ Fail checklist** — the seeded `## Pass/Fail checklist`. **Absent -> fail-closed
   "checklist not seeded", never invented ✅/❌.**
7. **Screenshots** — UI paths changed -> the routes to capture; ELSE `N/A — backend slice (no UI surface changed)`.
8. **Rollback notes** — the seeded `## Rollback` — rendered **ONLY if present** (relevant-only).
9. **What still needs YOU** — the seeded `## What still needs you` (the ONLY place a direct founder-action
   link belongs); honest "nothing further" with no links when absent.
10. **If the links don't work** — LOCAL only — the one-command harness restart.

Implementation detail (diff `--numstat`, ADRs, CI run, PR/VERIFY links) is **kept out of the founder doc**
and rendered into the engineer-facing **PR comment** instead.

## The LOCAL review harness — `templates/tools/founder-review-env.mjs`
A project-agnostic, zero-external-dep, one-command "start-and-print-the-URLs" local review env, data-driven
by `.delivery-os/founder-review.json`. It runs the project's declared `setup` (start DB, migrate), `seed`
(a project-owned script that seeds a REAL reviewable artifact), starts the `servers`, waits on each
`healthUrl`, then PRINTS the exact local urls. Default = start-and-block (Ctrl+C tears down + runs
`teardown`); `--selftest` = do-all-then-teardown-exit-0. A `local.safety.databaseUrlMustNotContain`
tripwire refuses to run if a forced env value looks like production. **Unconfigured -> FAIL CLOSED**
("this project needs a `.delivery-os/founder-review.json` to enable local review; falling back to DEV")
with NO fabricated urls. The config shape is documented at the top of the file.

## How to run it
- `node templates/tools/founder-review-package.mjs <pr> --dry-run` — read-only preview (writes nothing, posts nothing).
- `node templates/tools/founder-review-package.mjs <pr>` — write the artifact + PRINT the condensed comment (does NOT post).
- `node templates/tools/founder-review-package.mjs <pr> --post` — also post the comment (effectful; refused under `--dry-run`).
- `node templates/tools/founder-review-env.mjs` — start the LOCAL review env + print the exact urls (Ctrl+C to stop); `--selftest` to do-all-then-teardown.
- Flags: `--repo OWNER/REPO` · `--base REF` · `--head REF` · `--slice NAME` · `--dev-url URL` · `--prefer local|dev` · `--json` · `--self-test`.

## Decision points it surfaces to the founder (never auto-acts beyond writing the artifact)
- **Which review path?** The generator CHOOSES the least-effort path (LOCAL/DEV) for the founder and states the one-line why; `--prefer` can override.
- **Post the comment?** Default prints it; posting is an explicit `--post` (effectful, fail-closed).
- **Seed the founder content.** A missing `docs/review/review-steps-<slice>.md` (or a missing `## Business summary`/`## Pass/Fail checklist` section) is surfaced as a fail-closed TODO for the engineer — never invented.
- **Capture the screenshots.** A UI slice lists the routes to capture by hand; the founder/engineer attach the real images.

## Red flags
- A hallucinated "how to test it" guide, or invented ✅/❌ checklist items, instead of the fail-closed messages when the stub/checklist is absent.
- A fabricated or auto-generated screenshot instead of a route-to-capture placeholder or the explicit backend N/A.
- A **placeholder/fabricated url** presented as a clickable review link (instead of the fail-closed "no reviewable surface").
- Implementation detail (GitHub/Vercel/token/env-var/API/CI/diff) leaking into the founder doc when no founder action requires it.
- A direct link in the founder doc for something the founder does NOT need to personally do.
- The PR comment posted without an explicit `--post`, or any write happening under `--dry-run`.
- A section narrated from memory instead of its cited source (e.g. inventing a business summary the stub/PR body does not contain).

## Success criteria (runtime-verifiable)
- The simplest review path is CHOSEN for the founder (LOCAL when `.delivery-os/founder-review.json` exists, else DEV, else fail-closed "no reviewable surface" with NO fabricated urls), and stated with a one-line why.
- The founder-facing urls are REAL (`base + path`); never a placeholder. Impl detail stays out of the founder doc (advisory leak-scan), in the PR comment.
- Every founder section cites its real source; an absent source yields an honest fail-closed message, never a guess.
- A UI diff lists routes; a backend diff emits the exact `N/A — backend slice (no UI surface changed)`.
- A seeded stub is `{REVIEW_URL}`-interpolated; a missing stub yields fail-closed "Testing guide unavailable" and a missing checklist yields fail-closed "checklist not seeded" (never invented).
- Rollback is rendered only when seeded; "what still needs YOU" carries a link only when a real founder action is seeded.
- The LOCAL harness (`founder-review-env.mjs`) seeds a real artifact + prints exact urls, fails closed (no config / prod-ref tripwire), and `--selftest` tears down exit 0.
- `--dry-run` writes nothing and posts nothing; the PR comment is posted only with `--post`; `--post` under `--dry-run` is refused.
- `--self-test` passes (exit 0) and both generator copies (`templates/tools/` + `.claude/tools/`) are byte-identical and `node --check`-clean.

## Changelog
- 2.0.0 — **founder ratification 2026-06-25:** upgraded to the canonical zero-technical-knowledge standard
  the founder approved. The earned case is **rumah-admin's `docs/FOUNDER-REVIEW-public-signer.md`** (the
  "I chose LOCAL because…", 4-exact-URL, ✅/❌, impl-hidden contract-signing package) and its
  `scripts/founder-review.mjs` one-command env. Adds: the LOCAL-vs-DEV decision (chosen for the founder,
  one-line why), the plain-business-language summary, the explicit ✅ PASS / ❌ FAIL checklist section, the
  "hide implementation detail" envelope (founder doc vs engineer PR comment + advisory leak-scan),
  direct-links-only-for-real-founder-actions, and a new project-agnostic harness
  `templates/tools/founder-review-env.mjs` (data-driven by `.delivery-os/founder-review.json`; seeds a real
  reviewable artifact + prints exact local urls; fail-closed to DEV when unconfigured). Keeps the v1
  fail-closed/cited-source discipline (no invented steps/checklist/screenshots/urls). Capabilities:
  generate-review-package, post-review-comment.
- 1.0.0 — new (experimental); founder-readable review-package generator extracted from the by-hand
  "summarise the PR for the founder" loop. Spine: `templates/tools/founder-review-package.mjs`.
  Composes with verify-gate (reads `VERIFY-<slice>.md`), the human merge gate, and the engineer-seeded
  `docs/review/review-steps-<slice>.md` stub. Capabilities: generate-review-package, post-review-comment.
