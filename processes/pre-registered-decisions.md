# Process: Pre-Registered Decision / Learning Reviews

For data- or experiment-driven decisions (does the funnel work? is the feature better? did the change help?). Guards against fitting the story to the data after seeing it. Optional but powerful — especially for AI/learning systems.

## The contract
Write — **before any data exists** — and freeze:
1. **Hypotheses** (primary + secondary), stated falsifiably.
2. **Metrics** (exact definitions, from existing data where possible).
3. **Minimum sample** to read each metric (below it → INCONCLUSIVE, never a decision).
4. **Decision rules** — the pre-committed action each result triggers (supported / challenged / inconclusive).
5. **The action tree** — what each verdict does next.

## Integrity rules
- §1–§4 **frozen** once the first data point arrives; later changes are dated amendments in git, not silent edits.
- New questions after seeing data are **exploratory / post-hoc** (hypothesis-generating), never folded into the confirmatory set.
- Small N is **directional, not significant** — treat verdicts as weak priors; qualitative often beats quantitative early.
- **Learning stays human-gated** — outcomes inform human decisions; nothing auto-feeds a model/scorer (pairs with `ai-product-engineering.md`).

## Why
It stops "we saw the numbers and decided what we already wanted." The value depends entirely on it being written **before** the data. Template: `templates/decision-preregistration.md`.
