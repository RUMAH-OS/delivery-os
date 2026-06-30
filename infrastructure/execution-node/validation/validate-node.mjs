// =============================================================================
// infrastructure/execution-node/validation/validate-node.mjs
//   — the LIVE-NODE objective-evidence harness (the END-TO-END acceptance layer above verify-health.sh).
// =============================================================================
// The instrument that proves Neo operates as Execution Node 1 AFTER the founder has installed it
// (FOUNDER-INSTALLATION-GUIDE §11 — the 9-box acceptance checklist). Where bootstrap/verify-health.sh runs the
// ON-NODE subsystem checks (config-doctor, /ready, /health, platform-health, heartbeat, supervisor-loaded),
// THIS harness runs the END-TO-END acceptance: it exercises and RECORDS each of the 9 acceptance boxes from
// the FOUNDER'S LAPTOP over the tailnet (objective probes) or marks the box [FOUNDER-ATTEST] when the proof
// genuinely needs the founder's eyes (a real page to the phone, a real reboot). It emits one objective-evidence
// report (VALIDATION-EVIDENCE.md shape) the founder + PO sign off, and a go/no-go gate (all 9 green = "EI
// operational" = the trigger to start Sprint 5.3).
//
// POSITION (the Repository & Dependency Principle): this lives under infrastructure/ ⇒ the `adapters` layer
// (architecture.config.json). It is validation TOOLING — it consumes the Core Health-Emission CONTRACT by SHAPE
// only (it keys on the HTTP status + the report `verdict` the supervisor already computed via the contract's
// `isReady`; it NEVER re-derives "is it healthy"). It imports NOTHING outward: zero npm deps, Node built-ins
// only, no Core internal, no infra SDK. The boundary guard classifies it `adapters` and finds it clean.
//
// HARD INVARIANTS (the point of the sprint — this is an INSTRUMENT, not a FAKER):
//   • OBJECTIVE OR FOUNDER-ATTEST, never auto-green. A check that cannot be objectively probed from the founder's
//     machine (a real page to the phone, a real physical reboot) is [FOUNDER-ATTEST]: the harness PROMPTS, records
//     the founder's yes/no, and leaves the box NOT-GREEN (AWAITING-ATTEST) until the founder confirms. It is never
//     silently passed.
//   • INJECTABLE probes — fetch (tailnet /ready, status page) + gh (GitHub Actions API) + exec (local gates) +
//     clock are all injected. The --self-test runs with NO real network, NO real gh, NO real exec, NO real clock,
//     and proves each check's PASS branch (green probe) AND FAIL branch (red probe) fire with the right evidence,
//     AND that the FOUNDER-ATTEST checks prompt rather than auto-pass.
//   • NO SECRET LITERAL — gh uses its own ambient auth; the tailnet/status-page GETs carry no credential; every
//     knob is env/flag. Nothing is baked here. (Tokens via env only.)
//   • READ-ONLY / DESTRUCTIVE-BY-FOUNDER — the harness only OBSERVES. The destructive acceptance steps (stop the
//     supervisor for the synthetic miss, hard power-cycle for the cold-boot test) are the founder's hands per the
//     RUNBOOK; the harness records the objective post-conditions + the founder attestation, it never reboots Neo.
//
// USAGE:
//   node validate-node.mjs                         # run all 9 boxes, print the VALIDATION-EVIDENCE.md report
//   node validate-node.mjs --attest watchdog-pages=yes --attest reboot-survival=yes
//   node validate-node.mjs --out VALIDATION-EVIDENCE.md     # also write the report to a file
//   node validate-node.mjs --json                  # machine-readable result
//   node validate-node.mjs --self-test             # offline proof: PASS + FAIL branches, attest-prompts (no net)
//
// EXIT: 0 = GO (all 9 green) · 1 = NO-GO (a real FAIL) · 3 = INCOMPLETE (a box awaits founder attestation) ·
//       2 = config/usage error.  (--self-test: 0 = all proofs hold, 1 = a proof broke.)
// =============================================================================

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { execFile } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @typedef {import("../../../templates/governance-engine/health-contract.ts").PlatformHealthReport} PlatformHealthReport
 * The Core contract type — referenced for the SHAPE only (this is a runtime-pure .mjs; the type-checker resolves
 * it, the runtime NEVER imports a Core file). The harness keys on `verdict` exactly as the contract's `isReady`
 * does (verdict !== "down"), so it never re-derives "is it healthy".
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// repo root = …/delivery-os (validation is at infrastructure/execution-node/validation/).
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const DEFAULT_TIMEOUT_MS = 8000;

// ── the verdict vocabulary ───────────────────────────────────────────────────────────────────────────────────
// PASS / FAIL          — an OBJECTIVE box, decided by its probe.
// ATTESTED-PASS/-FAIL  — a FOUNDER-ATTEST box, decided by the recorded founder yes/no.
// AWAITING-ATTEST      — a FOUNDER-ATTEST box with no recorded attestation yet — NOT GREEN (the founder must look).
const GREEN = new Set(["PASS", "ATTESTED-PASS"]);
const isGreen = (v) => GREEN.has(v);

// =============================================================================
// THE 9 ACCEPTANCE BOXES (FOUNDER-INSTALLATION-GUIDE §11).
// Each declares: id · box letter · title · tag (OBJECTIVE | FOUNDER-ATTEST) · proves · and an `observe(ctx)` that
// returns { ok: boolean|null, evidence: string }. For OBJECTIVE boxes `ok` decides PASS/FAIL. For FOUNDER-ATTEST
// boxes `observe` gathers any OBJECTIVE ASSIST evidence and returns ok=null (it cannot self-determine); the box is
// decided by the founder's recorded attestation, and the harness emits the box's `question` as a prompt.
// =============================================================================
export const CHECKS = [
  // ── (a) the runner executes a real build ──────────────────────────────────────────────────────────────────
  {
    id: "runner-build",
    box: "a",
    title: "Runner executes a build",
    tag: "OBJECTIVE",
    proves:
      "A PR routed to Neo (vars.CI_RUNNER=[self-hosted,neo]) ran `ci` ON Neo, went green, and the ephemeral runner re-registered (idle/online).",
    async observe(ctx) {
      if (!ctx.repo) return notConfigured("DOS_GH_REPO");
      const runners = await ctx.gh(`repos/${ctx.repo}/actions/runners`);
      if (!runners.ok) return { ok: false, evidence: `gh actions/runners failed: ${runners.error}` };
      const neoRunner = (runners.json?.runners || []).find((r) => runnerLabels(r).includes("neo"));
      const reRegistered = !!neoRunner && neoRunner.status === "online";
      const run = await latestSuccessfulRun(ctx, ctx.ciWorkflow);
      if (!run.ok) return { ok: false, evidence: `no green ${ctx.ciWorkflow} run on Neo: ${run.error}` };
      const jobs = await jobsForRun(ctx, run.run.id);
      if (!jobs.ok) return { ok: false, evidence: `gh jobs for run #${run.run.id} failed: ${jobs.error}` };
      const neoJob = jobs.jobs.find((j) => jobRanOnNeo(j) && j.conclusion === "success");
      const ok = !!neoJob && reRegistered;
      const ev = neoJob
        ? `ci run #${run.run.id} ('${run.run.head_branch}') job '${neoJob.name}' SUCCESS on runner '${neoJob.runner_name || "neo"}'`
        : `no successful ci job ran on a Neo runner in run #${run.run.id}`;
      const reEv = reRegistered
        ? `; ephemeral runner '${neoRunner.name}' online/idle (re-registered)`
        : `; NO Neo runner online (ephemeral re-register not confirmed)`;
      return { ok, evidence: ev + reEv };
    },
  },

  // ── (b) CI/CD round-trips with the machine_probe showing node: neo-node2 (PHYSICAL author≠verifier) ────────
  {
    id: "cicd-roundtrip",
    box: "b",
    title: "CI/CD round-trips — machine_probe node: neo-node2 (physical author≠verifier)",
    tag: "OBJECTIVE",
    proves:
      "A required check ran on Neo and the job log records `node: neo-node2` — the verify physically happened on hardware the author (Windows) does not control.",
    async observe(ctx) {
      if (!ctx.repo) return notConfigured("DOS_GH_REPO");
      const run = await latestSuccessfulRun(ctx, ctx.ciWorkflow);
      if (!run.ok) return { ok: false, evidence: `no green ${ctx.ciWorkflow} run: ${run.error}` };
      const jobs = await jobsForRun(ctx, run.run.id);
      if (!jobs.ok) return { ok: false, evidence: `gh jobs failed: ${jobs.error}` };
      const neoJob = jobs.jobs.find((j) => jobRanOnNeo(j));
      if (!neoJob) return { ok: false, evidence: `run #${run.run.id} had no job on a Neo runner (verify did not move to Neo)` };
      const log = await ctx.ghLog(neoJob.id);
      if (!log.ok) return { ok: false, evidence: `gh job-log fetch failed: ${log.error}` };
      const marker = /\bnode:\s*neo-node2\b/i.test(log.text || "");
      return {
        ok: marker,
        evidence: marker
          ? `job '${neoJob.name}' (#${neoJob.id}) ran on Neo; machine_probe log line 'node: neo-node2' present — physical author≠verifier`
          : `job '${neoJob.name}' log MISSING the 'node: neo-node2' machine_probe marker — author≠verifier NOT physically proven`,
      };
    },
  },

  // ── (c) a deploy completes, token-attributed, with a BINDING post-deploy verify ────────────────────────────
  {
    id: "deploy-attributed",
    box: "c",
    title: "Deploy completes — token-attributed, binding post-deploy verify",
    tag: "OBJECTIVE",
    proves:
      "Merge-to-main ran deploy.yml ON Neo (token-attributed, no actor click) and the BINDING post-deploy-verify step went green (no continue-on-error).",
    async observe(ctx) {
      if (!ctx.repo) return notConfigured("DOS_GH_REPO");
      const run = await latestSuccessfulRun(ctx, ctx.deployWorkflow);
      if (!run.ok) return { ok: false, evidence: `no green ${ctx.deployWorkflow} run: ${run.error}` };
      const jobs = await jobsForRun(ctx, run.run.id);
      if (!jobs.ok) return { ok: false, evidence: `gh jobs failed: ${jobs.error}` };
      const neoJob = jobs.jobs.find((j) => jobRanOnNeo(j) && j.conclusion === "success");
      if (!neoJob) return { ok: false, evidence: `deploy run #${run.run.id} did not complete on a Neo runner` };
      const verifyStep = (neoJob.steps || []).find((s) => /post.?deploy.?verify/i.test(s.name || ""));
      const verifyBindingGreen = !!verifyStep && verifyStep.conclusion === "success";
      // token-attributed: the deploy ran headless on the self-hosted Neo runner on a push to the default branch,
      // i.e. the VERCEL_TOKEN executor ran it — not an actor-dispatched click.
      const tokenAttributed = run.run.event === "push" && /^(main|master)$/.test(run.run.head_branch || "");
      const ok = verifyBindingGreen && tokenAttributed;
      let ev = `deploy run #${run.run.id} ('${run.run.head_branch}', event=${run.run.event}) SUCCESS on runner '${neoJob.runner_name || "neo"}'`;
      ev += verifyStep
        ? `; step '${verifyStep.name}' ${verifyStep.conclusion} (binding — a non-success would have failed the job)`
        : `; NO post-deploy-verify step found (binding verify absent)`;
      if (!tokenAttributed) ev += `; NOT token-attributed (expected a push to the default branch)`;
      return { ok, evidence: ev };
    },
  },

  // ── (d) heartbeat fresh + /ready green (folds heartbeat-fresh per the health contract) ─────────────────────
  {
    id: "heartbeat-ready",
    box: "d",
    title: "Heartbeat fresh — /ready green over the tailnet",
    tag: "OBJECTIVE",
    proves:
      "Neo's /ready answers 200 verdict ok over the tailnet — which folds heartbeat-freshness (tick_seq advancing, last_tick_at < threshold) per the Health-Emission contract; the /ready-gated Healthchecks push therefore fires.",
    async observe(ctx) {
      const url = readyUrl(ctx);
      const res = await ctx.httpGet(url);
      if (!res.ok) {
        return { ok: false, evidence: `GET ${url} → ${res.status ? `HTTP ${res.status}` : res.error} (503 = verdict down; unreachable = not on the tailnet / node down)` };
      }
      const report = parseJson(res.body);
      const verdict = report?.verdict ?? "unknown";
      const ok = verdict === "ok";
      const hb = heartbeatDetail(report);
      return {
        ok,
        evidence: ok
          ? `GET ${url} → 200, verdict=ok${hb ? `; ${hb}` : ""}; /ready folds heartbeat-fresh ⇒ the /ready-gated HC push is firing (confirm cadence on the Healthchecks dashboard)`
          : `GET ${url} → 200 but verdict='${verdict}' (expected ok — a critical subsystem is not provably healthy)`,
      };
    },
  },

  // ── (e) the off-Neo watchdog pages on a synthetic miss ─────────────────────────────────────────────────────
  {
    id: "watchdog-pages",
    box: "e",
    title: "Off-Neo watchdog pages on a synthetic miss",
    tag: "FOUNDER-ATTEST",
    proves:
      "The §9.3 synthetic miss (supervisor stopped past grace) converted silence into a PAGE on BOTH Healthchecks AND the Windows pull, and the weekly all-green digest resumed on restore. A real page to a real phone — only the founder can witness it.",
    question:
      "During the §9.3 synthetic miss (you stopped com.deliveryos.supervisor and waited past the grace window), did you receive the page on BOTH Healthchecks AND the Windows pull-watchdog, and did the all-green digest resume after you restored the supervisor? (yes/no)",
    async observe(ctx) {
      // OBJECTIVE ASSIST (not the proof): prove the off-Neo pull-watchdog's miss-fires/recovers LOGIC is correct
      // offline. This strengthens the evidence; it does NOT substitute for the live page (the founder attests that).
      const r = await ctx.exec("node", ["monitoring/pull-watchdog.mjs", "--self-test"]);
      const assist = r.code === 0
        ? "objective assist: pull-watchdog --self-test PASSED (miss-fires-once / de-dupes / recovers / 503-is-a-miss logic proven offline)"
        : `objective assist: pull-watchdog --self-test exit ${r.code} (the alarm LOGIC self-proof did not pass — investigate before trusting the live page)`;
      return { ok: null, evidence: assist };
    },
  },

  // ── (f) the off-Neo status surface renders ─────────────────────────────────────────────────────────────────
  {
    id: "status-page",
    box: "f",
    title: "Off-Neo status surface renders",
    tag: "OBJECTIVE",
    proves:
      "The off-Neo status page loads and shows neo-node2 with a verdict — the single glanceable surface. (Its survival when Neo is DOWN is exercised by the founder in §10.2 / the cold-boot box; that it reads the durable bus, not Neo, is why.)",
    async observe(ctx) {
      if (!ctx.statusPageUrl) return notConfigured("DOS_STATUS_PAGE_URL");
      const res = await ctx.httpGet(ctx.statusPageUrl);
      if (!res.ok) {
        return { ok: false, evidence: `GET ${ctx.statusPageUrl} → ${res.status ? `HTTP ${res.status}` : res.error} (the off-Neo status page is not reachable)` };
      }
      const body = String(res.body || "");
      const showsNode = body.includes(ctx.nodeId);
      const showsVerdict = /\b(ok|degraded|down|green|red|amber)\b/i.test(body);
      const ok = showsNode && showsVerdict;
      return {
        ok,
        evidence: ok
          ? `GET ${ctx.statusPageUrl} → 200; page renders and surfaces '${ctx.nodeId}' with a verdict word`
          : `GET ${ctx.statusPageUrl} → 200 but ${showsNode ? "no verdict word" : `does not surface '${ctx.nodeId}'`} (status surface incomplete)`,
      };
    },
  },

  // ── (g) the Delete Test passes (host-agnostic, by construction) ────────────────────────────────────────────
  {
    id: "delete-test",
    box: "g",
    title: "The Delete Test passes",
    tag: "OBJECTIVE",
    proves:
      "rm -rf the Execution-Infra adapter ⇒ Core still typechecks and the contracts still resolve — the operational definition of host-agnostic. Runs LOCALLY (no node needed).",
    async observe(ctx) {
      const r = await ctx.exec("node", ["scripts/delete-test.mjs"]);
      return {
        ok: r.code === 0,
        evidence:
          r.code === 0
            ? "node scripts/delete-test.mjs → exit 0: Core builds (tsc -p tsconfig.core.json) + Core self-tests green with the adapter deleted"
            : `node scripts/delete-test.mjs → exit ${r.code}: a Core build/self-test broke with the adapter deleted (boundary leak). ${tail(r.stderr || r.stdout)}`,
      };
    },
  },

  // ── (h) the dependency-direction gate is green (Runtime infra-independent) ─────────────────────────────────
  {
    id: "boundary-gate",
    box: "h",
    title: "The dependency-direction gate is green",
    tag: "OBJECTIVE",
    proves:
      "No Core file imports anything under infrastructure/ or an infra SDK — the Runtime is infrastructure-independent. Runs LOCALLY (static, free).",
    async observe(ctx) {
      const r = await ctx.exec("node", ["scripts/arch-boundary-guard.mjs"]);
      return {
        ok: r.code === 0,
        evidence:
          r.code === 0
            ? "node scripts/arch-boundary-guard.mjs → exit 0: CLEAN — dependencies flow inward (adapter → contract → core)"
            : `node scripts/arch-boundary-guard.mjs → exit ${r.code}: a boundary violation (Core reaching outward). ${tail(r.stdout || r.stderr)}`,
      };
    },
  },

  // ── (i) the cold-boot / reboot-survival test passes ────────────────────────────────────────────────────────
  {
    id: "reboot-survival",
    box: "i",
    title: "Cold-boot / reboot-survival test",
    tag: "FOUNDER-ATTEST",
    proves:
      "Planned reboot (fdesetup authrestart) recovers unattended; the unplanned hard power-cycle pages within grace then recovers after login; a no-GUI-login boot reads System-keychain secrets with config-doctor passing (HOST-3 / NEO-OPS-06 §3.5). A real physical reboot — only the founder can perform and witness it.",
    question:
      "Did the cold-boot test pass — (1) PLANNED `sudo fdesetup authrestart` recovered to /ready green with NO human after the command; (2) UNPLANNED hard power-cycle (FileVault locked) paged within grace, then recovered after you logged in; (3) a no-GUI-login boot read secrets from the SYSTEM keychain and config-doctor --enforce passed? (yes/no)",
    async observe(ctx) {
      // OBJECTIVE ASSIST: if Neo is up now, record that /ready is green (a necessary post-condition of recovery).
      // This does NOT prove "recovered unattended after a real reboot" — that is the founder's attestation.
      const url = readyUrl(ctx);
      const res = await ctx.httpGet(url);
      const ready = res.ok && parseJson(res.body)?.verdict === "ok";
      return {
        ok: null,
        evidence: ready
          ? `objective assist: ${url} is green now (a necessary post-condition of a successful recovery; 'recovered unattended' is the founder's attestation)`
          : `objective assist: ${url} not green right now (${res.status ? `HTTP ${res.status}` : res.error}) — confirm Neo is the post-reboot subject before attesting`,
      };
    },
  },
];

// ── GitHub Actions API helpers (built on the injected ctx.gh) ──────────────────────────────────────────────────
function notConfigured(envName) {
  return { ok: false, evidence: `${envName} not set — this objective box cannot be probed; configure it (RUNBOOK §prerequisites) or it stays NO-GO.` };
}
function runnerLabels(r) {
  return (r?.labels || []).map((l) => String(l?.name ?? l).toLowerCase());
}
function jobRanOnNeo(job) {
  const labels = (job?.labels || []).map((l) => String(l).toLowerCase());
  return labels.includes("neo") || /neo/i.test(String(job?.runner_name || ""));
}
async function latestSuccessfulRun(ctx, workflowFile) {
  const r = await ctx.gh(`repos/${ctx.repo}/actions/workflows/${workflowFile}/runs?per_page=20&status=success`);
  if (!r.ok) return { ok: false, error: r.error };
  const runs = r.json?.workflow_runs || [];
  if (!runs.length) return { ok: false, error: `no successful runs of ${workflowFile}` };
  return { ok: true, run: runs[0] };
}
async function jobsForRun(ctx, runId) {
  const r = await ctx.gh(`repos/${ctx.repo}/actions/runs/${runId}/jobs`);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, jobs: r.json?.jobs || [] };
}

// ── report-shape helpers (the Health-Emission contract, by shape only) ──────────────────────────────────────────
function parseJson(body) {
  try {
    return JSON.parse(String(body));
  } catch {
    return undefined;
  }
}
function heartbeatDetail(report) {
  if (!report || !Array.isArray(report.subsystems)) return "";
  const hb = report.subsystems.find((s) => /heartbeat|tick/i.test(s.name || ""));
  return hb ? `heartbeat subsystem '${hb.name}' = ${hb.status}${hb.detail ? ` (${hb.detail})` : ""}` : "";
}
function readyUrl(ctx) {
  return `${ctx.scheme}://${ctx.neoHost}:${ctx.healthPort}/ready`;
}
function tail(s, n = 240) {
  const t = String(s || "").trim();
  return t.length > n ? "…" + t.slice(-n) : t;
}

// =============================================================================
// THE HARNESS — fold each box's observation into a verdict + an evidence line.
// =============================================================================
/**
 * @param {object} ctx       the injected probe context (gh / httpGet / ghLog / exec / now + config).
 * @param {object} [opts]
 * @param {Record<string,"yes"|"no">} [opts.attest]   recorded founder attestations, keyed by check id.
 * @param {(msg:string)=>void} [opts.prompt]          where founder-attest questions are emitted (default: stderr).
 * @returns {Promise<{ results: Array, gate: "GO"|"NO-GO"|"INCOMPLETE", at: string }>}
 */
export async function runValidation(ctx, opts = {}) {
  const attest = opts.attest || {};
  const prompt = opts.prompt || ((m) => process.stderr.write(m + "\n"));
  const at = (ctx.now ? ctx.now() : new Date()).toISOString();
  const results = [];

  for (const check of CHECKS) {
    let obs;
    try {
      obs = await check.observe(ctx);
    } catch (e) {
      obs = { ok: false, evidence: `probe threw: ${e?.message ?? e}` };
    }
    let verdict;
    let evidence = obs.evidence || "";
    if (check.tag === "OBJECTIVE") {
      verdict = obs.ok === true ? "PASS" : "FAIL";
    } else {
      // FOUNDER-ATTEST: emit the question (PROMPT) and decide ONLY by the recorded attestation — never auto-pass.
      prompt(`[ATTEST ${check.id}] ${check.question}`);
      const a = attest[check.id];
      if (a === "yes") verdict = "ATTESTED-PASS";
      else if (a === "no") verdict = "ATTESTED-FAIL";
      else verdict = "AWAITING-ATTEST";
      const note =
        verdict === "AWAITING-ATTEST"
          ? "[founder-attest] AWAITING founder confirmation — NOT GREEN until attested"
          : `[founder-attest] founder attested: ${a}`;
      evidence = evidence ? `${evidence}  ·  ${note}` : note;
    }
    results.push({
      id: check.id,
      box: check.box,
      title: check.title,
      tag: check.tag,
      proves: check.proves,
      verdict,
      green: isGreen(verdict),
      evidence,
    });
  }

  const fails = results.filter((r) => r.verdict === "FAIL" || r.verdict === "ATTESTED-FAIL");
  const awaiting = results.filter((r) => r.verdict === "AWAITING-ATTEST");
  const gate = fails.length ? "NO-GO" : awaiting.length ? "INCOMPLETE" : "GO";
  return { results, gate, at };
}

// =============================================================================
// THE VALIDATION-EVIDENCE.md REPORT — the single objective-evidence artifact the founder + PO sign off.
// =============================================================================
export function renderEvidenceMarkdown({ results, gate, at }, ctx) {
  const verdictIcon = (r) => (r.green ? "GREEN" : r.verdict === "AWAITING-ATTEST" ? "AWAIT" : "RED");
  const rows = results
    .map((r) => `| ${r.box} | ${escapePipe(r.title)} | ${r.tag} | **${verdictIcon(r)}** \`${r.verdict}\` | ${escapePipe(r.evidence)} |`)
    .join("\n");
  const gateLine =
    gate === "GO"
      ? "**GO — all 9 acceptance boxes are GREEN. Execution Infrastructure is OPERATIONAL. This is the trigger to start Sprint 5.3 (Slack control surface).**"
      : gate === "NO-GO"
        ? "**NO-GO — at least one box is RED. Neo is INSTALLED, not ACCEPTED. Fix per the box evidence and the RUNBOOK rollback, then re-run.**"
        : "**INCOMPLETE — every objective box is green but a FOUNDER-ATTEST box awaits the founder's confirmation. Run the §9.3 / cold-boot steps, then re-run with `--attest <id>=yes|no`. Do not sign off until GO.**";
  const greenCount = results.filter((r) => r.green).length;

  return `# Neo — Execution Node 1: VALIDATION EVIDENCE

> Objective-evidence record for the FOUNDER-INSTALLATION-GUIDE §11 nine-box acceptance. Produced by
> \`infrastructure/execution-node/validation/validate-node.mjs\` — the END-TO-END acceptance layer above
> \`bootstrap/verify-health.sh\`. **Until every box is GREEN, Neo is installed, not accepted.**

- **Generated at:** ${at}
- **Node under test:** \`${ctx.nodeId}\` (host \`${ctx.neoHost}:${ctx.healthPort}\`, scheme \`${ctx.scheme}\`)
- **Repo (GitHub Actions):** \`${ctx.repo || "(DOS_GH_REPO not set — the GitHub-Actions boxes cannot be objectively probed)"}\`
- **Status page:** \`${ctx.statusPageUrl || "(DOS_STATUS_PAGE_URL not set)"}\`
- **Green:** ${greenCount}/9
- **GATE:** ${gateLine}

## The 9 acceptance boxes

| Box | Acceptance criterion | Probe | Verdict | Objective evidence (what was observed) |
|---|---|---|---|---|
${rows}

## What each verdict means

- \`PASS\` / \`ATTESTED-PASS\` — **GREEN.** Objectively observed, or the founder attested a witnessed result.
- \`FAIL\` / \`ATTESTED-FAIL\` — **RED.** A probe observed a failure, or the founder attested it did not hold.
- \`AWAITING-ATTEST\` — **NOT GREEN.** A FOUNDER-ATTEST box (a real page / a real reboot) that the harness will
  not auto-pass; it stays open until the founder records \`--attest <id>=yes|no\`.

## Probe classification (objective vs founder-attest)

${results.map((r) => `- **(${r.box}) ${r.title}** — ${r.tag}. ${r.proves}`).join("\n")}

## Sign-off (author≠verifier)

This evidence is produced by the harness (the author). It is independently verified by the PO and accepted by the
founder. **No box is signed off on trust — each cites the objective observation or the founder's attestation above.**

- [ ] **Founder** — I attest the FOUNDER-ATTEST boxes (the live page, the physical reboot) as recorded above: ____________________  (date: __________)
- [ ] **Project Owner (independent VERIFY)** — I re-ran this harness, reviewed every evidence line against the box criterion, and confirm the gate: ____________________  (date: __________)

*Generated by validate-node.mjs. It OBSERVES only — it never reboots Neo, never stops a daemon, never sends. The
destructive acceptance steps are the founder's hands (RUNBOOK); this records their objective post-conditions + the
founder attestation.*
`;
}
function escapePipe(s) {
  return String(s).replace(/\|/g, "\\|").replace(/\n/g, " ");
}

// =============================================================================
// THE DEFAULT (REAL) PROBE CONTEXT — fetch (tailnet/status) · gh (GitHub API) · exec (local gates). Injected away
// in the self-test. Reads ONLY env/flags; carries NO secret (gh uses its own ambient auth).
// =============================================================================
function configFromEnv(env = process.env) {
  return {
    repo: env.DOS_GH_REPO || "", // owner/repo — required for the GitHub-Actions boxes (a, b, c)
    nodeId: env.DOS_NODE_ID || "neo-node2",
    neoHost: env.DOS_NEO_MAGICDNS || "neo",
    healthPort: Number(env.DOS_HEALTH_PORT || "8787"),
    scheme: env.DOS_HEALTH_SCHEME || "http",
    statusPageUrl: env.DOS_STATUS_PAGE_URL || "",
    ciWorkflow: env.DOS_CI_WORKFLOW || "ci.yml",
    deployWorkflow: env.DOS_DEPLOY_WORKFLOW || "deploy.yml",
    timeoutMs: Number(env.DOS_VALIDATE_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS)),
  };
}

/** A read-only GET over the tailnet / to the status page. Never throws — returns a normalized result. */
function defaultHttpGet(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((done) => {
    let target;
    try {
      target = new URL(url);
    } catch {
      done({ ok: false, error: `invalid url: ${url}` });
      return;
    }
    const doRequest = target.protocol === "https:" ? httpsRequest : httpRequest;
    const req = doRequest(target, { method: "GET", timeout: timeoutMs }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => {
        if (body.length < 256 * 1024) body += c;
      });
      res.on("end", () => done({ ok: (res.statusCode ?? 0) === 200, status: res.statusCode ?? 0, body }));
    });
    req.on("error", (e) => done({ ok: false, error: `unreachable: ${e?.message ?? e}` }));
    req.on("timeout", () => {
      req.destroy();
      done({ ok: false, error: `timeout after ${timeoutMs}ms` });
    });
    req.end();
  });
}

/** Run `gh api <path>` and parse JSON. gh carries its OWN ambient auth — no token is read or embedded here. */
function defaultGh(path, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((done) => {
    execFile("gh", ["api", path], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return done({ ok: false, error: tail(stderr || err.message) });
      done({ ok: true, json: parseJson(stdout) });
    });
  });
}
/** Fetch a job's raw log text via gh (for the machine_probe marker). */
function defaultGhLog(jobId, repo, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((done) => {
    execFile("gh", ["api", `repos/${repo}/actions/jobs/${jobId}/logs`], { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return done({ ok: false, error: tail(stderr || err.message) });
      done({ ok: true, text: stdout });
    });
  });
}
/** Run a local gate (delete-test / arch-boundary-guard / pull-watchdog self-test) from the repo root. */
function defaultExec(cmd, args, timeoutMs = 180000) {
  return new Promise((done) => {
    execFile(cmd, args, { cwd: REPO_ROOT, timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      done({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout, stderr });
    });
  });
}

function realContext(env = process.env) {
  const cfg = configFromEnv(env);
  return {
    ...cfg,
    now: () => new Date(),
    httpGet: (url) => defaultHttpGet(url, cfg.timeoutMs),
    gh: (path) => defaultGh(path, cfg.timeoutMs),
    ghLog: (jobId) => defaultGhLog(jobId, cfg.repo, cfg.timeoutMs),
    exec: (cmd, args) => defaultExec(cmd, args),
  };
}

// =============================================================================
// CLI
// =============================================================================
function parseArgs(argv) {
  const opts = { attest: {}, out: null, json: false, selfTest: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") opts.selfTest = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--out") opts.out = argv[++i];
    else if (a === "--attest") {
      const kv = argv[++i] || "";
      const eq = kv.indexOf("=");
      if (eq > 0) opts.attest[kv.slice(0, eq)] = kv.slice(eq + 1).toLowerCase() === "yes" ? "yes" : "no";
    } else if (a === "-h" || a === "--help") opts.help = true;
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    process.stdout.write(
      "validate-node — the live-node objective-evidence harness (FOUNDER-INSTALLATION-GUIDE §11)\n" +
        "  node validate-node.mjs [--attest id=yes|no ...] [--out FILE] [--json] [--self-test]\n",
    );
    return 0;
  }
  if (opts.selfTest) return selfTest();

  const ctx = realContext();
  const run = await runValidation(ctx, { attest: opts.attest });
  const md = renderEvidenceMarkdown(run, ctx);

  if (opts.json) {
    process.stdout.write(JSON.stringify(run, null, 2) + "\n");
  } else {
    process.stdout.write(md + "\n");
  }
  if (opts.out) {
    mkdirSync(dirname(resolve(opts.out)), { recursive: true });
    writeFileSync(resolve(opts.out), md);
    process.stderr.write(`\n[validate-node] evidence written → ${resolve(opts.out)}\n`);
  }
  process.stderr.write(`\n[validate-node] GATE: ${run.gate} (${run.results.filter((r) => r.green).length}/9 green)\n`);
  return run.gate === "GO" ? 0 : run.gate === "NO-GO" ? 1 : 3;
}

// =============================================================================
// THE OFFLINE SELF-TEST — PASS branch (green probes) + FAIL branch (red probes) + the FOUNDER-ATTEST prompt
// behaviour, all with INJECTED gh/httpGet/ghLog/exec/clock. NO real network, gh, exec, or clock.
// =============================================================================
function selfTest() {
  let failures = 0;
  const check = (name, cond, detail = "") => {
    if (cond) console.log(`  PASS  ${name}${detail ? "  — " + detail : ""}`);
    else {
      console.error(`  FAIL  ${name}${detail ? "  — " + detail : ""}`);
      failures += 1;
    }
  };
  const baseCfg = {
    repo: "RUMAH-OS/delivery-os",
    nodeId: "neo-node2",
    neoHost: "neo",
    healthPort: 8787,
    scheme: "http",
    statusPageUrl: "https://neo-status.example.vercel.app",
    ciWorkflow: "ci.yml",
    deployWorkflow: "deploy.yml",
    now: () => new Date("2026-06-30T12:00:00.000Z"),
  };

  // ── GREEN injected probes — every objective box should observe ok ────────────────────────────────────────
  const ghGreen = async (path) => {
    if (path.includes("/actions/runners")) return { ok: true, json: { runners: [{ name: "neo-ephemeral-7", status: "online", labels: [{ name: "self-hosted" }, { name: "neo" }] }] } };
    if (path.includes("workflows/ci.yml/runs")) return { ok: true, json: { workflow_runs: [{ id: 111, head_branch: "feat/x", event: "pull_request", conclusion: "success" }] } };
    if (path.includes("workflows/deploy.yml/runs")) return { ok: true, json: { workflow_runs: [{ id: 222, head_branch: "main", event: "push", conclusion: "success" }] } };
    if (path.includes("/runs/111/jobs")) return { ok: true, json: { jobs: [{ id: 1111, name: "ci", conclusion: "success", runner_name: "neo", labels: ["self-hosted", "neo"], steps: [{ name: "machine_probe", conclusion: "success" }] }] } };
    if (path.includes("/runs/222/jobs")) return { ok: true, json: { jobs: [{ id: 2222, name: "deploy", conclusion: "success", runner_name: "neo", labels: ["self-hosted", "neo"], steps: [{ name: "supabase migration up", conclusion: "success" }, { name: "post-deploy-verify", conclusion: "success" }] }] } };
    return { ok: false, error: `unmocked gh path: ${path}` };
  };
  const ghLogGreen = async () => ({ ok: true, text: "2026-06-30T12:00:00Z machine_probe: node: neo-node2 arch=arm64 runner=self-hosted\nok\n" });
  const httpGreen = async (url) => {
    if (url.includes("/ready")) return { ok: true, status: 200, body: JSON.stringify({ service: "neo-node2", verdict: "ok", ok: true, checkedAt: "2026-06-30T12:00:00Z", subsystems: [{ name: "engine-heartbeat", status: "ok", critical: true, detail: "tick_seq=4821 fresh<60s" }] }) };
    return { ok: true, status: 200, body: `<html>node neo-node2 verdict ok green</html>` };
  };
  const execGreen = async () => ({ code: 0, stdout: "CLEAN / exit 0", stderr: "" });

  const greenCtx = { ...baseCfg, gh: ghGreen, ghLog: ghLogGreen, httpGet: httpGreen, exec: execGreen };

  // ── RED injected probes — every objective box should observe a failure ───────────────────────────────────
  const ghRed = async (path) => {
    if (path.includes("/actions/runners")) return { ok: true, json: { runners: [] } }; // no Neo runner re-registered
    if (path.includes("/runs")) return { ok: false, error: "no successful runs" };
    return { ok: false, error: "gh failed" };
  };
  const ghLogRed = async () => ({ ok: true, text: "build started\nbuild finished\n(no machine_probe marker)\n" });
  const httpRed = async (url) => {
    if (url.includes("/ready")) return { ok: false, status: 503, body: JSON.stringify({ verdict: "down" }) };
    return { ok: false, error: "unreachable: ECONNREFUSED" };
  };
  const execRed = async () => ({ code: 1, stdout: "", stderr: "VIOLATION — a Core file imported infrastructure/..." });

  const redCtx = { ...baseCfg, gh: ghRed, ghLog: ghLogRed, httpGet: httpRed, exec: execRed };

  return (async () => {
    console.log("validate-node self-test — PASS branch (green probes) + FAIL branch (red probes) + attest prompts\n");

    // [1] GREEN PROBES → every OBJECTIVE box PASSes; FOUNDER-ATTEST boxes stay AWAITING (no auto-pass).
    console.log("[1] green probes → objective boxes PASS, founder-attest boxes AWAIT (never auto-pass)");
    {
      const prompts = [];
      const run = await runValidation(greenCtx, { prompt: (m) => prompts.push(m) });
      const by = Object.fromEntries(run.results.map((r) => [r.id, r]));
      for (const id of ["runner-build", "cicd-roundtrip", "deploy-attributed", "heartbeat-ready", "status-page", "delete-test", "boundary-gate"]) {
        check(`objective box '${id}' → PASS on a green probe`, by[id].verdict === "PASS", by[id].evidence);
      }
      check("box 'cicd-roundtrip' evidence cites the node: neo-node2 marker", /neo-node2/.test(by["cicd-roundtrip"].evidence));
      check("founder-attest 'watchdog-pages' does NOT auto-pass (AWAITING-ATTEST)", by["watchdog-pages"].verdict === "AWAITING-ATTEST");
      check("founder-attest 'reboot-survival' does NOT auto-pass (AWAITING-ATTEST)", by["reboot-survival"].verdict === "AWAITING-ATTEST");
      check("the two founder-attest boxes emitted a PROMPT each", prompts.filter((p) => p.startsWith("[ATTEST")).length === 2);
      check("watchdog assist recorded the pull-watchdog self-test result", /pull-watchdog --self-test PASSED/.test(by["watchdog-pages"].evidence));
      check("gate is INCOMPLETE while attests are open (not GO, not NO-GO)", run.gate === "INCOMPLETE");
    }

    // [2] RED PROBES → every OBJECTIVE box FAILs with an honest evidence line; gate NO-GO.
    console.log("\n[2] red probes → objective boxes FAIL with an evidence line; gate NO-GO");
    {
      const run = await runValidation(redCtx, { prompt: () => {} });
      const by = Object.fromEntries(run.results.map((r) => [r.id, r]));
      for (const id of ["runner-build", "cicd-roundtrip", "deploy-attributed", "heartbeat-ready", "status-page", "delete-test", "boundary-gate"]) {
        check(`objective box '${id}' → FAIL on a red probe`, by[id].verdict === "FAIL", by[id].evidence);
        check(`box '${id}' FAIL carries a non-empty evidence line`, !!by[id].evidence && by[id].evidence.length > 0);
      }
      check("box 'heartbeat-ready' FAIL evidence names the 503/down cause", /503|down|unreachable/i.test(by["heartbeat-ready"].evidence));
      check("box 'boundary-gate' FAIL evidence surfaces the exit code", /exit 1/.test(by["boundary-gate"].evidence));
      check("gate is NO-GO when an objective box is red", run.gate === "NO-GO");
    }

    // [3] FOUNDER-ATTEST recording — yes → ATTESTED-PASS, no → ATTESTED-FAIL; all-green+attested → GO.
    console.log("\n[3] founder attestation recorded — yes → ATTESTED-PASS (GO), no → ATTESTED-FAIL (NO-GO)");
    {
      const runYes = await runValidation(greenCtx, { prompt: () => {}, attest: { "watchdog-pages": "yes", "reboot-survival": "yes" } });
      const byY = Object.fromEntries(runYes.results.map((r) => [r.id, r]));
      check("'watchdog-pages' attested yes → ATTESTED-PASS", byY["watchdog-pages"].verdict === "ATTESTED-PASS");
      check("'reboot-survival' attested yes → ATTESTED-PASS", byY["reboot-survival"].verdict === "ATTESTED-PASS");
      check("all 9 green + attested → GATE GO (the Sprint-5.3 trigger)", runYes.gate === "GO");
      check("GO requires exactly 9 green", runYes.results.filter((r) => r.green).length === 9);

      const runNo = await runValidation(greenCtx, { prompt: () => {}, attest: { "watchdog-pages": "no", "reboot-survival": "yes" } });
      const byN = Object.fromEntries(runNo.results.map((r) => [r.id, r]));
      check("'watchdog-pages' attested no → ATTESTED-FAIL", byN["watchdog-pages"].verdict === "ATTESTED-FAIL");
      check("a single attested-no → GATE NO-GO", runNo.gate === "NO-GO");
    }

    // [4] not-configured objective boxes fail CLOSED (never silently green).
    console.log("\n[4] missing config fails closed (no silent green)");
    {
      const ctx = { ...greenCtx, repo: "", statusPageUrl: "" };
      const run = await runValidation(ctx, { prompt: () => {} });
      const by = Object.fromEntries(run.results.map((r) => [r.id, r]));
      check("no DOS_GH_REPO → 'runner-build' FAIL (not green)", by["runner-build"].verdict === "FAIL" && /DOS_GH_REPO/.test(by["runner-build"].evidence));
      check("no DOS_STATUS_PAGE_URL → 'status-page' FAIL (not green)", by["status-page"].verdict === "FAIL" && /DOS_STATUS_PAGE_URL/.test(by["status-page"].evidence));
    }

    // [5] the evidence report renders the 9 boxes + the gate + the sign-off.
    console.log("\n[5] VALIDATION-EVIDENCE.md renders the 9 boxes, the gate, and the author≠verifier sign-off");
    {
      const run = await runValidation(greenCtx, { prompt: () => {}, attest: { "watchdog-pages": "yes", "reboot-survival": "yes" } });
      const md = renderEvidenceMarkdown(run, greenCtx);
      check("report contains all 9 box titles", CHECKS.every((c) => md.includes(c.title)));
      check("report states the GO gate", /GATE:\*\* \*\*GO/.test(md) || /OPERATIONAL/.test(md));
      check("report has a Founder sign-off line", /Founder/.test(md) && /Project Owner/.test(md));
      check("report labels each box OBJECTIVE or FOUNDER-ATTEST", (md.match(/OBJECTIVE|FOUNDER-ATTEST/g) || []).length >= 9);
    }

    console.log("");
    if (failures === 0) {
      console.log("validate-node self-test: ALL PROOFS HOLD (exit 0)");
      process.exit(0);
    } else {
      console.error(`validate-node self-test: ${failures} FAILURE(S) (exit 1)`);
      process.exit(1);
    }
  })();
}

const IS_MAIN = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (IS_MAIN) {
  main()
    .then((code) => process.exit(typeof code === "number" ? code : 0))
    .catch((e) => {
      console.error("[validate-node] crashed:", e);
      process.exit(2);
    });
}
