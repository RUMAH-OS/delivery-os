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
- [ ] Runs in the **real target env** (deployed, not just local)
- [ ] CI green **in the cloud**
- [ ] **One real end-to-end transaction** verified (lead delivered / payment captured / contract signed / agent output correct)
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
