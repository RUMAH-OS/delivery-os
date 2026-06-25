// =============================================================================
// Delivery OS — CANONICAL contract: deployment-authorization result, v1.
// =============================================================================
// THE single source of truth for the SHAPE + REQUIREMENT MATRIX of a
// deployment-authorization decision. Zero-dependency, pure: a caller imports it
// and can both (a) read the per-environment requirement sets and (b) validate
// that a `deployment-auth.mjs check` result conforms — including the LOAD-BEARING
// SAFETY INVARIANT (no required-but-unfinished signal may ever yield authorized).
//
// RATIFIED DESIGN (founder directive 2026-06-25): deployment authorization is
// COMPUTED FROM SDLC STATE, never from a founder pre-signature. Authorization
// depends on STATE, never on who runs it. A higher environment requires strictly
// MORE than a lower one (prod ⊇ preview ⊇ dev — see REQUIREMENTS below).
//
// The producer is `templates/tools/deployment-auth.mjs` (the state checker). Both
// the producer and any consumer import THIS file — one artifact, both sides.
// =============================================================================

export const CONTRACT_VERSION = "v1";

/** The deployable targets, lowest privilege first. */
export const TARGETS = /** @type {const} */ (["dev", "preview", "prod"]);

/**
 * The full signal set, in the fixed object-key order the result reports them.
 * Each is a GOVERNANCE STATE READING — never a who-ran-it check.
 *   verify         — a fresh INDEPENDENT VERIFY (author≠verifier, newer than impl) is `verified`
 *   founder_review — IF the change is founder_verifiable, a docs/review/REVIEW-*.md exists
 *   class_c        — IF the change is Class C, a `founder-approved` label applied by a CODEOWNER
 *   merge          — the change is merged to the target branch (commit is an ancestor of main)
 *   ci             — every CI check bucket === "pass" (no pending/failure/skipped)
 *   lane_scope     — the requested action/target is within the ratified deploy lane's scope
 */
export const SIGNAL_NAMES = /** @type {const} */ ([
  "verify", "founder_review", "class_c", "merge", "ci", "lane_scope",
]);

/**
 * THE REQUIREMENT MATRIX — which signals are REQUIRED per target.
 *   dev / preview → { verify, ci }            (deploy verified code BEFORE founder review)
 *   prod          → ALL of { verify, ci, merge, founder_review, class_c, lane_scope }
 * INVARIANT (asserted by requirementsAreMonotonic): prod ⊇ preview ⊇ dev — a higher
 * environment requires strictly MORE, never less. Authorization = every REQUIRED
 * signal passed; a non-required signal is reported for transparency but never gates.
 */
export const REQUIREMENTS = {
  dev: ["verify", "ci"],
  preview: ["verify", "ci"],
  prod: ["verify", "ci", "merge", "founder_review", "class_c", "lane_scope"],
};

/**
 * The canonical governance ORDER used to name the FIRST unfinished step on a deny.
 * Cheapest/most-fundamental gate first → the operator fixes the earliest blocker.
 */
export const CANONICAL_ORDER = ["verify", "ci", "merge", "founder_review", "class_c", "lane_scope"];

/**
 * @typedef {Object} SignalResult
 * @property {boolean} required  Was this signal REQUIRED for the target?
 * @property {boolean|null} passed  true=satisfied · false=unfinished/unreadable (FAIL-CLOSED) ·
 *                                  null=not-applicable (only ever for a NON-required signal).
 * @property {string} reason  Concise human-readable verdict.
 * @property {*} [evidence]  Optional machine evidence (artifact path, check names, applier, …).
 */

/**
 * @typedef {Object} DeploymentAuthResult
 * @property {boolean} authorized  TRUE iff EVERY required signal passed === true (fail-closed).
 * @property {"dev"|"preview"|"prod"} target
 * @property {string} reason  On deny, names the FIRST unfinished governance step.
 * @property {{verify:SignalResult, founder_review:SignalResult, class_c:SignalResult,
 *             merge:SignalResult, ci:SignalResult, lane_scope:SignalResult}} signals
 * @property {string} checkedAt  ISO-8601 instant the decision was computed.
 * @property {*} [evidence]  Optional top-level evidence (pr, sha, base, classification, …).
 */

const isBool = (v) => typeof v === "boolean";
const isStr = (v) => typeof v === "string";
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * The structural + SAFETY-INVARIANT check. Pure, fail-closed. Returns {ok, errors[]}.
 * Beyond shape, it enforces the load-bearing rule the whole tool exists to guarantee:
 *   (1) authorized is the EXACT conjunction of every required signal's passed===true;
 *   (2) if ANY required signal's passed !== true, authorized MUST be false;
 *   (3) a passed:null is only ever legal on a NON-required signal.
 * A result that claims authorized=true while a required signal is unfinished is a
 * CONTRACT VIOLATION (the exact failure mode this contract is here to forbid).
 * @param {DeploymentAuthResult} result
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validate(result) {
  const errors = [];
  if (result === null || typeof result !== "object") {
    return { ok: false, errors: ["result: not an object"] };
  }
  if (!isBool(result.authorized)) errors.push("authorized: must be a boolean");
  if (!TARGETS.includes(result.target)) errors.push(`target: must be one of ${TARGETS.join("|")}`);
  if (!isStr(result.reason) || !result.reason.length) errors.push("reason: must be a non-empty string");
  if (!isStr(result.checkedAt) || !ISO_RE.test(result.checkedAt)) errors.push("checkedAt: must be an ISO-8601 instant");

  const signals = result.signals;
  if (signals === null || typeof signals !== "object") {
    errors.push("signals: must be an object with every signal key");
    return { ok: false, errors };
  }
  for (const name of SIGNAL_NAMES) {
    const s = signals[name];
    if (s === null || typeof s !== "object") { errors.push(`signals.${name}: missing or not an object`); continue; }
    if (!isBool(s.required)) errors.push(`signals.${name}.required: must be a boolean`);
    if (!(s.passed === true || s.passed === false || s.passed === null)) errors.push(`signals.${name}.passed: must be true|false|null`);
    if (!isStr(s.reason)) errors.push(`signals.${name}.reason: must be a string`);
    if (s.required === true && s.passed === null) errors.push(`signals.${name}: a REQUIRED signal may not be null (fail-closed: unknown ⇒ false)`);
  }
  // strict: no unknown signal keys may leak past the contract.
  for (const k of Object.keys(signals)) {
    if (!SIGNAL_NAMES.includes(k)) errors.push(`signals: unknown key "${k}" (strict)`);
  }

  // --- THE LOAD-BEARING SAFETY INVARIANT --------------------------------------
  // Validate that `required` matches the target's matrix, then that authorized is
  // EXACTLY the conjunction of required-and-passed. A claimed authorize over an
  // unfinished required signal is the forbidden state.
  const required = REQUIREMENTS[result.target];
  if (required) {
    for (const name of SIGNAL_NAMES) {
      const s = signals[name];
      if (!s || typeof s !== "object") continue;
      const shouldBeRequired = required.includes(name);
      if (s.required !== shouldBeRequired) {
        errors.push(`signals.${name}.required: expected ${shouldBeRequired} for target "${result.target}" (matrix mismatch)`);
      }
    }
    const unfinished = required.filter((name) => {
      const s = signals[name];
      return !s || s.passed !== true;
    });
    const expectedAuthorized = unfinished.length === 0;
    if (result.authorized !== expectedAuthorized) {
      errors.push(
        `SAFETY INVARIANT VIOLATION: authorized=${result.authorized} but ${unfinished.length === 0
          ? "every required signal passed"
          : `required signal(s) unfinished: ${unfinished.join(", ")}`} — authorized MUST equal "all required passed".`
      );
    }
    if (result.authorized === true && unfinished.length > 0) {
      errors.push(`SAFETY INVARIANT VIOLATION: authorized=true while required signal(s) [${unfinished.join(", ")}] are not passed — fail-closed forbids this.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Assert the requirement matrix is MONOTONIC: prod ⊇ preview ⊇ dev (a higher
 * environment requires strictly more). A self-check the tool pins at startup.
 * @returns {{ok: boolean, errors: string[]}}
 */
export function requirementsAreMonotonic() {
  const errors = [];
  const supersetOf = (a, b) => b.every((x) => a.includes(x)); // a ⊇ b
  if (!supersetOf(REQUIREMENTS.preview, REQUIREMENTS.dev)) errors.push("preview must require ⊇ dev");
  if (!supersetOf(REQUIREMENTS.prod, REQUIREMENTS.preview)) errors.push("prod must require ⊇ preview");
  if (!supersetOf(REQUIREMENTS.prod, REQUIREMENTS.dev)) errors.push("prod must require ⊇ dev");
  return { ok: errors.length === 0, errors };
}
