#!/usr/bin/env node
// =============================================================================
// Delivery OS — boundary-classify (the /goal Execution Contract, §3 + Hardening
// H3/H4/H5). Zero-dep, Node ESM. PURE classifier — no IO, no network.
// =============================================================================
// A `/goal` runs autonomously until the next REQUIRED action can only be done by
// a human (a founder BOUNDARY = STOP = SUCCESS). The danger is mis-reading a
// transient error (rate-limit / 5xx / timeout / flaky test) as a boundary — or
// the reverse, retrying a permanent authorization wall forever. This module is
// the single place that draws the line.
//
//   import { classify, TERMINALS, BOUNDARY_CLASSES, HARD_EVIDENCE_KINDS } from "./boundary-classify.mjs"
//   classify({ action, error|denial, retriesExhausted?, noTool? })
//     -> { terminal: "boundary"|"transient"|"failure", class, evidence_kind, evidence, founder_burden_category, fap_warranted }
//
// H3 — the permanent/transient axis:
//   * permanent / authorization-class denial (unauthorized · gate-refused ·
//     credential-absent · classifier-denied-permanent) -> `boundary`  (a FAP).
//   * rate-limit / 5xx / timeout / network / flaky      -> `transient` (RETRY).
//   * a RETRIABLE class whose retry budget is exhausted -> `failure`   (a FAP).
// Only `boundary` and `failure` warrant a Founder Action Package.
//
// H4 — `no_tool` is never sufficient alone. A bare no_tool claim is an unbounded
//   negative the Stop-hook cannot re-check; classify() emits it ONLY co-occurring
//   with a hard evidence kind, else marks it `fap_warranted:false` (soft-flagged).
//
// node boundary-classify.mjs --self-test
// =============================================================================

import { fileURLToPath } from "node:url";

// --- the closed vocabularies (shared with goal-stop.mjs's FAP validation) ----
export const TERMINALS = ["boundary", "transient", "failure"];

// §3 founder-boundary taxonomy (1:1 onto the founder-burden categories).
export const BOUNDARY_CLASSES = [
  "approval", "merge-to-main", "credentials", "deploy-auth", "manual-testing",
  "external-login", "legal", "payment", "physical", "cross-repo-coordination", "other",
];

// Re-checkable ("hard") evidence kinds. `no_tool` is deliberately NOT here (H4).
export const HARD_EVIDENCE_KINDS = ["tool_denial", "credential_absent", "gate_state", "cap_tripped"];

// Map a boundary class -> its founder-burden category (founder-burden-gate.mjs).
const BURDEN_OF = {
  approval: "per_action_authorization",
  "merge-to-main": "per_action_authorization",
  credentials: "env_token_migration_action",
  "deploy-auth": "per_action_authorization",
  "manual-testing": "live_validation_defect_found",
  "external-login": "manual_setup_step",
  legal: "other",
  payment: "per_action_authorization",
  physical: "manual_setup_step",
  "cross-repo-coordination": "cross_repo_coordination",
  other: "other",
};

// --- signal patterns ---------------------------------------------------------
// TRANSIENT (retry within caps): a retry could plausibly clear it.
const TRANSIENT = /\b(rate.?limit|429|too many requests|5\d\d|internal server error|bad gateway|service unavailable|gateway timeout|time(d)?\s*out|timeout|etimedout|econnreset|econnrefused|eai_again|enotfound|socket hang up|network|temporar|flaky|deadlock|throttl)\b/i;

// CREDENTIAL ABSENCE (a presence probe came back empty). Matches both prose
// ("the api key is missing") and env-var style names ("SUPABASE_SERVICE_KEY is
// not set") where an underscore would otherwise defeat a \bkey\b boundary.
const CREDENTIAL = /(credential|secret|password|api[_\s-]?key|[a-z0-9]+_(key|token|secret)|\b(key|token)\b)[^.\n]*\b(absent|missing|not set|unset|undefined|empty|not (found|present|configured)|required)\b|\b(no|missing) (credential|secret|password|api[_\s-]?key|token|key)\b/i;

// FAIL-CLOSED GATE STATE (merge / deploy / label gate refused structurally).
const GATE = /\b(founder-approved|merge-pr\.mjs|deploy-lane\.mjs|fail-?closed|gate (refus|denied|blocked)|label(s)?\s*(=|\[)|unratified lane|required check|codeowner)\b/i;

// PERMANENT AUTHORIZATION DENIAL (the permission classifier / a 401/403 wall).
const AUTHZ = /\b(unauthor|forbidden|403|401|permission denied|not permitted|access denied|denied by (the )?classifier|classifier.?denied|not authorized|requires (founder|human|manual) (approval|authorization|action)|no unguarded|out-of-scope)\b/i;

// --- class inference from the action / signal text ---------------------------
function inferClass(action, text) {
  const s = `${action || ""} ${text || ""}`.toLowerCase();
  if (/merge|main\b|protected branch/.test(s)) return "merge-to-main";
  if (/deploy|prod|release|cutover|dns/.test(s)) return "deploy-auth";
  if (/credential|secret|password|api[_\s-]?key|_(key|token|secret)|\b(key|token)\b|env\b/.test(s)) return "credentials";
  if (/login|oauth|account setup|provider console|sign[_\s-]?in/.test(s)) return "external-login";
  if (/pay|charge|invoice|billing|card/.test(s)) return "payment";
  if (/legal|contract|business decision|policy/.test(s)) return "legal";
  if (/physical|hardware|on-?site|in person/.test(s)) return "physical";
  if (/sibling|cross-?repo|other repo|upstream repo/.test(s)) return "cross-repo-coordination";
  if (/manual test|visual|ux|human judgment|acceptance/.test(s)) return "manual-testing";
  if (/approv|greenlight|review|pr review|label/.test(s)) return "approval";
  return "other";
}

// =============================================================================
// THE CLASSIFIER (pure). Input:
//   { action, error?, denial?, retriesExhausted?, noTool? }
// `denial` (an explicit refusal string) outranks `error`. `noTool:true` asserts
// the action has no automatable path at all (the weak H4 signal).
// =============================================================================
export function classify(input = {}) {
  const { action = "", error, denial, retriesExhausted = false, noTool = false } = input || {};
  const text = String(denial != null ? denial : (error != null ? error : "")).trim();

  const klass = inferClass(action, text);
  const burden = BURDEN_OF[klass] || "other";
  const mk = (terminal, evidence_kind, evidence, extra = {}) => ({
    terminal, class: klass, evidence_kind, evidence,
    founder_burden_category: burden,
    fap_warranted: terminal === "boundary" || terminal === "failure",
    ...extra,
  });

  // 1) A permanent / authorization-class wall -> BOUNDARY (a FAP). Checked first:
  //    an explicit `denial` is, by definition, an attempted-and-refused action.
  const explicitDenial = denial != null && String(denial).trim() !== "";
  if (CREDENTIAL.test(text))
    return mk("boundary", "credential_absent", text || "credential presence probe reported the key ABSENT");
  if (GATE.test(text))
    return mk("boundary", "gate_state", text || "fail-closed gate refused (merge/deploy/label)");
  if (AUTHZ.test(text) || (explicitDenial && !TRANSIENT.test(text)))
    return mk("boundary", "tool_denial", text || "permission classifier refused the action (verbatim denial)");

  // 2) A retriable/transient error.
  if (TRANSIENT.test(text)) {
    // H3: a retriable class that EXHAUSTED its budget becomes a terminal failure.
    if (retriesExhausted)
      return mk("failure", "retry_exhausted", `retriable error did not clear within the retry budget: ${text}`);
    return mk("transient", "retryable", text || "transient error — retry within caps");
  }

  // 3) No automatable path at all (H4 — never sufficient ALONE).
  if (noTool)
    return mk("boundary", "no_tool", text || `no automatable tool exists for: ${action || "the required action"}`, {
      // a lone no_tool does NOT clear a goal — it must co-occur with a hard kind
      // or hard-block pending founder confirmation. Flagged for the friction log.
      fap_warranted: false,
      soft_flag: "no_tool-alone — requires a co-occurring hard evidence kind (credential_absent | gate_state | tool_denial) or it hard-blocks pending founder confirmation (H4).",
    });

  // 4) Unknown signal with retry budget gone -> failure; otherwise default to
  //    TRANSIENT (retry). The H1 wall-clock/turn cap is what converts an
  //    unbounded retry into a surfaced failure — never a silent boundary.
  if (retriesExhausted)
    return mk("failure", "retry_exhausted", `unclassified error did not clear within the retry budget: ${text || "(no detail)"}`);
  return mk("transient", "retryable", text || "unclassified error — treat as transient and retry within caps");
}

// =============================================================================
// SELF-TEST (pure; no IO). Asserts H3 (permanent vs transient), the failure
// promotion on retry-exhaustion, and H4 (no_tool never warrants a FAP alone).
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };

  // H3 — permanent/authorization -> boundary
  const authz = classify({ action: "merge PR to main", denial: "merge-pr.mjs exit 1: required check green but no founder-approved label" });
  ok(authz.terminal === "boundary", "authorization denial -> boundary");
  ok(authz.evidence_kind === "gate_state", "merge gate refusal -> gate_state");
  ok(authz.class === "merge-to-main", "merge action -> merge-to-main class");

  const cred = classify({ action: "integration test", error: "SUPABASE_SERVICE_KEY is not set (presence probe: absent)" });
  ok(cred.terminal === "boundary", "absent credential -> boundary");
  ok(cred.evidence_kind === "credential_absent", "absent credential -> credential_absent");
  ok(cred.founder_burden_category === "env_token_migration_action", "credential boundary -> env_token burden");

  const denied = classify({ action: "deploy --prod", denial: "permission denied: classifier refused prod write (403)" });
  ok(denied.terminal === "boundary" && denied.evidence_kind === "tool_denial", "classifier 403 denial -> boundary/tool_denial");

  // H3 — transient stays transient (NOT a boundary)
  const rl = classify({ action: "call API", error: "429 Too Many Requests (rate limit)" });
  ok(rl.terminal === "transient", "rate-limit -> transient (retry), NOT boundary");
  ok(rl.fap_warranted === false, "a transient error does NOT warrant a FAP");

  const fivexx = classify({ action: "call API", error: "503 Service Unavailable" });
  ok(fivexx.terminal === "transient", "5xx -> transient");
  const to = classify({ action: "fetch", error: "ETIMEDOUT: connection timed out" });
  ok(to.terminal === "transient", "timeout -> transient");
  const net = classify({ action: "fetch", error: "ECONNRESET socket hang up" });
  ok(net.terminal === "transient", "network reset -> transient");

  // H3 — a retriable class whose budget is exhausted -> failure (a FAP), not boundary
  const exhausted = classify({ action: "call API", error: "503 Service Unavailable", retriesExhausted: true });
  ok(exhausted.terminal === "failure", "retriable + budget exhausted -> failure");
  ok(exhausted.fap_warranted === true, "a failure warrants a FAP");

  // H4 — no_tool ALONE never warrants a FAP (soft-flagged, must co-occur)
  const noTool = classify({ action: "press the physical reset button", noTool: true });
  ok(noTool.terminal === "boundary", "no_tool -> boundary terminal");
  ok(noTool.evidence_kind === "no_tool", "no_tool kind surfaced");
  ok(noTool.fap_warranted === false, "H4: no_tool ALONE does NOT warrant a clearing FAP");
  ok(typeof noTool.soft_flag === "string" && /no_tool-alone/.test(noTool.soft_flag), "H4: no_tool is soft-flagged for the friction log");

  // unclassified, budget intact -> transient (retry); the H1 cap, not classify, ends it
  const unknown = classify({ action: "do thing", error: "weird intermittent glitch" });
  ok(unknown.terminal === "transient", "unclassified error -> transient by default (the cap, not a fake boundary, ends it)");

  // every result uses only the closed vocabularies
  for (const r of [authz, cred, denied, rl, exhausted, noTool, unknown]) {
    ok(TERMINALS.includes(r.terminal), `terminal "${r.terminal}" is in the closed set`);
    ok(BOUNDARY_CLASSES.includes(r.class), `class "${r.class}" is in the §3 taxonomy`);
  }

  if (fails.length) {
    console.error("boundary-classify --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(
    "boundary-classify --self-test PASS — H3 permanent/authorization denials (gate/credential/classifier) classify as " +
    "boundary; rate-limit/5xx/timeout/network classify as transient (retry, no FAP); a retriable class with its budget " +
    "exhausted becomes a failure; H4 no_tool-alone is a boundary terminal but NEVER warrants a clearing FAP (soft-flagged); " +
    "an unclassified error defaults to transient (the H1 cap, not a fake boundary, ends it)."
  );
  process.exit(0);
}

// --- CLI ---------------------------------------------------------------------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  else {
    const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
    const input = {
      action: flag("--action") || "",
      error: flag("--error"),
      denial: flag("--denial"),
      retriesExhausted: argv.includes("--retries-exhausted"),
      noTool: argv.includes("--no-tool"),
    };
    if (input.error == null && input.denial == null && !input.noTool) {
      console.error("USAGE: node boundary-classify.mjs --action <a> (--error <e> | --denial <d> | --no-tool) [--retries-exhausted] [--self-test]");
      process.exit(2);
    }
    console.log(JSON.stringify(classify(input), null, 2));
    process.exit(0);
  }
}
