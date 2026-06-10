# Process: SEO (optional — public surfaces only)

Skip entirely for internal apps. Owned by the `seo-validation` agent.

## Born-indexable by convention
Route metadata through one helper so every page is **born correct**: server-rendered title/description, **self-referencing canonical**, `index,follow`, OG/Twitter, structured data. A single `buildMetadata`-style function + a CI harness that **fails on any violation** beats per-page vigilance.

## Rules
- **Audience → Intent → Page**, not Keyword → Page. One page = one audience = one intent. Consolidate near-duplicates via 301/308.
- Verify with raw HTTP/`view-source`, never the hydrated DOM.
- Safety mechanisms (e.g. `noindex`) must be **host-scoped** so they never suppress production.
- Treat a launch on an existing domain as a **search-recovery event**: verify the search console, submit the sitemap, request indexing, and build a **legacy-URL → redirect map**.

## Pre-launch indexability audit
For every live route: index/noindex · in-sitemap · canonical · status. Verdict: SAFE / NOT-SAFE. No sitemap URL may be `noindex`; the only noindex pages are intentional utilities, excluded from the sitemap. See `checklists/release-cutover.md`.
