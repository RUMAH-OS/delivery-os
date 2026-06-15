#!/usr/bin/env node
// =============================================================================
// Delivery OS — milestone-report (v6 permanent post-milestone verification). Zero-dep.
// =============================================================================
// The founder's standing requirement: every MAJOR change must be followed by proof the
// system is OPERATING, not merely existing. capability-health proved a capability can
// REPORT done while INERT; agent-health proved the agent system was UN-MEASURED; the
// experience-gate proved a surface can pass typecheck yet be unusable. Each answers ONE
// dimension. This runner makes the TRIO one command so the floor is run EVERY milestone,
// not piecemeal — the recurring "is it alive?" gate.
//
//   1. capability-health     — are the inherited OS capabilities WIRED-to-run? (fail-closed)
//   2. agent-health          — is the agent orchestration measured + healthy? (reporting)
//   3. founder-experience    — do the real founder-facing surfaces actually work? (fail-closed)
//   4. skill-health          — does every skill have ADOPTION EVIDENCE (the evidence ladder)? (reporting)
//
// FAIL-CLOSED POLICY: exit 1 if capability-health regressed/INERT, OR if experience:check
// RAN and FAILED. agent-health is REPORTING ONLY — never the sole cause of failure — but its
// SUMMARY line is printed prominently. Exit 0 only when capability-health passed and
// experience either passed or was skipped (no DATABASE_URL / no experience:check script).
//
// NOT A CI GATE — deliberately NOT wired into ci.yml. agent-health needs the runtime
// telemetry corpus (subagent transcripts) that does not exist in CI, and experience:check
// needs a live DATABASE_URL. This is an OPERATOR / post-milestone command, run by a human
// after a milestone lands. Per-push gates live in ci.yml; this is the milestone floor.
//
//   node milestone-report.mjs --project <path> [--telemetry <dir>] [--skip-experience]
//   node milestone-report.mjs --self-test          # prove the verdict logic
// =============================================================================

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

// Resolve the project-side skill-health.mjs (app-side today: <project>/scripts/skill-health.mjs).
// Returns the absolute path if present, else null (a project without skill-health → graceful skip,
// the same posture as the capability-health CI skip). EXPORTED for --self-test.
export function resolveSkillHealthPath(projectDir) {
  const p = join(projectDir, "scripts", "skill-health.mjs");
  return existsSync(p) ? p : null;
}

// pure: build the argv for skill-health from the project dir (+ optional telemetry-glob override).
// Defaults mirror the founder's invocation: selections log + project skills + verify artifacts.
// EXPORTED for --self-test (so the wiring is asserted without spawning).
export function skillHealthArgs(projectDir, telemetryGlob) {
  const args = [
    "--selections", join(projectDir, ".claude", "os", "telemetry", "skill-selections.jsonl"),
    "--skills", join(projectDir, ".claude", "skills"),
    "--artifacts", join(projectDir, "docs", "verify"),
  ];
  if (telemetryGlob) args.push("--telemetry-glob", telemetryGlob);
  return args;
}

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const HERE = dirname(fileURLToPath(import.meta.url));

// pure: the fail-closed verdict. capability-health is decisive; experience is decisive
// ONLY when it actually RAN; agent-health is never an input (reporting only).
//   capOk   — capability-health exited 0
//   expRan  — experience:check actually executed (not skipped)
//   expOk   — experience:check exited 0 (only meaningful when expRan)
// → "PASS" iff capOk AND (experience was skipped OR passed); else "FAIL".
export function overallVerdict({ capOk, expRan, expOk }) {
  if (!capOk) return "FAIL";
  if (expRan && !expOk) return "FAIL";
  return "PASS";
}

// run a node tool, inheriting nothing but capturing both streams so we can re-print under
// a header AND inspect the exit code. Returns { code, out } where out = stdout+stderr.
function runNode(scriptPath, args, cwd) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: cwd || process.cwd(), encoding: "utf8", windowsHide: true,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  // a null status means the process failed to spawn / was signalled — treat as failure.
  const code = r.status == null ? 1 : r.status;
  return { code, out, error: r.error };
}

// run `npm run <script>` inside the project dir. On win32 npm is npm.cmd and must go via
// the shell, so we use shell:true (the script name is a fixed literal, no injection surface).
function runNpm(script, cwd) {
  const r = spawnSync("npm", ["run", script], {
    cwd, encoding: "utf8", windowsHide: true, shell: process.platform === "win32",
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  const code = r.status == null ? 1 : r.status;
  return { code, out, error: r.error };
}

// does the project's package.json declare an experience:check script?
function hasExperienceScript(projectDir) {
  try {
    const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
    return Boolean(pkg.scripts && pkg.scripts["experience:check"]);
  } catch { return false; }
}

// pull the most informative one-line summary out of a tool's captured output (for the
// top-level recap). Prefers a line that starts with a verdict keyword, else the last line.
function summaryLine(out, prefer = /^(SUMMARY|PASS|FAIL|founder-experience)/) {
  const lines = String(out || "").split(/\r?\n/).filter((l) => l.trim());
  for (let i = lines.length - 1; i >= 0; i--) if (prefer.test(lines[i].trim())) return lines[i].trim();
  return lines.length ? lines[lines.length - 1].trim() : "(no output)";
}

function section(title, body) {
  console.log(`\n─── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}`);
  process.stdout.write(body.endsWith("\n") ? body : body + "\n");
}

function run() {
  const projectArg = opt("--project", process.cwd());
  const projectDir = resolve(projectArg);
  const telemetryDir = opt("--telemetry", null);
  const telemetryGlob = opt("--telemetry-glob", null);
  const skipExperience = argv.includes("--skip-experience");
  const proj = projectDir.split(/[\\/]/).filter(Boolean).pop();

  console.log(`\n═══ MILESTONE REPORT ═══  project=${proj}  (${new Date().toISOString()})`);
  console.log(`The post-milestone floor: is the system OPERATING (not just existing)?`);

  // 1) capability-health — DECISIVE (fail-closed) ----------------------------------------
  const cap = runNode(join(HERE, "capability-health.mjs"), ["--project", projectDir], HERE);
  section("1. CAPABILITY-HEALTH (decisive)", cap.out);
  const capOk = cap.code === 0;
  console.log(`→ capability-health exit ${cap.code} (${capOk ? "PASS" : "FAIL — regression/INERT"})`);

  // 2) agent-health — REPORTING ONLY (never fails the verdict) ----------------------------
  const agentArgs = ["--agents", join(projectDir, ".claude", "agents"),
    "--selections", join(projectDir, ".claude", "os", "telemetry", "agent-selections.jsonl")];
  if (telemetryDir) agentArgs.push("--telemetry", telemetryDir);
  const agent = runNode(join(HERE, "agent-health.mjs"), agentArgs, HERE);
  section("2. AGENT-HEALTH (reporting only)", agent.out);
  const agentSummary = summaryLine(agent.out, /^SUMMARY/);
  console.log(`→ agent-health: ${agentSummary}`);

  // 3) founder-experience — DECISIVE when it RUNS ----------------------------------------
  let expRan = false, expOk = false, expNote;
  if (skipExperience) {
    expNote = "founder-experience: SKIPPED (--skip-experience)";
  } else if (!hasExperienceScript(projectDir)) {
    expNote = "founder-experience: SKIPPED (no experience:check script in project)";
  } else if (!process.env.DATABASE_URL) {
    expNote = "founder-experience: SKIPPED (no DATABASE_URL / no experience:check)";
  } else {
    const exp = runNpm("experience:check", projectDir);
    expRan = true;
    expOk = exp.code === 0;
    section("3. FOUNDER-EXPERIENCE (decisive)", exp.out);
    expNote = `founder-experience exit ${exp.code} (${expOk ? "PASS" : "FAIL — a founder-facing surface is BROKEN"})`;
  }
  if (!expRan) section("3. FOUNDER-EXPERIENCE (decisive)", expNote);
  console.log(`→ ${expNote}`);

  // 4) skill-health — SKILL USAGE EVIDENCE — REPORTING ONLY (never fails the verdict) -----
  // The founder's standing requirement: every capability (skills included) must carry ADOPTION
  // EVIDENCE, not assertion. skill-health is app-side today (<project>/scripts/skill-health.mjs);
  // resolve it under --project. Absent → graceful skip with a logged note (like the cap-health CI
  // skip). UNMEASURED (no skill-selections log) is HONEST output, surfaced verbatim — never faked.
  let skillSummary;
  const skillHealthPath = resolveSkillHealthPath(projectDir);
  if (!skillHealthPath) {
    skillSummary = "skill-health: SKIPPED (no scripts/skill-health.mjs in project)";
    section("═══ SKILL USAGE EVIDENCE ═══", skillSummary);
  } else {
    const sk = runNode(skillHealthPath, skillHealthArgs(projectDir, telemetryGlob), projectDir);
    section("═══ SKILL USAGE EVIDENCE ═══", sk.out);
    // skill-health exits 2 on UNMEASURED (no selections log) — that is HONEST reporting, not a
    // milestone failure here (reporting-only). Surface whatever it said; never fake adoption.
    const unmeasured = /UNMEASURED/.test(sk.out) || sk.code === 2;
    skillSummary = unmeasured
      ? summaryLine(sk.out, /^UNMEASURED/) || "skill-health: UNMEASURED (no skill-selections log)"
      : summaryLine(sk.out, /^SUMMARY/);
    console.log(`→ skill-health (reporting only): ${skillSummary}`);
  }

  // OVERALL VERDICT ----------------------------------------------------------------------
  const verdict = overallVerdict({ capOk, expRan, expOk });
  console.log(`\n═══ OVERALL VERDICT: ${verdict} ═══`);
  console.log(`  capability-health: ${capOk ? "PASS" : "FAIL"}  (decisive)`);
  console.log(`  agent-health:      ${agentSummary}  (reporting only)`);
  console.log(`  founder-experience: ${expRan ? (expOk ? "PASS" : "FAIL") : "SKIPPED"}  (decisive when run)`);
  console.log(`  skill-health:      ${skillSummary}  (reporting only)`);
  if (verdict === "FAIL") {
    console.log(`FAIL-CLOSED: ${!capOk ? "capability-health regressed/INERT" : "experience:check failed"} — the system is NOT verified as operating.`);
    process.exit(1);
  }
  console.log(`PASS: the milestone floor is green — the system is verified as operating.`);
  process.exit(0);
}

function selfTest() {
  const cases = [
    { label: "cap ok, exp skipped → PASS", got: overallVerdict({ capOk: true, expRan: false }), want: "PASS" },
    { label: "cap ok, exp ran+passed → PASS", got: overallVerdict({ capOk: true, expRan: true, expOk: true }), want: "PASS" },
    { label: "cap FAIL (exp skipped) → FAIL", got: overallVerdict({ capOk: false, expRan: false }), want: "FAIL" },
    { label: "cap FAIL (exp passed) → FAIL", got: overallVerdict({ capOk: false, expRan: true, expOk: true }), want: "FAIL" },
    { label: "cap ok, exp ran+failed → FAIL", got: overallVerdict({ capOk: true, expRan: true, expOk: false }), want: "FAIL" },
  ];
  let fail = 0;
  const ok = (label, cond) => { if (!cond) fail++; console.error(`  ${cond ? "PASS" : "FAIL"}  ${label}`); };
  console.error(`milestone-report --self-test (prove the verdict logic + skill-usage-evidence wiring):`);
  for (const c of cases) { const pass = c.got === c.want; if (!pass) fail++; console.error(`  ${pass ? "PASS" : "FAIL"}  ${c.label} (got ${c.got}, want ${c.want})`); }

  // SKILL USAGE EVIDENCE wiring (section 4, reporting-only) -------------------------------
  // (a) the section is unconditionally emitted: the run() body contains the header literal.
  const selfSrc = readFileSync(fileURLToPath(import.meta.url), "utf8");
  ok("run() emits the '═══ SKILL USAGE EVIDENCE ═══' section header", selfSrc.includes('section("═══ SKILL USAGE EVIDENCE ═══"'));
  ok("skill-health is reporting-only (never an overallVerdict input)", !/overallVerdict\([^)]*skill/i.test(selfSrc));

  // (b) graceful skip: a project WITHOUT scripts/skill-health.mjs resolves to null (logged skip)
  const dir = mkdtempSync(join(tmpdir(), "milestone-st-"));
  ok("resolveSkillHealthPath → null when scripts/skill-health.mjs absent (graceful skip)", resolveSkillHealthPath(dir) === null);
  // and is FOUND when present
  mkdirSync(join(dir, "scripts"), { recursive: true });
  writeFileSync(join(dir, "scripts", "skill-health.mjs"), "// stub\n");
  const found = resolveSkillHealthPath(dir);
  ok("resolveSkillHealthPath → path when scripts/skill-health.mjs present", found === join(dir, "scripts", "skill-health.mjs"));

  // (c) the args wiring forwards the founder's selections/skills/artifacts (+ telemetry-glob when given)
  const baseArgs = skillHealthArgs(dir, null);
  ok("skillHealthArgs includes --selections skill-selections.jsonl", baseArgs.includes("--selections") && baseArgs.some((a) => a.endsWith("skill-selections.jsonl")));
  ok("skillHealthArgs includes --skills .claude/skills + --artifacts docs/verify", baseArgs.includes("--skills") && baseArgs.includes("--artifacts") && baseArgs.some((a) => a.endsWith(join("docs", "verify"))));
  ok("skillHealthArgs omits --telemetry-glob when none given", !baseArgs.includes("--telemetry-glob"));
  const globArgs = skillHealthArgs(dir, "C:/x/*/subagents");
  ok("skillHealthArgs forwards --telemetry-glob when given", globArgs.includes("--telemetry-glob") && globArgs.includes("C:/x/*/subagents"));
  rmSync(dir, { recursive: true, force: true });

  if (fail) { console.error(`FAIL: milestone-report self-test failed on ${fail} case(s) — the milestone gate cannot be trusted.`); process.exit(1); }
  console.error(`PASS: overallVerdict() fail-closed logic holds AND skill-usage-evidence section is wired (graceful-skip + reporting-only).`);
  process.exit(0);
}

// import-safe: only dispatch when invoked as the entry point, not on `import { overallVerdict }`
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) { if (argv.includes("--self-test")) selfTest(); else run(); }
