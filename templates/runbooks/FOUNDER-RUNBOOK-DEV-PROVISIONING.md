# Founder Runbook — Provisioning the DEV environment (zero technical knowledge)

> This is the **one-time** founder work that code cannot do for you: creating the DEV (testing)
> environment so every future change is **reviewed by you, running live, in DEV — never touching real
> data and never near production** until you say so. After this, nothing here is ever your job again:
> every change auto-builds a DEV preview, posts you a review package, and only ships to production after
> **you** apply the `founder-approved` label.
>
> **Worked example:** the `property-lead-os` repo (GitHub org `RUMAH-OS`, Vercel team "Ruma Housing").
> Wherever you see `property-lead-os`, use **your** repo's name if different. Do **one part at a time, in
> order.** Each part is a single website — never jump between Vercel, Supabase, and GitHub inside one step.

---

## What you are building (in plain language)

A complete, **separate** copy of your app's plumbing used only for testing:

- a **DEV Vercel project** — where each change deploys a private preview you can click through;
- a **DEV Supabase project** — a throwaway database, so DEV testing **never touches a real customer row**;
- a few **DEV secrets** in GitHub — the passwords that let the robot build the DEV preview;
- a protected **`dev` branch** — the staging line all changes flow through before production;
- one safety pin — **Node 22.x** — so a known foot-gun fails in DEV, never in production.

You will need three browser logins you already have: **Vercel**, **Supabase**, **GitHub**.

> **Time:** about 25 minutes, once. **Cost:** $0 — everything below runs on the free plans.

---

## PART A — Create the DEV Vercel project (Vercel only)

**Why:** this is the home for your DEV previews. It must be a **separate** project from your live one so a
DEV deploy can never overwrite production.

1. Go to **https://vercel.com** and sign in.
2. Make sure the team selector (top-left) says **Ruma Housing** (your production team). If it shows your
   personal name, click it and choose **Ruma Housing**.
3. Click the **"Add New…"** button (top-right) → choose **"Project"**.
4. On **"Import Git Repository"**, find the row for **`property-lead-os`** and click **"Import"**.
5. On the configure screen, find the **"Project Name"** field. Delete what's there and type exactly:
   `property-lead-os-dev`  *(your repo name with `-dev` on the end — this is how you'll always tell them apart).*
6. **Do NOT click Deploy yet.** First find **"Root Directory"**, click **"Edit"**, and set it to `apps/web`
   *(this is where the app lives; the same folder production uses).* Click **"Continue"** / **"Save"**.
7. Now click the big **"Deploy"** button. It will try once and may show errors about a missing database —
   **that is expected and fine** (we add the database in Part C). Wait for it to stop (1–3 min).

   **What success looks like:** you are taken to the project's dashboard and the top of the page reads
   **`property-lead-os-dev`**. A failed first build is OK — we only needed the project to exist.

8. **Pin the Node version (the safety pin — do not skip).** **Why:** a real incident shipped because a
   project was set to Node 24, which Vercel rejects; pinning DEV to 22 makes that fail here, never in prod.
   - Top tabs → **Settings** → left menu → **General**.
   - Scroll to **"Node.js Version"**. Click the dropdown and choose **`22.x`**. Click **"Save"**.

   **What success looks like:** the Node.js Version box shows **`22.x`**.

> ✅ **CHECKPOINT A:** In your Vercel "Ruma Housing" team you now see **two** projects —
> `property-lead-os` (production) and `property-lead-os-dev` (DEV) — and the DEV one shows **Node 22.x**.
> If you only see one project, repeat Part A. **Do not continue until both projects exist.**

---

## PART B — Create the DEV Supabase project and copy its database address (Supabase only)

**Why:** DEV needs its **own** database so your testing creates fake rows in a sandbox, never in the real
customer database. You will copy one long address (`DATABASE_URL`) that points the DEV app at this sandbox.

1. Open a new tab and go to **https://supabase.com/dashboard** and sign in.
2. Click the green **"New project"** button.
3. **"Organization":** pick your existing organisation (the same one your live project is in).
4. **"Name":** type exactly `property-lead-os-dev`.
5. **"Database Password":** click **"Generate a password"**, then click **"Copy"** and paste it somewhere
   safe for a moment (a sticky note / notes app). You'll need it in step 8 below.
6. **"Region":** choose the **same region as your live project** (e.g. *West EU (London)*). **"Plan":** Free.
7. Click **"Create new project"** and wait — provisioning takes **2–3 minutes** (you'll see a progress
   screen). Wait for the dashboard to finish loading.

   **What success looks like:** you land on the project home with **`property-lead-os-dev`** shown at the top.

8. **Copy the database address (the one value DEV needs):**
   - In the left sidebar click the **gear / "Project Settings"** (bottom-left).
   - Click **"Database"** in the settings menu.
   - Find the **"Connection string"** section and click the **"URI"** tab.
   - You'll see a line beginning `postgresql://postgres:[YOUR-PASSWORD]@...`. Click **"Copy"**.
   - Paste it into your sticky note. **Now replace the `[YOUR-PASSWORD]` part** (including the square
     brackets) with the password you copied in step 5. The finished line looks like
     `postgresql://postgres:abc123XYZ@db.xxxxx.supabase.co:5432/postgres`.

   **What this is:** this single line is your **`DATABASE_URL`** — the DEV app's address book entry for its
   sandbox database. Keep it on the sticky note; you'll paste it in Part C and Part F.

> ✅ **CHECKPOINT B:** You have a **second** Supabase project named `property-lead-os-dev`, and on your
> sticky note you have one long line starting `postgresql://postgres:` with the **real password filled in**
> (no `[YOUR-PASSWORD]` left). Do not continue until that line is complete.

---

## PART C — Give the DEV app its database address (Vercel only)

**Why:** the DEV preview app reads its database address from its Vercel project's settings. We paste the
`DATABASE_URL` from Part B into the **DEV** Vercel project so previews talk to the **sandbox** database.

1. Go back to **https://vercel.com** → click the **`property-lead-os-dev`** project tile (the DEV one).
2. Top tabs → **Settings** → left menu → **"Environment Variables"**.
3. In the **"Key"** box type exactly: `DATABASE_URL`
4. In the **"Value"** box, paste the finished line from your Checkpoint B sticky note
   (`postgresql://postgres:...`).
5. Under **"Environments"**, tick **"Preview"** *(and "Development" if shown)*. **Leave "Production"
   UNticked** — DEV must never write to anything but its sandbox.
6. Click **"Save"**.

   **What success looks like:** a new row **`DATABASE_URL`** appears in the list with **"Preview"** shown as
   its environment.

> ✅ **CHECKPOINT C:** The `property-lead-os-dev` Vercel project's Environment Variables list shows a
> `DATABASE_URL` row scoped to **Preview** (not Production). If it says Production, click it, **Edit**, untick
> Production, tick Preview, Save.

---

## PART D — Copy the DEV project's ID (Vercel only)

**Why:** the robot that builds DEV previews needs to know *which* Vercel project to use. That is a short ID
you copy now and paste into GitHub in Part E.

1. Still in **https://vercel.com** → **`property-lead-os-dev`** project → **Settings** → **General**.
2. Scroll to the very bottom to the **"Project ID"** box. Click **"Copy"** next to it.
3. Paste it on your sticky note and label it **"DEV PROJECT ID"**. It looks like
   `prj_AbC123dEf456...`.

> ✅ **CHECKPOINT D:** Your sticky note now has a value starting `prj_` labelled **DEV PROJECT ID**.

---

## PART E — Tell GitHub the DEV project ID (GitHub only)

**Why:** GitHub runs the robot that builds DEV previews. It needs the DEV project ID as a **secret** (a
stored password) so the robot can target the DEV Vercel project.

1. Open a new tab and go to **https://github.com/RUMAH-OS/property-lead-os**.
2. Top menu of the repo → **"Settings"** *(if you don't see Settings, you don't have admin on the repo —
   stop and ask whoever set up the repo to give you admin, or to do Parts E–G with you)*.
3. Left sidebar → expand **"Secrets and variables"** → click **"Actions"**.
4. Click the green **"New repository secret"** button.
5. **"Name":** type exactly `VERCEL_PROJECT_ID_DEV`
6. **"Secret":** paste the **DEV PROJECT ID** from your Checkpoint D sticky note (starts `prj_`).
7. Click **"Add secret"**.

   **What success looks like:** the Actions secrets list now shows a row **`VERCEL_PROJECT_ID_DEV`**
   with **"Updated now"**.

> ✅ **CHECKPOINT E — and a one-time check of the two shared secrets:** While on this same
> **Actions secrets** page, confirm **`VERCEL_TOKEN`** and **`VERCEL_ORG_ID`** are already listed (they were
> set when production deploy was provisioned). **If either is missing**, add it the same way:
> `VERCEL_TOKEN` = a token from **https://vercel.com/account/tokens**; `VERCEL_ORG_ID` = your Ruma Housing
> team ID (Vercel → team **Settings → General → "Team ID"**). Do not continue until you can see
> **`VERCEL_PROJECT_ID_DEV`**, **`VERCEL_TOKEN`**, and **`VERCEL_ORG_ID`** all listed.

---

## PART F — Tell GitHub the DEV database address (GitHub only)

**Why:** some checks run the DEV database address inside GitHub itself. We store the same `DATABASE_URL`
from Part B as a GitHub secret so those checks can reach the sandbox database.

1. Still on **https://github.com/RUMAH-OS/property-lead-os** → **Settings** → **Secrets and variables** →
   **Actions**.
2. Click **"New repository secret"** again.
3. **"Name":** type exactly `DEV_DATABASE_URL`
4. **"Secret":** paste the **same** finished `postgresql://postgres:...` line from your Checkpoint B sticky
   note (the one with the real password in it).
5. Click **"Add secret"**.

   **What success looks like:** the secrets list now shows a row **`DEV_DATABASE_URL`** with "Updated now".

> ✅ **CHECKPOINT F:** Your Actions secrets list shows **four** DEV-related rows total:
> `VERCEL_PROJECT_ID_DEV`, `DEV_DATABASE_URL`, plus the shared `VERCEL_TOKEN` and `VERCEL_ORG_ID`.
> **Now you may throw away the sticky note** (shred it / delete the note — those values are passwords).

---

## PART G — Create and protect the `dev` branch (GitHub only)

**Why:** `dev` is the single staging line every change flows through before production. Protecting it means
nothing reaches production without (1) passing automated checks and (2) **your** `founder-approved` label —
this is your gate.

### G-1 — Create the `dev` branch
1. Go to **https://github.com/RUMAH-OS/property-lead-os** (the repo's **Code** tab).
2. Click the **branch dropdown** (top-left of the file list; it currently says **`main`**).
3. In the **"Find or create a branch…"** box, type exactly `dev`.
4. Click the line that appears: **"Create branch: dev from main"**.

   **What success looks like:** the branch dropdown now shows **`dev`**, and you have two branches.

### G-2 — Require checks + your label before anything merges to `main`
**Why:** this is the rule that makes the `founder-approved` label *mean* something — without it the label is
decorative.
1. Repo → **"Settings"** → left sidebar → **"Branches"**.
2. Under **"Branch protection rules"**, click **"Add branch ruleset"** (or **"Add rule"** on older screens).
3. **"Branch name pattern":** type exactly `main`.
4. Tick **"Require a pull request before merging"**.
5. Tick **"Require status checks to pass before merging"**. In the search box that appears, type and select
   your CI check (e.g. **`CI`**) so it's listed as required.
6. Tick **"Require review from Code Owners"** *(this is what forces the `founder-approved` label to come
   from a CODEOWNER — see the note below)*.
7. Click **"Create"** / **"Save changes"**.

   **What success looks like:** the Branches page lists a rule for **`main`** showing "Require a pull
   request" and "Require status checks".

### G-3 — Make yourself the CODEOWNER (so your label is the gate)
**Why:** the promote-to-prod robot only acts on `founder-approved` **when a CODEOWNER applied it**. You must
be listed as a CODEOWNER for your approval to count.
1. Repo **Code** tab → branch dropdown → make sure you're on **`main`**.
2. Click **"Add file"** → **"Create new file"**.
3. In the **filename** box type exactly: `.github/CODEOWNERS`
4. In the file body, type one line — replace `your-github-username` with **your** GitHub username:
   `*  @your-github-username`
5. Click **"Commit changes…"** → keep **"Commit directly to the main branch"** → **"Commit changes"**.

   **What success looks like:** the file `.github/CODEOWNERS` exists on `main` with your `@username` in it.

> ✅ **CHECKPOINT G:** You have a **`dev`** branch; a protection rule on **`main`** requiring checks + a PR;
> and a **`.github/CODEOWNERS`** naming you. From now on, applying the **`founder-approved`** label to a
> `dev → main` pull request is your single "ship it" action.

---

## You're done — what happens now (you never repeat the above)

From here, for **every** change, with **no founder setup work**:

1. The robot opens a pull request into **`dev`** and builds a **DEV preview** (`dev-preview.yml`).
2. It posts you a **Founder Review Package** as a comment — plain language, a live DEV link, and the exact
   clicks to try it yourself. You review it **running**, never as code.
3. When you're happy, you open the `dev → main` pull request and apply the **`founder-approved`** label.
4. The robot re-checks the floor (your label as CODEOWNER · DEV checks green · the change independently
   verified), merges to **`main`**, and production deploys automatically (`promote-to-prod.yml` → the
   existing `deploy.yml`). It then smoke-tests, writes release notes, and cleans up the branch.

**The only thing that is ever yours again is the label** — your "ship it" decision. Everything else is
automated. If a check is red or the change isn't verified, the robot **stops and tells you why** — it will
never ship on its own.

---

## Quick reference — the 4 DEV values you set (keep this; delete the rest)

| Where | Name | What it is |
|---|---|---|
| GitHub secret | `VERCEL_PROJECT_ID_DEV` | the DEV Vercel project's ID (`prj_…`) |
| GitHub secret | `DEV_DATABASE_URL` | the DEV Supabase sandbox address (`postgresql://…`) |
| Vercel (DEV project, Preview env) | `DATABASE_URL` | same sandbox address, so the preview app can read it |
| Vercel (DEV project, General) | Node.js Version | pinned to **`22.x`** (the safety pin) |

*(Shared with production, set once during prod provisioning: `VERCEL_TOKEN`, `VERCEL_ORG_ID`.)*
