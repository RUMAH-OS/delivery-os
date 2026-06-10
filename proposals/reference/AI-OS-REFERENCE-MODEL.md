# AI Operating System — Reference Model (the "Four C's")

> The reference architecture the founder is aligning Delivery OS to. Extracted from the source transcript (Nate Herk, "Cloud Fable AI operating system / second brain," 2026-06-09). This is the **binding reference** for the Step-2 target-architecture design. Captured 2026-06-10.
> NOTE on domain fit: the source is a *personal/business productivity* AIOS for a solo creator + small team. Delivery OS is a *software-delivery* framework with hard correctness/enforcement needs (contracts, signatures, invoicing, migrations, author≠verifier). Where the two genuinely conflict, the deviation must be *justified*, not assumed — see the design review.

## The shape
- **"An OS doesn't start with architecture. It starts with a default."** The first move is behavioral: default to working *inside* the OS (one harness — Claude Code) instead of scattering across browser tabs / separate tools. Adoption/habit precedes structure.
- **Two layers:** (1) the **second brain** = your knowledge (does it know your life/business/clients?), (2) the **AI OS** = infrastructure built *on top* of the second brain. **Without a second brain you can't have an AI OS.**
- **Tool-agnostic substrate:** "at the end of the day it's just folders and files." `CLAUDE.md` + `AGENTS.md` + codex configs coexist; you're building *your own* personal OS (IP: folders, markdown, skills, routing logic, logs, wikis), not a "Claude Code AIOS." Any harness/model plugs in.

## The Four C's (in order)
1. **Context** — *who you are, your business.* This is the **routing tree**: `CLAUDE.md` as **router**. It holds identity/goal + *points* to where things live: rules, references, skills, other projects, wikis. Plus the knowledge base path: **wiki path · hot cache · master index** + how to look through it. Pulse check: is it intuitive enough that *both you and the agent* can drill to what's needed without wasting tokens / searching forever.
2. **Connections** — *live data* vs static. Static = transcripts, background, past progress. Live = revenue (Stripe/QuickBooks), customers, calendar, comms (Gmail/Slack/ClickUp), tasks, PM, meetings. Brought in via **APIs / CLIs** (preferred over MCP — more control, cheaper). **Scoped API keys** (read-only where possible). Gut check: ask it about your business — does it answer like a *stranger* or a *co-founder*?
3. **Capabilities** — *skills, agents, automations, pipelines.* A skill can be "just a prompt." **Every use is data: give feedback → "update the skill" → it gets better. There is no finished product.** Assembly-line mindset: one AI does one thing well; chain outputs across phases (`/clear` between), delegate parallel work to cheaper models (Sonnet/Haiku) and get one clean summary back. Skills bring subject-matter expertise into any session instantly.
4. **Cadence** — *automations that run on their own* (while you sleep). Triggers: **manual / event / schedule.** Deploy as Claude Code routines, loops, deterministic scripts (modal/TS), or generated n8n. **You must EARN cadence** — prove skills are battle-tested first; as autonomy rises, **cost ↑, risk ↑, maintenance ↑**; automation still needs an owner + visibility.

## Cross-cutting principles (the load-bearing ones for Delivery OS)
- **Permission = keys, not prompts.** "A prompt is never a permission layer." Assume **"if it can, it will."** (The 150–200k-recipient mis-sent discount email: the agent *could* send, so it did.) The real control is **scoped keys** — if the agent doesn't hold the key to the room, it cannot act. → Mechanical capability-gating, not instruction.
- **Mistakes → durable fixes.** When it errs: "**update your CLAUDE.md so this never happens again**" / "update the skill." Write the incident up as a **case study** for the team. Every slip is data that compounds the system. → This is "operationalize, don't just document."
- **Verify its own work.** Use a **dynamic workflow to verify** — visually, via a Playwright browser, **as different personas** (beginner / software engineer / business owner). Gets output from ~70% → ~92%. Sub-agents debate / give independent perspectives; thought-partner + devil's-advocate; the **grill-me** skill interviews you to extract knowledge.
- **"Other worlds"** — sibling Claude Code projects **mounted into the main OS** (moved in, not opened separately). Reasons: one GitHub push syncs everything; the main OS gains context into all projects; the agent can `cd` around to reach what it needs. Big projects (YouTube OS, book, website, dashboards) all reachable from one entrypoint.
- **The three M's + the four C's** are the teaching frame; a clone-able GitHub repo audits you and scaffolds the folder architecture (the four C's) from the start.

## How this maps onto / challenges Delivery OS (for the design review)
| Reference (Four C's) | Delivery OS today | Tension to resolve |
|---|---|---|
| CLAUDE.md = router/kernel, knowledge-first | CLAUDE.md exists but is decorative; governance-spine-first | kernel must become load-bearing; knowledge-first ordering |
| Knowledge (second brain) is the foundation | wiki empty in 100% of projects | populate the knowledge layer; it's the base, not an afterthought |
| Connections = live data via scoped keys/CLIs | not modeled at all in Delivery OS | NEW layer Delivery OS lacks |
| Skills iterated every use; "update the skill" | skills static, 6/7 advisory, human-gated improvement | continuous skill-improvement loop + real invocation |
| Cadence = earned autonomy, manual/event/schedule | irreversible-action human gate; no cadence model | reconcile "earn cadence" with fail-closed gates |
| Permission = keys not prompts | §6 irreversible-action gate (human-approval) | generalize to mechanical key-scoping = a kernel mechanism |
| Verify own work (self + personas) → 70→92% | §3 author≠verifier + §11 + §12 (independent, mandatory) | **delivery domain justifies STRONGER-than-self verification** for consequential slices |
| "Other worlds" mounted for sync + reach | each project a separate repo; consumers copy-fork the framework | the consume-don't-reimplement + mount model |
| Tool-agnostic folders+files | Claude-Code-specific (.claude/, hooks) | keep portability where cheap |
