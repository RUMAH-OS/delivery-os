#!/usr/bin/env node
// =============================================================================
// Delivery OS — os-inherit (the OS UPGRADE PATH for skills + tools + ENGINES). Zero-dep.
// =============================================================================
// The capability chain ends at "Every Project Inherits". os-sync already propagates
// AGENTS (base+overlay). This propagates the OS-FOUNDATIONAL tools, contracts, skills,
// and ENGINES listed in capabilities/os-foundation.manifest.json INTO a consuming
// project — VENDORED (byte-for-byte) so the project is self-contained (the gates run
// in its CI without the OS mounted), and DRIFT-CHECKED so the inherited copy can never
// silently diverge from canonical. A capability is only complete when this carries it.
//
//   node os-inherit.mjs sync          --from <delivery-os> --into <project>   # vendor + record
//   node os-inherit.mjs check         --from <delivery-os> --into <project>   # fail-closed drift gate (tools/contracts/skills)
//   node os-inherit.mjs engine-check  --from <delivery-os> --into <project>   # fail-closed drift gate for ENGINES (3-way + DDL parity)
//
// Vendored layout in the project:
//   .claude/os/tools/<basename>      <- tools + contracts (flat, byte-identical)
//   .claude/skills/<name>/           <- OS-foundational skills (whole dir)
//   .claude/os/engine/               <- OS-foundational engine (whole dir, byte-identical)
//   .claude/os/INHERITED.json        <- {osVersion, manifestVersion, files:[{rel, sha256}]}  (tools/contracts/skills)
//   .claude/os/INHERITED-<key>.json  <- {osVersion, source, files:[{rel, sha256}]}           (one per engine)
//
// ENGINE drift gate (the LOCK — "engine is OWNED by Delivery OS, only INSTALLED here"):
//   FAILS (non-zero) if EITHER side moved:
//     (a) the installed .claude/os/engine/** diverges from the recorded INHERITED-<key>.json
//         hashes  -> someone hand-edited the vendored copy locally;
//     (b) the recorded hashes diverge from canonical templates/workflow-engine/**
//         -> the install is STALE vs canonical (re-run `sync`).
//   The failure message names the drifted file AND which side changed.
//   It also runs a DDL PARITY check: the app's applied engine migrations must be
//   STRUCTURALLY equivalent to the engine's canonical migration set (the engine OWNS
//   the DDL; the app applies an equivalent instance). See ddlParity below.
//
//   MULTI-TENANT (per-app) ddlParity: the app's APPLIED migration FILE PATHS are
//   PROJECT-LOCAL — declared in the consuming project's .claude/os/engine.config.json
//   ({ "<engineKey>": { "appMigrations": [ "migrations/…" ] } }), NOT hardcoded in the
//   shared manifest. engine-check reads that per-app declaration (falling back to a
//   shared-manifest ddlParity.appMigrations only if the local config is absent). The
//   shared manifest still owns the CANONICAL set (canonicalDir). So every installer
//   (Admin, the demo-app, PLOS) is fully drift-green against its OWN migration paths.
// =============================================================================

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync, rmSync } from "node:fs";
import { join, dirname, basename, relative } from "node:path";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

const argv = process.argv.slice(2);
const mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const FROM = opt("--from", join(process.cwd(), "..", "delivery-os")); // OS canonical source
const INTO = opt("--into", process.cwd()); // the consuming project

const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const read = (p) => readFileSync(p);
const ensureDir = (p) => mkdirSync(p, { recursive: true });
function osVersion(repo) {
  try { return execSync("git describe --tags --always", { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); }
  catch { return "untagged"; }
}
function listFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listFiles(p, out); else out.push(p);
  }
  return out;
}

function loadManifest() {
  const mp = join(FROM, "capabilities", "os-foundation.manifest.json");
  if (!existsSync(mp)) fail(2, `manifest not found at ${mp} (is --from a delivery-os checkout?)`);
  return JSON.parse(readFileSync(mp, "utf8"));
}
function fail(code, msg) { console.error(`os-inherit: ${msg}`); process.exit(code); }

// Resolve the manifest tools/contracts/skills into concrete (sourceAbsPath, vendorRelPath) pairs.
function plan(man) {
  const items = [];
  for (const t of [...(man.tools || []), ...(man.contracts || [])]) {
    items.push({ src: join(FROM, t), rel: join(".claude", "os", "tools", basename(t)) });
  }
  for (const s of man.skills || []) {
    const sdir = join(FROM, ".claude", "skills", s);
    if (!existsSync(sdir)) fail(2, `manifest skill "${s}" not found at ${sdir}`);
    for (const f of listFiles(sdir)) items.push({ src: f, rel: join(".claude", "skills", s, relative(sdir, f)) });
  }
  return items;
}

// Resolve a manifest ENGINE entry into (sourceAbsPath, vendorRelPath) pairs (whole directory).
// An engine entry: { key, source (dir under FROM), into (dir under INTO), record (INHERITED-<key>.json) }.
function planEngine(eng) {
  const srcDir = join(FROM, eng.source);
  if (!existsSync(srcDir)) fail(2, `manifest engine "${eng.key}" source not found at ${srcDir}`);
  const intoRel = eng.into || join(".claude", "os", "engine");
  const items = [];
  for (const f of listFiles(srcDir).sort()) {
    items.push({ src: f, rel: join(intoRel, relative(srcDir, f)) });
  }
  return { items, intoRel, srcDir };
}
const engineRecordPath = (eng) => join(".claude", "os", eng.record || `INHERITED-${eng.key}.json`);

function doSync(man) {
  // 1) tools / contracts / skills -> flat/dir vendor + INHERITED.json (unchanged behaviour).
  const items = plan(man);
  const records = [];
  for (const it of items) {
    if (!existsSync(it.src)) fail(2, `manifest source missing: ${it.src}`);
    const buf = read(it.src);
    const dest = join(INTO, it.rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, buf); // byte-for-byte — exact, so `check` is exact
    records.push({ rel: it.rel.replace(/\\/g, "/"), sha256: sha(buf) });
  }
  const inh = {
    osVersion: osVersion(FROM), manifestVersion: man.manifestVersion,
    note: "VENDORED from delivery-os via os-inherit. Do NOT hand-edit these files; re-run `os-inherit sync`. `os-inherit check` fails if they drift from canonical.",
    files: records.sort((a, b) => a.rel.localeCompare(b.rel)),
  };
  ensureDir(join(INTO, ".claude", "os"));
  writeFileSync(join(INTO, ".claude", "os", "INHERITED.json"), JSON.stringify(inh, null, 2) + "\n");
  console.error(`os-inherit sync · OS ${inh.osVersion} · vendored ${records.length} file(s) into ${INTO}`);
  for (const r of records) console.error(`  + ${r.rel}`);

  // 2) ENGINES -> whole-directory vendor, byte-identical, + a per-engine INHERITED-<key>.json record.
  for (const eng of man.engines || []) {
    const { items: eItems, intoRel } = planEngine(eng);
    const eRecords = [];
    for (const it of eItems) {
      const buf = read(it.src);
      const dest = join(INTO, it.rel);
      ensureDir(dirname(dest));
      writeFileSync(dest, buf); // byte-for-byte
      eRecords.push({ rel: it.rel.replace(/\\/g, "/"), sha256: sha(buf) });
    }
    const rec = {
      osVersion: osVersion(FROM),
      manifestVersion: man.manifestVersion,
      key: eng.key,
      source: eng.source.replace(/\\/g, "/"),
      note: `VENDORED (sha-pinned) from delivery-os/${eng.source.replace(/\\/g, "/")} — the CANONICAL ${eng.key}. Do NOT hand-edit these files; re-run \`os-inherit sync\`. \`os-inherit engine-check\` fails if the installed copy drifts from these hashes OR these hashes drift from canonical.`,
      files: eRecords.sort((a, b) => a.rel.localeCompare(b.rel)),
    };
    ensureDir(join(INTO, ".claude", "os"));
    writeFileSync(join(INTO, engineRecordPath(eng)), JSON.stringify(rec, null, 2) + "\n");
    console.error(`os-inherit sync · engine "${eng.key}" · vendored ${eRecords.length} file(s) -> ${intoRel} (record ${engineRecordPath(eng).replace(/\\/g, "/")})`);
  }
  console.error(`agents (${(man.agents || []).join(", ")}) propagate via os-sync (base+overlay) — run that separately.`);
}

function doCheck(man) {
  const items = plan(man);
  const violations = [];
  for (const it of items) {
    const dest = join(INTO, it.rel);
    if (!existsSync(dest)) { violations.push(`MISSING: ${it.rel} (run \`os-inherit sync\` — project has not inherited this capability)`); continue; }
    if (sha(read(dest)) !== sha(read(it.src))) violations.push(`DRIFT: ${it.rel} differs from canonical (re-sync, or stop hand-editing a vendored OS capability)`);
  }
  console.error(`os-inherit check · OS ${osVersion(FROM)} · ${items.length} inherited file(s)`);
  if (violations.length === 0) { console.error(`PASS: every inherited capability is byte-current with the OS.`); process.exit(0); }
  console.error(`FAIL: ${violations.length} inheritance violation(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

// ── ENGINE drift gate: a 3-way lock + DDL parity ────────────────────────────────────────────────
// For each manifest engine:
//   (a) installed file hash  vs  recorded hash   (local hand-edit of the vendored copy)
//   (b) recorded hash        vs  canonical hash  (stale install vs canonical)
//   plus file-set parity (a recorded file missing on disk; a canonical file not recorded; an extra
//   installed engine file not recorded).
// Then a DDL PARITY check (ddlParity in the manifest) — see normalizeSql / ddlObjects.
function doEngineCheck(man) {
  const engines = man.engines || [];
  if (engines.length === 0) { console.error(`os-inherit engine-check · no engines in manifest — nothing to check.`); process.exit(0); }
  let totalFiles = 0;
  const violations = [];
  for (const eng of engines) {
    const recAbs = join(INTO, engineRecordPath(eng));
    if (!existsSync(recAbs)) { violations.push(`MISSING RECORD: ${engineRecordPath(eng).replace(/\\/g, "/")} for engine "${eng.key}" (run \`os-inherit sync\`)`); continue; }
    const rec = JSON.parse(readFileSync(recAbs, "utf8"));
    const recorded = new Map(rec.files.map((f) => [f.rel, f.sha256]));

    const { items: canon } = planEngine(eng);
    const canonByRel = new Map(canon.map((it) => [it.rel.replace(/\\/g, "/"), it.src]));
    const intoRel = (eng.into || join(".claude", "os", "engine")).replace(/\\/g, "/");

    // (a) + (b) over the recorded set.
    for (const [rel, recHash] of recorded) {
      const dest = join(INTO, rel);
      if (!existsSync(dest)) { violations.push(`INSTALL MISSING: ${rel} is recorded but absent on disk (engine "${eng.key}"; re-run \`os-inherit sync\`)`); }
      else { totalFiles++; if (sha(read(dest)) !== recHash) violations.push(`LOCAL DRIFT: ${rel} — the INSTALLED copy differs from the recorded hash (someone hand-edited the vendored engine; re-run \`os-inherit sync\` or revert the edit). engine="${eng.key}"`); }
      const canonSrc = canonByRel.get(rel);
      if (!canonSrc) { violations.push(`ORPHAN RECORD: ${rel} is recorded but no longer exists in canonical (engine "${eng.key}"; re-run \`os-inherit sync\`)`); }
      else if (sha(read(canonSrc)) !== recHash) violations.push(`STALE INSTALL: ${rel} — the RECORDED hash differs from CANONICAL (install is stale vs delivery-os; re-run \`os-inherit sync\`). engine="${eng.key}"`);
    }
    // canonical files not present in the record (a new engine file shipped but not installed).
    for (const rel of canonByRel.keys()) if (!recorded.has(rel)) violations.push(`UNRECORDED CANONICAL: ${rel} exists in canonical but is not recorded/installed (engine "${eng.key}"; re-run \`os-inherit sync\`)`);
    // installed engine files under intoRel not in the record (an added local engine file).
    const installDir = join(INTO, intoRel);
    if (existsSync(installDir)) {
      for (const f of listFiles(installDir)) {
        const rel = relative(INTO, f).replace(/\\/g, "/");
        if (!recorded.has(rel)) violations.push(`UNTRACKED INSTALL: ${rel} exists in the installed engine but is not recorded (an added local engine file — engines are OS-owned; remove it or add it to canonical). engine="${eng.key}"`);
      }
    }

    // DDL PARITY (structural) — the engine OWNS the DDL; the app applies an equivalent instance.
    for (const v of ddlParity(eng)) violations.push(v);
  }

  console.error(`os-inherit engine-check · OS ${osVersion(FROM)} · ${engines.length} engine(s) · ${totalFiles} installed engine file(s)`);
  if (violations.length === 0) {
    console.error(`PASS: every installed engine is byte-current with canonical (no local edit, not stale) AND the applied DDL is structurally equivalent to the canonical engine migration set.`);
    process.exit(0);
  }
  console.error(`FAIL: ${violations.length} engine drift/parity violation(s):`);
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

// ── DDL parity (structural) ──────────────────────────────────────────────────────────────────────
// The canonical engine SHIPS its migration set (templates/workflow-engine/migrations/). An installer
// applies an EQUIVALENT instance into its own migration sequence (renumbered, possibly split across
// files, with installer-specific header comments and installer-owned infra DDL e.g. an outbox COMMENT).
// A byte/line comparison therefore CANNOT pass. We instead assert STRUCTURAL equivalence: every
// canonical engine DDL OBJECT (CREATE TABLE/INDEX/TRIGGER/FUNCTION + CHECK constraint bodies + ALTER…
// ADD CONSTRAINT) is present, after comment-stripping + whitespace-normalisation, in the app's applied
// set — and the final CHECK-constraint bodies (which may arrive via a later widening ALTER) match.
// The manifest declares the mapping: ddlParity = { canonicalDir, appMigrations:[…], ignore:[…regex] }.
function stripSqlComments(sql) {
  return sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ""))         // line comments
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");          // block comments
}
function normalizeSql(sql) {
  return stripSqlComments(sql)
    .replace(/\s+/g, " ")                        // collapse whitespace
    .replace(/\s*;\s*/g, ";")
    .trim();
}
// Split normalised SQL into individual statements (naive ; split — engine DDL has no string literals
// containing ; except the plpgsql bodies, which use $$ … $$; we keep those whole).
function splitStatements(norm) {
  const out = [];
  let depth = 0, buf = "", inDollar = false;
  for (let i = 0; i < norm.length; i++) {
    const two = norm.slice(i, i + 2);
    if (two === "$$") { inDollar = !inDollar; buf += two; i++; continue; }
    const ch = norm[i];
    if (ch === ";" && !inDollar) { if (buf.trim()) out.push(buf.trim()); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
// Extract the comparable DDL "objects" from a normalised statement set: keyed by object identity so a
// CREATE TABLE in canonical matches the same CREATE TABLE in the app even if its inline CHECK was later
// widened by an ALTER (we fold ALTER … ADD/DROP CONSTRAINT into the table's effective CHECK set).
function ddlObjects(statements) {
  const tables = new Map();     // name -> { columns:Set, checks:Set }
  const indexes = new Set();    // normalized CREATE [UNIQUE] INDEX … bodies
  const triggers = new Set();   // normalized CREATE TRIGGER bodies
  const functions = new Set();  // normalized function signatures + bodies
  const policies = new Set();   // normalized CREATE POLICY bodies
  const rls = new Set();        // ENABLE ROW LEVEL SECURITY targets

  const tableOf = (name) => { if (!tables.has(name)) tables.set(name, { columns: new Set(), checks: new Set() }); return tables.get(name); };
  // pull the CHECK(...) expressions (balanced parens) out of a blob.
  const extractChecks = (blob) => {
    const checks = [];
    let i = 0;
    while ((i = blob.toUpperCase().indexOf("CHECK", i)) !== -1) {
      let j = blob.indexOf("(", i); if (j === -1) break;
      let depth = 0, k = j;
      for (; k < blob.length; k++) { if (blob[k] === "(") depth++; else if (blob[k] === ")") { depth--; if (depth === 0) { k++; break; } } }
      checks.push(blob.slice(j, k).replace(/\s+/g, " ").trim());
      i = k;
    }
    return checks;
  };

  for (const s of statements) {
    const up = s.toUpperCase();
    if (up.startsWith("CREATE TABLE")) {
      const m = s.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?([A-Za-z0-9_."]+)\s*\(([\s\S]*)\)\s*$/i);
      if (m) {
        const t = tableOf(m[1].toLowerCase());
        for (const c of extractChecks(m[2])) t.checks.add(c);
        // column NAMES (first token of each top-level comma segment that isn't a constraint keyword).
        let depth = 0, seg = "";
        const segs = [];
        for (const ch of m[2]) { if (ch === "(") depth++; if (ch === ")") depth--; if (ch === "," && depth === 0) { segs.push(seg); seg = ""; } else seg += ch; }
        if (seg.trim()) segs.push(seg);
        for (const sg of segs) {
          const tok = sg.trim().split(/\s+/)[0];
          if (!tok) continue;
          if (/^(CHECK|CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|REFERENCES)$/i.test(tok)) continue;
          t.columns.add(tok.toLowerCase());
        }
      }
    } else if (/^ALTER TABLE/i.test(s)) {
      const tn = (s.match(/ALTER TABLE\s+([A-Za-z0-9_."]+)/i) || [])[1];
      if (!tn) continue;
      const t = tableOf(tn.toLowerCase());
      if (/ADD COLUMN/i.test(s)) {
        for (const mm of s.matchAll(/ADD COLUMN\s+([A-Za-z0-9_]+)/gi)) t.columns.add(mm[1].toLowerCase());
      }
      if (/ADD CONSTRAINT/i.test(s) && /CHECK/i.test(s)) for (const c of extractChecks(s)) t.checks.add(c);
      if (/DROP CONSTRAINT/i.test(s)) {
        // a widening drop+add: remove the named constraint's PRIOR check so only the final one survives.
        const cn = (s.match(/DROP CONSTRAINT\s+(?:IF EXISTS\s+)?([A-Za-z0-9_]+)/i) || [])[1];
        if (cn) t._dropped = (t._dropped || new Set()).add(cn.toLowerCase());
      }
    } else if (/^CREATE (UNIQUE )?INDEX/i.test(s)) {
      // index name can be installer-chosen identical (it is, here) — compare the whole normalized body.
      indexes.add(s.replace(/CREATE (UNIQUE )?INDEX\s+[A-Za-z0-9_]+/i, (x) => x).trim());
    } else if (/^CREATE TRIGGER/i.test(s)) {
      triggers.add(s.trim());
    } else if (/^CREATE (OR REPLACE )?FUNCTION/i.test(s)) {
      functions.add(s.trim());
    } else if (/^CREATE POLICY/i.test(s)) {
      policies.add(s.trim());
    } else if (/ENABLE ROW LEVEL SECURITY/i.test(s)) {
      const tn = (s.match(/ALTER TABLE\s+([A-Za-z0-9_."]+)/i) || [])[1];
      if (tn) rls.add(tn.toLowerCase());
    }
  }
  return { tables, indexes, triggers, functions, policies, rls };
}

// PER-APP (multi-tenant) ddlParity resolution. The SHARED manifest declares the CANONICAL engine migration
// set (canonicalDir) + structural tolerances (ignoreColumns/note) — the source of truth for the SHAPE. But
// the APP's APPLIED migration FILE PATHS are project-local (each installer renumbers/splits the engine DDL
// into its OWN migration sequence): Admin's are migrations/0034_*, the demo-app's are migrations/0001_*, PLOS
// will have its own. Hardcoding them in the shared manifest is single-tenant. We therefore read appMigrations
// from a PROJECT-LOCAL config in the consuming project (INTO):
//
//   .claude/os/engine.config.json  ->  { "<engineKey>": { "appMigrations": [ "migrations/…", … ] }, … }
//
// Resolution order (graceful fallback so existing installs keep working):
//   1) the project-local engine.config.json entry for this engine key (THE multi-tenant path), else
//   2) the engine's ddlParity.appMigrations in the shared manifest (legacy/reference fallback).
// The file-hash drift lock (the ownership guarantee) is UNCHANGED — this only governs the DDL-parity inputs.
function loadEngineConfig() {
  const cp = join(INTO, ".claude", "os", "engine.config.json");
  if (!existsSync(cp)) return null;
  try { return JSON.parse(readFileSync(cp, "utf8")); }
  catch (e) { return { __error: `engine.config.json is not valid JSON (${e.message})` }; }
}
function resolveAppMigrations(eng) {
  const cfg = loadEngineConfig();
  if (cfg && cfg.__error) return { error: cfg.__error, list: [] };
  const local = cfg && cfg[eng.key] && Array.isArray(cfg[eng.key].appMigrations) ? cfg[eng.key].appMigrations : null;
  if (local) return { list: local, source: ".claude/os/engine.config.json (project-local)" };
  const fromManifest = (eng.ddlParity && eng.ddlParity.appMigrations) || null;
  if (fromManifest) return { list: fromManifest, source: "shared manifest (fallback — no project-local engine.config.json)" };
  return { list: [], source: "none" };
}

function ddlParity(eng) {
  const p = eng.ddlParity;
  if (!p) return [];
  const violations = [];
  const canonDir = join(FROM, p.canonicalDir);
  if (!existsSync(canonDir)) return [`DDL PARITY: canonical migration dir not found at ${canonDir} (engine "${eng.key}")`];
  const resolved = resolveAppMigrations(eng);
  if (resolved.error) return [`DDL PARITY: ${resolved.error} (engine "${eng.key}")`];
  if (resolved.list.length === 0) return [`DDL PARITY: no applied app migrations declared for engine "${eng.key}" — add an entry to .claude/os/engine.config.json ({"${eng.key}":{"appMigrations":["migrations/…"]}}) or to the shared manifest's ddlParity.appMigrations`];
  const isForward = (f) => f.endsWith(".sql") && !f.endsWith(".down.sql");
  const canonSql = readdirSync(canonDir).filter(isForward).sort().map((f) => readFileSync(join(canonDir, f), "utf8")).join("\n;\n");
  const appFiles = resolved.list.map((rel) => {
    const ap = join(INTO, rel);
    if (!existsSync(ap)) { violations.push(`DDL PARITY: declared app migration not found: ${rel} (engine "${eng.key}")`); return ""; }
    return readFileSync(ap, "utf8");
  });
  if (violations.length) return violations;
  const appSql = appFiles.join("\n;\n");

  const canonObj = ddlObjects(splitStatements(normalizeSql(canonSql)));
  const appObj = ddlObjects(splitStatements(normalizeSql(appSql)));

  const ignore = (p.ignoreColumns || []).map((s) => s.toLowerCase());

  // Every canonical table must exist in the app with the same columns (modulo ignored installer cols)
  // and the same FINAL set of CHECK constraints.
  for (const [name, ct] of canonObj.tables) {
    const at = appObj.tables.get(name);
    if (!at) { violations.push(`DDL PARITY: canonical table "${name}" missing from the app's applied DDL (engine "${eng.key}")`); continue; }
    for (const col of ct.columns) if (!at.columns.has(col) && !ignore.includes(`${name}.${col}`)) violations.push(`DDL PARITY: table "${name}" — canonical column "${col}" absent in app's applied DDL (engine "${eng.key}")`);
    for (const chk of ct.checks) if (!at.checks.has(chk)) violations.push(`DDL PARITY: table "${name}" — canonical CHECK not matched in app's FINAL applied DDL: ${chk} (engine "${eng.key}")`);
  }
  // Indexes / triggers / functions / policies / RLS must all be present in the app set.
  const presence = (label, canonSet, appSet) => {
    for (const item of canonSet) if (!appSet.has(item)) violations.push(`DDL PARITY: canonical ${label} not found in app's applied DDL (engine "${eng.key}"): ${item.slice(0, 120)}${item.length > 120 ? "…" : ""}`);
  };
  presence("index", canonObj.indexes, appObj.indexes);
  presence("trigger", canonObj.triggers, appObj.triggers);
  presence("function", canonObj.functions, appObj.functions);
  presence("policy", canonObj.policies, appObj.policies);
  for (const t of canonObj.rls) if (!appObj.rls.has(t)) violations.push(`DDL PARITY: canonical RLS-enabled table "${t}" not RLS-enabled in app's applied DDL (engine "${eng.key}")`);

  return violations;
}

const man = loadManifest();
if (mode === "sync") doSync(man);
else if (mode === "check") doCheck(man);
else if (mode === "engine-check") doEngineCheck(man);
else fail(2, `usage: os-inherit.mjs <sync|check|engine-check> --from <delivery-os> --into <project>`);
