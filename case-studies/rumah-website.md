# Case study: Rumah Website (`public-web`)

A CSR site that Google couldn't index, rebuilt server-rendered and launched.

## Pack & roster
`public-web` — Lead Architect, Engineer, QA, SEO-validation, Design-parity, + Documentation/PM. (Pre-v2, so it used a larger roster than the lean default.)

## What the framework caught / enforced
- **Independent QA before "done"** caught real defects: canonical-inheritance (every page canonicalizing to home), title duplication, broken og:image, double-firing conversion, near-duplicate landing pages.
- **Validation harness in CI** (`check:seo`) failed the build on any indexability violation — the executable "must always be true."
- **Convention-in-code** (`buildMetadata`) made every page born-indexable; the harness policed it.
- **Honest failure**: the enquiry endpoint returns 502 (not a false "thanks") when no delivery channel is configured — which later made a production misconfig obvious.
- **Host-scoped safety**: `noindex` only on preview hosts (middleware), so it could never suppress production.

## Lessons that became framework rules
- **De-risk early**: the audit found the build had never run in its target env — promoted to "thin slice to prod in Phase 1–2."
- **Request credentials day one**: the lead pipeline / GSC / DNS gated the final mile.
- **Evidence over assumptions**: a runtime **diagnostic probe** root-caused a lead-delivery failure (a missing env var in the wrong scope) after several guesses failed.
- **Capture rollback state before DNS changes**; lower TTL first; set the correct **primary host** (a wrong primary caused a cert/CN mismatch + redirect loop).
- **Toolchain as a prerequisite** so the builder can self-verify.

## Pack mechanics demonstrated
`processes/seo.md`, `checklists/release-cutover.md` (DNS annex + indexability audit), `deployment-governance.md` (Cloud86 DNS cutover as the annex).
