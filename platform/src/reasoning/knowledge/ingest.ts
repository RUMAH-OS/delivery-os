// =============================================================================
// KNOWLEDGE INGESTION — turn a directory of decision/ADR markdown into Knowledge Units (Frozen §10.5).
// =============================================================================
// `ingestMarkdownDir(dir)` reads a directory of Deliberative-Truth markdown (ADRs, Decision Records, Charters,
// Lessons) and parses each file into a KnowledgeUnit. This is the REAL retrieve corpus — but the corpus is
// WHATEVER dir is configured: an empty dir yields [] (an honest empty store, not a fabricated one).
//
// FAIL-CLOSED — SKIP, never FABRICATE (I4). A file that can't be read, can't be parsed, or can't produce a
// non-empty CITED claim is SKIPPED with a logged reason. The ingestor never invents a claim to "rescue" a file:
// a KU that would carry a fabricated claim is not a memory, it is a lie in the corpus. Every emitted KU is
// derived strictly from the file's own text and validated through the schema before it is returned.
//
// Parsing (deterministic, no yaml dependency):
//   · claim  = front-matter `claim`/`title`, else the first `# ` heading, else the first non-empty paragraph.
//              (no claim derivable ⇒ SKIP.)
//   · body   = the markdown after the front-matter (the retrievable text).
//   · source = the file path (the citation, I4).
//   · kind   = front-matter `kind` if a valid enum, else inferred from the filename/path (heuristic).
//   · tags   = front-matter `tags` (array or comma list), else [].
//   · id     = front-matter `id`, else the filename without extension.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import {
  KNOWLEDGE_KINDS,
  safeParseKnowledgeUnit,
  type KnowledgeKind,
  type KnowledgeUnit,
} from "./knowledge-unit.js";

/** A file the ingestor refused to turn into a KU, and WHY (fail-closed provenance). */
export interface IngestSkip {
  readonly file: string;
  readonly reason: string;
}

export interface IngestOptions {
  /** File extensions treated as knowledge docs. Default: [".md"]. */
  readonly extensions?: readonly string[];
  /** Called for every skipped file (skip-not-fabricate audit). Default: logs a warning to stderr. */
  readonly onSkip?: (skip: IngestSkip) => void;
}

/** Default skip logger — a single warn line to stderr (the codebase has no logger abstraction). */
function defaultOnSkip(skip: IngestSkip): void {
  process.stderr.write(`[knowledge:ingest] SKIP ${skip.file} — ${skip.reason}\n`);
}

interface FrontMatter {
  readonly fields: Record<string, string>;
  /** The document body AFTER the front-matter block (or the whole file when there is none). */
  readonly body: string;
}

/** Split a leading `---` … `---` YAML-ish front-matter block off the top. Minimal, deterministic, no yaml dep. */
export function splitFrontMatter(content: string): FrontMatter {
  const normalized = content.replace(/^﻿/, ""); // strip a leading BOM
  const m = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(normalized);
  if (!m) return { fields: {}, body: normalized };
  const fields: Record<string, string> = {};
  for (const raw of m[1]!.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) fields[key] = val;
  }
  return { fields, body: normalized.slice(m[0].length) };
}

/** Parse a tags field: `[a, b]` or `a, b, c` → normalized non-empty strings. */
function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const inner = raw.trim().replace(/^\[/, "").replace(/\]$/, "");
  return inner
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter((t) => t.length > 0);
}

/** The first `# ` heading in the body (its text), if any. */
function firstHeading(body: string): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    const m = /^#{1,6}\s+(.+?)\s*$/.exec(line.trim());
    if (m && m[1]) return m[1].trim();
  }
  return undefined;
}

/** The first non-empty, non-heading line — used as a claim fallback when there is no title. */
function firstParagraph(body: string): string | undefined {
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t && !t.startsWith("#")) return t;
  }
  return undefined;
}

/** Infer the KU kind from front-matter or, failing that, the filename/path. Default: "decision". */
function inferKind(fmKind: string | undefined, file: string): KnowledgeKind {
  const fm = fmKind?.trim().toLowerCase();
  if (fm && (KNOWLEDGE_KINDS as readonly string[]).includes(fm)) return fm as KnowledgeKind;
  const hay = file.toLowerCase();
  if (/(^|[/\-_])adr([/\-_]|$)|\badr\b/.test(hay)) return "adr";
  if (hay.includes("charter")) return "charter";
  if (hay.includes("lesson") || hay.includes("learning") || hay.includes("retro")) return "lesson";
  return "decision";
}

/**
 * Parse ONE markdown file into a KnowledgeUnit, or return an IngestSkip reason. Pure over (path, content):
 * never touches the filesystem, so it is directly testable. Fail-closed — a file with no derivable claim is a
 * skip, never a KU with a fabricated claim.
 */
export function parseKnowledgeFile(
  filePath: string,
  content: string,
): { unit: KnowledgeUnit } | { skip: string } {
  const { fields, body } = splitFrontMatter(content);
  const claim = (
    fields.claim ||
    fields.title ||
    firstHeading(body) ||
    firstParagraph(body) ||
    ""
  ).trim();
  if (!claim) {
    return { skip: "no derivable claim (no front-matter title/claim, no heading, no paragraph)" };
  }
  const id = (fields.id || basename(filePath, extname(filePath))).trim();
  const candidate: Record<string, unknown> = {
    id,
    claim,
    body: body.trim(),
    source: filePath,
    kind: inferKind(fields.kind, filePath),
    tags: parseTags(fields.tags),
  };
  const updatedAt = (fields.updatedat || fields.date || "").trim();
  if (updatedAt) candidate.updatedAt = updatedAt;

  const parsed = safeParseKnowledgeUnit(candidate);
  if (!parsed.success) {
    return { skip: `schema rejected the parsed unit: ${parsed.error.issues.map((i) => i.message).join("; ")}` };
  }
  return { unit: parsed.data };
}

/**
 * Ingest a directory of markdown decision docs into KnowledgeUnits. A missing/unreadable dir yields [] (honest
 * empty — never a fabricated corpus). Every unparseable file is SKIPPED (logged), never fabricated.
 */
export function ingestMarkdownDir(dir: string, opts: IngestOptions = {}): KnowledgeUnit[] {
  const extensions = opts.extensions ?? [".md"];
  const onSkip = opts.onSkip ?? defaultOnSkip;

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    // The corpus dir does not exist / is unreadable: honestly nothing ingested (never fabricate a corpus).
    return [];
  }

  const units: KnowledgeUnit[] = [];
  for (const name of entries.sort()) {
    if (!extensions.some((ext) => name.toLowerCase().endsWith(ext))) continue;
    const full = resolve(dir, name);
    let content: string;
    try {
      if (!statSync(full).isFile()) continue;
      content = readFileSync(full, "utf8");
    } catch (err) {
      onSkip({ file: full, reason: `unreadable: ${(err as Error).message}` });
      continue;
    }
    const result = parseKnowledgeFile(full, content);
    if ("skip" in result) {
      onSkip({ file: full, reason: result.skip });
      continue;
    }
    units.push(result.unit);
  }
  return units;
}
