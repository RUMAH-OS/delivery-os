// =============================================================================
// Delivery OS — deterministic knowledge-router (v6 Knowledge Layer). Zero-dep.
// =============================================================================
// "Move from Markdown → Claude → Execution to Knowledge → Retrieval → Citation →
// Trust." (KNOWLEDGE-LAYER-ARCHITECTURE.md.) A near-verbatim FORK of skill-route
// (#8): a knowledge unit (KU) is a `wiki/<kuId>/KU.md` doc with the SAME machine-
// parseable frontmatter parser as skills — what it ASSERTS (`topics[]`, the knowledge
// analog of a skill's `capabilities[]`) and the task phrases that should retrieve it
// (`triggers[]`). Given a task, this RANKS the corpus DETERMINISTICALLY (no randomness,
// no LLM) — the SAME concern-agnostic scorer skill-route uses, zero new scoring
// philosophy. The top-ranked KU is the one to inject; ties break by kuId (stable). The
// router is the ONLY observable path to a KU — a raw `Read` produces no record and
// counts as zero (fail-closed by construction).
//
//   import { routeKnowledge, loadKnowledge } from "./knowledge-route.mjs"
//   node knowledge-route.mjs "<task>" [corpusDir]                    # prints the ranked match
//   node knowledge-route.mjs "<task>" --log <path> [--batch <id>] [--corpus <dir>]
//
// Scoring (deterministic, explainable — IDENTICAL to skill-route, no new scorer):
//   +10  a trigger PHRASE is a substring of the task (strongest signal)
//   +3   per DISTINCT task token matching a trigger token (deduped across triggers)
//   +1   per DISTINCT task token matching a topic token (deduped, not double-counted)
//   +0.5 per task token found in the kuId
//
// KNOWLEDGE-USAGE-PROOF (mirrors SKILL-USAGE-PROOF / SKILL-PROOF-ARCHITECTURE.md): with
// --log this mints a `proofId = sha1(task + chosen + counter)` that THREADS the evidence
// chain (retrieval → injection → citation@hash → trust), appends a re-runnable selection
// record to the JSONL, and PRINTS the retrieval MARKER `[knowledge:<kuId>#<proofId>]` for
// the orchestrator to embed VERBATIM in the spawned agent's prompt — so the marker appears
// in the transcript's first record (injection, provable by construction). The KU body is
// content-hashed (`computeContentHash`) so a citation can be re-found AT THE RETRIEVED HASH
// (K3 ATTESTED) — verifying against the live body instead of the pinned hash is a telemetry-
// integrity hole the hash closes. Retrieval alone is `evidence-strength: log` (NEVER adoption).
// =============================================================================

import { readdirSync, appendFileSync, readFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseFrontmatter } from "./skill-frontmatter.mjs";

const STOP = new Set(["the", "a", "an", "to", "of", "for", "and", "or", "is", "it", "this", "that", "with", "on", "in", "my", "i", "we", "should", "do", "run", "how", "can", "be", "are", "need"]);
const toks = (s) => String(s || "").toLowerCase().match(/[a-z0-9]+/g)?.filter((t) => t.length > 2 && !STOP.has(t)) ?? [];

// Load the corpus: every `wiki/<kuId>/KU.md` (parallel to skill-route's loadSkills over
// `.claude/skills/<name>/SKILL.md`). Identity = the directory name (= the kuId, path-
// independent). Reuses the SKILL.md frontmatter parser. `topics[]` is the knowledge analog
// of a skill's `capabilities[]`; `triggers[]` are the retrieval phrases. Fail-closed: a KU
// whose frontmatter can't be parsed loads with empty fields (it simply never matches).
export function loadKnowledge(corpusDir) {
  return readdirSync(corpusDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      try {
        const fm = parseFrontmatter(readFileSync(join(corpusDir, e.name, "KU.md"), "utf8"));
        return {
          kuId: fm.kuId || e.name,
          title: fm.title ?? "",
          topics: fm.topics ?? [],
          triggers: fm.triggers ?? [],
          status: fm.status ?? "active",
          version: fm.version ?? "1",
        };
      } catch { return { kuId: e.name, title: "", topics: [], triggers: [], status: "active", version: "1" }; }
    })
    // skip retired/superseded units — only ACTIVE knowledge is routable (an inactive KU is
    // not a current answer; fail-closed so a stale unit can never be retrieved as truth).
    .filter((u) => u.status !== "retired" && u.status !== "superseded")
    .sort((a, b) => String(a.kuId).localeCompare(String(b.kuId)));
}

// The SAME scorer as skill-route/agent-route (concern-agnostic) — `topics` plays the role
// `capabilities` plays for skills. No new scoring philosophy: keyword/term-overlap only.
export function scoreUnit(taskLower, taskTokens, unit) {
  let score = 0;
  const reasons = [];
  const taskSet = new Set(taskTokens);
  // 1. whole-phrase trigger match — the strongest signal (a real phrasing of the task).
  for (const trig of unit.triggers || []) {
    const tl = String(trig).toLowerCase();
    if (tl.length > 3 && taskLower.includes(tl)) { score += 10; reasons.push(`trigger~"${trig}"`); }
  }
  // 2. DISTINCT task-tokens that appear in ANY trigger token, deduped across triggers
  //    (a generic word repeated across N triggers counts ONCE — scattered repetition of
  //    one common token must NOT beat a genuine phrase match: the dedup property).
  const trigTokens = new Set();
  for (const trig of unit.triggers || []) for (const t of toks(trig)) trigTokens.add(t);
  const trigHits = [...taskSet].filter((t) => trigTokens.has(t));
  if (trigHits.length) { score += 3 * trigHits.length; reasons.push(`trig:${trigHits.join("/")}`); }
  // 3. DISTINCT task-tokens in ANY topic, deduped, not already counted via triggers.
  const topicTokens = new Set();
  for (const topic of unit.topics || []) for (const t of toks(topic)) topicTokens.add(t);
  const topicHits = [...taskSet].filter((t) => topicTokens.has(t) && !trigTokens.has(t));
  if (topicHits.length) { score += topicHits.length; reasons.push(`topic:${topicHits.join("/")}`); }
  // 4. kuId tokens (weak tiebreak).
  for (const t of toks(unit.kuId)) if (taskSet.has(t)) score += 0.5;
  return { score, reasons };
}

// Deterministic ranking. Returns [{kuId, score, reasons}] sorted desc, ties by kuId.
export function routeKnowledge(task, units) {
  const taskLower = String(task || "").toLowerCase();
  const taskTokens = toks(task);
  return units
    .map((u) => ({ kuId: u.kuId, ...scoreUnit(taskLower, taskTokens, u) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => (b.score - a.score) || String(a.kuId).localeCompare(String(b.kuId)));
}

// --- KNOWLEDGE-USAGE-PROOF: proofId + retrieval marker + selection log -----------------------
// PROOF-ID: the join key threading retrieval → injection → citation@hash → trust. Minted at
// trigger from (task + chosen + counter) so it is DETERMINISTIC + re-derivable (the counter
// is the pre-existing line count of the log, so concurrent identical tasks get distinct ids).
// Byte-identical recipe to skill-route.mintProofId (shared spine, not a fork of the scorer).
export function mintProofId(task, chosen, counter) {
  return createHash("sha1").update(`${task} ${chosen} ${counter}`).digest("hex").slice(0, 12);
}

// The marker the orchestrator embeds VERBATIM in the spawned agent's prompt. Mirrors
// skill-route.injectionMarker (`[skill:<name>#<proofId>]`); its verbatim presence in the
// transcript's FIRST record IS the injection proof (knowledge-health greps it). Two-arg by
// design (kuId, proofId) — the dispatch-runner mints the version-binding separately via the
// contentHash, so the marker stays a stable join key independent of the version string.
export function retrievalMarker(kuId, proofId) {
  return `[knowledge:${kuId}#${proofId}]`;
}

// --- the KU body + its content hash (citation-binding + currency proof) ----------------------
// bodyOf — extract the citable BODY of a KU: everything AFTER the `---` frontmatter block.
// The body is what a citation must re-find verbatim (K3), so it must EXCLUDE the frontmatter
// (the machine contract, not the claim). Tolerant of a missing/partial frontmatter block (then
// the whole text is the body) and of CRLF. Trimmed so trailing-whitespace churn does not move
// the contentHash.
export function bodyOf(raw) {
  const text = String(raw || "");
  // strip a leading `---\n ... \n---` frontmatter block if present.
  const m = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  const body = m ? text.slice(m[0].length) : text;
  return body.trim();
}

// computeContentHash — sha256 over the KU body (first 16 hex). Tamper-evidence + the citation
// binding (a citation is valid only AT THIS HASH) + currency proof (a superseded body hashes
// differently, so a quote found in the latest but not at the retrieved hash is `version-mismatch`).
// node:crypto, same primitive the dispatch-runner uses for injectionBlockHash.
export function computeContentHash(body) {
  return createHash("sha256").update(String(body || "")).digest("hex").slice(0, 16);
}

// Port of skill-route's appendSelection/readSelections (verbatim pattern). One JSONL line per
// retrieval; tolerant reader skips blank/partial lines. This is the K1 retrieval record:
// re-runnable (chosen/score/why re-derivable from the same task+corpus) → evidence-strength: log.
// NEVER adoption: used/trust still require a content-bound citation@hash in the spawned transcript.
export function appendSelection(logPath, record) {
  try { mkdirSync(dirname(logPath), { recursive: true }); } catch {}
  appendFileSync(logPath, JSON.stringify(record) + "\n");
}

export function readSelections(logPath) {
  let text;
  try { text = readFileSync(logPath, "utf8"); } catch { return []; }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* tolerant of blank/partial lines */ }
  }
  return out;
}

// --- self-test: routing, dedup, proofId determinism, marker shape, body/hash, log round-trip ---
function selfTest() {
  const fail = (m) => { console.error(`knowledge-route --self-test FAIL: ${m}`); process.exit(1); };
  const units = [
    { kuId: "ku-issued-artifact-immutability", topics: ["snapshot-at-issue", "historical-artifact"], triggers: ["adding a field to an issued invoice", "is an issued invoice mutable"], status: "active" },
    { kuId: "ku-migration-fidelity", topics: ["provenance"], triggers: ["importing a legacy record"], status: "active" },
    // noise: repeats a generic token across many triggers — must NOT beat a genuine phrase match.
    { kuId: "ku-noise", topics: ["invoice invoice invoice"], triggers: ["invoice a", "invoice b", "invoice c", "invoice d"], status: "active" },
    // retired: must NEVER route (status filter is in loadKnowledge, but routeKnowledge here is
    // fed pre-filtered units — so this row models the loader's contract, kept active to exercise scoring).
  ];
  // 1. expected top for a known immutability task (genuine phrase + token overlap dominates).
  const top = routeKnowledge("adding a field to an issued invoice already sent", units)[0];
  if (!top || top.kuId !== "ku-issued-artifact-immutability") fail(`expected ku-issued-artifact-immutability top, got ${top ? top.kuId : "(none)"}`);
  // 2. dedup property: noise must not outrank the genuine match via repetition.
  const ranked = routeKnowledge("adding a field to an issued invoice already sent", units);
  const noise = ranked.find((r) => r.kuId === "ku-noise");
  const real = ranked.find((r) => r.kuId === "ku-issued-artifact-immutability");
  if (noise && real && noise.score >= real.score) fail(`dedup violated: noise (${noise.score}) >= real (${real.score})`);
  // 3. proofId is deterministic for the same (task, chosen, counter) and varies with counter.
  const a1 = mintProofId("t", "ku-issued-artifact-immutability", 0);
  const a2 = mintProofId("t", "ku-issued-artifact-immutability", 0);
  const a3 = mintProofId("t", "ku-issued-artifact-immutability", 1);
  if (a1 !== a2) fail(`proofId not deterministic: ${a1} != ${a2}`);
  if (a1 === a3) fail(`proofId did not vary with counter: ${a1} == ${a3}`);
  if (!/^[0-9a-f]{12}$/.test(a1)) fail(`proofId shape wrong: ${a1}`);
  // 4. marker shape is exactly [knowledge:<kuId>#<proofId>].
  const marker = retrievalMarker("ku-issued-artifact-immutability", a1);
  if (marker !== `[knowledge:ku-issued-artifact-immutability#${a1}]`) fail(`marker shape wrong: ${marker}`);
  // 5. bodyOf strips the frontmatter; computeContentHash is deterministic + binds the body.
  const raw = "---\nkuId: ku-x\nstatus: active\n---\n# Immutability\n\nAn issued invoice is a historical artifact, not a live view.\n";
  const body = bodyOf(raw);
  if (/kuId:/.test(body)) fail(`bodyOf did not strip frontmatter: ${body.slice(0, 40)}`);
  if (!body.includes("historical artifact, not a live view")) fail(`bodyOf dropped the body: ${body.slice(0, 40)}`);
  const h1 = computeContentHash(body);
  const h2 = computeContentHash(body);
  if (h1 !== h2) fail(`contentHash not deterministic: ${h1} != ${h2}`);
  if (!/^[0-9a-f]{16}$/.test(h1)) fail(`contentHash shape wrong: ${h1}`);
  // a different body → a different hash (currency/tamper evidence).
  if (computeContentHash(body) === computeContentHash(body + " edited")) fail(`contentHash did not change with the body`);
  // bodyOf tolerates a frontmatter-less doc (whole text is the body).
  if (bodyOf("# No frontmatter\n\nplain claim.") !== "# No frontmatter\n\nplain claim.") fail(`bodyOf mishandled a frontmatter-less doc`);
  // 6. selection log round-trip (append then read back).
  let logOk = false;
  try {
    const tmp = mkdtempSync(join(tmpdir(), "knowledge-route-st-"));
    const lp = join(tmp, "sel.jsonl");
    appendSelection(lp, { proofId: a1, task: "t", chosen: "ku-issued-artifact-immutability", kuId: "ku-issued-artifact-immutability", contentHash: h1, score: 13, why: ["trigger~x"], candidates: [] });
    const rows = readSelections(lp);
    logOk = rows.length === 1 && rows[0].proofId === a1 && rows[0].kuId === "ku-issued-artifact-immutability" && rows[0].contentHash === h1;
    rmSync(tmp, { recursive: true, force: true });
  } catch (e) { fail(`log round-trip threw ${e && e.message}`); }
  if (!logOk) fail(`log round-trip did not preserve the record`);
  console.error("knowledge-route --self-test PASS (routing + dedup + proofId determinism + marker shape + bodyOf/contentHash + log round-trip)");
  process.exit(0);
}

// --- CLI ---
function sameFile(p) { try { return p && p.startsWith("file:") ? fileURLToPath(p) : p; } catch { return p; } }
if (process.argv[1] && fileURLToPath(import.meta.url) === sameFile(process.argv[1])) {
  const argv = process.argv.slice(2);
  if (argv.includes("--self-test")) selfTest();
  const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const positional = argv.filter((a, i) => !a.startsWith("--") && !(i > 0 && argv[i - 1].startsWith("--")));
  const task = positional[0];
  const dir = flag("--corpus") || positional[1] || join(process.cwd(), "wiki");
  const logPath = flag("--log");
  const batch = flag("--batch");
  if (!task) { console.error('knowledge-route: usage: node knowledge-route.mjs "<task>" [corpusDir] [--log <path>] [--batch <id>] [--corpus <dir>]'); process.exit(2); }
  const units = loadKnowledge(dir);
  const ranked = routeKnowledge(task, units);
  if (!ranked.length) { console.error(`knowledge-route: no KU matched "${task}" — no deterministic retrieval (candidate for a new promoted unit).`); process.exit(1); }
  console.error(`knowledge-route · ${ranked.length} match(es) for: "${task}"`);
  for (const r of ranked.slice(0, 3)) console.error(`  ${r.score.toFixed(1).padStart(5)}  ${r.kuId}  (${r.reasons.slice(0, 4).join(", ")})`);
  const chosen = ranked[0].kuId;
  if (logPath) {
    const counter = readSelections(logPath).length; // pre-existing line count → distinct ids for identical tasks
    const proofId = mintProofId(task, chosen, counter);
    const raw = (() => { try { return readFileSync(join(dir, chosen, "KU.md"), "utf8"); } catch { return ""; } })();
    const body = bodyOf(raw);
    const contentHash = body ? computeContentHash(body) : null;
    const marker = retrievalMarker(chosen, proofId);
    appendSelection(logPath, {
      proofId, ts: null, task, query: task, chosen, kuId: chosen, contentHash,
      contentEncoding: "text/markdown",
      score: ranked[0].score,
      why: ranked[0].reasons,
      candidates: ranked.map((r) => ({ kuId: r.kuId, score: r.score })),
      parallelBatch: batch,
    });
    const kuMd = join(dir, chosen, "KU.md");
    console.error(`knowledge-route · logged retrieval → ${logPath}${batch ? ` (batch ${batch})` : ""}`);
    console.error(`  chosen:      ${chosen}`);
    console.error(`  kuMd:        ${kuMd}`);
    console.error(`  proofId:     ${proofId}`);
    console.error(`  contentHash: ${contentHash}`);
    console.error(`  MARKER (embed verbatim in the spawned agent's prompt): ${marker}`);
    console.log(marker); // stdout = the retrieval marker (for the orchestrator to embed)
  } else {
    console.log(chosen); // stdout = the route (back-compat: bare scripting)
  }
  process.exit(0);
}
