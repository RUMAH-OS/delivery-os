---
artifact: Engine drift-gate PIN to a tagged delivery-os release (Sprint 1.0)
id: SPRINT-1.0-DRIFT-PIN
date: 2026-06-28
status: SPEC + exact diff authored by the worker. The CI-file edits land as PRs IN THE CONSUMER REPOS (software-engineer owns that code) — this document is the runbook + the founder's tag confirmation. DRB §3 (engine vendoring) + Risk #10 (floating-main drift coupling).
---

# Pin the engine drift-gate to a TAGGED delivery-os release

> **The problem (DRB Risk #10):** consumers' engine drift-gate currently resolves the engine from a **floating
> `../delivery-os`** checkout (default branch = `main`). One un-tagged commit to delivery-os `main` can silently
> mutate three consumers' CI verdict. **Fix:** pin every consumer's drift-gate to a **named delivery-os tag**, so
> the engine a consumer is graded against only changes by an explicit, reviewed re-vendor PR.

## 1. The current tag to pin to
delivery-os already tags releases. **Latest tag: `v5.0`** (11 tags on disk: v3.0 → v3.8, v4.0, v5.0). **Pin all
consumers to `v5.0`** at Sprint 1.0. *(Founder confirms `v5.0` is the intended floor at the §13 checkpoint; if a
fresher release is cut first, pin to that tag instead — the mechanism is identical.)*

## 2. Where the gate lives per consumer (pin only what exists)
| Repo | Drift mechanism today | Pin action |
|---|---|---|
| **rumah-admin** | `ci.yml` job `engine-ownership` checks out delivery-os as a sibling (via `DELIVERY_OS_REPO`/`DELIVERY_OS_TOKEN`) then runs `npm run engine:drift:check` (`os-inherit engine-check --from ../delivery-os`). The checkout has **no `ref:`** → floating `main`. | add `ref: v5.0` to the delivery-os checkout step (below). |
| **property-lead-os** | `ci.yml` `ci-static` step "OS drift check" runs `.claude/tools/check-os-drift.mjs` — a **self-consistency** lint of PLOS's OWN vendored router, **not** a cross-repo engine-version gate. | no sibling-checkout pin needed today; **when** PLOS adds a cross-repo `engine:drift:check` against a sibling delivery-os, pin its checkout `ref: v5.0` the same way. |
| rumah-housing-website · jarvis | no vendored engine / no drift gate | n/a. |

So at 1.0 the concrete pin is **one edit, in rumah-admin's `ci.yml`**.

## 3. The exact rumah-admin edit (lands as a PR in rumah-admin)
In `.github/workflows/ci.yml`, the `engine-ownership` job's delivery-os checkout step:

```yaml
      - name: checkout delivery-os (sibling) — so ../delivery-os resolves
        if: steps.cred.outputs.present == 'true'
        uses: actions/checkout@v4
        with:
          repository: ${{ secrets.DELIVERY_OS_REPO }}
          token: ${{ secrets.DELIVERY_OS_TOKEN }}
          path: delivery-os
          ref: v5.0          # ← PIN: grade against the tagged engine, never floating main (DRB Risk #10)
```

No change to `engine:drift:check` itself — `os-inherit engine-check --from ../delivery-os` now compares the
vendored engine against the **v5.0** tree because that is what was checked out. **Local parity:** developers/agents
must also have `../delivery-os` checked out at `v5.0` (`git -C ../delivery-os checkout v5.0`) so the local
pre-push hook grades against the same engine the CI gate does.

Record the pinned tag in rumah-admin (e.g. an `.engine-pin` file or a top-of-`ci.yml` comment) so the vendored
version is auditable from the consumer side without reading CI logs.

## 4. Cross-repo bump discipline (DRB §3 — engine bumps are ordered, never atomic)
When the engine changes, the version moves through the ecosystem as a **dependency-ordered, serialized PR
sequence** — NOT a single atomic change across repos (ephemeral agents share no memory; collisions must be
prevented by a lock, not a habit):

1. **Source PR first (delivery-os):** make the engine change, merge through delivery-os's own gate, then **cut a
   new tag** (e.g. `v5.1`). The tag is the release boundary that also enables consumers' I-Version adopt-by-pin.
2. **Re-vendor PRs (consumers), one at a time:** in each consumer, bump the pinned `ref:` to the new tag **and**
   re-run `npm run engine:install` (`os-inherit sync --from ../delivery-os`) against that tag so the vendored copy
   is byte-identical to the tagged engine; the `engine-ownership` drift gate then passes. Open these as **separate
   PRs per consumer**, never bundled.
3. **Serialize one-in-flight:** branch protection's `required_status_checks.strict = true` ("require branches up to
   date before merging") is the **mechanical base-freshness lock** that forces cross-cutting re-vendor PRs through
   one at a time — a second in-flight re-vendor must rebase, surfacing the collision instead of silently racing.
4. **Never float back:** a consumer never points its drift-gate at `main` again; the only way the engine a
   consumer runs changes is an explicit re-vendor PR to a newer tag.

## 5. Reversibility
The pin is additive and reversible: revert the `ref:` bump PR to return to the prior tag. The tag itself is
immutable provenance (Sprint 1.0 rollback row: "the tag is additive; zero code/schema/prod risk").

## 6. Founder action (DoD evidence this produces)
The founder **confirms `v5.0`** (or the agreed tag) as the Sprint 1.0 engine floor. Evidence: the pinned tag named
here + the rumah-admin `ci.yml` diff showing `ref: v5.0` on the delivery-os checkout (lands as a rumah-admin PR,
verified independently).
