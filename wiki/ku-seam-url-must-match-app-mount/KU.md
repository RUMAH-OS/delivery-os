---
kuId: ku-seam-url-must-match-app-mount
title: A cross-system seam URL must encode the consumer-fetchable path — the real app mount prefix — and be gate-validated against the actual route, or the consumer fetches a 404
kind: knowledge
status: active
version: 1
applies-to: [os]
claim: "A cross-system seam/contract URL field must encode the FULL consumer-fetchable path — including the producer's real application MOUNT PREFIX (e.g. /admin) — and the seam gate must validate it against the producer's ACTUAL route, not a plausible-looking path. A url that is well-formed but omits the mount prefix points at a route that does not exist: the consumer fetches it and gets a 404, attaching nothing — and a gate whose regex was written from an assumed path (not the real route) passes the broken url, so the defect ships invisibly and surfaces only on real consumer use."
triggers:
  - "what url should the seam emit"
  - "the consumer fetched a 404 / got no PDF / no attachment"
  - "does the contract url match the real route"
  - "is the seam url gate bound to the actual mount"
  - "I added a url field to an event/contract"
  - "why does the path 404 in prod but pass the gate"
  - "mount prefix missing from a seam url"
  - "app is mounted under /admin (or a sub-path) — does the contract know"
topics:
  - seam-url-must-carry-mount-prefix
  - contract-url-vs-real-route
  - gate-bound-to-actual-mount
  - consumer-404-on-malformed-seam-url
  - golden-fixture-for-seam-url
  - producer-emitter-is-the-source-of-truth-for-the-path
evidence-strength: runtime-evidenced
cited-quote: "matched a path that 404s at the real `/admin`"
source-provenance:
  earned-from: "pdfRef seam-URL fix, 2026-06-17 (commit 8ea0876): the seam pdfRef.url omitted the /admin mount prefix, so PLOS would fetch a 404 and attach no PDF — caught by real use, not design; fixed + independently verified"
  source-file: "../rumah-admin/docs/verify/VERIFY-pdfref-seam-fix.md"
  anchor: "Criterion 6 (lines 113-118, 'matched a path that 404s at the real /admin mount'); Criterion 2 (lines 61-79, corrected /admin urls accepted + old un-prefixed rejected, both kinds, against the live emitters src/admin.ts:1581/1713 and the matching authed routes); Final answers (lines 133-136)"
  signal-pattern: null
related:
  - ku-verify-seam-by-one-real-round-trip
  - ku-first-real-use-surfaces-invisible-gaps
  - ku-founder-discovered-failures-become-monitored-health-checks
tags: [seam, contract, url, mount-prefix, consumer-404, integration, gate, cross-system]
---

# A seam URL must carry the real app mount prefix — and the gate must bind to the actual route

> **Canonical source: `delivery-os/wiki/` (Founder OS). Apps inherit; this copy is identical — do not diverge.**

**Claim (the rule).** A cross-system seam/contract URL field is a *promise that the consumer can fetch this
exact path.* It must therefore encode the **full consumer-fetchable path**, including the producer's real
application **MOUNT PREFIX** (the sub-path the app is actually served under — e.g. `/admin`), and the seam
gate must validate that field against the producer's **ACTUAL route**, not against a path that merely looks
right. The source records the failure this prevents:

> matched a path that 404s at the real `/admin`

A url that is well-formed but missing the mount prefix points at a route that does not exist. The consumer
fetches it, gets a **404**, and attaches/renders **nothing** — a silent, contentless handoff.

**Why (the non-obvious reason).** The path in a contract looks self-evidently correct in isolation:
`/invoices/<id>/pdf` reads like a perfectly valid endpoint, and a gate regex written from that *assumed*
shape will happily pass it. But the producer does not serve its routes at the bare path — it mounts the whole
router under a prefix (`/admin/...`), so the route that actually exists is `/admin/invoices/<id>/pdf`. The
gap between "the path I assumed" and "the path the app really exposes" is invisible to anyone reasoning over
the contract alone, and invisible to a gate whose pattern was authored from the same wrong assumption — the
gate and the bug agree. Worse, this defect class is **producer-silent**: the producer emits a 200-shaped,
schema-valid event; nothing on the producer side ever fetches its own url, so the producer's tests stay
green. The 404 only happens in the *consumer's* runtime, on the *real* mount, which is why this is a
first-real-use discovery, not a design-time one. A plausible url is not a fetchable url.

**How to apply (domain-stripped, reusable).**
1. **Derive the path from the producer's ACTUAL emitter/route, never from assumption.** When you author or
   change any seam/contract url field, open the producer's real router and confirm the mount prefix + the
   exact route that serves it. The emitter that constructs the url and the route that answers it must be the
   *same* path — read both, side by side.
2. **Encode the full consumer-fetchable path, prefix included.** The url the seam carries must be exactly
   what the consumer will `GET` — relative `/<mount>/...` or an `https://host/<mount>/...` form. A url missing
   the mount is a future 404, not a shorter path.
3. **Bind the seam gate's regex to the REAL route, and reject the un-prefixed form.** The gate must REQUIRE
   the mount prefix and REJECT the old/bare path. Author the gate from the live route, not from the
   contract's wishful shape — otherwise the gate ratifies the bug. Prove both directions: corrected url
   accepted, old un-prefixed url rejected for the right reason.
4. **Add a golden fixture per kind.** Land a good fixture carrying the real `/<mount>/...` url (and a bad one
   with the bare path) so the gate's accept/reject is pinned to a concrete artifact and cannot silently
   regress. Cover every kind/variant the seam emits (e.g. each document type), not just one.
5. **Close it with one real round-trip when possible.** The conclusive proof is the consumer fetching the url
   on the real mount and getting the artifact (see `ku-verify-seam-by-one-real-round-trip`); a green producer
   gate alone never proves the path resolves on the consumer's side.

**The test for any "the seam url is correct" claim.** Ask: *"is this url the EXACT path the consumer will
fetch on the producer's real mount — and did I confirm it against the live route, not a plausible-looking
path? Does the gate REQUIRE the mount prefix and reject the bare form?"* If the url was written from an
assumed path, or the gate was authored from the same assumption, a 404 is sitting in the contract right now,
invisible until a real consumer fetches it.

**Runtime evidence anchor (the load-bearing instance — Rumah Admin).** The pdfRef seam-URL fix
(2026-06-17, commit 8ea0876) corrected a contract where `pdfRef.url` omitted the `/admin` mount prefix:
the earlier un-prefixed pattern "matched a path that 404s at the real `/admin`" mount, so PLOS (the consumer)
would fetch a 404 and attach no PDF — caught by real use, not by design or producer tests. The fix required
the `/admin/` prefix and rejected the bare form for BOTH kinds, confirmed against the live emitters
(`src/admin.ts:1581` invoice `/admin/invoices/${id}/pdf`, `src/admin.ts:1713` credit-note
`/admin/credit-notes/${cn.id}/pdf`) and the matching authed routes, with good/bad golden fixtures per kind
(`tests/fixtures/seam-good-pdfref.json`, `seam-good-credited.json`) and an independent author≠verifier PASS.
The version call was a v1 in-place corrective: the broken un-prefixed form was never fetchable and no consumer
had emitted against it, so there was no legacy emission to honor.

**Source binding (promote-AND-preserve — Knowledge-Lost = 0).** Distilled from the independent verification
`../rumah-admin/docs/verify/VERIFY-pdfref-seam-fix.md` (Criterion 6 — the 404-at-the-real-mount root cause;
Criterion 2 — corrected `/admin` urls accepted + old un-prefixed rejected, both kinds, against the live
emitters/routes; Final answers), which STAYS as the detailed source. Siblings:
`ku-first-real-use-surfaces-invisible-gaps` (the META lesson — real use surfaces what design cannot) and
`ku-verify-seam-by-one-real-round-trip` (prove the seam by one real handshake, the conclusive closure for
this defect class). This KU is the specific, retrievable contract-design rule; the verify report is
preserved, not replaced.
