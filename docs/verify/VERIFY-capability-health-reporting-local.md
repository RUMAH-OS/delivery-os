---
verify_status: verified
author: claude-opus main build session 2026-06-15
verifier: qa-test subagent (independent, 2026-06-15)
independence_basis: recorded-distinct-invocation
date: 2026-06-15
---

# VERIFY — capability-health snapshot/diff (permanent reporting) OPERATES (local, independent)

- **date:** 2026-06-15
- **author:** claude-opus main build session 2026-06-15
- **verifier:** qa-test subagent (independent, 2026-06-15)
- **independence_basis:** recorded-distinct-invocation (verifier ran every command itself; author did not supply results)
- **verdict:** **verified (PASS)**
- **scope:** delivery-os `templates/tools/capability-health.mjs` — snapshot + MOVED/REGRESSED diff vs `capabilities/health-snapshot.json`, `--write-snapshot`, and wiring tokens for experience-gate / learning-review / skill-route / skill-frontmatter.
- **environment:** node v22.22.3 · git 2.45.2 · sibling `../rumah-admin` present.

This doc covers acceptance criteria 4, 5, 6. Criteria 1–3 (the gates themselves) are in the sibling rumah-admin VERIFY doc.

---

## Criterion 4 — both ALIVE with evidence + MOVED:2 — PASS

`node templates/tools/capability-health.mjs --project ../rumah-admin` → **exit 0**:

```
capability-health · project=rumah-admin · 7 capabilities (evidence-backed)
  [ALIVE  ] seam-gate          — wired: .github/workflows/ci.yml (seam:check)
  [ALIVE  ] lifecycle-gate     — wired: .github/workflows/ci.yml (lifecycle:check)
  [ALIVE  ] workflow-gate      — wired: .github/workflows/ci.yml (workflow:check)
  [ALIVE  ] experience-gate    — wired: .github/workflows/ci.yml (experience-gate)
  [ALIVE  ] skill-frontmatter  — wired: .github/workflows/ci.yml (skill-frontmatter)
  [ALIVE  ] skill-route        — wired: .github/workflows/ci.yml (skill-route)
  [ALIVE  ] learning-review    — wired: .github/workflows/ci.yml (learning-review)
MOVED (improved since last snapshot): experience-gate: INERT → ALIVE · learning-review: INERT → ALIVE
REGRESSED (worse since last snapshot): none
PASS: every measured capability is wired-to-run (ALIVE) in this project.
```

- Admin = **7 ALIVE / 0 INERT**, exit 0.
- experience-gate AND learning-review both ALIVE, each citing `wired: .github/workflows/ci.yml`.
- **MOVED (verbatim):** `experience-gate: INERT → ALIVE · learning-review: INERT → ALIVE` — exactly the two expected transitions vs the committed snapshot (which still records both as INERT).
- REGRESSED: none.

---

## Criterion 5 — permanent-reporting diff is real (REGRESSED via mutation) + self-test — PASS

### 5a. REGRESSED detection (temp mirror mutation)
On a temp mirror of rumah-admin's `INHERITED.json` + a CI file wiring all capabilities, took a snapshot to a temp path (`--write-snapshot`), then removed the experience-gate CI wiring and re-ran against the same snapshot:

```
  [INERT  ] experience-gate    — inherited: rumah-admin/.claude/os/INHERITED.json · wired: NONE
  ...
REGRESSED (worse since last snapshot): experience-gate: ALIVE → INERT
FAIL: 1 capability(ies) REGRESSED (was operating, now not).
EXIT=1
```

Removing the wiring flips experience-gate to INERT, surfaces it under **REGRESSED (`experience-gate: ALIVE → INERT`)**, and exits **non-zero (1)**. The diff is real, not cosmetic.

### 5b. Self-test (validate-the-validator)
`node templates/tools/capability-health.mjs --self-test` → **exit 0, 6/6 PASS**:

```
  PASS  known-wired → ALIVE
  PASS  known-inert → INERT
  PASS  not-inherited → MISSING
  PASS  wired-but-not-vendored → ALIVE
  PASS  drift: claims Auto-executed but INERT
  PASS  no-drift: claims Verified + INERT
PASS: capability-health classifies all known states correctly — it measures reality.
```

---

## Criterion 6 — no false green (evidence-only) — PASS

- Statuses are computed purely by `classify(name, {inherited, wiringText})` (`capability-health.mjs:115`); the MOVED/REGRESSED diff is a pure rank comparison vs the prior snapshot (`RANK[status] vs RANK[prev]`). No status is hand-set anywhere.
- Wiring is read ONLY from auto-executed contexts (`.github/workflows`, `.githooks`, `.claude/hooks`); `package.json` is deliberately excluded, so a script CI never calls cannot falsely read ALIVE.
- **Negative proof:** on a temp mirror whose CI omits the experience-gate and learning-review tokens, both honestly read **INERT** and the gate **FAILs (exit 1)**:
  ```
  [INERT  ] experience-gate   — ... wired: NONE
  [INERT  ] learning-review   — ... wired: NONE
  FAIL: 2 INERT (inherited/present but nothing runs them): experience-gate, learning-review
  EXIT=1
  ```
  Therefore the real-run ALIVE verdicts for experience-gate and learning-review are earned by genuine CI-token presence, not asserted.

---

## Integrity
- The real `capabilities/health-snapshot.json` was NOT modified: it still records `experience-gate: INERT` and `learning-review: INERT` (the pre-change baseline). All `--write-snapshot` runs targeted `%TEMP%` paths via `--snapshot`.
- The real rumah-admin `ci.yml` was not modified by the verifier.
- All temp mirrors/fixtures created under `%TEMP%` and deleted after use; `git status` shows no temp artifacts in either repo.
- Uncommitted working-tree entries (`capability-health.mjs` modified, `health-snapshot.json` untracked) are the changes-under-test, not verifier edits.

## Verdict: verified (PASS) — criteria 4, 5, 6 hold; load-bearing 5 (REGRESSED) holds.

---

## agent-orchestration wiring confirmation (2026-06-15)

Independent re-verification (author≠verifier; qa-test subagent ran every command itself) of the change adding `agent-route` + `agent-frontmatter` WIRING entries to `capability-health.mjs` (lines 41–42), adding both tools to `os-foundation.manifest.json`, and os-inherit-syncing them into Admin (now 10 inherited files). All four required checks PASS.

### Check 1 — self-test still green — PASS
`cd delivery-os && node templates/tools/capability-health.mjs --self-test` → **exit 0, 6/6 PASS** (known-wired→ALIVE, known-inert→INERT, not-inherited→MISSING, wired-but-not-vendored→ALIVE, drift→DRIFT, no-drift→ok). The validator still validates.

### Check 2 — correct classification, token-EARNED (not a false green) — PASS
`node templates/tools/capability-health.mjs --project ../rumah-admin` → **9 capabilities, exit 0, REGRESSED none**:
```
capability-health · project=rumah-admin · 9 capabilities (evidence-backed)
  [ALIVE  ] seam-gate          — wired: .github/workflows/ci.yml (seam:check)
  [ALIVE  ] lifecycle-gate     — wired: .github/workflows/ci.yml (lifecycle:check)
  [ALIVE  ] workflow-gate      — wired: .github/workflows/ci.yml (workflow:check)
  [ALIVE  ] experience-gate    — wired: .github/workflows/ci.yml (experience:check)
  [ALIVE  ] skill-frontmatter  — wired: .github/workflows/ci.yml (skill-frontmatter)
  [ALIVE  ] skill-route        — wired: .github/workflows/ci.yml (skill-route)
  [ALIVE  ] agent-frontmatter  — wired: .github/workflows/ci.yml (agent-frontmatter)
  [ALIVE  ] agent-route        — wired: .github/workflows/ci.yml (agent-route)
  [ALIVE  ] learning-review    — wired: .github/workflows/ci.yml (learning-review)
MOVED (improved since last snapshot): none
REGRESSED (worse since last snapshot): none
PASS: every measured capability is wired-to-run (ALIVE) in this project.
```
ALIVE is genuinely earned, confirmed by direct inspection of the project tree:
- `rumah-admin/.github/workflows/ci.yml` lines 48–49 carry the `agents:check` token:
  `- name: agent-orchestration gate (agent-frontmatter + agent-route self-consistency)` / `run: npm run agents:check`.
- `rumah-admin/.claude/os/INHERITED.json` genuinely vendors both tools (`.claude/os/tools/agent-frontmatter.mjs`, `.claude/os/tools/agent-route.mjs`).

### Check 3 — negative control (fail-closed integrity) — PASS
On a TEMP copy of the Admin tree (Admin `INHERITED.json` copied verbatim; `ci.yml` with `agents:check`/`agent-route`/`agent-frontmatter` tokens stripped via sed — 0 token matches confirmed in the temp file), capability-health honestly read both as **INERT** and **FAILed (exit 1)**, while the seven untouched capabilities stayed ALIVE (surgical control):
```
  [INERT  ] agent-frontmatter  — inherited: .../.claude/os/INHERITED.json · wired: NONE
  [INERT  ] agent-route        — inherited: .../.claude/os/INHERITED.json · wired: NONE
FAIL: 2 INERT (inherited/present but nothing runs them): agent-frontmatter, agent-route
EXIT=1
```
Therefore the real-run ALIVE for agent-route/agent-frontmatter is evidence-driven, not hardcoded. Temp tree deleted after use.

### Check 4 — os:check drift — PASS
`cd rumah-admin && npm run os:check` → **PASS, byte-current, 10 inherited file(s)** (exit 0): `os-inherit check · OS v5.0-36-gb456a57 · 10 inherited file(s)` / `PASS: every inherited capability is byte-current with the OS.`

### Integrity (this re-stamp)
- No production code touched by the verifier. The only verifier edit is this VERIFY doc append.
- Negative-control mutation was performed on a `%TEMP%` copy only and deleted; the real Admin `ci.yml`, `INHERITED.json`, and `health-snapshot.json` were not modified.
- Not committed.

**Verdict (re-stamp): verified (PASS) — all four agent-orchestration wiring checks hold.**
