---
name: parity-oracle
version: 1.0.0
stability: stable
description: >
  The reusable, runnable, fail-closed verification kernel for cross-repo / migration / seam slices:
  a recursive PII-sentinel byte scan, derivation parity (a projection vs an independent recompute),
  and event-payload parity (compose with a contract validator). Import it instead of re-typing these
  checks. Invoke whenever a slice must prove data-minimisation across a seam, that a seam projection
  equals the canonical source, or that emitted events satisfy a contract.
decision_class: integration
inputs:  [the object/response/event under test, planted PII sentinels, the canonical recompute, a contract validator]
outputs: [violations[]/mismatches[] (empty === clean) — wired into a slice's VERIFY suite or a gate]
earned_from: "3×-reimplemented PII recursive byte-scan + derivation parity + ECR-0006 data-minimisation — re-typed in rumah-admin/tests/plos-wave1-independent-qa.test.ts (collectStrings/collectKeys + PII_NEVER_ON_SEAM + status/balance/daysOverdue + rentSharePct concentration parity), send-requested-notice.qa.test.ts (PII_TOKENS loop), seam-conformance.test.ts (PII blob grep + validateSeamBatch over a drain), and the key-half in delivery-os/contracts/admin-plos-seam-v1.mjs (scanPii). Never extracted until v6 #4."
mechanical_spine: "every function RETURNS violations[] (never throws on a finding, never a bare boolean a caller can forget); empty array === clean; an un-scannable input or thrown validator is reported, not skipped"
# --- v6 frontmatter fields (capability-routable; per V6-ARCHITECTURE.md Ring 1) ---
kind: skill
capabilities: [scan-pii-leak, assert-derivation-parity, assert-event-payload-parity]
triggers:
  - "cross-repo or migration slice needs a PII/data-minimisation proof"
  - "a seam projection must be proven equal to the canonical source (recompute parity)"
  - "emitted events must be validated against a seam/contract before live"
hooks:
  pre: []
  post: []
---
# Parity Oracle (v1.0 — v6 capability #4)

## Overview
Three verification checks were re-implemented 3×+ each across Admin's VERIFY suites — every cross-repo /
migration / seam slice re-typed the same recursive string-collector, the same PII key list, and a bespoke
recompute loop. This skill is the single home for those checks: one zero-dependency module
(`parity.mjs`) that any repo's CI, a `node -e`, a skill, or a gate can `import`. It converts a repeated
lesson into a reusable capability (the v6 thesis): the recurring engineer/QA task of re-writing these
checks is **removed** — slices CITE the oracle instead.

## When to use (and NOT)
- Use when: a slice must prove **data-minimisation** across a seam (no PII bytes/keys cross), that a
  **projection equals the canonical source** (recompute-and-compare), or that **emitted events satisfy a
  contract**. Standard for every cross-repo / migration / cutover slice.
- **NOT** a replacement for the seam contract itself (→ `executable-contracts` / `admin-plos-seam-v1.mjs`):
  the oracle COMPOSES with a contract validator, it does not redefine the per-type shape. **NOT** for
  intra-module assertions (normal unit tests).

## The three checks (signatures)
Import: `import { scanPiiLeak, assertDerivationParity, assertEventPayloadParity } from ".../parity-oracle/parity.mjs"`

1. **`scanPiiLeak(obj, sentinels?, opts?) → violations[]`** — recursively scans any object/response/event:
   (a) a **key deny-list** (`email/contactEmail/legalName/contactName/address/iban/kvkNumber`,
   case-insensitive; `*Id` refs + `billerName/ownerName` allow-listed), (b) a **sentinel byte scan** (any
   planted secret string appearing anywhere), (c) an **object-carrier** check (a `tenant`/`recipient`
   object bundling a name/email). Fail-closed: returns `violations[]` (empty === clean).
2. **`assertDerivationParity(a, b, fields, label?) → mismatches[]`** — assert a projection `a` agrees with
   an independent recompute `b` on each field (string key compared exact/NaN-safe, or `{field, eq}` for a
   custom comparator). A field missing on EITHER side is a mismatch (you cannot pass by omission).
3. **`assertEventPayloadParity(event, contractValidateFn) → violations[]`** — thin wrapper that runs an
   event through ANY contract validator (`validateSeamEvent`, or any `(e)=>{ok,violations}|violations[]|bool`)
   and normalises the result to `violations[]`; a thrown/missing/unrecognised validator becomes a violation.
   Helpers: `assertEventBatchParity(events, fn)` (a whole drain), `collectStrings`/`collectKeys`, `ok(violations)`.

## How to use (in a VERIFY suite or a gate)
```js
import { scanPiiLeak, assertDerivationParity, assertEventPayloadParity } from "<rel>/parity-oracle/parity.mjs";
import { validateSeamEvent } from "<rel>/contracts/admin-plos-seam-v1.mjs";

// 1. PII: seed sentinels into every PII column, drive the seam, assert nothing crosses
expect(scanPiiLeak(seamResponse, [tenantEmail, tenantLegalName, ownerIban])).toEqual([]);

// 2. parity: recompute from the raw source, compare to the projection
expect(assertDerivationParity(seamRow, recomputed, ["balanceCents","status","daysOverdue"], invId)).toEqual([]);

// 3. payload parity: every drained event satisfies the contract
for (const ev of drainedEvents) expect(assertEventPayloadParity(ev, validateSeamEvent)).toEqual([]);
```
Author≠verifier holds: the oracle is shared deterministic plumbing; QA still writes the slice's own
seeds, recompute, and assertions — it just stops re-typing the recursive scan and the key list.

## Run / self-verify
- `node skills/parity-oracle/parity.mjs` → runs the embedded self-tests (11), exits non-zero on any fail.
- One-liner: `node -e "import('./skills/parity-oracle/parity.mjs').then(m=>console.log(m.scanPiiLeak({email:'a@b.c'},['x'])))"`.

## Who CITES this (composition note — those skills/gates are NOT modified here)
- **`executable-contracts` / the seam-gate (v6 #1/#2):** the seam contract owns the per-type shape;
  the seam-gate should run drained events through `assertEventPayloadParity(ev, validateSeamEvent)` and the
  PII proof through `scanPiiLeak` rather than carrying its own copies. (Wire-up is the seam-gate's slice.)
- **`cutover-execution`:** its reconciliation battery ("at least one number derived by hand, compared to
  the loaded projection") is exactly `assertDerivationParity(loaded, handDerived, [...])`, and the
  post-load PII check is `scanPiiLeak`. Cutover should CITE the oracle for both.
- **`legacy-migration-etv` / `cross-system-reality-audit`:** transform-validate parity = `assertDerivationParity`.

## Red flags
- A new slice re-typing `collectStrings` / a `PII_TOKENS` loop / a recompute-and-compare loop — import the oracle.
- A "parity" assertion that can pass by omitting a value (the oracle is fail-closed on missing fields).
- Treating a non-empty `violations[]`/`mismatches[]` as anything but a failure.

## Changelog
- 1.0.0 — extracted the 3×-reimplemented PII-scan + derivation-parity + payload-parity into one zero-dep
  module (v6 #4); generalises the key-half from `admin-plos-seam-v1.mjs` and adds the sentinel byte-scan half.
