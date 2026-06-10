# Bootstrap Prompt — use this to start every new project

When you open a brand-new repository with Delivery OS installed, give Claude this prompt. It makes Claude's **first responsibility** the discovery interview — not implementation.

> The scaffolder (`scripts/new-project.sh`) also writes a `CLAUDE.md` into the new repo encoding the same instruction, so Claude picks it up automatically. The prompt below is the explicit, paste-anywhere version.

---

## The standard bootstrap prompt (copy/paste)
```
Install Delivery OS and initialize this repository.

Before any roadmap, ADRs, architecture, or implementation:
1. Conduct the Delivery OS Founder Discovery Interview
   (delivery-os/discovery/FOUNDER-INTERVIEW.md). Ask me the questions,
   one part at a time; reflect each part back; do NOT assume answers —
   mark anything I don't know as "TBD — to confirm".
2. From my answers, generate docs/PROJECT-BRIEF.md, docs/PROJECT-MISSION.md,
   and docs/NORTH-STAR.md (from delivery-os/templates/). Get my approval on each.
3. Review alignment with the Ecosystem Architecture (entities owned vs consumed,
   source-of-truth conflicts, dependencies). Confirm or adjust the pack choice.
4. Only after I approve those documents may you create the roadmap, ADRs,
   and architecture (delivery-os/GETTING-STARTED.md §2).

Follow delivery-os/discovery/DISCOVERY-WORKFLOW.md and gate on
delivery-os/discovery/PROJECT-DISCOVERY-CHECKLIST.md.
```

## Short version
```
Initialize this repo with Delivery OS. Your first job is the Founder Discovery
Interview (delivery-os/discovery/FOUNDER-INTERVIEW.md) → generate PROJECT-BRIEF,
PROJECT-MISSION, NORTH-STAR from my answers (don't assume; mark TBD) → ecosystem
alignment → only then roadmap/ADRs/architecture.
```

## Why a prompt *and* a CLAUDE.md
- **`CLAUDE.md`** (written into the repo by the scaffolder) means Claude knows the discovery-first rule in *every* session, even without the prompt.
- **The prompt** is the explicit kickoff that starts the interview now. Use both.

## The experience this creates
You say *"Install Delivery OS and initialize this repository."* Claude doesn't start scaffolding features — it sits you down for a 20–40 minute founder interview, writes your brief/mission/north-star from **your** answers, checks ecosystem alignment, and only then proposes a roadmap. **Strategic clarity first, implementation second.**
