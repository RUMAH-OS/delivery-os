# Engine Ownership Governance

> **Rule:** the workflow engine is **owned by Delivery OS**. Installed apps (Admin / PLOS / future)
> **never edit `.claude/os/engine/` directly.** The ONLY sanctioned change path is
> **edit-canonical → `engine:install` → commit**, and the drift gate (local hook + CI) **enforces** it.

This operationalizes the Delivery-OS-as-platform / `os-inherit` (INHERITED) model: Delivery OS is the
runtime/platform; an app is a mere **installer** of the engine. Ownership is not a convention — it is a
mechanism that makes silent divergence impossible.

## 1. What is owned

- **Canonical (source of truth):** `delivery-os/templates/workflow-engine/**`.
- **Installed (vendored, byte-identical):** `.claude/os/engine/**` in each app.
- **Record (sha-pinned lock):** `.claude/os/INHERITED-engine.json` in each app — the 3-way anchor between
  installed files, recorded hashes, and canonical.

An app's engine is, at all times, a **byte-for-byte copy** of canonical. No app-local engine edits exist.

## 2. The only sanctioned change path

```
1. EDIT CANONICAL   delivery-os/templates/workflow-engine/**        (the engine lives here, and ONLY here)
2. INSTALL          (in the app)  npm run engine:install            (= os-inherit sync --from ../delivery-os --into .)
                                                                     re-vendors byte-identical + re-records hashes
3. COMMIT           the app commits the re-vendored engine + record (allowed BECAUSE it matches canonical)
```

A direct edit of `.claude/os/engine/**` in an app is **never** sanctioned. If you want to change engine
behavior, change canonical and re-install.

## 3. How it is ENFORCED (not just documented)

The enforcement signal is the **FILE-HASH 3-way lock** in `os-inherit engine-check`
(`npm run engine:drift:check`). It fails on either side moving:

- **LOCAL DRIFT** — the installed `.claude/os/engine/**` was hand-edited (installed ≠ recorded).
- **STALE INSTALL** — the install is out of sync with canonical (recorded ≠ canonical).
- plus file-set integrity (missing / orphan / unrecorded / untracked engine files).

Two enforcement points fire automatically:

| Point | Mechanism | Behavior |
|---|---|---|
| **Local (developer machine)** | `verify-gate` hook (`.claude/hooks/verify-gate.mjs`), commit-gating path (PreToolUse `git commit`/`git push` + Stop) | **BLOCKS** the commit when the hash lock reports LOCAL DRIFT / STALE INSTALL, naming the drifted file: "⛔ Engine is owned by Delivery OS. Do not edit `.claude/os/engine/` directly. Change `delivery-os/templates/workflow-engine/` then run `npm run engine:install`." |
| **CI (multi-machine, by-construction)** | `.github/workflows/ci.yml` → `engine-ownership` job: checks out delivery-os as a sibling, runs `npm run engine:drift:check` | **HARD FAILS** the pipeline on any drift. |

A **legit re-vendor PASSES**: when canonical changed and the app ran `engine:install`, the vendored engine
appears in the commit but `installed == recorded == canonical`, so the hash lock holds and the gate allows
it. Engine files in a commit are fine **when they match canonical**.

### Advisory: DDL parity

`engine-check` also runs a structural **DDL-parity** check (the app's applied engine migrations must be
structurally equivalent to canonical). In the **local hook** this is **ADVISORY (warn, never block)** so an
app whose migration paths aren't in the shared manifest is not falsely blocked; the **hash lock** is the
robust ownership guarantee. CI runs the full `engine-check` (parity included) where the manifest is complete.

### Honest limits

- **Unreachable canonical** (delivery-os not mounted as a sibling): the local hook does **not** silently
  pass — it emits a **loud warning** ("ENGINE DRIFT NOT VERIFIED LOCALLY … CI enforces hard") and does not
  hard-block unrelated commits (dev ergonomics). CI is the by-construction backstop.
- The CI `engine-ownership` job needs a credential to check out the (private) delivery-os repo
  (`DELIVERY_OS_REPO` + `DELIVERY_OS_TOKEN`). When absent it **skips loudly** (a "not run", never a
  "passed"). Provision the secrets to make CI a hard gate.

## 4. Why (tie to os-inherit / INHERITED model)

The capability chain ends at *Every Project Inherits*. `os-inherit` vendors OS-foundational tools,
contracts, skills and **engines** into a consuming app, byte-identical and drift-checked, so the app is
self-contained (its gates run in CI without the OS mounted) **and** cannot silently diverge from canonical.
For engines specifically, the per-engine `INHERITED-<key>.json` sha-record is the lock that makes Delivery
OS the **platform/runtime** and the app a mere **installer**. This governance note simply states the rule
that lock encodes and points at the two places it is enforced.

> One source of truth per concern. The engine's concern lives in `delivery-os/templates/workflow-engine/`.
> Everything downstream is an installed copy — change the source, re-install, commit.
