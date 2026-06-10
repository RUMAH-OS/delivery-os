# Founder Discovery Interview

> Claude conducts this with the founder before any planning. The output feeds `PROJECT-BRIEF.md` (Part 1), `PROJECT-MISSION.md` (Part 2), `NORTH-STAR.md` (Part 3), and the ecosystem alignment review (Part 4).

## How to run it (Claude's conduct rules)
- **Ask, don't assume.** Pose the questions; let the founder answer. Never pre-fill a vision.
- **One part at a time.** After each part, **reflect back** a 3–5 line summary in your own words and ask "did I get that right?" — correct before moving on.
- **Batch sensibly.** Ask 2–4 related questions at once (use a multiple-choice prompt for closed questions like segment or timeline; keep vision/problem open-ended). Don't interrogate one line at a time.
- **Capture verbatim** the elevator line (Q1), the purpose (Q8), and the north star (Q13) — the founder's exact words matter.
- **Mark unknowns `TBD — to confirm`.** If the founder says "I'm not sure," that's a captured finding, not a gap to invent over.
- **Separate confirmed from assumed.** If you infer something, label it and ask the founder to confirm.
- **Depth over breadth.** ~20–40 min. Push hardest on the *problem* (Q3) and *success* (Q5) — vague answers there sink projects.
- **Probe weak answers.** A weak answer to "who is it for?" is "businesses"; a strong one is "site-operations managers at EPC contractors mobilising crews near Eemshaven." Ask the follow-up.

---

## Part 1 — Vision & Problem → `PROJECT-BRIEF.md`
1. **What are you building?** In one or two plain sentences (the elevator line). *(capture verbatim)*
2. **Who is it for?** The primary user/segment — be specific (role, context, situation). Any secondary audience? *(weak: "companies"; strong: a named role in a named situation)*
3. **What problem does it solve?** What does this person/segment do **today instead** (the status quo, the workaround, the pain)? Why is today's way bad?
4. **Why does it matter?** To them, and to you/the business. What concretely **changes** if this exists and works?
5. **What does success look like (6–12 months)?** How will you **know** it worked — the measurable outcome (leads, revenue, signed contracts, retention, time saved…)? *(push for a number or an observable event, not "people like it")*
6. **What constraints are fixed?** Budget · timeline · team size · tech you must use/avoid · legal/compliance · existing systems you must respect or integrate with.
7. **What are the biggest risks & unknowns?** What could make this fail? What are you genuinely unsure about? *(these become the de-risk targets)*

→ *Reflect back. Then draft `PROJECT-BRIEF.md`.*

## Part 2 — Mission & Boundaries → `PROJECT-MISSION.md`
8. **What is this project's purpose** — its single job in the world, in one sentence? *(capture verbatim; this is the mission line)*
9. **Core responsibilities** — the 3–5 things it **must do well** to fulfill that purpose.
10. **Non-goals** — things people might expect it to do but it **explicitly will NOT** (now). *(the most under-asked, most valuable question — it prevents scope creep)*
11. **Boundaries** — what does it **own** vs. **depend on / consume** from elsewhere? (Especially if other systems exist — name them.)
12. **Definition of success for THIS project** (as distinct from the whole business) — restate crisply.

→ *Reflect back. Then draft `PROJECT-MISSION.md`.*

## Part 3 — North Star → `NORTH-STAR.md`
13. **Where could this go in 3–5 years** if it works — the ambitious destination? *(capture verbatim)*
14. **Stand-alone or part of a platform?** If platform: what **role** does it play, and what does it connect to / depend on?
15. **What would make this a durable advantage** (a moat), not just a feature someone copies?
16. **What must stay true** no matter how it evolves — the invariant, the soul of it? *(this becomes a guardrail for every future decision)*

→ *Reflect back. Then draft `NORTH-STAR.md`.*

## Part 4 — Ecosystem Alignment (Step 6) → alignment note
*(Only if other projects/an Ecosystem Architecture layer exist.)*
17. **Which business entities does this project OWN** (it's the writer-of-record), and which does it **CONSUME** from another system? *(cross-check the Ecosystem source-of-truth registry — no entity may have two owners)*
18. **What does it depend on**, and what depends on it? (direction + nature)
19. **Any conflict** with an existing source-of-truth or an accepted ECR? *(if yes → it's a cross-project decision; raise an ECR, don't quietly diverge)*
20. **Does the discovery change the provisional pack choice** from `PROJECT-SELECTION.md`? (e.g. the mission revealed it also bills money → add `invoicing`.)

→ *Record the alignment note; register/update the project in the Ecosystem layer (`GETTING-STARTED.md §4`).*

---

## After the interview
Generate the three documents from the captured answers (Steps 3–5), get founder approval on each, complete the alignment review (Step 6), tick `PROJECT-DISCOVERY-CHECKLIST.md`, and **only then** move to roadmap/ADRs/architecture. Anything you couldn't get a real answer for ships as `TBD — to confirm`, listed explicitly so it's revisited — never invented.
