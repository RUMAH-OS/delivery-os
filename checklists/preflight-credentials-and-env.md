# Preflight — credentials, accounts & environment (DAY ONE)

External dependencies gate the final mile. List + request them on day one; build provider-agnostic seams so code proceeds while they're pending.

## Accounts / access to request now
- [ ] Hosting (project created, repo connected) — note any **commit-author-match** rule the platform enforces
- [ ] DNS provider (and which records are **out of scope / untouchable**)
- [ ] Email/notification provider (verified sending domain)
- [ ] Payment / invoicing provider (if applicable) · [ ] E-signature provider (if applicable)
- [ ] Analytics / search console (if public) · [ ] Error/uptime monitoring
- [ ] Third-party APIs (sandbox + prod keys)

## Environment variables (define names + scopes up front)
| Name | Purpose | Scope(s) | Secret? | Required for |
|---|---|---|---|---|
| `<PROVIDER>_API_KEY` | … | prod (+ preview) | yes | … |

Rules: settle **exact names** early (code reads them verbatim); know which scope your live URL uses (a platform "production" env ≠ "preview"); build-time-inlined vars need a **rebuild**; secrets never in code/logs/responses; a diagnostic reports **presence**, not values.

## Toolchain (avoid mid-build setup)
- [ ] Runtime + package manager pinned; lockfile committed · [ ] DB/services provisioned so the builder can **self-verify** · [ ] CI runner + build gate defined · [ ] "how to run" in README

## Verify, don't assume
- [ ] After setting env, **prove** it at runtime (probe), not by belief · [ ] Confirm which deployment/build is actually serving before debugging behavior
