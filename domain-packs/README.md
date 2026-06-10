# Domain Packs

A **domain pack** is what makes the agnostic core fit a specific kind of project. Pick one or more at bootstrap; the pack tells you which **agents** to switch on, which **DoD rows** to add, and which **processes/checklists** apply.

## How to use
1. Read [PACKS.md](PACKS.md); choose the pack(s) matching your project (you can combine — e.g. an admin app that does invoicing = `internal-admin` + `invoicing`).
2. Copy the pack's **agents** into `.claude/agents/` (from `../agents/`).
3. Add the pack's **DoD rows** to your project's Definition of Done.
4. Wire the pack's **processes/checklists** into your workflow + CI.

## The packs
`public-web` · `internal-admin` · `crm` · `contracts-signatures` · `invoicing` · `api-first` · `ai-product`

A pack is **additive** over the lean default (Engineer + QA + Reviewer/Critic + human merge). The core never changes.
