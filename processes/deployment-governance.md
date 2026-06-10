# Process: Deployment / Release Governance

Replaces "launch = DNS cutover" with a general model. DNS cutover is **one annex**, not the spine.

## Environments
`local → preview/staging → production`. Each has its own config/secrets **scope**. Know which scope your live URL actually uses (a platform "production" env ≠ "preview"). Build-time-inlined vars need a **rebuild** to take effect.

## Promotion
Code is **promoted**, not rebuilt differently per env. Production deploys from the default branch (or a promoted, validated build). CI must be green in the cloud (not just one machine) before promotion.

## Release strategies (pick per change)
- **Continuous** (internal apps) — small changes flow to prod behind auth.
- **Feature flags** — decouple deploy from release; dark-launch, ramp, kill-switch.
- **Blue-green / canary** — shift traffic gradually; watch metrics; auto/most-rollback on regression.
- **Big-bang cutover** — only when unavoidable (e.g. a public DNS switch — see annex).

## Rollback — by change type
| Change | Rollback lever |
|---|---|
| App code | platform **instant rollback** to last-good deployment |
| Feature | **flag off** |
| Schema migration | the migration's tested **down** + restore from the pre-change backup |
| DNS/domain | revert the record (low TTL) — see annex |
**Always capture restoreable state before the change.** Migration-vs-deploy ordering: expand schema → deploy code that tolerates both → backfill → switch → contract.

## Gates before production
Runs in the real target env · CI green in cloud · one **real end-to-end transaction** verified · honest-failure paths confirmed · monitoring + alerting live · **rehearsed rollback** · security/SEO/domain sign-offs per pack · external (domains/DNS/accounts) verified.

## Annex — public DNS cutover (web)
Pre-stage (add domains, set env, **capture current records incl. any out-of-scope ones**, lower TTL to ~300s, pre-verify search console). Cut over the **intended records only**; verify out-of-scope boundaries are untouched; set the **correct primary host** (a wrong primary causes cert/CN mismatch + redirect loops); validate prod (TLS, harness, redirects, a real transaction). Rollback = revert records (~TTL minutes). See `checklists/release-cutover.md`.
