#!/usr/bin/env node
// =============================================================================
// Delivery OS — change-classify (the SDLC-v2 risk-class router). Zero-dep, Node
// ESM. PURE classifier — no effectful action (no merge / deploy / push). It only
// names a change's RISK CLASS so the orchestration can route it; it NEVER acts.
// =============================================================================
// A diff is one of three classes:
//   C  — CONSEQUENTIAL: money / identity / contracts / data-shape / prompts /
//        secrets / the control-plane itself. ALWAYS human-gated. C WINS over all.
//   B  — VISIBLE: anything a user (or the founder) sees — UI, emails, public copy,
//        and review-surfaces (api/db). Needs human eyes; never auto.
//   A  — AUTO-SAFE: tests / evals / scripts / docs / .claude / non-control-plane
//        CI / dep-bumps / pure src refactors. The ONLY class eligible for autonomy.
//
// THE LOAD-BEARING INVARIANT — A is OPT-IN, never a default. A diff earns A only by
// being PROVABLY clean: EVERY path in the A-allowlist, ZERO B/C signal, and under the
// size cap. The instant anything is ambiguous / novel / unmatched, or the config can't
// be trusted, it falls to B. The instant any C-marker appears (path OR a keyword in the
// body OR a control-plane file), it is C. You cannot accidentally get autonomy.
//
//   import { classify, DEFAULTS } from "./change-classify.mjs"
//   classify(changedFiles, diffBody?, config?, { configError? })
//     -> { class: "A"|"B"|"C", reason, signals }
//   changedFiles: string[] | { path, additions?, deletions?, loc? }[]
//
// Data-driven: the deny/allow/keyword tables below are the DEFAULTS; a project may
// override them via `.delivery-os/classification.json` (same shape). A PARSE ERROR on
// that file is itself fail-safe: A is withheld (the result floors at B).
//
// node change-classify.mjs --self-test
// =============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// =============================================================================
// THE KNOWLEDGE BASE — data, not code. Each list is a set of globs (gitignore-ish:
// a pattern with NO "/" matches the basename in any directory; a pattern WITH "/"
// matches the full path). keywordsC are stems scanned (boundary-prefix) over the
// diff body. Order of CHECKING is fixed in classify(): control-plane C, deny C,
// keyword C, visible B, review B, auto A, else (unmatched) -> B.
// =============================================================================
export const DEFAULTS = {
  // C — the control plane (the rules that govern merge/deploy/classification itself).
  // Touching these is ALWAYS consequential: a change here can disable every other gate.
  controlPlaneC: [
    "**/promote-to-prod.yml", "**/promote-to-prod.yaml",
    "**/CODEOWNERS",
    "**/classification.json",
    "**/auto-merge.authorization",
    "**/verify-gate.mjs",
    "**/branch-protection*",
    "**/.deploy-lane.json", "**/deploy-lane.json",
  ],
  // C — the consequential surfaces (money / identity / contracts / data-shape / prompts / secrets).
  denyC: [
    "**/payment*/**", "**/billing/**", "**/invoic*/**", "**/pricing/**", "**/auth/**",
    "contracts/**", "**/contracts/**",
    "**/migrations/**", "**/rls/**",
    "**/*prompt*",
    "**/.env*",
  ],
  // C — keyword stems scanned over the diff BODY (boundary-prefix match, so "price"
  // catches "pricing"/"prices" but NOT "syntax"). Over-eager toward C BY DESIGN: when
  // a money/identity/secret word appears in a diff, escalate — false-C is the safe error.
  keywordsC: [
    "price", "charge", "refund", "invoic", "sign", "pii",
    "credential", "secret", "rls", "payout", "commission", "tax",
  ],
  // B — visible surfaces (a human, user or founder, sees the result).
  visibleB: [
    "*.tsx", "*.jsx", "**/components/**", "**/ui/**", "**/emails/**", "**/*.email.*", "public/**",
  ],
  // B — review surfaces: api/db are not C, but a src refactor touching them is NOT auto
  // ("src refactors touching no api/db/ui/business path" => only NON-api/db src is A).
  reviewB: [
    "**/api/**", "**/db/**", "**/database/**", "**/*-api.*", "**/*.api.*",
  ],
  // A — the auto-safe allowlist. A path NOT in here is unmatched => B (never A).
  autoA: [
    "tests/**", "**/tests/**", "**/__tests__/**",
    "e2e/**", "**/e2e/**", "evals/**", "**/evals/**",
    ".github/workflows/**",
    "scripts/**", "**/scripts/**",
    ".claude/**", "**/.claude/**",
    "docs/**", "**/docs/**",
    "src/**", "lib/**", "app/**",
  ],
  // size cap — a big change is reviewable even if every path is A-safe (A -> B).
  maxLoc: 400,
  maxFiles: 25,
};

// --- glob matching (gitignore-ish; pure) -------------------------------------
function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") { i++; re += "(?:.*/)?"; } // **/  -> any (or no) leading dirs
        else re += ".*";                                     // **   -> anything
      } else re += "[^/]*";                                  // *    -> within one segment
    } else if (c === "?") re += "[^/]";
    else if (/[.+^${}()|[\]\\]/.test(c)) re += "\\" + c;
    else re += c;
  }
  return new RegExp("^" + re + "$");
}
function matchGlob(path, glob) {
  const p = String(path == null ? "" : path).replace(/\\/g, "/").replace(/^\.\//, "");
  const g = String(glob || "");
  const target = g.includes("/") ? p : p.split("/").pop(); // no-slash globs match the basename
  return globToRegex(g).test(target);
}
const matchAny = (path, globs) => (globs || []).some((g) => matchGlob(path, g));

// --- C keyword scan over the diff body ---------------------------------------
function kwRegex(kw) {
  const esc = String(kw).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // boundary-prefix: the stem must START a word; trailing word chars are allowed.
  return new RegExp(`(^|[^a-z0-9])${esc}[a-z0-9]*`, "i");
}
function keywordHits(body, keywords) {
  const text = String(body || "");
  return (keywords || []).filter((kw) => kwRegex(kw).test(text));
}

// --- dep-only detection (lockfiles are generated => A; package.json must PROVE it) ---
function isDepOnly(path, diffBody) {
  const base = String(path).split("/").pop();
  if (/^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|npm-shrinkwrap\.json)$/.test(base)) return true;
  if (base === "package.json") {
    if (!diffBody) return false; // can't PROVE dep-only without the diff => not auto (fail-safe)
    const lines = String(diffBody).split("\n").filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l));
    if (!lines.length) return false;
    return lines.every((l) => {
      const c = l.slice(1).trim();
      if (c === "" || c === "{" || c === "}" || c === ",") return true;
      if (/^"(dependencies|devDependencies|peerDependencies|optionalDependencies)"\s*:\s*\{?\s*$/.test(c)) return true;
      return /^"[^"]+"\s*:\s*"[^"]*",?$/.test(c); // "pkg": "^1.2.3"
    });
  }
  return false;
}

// --- size ---------------------------------------------------------------------
function normalizeFiles(changedFiles) {
  return (changedFiles || []).map((f) => (typeof f === "string" ? { path: f } : f)).filter((f) => f && f.path);
}
function totalLoc(files, diffBody) {
  let loc = 0; let any = false;
  for (const f of files) {
    if (typeof f.loc === "number") { loc += f.loc; any = true; }
    else if (typeof f.additions === "number" || typeof f.deletions === "number") {
      loc += (f.additions || 0) + (f.deletions || 0); any = true;
    }
  }
  if (any) return loc;
  if (diffBody) return String(diffBody).split("\n").filter((l) => /^[+-]/.test(l) && !/^[+-]{3}/.test(l)).length;
  return 0; // unknown -> the file-count cap still applies
}

// --- config merge -------------------------------------------------------------
function mergeConfig(config) {
  if (!config || config === DEFAULTS) return DEFAULTS;
  const out = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS)) if (config[k] !== undefined) out[k] = config[k];
  return out;
}

// =============================================================================
// THE CLASSIFIER (pure). configError:true (a broken classification.json) withholds
// A — the result floors at B, but a genuine C-marker still wins (safety over silence).
// =============================================================================
export function classify(changedFiles, diffBody = "", config = DEFAULTS, opts = {}) {
  const cfg = mergeConfig(config);
  const configError = !!opts.configError;
  const files = normalizeFiles(changedFiles);
  const signals = { C: [], keywordC: [], B: [], A: [], unmatched: [], fileCount: files.length, loc: 0 };

  // C keyword scan over the body (independent of any single file).
  signals.keywordC = keywordHits(diffBody, cfg.keywordsC);

  // per-file routing — first match wins, in safety order (C-paths, then B, then A).
  for (const f of files) {
    const p = f.path;
    if (matchAny(p, cfg.controlPlaneC)) { signals.C.push({ path: p, why: "control-plane" }); continue; }
    if (matchAny(p, cfg.denyC)) { signals.C.push({ path: p, why: "deny-list" }); continue; }
    if (matchAny(p, cfg.visibleB)) { signals.B.push({ path: p, why: "visible" }); continue; }
    if (matchAny(p, cfg.reviewB)) { signals.B.push({ path: p, why: "review-surface" }); continue; }
    if (isDepOnly(p, diffBody) || matchAny(p, cfg.autoA)) { signals.A.push({ path: p }); continue; }
    signals.unmatched.push(p);
  }
  signals.loc = totalLoc(files, diffBody);

  const mk = (klass, reason) => ({ class: klass, reason, signals });

  // 1) C WINS — any control-plane/deny path OR any body keyword. ALWAYS, first.
  if (signals.C.length || signals.keywordC.length) {
    const why = [];
    if (signals.C.length) why.push(`path(s): ${signals.C.map((c) => `${c.path} [${c.why}]`).join(", ")}`);
    if (signals.keywordC.length) why.push(`body keyword(s): ${signals.keywordC.join(", ")}`);
    return mk("C", `CONSEQUENTIAL (C wins): ${why.join(" + ")} — human-gated, never auto.`);
  }

  // 2) B — any visible / review surface.
  if (signals.B.length) {
    return mk("B", `VISIBLE: ${signals.B.map((b) => `${b.path} [${b.why}]`).join(", ")} — needs human eyes.`);
  }

  // 3) FAIL-SAFE — anything unmatched/novel/ambiguous, or no files at all => B (never A).
  if (signals.unmatched.length) {
    return mk("B", `fail-safe -> B: unmatched/novel path(s): ${signals.unmatched.join(", ")} (A is opt-in; an unproven path is never auto).`);
  }
  if (!signals.A.length) {
    return mk("B", "fail-safe -> B: nothing provably auto-safe (empty or all-ambiguous change).");
  }

  // 4) Size cap — every path is A-safe, but a big change is still reviewable.
  if (files.length > cfg.maxFiles || signals.loc > cfg.maxLoc) {
    return mk("B", `escalate A->B: size ${files.length} files / ${signals.loc} LOC exceeds cap (${cfg.maxFiles} files / ${cfg.maxLoc} LOC).`);
  }

  // 5) A — PROVABLY clean: every path A-allowlisted, zero B/C, under cap.
  if (configError) {
    return mk("B", "fail-safe -> B: classification.json parse error — A withheld (the rule table cannot be trusted).");
  }
  return mk("A", `AUTO-SAFE: every path is A-allowlisted (${signals.A.length}), clean of B/C, under the size cap.`);
}

// --- config loader (the live path) -------------------------------------------
export function loadConfig(cwd) {
  const p = join(cwd || process.cwd(), ".delivery-os", "classification.json");
  let raw;
  try { raw = readFileSync(p, "utf8"); }
  catch { return { config: DEFAULTS, configError: false, source: "defaults (no .delivery-os/classification.json)" }; }
  try {
    const parsed = JSON.parse(raw);
    return { config: mergeConfig(parsed), configError: false, source: p };
  } catch (e) {
    // present but unparseable: fail-safe (A withheld), still detect C/B.
    return { config: DEFAULTS, configError: true, source: `${p} (PARSE ERROR: ${e.message})` };
  }
}

// =============================================================================
// SELF-TEST (pure; no IO). Proves: C wins (control-plane + keyword), A is OPT-IN
// (must be PROVABLY clean), and every ambiguous/novel/visible/oversize case -> B.
// =============================================================================
function selfTest() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); };
  const log = [];

  // --- C WINS: a pricing constant in an otherwise-A path is C via the body keyword ---
  const pricing = classify(["src/lib/pricing.ts"], "+const PRICE_CENTS = 1999; // monthly\n-const PRICE_CENTS = 999;");
  ok(pricing.class === "C", "pricing constant (keyword) in an A-path -> C");
  log.push(`  [C-wins/keyword] src/lib/pricing.ts + price body         -> ${pricing.class}  "${pricing.reason}"`);

  // --- C WINS: a control-plane workflow change is C (not A, though .github/workflows is A-allowlisted) ---
  const ctrl = classify([".github/workflows/promote-to-prod.yml"], "+  run: deploy --prod");
  ok(ctrl.class === "C", "control-plane workflow -> C (overrides the A-allowlisted workflows dir)");
  log.push(`  [C-wins/control]  .github/workflows/promote-to-prod.yml  -> ${ctrl.class}  "${ctrl.reason}"`);

  // more C: a payment path, a migration, a prompt, an env file, a CODEOWNERS edit
  ok(classify(["app/payments/charge.ts"]).class === "C", "payment path -> C");
  ok(classify(["db/migrations/0007_x.sql"]).class === "C", "migration path -> C");
  ok(classify(["src/agents/system-prompt.md"]).class === "C", "prompt path -> C");
  ok(classify([".env.production"]).class === "C", "env file -> C");
  ok(classify([".github/CODEOWNERS"]).class === "C", "CODEOWNERS (control-plane) -> C");
  ok(classify(["src/util.ts"], "+// refund the customer their commission").class === "C", "refund/commission keyword in body -> C");

  // --- A is OPT-IN: a PURE test-only diff earns A ---
  const testOnly = classify(["tests/unit/foo.test.ts", "tests/unit/bar.test.ts"], "+expect(x).toBe(1);");
  ok(testOnly.class === "A", "pure test-only diff -> A");
  log.push(`  [A-optin/clean]   tests/**.test.ts (clean, small)        -> ${testOnly.class}  "${testOnly.reason}"`);

  // and A really is PROVABLY-clean-only: adding ONE novel path to the same A diff drops it to B
  const aPlusNovel = classify(["tests/unit/foo.test.ts", "weird/unknown/thing.xyz"], "+expect(x).toBe(1);");
  ok(aPlusNovel.class === "B", "A + one unmatched path -> B (A demands EVERY path be provably clean)");
  log.push(`  [A-optin/proof]   tests/foo.test.ts + weird/thing.xyz    -> ${aPlusNovel.class}  "${aPlusNovel.reason}"`);

  // --- big refactor over the cap -> B (even though every path is A-safe) ---
  const bigByFiles = classify(Array.from({ length: 30 }, (_, i) => `src/mod/f${i}.ts`));
  ok(bigByFiles.class === "B", "30 A-safe files (> 25 cap) -> B");
  const bigByLoc = classify([{ path: "src/mod/refactor.ts", additions: 500, deletions: 80 }]);
  ok(bigByLoc.class === "B", "580 LOC (> 400 cap) -> B");
  log.push(`  [oversize->B]     30x src/*.ts                           -> ${bigByFiles.class}  "${bigByFiles.reason}"`);

  // --- novel path -> B ---
  const novel = classify(["config/strange.weirdext"]);
  ok(novel.class === "B", "novel/unmatched path -> B (fail-safe, never A)");
  log.push(`  [novel->B]        config/strange.weirdext                -> ${novel.class}  "${novel.reason}"`);

  // --- a .tsx (visible) -> B ---
  const tsx = classify(["src/pages/Dashboard.tsx"], "+<div>hi</div>");
  ok(tsx.class === "B", ".tsx (visible) -> B");
  log.push(`  [visible->B]      src/pages/Dashboard.tsx                 -> ${tsx.class}  "${tsx.reason}"`);

  // --- ambiguous (an A-path src file + a visible file) -> B ---
  const ambiguous = classify(["src/lib/util.ts", "src/ui/Button.jsx"]);
  ok(ambiguous.class === "B", "ambiguous (A-safe + visible) -> B");
  log.push(`  [ambiguous->B]    src/lib/util.ts + src/ui/Button.jsx     -> ${ambiguous.class}  "${ambiguous.reason}"`);

  // --- empty change -> B (never A) ---
  ok(classify([]).class === "B", "empty change -> B (never auto)");

  // --- review surface (api/db) src -> B (src refactor touching api/db is NOT auto) ---
  ok(classify(["src/api/users.ts"]).class === "B", "src/api/** -> B (review surface)");
  ok(classify(["src/db/queries.ts"]).class === "B", "src/db/** -> B (review surface)");

  // --- PARSE ERROR on classification.json: A is withheld -> B; but C still wins ---
  const parseErrA = classify(["tests/unit/foo.test.ts"], "+x", DEFAULTS, { configError: true });
  ok(parseErrA.class === "B", "classification.json parse error -> A withheld (floors at B)");
  const parseErrC = classify(["app/billing/charge.ts"], "", DEFAULTS, { configError: true });
  ok(parseErrC.class === "C", "classification.json parse error does NOT suppress C (C still wins)");
  log.push(`  [parse-err->B]    tests/foo.test.ts (config broken)       -> ${parseErrA.class}  "${parseErrA.reason}"`);

  // --- config override (DATA): a project can extend the A-allowlist ---
  const custom = { ...DEFAULTS, autoA: [...DEFAULTS.autoA, "infra/**"] };
  ok(classify(["infra/terraform/main.tf"], "", custom).class === "A", "overridden autoA -> infra/** becomes A");
  ok(classify(["infra/terraform/main.tf"]).class === "B", "without the override, infra/** is unmatched -> B");

  if (fails.length) {
    console.error("change-classify --self-test FAIL:");
    for (const f of fails) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error("change-classify --self-test PASS — fail-safe + C-wins + A-opt-in proofs:");
  for (const l of log) console.error(l);
  console.error(
    "change-classify --self-test PASS — C WINS over everything (a body keyword or a control-plane/deny path forces C " +
    "even on an otherwise-A path); A is OPT-IN (earned only when EVERY path is A-allowlisted, clean of B/C, and under the " +
    "size cap — one novel path, one visible file, an oversize diff, an empty change, or a broken classification.json all " +
    "fall to B); ambiguous/novel/unmatched ALWAYS -> B, never A."
  );
  process.exit(0);
}

// --- CLI (read-only; classifies the working diff, never acts) ----------------
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  const asJson = argv.includes("--json");
  const cwd = process.cwd();

  // gather the change: explicit --files, else the working-tree diff vs --base (default HEAD).
  let changedFiles = [];
  let diffBody = "";
  const filesFlag = flag("--files");
  if (filesFlag) {
    changedFiles = filesFlag.split(",").map((s) => s.trim()).filter(Boolean);
  } else {
    const base = flag("--base");
    const git = (args) => { try { return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
    const range = base ? [`${base}...HEAD`] : [];
    changedFiles = git(["diff", "--name-only", ...range]).split("\n").map((s) => s.trim()).filter(Boolean);
    diffBody = git(["diff", ...range]);
  }
  const { config, configError, source } = loadConfig(cwd);
  const result = classify(changedFiles, diffBody, config, { configError });
  if (asJson) console.log(JSON.stringify({ ...result, configSource: source }, null, 2));
  else {
    console.error(`change-classify (${source})`);
    console.error(`  files: ${changedFiles.length}`);
    console.error(`  class: ${result.class}`);
    console.error(`  why  : ${result.reason}`);
    console.log(result.class); // stdout = the class letter (for scripting)
  }
  process.exit(0);
}
