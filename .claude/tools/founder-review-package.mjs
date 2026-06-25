#!/usr/bin/env node
// =============================================================================
// Delivery OS — Founder Review Package generator (zero-dep, Node ESM).
// Turns a slice's PR into a founder-readable review package:
//   (a) a durable markdown artifact  docs/review/REVIEW-<pr>-<slice>.md
//   (b) a condensed PR comment       (gh pr comment — DEFAULT prints it, only
//                                     POSTS with an explicit --post; effectful,
//                                     fail-closed)
// =============================================================================
// "The founder should be able to review a slice in DEV without reading a diff —
//  in plain language, with the exact clicks to try it themselves. But the package
//  must NEVER invent what it cannot know: the test steps are engineer-SEEDED
//  product knowledge (read from a stub, URL-interpolated — never diff-invented),
//  the screenshots are real-or-explicit-N/A (never fabricated), and posting the
//  PR comment is an effectful step that happens ONLY behind --post (fail-closed)."
//
// Every section is pulled from a CITED source (never narrated):
//   Header              gh pr view --json title,number,author,headRefName,url
//   What this does      PR title + git log <base>..<head> --format=%s
//   Why                 PR body `## Why`            (honest "Not stated" if absent)
//   What changed        git diff --numstat <base>...<head> (files/+ins/-del + areas)
//   Architecture        docs/adr/* touched in the diff + PR body `## Decisions`
//   Risks               PR body `## Risks` + VERIFY-<slice>.md residual-risk line
//   Screenshots         UI paths changed -> routes to capture; ELSE "N/A — backend"
//   Links               DEV url (--dev-url|gh deployment) · PR url · CI run · VERIFY path
//   How to test it      docs/review/review-steps-<slice>.md (engineer-seeded),
//                       {DEV_URL}-interpolated. ABSENT -> fail-closed "unavailable"
//                       (NEVER a hallucinated guide).
//
//   import { buildPackage, parseBodySection, deriveRoutes, planEffects } from "./founder-review-package.mjs"
//   node founder-review-package.mjs <pr> [--repo O/R] [--base REF] [--head REF]
//        [--slice NAME] [--dev-url URL] [--post] [--json] [--dry-run] [--self-test]
//
// DEFAULT (no flags) = write the artifact + PRINT the condensed comment (does NOT post).
//   --post     also posts the comment (effectful; refused under --dry-run; fail-closed).
//   --dry-run  read-only: writes NOTHING, posts NOTHING — just renders the package.
// Robust to `gh` not installed / not authenticated (fail-closed, clear message, non-zero).
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// --- UI surface discriminators (a changed path counts as UI iff one hits) ----
export const UI_PATTERNS = [/^apps\/web\//, /\.tsx$/, /^admin-ui\//];
export const isUiPath = (p) => UI_PATTERNS.some((re) => re.test(String(p)));

// =============================================================================
// PURE PARSERS / DERIVERS — no IO. These are what --self-test pins.
// =============================================================================

// Extract the body text under a `## <name>` markdown heading, up to the next
// heading. Returns null when the section is absent or empty (fail-closed honesty).
export function parseBodySection(body, name) {
  if (!body) return null;
  const lines = String(body).split(/\r?\n/);
  const wanted = String(name).toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{1,6}\s+(.*?)\s*$/);
    if (m && m[1].toLowerCase().startsWith(wanted)) { start = i + 1; break; }
  }
  if (start < 0) return null;
  const out = [];
  for (let i = start; i < lines.length; i++) {
    if (/^#{1,6}\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  const text = out.join("\n").trim();
  return text.length ? text : null;
}

// Pull the residual-risk line out of a VERIFY artifact's text. null if none.
export function extractResidualRisk(text) {
  if (!text) return null;
  for (const line of String(text).split(/\r?\n/)) {
    if (/residual.{0,3}risk/i.test(line)) {
      const cleaned = line.replace(/^[>\-*\s|#]+/, "").trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

// Group changed paths by top-level directory -> { dir: count }.
export function groupAreas(paths) {
  const areas = {};
  for (const p of paths) {
    const top = String(p).split("/")[0] || "(root)";
    areas[top] = (areas[top] || 0) + 1;
  }
  return areas;
}

// Map changed UI files to the routes/surfaces a founder should screenshot.
// Next.js app-router page/layout/route -> a route; pages-router -> a route;
// any other UI file (a component, a stray .tsx) -> the file path itself as a
// surface to capture. Deduped + sorted. (Placeholders only — never images.)
export function deriveRoutes(uiPaths) {
  const routes = new Set();
  for (const p of uiPaths) {
    let m = p.match(/^(?:apps\/web|admin-ui)\/(?:src\/)?app\/(.*?)\/?(?:page|layout|route)\.[tj]sx?$/);
    if (m) {
      const seg = m[1].split("/").filter((s) => s && !/^\(.*\)$/.test(s)).join("/");
      routes.add("/" + seg);
      continue;
    }
    m = p.match(/^(?:apps\/web|admin-ui)\/(?:src\/)?pages\/(.*?)\.[tj]sx?$/);
    if (m) {
      routes.add("/" + m[1].replace(/\/index$/, "").replace(/^index$/, ""));
      continue;
    }
    routes.add(p); // not a routable page — list the file as a surface to capture
  }
  return [...routes].sort();
}

// Derive a slice id from the PR head branch (the segment after the last `/`).
export function deriveSlice(headRef) {
  const s = String(headRef || "").split("/").pop() || "";
  return s || "unknown-slice";
}

// =============================================================================
// SECTION BUILDERS — each takes the gathered `data` and returns a markdown body.
// =============================================================================
function sHeader(d) {
  return [
    `# Founder Review Package — ${d.slice} (PR #${d.pr.number})`,
    "",
    "| | |",
    "|---|---|",
    `| **Slice** | \`${d.slice}\` |`,
    `| **PR** | [#${d.pr.number}](${d.pr.url}) |`,
    `| **Author** | ${d.pr.author} |`,
    `| **Branch** | \`${d.pr.headRefName}\` |`,
    `| **Status** | **In DEV — awaiting your review** |`,
  ].join("\n");
}

function sWhatThisDoes(d) {
  const subjects = d.commitSubjects || [];
  const lines = [`**${d.pr.title}**`, ""];
  if (subjects.length) {
    lines.push("In plain language, this change:");
    for (const s of subjects) lines.push(`- ${s}`);
  } else {
    lines.push("_No commit subjects found between the base and the PR head._");
  }
  return lines.join("\n");
}

function sWhy(d) {
  const why = parseBodySection(d.pr.body, "Why");
  return why || "**Not stated** — the PR body has no `## Why` section.";
}

function sWhatChanged(d) {
  const { files, insertions, deletions, areas } = d.diffStat;
  const lines = [`\`${files} file(s) changed · +${insertions} / -${deletions}\``, "", "Areas touched:"];
  const dirs = Object.keys(areas).sort();
  if (dirs.length) for (const dir of dirs) lines.push(`- \`${dir}/\` — ${areas[dir]} file(s)`);
  else lines.push("- _(no files changed between base and head)_");
  return lines.join("\n");
}

function sArchitecture(d) {
  const decisions = parseBodySection(d.pr.body, "Decisions");
  const adrs = d.adrTouched || [];
  if (!adrs.length && !decisions) {
    return "**None** — no `docs/adr/*` touched in the diff and no `## Decisions` section in the PR body.";
  }
  const lines = [];
  if (adrs.length) {
    lines.push("ADR(s) touched in this diff:");
    for (const a of adrs) lines.push(`- \`${a}\``);
  }
  if (decisions) {
    if (lines.length) lines.push("");
    lines.push("From the PR body `## Decisions`:", "", decisions);
  }
  return lines.join("\n");
}

function sRisks(d) {
  const risks = parseBodySection(d.pr.body, "Risks");
  const residual = d.verifyResidualRisk;
  if (!risks && !residual) {
    return "**None flagged** — no `## Risks` section in the PR body and no residual-risk line in the VERIFY artifact.";
  }
  const lines = [];
  if (risks) lines.push("From the PR body `## Risks`:", "", risks);
  if (residual) {
    if (lines.length) lines.push("");
    lines.push(`From \`${d.verifyPath}\` (residual risk): ${residual}`);
  }
  return lines.join("\n");
}

function sScreenshots(d) {
  const uiPaths = (d.diffStat.changedPaths || []).filter(isUiPath);
  if (!uiPaths.length) return "N/A — backend slice (no UI surface changed)";
  const routes = deriveRoutes(uiPaths);
  const lines = [
    "This slice changes UI. Capture a screenshot of each surface below.",
    "_(Placeholders to capture by hand — no images are auto-generated or fabricated.)_",
    "",
  ];
  for (const r of routes) lines.push(`- [ ] \`${r}\``);
  return lines.join("\n");
}

function sLinks(d) {
  return [
    `- **DEV deployment:** ${d.devUrl || "_DEV not provisioned_"}`,
    `- **Pull request:** ${d.pr.url}`,
    `- **CI run:** ${d.ciRunUrl || "_no CI run found_"}`,
    `- **VERIFY artifact:** ${d.verifyPath && d.verifyExists ? `\`${d.verifyPath}\`` : `_none — no ${d.verifyPathRel} on disk_`}`,
  ].join("\n");
}

function sTestingGuide(d) {
  // CRITICAL: engineer-SEEDED, never diff-invented. The exact clicks are product
  // knowledge a diff cannot supply. Absent stub -> fail-closed, never hallucinated.
  if (d.reviewStepsRaw == null) {
    return [
      `**Testing guide unavailable — author \`docs/review/review-steps-${d.slice}.md\`.**`,
      "",
      "_(Fail-closed: the step-by-step is engineer-seeded product knowledge — the exact",
      "clicks a founder makes are NOT invented from the diff. Seed the stub with numbered",
      "steps using `{DEV_URL}` placeholders and regenerate.)_",
    ].join("\n");
  }
  const interpolated = String(d.reviewStepsRaw).replace(/\{DEV_URL\}/g, d.devUrl || "{DEV_URL}");
  const note = d.devUrl
    ? ""
    : "> Note: DEV not provisioned — `{DEV_URL}` placeholders are left intact; ask the engineer for the live URL.\n\n";
  return note + interpolated.trim();
}

// =============================================================================
// PACKAGE ASSEMBLY — the durable artifact + the condensed comment.
// =============================================================================
export function buildPackage(d) {
  const section = (title, body) => `## ${title}\n\n${body}\n`;
  const markdown = [
    sHeader(d),
    "",
    section("What this does", sWhatThisDoes(d)),
    section("Why", sWhy(d)),
    section("What changed", sWhatChanged(d)),
    section("Architecture decisions", sArchitecture(d)),
    section("Risks", sRisks(d)),
    section("Screenshots", sScreenshots(d)),
    section("Links", sLinks(d)),
    section("How to test it yourself (zero technical knowledge)", sTestingGuide(d)),
    "---",
    `_Generated by founder-review-package.mjs from PR #${d.pr.number} — regenerate, do not hand-edit._`,
    "",
  ].join("\n");

  const { files, insertions, deletions, areas } = d.diffStat;
  const topAreas = Object.keys(areas).sort().slice(0, 4).join(", ") || "—";
  const risks = parseBodySection(d.pr.body, "Risks") || d.verifyResidualRisk;
  const uiPaths = (d.diffStat.changedPaths || []).filter(isUiPath);
  const shot = uiPaths.length
    ? `${deriveRoutes(uiPaths).length} UI surface(s) to capture`
    : "N/A — backend slice";
  const comment = [
    `## Founder Review Package — ${d.slice}`,
    "**Status: In DEV — awaiting your review**",
    "",
    `**What this does:** ${d.pr.title}`,
    `**What changed:** ${files} file(s) · +${insertions}/-${deletions} · areas: ${topAreas}`,
    `**Risks:** ${risks ? risks.split(/\r?\n/)[0] : "none flagged"}`,
    `**Screenshots:** ${shot}`,
    "",
    `Full package (incl. the step-by-step "how to test it yourself"): \`${d.artifactPath}\``,
  ].join("\n");

  return { markdown, comment };
}

// =============================================================================
// EFFECT PLAN — the one effectful surface, gated + fail-closed. PURE so the
// self-test can pin the gating without any IO.
//   default  -> write artifact, do NOT post
//   --dry-run-> read-only: write nothing, post nothing
//   --post   -> write artifact AND post the comment
//   --post + --dry-run -> error (refuse: read-only cannot post)
// =============================================================================
export function planEffects(opts) {
  if (opts.post && opts.dryRun) {
    return { error: "refusing to --post under --dry-run (read-only) — drop --dry-run to post the comment." };
  }
  if (opts.dryRun) return { writeArtifact: false, postComment: false, error: null };
  return { writeArtifact: true, postComment: !!opts.post, error: null };
}

function runEffects(plan, { io, opts, artifactPath, markdown, comment, repoArgs }) {
  const done = { wrote: false, posted: false };
  if (plan.writeArtifact) {
    io.ensureDir(dirname(artifactPath));
    io.writeFile(artifactPath, markdown);
    done.wrote = true;
  }
  if (plan.postComment) {
    // The ONLY effectful gh call. Reached solely when planEffects allowed it.
    io.ghText(["pr", "comment", String(opts.pr), ...repoArgs, "--body", comment]);
    done.posted = true;
  }
  return done;
}

// =============================================================================
// gh / git / fs runtime (live path). All shelled via execFileSync (no shell).
// =============================================================================
function makeIO(cwd) {
  const ghRaw = (args) => execFileSync("gh", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] });
  return {
    cwd,
    ghAvailable() { try { execFileSync("gh", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } },
    ghAuthed() { try { execFileSync("gh", ["auth", "status"], { stdio: "ignore" }); return true; } catch { return false; } },
    ghJson(args) { return JSON.parse(ghRaw(args)); },
    ghText(args) { return ghRaw(args); },
    git(args) { return execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] }); },
    readIfExists(rel) { const p = join(cwd, rel); return existsSync(p) ? readFileSync(p, "utf8") : null; },
    exists(rel) { return existsSync(join(cwd, rel)); },
    ensureDir(rel) { mkdirSync(join(cwd, rel), { recursive: true }); },
    writeFile(rel, body) { writeFileSync(join(cwd, rel), body); },
  };
}

const repoArgsOf = (opts) => (opts.repo ? ["--repo", opts.repo] : []);

function gitLines(io, args) {
  try { return io.git(args).split(/\r?\n/).map((s) => s.trim()).filter(Boolean); }
  catch { return []; }
}

// Parse `git diff --numstat <base>...<head>` -> the same facts `--stat` reports,
// in a parseable shape: files / insertions / deletions / areas / changedPaths.
function parseNumstat(lines) {
  let insertions = 0, deletions = 0;
  const changedPaths = [];
  for (const ln of lines) {
    const m = ln.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    if (m[1] !== "-") insertions += Number(m[1]);
    if (m[2] !== "-") deletions += Number(m[2]);
    // handle rename syntax `a/{b => c}/d` -> take the post-rename path
    let p = m[3];
    const rn = p.match(/\{.*? => (.*?)\}/);
    if (rn) p = p.replace(/\{.*? => (.*?)\}/, rn[1]).replace(/\/\//g, "/");
    changedPaths.push(p);
  }
  return { files: changedPaths.length, insertions, deletions, changedPaths, areas: groupAreas(changedPaths) };
}

function resolveDevUrl(io, opts) {
  if (opts.devUrl) return opts.devUrl;
  if (!opts.nameWithOwner) return null;
  try {
    const deps = io.ghJson(["api", `repos/${opts.nameWithOwner}/deployments?per_page=1`]);
    if (!Array.isArray(deps) || !deps.length || !deps[0].statuses_url) return null;
    const path = String(deps[0].statuses_url).replace(/^https:\/\/api\.github\.com\//, "");
    const statuses = io.ghJson(["api", `${path}?per_page=1`]);
    if (Array.isArray(statuses) && statuses.length && statuses[0].environment_url) return statuses[0].environment_url;
    return null;
  } catch { return null; }
}

function resolveCiRunUrl(io, opts, headRef) {
  try {
    const runs = io.ghJson(["run", "list", "--branch", headRef, ...repoArgsOf(opts), "--limit", "1", "--json", "url"]);
    if (Array.isArray(runs) && runs.length && runs[0].url) return runs[0].url;
    return null;
  } catch { return null; }
}

// =============================================================================
// GATHER — pull every section's input from its cited source (live IO).
// =============================================================================
export function gather(io, opts) {
  const pv = io.ghJson(["pr", "view", String(opts.pr), ...repoArgsOf(opts),
    "--json", "title,number,author,headRefName,url,body,baseRefName,headRefOid"]);
  const author = (pv.author && (pv.author.login || pv.author.name)) || "unknown";
  const slice = opts.slice || deriveSlice(pv.headRefName);
  const base = opts.base || `origin/${pv.baseRefName || "main"}`;
  const head = opts.head || "HEAD";

  const commitSubjects = gitLines(io, ["log", `${base}..${head}`, "--format=%s"]);
  const diffStat = parseNumstat(gitLines(io, ["diff", "--numstat", `${base}...${head}`]));
  const adrTouched = diffStat.changedPaths.filter((p) => /^docs\/adr\//.test(p));

  const verifyPathRel = `docs/verify/VERIFY-${slice}.md`;
  const verifyText = io.readIfExists(verifyPathRel);
  const verifyResidualRisk = extractResidualRisk(verifyText);

  const reviewStepsRel = `docs/review/review-steps-${slice}.md`;
  const reviewStepsRaw = io.readIfExists(reviewStepsRel);

  const devUrl = resolveDevUrl(io, opts);
  const ciRunUrl = resolveCiRunUrl(io, opts, pv.headRefName);
  const artifactPath = `docs/review/REVIEW-${pv.number}-${slice}.md`;

  return {
    slice, base, head, artifactPath,
    pr: { number: pv.number, title: pv.title, author, headRefName: pv.headRefName, url: pv.url, body: pv.body },
    commitSubjects, diffStat, adrTouched,
    verifyPath: verifyPathRel, verifyPathRel, verifyExists: verifyText != null, verifyResidualRisk,
    reviewStepsRaw, devUrl, ciRunUrl,
  };
}

// =============================================================================
// GENERATE — live: preflight -> gather -> build -> (guarded) effects -> report.
// =============================================================================
export function generate(opts) {
  const io = opts.io || makeIO(opts.cwd || process.cwd());
  const report = { pr: opts.pr, repo: opts.repo || null, result: "pending", messages: [], wrote: false, posted: false };

  // fail-closed effect plan first (so --post+--dry-run is refused before any IO).
  const plan = planEffects(opts);
  if (plan.error) { report.result = "error"; report.messages.push(plan.error); return report; }

  // fail-closed preflight: gh present + authenticated, else refuse.
  if (!io.ghAvailable()) {
    report.result = "error";
    report.messages.push("gh CLI not found on PATH — cannot read the PR. Install GitHub CLI (https://cli.github.com) and re-run.");
    return report;
  }
  if (!io.ghAuthed()) {
    report.result = "error";
    report.messages.push("gh is not authenticated — run `gh auth login`. Fail-closed: refusing to read or post without an authenticated session.");
    return report;
  }

  let data;
  try {
    opts.nameWithOwner = opts.nameWithOwner || (() => { try { return io.ghJson(["repo", "view", ...repoArgsOf(opts), "--json", "nameWithOwner"]).nameWithOwner; } catch { return null; } })();
    data = gather(io, opts);
  } catch (e) {
    report.result = "error";
    report.messages.push(`failed to gather PR data: ${e.message}`);
    return report;
  }

  const { markdown, comment } = buildPackage(data);
  report.slice = data.slice;
  report.artifactPath = data.artifactPath;
  report.markdown = markdown;
  report.comment = comment;

  try {
    const done = runEffects(plan, { io, opts, artifactPath: data.artifactPath, markdown, comment, repoArgs: repoArgsOf(opts) });
    report.wrote = done.wrote;
    report.posted = done.posted;
  } catch (e) {
    report.result = "error";
    report.messages.push(`effect failed (${plan.postComment ? "posting comment" : "writing artifact"}): ${e.message}`);
    return report;
  }

  if (opts.dryRun) report.messages.push("--dry-run: read-only — wrote nothing, posted nothing.");
  else {
    report.messages.push(`wrote ${data.artifactPath}`);
    report.messages.push(report.posted ? "posted the condensed PR comment (--post)." : "comment PRINTED only — pass --post to post it to the PR (effectful).");
  }
  report.result = "ok";
  return report;
}

// =============================================================================
// REPORT RENDERING
// =============================================================================
function printReport(report, opts) {
  if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }
  if (report.markdown) {
    console.log(report.markdown);
    console.log("\n--- condensed PR comment " + (report.posted ? "(POSTED)" : "(NOT posted — print only)") + " ---\n");
    console.log(report.comment);
  }
  console.log(`\nfounder-review-package · PR ${report.pr}${report.repo ? ` (${report.repo})` : ""}`);
  for (const m of report.messages) console.log(`  · ${m}`);
  console.log(`result: ${report.result}`);
}

// =============================================================================
// SELF-TEST — pure, no live calls, no mutation. Asserts:
//  (1) UI-diff slice -> Screenshots lists routes (NOT the backend N/A)
//  (2) backend slice -> exactly "N/A — backend slice (no UI surface changed)"
//  (3) slice WITH a review-steps stub -> interpolated numbered guide (DEV url in)
//  (4) slice WITHOUT a stub -> fail-closed "unavailable" (NOT hallucinated steps)
//  (5) missing `## Why` -> "Not stated"  (and present `## Why` -> its text)
//  (6) --post is gated: planEffects(default)=no post; (dry-run)=no post+no write;
//      (post)=post; (post+dry-run)=error; and runEffects() calls `gh pr comment`
//      ONLY when the plan says postComment (spy proves 0 calls without --post).
// =============================================================================
function makeData(over = {}) {
  const base = {
    slice: "demo-slice",
    base: "origin/main", head: "HEAD",
    artifactPath: "docs/review/REVIEW-99-demo-slice.md",
    pr: { number: 99, title: "feat: demo slice", author: "eng", headRefName: "feat/demo-slice",
          url: "https://example/pr/99", body: "## Why\nBecause the founder asked.\n\n## Risks\nLow.\n" },
    commitSubjects: ["feat: do the thing", "test: cover the thing"],
    diffStat: { files: 1, insertions: 10, deletions: 2, changedPaths: ["src/lib/x.ts"], areas: { src: 1 } },
    adrTouched: [],
    verifyPath: "docs/verify/VERIFY-demo-slice.md", verifyPathRel: "docs/verify/VERIFY-demo-slice.md",
    verifyExists: false, verifyResidualRisk: null,
    reviewStepsRaw: null, devUrl: null, ciRunUrl: null,
  };
  const d = { ...base, ...over };
  d.diffStat = { ...base.diffStat, ...(over.diffStat || {}) };
  d.pr = { ...base.pr, ...(over.pr || {}) };
  return d;
}

function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // (1) UI-diff slice -> Screenshots lists routes
  const ui = buildPackage(makeData({
    diffStat: { files: 2, insertions: 20, deletions: 1,
      changedPaths: ["apps/web/app/room/page.tsx", "apps/web/components/Card.tsx"], areas: { "apps": 2 } },
  })).markdown;
  ok(/## Screenshots/.test(ui) && ui.includes("`/room`"), "UI slice: Screenshots must list the changed route /room");
  ok(!ui.includes("N/A — backend slice"), "UI slice: Screenshots must NOT be the backend N/A");

  // (2) backend slice -> exact N/A string
  const be = buildPackage(makeData({
    diffStat: { files: 1, insertions: 5, deletions: 0, changedPaths: ["templates/tools/y.mjs"], areas: { templates: 1 } },
  })).markdown;
  ok(be.includes("N/A — backend slice (no UI surface changed)"), "backend slice: Screenshots must be the exact backend N/A string");

  // (3) WITH a review-steps stub -> interpolated guide (DEV url in, placeholder out)
  const withStub = buildPackage(makeData({
    reviewStepsRaw: "1. Go to {DEV_URL}/room and sign in.\n2. **Success:** you see the Room. ✅",
    devUrl: "https://dev.example.app",
  })).markdown;
  ok(withStub.includes("https://dev.example.app/room"), "stub present: {DEV_URL} must be interpolated to the live DEV url");
  ok(!/\{DEV_URL\}/.test(withStub), "stub present: no raw {DEV_URL} placeholder may remain when a DEV url is known");
  ok(!withStub.includes("Testing guide unavailable"), "stub present: must NOT show the fail-closed unavailable message");

  // (4) WITHOUT a stub -> fail-closed unavailable (NOT hallucinated steps)
  const noStub = buildPackage(makeData({ reviewStepsRaw: null, devUrl: "https://dev.example.app" }));
  const guide = noStub.markdown.split("## How to test it yourself")[1] || "";
  ok(guide.includes("Testing guide unavailable — author `docs/review/review-steps-demo-slice.md`"),
     "no stub: must emit the exact fail-closed 'unavailable' message naming the stub path");
  ok(!/^\s*1\.\s+Go to/m.test(guide) && !guide.includes("https://dev.example.app"),
     "no stub: must NOT hallucinate numbered steps or interpolate a URL into invented steps");

  // (5) missing `## Why` -> "Not stated"; present `## Why` -> its text
  const noWhy = buildPackage(makeData({ pr: { body: "## Risks\nnone\n" } })).markdown;
  ok(/## Why\s*\n\s*\n\*\*Not stated\*\*/.test(noWhy), "missing Why: must render '**Not stated**'");
  ok(parseBodySection("## Why\nBecause.\n", "Why") === "Because.", "present Why: section text must parse out");
  ok(parseBodySection("## Risks\nx\n", "Why") === null, "absent Why: parser must return null (fail-closed)");

  // (6) --post gating (pure plan) + the call-site spy
  ok(planEffects({}).postComment === false && planEffects({}).writeArtifact === true, "default: write artifact, do NOT post");
  ok(planEffects({ dryRun: true }).writeArtifact === false && planEffects({ dryRun: true }).postComment === false, "--dry-run: write nothing, post nothing");
  ok(planEffects({ post: true }).postComment === true, "--post: must post");
  ok(typeof planEffects({ post: true, dryRun: true }).error === "string", "--post + --dry-run: must be refused (error)");

  const spy = () => {
    const calls = [];
    const io = { ghText: (a) => { calls.push(a); return ""; }, ensureDir() {}, writeFile() {} };
    return { io, calls };
  };
  const ctx = (io) => ({ io, opts: { pr: 7 }, artifactPath: "docs/review/REVIEW-7-x.md", markdown: "m", comment: "c", repoArgs: [] });
  const s1 = spy(); runEffects(planEffects({}), ctx(s1.io));
  ok(s1.calls.length === 0, "default plan: runEffects must NOT call `gh pr comment` (no --post)");
  const s2 = spy(); runEffects(planEffects({ dryRun: true }), ctx(s2.io));
  ok(s2.calls.length === 0, "--dry-run plan: runEffects must NOT call `gh pr comment`");
  const s3 = spy(); runEffects(planEffects({ post: true }), ctx(s3.io));
  ok(s3.calls.length === 1 && s3.calls[0][0] === "pr" && s3.calls[0][1] === "comment", "--post plan: runEffects calls `gh pr comment` exactly once");

  if (fails.length) {
    console.error("founder-review-package --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "founder-review-package --self-test PASS — UI-diff slice lists routes in Screenshots; backend slice emits the exact " +
    "'N/A — backend slice (no UI surface changed)'; a review-steps stub is {DEV_URL}-interpolated (live url in, placeholder out); " +
    "a MISSING stub yields the fail-closed 'Testing guide unavailable' message (NEVER hallucinated steps); a missing `## Why` -> " +
    "'Not stated'; and the --post step is gated (default + --dry-run never call `gh pr comment`; --post calls it exactly once; " +
    "--post under --dry-run is refused)."
  );
  process.exit(0);
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();

  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const has = (name) => argv.includes(name);
  const pr = argv.find((a) => /^\d+$/.test(a));
  if (!pr) {
    console.error("USAGE: node founder-review-package.mjs <pr-number> [--repo OWNER/REPO] [--base REF] [--head REF] [--slice NAME] [--dev-url URL] [--post] [--json] [--dry-run] [--self-test]");
    process.exit(2);
  }
  const opts = {
    pr,
    repo: flag("--repo"),
    base: flag("--base"),
    head: flag("--head"),
    slice: flag("--slice"),
    devUrl: flag("--dev-url"),
    post: has("--post"),
    json: has("--json"),
    dryRun: has("--dry-run"),
    cwd: process.cwd(),
  };

  try {
    const report = generate(opts);
    printReport(report, opts);
    process.exit(report.result === "ok" ? 0 : 1);
  } catch (e) {
    console.error(`founder-review-package: ${e.message}`);
    process.exit(1);
  }
}
