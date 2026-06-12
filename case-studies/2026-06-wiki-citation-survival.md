# Case study — the wiki layer and the citation-survival test (X1 / founder ruling F6)

**Disposition:** the wiki is **retired from the v4 scaffold** (archive-with-pointer — the templates survive at
`docs/archive/wiki-templates/`; nothing silently deleted). This file records why, so the lesson is not
re-purchased.

## The evidence
- **Zero wiki pages were ever written across two consecutive projects and 57+ combined slices.**
  property-lead-os: a full wiki skeleton (`wiki/_index.md`, learnings/, market/, customers/, processes/)
  shipped at scaffold; after the heaviest operating month in the portfolio's history it held no pages.
  rumah-admin's final router (§4) said it plainly: *"no wiki pages yet — earned, not scaffolded"* — through a
  complete discovery → migration → production-cutover arc, it never earned one either.
- **The empirical survival test (#76 §6):** a document survives iff a later artifact cites it. The friction
  log, proposals/panel case law, and VERIFY artifacts are heavily cited; the registries were consulted rarely
  and trusted wrongly; **the wiki was cited by nothing, ever.**
- The promised wiki-freshness machinery (`last_verified`, `stability: stale`, the context-hygiene pass) never
  visibly ran — a second hand-maintained surface stacked on the first.

## The diagnosis
The wiki was a *destination without a producer*: every real knowledge class it was meant to hold had a
better-fitting home that actually got written — narrative/learnings → the friction log + retrospectives;
decisions → the ledger/proposals; market/customer facts → project docs; reusable technique → skills;
cross-project doctrine → the (then-missing) portfolio tier. v3's write-back table routed to the wiki; the
write-backs routed around it.

## What replaces it (v4)
**Three-tier memory** (B17/K5): `memory/doctrine/` (noun-free portfolio doctrine, scaffold-seeded — the day-1
inheritance the wiki never provided) · `memory/<project>/` (nouns stay local) · **state never stored, always
derived**. Plus the four registries (DECISIONS / INVARIANTS / gates / friction-log) for the record classes the
wiki silently claimed.

## The portable lesson (noun-free, in the doctrine seed's spirit)
A knowledge layer earns scaffold space only with a demonstrated producer and a citing consumer; "we will fill
it in" is the same failure mode as an unenforced DoD row. Citation is the survival test — run it before
shipping any new documentation layer.
