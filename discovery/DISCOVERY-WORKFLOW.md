# Project Discovery & Alignment — the mandatory first phase

> **Strategic clarity before architecture.** Every project runs this phase **immediately after Delivery OS is installed and before any roadmap, ADR, architecture, or implementation work.** A repo with code but no agreed brief/mission/north-star is a project building the wrong thing efficiently.

The lifecycle Delivery OS now enforces:
```
Founder Vision → Project Understanding → Mission Definition → Ecosystem Alignment → Architecture → Roadmap → Implementation
└──────────────── Discovery & Alignment (this phase) ─────────────────┘   └──── the rest of Delivery OS ────┘
```

## The hard gate
**No roadmap, ADR, architecture, or implementation work may begin until:**
1. `PROJECT-BRIEF.md`, `PROJECT-MISSION.md`, and `NORTH-STAR.md` exist **and are founder-approved**, and
2. Ecosystem alignment has been reviewed (source-of-truth + dependencies, if other projects exist).

This mirrors the rest of Delivery OS: the Project Manager / merge gate refuses to proceed to planning until the discovery checklist (`PROJECT-DISCOVERY-CHECKLIST.md`) is ✅.

## Who does what
- **Claude conducts** the interview (`FOUNDER-INTERVIEW.md`), **drafts** the three documents from the founder's answers, and reviews ecosystem alignment.
- **The founder answers and approves.** Nothing is generated from assumption — see the integrity rule.

## Integrity rule (the whole point)
> **Generate from answers, never from assumptions.** Every sentence in BRIEF/MISSION/NORTH-STAR traces to something the founder said. Where the founder doesn't know yet, write **`TBD — to confirm`** — an honest unknown is a finding, not a blank to fill with invention. Capture the founder's *own words* for the elevator line, the purpose, and the north star.

## The seven steps
| Step | Action | Output |
|---|---|---|
| **1** | **Install Delivery OS** (submodule/copy + scaffold; pick provisional packs via `PROJECT-SELECTION.md`) | `.claude/agents/`, `CLAUDE.md`, doc stubs |
| **2** | **Run the Founder Discovery Interview** (`FOUNDER-INTERVIEW.md`) — ask, reflect back, mark TBD; don't assume | captured answers |
| **3** | **Generate `PROJECT-BRIEF.md`** (what/who/why/success/constraints/risks) → founder reviews + approves | `docs/PROJECT-BRIEF.md` |
| **4** | **Generate `PROJECT-MISSION.md`** (purpose/responsibilities/non-goals/boundaries/success) → approve | `docs/PROJECT-MISSION.md` |
| **5** | **Generate `NORTH-STAR.md`** (long-term vision/platform role/ecosystem/3–5yr) → approve | `docs/NORTH-STAR.md` |
| **6** | **Review alignment with Ecosystem Architecture** — entities owned vs consumed, source-of-truth conflicts, dependencies; confirm/adjust the provisional pack choice | alignment note (+ ECR if a cross-project decision) |
| **7** | **Only then** begin roadmap, ADRs, and architecture | proceed to `GETTING-STARTED.md §2` |

## Relationship to other docs
- These three become the project's **business source of truth.** `project-context.md` (if used) is a one-screen operational digest that **points to** them — don't duplicate.
- **`PROJECT-SELECTION.md`** (pack triage) runs *before* install as a provisional choice; **Discovery confirms or adjusts it** in Step 6 (e.g. the mission reveals it also needs `invoicing`).
- Roadmap slices, ADRs, and architecture in the rest of Delivery OS must **trace back** to BRIEF/MISSION/NORTH-STAR; the Reviewer/Critic can reject scope that doesn't.

## How to start (the founder's experience)
The founder opens the new repo and says: **"Install Delivery OS and initialize this repository."** Claude — guided by the project's `CLAUDE.md` and `BOOTSTRAP-PROMPT.md` — knows its **first responsibility is this discovery phase**, not implementation. It conducts the interview, generates the documents, reviews alignment, and only then proposes a roadmap.
