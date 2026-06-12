# Process: QA & Testing

Generalizes v1's single "validation harness" into a full taxonomy. Authored by QA; runs in CI; the verifier owns the test trees (author ≠ verifier).

## Test types (use what the slice needs)
| Type | Proves | Notes |
|---|---|---|
| **Unit** | a function/module is correct | fast, many |
| **Property / determinism** | invariants hold across inputs (e.g. identical inputs → identical output) | protects deterministic cores |
| **Contract** | an API/consumer boundary holds | API-first / integrations |
| **Integration** | components + real dependencies work together | sandboxes/test doubles |
| **E2E / workflow** | the full path works (capture → store → display) | the acceptance contract |
| **Evals** | runtime-agent output quality | AI products (`ai-product`) |
| **Smoke** | prod is alive after release | post-deploy |
| **Migration** | applies clean, forward-only, on a fresh DB | data slices |

## The validation harness (every project)
A script in CI that **fails the build on any violation of the project's invariants** — the generalization of "check:seo." Its assertions are domain-specific (canonical correctness for web; contract conformance for API; money-balance for invoicing; grounding for AI). It is the executable form of the project's "must always be true."

## Principles
- **Verify at runtime**, not by reading code or the hydrated DOM.
- **Test the failure paths** (empty/bad config, downstream failure, abuse) → honest error, no false success.
- **Independent of the author's tests**, on a clean checkout, CI green.
- **Regressions become permanent** harness/eval entries.
- **Re-verify raised conditions** are actually resolved.
- **Machine-guard preamble + run-unique tokens (v4):** any test touching a shared resource (DB, queue, port)
  first proves the resource is its own (PID check; DB name asserted `*_test` via the scaffolded
  `assertTestDatabase` guard) and stamps every fixture/assertion with a **run-unique token** — the same
  shared-resource race recurred three times before tokens made cross-run collisions impossible.
- **Self-inflicted-destruction audit (v4, K10):** under any append-only/preservation doctrine, QA explicitly
  sweeps the UPDATE-clobber and CASCADE paths — self-inflicted data destruction is the most expensive defect
  class on record (timestamp clobbering, draft destruction at send, CASCADE deletes through "append-only"
  stores — all permanent, all invisible to green tests).

## Toolchain prerequisite
Provision the runtime/DB **before** the build so the Engineer self-verifies (typecheck/lint/build/run green) before "ready for QA." (Both source projects lost a cycle to skipping this.)
