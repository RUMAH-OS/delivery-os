# Release / cutover checklist

General release gate; the DNS-cutover annex applies only to public-web. See `processes/deployment-governance.md`.

## Pre-stage (no downtime, do early)
- [ ] Target env built + env vars complete in the **correct scope**
- [ ] **Capture restoreable state** (DNS records incl. out-of-scope ones, or a data backup) — *can't roll back to what you didn't capture*
- [ ] Lower DNS TTL ~300s (web) / prepare flags (app)
- [ ] Final pre-prod validation green incl. **one real end-to-end transaction**

## Release
- [ ] Promote the validated build (don't rebuild differently) · [ ] change **only** intended records/config; **verify out-of-scope boundaries untouched**
- [ ] (web) correct **primary host** set (wrong primary → cert/CN mismatch + redirect loop)

## Post-release validation
- [ ] HTTPS/cert valid (web) · [ ] core surfaces serve; **validation harness green vs production**
- [ ] redirects correct (permanent/308 where canonicalizing) · [ ] **real production transaction** verified · [ ] out-of-scope systems unaffected · [ ] monitoring healthy

## Rollback (one step away)
- [ ] App: instant-rollback to last-good · [ ] Feature: flag off · [ ] Schema: down + restore backup · [ ] DNS: revert records (~TTL) · [ ] restore TTLs once stable 24–48h

## Public-web annex (indexability)
- [ ] every live route index/canonical correct; `/thank-you`-style utilities noindex + excluded from sitemap; **no sitemap URL noindex** · [ ] submit sitemap + request indexing + legacy→redirect map
