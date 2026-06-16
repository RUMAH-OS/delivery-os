---
slice: "invoice.credited seam event (canonical contract)"
verify_status: verified
verify_scope: "The invoice.credited event added to the canonical contracts/admin-plos-seam-v1.mjs. Verified via its BYTE-IDENTICAL vendored twin in the consuming repo (rumah-admin), which carries the executable + e2e verification. Canonical == vendored == INHERITED pin, sha256 1eda06a205edd25b083924fe639af1fe910cd17e3c412bf487723059eedc6420."
author: "integration-architect (authored the invoice.credited contract surface: per-kind pdfRef table, PII-free rules; dispatches 54919b2e2ed9 core + 405f60b1f98d hardening, in rumah-admin)"
verifier: "qa-test (independent, rumah-admin dispatches bbfc23465e0c + 2d18a3ca32a8): seam-gate good->exit0 / bad->exit1 (rejects unknown field reason + PII), seam-conformance + full suite 501 green, PII-free recursive scan, canonical==vendored sha confirmed"
date: "2026-06-16"
independence_basis: "recorded-distinct-invocation (author=integration-architect, verifier=qa-test); canonical bytes are identical to the independently-verified vendored copy"
machine_probe: "node .claude/os/tools/seam-gate.mjs tests/fixtures/seam-bad-credited.json --contract <vendored or canonical> ; exits 1 (rejects). good fixture exits 0. (run in rumah-admin where the fixtures live)"
---

# VERIFY — invoice.credited seam event (Founder OS canonical contract)

## Verdict
**verified.** The `invoice.credited` event on the canonical `contracts/admin-plos-seam-v1.mjs` is the
byte-identical source of the vendored copy that was independently verified end-to-end in the consuming repo
(rumah-admin). Per the Founder OS migration principle, the contract is canonical here and vendored into apps via
os-inherit; the two are sha-identical (`1eda06a…`) and pinned in rumah-admin's `.claude/os/INHERITED.json`.

## What was independently verified (rumah-admin, qa-test)
- `validateSeamEvent` for `invoice.credited`: required `invoiceId, number, creditNoteId, creditNoteNumber,
  tenantId, contractId, amountCents`; optional `pdfRef`; **`reason` is NOT a seam field** (PII hardening C2 —
  it would be rejected as an unknown field). PII-free (recursive key scan + pdfRef value scan).
- per-kind pdfRef table: `invoice` (Factuur / /invoices/<id>/pdf) unchanged + still green; `creditNote`
  (Creditnota / /credit-notes/<id>/pdf).
- seam-gate: good fixture exit 0, bad fixture exit 1 (6 violations incl. unknown `reason`, PII, wrong mime/url/
  filename). seam-conformance + full suite 501 green. canonical == vendored sha.

## Note
This VERIFY records the canonical-side attestation so the canonical repo's history carries the gate evidence;
the executable fixtures + e2e live in the consuming app (rumah-admin) where the producer/drain run.
