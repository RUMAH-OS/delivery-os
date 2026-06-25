#!/usr/bin/env node
// =============================================================================
// Delivery OS — Release Notes generator (zero-dep, Node ESM). The RELEASE
// LIFECYCLE: after a merge to main, turn the merged PR(s) + commits into a
// CHANGELOG-style, conventional-commit-grouped markdown section.
// =============================================================================
// "After a release lands, the founder should not hand-assemble the changelog
//  from `git log`. The tool reads the merged history and DRAFTS the notes — but
//  it never AUTHORS a CHANGELOG write or cuts a GitHub release on its own."
//
// Composes UNDER the ci-release-orchestrator skill (the merge/deploy gate runs
// first; this is the after-merge documentation step). It is read-first by
// default: it PRINTS the notes to stdout. The only mutation (prepending to
// CHANGELOG.md) is gated behind --write, and --gh-release only PRINTS the
// `gh release create` command — cutting the release stays a human/CI step.
//
//   import { classifyCommit, parseLog, buildGroups, renderReleaseNotes, prependChangelog } from "./release-notes.mjs"
//   node release-notes.mjs [--since <tag>] [<from>..<to>] [--pr <n>] [--repo OWNER/REPO]
//                          [--version <v>] [--write] [--gh-release] [--max <n>]
//                          [--json] [--dry-run] [--self-test]
//
// DEFAULT (no flags) = commits since the last tag on main -> print notes to stdout.
//   --write       prepend the section to CHANGELOG.md (the ONLY effect; fail-closed).
//   --dry-run     never writes even with --write (prints what it WOULD do).
//   --gh-release  also print the `gh release create` command (never runs it).
// Robust to `gh` not installed / not authenticated: PR enrichment degrades to a
// note; commit-derived notes still render (git is the fail-closed dependency).
// =============================================================================

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// --- conventional-commit type taxonomy (render order) ------------------------
export const COMMIT_TYPES = [
  { key: "feat", title: "Features" },
  { key: "fix", title: "Bug Fixes" },
  { key: "docs", title: "Documentation" },
  { key: "refactor", title: "Refactoring" },
  { key: "test", title: "Tests" },
  { key: "chore", title: "Chores" },
];
export const OTHER_TYPE = { key: "other", title: "Other Changes" };
const TYPE_KEYS = new Set(COMMIT_TYPES.map((t) => t.key));

// =============================================================================
// PURE CORE — parsing, classification, grouping, rendering. No IO; unit-tested
// by --self-test against fixtures (no git, no gh, no network).
// =============================================================================

// Classify one commit subject. Recognizes `type(scope)!: description`; falls
// back to OTHER (fail-closed: never guess a type). Extracts a PR ref (#n) if the
// subject carries one (the squash-merge convention `... (#42)`).
export function classifyCommit(subject) {
  const s = String(subject || "").trim();
  const m = s.match(/^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/);
  const prMatch = s.match(/\(#(\d+)\)\s*$/) || s.match(/#(\d+)/);
  const pr = prMatch ? Number(prMatch[1]) : null;
  if (m && TYPE_KEYS.has(m[1].toLowerCase())) {
    return { type: m[1].toLowerCase(), scope: m[2] || null, breaking: !!m[3], description: m[4].trim(), pr };
  }
  return { type: "other", scope: null, breaking: /!:/.test(s), description: s, pr };
}

// Parse `git log --format=%s|%h` text into [{ subject, hash }]. Tolerant of
// blank lines and subjects that themselves contain a "|".
export function parseLog(logText) {
  return String(logText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.lastIndexOf("|");
      if (i < 0) return { subject: line, hash: "" };
      return { subject: line.slice(0, i).trim(), hash: line.slice(i + 1).trim() };
    });
}

// Group classified commits by type, preserving COMMIT_TYPES order then OTHER.
// Returns [{ key, title, entries:[{ description, hash, pr, scope, breaking }] }].
export function buildGroups(commits) {
  const byKey = new Map();
  for (const c of commits || []) {
    const cls = classifyCommit(c.subject);
    const entry = { description: cls.description, hash: c.hash || "", pr: cls.pr, scope: cls.scope, breaking: cls.breaking };
    if (!byKey.has(cls.type)) byKey.set(cls.type, []);
    byKey.get(cls.type).push(entry);
  }
  const order = [...COMMIT_TYPES, OTHER_TYPE];
  const groups = [];
  for (const t of order) {
    const entries = byKey.get(t.key);
    if (entries && entries.length) groups.push({ key: t.key, title: t.title, entries });
  }
  return groups;
}

const prLink = (pr, repoUrl) => (repoUrl ? `[#${pr}](${repoUrl}/pull/${pr})` : `#${pr}`);

// Render a CHANGELOG-style markdown section. PR links + short hashes per line.
export function renderReleaseNotes({ groups, prs, version, date, repoUrl, range } = {}) {
  const head = version || "Unreleased";
  const out = [];
  out.push(`## ${head}${date ? ` (${date})` : ""}`);
  if (range) out.push(`\n_Changes in \`${range}\`._`);
  out.push("");
  if (!groups || !groups.length) {
    out.push("_No conventional-commit changes detected in range._");
  }
  for (const g of groups || []) {
    out.push(`### ${g.title}`);
    out.push("");
    for (const e of g.entries) {
      const scope = e.scope ? `**${e.scope}:** ` : "";
      const breaking = e.breaking ? "**BREAKING** " : "";
      const refs = [];
      if (e.pr != null) refs.push(prLink(e.pr, repoUrl));
      if (e.hash) refs.push(`\`${e.hash}\``);
      const tail = refs.length ? ` (${refs.join(", ")})` : "";
      out.push(`- ${breaking}${scope}${e.description}${tail}`);
    }
    out.push("");
  }
  const merged = (prs || []).filter((p) => p && p.number != null);
  if (merged.length) {
    out.push("### Merged Pull Requests");
    out.push("");
    for (const p of merged) {
      out.push(`- ${prLink(p.number, repoUrl)} ${String(p.title || "").trim()}`);
    }
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// Prepend a new section above an existing CHANGELOG body, keeping a leading
// `# Changelog` H1 if present. Pure string transform (the effect itself is the
// caller's writeFile — gated behind --write).
export function prependChangelog(existing, section) {
  const body = String(existing || "");
  const h1 = body.match(/^(#\s+[^\n]*\n+)/);
  if (h1) {
    const rest = body.slice(h1[0].length);
    return `${h1[0]}${section.trimEnd()}\n\n${rest.trimStart()}`.trimEnd() + "\n";
  }
  if (!body.trim()) return `# Changelog\n\n${section.trimEnd()}\n`;
  return `${section.trimEnd()}\n\n${body.trimStart()}`.trimEnd() + "\n";
}

// The `gh release create` command we PRINT (never run). Returns the argv-ish
// string a human/CI can paste; the tool itself never cuts a release.
export function ghReleaseCommand({ version, notesPath }) {
  const tag = version || "vX.Y.Z";
  const notes = notesPath || "RELEASE_NOTES.md";
  return `gh release create ${tag} --title ${tag} --notes-file ${notes}`;
}

// =============================================================================
// git / gh runtime (live path). All shelled via execFileSync (no shell=true).
// =============================================================================
function makeIO(cwd) {
  const git = (args) => execFileSync("git", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] });
  const ghRaw = (args) => execFileSync("gh", args, { encoding: "utf8", cwd, stdio: ["ignore", "pipe", "pipe"] });
  return {
    cwd,
    gitAvailable() { try { execFileSync("git", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } },
    ghAvailable() { try { execFileSync("gh", ["--version"], { stdio: "ignore" }); return true; } catch { return false; } },
    ghAuthed() { try { execFileSync("gh", ["auth", "status"], { stdio: "ignore" }); return true; } catch { return false; } },
    git, ghText: ghRaw,
    ghJson(args) { return JSON.parse(ghRaw(args)); },
    exists(p) { return existsSync(join(cwd, p)); },
    readFile(p) { return readFileSync(join(cwd, p), "utf8"); },
    writeFile(p, data) { writeFileSync(join(cwd, p), data); },
  };
}

const repoArgsOf = (opts) => (opts.repo ? ["--repo", opts.repo] : []);

// Resolve the OWNER/REPO slug -> a github URL for PR links (best-effort).
function resolveRepoUrl(io, opts) {
  if (opts.repo) return `https://github.com/${opts.repo}`;
  try {
    const slug = io.ghJson(["repo", "view", "--json", "nameWithOwner"]).nameWithOwner;
    if (slug) return `https://github.com/${slug}`;
  } catch { /* fall through to git remote */ }
  try {
    const url = String(io.git(["remote", "get-url", "origin"]) || "").trim();
    const m = url.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/i);
    if (m) return `https://github.com/${m[1]}`;
  } catch { /* unknown -> plain #n refs */ }
  return null;
}

// Determine the commit range + a human label for it.
function resolveRange(io, opts) {
  if (opts.range) return { args: [opts.range], label: opts.range };
  if (opts.since) return { args: [`${opts.since}..HEAD`], label: `${opts.since}..HEAD` };
  let lastTag = null;
  try { lastTag = String(io.git(["describe", "--tags", "--abbrev=0"]) || "").trim(); } catch { /* no tags yet */ }
  if (lastTag) return { args: [`${lastTag}..HEAD`], label: `${lastTag}..HEAD` };
  const max = opts.max || 30;
  return { args: ["-n", String(max)], label: `last ${max} commits (no tag found)` };
}

// =============================================================================
// ORCHESTRATION — gather (git log + merged PRs), build, render, optionally write.
// Returns a structured report; performs the CHANGELOG write ONLY when
// opts.write && !opts.dryRun (fail-closed effect). Never cuts a gh release.
// =============================================================================
export async function generateReleaseNotes(opts) {
  const io = opts.io || makeIO(opts.cwd || process.cwd());
  const report = {
    range: null, version: opts.version || null, commitCount: 0, prCount: 0,
    groups: [], markdown: "", wrote: false, changelogPath: opts.changelog || "CHANGELOG.md",
    ghReleaseCmd: null, messages: [], result: "ok",
  };

  // fail-closed preflight: git is the hard dependency (notes derive from history).
  if (io.gitAvailable && !io.gitAvailable()) {
    report.result = "error";
    report.messages.push("git not found on PATH — cannot read commit history. Install git and re-run.");
    return report;
  }

  // ---- gather commits -------------------------------------------------------
  let commits = [];
  if (opts.pr != null) {
    // single-PR mode: prefer gh's commit list; degrade to PR headline if gh is down.
    report.range = `PR #${opts.pr}`;
    if (io.ghAvailable() && io.ghAuthed()) {
      try {
        const view = io.ghJson(["pr", "view", String(opts.pr), ...repoArgsOf(opts), "--json", "commits,title,number,body"]);
        commits = (view.commits || []).map((c) => ({ subject: c.messageHeadline || "", hash: (c.oid || "").slice(0, 7) }));
        report._prSeed = [{ number: view.number, title: view.title, body: view.body }];
      } catch (e) { report.messages.push(`gh pr view #${opts.pr} failed (${e.message}) — PR-mode notes unavailable.`); report.result = "error"; return report; }
    } else {
      report.messages.push("gh unavailable/unauthenticated — --pr mode needs gh. Fail-closed.");
      report.result = "error"; return report;
    }
  } else {
    const range = resolveRange(io, opts);
    report.range = range.label;
    let logText = "";
    try { logText = io.git(["log", ...range.args, "--format=%s|%h"]); }
    catch (e) { report.result = "error"; report.messages.push(`git log failed: ${e.message}`); return report; }
    commits = parseLog(logText);
  }
  report.commitCount = commits.length;

  // ---- gather merged PRs (best-effort enrichment) ---------------------------
  let prs = report._prSeed || [];
  if (!report._prSeed && opts.pr == null) {
    if (io.ghAvailable() && io.ghAuthed()) {
      try {
        const list = io.ghJson(["pr", "list", "--state", "merged", ...repoArgsOf(opts), "--json", "number,title,body,mergedAt", "--limit", String(opts.max || 30)]);
        prs = (list || []).map((p) => ({ number: p.number, title: p.title, body: p.body, mergedAt: p.mergedAt }));
      } catch (e) { report.messages.push(`gh pr list failed (${e.message}) — notes render from commits only.`); }
    } else {
      report.messages.push("gh unavailable/unauthenticated — PR enrichment skipped (commit-derived notes only).");
    }
  }
  report.prCount = prs.length;

  // ---- build + render -------------------------------------------------------
  const repoUrl = opts.repoUrl !== undefined ? opts.repoUrl : resolveRepoUrl(io, opts);
  const date = opts.date || new Date().toISOString().slice(0, 10);
  report.groups = buildGroups(commits);
  report.markdown = renderReleaseNotes({ groups: report.groups, prs, version: report.version, date, repoUrl, range: report.range });

  // ---- effect: prepend to CHANGELOG.md (gated; fail-closed) -----------------
  const wantWrite = !!opts.write;
  if (wantWrite && opts.dryRun) {
    report.messages.push(`[dry-run] would prepend the section to ${report.changelogPath} (no write performed).`);
  } else if (wantWrite) {
    const existing = io.exists(report.changelogPath) ? io.readFile(report.changelogPath) : "";
    const next = prependChangelog(existing, report.markdown);
    io.writeFile(report.changelogPath, next);
    report.wrote = true;
    report.messages.push(`prepended release section to ${report.changelogPath}.`);
  }

  // ---- gh release command (printed, never run) ------------------------------
  if (opts.ghRelease) {
    report.ghReleaseCmd = ghReleaseCommand({ version: report.version, notesPath: report.changelogPath });
    report.messages.push(`gh release is a human/CI step — run: ${report.ghReleaseCmd}`);
  }

  return report;
}

// =============================================================================
// REPORT RENDERING
// =============================================================================
function printReport(report, opts) {
  if (opts.json) { console.log(JSON.stringify(report, null, 2)); return; }
  // human path: the markdown notes ARE the product; emit them, then a short log.
  console.log(report.markdown.trimEnd());
  const meta = [];
  meta.push(`\n— range: ${report.range} · commits: ${report.commitCount} · merged PRs: ${report.prCount}`);
  if (report.wrote) meta.push(`— wrote: ${report.changelogPath}`);
  if (report.ghReleaseCmd) meta.push(`— gh release (run yourself): ${report.ghReleaseCmd}`);
  for (const m of report.messages) meta.push(`— ${m}`);
  console.error(meta.join("\n"));
}

// =============================================================================
// SELF-TEST — pure, no git/gh/network. Asserts:
//  (1) commits group by conventional-commit type (feat/fix/docs/... + other)
//  (2) rendered notes emit PR links ([#n](url/pull/n)) + short hashes
//  (3) the --write effect is GATED: default prints (writeFile NOT called);
//      --write prepends exactly once; --dry-run + --write writes NOTHING
//  (4) --gh-release only PRODUCES the command string (never executes a release)
// =============================================================================
async function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // (1) grouping
  const commits = parseLog([
    "feat(api): add release endpoint (#42)|aaa1111",
    "fix: handle null token (#43)|bbb2222",
    "docs: update README|ccc3333",
    "chore: bump deps|ddd4444",
    "refactor(core): split module|eee5555",
    "test: add smoke fixtures|fff6666",
    "wip random no-type subject|ggg7777",
  ].join("\n"));
  ok(commits.length === 7, `parseLog parsed ${commits.length} commits (expected 7)`);
  const groups = buildGroups(commits);
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  ok(byKey.feat && byKey.feat.entries.length === 1, "feat group has 1 entry");
  ok(byKey.fix && byKey.fix.entries.length === 1, "fix group has 1 entry");
  ok(byKey.docs && byKey.docs.entries.length === 1, "docs group has 1 entry");
  ok(byKey.chore && byKey.chore.entries.length === 1, "chore group has 1 entry");
  ok(byKey.refactor && byKey.refactor.entries.length === 1, "refactor group has 1 entry");
  ok(byKey.test && byKey.test.entries.length === 1, "test group has 1 entry");
  ok(byKey.other && byKey.other.entries.length === 1, "non-conventional subject -> 'other' group");
  ok(groups[0].key === "feat", "render order: feat first");
  ok(byKey.feat.entries[0].pr === 42, "PR ref (#42) extracted from feat subject");
  ok(byKey.feat.entries[0].scope === "api", "scope (api) extracted");

  // (2) PR links + short hashes in the rendered markdown
  const md = renderReleaseNotes({ groups, prs: [{ number: 42, title: "Add release endpoint" }], version: "v1.2.0", date: "2026-06-25", repoUrl: "https://github.com/acme/widget", range: "v1.1.0..HEAD" });
  ok(md.includes("## v1.2.0 (2026-06-25)"), "header carries version + date");
  ok(md.includes("[#42](https://github.com/acme/widget/pull/42)"), "feat line emits a PR link");
  ok(md.includes("`aaa1111`"), "feat line emits the short hash");
  ok(md.includes("### Merged Pull Requests"), "merged-PR section rendered");
  ok(md.includes("### Features") && md.includes("### Bug Fixes"), "type subsections titled");
  // plain repo (no url) -> bare #n, not a broken link
  const mdBare = renderReleaseNotes({ groups: buildGroups(parseLog("fix: x (#9)|h9")), repoUrl: null });
  ok(mdBare.includes("#9") && !mdBare.includes("]("), "no repoUrl -> bare #n (no broken markdown link)");

  // prependChangelog keeps an H1 and stacks the newest section under it
  const pc = prependChangelog("# Changelog\n\n## v1.0.0\n- old\n", "## v1.1.0\n- new\n");
  ok(/^# Changelog/.test(pc), "prependChangelog keeps the H1");
  ok(pc.indexOf("v1.1.0") < pc.indexOf("v1.0.0"), "prependChangelog puts the new section ABOVE the old");

  // (3)+(4) --write gating via an injected spy IO (no real git/gh/fs)
  const spy = () => {
    const calls = { write: 0, lastWrite: null, read: 0 };
    return {
      calls,
      gitAvailable: () => true,
      ghAvailable: () => false, // force commit-only path (no network)
      ghAuthed: () => false,
      git: (args) => {
        if (args[0] === "describe") return "v1.1.0\n";
        if (args[0] === "log") return "feat: a (#1)|h1\nfix: b (#2)|h2\n";
        if (args[0] === "remote") return "git@github.com:acme/widget.git\n";
        return "";
      },
      ghJson: () => { throw new Error("no gh in self-test"); },
      ghText: () => "",
      exists: () => false,
      read: 0,
      readFile: (p) => { calls.read++; return ""; },
      writeFile: (p, data) => { calls.write++; calls.lastWrite = { p, data }; },
    };
  };

  const ioDefault = spy();
  const rDefault = await generateReleaseNotes({ io: ioDefault, repoUrl: "https://github.com/acme/widget" });
  ok(ioDefault.calls.write === 0, "DEFAULT run did NOT write CHANGELOG (effect gated)");
  ok(rDefault.wrote === false, "DEFAULT report.wrote === false");
  ok(rDefault.markdown.includes("[#1](https://github.com/acme/widget/pull/1)"), "default run still renders PR links from commits");

  const ioWrite = spy();
  const rWrite = await generateReleaseNotes({ io: ioWrite, write: true, version: "v1.2.0", repoUrl: "" });
  ok(ioWrite.calls.write === 1, "--write wrote CHANGELOG exactly once");
  ok(rWrite.wrote === true, "--write report.wrote === true");
  ok(ioWrite.calls.lastWrite && ioWrite.calls.lastWrite.data.includes("## v1.2.0"), "--write prepended the new section");

  const ioDry = spy();
  const rDry = await generateReleaseNotes({ io: ioDry, write: true, dryRun: true, version: "v1.2.0" });
  ok(ioDry.calls.write === 0, "--dry-run + --write wrote NOTHING (dry-run overrides the effect)");
  ok(rDry.wrote === false, "--dry-run report.wrote === false");
  ok(rDry.messages.some((m) => /\[dry-run\]/.test(m)), "--dry-run announces what it WOULD do");

  const ioRel = spy();
  const rRel = await generateReleaseNotes({ io: ioRel, ghRelease: true, version: "v1.2.0" });
  ok(ioRel.calls.write === 0, "--gh-release alone does NOT write");
  ok(rRel.ghReleaseCmd === "gh release create v1.2.0 --title v1.2.0 --notes-file CHANGELOG.md", "--gh-release PRODUCES the command (never runs it)");

  if (fails.length) {
    console.error("release-notes --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "release-notes --self-test PASS — commits group by conventional-commit type (feat/fix/docs/refactor/test/chore + other, ordered), " +
    "rendered notes emit PR links ([#n](url/pull/n)) + short hashes (bare #n when no repoUrl), " +
    "the --write effect is GATED (default + --dry-run write NOTHING; --write prepends exactly once above the H1), " +
    "and --gh-release only PRODUCES the `gh release create` command (never cuts a release)."
  );
  process.exit(0);
}

// =============================================================================
// CLI
// =============================================================================
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) { selfTest(); }
  else {
    const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
    const has = (name) => argv.includes(name);
    const range = argv.find((a) => /\.\./.test(a) && !a.startsWith("--"));
    const prFlag = flag("--pr");
    const opts = {
      range,
      since: flag("--since"),
      pr: prFlag != null ? Number(prFlag) : null,
      repo: flag("--repo"),
      version: flag("--version"),
      max: flag("--max") ? Number(flag("--max")) : undefined,
      write: has("--write"),
      ghRelease: has("--gh-release"),
      json: has("--json"),
      dryRun: has("--dry-run"),
      cwd: process.cwd(),
    };
    generateReleaseNotes(opts)
      .then((report) => {
        printReport(report, opts);
        process.exit(report.result === "ok" ? 0 : 1);
      })
      .catch((e) => { console.error(`release-notes: ${e.message}`); process.exit(1); });
  }
}
