---
name: founder-review-package
version: 1.0.0
stability: experimental
description: >
  Turn a slice's PR into a founder-readable review package — a durable markdown artifact and a
  condensed PR comment — so a non-technical founder can review a DEV slice without reading a diff:
  what it does (plain language), why, what changed, the risks, real-or-N/A screenshots, the live
  links, and a numbered "how to test it yourself" guide. Every section is pulled from a CITED source;
  the test guide is engineer-SEEDED + URL-interpolated (never diff-invented), screenshots are
  real-or-explicit-N/A (never fabricated), and posting the comment is effectful + fail-closed.
decision_class: production-readiness
inputs:  [the slice's PR (gh pr view), git log/diff base..head, the PR body (## Why / ## Decisions / ## Risks), docs/verify/VERIFY-<slice>.md, the engineer-seeded docs/review/review-steps-<slice>.md stub, the DEV deployment URL]
outputs: [a durable docs/review/REVIEW-<pr>-<slice>.md package, a condensed PR comment (printed by default; posted only with --post), and an honest fail-closed message wherever an input source is absent]
earned_from: "CANDIDATE — the recurring founder reality of a slice landing in DEV with nothing the founder can actually review: a raw diff, no plain-language summary, no clickable test steps, no record of the risks or where to look. The package makes the review surface a SYSTEM artifact instead of an ad-hoc hand-write — while refusing to invent the two things a generator must never fake: the exact test clicks (engineer-seeded product knowledge) and the screenshots (real or an explicit N/A). Promotes to verified after an independent QA run drives the live gather->build->effect path on a real PR."
mechanical_spine: "templates/tools/founder-review-package.mjs — the zero-dep generator (gh/git/fs via execFileSync, no shell). This skill is its human-readable half; the one effectful step (posting the PR comment) is NEVER taken without an explicit --post and is refused under --dry-run (read-only)."
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
# Founder Review Package (v1.0 — v6 execution skill)

## Overview
A slice lands in DEV and the founder is handed a Pull Request — a diff they cannot read, with no
plain-language summary, no clickable way to try it, and no record of the risks. This skill is the
single procedure that turns that PR into a **founder-readable review package**: a durable markdown
artifact (`docs/review/REVIEW-<pr>-<slice>.md`) plus a condensed PR comment. It is **data-driven and
fail-closed**: every section is pulled from a CITED source and, where a source is absent, the package
says so honestly rather than guessing. Its executable spine is
`templates/tools/founder-review-package.mjs`.

Three load-bearing design rules (the reason this is a capability, not a prompt):
- **The test guide is engineer-SEEDED, never diff-invented.** The exact clicks a founder makes are
  product knowledge a diff cannot supply. The guide is read from a per-slice stub
  (`docs/review/review-steps-<slice>.md`, numbered steps with `{DEV_URL}` placeholders) and the live
  DEV URL is interpolated in. **No stub -> a fail-closed "Testing guide unavailable" message, never a
  hallucinated guide.**
- **Screenshots are real-or-explicit-N/A, never fabricated.** A UI diff (`apps/web/**`, `*.tsx`,
  `admin-ui/**`) yields a placeholder list of the changed routes to capture by hand; a backend slice
  yields literally `N/A — backend slice (no UI surface changed)`. No image is ever invented.
- **Posting the comment is effectful + fail-closed.** The default **prints** the comment (and writes
  the artifact); it **posts** to the PR only with an explicit `--post`. `--dry-run` is fully read-only
  (writes nothing, posts nothing); `--post` under `--dry-run` is refused.

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

## The package (exactly these sections, each from its cited source)
1. **Header** — `gh pr view --json title,number,author,headRefName,url`; status `In DEV — awaiting your review`.
2. **What this does** (plain language) — the PR title + the commit subjects (`git log <base>..<head> --format=%s`).
3. **Why** — the PR body's `## Why` section (honest **Not stated** if absent).
4. **What changed** — `git diff --numstat <base>...<head>` -> files / +insertions / -deletions, grouped into areas by top directory.
5. **Architecture decisions** — any `docs/adr/*` touched in the diff + the PR body `## Decisions` (honest **None** if absent).
6. **Risks** — the PR body `## Risks` + the slice's `VERIFY-<slice>.md` residual-risk line (honest **None flagged** if absent).
7. **Screenshots** — UI paths changed -> the routes to capture; ELSE `N/A — backend slice (no UI surface changed)`. Never an invented image.
8. **Links** — the DEV deployment URL (`--dev-url` or a `gh` deployment; honest **DEV not provisioned** if absent), the PR URL, the CI run URL, and the VERIFY artifact path.
9. **How to test it yourself (zero technical knowledge)** — a NUMBERED guide read from the engineer-seeded
   stub and `{DEV_URL}`-interpolated. **Absent stub -> fail-closed "unavailable", never hallucinated.**
   Match the founder-runbook voice: exact clicks, one action per step, a **Success:** + ✅ confirmation.

## How to run it
- `node templates/tools/founder-review-package.mjs <pr> --dry-run` — read-only preview (writes nothing, posts nothing).
- `node templates/tools/founder-review-package.mjs <pr>` — write the artifact + PRINT the condensed comment (does NOT post).
- `node templates/tools/founder-review-package.mjs <pr> --post` — also post the comment (effectful; refused under `--dry-run`).
- Flags: `--repo OWNER/REPO` · `--base REF` · `--head REF` · `--slice NAME` · `--dev-url URL` · `--json` · `--self-test`.

## Decision points it surfaces to the founder (never auto-acts beyond writing the artifact)
- **Post the comment?** Default prints it; posting is an explicit `--post` (effectful, fail-closed).
- **Seed the test guide.** A missing `docs/review/review-steps-<slice>.md` is surfaced as a TODO for the engineer — the guide is never invented.
- **Capture the screenshots.** A UI slice lists the routes to capture by hand; the founder/engineer attach the real images.

## Red flags
- A hallucinated "how to test it" guide instead of the fail-closed "unavailable" message when the stub is absent.
- A fabricated or auto-generated screenshot instead of a route-to-capture placeholder or the explicit backend N/A.
- The PR comment posted without an explicit `--post`, or any write happening under `--dry-run`.
- A section narrated from memory instead of its cited source (e.g. inventing a `## Why` the PR body does not contain).

## Success criteria (runtime-verifiable)
- Every section cites its real source; an absent source yields an honest "Not stated / None / N/A / not provisioned", never a guess.
- A UI diff lists routes; a backend diff emits the exact `N/A — backend slice (no UI surface changed)`.
- A seeded stub is `{DEV_URL}`-interpolated; a missing stub yields the fail-closed "Testing guide unavailable" message (never invented steps).
- `--dry-run` writes nothing and posts nothing; the PR comment is posted only with `--post`; `--post` under `--dry-run` is refused.
- `--self-test` passes (exit 0) and both tool copies (`templates/tools/` + `.claude/tools/`) are byte-identical and `node --check`-clean.

## Changelog
- 1.0.0 — new (experimental); founder-readable review-package generator extracted from the by-hand
  "summarise the PR for the founder" loop. Spine: `templates/tools/founder-review-package.mjs`.
  Composes with verify-gate (reads `VERIFY-<slice>.md`), the human merge gate, and the engineer-seeded
  `docs/review/review-steps-<slice>.md` stub. Capabilities: generate-review-package, post-review-comment.
