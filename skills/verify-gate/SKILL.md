---
name: verify-gate
description: Operationalizes author≠verifier (Governance §12). Use to produce or check a slice's independent verification artifact, and to understand why the verify-gate hook blocked a commit/turn. The mechanical companion to the doctrine: a slice is not "verified" until an independent VERIFY-<slice>.md exists.
version: 1.0.0
---

# verify-gate — make verification a system behavior, not a memory exercise

This skill exists because Delivery OS once **documented** author≠verifier but did not **operationalize** it: a generated, unexecuted scaffold was presented as progress with no independent verifier (`case-studies/2026-06-10-author-verifier-not-operationalized.md`). The fix is mechanical (Governance §12).

## The two halves
1. **The hook (fires without you choosing to).** `.claude/settings.json` runs `.claude/hooks/verify-gate.mjs`:
   - `PreToolUse:Bash` → **deny** `git commit`/`git push` when implementation files (`src/ app/ lib/ api/ migrations/ db/`) changed without a fresh passing independent `docs/verify/VERIFY-<slice>.md`.
   - `Stop` → **block turn-end** under the same condition (catches "scaffold presented as progress").
   - `PostToolUse:Write|Edit` → baseline + advisory warn.
   - Committed `.githooks/pre-push` (via `core.hooksPath`) backstops it for any git client.
2. **The artifact (what the hook checks for).** A `VERIFY-<slice>.md` from `templates/VERIFY.md.template`, authored by a verifier **≠** the code's author.

## When invoked, do this
- **To verify a slice:** run as an **independent lens** (a distinct invocation from whoever authored the code). Execute the slice's *real surface* (HTTP to the running app / import `src/` / apply migration on a fresh DB — never raw SQL standing in for an API criterion, never reading code instead of running it). Capture **real command output + exit codes**. Fill every section of the template. Set `verify_status: verified` **only** if every acceptance criterion PASSes on its own surface, every load-bearing claim is Confirmed/Evidence-backed, all required gates are closed, and independence was real. Otherwise cap at `executed` and file bugs author-ward.
- **To diagnose a block:** the hook blocked because changed implementation files lack a fresh/passing/independent VERIFY artifact. Produce one (above) — do not bypass. (`DELIVERY_OS_GATE_BYPASS=1` exists only for bootstrap/debug and is logged loudly.)

## Status ladder (derived, never self-asserted)
`planned` (spec) → `generated` (code exists, unrun) → `executed` (ran, evidence captured) → `verified` (independent lens confirmed acceptance on the real surface). The author may claim up to `executed`; only the verifier may claim `verified`; only a human merge makes it "done".

## Honest limit
The hook proves an artifact **exists** and is well-formed; it cannot prove the verification was *truthful* in a single-agent runtime. CODEOWNERS-on-a-real-PR-with-a-second-reviewer and the committed `pre-push` are the model-independent layers — which is why git is mandatory (§12).

## Success criteria (runtime-verifiable)
- A blocked commit/turn is resolved by producing a real `VERIFY-<slice>.md`, not by editing a status field.
- The artifact's `author` ≠ `verifier`, and its execution evidence shows real commands/exit codes against the slice's actual surface.
