# E2E Workflow Verification — LOCAL/TEST A-to-Z (2026-06-27)

**Verifier:** QA / Test (independent; author ≠ verifier)
**Scope:** Prove the full-platform workflow LOGIC end-to-end at the level achievable WITHOUT production.
The live-prod legs (real Gmail/OAuth send, live Vercel deploy, real customer data/money) are founder-gated
on secrets and are explicitly OUT of scope — this run de-risks the cutover, it does not perform it.
**Constraint honored:** No prod data/secrets touched. No deploy. No merge. All runs against the local test
DBs (`rumah-admin-testdb` :55432 / `rumah_admin_test`; `plos-qa-pg` :5433 → `plos_test`).

---

## OVERALL VERDICT

**Workflow logic: PASS (PROVEN-IN-TEST).** Every A-to-Z chain in scope is demonstrated green against the
test DBs and stub ports. The admin lifecycle e2e driver is 19/19; the cross-system invoice-delivery chain is
proven on each side against the canonical seam contract; discovery, owner-invoices, reliability keystones, and
the infra platform layer are all green.

**Regression bar: PASS WITH 4 TRACKED CONDITIONS (not clean-green as-executed).** The full-suite runs
surfaced 1 failing assertion + 1 suite-collection failure (admin) and 2 failing assertions (PLOS). **All four
are root-caused as TEST-ISOLATION / HARNESS artifacts on the shared test DBs — none is a product defect**
(each passes when run isolated / with the env CI provides). They are filed as bug reports (BUG-1..3) and must
be cleared for the gate to be trustworthy-green. A 5th item (BUG-4) is a real integration/doc gap: the
config-doctor layer is on an unmerged branch but is advertised by main.

**Cutover readiness:** the workflow logic is proven; the residual risk is concentrated in the REQUIRE-PROD
legs (below) plus BUG-4 (config-doctor not on the deploy branch).

---

## Regression baseline (full suites, as executed)

| Repo | Command | Result |
|---|---|---|
| rumah-admin | `RUMAH_ENV=test DATABASE_URL=…/rumah_admin_test vitest run` | **1008 passed**, 4 skipped, **1 failed** (BUG-1) + **1 suite collection-failed** (BUG-2); 82/84 files green. Duration 149s. |
| property-lead-os | `vitest run` (parallel) | **2617 passed**, 7 skipped, **2 failed** (BUG-3); 221/224 files green. Duration ~270s incl. collect. |

Re-runs proving the failures are harness-only:
- BUG-2 file with `DATABASE_URL` exported (as CI does): `migration.smoke.test.ts` → **3/3 PASS**.
- BUG-3 files isolated/serial: `outreach-intelligence.integration` + `r1-business-pack` → **11/11 PASS**.
- BUG-1: still red in isolation — root-caused as a false-positive assertion, product correct (see BUG-1).

Migrations apply clean on the test DB: `db:test:migrate` → 50 discovered, up-to-date incl. `0050_invoice_delivery_package`, `0051_delivery_tracking_keys`; 3 founder-gated migrations correctly skipped (occupancy/inventory — out of scope).

---

## Per-workflow results (clean isolated runs for named evidence)

### 1. Admin→PLOS invoice delivery — A-to-Z — **PASS (with a known e2e coverage gap)**

**Admin producer side** — `vitest run seam-conformance, deliveries-seam, deliveries-seam-qa,
invoice-delivery-package.qa, invoice-delivery-package-iban.qa, invoice-lifecycle-transitions.qa,
invoice-prepared-immutability.qa, send-requested-notice.qa, keystone-p0-heartbeat, keystone-p0-send-and-drain`
→ **10 files / 131 tests PASS.**
Proves: contract→invoice generation→immutable `InvoiceDeliveryPackage` (recipient/subject/body/PDF/metadata)→
`invoice.send_requested` emitted through the REAL emit path, conformant to the canonical seam contract with
ZERO PII leak (sentinel-checked); the inbound `POST /v1/deliveries` records-only callback preserves invoice
immutability (money/status/`email_sent_at` unchanged, outbox count unchanged — no re-emission), is idempotent
(2nd POST delta = 0), PII-free, and scope-gated (`deliveries:write` not implied).

**Admin lifecycle e2e driver** — `tsx tests/_qa-lifecycle-e2e.driver.ts` (independent driver, boots the real
Hono app on the test DB) → **19/19 PASS**, incl. issued→sent transition, resend-requires-confirm, scheduled→
runner-send emitting PLOS `send_requested`, and money-frozen-at-issue immutability (DB trigger enforced).

**PLOS consumer side** — `vitest run invoice-delivery.integration, invoice-delivery, delivery-package-send.integration,
mi2-review-queue(.integration/.test), admin-events-drain.integration, admin-events-drain-cron-route,
autonomous-admin-drain, admin-handoff-integrity` → **9 files / 111 tests PASS.**
Proves: drain (idempotent / resumable-from-cursor / at-least-once with dedup / honest-throw on auth fail) →
materialize-pending (ONE pending row per `send_requested`, idempotent; malformed/absent-notice events are
HONEST SKIPS, never crashes) → review queue (gated rows with Admin's structured reason; preview == send) →
confirm/prepare (draft IS Admin's verbatim package; ADR-0005) → execute/send via the REAL send adapter
(verbatim MULTIPART email through the stub/test port; idempotent — re-execute does NOT double-send) →
failure path (send error → failed + error recorded + failed-outcome POST back to Admin).

**e2e coverage GAP (noted, by-design-deferred):** No single test boots BOTH repos' HTTP servers and runs the
events feed + `/v1/deliveries` callback over the wire. Each side is verified INDEPENDENTLY against the same
canonical contract bytes (`.claude/os/tools/admin-plos-seam-v1.mjs`) + shared fixtures + a local stub feed /
send-port. The cross-repo live handoff + merge-gate wiring are explicitly deferred (per the seam-conformance
header: "v6 capabilities #2/#3/#11 — noted, not built here"). → the live two-repo handoff is **REQUIRE-PROD**
(or a future cross-repo harness). The contract conformance on both ends makes this a low-risk gap, but it is a
real gap.

### 2. Owner invoices — **PASS**

`vitest run owner-invoices.qa, owner-invoices.independent-qa, owner-invoice-detail.independent-qa,
owner-invoices-ar-regenerate.independent-qa, owner-invoices-consolidated.qa, owner-invoices-consolidated-verify.qa,
owner-invoices-surface.qa, owner-invoice-workflows.qa` → **8 files / 114 tests PASS.**
Plus `invoice-pdf.test.ts` (the unified money formatter / PDF) green within the platform-health+pdf batch (17 tests).
Covers generation, detail/PDF rendering, payments/AR ledger, consolidated regenerate.

### 3. Discovery pipeline — **PASS**

`vitest run a1-discovery-flow.integration, a1-discovery, discovery-sweep, discovery-sweep-deps.integration,
floor-discovery-gate` → **5 files / 31 tests PASS.**
Proves the sweep orchestrator: research→contacts→**promote** with NO manual gesture; NEVER-THROWS (a throwing
stage is recorded as an ACTIONABLE error and the sweep CONTINUES past the bad lead); idempotent clean no-op
when nothing is ready; selection-fault is a LOUD error yet later stages still run; the qualified→outreach_ready
promotion advances exactly the promote-eligible lead (usable decision-maker contact).

### 4. Reliability / events / callbacks (keystones) — **PASS**

Covered within the admin keystone batch (part of the 131 above) + PLOS drain suite:
- **Heartbeat/scheduler advances a run + emits settle** — `keystone-p0-heartbeat` P0-1: heartbeat DRIVES the
  engine tick, advances a freshly-enqueued invoice-send run (queued→blocked on the delivery callback); then
  `enqueue → heartbeat (block) → delivery callback → run settles + emits invoice.send_settled` (no longer stuck).
- **Drain exactly-once / poison-pill** — `keystone-p0-send-and-drain` P0-8: a malformed outbox payload is
  SKIPPED (not a 500), valid rows still drain, cursor advances past it. PLOS drain: 2nd drain = 0 new rows,
  resumable from mid-cursor, at-least-once with dedup.
- **Double-send claim guard** — P0-9: two concurrent `/send` for the same invoice emit EXACTLY ONE
  `invoice.send_requested`; a sequential repeat returns the existing request (deduplicated, no new emit).
- **No-silent-send** — P0-3: a no-recipient send is NOT silent (durable `invoice.send_blocked` fact + audit
  row; the runner classifies it FAILED, never a silent `sent[]`).
- **Callback reconcile** — `deliveries-seam-qa` idempotency (delta = 0 on 2nd POST) + the settlement reconcile above.

### 5. Infrastructure Platform layer — **PASS (logic) — but config-doctor is NOT on main (BUG-4)**

| Component | Evidence |
|---|---|
| platform-health self-test | **30/30** (rumah-admin AND property-lead-os) |
| rollback-helper self-test | **7/7** (both repos) |
| post-deploy-verify self-test | **10/10** (both repos) |
| config-doctor self-test | **16/16** — run from branch copy (see BUG-4) |
| platform-health integration | admin `platform-health.test.ts` 2 files/17 PASS; PLOS `platform-health.test.ts` 6 PASS |
| diagnose / health endpoint | admin `src/platform-health.ts` taxonomy covered by platform-health.test.ts; PLOS `app/api/health/diagnose` covered by platform-health.test.ts |

---

## PROVEN-IN-TEST vs REQUIRE-PROD (the cutover split)

| Step in the A-to-Z chain | Status |
|---|---|
| Contract → invoice generation | **PROVEN-IN-TEST** |
| Admin immutable `InvoiceDeliveryPackage` (recipient/subject/body/PDF/metadata/tracking) | **PROVEN-IN-TEST** |
| `invoice.send_requested` emitted (canonical seam contract, PII-free) | **PROVEN-IN-TEST** |
| Atomic double-send dedup (exactly-one emit) | **PROVEN-IN-TEST** |
| PLOS drain → materialize-pending → review queue → confirm/prepare | **PROVEN-IN-TEST** |
| Send via send port (verbatim multipart, idempotent) | **PROVEN-IN-TEST (stub/test adapter)** |
| **Real Gmail/OAuth send to a real recipient** | **REQUIRE-PROD** (live OAuth creds; founder-gated) |
| `POST /v1/deliveries` callback → Admin records (records-only, immutable) | **PROVEN-IN-TEST (each side)** |
| Lifecycle issued → sent | **PROVEN-IN-TEST** |
| Heartbeat advances run → `invoice.send_settled` reconcile | **PROVEN-IN-TEST** |
| **Live two-repo handoff over the wire (single boot of both servers)** | **REQUIRE-PROD / future cross-repo harness** (GAP-1) |
| Discovery sweep promote (qualified→outreach_ready), never-throw | **PROVEN-IN-TEST** |
| Owner invoices generate/detail/PDF/AR/regenerate | **PROVEN-IN-TEST** |
| Infra self-tests (health/rollback/post-deploy/config-doctor) | **PROVEN-IN-TEST** (config-doctor only on branch — BUG-4) |
| **config-doctor against the live Vercel prod env** | **REQUIRE-PROD** (+ REQUIRE-MERGE first — BUG-4) |
| **Live deploy / post-deploy-verify against prod / rollback execution** | **REQUIRE-PROD** (logic proven by self-test) |
| **Real customer data, real money movement** | **REQUIRE-PROD** |

---

## Bug reports (itemized; QA files, does not fix)

**BUG-1 — `contract.inventory-v1.test.ts` "LEAKS NO owner PII" false-positive (TEST DEFECT, MINOR).**
The v1 inventory PII spec queries ALL public properties and asserts the body does not contain the substring
`"iban"`. It fails because the shared `rumah_admin_test` DB holds leftover property rows with slug
`iqa-iban-…-p` seeded by the sibling `invoice-delivery-package-iban.qa.test.ts` — and `slug` is a legitimately
public field. The product does NOT leak owner PII: the actual IBAN value `NL00BANK0000000000`, `legal_name`,
`owner_id`/`ownerId`, email and KVK all correctly pass the same loop; only the bare token `"iban"` trips, on
another test's public slug. Two compounding causes: (a) the assertion token is too broad (a value-substring,
not the seeded PII value / not word-boundaried); (b) `invoice-delivery-package-iban.qa.test.ts` leaves rows
behind (no teardown), polluting the shared DB across runs. Fix options: scope the v1 query to the test's own
seeded rows, OR tighten the token to the actual seeded IBAN value, OR truncate/clean between files.
Evidence: `docker exec rumah-admin-testdb psql … WHERE slug ILIKE '%iban%'` returns ~20 `iqa-iban-*` slugs.

**BUG-2 — `migration.smoke.test.ts` env coupling (HARNESS, MINOR).**
Reads `process.env.DATABASE_URL` at module load WITHOUT importing `src/env.ts` (which is what loads
`.env.test`). Under a bare `vitest run` it fails at `beforeAll` ("DATABASE_URL not set"); it passes in CI
(which exports `DATABASE_URL`) and when the var is exported locally (re-run: **3/3 PASS**). Fix: add a
vitest `setupFile` that loads `.env.test`, or import `env.ts` in the spec.

**BUG-3 — PLOS determinism specs flaky under parallel run (TEST ISOLATION, MINOR/FLAKE).**
`outreach-intelligence.integration.test.ts` ("two reads of the SAME DB state ⇒ byte-identical") and
`r1-business-pack.test.ts` ("same DB + same clock ⇒ byte-identical Fact[]") fail in the full parallel run
because OTHER test files write to the shared `plos_test` DB between the two reads, breaking byte-identity.
Both **PASS in isolation / serial (11/11)** — the product IS deterministic for a fixed DB state. Fix: run the
determinism specs serially or against a private schema/snapshot.

**BUG-4 — config-doctor advertised by main but only present on an unmerged branch (INTEGRATION/DOC GAP, MEDIUM).**
`infra/config-doctor.mjs` (the "first half of the Infrastructure Platform", self-test **16/16**) exists only on
branch `infra/config-registry-layer` (commit `afb1d61 feat(infra): config registry + doctor + fail-closed
prod config-gate`), which is **NOT an ancestor of HEAD/main**. Yet main's `infra/platform-health.mjs`
remediation strings and `infra/PLATFORM-HEALTH-RUNBOOK.md` instruct operators to run
`node infra/config-doctor.mjs --env production` — a file absent on the deploy branch. Runtime impact is limited
(the references are text in remediation messages, not imports, so platform-health still runs), but the
documented pre-deploy config GATE and its `.github/workflows/config-gate.yml` are not actually on the branch
that deploys. Cutover risk: the config gate the runbook promises does not exist on main. Resolve by merging
the branch (independent verification of that slice required) or by not advertising it until merged.

**GAP-1 — no live two-repo e2e (COVERAGE GAP, by-design-deferred).** See workflow 1. The cross-repo handoff is
proven only via per-side conformance to identical contract bytes + stubs; no single test boots both servers.
Tracked as v6 #2/#3/#11; the live handoff falls under REQUIRE-PROD.

---

## Re-verification of raised conditions

- BUG-2 raised → re-ran with `DATABASE_URL` exported → resolved-in-CI-conditions (3/3). Confirmed harness-only.
- BUG-3 raised → re-ran isolated/serial → resolved (11/11). Confirmed parallel-shared-DB-only.
- BUG-1 raised → re-ran isolated → still red → traced to sibling-slug DB pollution; confirmed product-correct.
- BUG-4 raised → confirmed via `git merge-base --is-ancestor afb1d61 HEAD` = NOT ancestor; file absent from `git ls-files`.

**Bottom line:** the founder's A-to-Z workflow logic is PROVEN-IN-TEST and the cutover is de-risked at the
no-prod level. Clear BUG-1..3 (test-isolation hygiene) and resolve BUG-4 (merge or stop advertising
config-doctor) before treating the regression bar as clean-green. The real-send, live-deploy, live cross-repo,
and real-data legs remain correctly REQUIRE-PROD and founder-gated.
