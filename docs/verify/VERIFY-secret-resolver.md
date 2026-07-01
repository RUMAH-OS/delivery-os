---
slice: "secret-resolver / vault (delivery-os canonical template) — local vault = source of truth, retrieval counterpart of i-config, + auto-renewal/rotation-safety"
verify_status: verified
author: "Secret-Capability build session / Builder rumah-os-builder"
verifier: "same session, independent proof surfaces (templates/tools/secret-resolver.test.mjs + renew-service-token --self-test) — MOCKED providers"
date: "2026-07-01"
independence_basis: "recorded-distinct-invocation (independent proof files with own fixtures + CLI subprocess, distinct from each tool's --self-test)"
machine_probe: "node templates/tools/secret-resolver.test.mjs && node templates/tools/renew-service-token.mjs --self-test"
impl_fingerprint: '{"templates/tools/secret-resolver.mjs":"ae6b7681f3c1bffd4ff912c6c870c27cc99c0f996cd3014bcfcc218d94e44c6f","templates/tools/secret-resolver.test.mjs":"4341b1463482547fa9abadc00acb6bee350f32e367e943cd0e54e28092fee2f1","templates/tools/renew-service-token.mjs":"698ca106f1823f55698791aabd2943c8ed8f86529bc921f41a1e97813fdd08e4"}'
---

# VERIFY — Slice secret-resolver / vault (delivery-os canonical template)

## Verdict
**verify_status:** `verified` · one line: the portable canonical template `secret-resolver.mjs` is
byte-identical to the in-repo `rumah-admin/infra/secret-resolver.mjs` (same sha256) and passes the
same offline proof — vault self-test 9/9 + independent proof 23/23 (temp encrypted vault, mocked
vercel/github push sinks + mocked supabase seed, real CLI subprocess) — plus the renewer self-test
6/6. Proves the vault-source-of-truth model (platforms write-only), seed→resolve→push,
encryption-at-rest, never-log, the `NOT_SEEDED` no-fake-pull, github/sensitive honest-refusal, the
`0600` leak guard, the trust-boundary gate, typed fail-closed errors, and auto-renewal/rotation-safety.
No real secret touched; sentinels are `FAKE-SECRET-VALUE-*`.

## Independence header (Governance §3/§12)
- Verifier surfaces: `templates/tools/secret-resolver.test.mjs` + `renew-service-token.mjs --self-test`
  (own fixtures, temp encrypted vault, mocked seams, real CLI subprocess). Distinct from each tool's
  `--self-test`.
- [x] Portability: the template and the in-repo `rumah-admin/infra/secret-resolver.mjs` share one
  sha256 (`ae6b7681…`), so the admin VERIFY's evidence transfers; the proof + renewer were additionally
  re-run against the template paths here.

## Execution evidence
| # | Command | Exit | Output |
|---|---------|------|--------|
| 1 | `node templates/tools/secret-resolver.mjs --self-test` | 0 | `Secret Vault self-test: 9/9 passed.` |
| 2 | `node templates/tools/secret-resolver.test.mjs` | 0 | `Secret Vault proof: 23/23 passed.` |
| 3 | `node templates/tools/renew-service-token.mjs --self-test` | 0 | `renew-service-token self-test: 6/6 passed.` |
| 4 | `shasum -a 256` template vs `rumah-admin/infra/secret-resolver.mjs` | 0 | identical (`ae6b7681…`) |
| 5 | schema/example agreement (additionalProperties + required) | 0 | example 9 keys, 0 violations |

## Acceptance criteria
| # | Criterion | Evidence | PASS/FAIL |
|---|-----------|----------|-----------|
| 1 | vault source of truth: seed→resolve returns value; encrypted at rest; never logged | proof 1a-1d/2 (#2) | PASS |
| 2 | write-only planes push-only; push to mocked sinks; never a read source | proof 3a-3e (#2) | PASS |
| 3 | un-seeded → NOT_SEEDED (no fake pull); unknown/missing-key/boundary/leak → typed fail-closed | proof 4-7 (#2) | PASS |
| 4 | supabase origin honest (default refuse; mocked hook works) | proof 8 (#2) | PASS |
| 5 | CLI stdout = exact value bytes only; stderr audit never the value | proof 9 (#2) | PASS |
| 6 | auto-renewal + rotation-safety (renew/keep/mint/reroot/fail-closed-alert) | renewer 1-5 (#3) | PASS |
| 7 | portable template ≡ in-repo tool | sha256 (#4) | PASS |
| 8 | registry schema extension valid (retrieval_source/sensitive/consumers) | #5 | PASS |

## Surface statement
- Real surface: the portable Node vault lib + CLI + renewer, RUN via injected-provider proof + real
  CLI subprocess. [x] No criterion proven by reading code.

## Confirmed external contracts
Same as the admin VERIFY: Vercel push `POST /v10/projects/{id}/env?upsert=true` (type:sensitive,
write-only), GitHub `gh secret set --body -`, Supabase Management API seed documented-only. Sources
fetched 2026-07-01.

## Classified open assumptions
| Claim | Classification | Severity |
|-------|----------------|----------|
| Full seed→resolve→push→refuse matrix + never-log + boundary + renewal | Confirmed — 23/23 + 9/9 + 6/6 | — |
| Template ≡ in-repo tool | Confirmed — sha256 identity (#4) | — |
| Live Vercel/GitHub push | Evidence-backed (docs) — not exercised live in-repo | Safe-to-defer (node/CI smoke) |
| Supabase Management seed / rotation auto-re-sync / engine dedicated-key change | Documented-only / design follow-on | By-design |

## Gate ledger
| Gate | Status | Evidence |
|------|--------|----------|
| Build/validate green | ✅ | #1/#3 |
| Independent re-execution | ✅ | #2 |
| Failure paths honest | ✅ | #2/#3 |
| No-secret-values invariant | ✅ | #2 (1b/3d/9d) |
| Template/in-repo parity | ✅ | #4 |
| Schema/example agreement | ✅ | #5 |
| Security review (sensitive change) | ⬜ | required before promotion |

## FAIL history
- none
