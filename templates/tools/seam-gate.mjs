#!/usr/bin/env node
// =============================================================================
// Delivery OS — seam-gate (v6 capability #2). FAIL-CLOSED cross-repo seam gate.
// =============================================================================
// Reusable, zero-dependency ESM runner. Given a batch of drained seam events
// (a JSON array — from a file arg or piped stdin), it validates every event
// against the CANONICAL seam contract (`validateSeamBatch`) and:
//   - prints a readable PASS report and EXITS 0 when the whole batch conforms,
//   - prints every violation and EXITS NON-ZERO when ANY event violates.
//
// This is the gate ANY repo invokes on the events it emits (producer side) or
// receives (consumer side). It is the founder-replacement: a seam mismatch is
// discovered HERE, in CI, before a real send — never by the founder at live.
//
//   node seam-gate.mjs events.json          # validate a file
//   node drain.mjs | node seam-gate.mjs      # validate piped stdin
//   node seam-gate.mjs --contract <path>     # override the contract location
//
// Exit codes: 0 = clean · 1 = seam violation(s) · 2 = usage/IO/contract error.
//
// Zero deps on purpose: it dynamically imports the contract module by path so
// every repo runs the same bytes (cross-repo distribution = os-sync, #11).
// =============================================================================

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// --- arg parsing -------------------------------------------------------------
const argv = process.argv.slice(2);
let contractPath = null;
let inputFile = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--contract") {
    contractPath = argv[++i];
  } else if (a === "-h" || a === "--help") {
    process.stdout.write(
      "Usage: node seam-gate.mjs [events.json] [--contract <path-to-seam-contract.mjs>]\n" +
        "       cat events.json | node seam-gate.mjs\n" +
        "Exits non-zero if ANY event violates the seam contract (fail-closed).\n"
    );
    process.exit(0);
  } else if (!a.startsWith("-")) {
    inputFile = a;
  } else {
    fail(2, `unknown flag "${a}" (try --help)`);
  }
}

function fail(code, msg) {
  process.stderr.write(`seam-gate: ${msg}\n`);
  process.exit(code);
}

// --- locate the contract -----------------------------------------------------
// Default: the canonical contract relative to delivery-os. From templates/tools/
// that is ../../contracts/admin-plos-seam-v1.mjs. A repo that vendors the
// contract elsewhere passes --contract or SEAM_CONTRACT.
function resolveContract() {
  if (contractPath) return isAbsolute(contractPath) ? contractPath : resolve(process.cwd(), contractPath);
  if (process.env.SEAM_CONTRACT) return resolve(process.cwd(), process.env.SEAM_CONTRACT);
  const candidates = [
    resolve(HERE, "../../contracts/admin-plos-seam-v1.mjs"), // delivery-os canonical
    resolve(process.cwd(), "contracts/admin-plos-seam-v1.mjs"), // vendored at repo root
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  fail(2, `cannot locate the seam contract (looked at:\n  ${candidates.join("\n  ")}\n) — pass --contract <path>`);
}

// --- read the batch (file arg OR stdin) --------------------------------------
function readStdin() {
  try {
    return readFileSync(0, "utf8"); // fd 0
  } catch {
    return "";
  }
}

function readBatch() {
  let raw;
  if (inputFile) {
    const p = isAbsolute(inputFile) ? inputFile : resolve(process.cwd(), inputFile);
    if (!existsSync(p)) fail(2, `input file not found: ${p}`);
    raw = readFileSync(p, "utf8");
  } else {
    if (process.stdin.isTTY) fail(2, "no input — pass a JSON file or pipe a JSON array on stdin (try --help)");
    raw = readStdin();
  }
  if (!raw || !raw.trim()) fail(2, "empty input — expected a JSON array of seam events");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(2, `input is not valid JSON: ${e.message}`);
  }
  // Accept either a bare array, or a drain envelope { data: [...] } (the seam
  // drain response shape), so a raw `GET /v1/events` body works unmodified.
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;
  fail(2, "input must be a JSON array of events (or a { data: [...] } drain response)");
}

// --- run ---------------------------------------------------------------------
const contractFile = resolveContract();
let validateSeamBatch, SEAM_VERSION;
try {
  ({ validateSeamBatch, SEAM_VERSION } = await import(`file://${contractFile.replace(/\\/g, "/")}`));
} catch (e) {
  fail(2, `failed to import seam contract at ${contractFile}: ${e.message}`);
}
if (typeof validateSeamBatch !== "function") {
  fail(2, `seam contract at ${contractFile} does not export validateSeamBatch`);
}

const events = readBatch();
const result = validateSeamBatch(events);

const header = `seam-gate · contract ${SEAM_VERSION || "?"} · ${events.length} event(s) · ${contractFile}`;

if (result.ok) {
  process.stdout.write(`${header}\nPASS: all ${events.length} event(s) conform to the seam contract.\n`);
  process.exit(0);
}

// FAIL-CLOSED: readable report, non-zero exit.
process.stderr.write(
  `${header}\n` +
    `FAIL: ${result.violations.length} seam violation(s) — refusing to let this batch reach the seam:\n` +
    result.violations.map((v) => `  ✗ ${v}`).join("\n") +
    `\n\nA new event type / payload field must be added to the seam contract DELIBERATELY before it can cross the seam.\n`
);
process.exit(1);
