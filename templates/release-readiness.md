# Release Readiness — <PROJECT>

> The single doc the release is executed from. Living; verdict at top.

## Verdict
✅ Ready · 🟡 Ready with conditions · 🔴 Not ready — **<one line>**

## Reviewer panel (independent lenses)
| Lens | Vote | One-line |
|---|---|---|
| QA / Test | ready / conditions / not | <…> |
| Architect | … | … |
| <domain: security / SEO / design / data / ai> | … | … |

## Hard gates (before go-live)
- [ ] **Durability (Phase-0, non-waivable):** doctrine-irreplaceable data on managed storage with PITR/backups **and a TESTED restore** — or a founder-signed risk amendment on file (earned: a raw-forever corpus ran for weeks on an unbacked-up local DB)
- [ ] Runs in the **real target env** (deployed, not just local)
- [ ] CI green **in the cloud** — machine-read via the merge gate, never piped/watched output
- [ ] **One real end-to-end transaction** verified (lead delivered / payment captured / contract signed / agent output correct)
- [ ] **Smoke battery (standard shape):** `/health` 200 → auth posture (401 no token / 403 wrong scope / 200 right scope) → contract-conformant body from one real endpoint → CORS allow **and** deny → root + unknown routes 404 (not 500) → dev/debug endpoints 404
- [ ] **Login-path production smoke:** a real user can actually sign in on the deployed surface (earned: a UI once shipped to production with no working login path — caught only at deploy)
- [ ] Honest-failure paths confirmed (no false success)
- [ ] Monitoring + alerting live; **rehearsed rollback** with captured pre-change state
- [ ] Pack sign-offs: security/compliance (sensitive) · SEO (public) · evals (AI) · migrations reversible
- [ ] External verified (domains/DNS, accounts, consoles)

## Top risks (severity-ranked)
| # | Sev | Risk | Mitigation / gate |
|---|---|---|---|

## Remaining blockers
1. <…>

## Post-release checklist
- [ ] Validate production (smoke + validation harness vs prod)
- [ ] <indexing / reconciliation / monitoring watch> · [ ] start the measurement loop vs success metrics
