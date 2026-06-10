# Process: AI-Product Engineering

How to build products that **contain** AI agents. The single biggest addition in v2. Owned by the `ai-product` domain agent + QA (for evals).

## 1. Two planes — never conflate them
- **Build-time agents** (`agents/`) write and verify the product.
- **Runtime agents** are **part of the product** — they are governed here.
A runtime agent's spec lives in the codebase (prompt + tools + output schema + budget), is owned by the Engineer, and is **tested by evals** owned by QA.

## 2. The determinism boundary (the core discipline)
> Anything that must be **reproducible, auditable, or fair** — scoring, ranking-by-fixed-rules, money math, eligibility — lives in **pure code, never the LLM.**
The model **proposes** (extracts, drafts, summarizes, classifies); deterministic code **decides** where determinism is required. Test it: identical inputs → **byte-identical** output. This keeps results explainable and lets you change the model without changing the verdicts.

## 3. Evals (the AI test type) — owned by QA, in `evals/`
- **Golden sets** — fixture inputs → expected outputs; deterministic paths assert **exact match**.
- **Grounding** — every claimed fact carries a **source**; the eval fails on a fact not supported by the provided context (no hallucination).
- **Sanity/judgement** — for open-ended output, bounded checks (format, no forbidden content, recommendation plausibility).
- An AI change is **not done until evals pass** (a DoD row for `ai-product`). Evals run in CI like tests.

## 4. Agent-run audit
Log **every** runtime agent run: model, tokens, cost, tool calls, inputs, outputs, latency. This is your explainability + debugging substrate and your cost control.

## 5. Human-gated actions
Agents **draft**; they do not act. No runtime agent holds an unguarded **irreversible/outward** tool (send, charge, publish, delete, post). The act is a **separate human-approved step**. (Drafting an email is fine; sending it is a human gate.)

## 6. Graceful degradation
On provider/tool/timeout failure: emit a **flagged partial** result (or a clean error), never a fabricated one and never a hard crash. Budgets + timeouts + retries + caching are first-class.

## 7. Learning — human in the loop
Outcomes inform **human** decisions. Do **not** auto-feed outcomes back into a model/scorer. When you do learn, do it through a **pre-registered decision review** (`pre-registered-decisions.md`) so you don't fit the story to the data.

## DoD rows this process contributes (`ai-product` pack)
- [ ] Evals pass (golden + grounding) · [ ] Determinism holds where required · [ ] Agent-run audit in place · [ ] No unguarded irreversible tool · [ ] Graceful degradation on failure · [ ] Every runtime decision is explainable.
