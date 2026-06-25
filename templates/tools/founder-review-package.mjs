#!/usr/bin/env node
// =============================================================================
// Delivery OS — Founder Review Package generator (zero-dep, Node ESM).
// Turns a slice's PR into the EXACT zero-technical-knowledge package a founder
// can act on alone:
//   (a) a durable, FOUNDER-FACING markdown artifact  docs/review/REVIEW-<pr>-<slice>.md
//       — plain-business-language summary · the chosen simplest review path
//       (LOCAL vs DEV, decided FOR the founder) · real URLs (no placeholders) ·
//       click-by-click · expected results · an explicit ✅ PASS / ❌ FAIL checklist ·
//       real-or-N/A screenshots · rollback ONLY if relevant · "what still needs YOU"
//       with DIRECT links ONLY for a real one-time founder action. Implementation
//       detail (diffs, ADRs, env vars, CI, repo plumbing) is kept OUT of the
//       founder doc — it lives in the engineer-facing PR comment instead.
//   (b) a condensed, ENGINEER-FACING PR comment (gh pr comment — DEFAULT prints
//       it, only POSTS with an explicit --post; effectful, fail-closed).
// =============================================================================
// Ratified 2026-06-25 as the canonical founder-review standard; the earned case
// is rumah-admin's FOUNDER-REVIEW-public-signer.md (the "I chose LOCAL because…",
// 4-exact-URL, ✅/❌, impl-hidden package a founder approved).
//
// "The founder should be able to review a slice with ZERO technical knowledge —
//  in plain language, on whichever path costs them the least effort (we DECIDE it
//  for them: local if it needs nothing from them, else the live DEV preview), with
//  the exact clicks and an explicit pass/fail. But the package must NEVER invent
//  what it cannot know: the business summary, the exact clicks and the ✅/❌
//  checklist are engineer-SEEDED product knowledge (read from a stub, never
//  diff-invented), the screenshots are real-or-explicit-N/A (never fabricated), the
//  URLs are real-or-fail-closed (never a placeholder pretending to be a link), and
//  posting the PR comment is effectful — it happens ONLY behind --post (fail-closed)."
//
// SECTION SOURCES (every section cites a real source; absent -> honest fail-closed):
//   Title / app          .delivery-os/founder-review.json `app`/`review.title` | PR title
//   Chosen review path    LOCAL iff .delivery-os/founder-review.json has a `local`
//                         harness + `review.urls` (needs NOTHING from the founder);
//                         ELSE DEV iff a DEV url is known; ELSE fail-closed "none".
//   The links             review.urls × chosen base (local frontendBase | DEV url) —
//                         REAL urls only; never a fabricated/placeholder link.
//   What changed (plain)  stub `## Business summary` | PR body `## Founder summary`/
//                         `## Summary` | (fallback) the PR title, flagged as un-seeded.
//   Click-by-click        stub `## Click-by-click` (or the whole stub, back-compat),
//                         {REVIEW_URL}/{DEV_URL}-interpolated. ABSENT stub ->
//                         fail-closed "Testing guide unavailable" (NEVER hallucinated).
//   Expected results      stub `## Expected results` (optional — omitted if absent).
//   Pass/Fail checklist   stub `## Pass/Fail checklist`. ABSENT -> fail-closed
//                         "checklist not seeded" (NEVER invented ✅/❌ items).
//   Screenshots           UI paths changed -> routes to capture; ELSE "N/A — backend".
//   Rollback              stub `## Rollback` — rendered ONLY if present (relevant-only).
//   What still needs YOU  stub `## What still needs you` (may carry the ONE real
//                         founder-action link) | ELSE "nothing further".
//   If the links don't work  LOCAL only — the one-command harness restart.
//
//   import { buildPackage, parseBodySection, deriveRoutes, planEffects,
//            chooseReviewMode, parseStubSections } from "./founder-review-package.mjs"
//   node founder-review-package.mjs <pr> [--repo O/R] [--base REF] [--head REF]
//        [--slice NAME] [--dev-url URL] [--prefer local|dev] [--post] [--json]
//        [--dry-run] [--self-test]
//
// DEFAULT (no flags) = write the artifact + PRINT the condensed comment (does NOT post).
//   --post     also posts the comment (effectful; refused under --dry-run; fail-closed).
//   --dry-run  read-only: writes NOTHING, posts NOTHING — just renders the package.
//   --prefer   override the auto-decided review path (still fail-closed if unavailable).
// Robust to `gh` not installed / not authenticated (fail-closed, clear message, non-zero).
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// --- UI surface discriminators (a changed path counts as UI iff one hits) ----
export const UI_PATTERNS = [/^apps\/web\//, /\.tsx$/, /^admin-ui\//];
export const isUiPath = (p) => UI_PATTERNS.some((re) => re.test(String(p)));

// Implementation-detail tokens that should NOT appear in a founder-facing doc
// (unless a one-time founder action must name a specific place to click). The
// scan is ADVISORY: it warns the engineer; it never rewrites or fabricates.
export const IMPL_LEAK_PATTERNS = [
  /\bVITE_[A-Z0-9_]+\b/, /\bprocess\.env\b/, /\bDATABASE_URL\b/, /\benv var(?:iable)?s?\b/i,
  /\blocalhost:\d+\/\w*\bapi\b/i, /\b[A-Z0-9_]+_API_URL\b/, /```[a-z]*\n/,
];

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

// Parse an engineer-seeded review-steps stub into named `##` sections + a
// preamble (text before the first heading). Returns null for an absent stub
// (so the caller can fail-closed). Section keys are lower-cased headings.
export function parseStubSections(raw) {
  if (raw == null) return null;
  const lines = String(raw).split(/\r?\n/);
  const sections = {};
  const order = [];
  let cur = "_preamble";
  let buf = [];
  const flush = () => {
    const t = buf.join("\n").trim();
    if (t.length) { sections[cur] = t; if (!order.includes(cur)) order.push(cur); }
    buf = [];
  };
  for (const ln of lines) {
    const m = ln.match(/^#{1,6}\s+(.*?)\s*$/);
    if (m) { flush(); cur = m[1].trim().toLowerCase(); }
    else buf.push(ln);
  }
  flush();
  return { raw: String(raw), sections, order };
}

// First stub section whose heading starts with any of the given names. null if none.
export function stubGet(stub, ...names) {
  if (!stub) return null;
  for (const want of names) {
    const w = String(want).toLowerCase();
    for (const key of order_(stub)) if (key.startsWith(w)) return stub.sections[key];
  }
  return null;
}
const order_ = (stub) => (stub.order && stub.order.length ? stub.order : Object.keys(stub.sections || {}));

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

// -----------------------------------------------------------------------------
// THE LOAD-BEARING DECISION: which review path costs the founder the LEAST?
//   LOCAL  iff a `.delivery-os/founder-review.json` local harness + review.urls
//          exist — local needs NOTHING from the founder (no credentials, no deploy
//          wait); it is therefore the simplest path and is CHOSEN for them.
//   DEV    else iff a DEV url is known — already live, nothing to install.
//   none   else — fail-closed: NO fabricated URLs; the package says so honestly.
// `--prefer` can force local|dev but still fails closed when that path is absent.
// -----------------------------------------------------------------------------
export function chooseReviewMode({ config, devUrl, prefer } = {}) {
  const hasLocal = !!(config && config.local && config.local.command &&
    config.review && Array.isArray(config.review.urls) && config.review.urls.length);
  const reviewUrls = (config && config.review && Array.isArray(config.review.urls)) ? config.review.urls : [];
  const mkUrls = (base) => reviewUrls.map((u) => ({ label: u.label || "Open this link", url: base + (u.path || "") }));

  const local = () => {
    const base = String(config.local.frontendBase || "").replace(/\/+$/, "");
    return {
      mode: "local", base, command: config.local.command,
      urls: mkUrls(base),
      why: "it needs **nothing from you** — no passwords, no deploy settings, no waiting on a deploy. Everything is prepared and runs on your own computer right now.",
      noSetup: true,
    };
  };
  const dev = () => {
    const base = String(devUrl || "").replace(/\/+$/, "");
    const urls = reviewUrls.length ? mkUrls(base) : [{ label: "The live preview", url: base }];
    return {
      mode: "dev", base, command: null, urls,
      why: "it is already live on the shared preview website, so there is **nothing to install** on your computer.",
      noSetup: false,
    };
  };

  if (prefer === "local") return hasLocal ? local() : noneMode("--prefer local was requested but this project has no `.delivery-os/founder-review.json` local harness");
  if (prefer === "dev") return devUrl ? dev() : noneMode("--prefer dev was requested but no DEV url is known (pass --dev-url or provision a deployment)");

  if (hasLocal) return local();
  if (devUrl) return dev();
  return noneMode("no `.delivery-os/founder-review.json` local harness and no DEV url");
}
function noneMode(reason) {
  return { mode: "none", base: null, command: null, urls: [], why: null, noSetup: false, reason };
}

// Interpolate the chosen review base into seeded text. Both {REVIEW_URL} (mode-
// agnostic) and {DEV_URL} (back-compat) resolve to the chosen base; with no base
// the placeholders are left intact (honest — the engineer must supply the path).
export function interpReview(text, base) {
  if (text == null) return text;
  let s = String(text);
  if (base) s = s.replace(/\{REVIEW_URL\}/g, base).replace(/\{DEV_URL\}/g, base);
  return s;
}

// Advisory scan: which impl-detail tokens leaked into the founder-facing doc.
export function scanImplLeak(markdown) {
  const found = [];
  for (const re of IMPL_LEAK_PATTERNS) {
    const m = String(markdown).match(re);
    if (m) found.push(m[0].replace(/\n/g, "\\n"));
  }
  return [...new Set(found)];
}

// =============================================================================
// SECTION BUILDERS — each takes the gathered `data` and returns a markdown body.
// The FOUNDER-FACING artifact intentionally excludes diff/ADR/CI/plumbing — those
// belong to the engineer-facing PR comment, not the founder.
// =============================================================================
function reviewTitle(d) {
  return (d.config && d.config.review && d.config.review.title) ||
         (d.config && d.config.app) || d.pr.title;
}

function sTitle(d) {
  const t = reviewTitle(d);
  const tail = d.review.mode === "local" ? " — a few minutes, no setup"
             : d.review.mode === "dev" ? " — a few minutes"
             : "";
  return `# Founder Review — ${t}${tail}`;
}

function sIntro(d) {
  const lines = [];
  if (d.review.mode === "local") {
    lines.push("**You don't need to install or configure anything. It's already prepared and running. Just open the links below in your browser.**", "");
    lines.push(`I set this up **on your own computer (local)** instead of a web deployment, because ${d.review.why}`);
  } else if (d.review.mode === "dev") {
    lines.push(`I set this up on the **shared preview website**, because ${d.review.why}`);
  } else {
    lines.push("**No reviewable surface is available yet.**", "");
    lines.push(
      `_Fail-closed: there is nothing the founder can click yet (${d.review.reason}). ` +
      "An engineer must either provision a DEV deployment (and pass `--dev-url`) or add a " +
      "`.delivery-os/founder-review.json` local harness so this package can print REAL urls. " +
      "No placeholder links are invented._"
    );
  }
  return lines.join("\n");
}

function sLinks(d) {
  if (d.review.mode === "none") {
    return "_(No links — see above. Real urls appear here only once a review path is configured; none are fabricated.)_";
  }
  const lines = ["Open these in your browser (Chrome / Edge / Firefox):", ""];
  d.review.urls.forEach((u, i) => lines.push(`${i + 1}. **${u.label}:**\n   ${u.url}`));
  if (d.review.mode === "local") {
    lines.push("", "> If a link doesn't load, the review environment may have stopped — jump to **\"If the links don't work\"** at the bottom.");
  }
  return lines.join("\n");
}

function sBusinessSummary(d) {
  const seeded = stubGet(d.stub, "business summary", "what changed", "what was broken", "summary");
  if (seeded) return interpReview(seeded, d.review.base);
  const fromBody = parseBodySection(d.pr.body, "Founder summary") || parseBodySection(d.pr.body, "Summary");
  if (fromBody) return fromBody;
  return [
    `**${d.pr.title}**`,
    "",
    "_(Plain-language summary not seeded — showing the PR title. For a jargon-free, one-paragraph",
    `business summary, add a \`## Business summary\` section to \`docs/review/review-steps-${d.slice}.md\`.)_`,
  ].join("\n");
}

function sClickByClick(d) {
  if (d.stub == null) {
    return [
      `**Testing guide unavailable — author \`docs/review/review-steps-${d.slice}.md\`.**`,
      "",
      "_(Fail-closed: the click-by-click is engineer-seeded product knowledge — the exact",
      "clicks a founder makes are NOT invented from the diff. Seed the stub with numbered",
      "steps (and the `## Business summary`, `## Pass/Fail checklist` sections) using",
      "`{REVIEW_URL}` placeholders and regenerate.)_",
    ].join("\n");
  }
  // Prefer the dedicated section; fall back to the whole stub (back-compat).
  const body = stubGet(d.stub, "click-by-click", "click by click", "how to test", "steps") || d.stub.raw;
  const note = (!d.review.base)
    ? "> Note: no review url is known yet — `{REVIEW_URL}` placeholders are left intact; provision the review path and regenerate.\n\n"
    : "";
  return note + interpReview(body, d.review.base).trim();
}

function sExpected(d) {
  const body = stubGet(d.stub, "expected results", "what you should see", "expected");
  return body ? interpReview(body, d.review.base) : null; // optional — omitted when absent
}

function sChecklist(d) {
  const body = stubGet(d.stub, "pass/fail", "pass / fail", "pass-fail", "checklist", "pass / ❌", "✅");
  if (body) return interpReview(body, d.review.base);
  return [
    "**Pass/fail checklist not seeded.**",
    "",
    `_(Fail-closed: explicit ✅ PASS / ❌ FAIL items are engineer-seeded — they are NOT invented.`,
    `Add a \`## Pass/Fail checklist\` section to \`docs/review/review-steps-${d.slice}.md\`, one`,
    "✅/❌ line per check, and regenerate.)_",
  ].join("\n");
}

function sScreenshots(d) {
  const uiPaths = (d.diffStat.changedPaths || []).filter(isUiPath);
  if (!uiPaths.length) return "N/A — backend slice (no UI surface changed)";
  const routes = deriveRoutes(uiPaths);
  const lines = [
    "This slice changes the screen. A screenshot of each surface below is useful (real-or-N/A —",
    "no image is auto-generated or fabricated):",
    "",
  ];
  for (const r of routes) lines.push(`- [ ] \`${r}\``);
  return lines.join("\n");
}

function sRollback(d) {
  const body = stubGet(d.stub, "rollback", "roll back");
  return body ? interpReview(body, d.review.base) : null; // relevant-only — omitted when absent
}

function sNeedsYou(d) {
  const body = stubGet(d.stub, "what still needs you", "what needs you", "founder action", "what still needs", "needs you");
  if (body) return interpReview(body, d.review.base);
  return "Nothing further from you beyond your approval — there are no outstanding one-time actions, no settings to change.";
}

function sLinksDontWork(d) {
  if (d.review.mode !== "local") return null;
  return [
    "The environment runs while this review session is active. To start it again:",
    "",
    "1. Open a terminal in this project's folder.",
    `2. Run **\`${d.review.command}\`** and wait for it to print the links (about a minute).`,
    "3. Open the links above.",
  ].join("\n");
}

// =============================================================================
// PACKAGE ASSEMBLY — the durable founder artifact + the engineer-facing comment.
// =============================================================================
export function buildPackage(d) {
  const section = (title, body) => (body == null ? null : `## ${title}\n\n${body}\n`);
  const expected = sExpected(d);
  const rollback = sRollback(d);
  const dontWork = sLinksDontWork(d);

  const parts = [
    sTitle(d), "",
    sIntro(d), "",
    "---", "",
    section("The links to open", sLinks(d)),
    "---", "",
    section("What changed (in plain language)", sBusinessSummary(d)),
    "---", "",
    section("Click-by-click", sClickByClick(d)),
    expected != null ? section("What you should see", expected) : null,
    "---", "",
    section("✅ Pass / ❌ Fail checklist", sChecklist(d)),
    "---", "",
    section("Screenshots", sScreenshots(d)),
    rollback != null ? "---\n\n" + section("Rollback notes", rollback) : null,
    "---", "",
    section("What still needs YOU", sNeedsYou(d)),
    dontWork != null ? section("If the links don't work", dontWork) : null,
    "---",
    `_Generated by founder-review-package.mjs from PR #${d.pr.number} — regenerate, do not hand-edit. (Engineering detail is in the PR comment, not here.)_`,
    "",
  ];
  const markdown = parts.filter((p) => p !== null).join("\n");

  // The ENGINEER-facing condensed comment carries the plumbing the founder doc hides.
  const { files, insertions, deletions, areas } = d.diffStat;
  const topAreas = Object.keys(areas).sort().slice(0, 4).join(", ") || "—";
  const risks = parseBodySection(d.pr.body, "Risks") || d.verifyResidualRisk;
  const uiPaths = (d.diffStat.changedPaths || []).filter(isUiPath);
  const shot = uiPaths.length ? `${deriveRoutes(uiPaths).length} UI surface(s) to capture` : "N/A — backend slice";
  const pathLine = d.review.mode === "none"
    ? "**none configured** — provision DEV (`--dev-url`) or add `.delivery-os/founder-review.json`"
    : `${d.review.mode.toUpperCase()} · ${d.review.urls.length} url(s)`;
  const comment = [
    `## Founder Review Package — ${d.slice}`,
    `**Status: awaiting founder review · review path chosen: ${pathLine}**`,
    "",
    `**What this does:** ${d.pr.title}`,
    `**What changed:** ${files} file(s) · +${insertions}/-${deletions} · areas: ${topAreas}`,
    `**Risks:** ${risks ? risks.split(/\r?\n/)[0] : "none flagged"}`,
    `**Screenshots:** ${shot}`,
    `**ADRs touched:** ${(d.adrTouched && d.adrTouched.length) ? d.adrTouched.join(", ") : "none"}`,
    `**PR:** ${d.pr.url}` + (d.ciRunUrl ? ` · **CI:** ${d.ciRunUrl}` : "") + (d.verifyExists ? ` · **VERIFY:** \`${d.verifyPath}\`` : ""),
    "",
    `Full FOUNDER-FACING package (plain language, the chosen review path, click-by-click + ✅/❌ checklist): \`${d.artifactPath}\``,
  ].join("\n");

  return { markdown, comment, warnings: scanImplLeak(markdown) };
}

// =============================================================================
// EFFECT PLAN — the one effectful surface, gated + fail-closed. PURE so the
// self-test can pin the gating without any IO.
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

// Parse `git diff --numstat <base>...<head>` -> files / insertions / deletions / areas / changedPaths.
function parseNumstat(lines) {
  let insertions = 0, deletions = 0;
  const changedPaths = [];
  for (const ln of lines) {
    const m = ln.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (!m) continue;
    if (m[1] !== "-") insertions += Number(m[1]);
    if (m[2] !== "-") deletions += Number(m[2]);
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

// Read + parse `.delivery-os/founder-review.json` (the per-project local-review
// config). Absent -> null (fail-closed to DEV). Malformed -> null + a warning.
function loadReviewConfig(io, warnings) {
  const raw = io.readIfExists(".delivery-os/founder-review.json");
  if (raw == null) return null;
  try { return JSON.parse(raw); }
  catch (e) { warnings.push(`.delivery-os/founder-review.json is present but not valid JSON (${e.message}) — ignoring it, falling back to DEV.`); return null; }
}

// =============================================================================
// GATHER — pull every section's input from its cited source (live IO).
// =============================================================================
export function gather(io, opts) {
  const warnings = [];
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
  const stub = parseStubSections(reviewStepsRaw);

  const config = loadReviewConfig(io, warnings);
  const devUrl = resolveDevUrl(io, opts);
  const review = chooseReviewMode({ config, devUrl, prefer: opts.prefer });
  const ciRunUrl = resolveCiRunUrl(io, opts, pv.headRefName);
  const artifactPath = `docs/review/REVIEW-${pv.number}-${slice}.md`;

  return {
    slice, base, head, artifactPath, config, review, stub, warnings,
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

  const plan = planEffects(opts);
  if (plan.error) { report.result = "error"; report.messages.push(plan.error); return report; }

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

  const { markdown, comment, warnings } = buildPackage(data);
  report.slice = data.slice;
  report.artifactPath = data.artifactPath;
  report.reviewMode = data.review.mode;
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

  for (const w of (data.warnings || [])) report.messages.push(`warning: ${w}`);
  report.messages.push(`review path chosen: ${data.review.mode}${data.review.mode === "none" ? ` (${data.review.reason})` : ""}`);
  if (warnings && warnings.length) report.messages.push(`impl-detail leak check: review these tokens in the founder doc -> ${warnings.join(", ")}`);
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
// SELF-TEST — pure, no live calls, no mutation.
// =============================================================================
function makeData(over = {}) {
  const config = "config" in over ? over.config : null;
  const reviewStepsRaw = "reviewStepsRaw" in over ? over.reviewStepsRaw : null;
  const devUrl = "devUrl" in over ? over.devUrl : null;
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
    reviewStepsRaw, devUrl,
    config,
    stub: parseStubSections(reviewStepsRaw),
    review: chooseReviewMode({ config, devUrl, prefer: over.prefer }),
    ciRunUrl: null,
  };
  const d = { ...base, ...over };
  d.diffStat = { ...base.diffStat, ...(over.diffStat || {}) };
  d.pr = { ...base.pr, ...(over.pr || {}) };
  // recompute derived fields if the inputs were overridden
  d.stub = parseStubSections(d.reviewStepsRaw);
  d.review = chooseReviewMode({ config: d.config, devUrl: d.devUrl, prefer: over.prefer });
  return d;
}

const LOCAL_CONFIG = {
  app: "Demo App",
  review: {
    title: "Sign-in Fix",
    urls: [
      { label: "A real signing link (the main test)", path: "/sign/founder-review-valid-2026" },
      { label: "A broken/expired link (the error test)", path: "/sign/this-link-is-not-valid" },
    ],
  },
  local: { command: "npm run founder:review", frontendBase: "http://localhost:5180" },
};

const RICH_STUB = [
  "## Business summary",
  "When someone clicked a link to sign a contract, they hit the staff password screen instead.",
  "Fixed = the same link now opens the contract page directly.",
  "",
  "## Click-by-click",
  "1. Open the first link at {REVIEW_URL}/sign/founder-review-valid-2026.",
  "2. You land straight on a signing page — no login. ✅",
  "",
  "## Pass/Fail checklist",
  "1. Signing link opens the signing page — ✅ you see the contract · ❌ you see a login box.",
  "",
  "## What still needs you",
  "1. Deploy the fix — it is in this ready pull request: https://example/pull/1.",
].join("\n");

function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // (1) LOCAL config -> mode local: no-setup banner, real local urls, "I set this up ... local", restart command.
  const localPkg = buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: RICH_STUB })).markdown;
  ok(/You don't need to install or configure anything/.test(localPkg), "local: must show the zero-setup banner");
  ok(localPkg.includes("on your own computer (local)"), "local: must state the LOCAL choice in plain language");
  ok(localPkg.includes("http://localhost:5180/sign/founder-review-valid-2026"), "local: must print the REAL local url (base + path)");
  ok(!/\{REVIEW_URL\}|\{DEV_URL\}/.test(localPkg), "local: no raw {REVIEW_URL}/{DEV_URL} placeholder may remain");
  ok(localPkg.includes("npm run founder:review"), "local: must reference the one-command harness restart");
  ok(/If the links don't work/.test(localPkg), "local: must include the 'If the links don't work' restart section");

  // (2) no config + DEV url -> mode dev: shared-preview wording, urls on the DEV base, NO local banner.
  const devPkg = buildPackage(makeData({ devUrl: "https://dev.example.app", reviewStepsRaw: RICH_STUB })).markdown;
  ok(devPkg.includes("shared preview website"), "dev: must state the DEV choice");
  ok(!/You don't need to install or configure anything/.test(devPkg), "dev: must NOT show the local zero-setup banner");
  ok(devPkg.includes("https://dev.example.app/sign/founder-review-valid-2026"), "dev: must interpolate seeded steps onto the DEV base");

  // (3) no config + no DEV url -> mode none: fail-closed, NO fabricated urls.
  const nonePkg = buildPackage(makeData({})).markdown;
  ok(nonePkg.includes("No reviewable surface is available yet"), "none: must fail-closed with the no-surface notice");
  ok(!/https?:\/\//.test(nonePkg.split("## What changed")[0]), "none: must NOT fabricate any http(s) link in the review-path section");

  // (4) rich stub -> business summary, click-by-click AND the explicit ✅/❌ checklist all rendered.
  ok(localPkg.includes("they hit the staff password screen"), "stub: the seeded business summary must render");
  ok(/## ✅ Pass \/ ❌ Fail checklist/.test(localPkg) && localPkg.includes("you see the contract"), "stub: the seeded ✅/❌ checklist must render");
  ok(localPkg.includes("## What still needs YOU") && localPkg.includes("https://example/pull/1"), "stub: 'what still needs you' must carry the real founder-action link");

  // (5) absent stub -> click-by-click fail-closed AND checklist fail-closed (never invented).
  const noStub = buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: null })).markdown;
  ok(noStub.includes("Testing guide unavailable — author `docs/review/review-steps-demo-slice.md`"),
     "no stub: click-by-click must be the fail-closed 'unavailable' message naming the stub path");
  ok(noStub.includes("Pass/fail checklist not seeded"), "no stub: checklist must be fail-closed 'not seeded' (no invented ✅/❌)");
  ok(!/^\s*1\.\s+Open the first link/m.test(noStub.split("## Click-by-click")[1] || ""), "no stub: must NOT hallucinate numbered steps");

  // (6) checklist absent but stub present -> checklist still fail-closed (no fabrication from clicks).
  const noChecklist = buildPackage(makeData({ config: LOCAL_CONFIG,
    reviewStepsRaw: "## Click-by-click\n1. Open {REVIEW_URL}/x and look. ✅" })).markdown;
  ok(noChecklist.includes("Pass/fail checklist not seeded"), "partial stub: a missing checklist section stays fail-closed");

  // (7) backend slice -> Screenshots exact N/A; (8) UI slice -> lists /room.
  const be = buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: RICH_STUB,
    diffStat: { files: 1, insertions: 5, deletions: 0, changedPaths: ["templates/tools/y.mjs"], areas: { templates: 1 } } })).markdown;
  ok(be.includes("N/A — backend slice (no UI surface changed)"), "backend slice: Screenshots must be the exact backend N/A string");
  const ui = buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: RICH_STUB,
    diffStat: { files: 2, insertions: 20, deletions: 1, changedPaths: ["apps/web/app/room/page.tsx", "apps/web/components/Card.tsx"], areas: { apps: 2 } } })).markdown;
  ok(ui.includes("`/room`") && !ui.includes("N/A — backend slice"), "UI slice: Screenshots must list /room, not the backend N/A");

  // (9) impl-detail leak scan flags VITE_/env tokens that slipped into a seeded section.
  const leaky = buildPackage(makeData({ config: LOCAL_CONFIG,
    reviewStepsRaw: "## Click-by-click\n1. Set VITE_API_URL then open {REVIEW_URL}/x." }));
  ok(leaky.warnings.includes("VITE_API_URL"), "impl-leak: the advisory scan must flag VITE_API_URL in the founder doc");
  ok(buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: RICH_STUB })).warnings.length === 0,
     "impl-leak: a clean founder doc yields no leak warnings");

  // (10) --prefer override is honored AND fails closed.
  ok(chooseReviewMode({ config: LOCAL_CONFIG, devUrl: "https://dev.example.app", prefer: "dev" }).mode === "dev",
     "--prefer dev: must choose DEV even when a local harness exists");
  ok(chooseReviewMode({ config: null, devUrl: null, prefer: "local" }).mode === "none",
     "--prefer local with no harness: must fail closed to none (no fabricated local urls)");

  // (11) rollback is relevant-only; what-still-needs-you defaults to 'nothing further'.
  const noRollback = buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: RICH_STUB })).markdown;
  ok(!/## Rollback notes/.test(noRollback), "rollback: omitted when the stub seeds none (relevant-only)");
  const withRollback = buildPackage(makeData({ config: LOCAL_CONFIG,
    reviewStepsRaw: RICH_STUB + "\n\n## Rollback\nIf needed, ask the engineer to revert the pull request." })).markdown;
  ok(/## Rollback notes/.test(withRollback), "rollback: rendered when the stub seeds it");
  const noNeeds = buildPackage(makeData({ config: LOCAL_CONFIG, reviewStepsRaw: "## Click-by-click\n1. Open {REVIEW_URL}/x." })).markdown;
  ok(noNeeds.includes("Nothing further from you beyond your approval"), "needs-you: defaults to 'nothing further' with no fabricated links");

  // (12) --post gating (pure plan) + the call-site spy.
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
    "founder-review-package --self-test PASS — the simplest review path is CHOSEN for the founder " +
    "(LOCAL when a .delivery-os/founder-review.json harness needs nothing from them; else DEV; else a fail-closed " +
    "'no reviewable surface' with NO fabricated urls); REAL urls are printed (base+path), never a placeholder link; " +
    "the business summary, click-by-click and explicit ✅/❌ checklist are engineer-SEEDED (a missing stub -> fail-closed " +
    "'Testing guide unavailable'; a missing checklist -> fail-closed 'not seeded'; NEVER invented); screenshots stay " +
    "real-or-exact-'N/A — backend slice (no UI surface changed)'; rollback is relevant-only; 'what still needs YOU' carries " +
    "a link ONLY when seeded; an impl-detail leak scan flags VITE_/env tokens; and the --post step is gated (default + " +
    "--dry-run never call `gh pr comment`; --post calls it once; --post under --dry-run is refused)."
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
    console.error("USAGE: node founder-review-package.mjs <pr-number> [--repo OWNER/REPO] [--base REF] [--head REF] [--slice NAME] [--dev-url URL] [--prefer local|dev] [--post] [--json] [--dry-run] [--self-test]");
    process.exit(2);
  }
  const opts = {
    pr,
    repo: flag("--repo"),
    base: flag("--base"),
    head: flag("--head"),
    slice: flag("--slice"),
    devUrl: flag("--dev-url"),
    prefer: flag("--prefer"),
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
