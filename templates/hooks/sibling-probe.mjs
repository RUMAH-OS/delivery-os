#!/usr/bin/env node
// Delivery OS — sibling probe (SessionStart hook; Governance §7 + Operating Loop "audit-before-assume").
//
// Reads each declared peer's GENERATED capability manifest (manifest.json, schema:
// templates/manifest.schema.json) and prints a one-screen reality digest at session start —
// so a plan can never quietly gate on a stale claim about a sibling repo. Earned: incident 5 —
// days planned behind an "infra gate" while the peer's API sat shipped and verified on disk;
// the skill meant to catch it had a consent-based trigger that could not fire on the unknown.
// THIS hook is the mandatory trigger the cross-system-reality-audit skill rides.
//
// Peers are declared in .claude/.verify-config.json:  { "peers": ["../sibling-repo", ...] }
// No peers declared → silent no-op (single-repo projects pay nothing).
// A peer with NO manifest is reported as UNKNOWN — never assumed; that is the point.
//
// Output goes to stderr (visible context, never blocks — a probe informs; the audit skill verifies).

import { readFileSync, statSync } from "node:fs";
import { join, basename, resolve } from "node:path";

const ROOT = process.cwd();
const STALE_HOURS = 72;

let peers = [];
try { peers = JSON.parse(readFileSync(join(ROOT, ".claude", ".verify-config.json"), "utf8")).peers || []; } catch {}
if (!peers.length) process.exit(0);

const lines = [`[sibling-probe] peer reality check (${new Date().toISOString().slice(0, 16)}Z) — plans gate on THIS, not on registry prose:`];
for (const p of peers) {
  const dir = resolve(ROOT, p);
  const name = basename(dir);
  const mPath = join(dir, "manifest.json");
  let m = null;
  try { m = JSON.parse(readFileSync(mPath, "utf8")); } catch {}
  if (!m) {
    lines.push(`  - ${name}: UNKNOWN — no generated manifest.json. Do NOT assume its state; run a read-only`);
    lines.push(`    cross-system-reality-audit before any plan that gates on it (DoD row 8).`);
    continue;
  }
  let ageH = null;
  try { ageH = (Date.now() - new Date(m.generated_at).getTime()) / 3600000; } catch {}
  if (ageH == null) { try { ageH = (Date.now() - statSync(mPath).mtimeMs) / 3600000; } catch {} }
  const stale = ageH != null && ageH > STALE_HOURS ? ` [STALE: ${Math.round(ageH)}h old — treat as hypothesis]` : "";
  const caps = [
    m.phase ? `phase=${m.phase}` : null,
    Array.isArray(m.routes) ? `routes=${m.routes.length}` : null,
    Array.isArray(m.contracts) && m.contracts.length ? `contracts: ${m.contracts.map((c) => `${c.name}@${c.version || "?"}`).join(", ")}` : null,
    m.migrations?.count != null ? `migrations=${m.migrations.count}` : null,
    m.verify?.latest ? `last VERIFY: ${m.verify.latest} (${m.verify.status || "?"})` : null,
  ].filter(Boolean).join(" · ");
  lines.push(`  - ${name}: ${caps || "manifest present, empty"}${stale}`);
}
lines.push(`  Rule: a cross-repo gate/blocker in any plan must cite a same-day audit or this probe's output — never a hand-maintained status (Governance §7).`);
process.stderr.write(lines.join("\n") + "\n");
process.exit(0);
