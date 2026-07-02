// =============================================================================
// MODEL-AGNOSTIC ENFORCEMENT LINT (ADR-reasoning-model-routing.md §"Model-agnostic enforcement").
// =============================================================================
// The GUARANTEE: organ code names reasoning CLASSES, never model IDs. This test asserts ZERO model-ID string
// literals anywhere under platform/src/** — except the config-loader path allowlist. The single home of every
// model ID is platform/reasoning-routing.config.json (which is DATA, outside src/**, so it is never scanned).
// If this test goes red, a model version string leaked into code: move it to the config registry and reference
// the class instead. This is how "swap a model = a config edit, no code change" stays TRUE over time.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, relative, sep } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(here, "..", "src");

// Real model-ID shapes: family + a VERSION digit (claude-sonnet-5-0, gpt-4o, gemini-2-0). Requiring a version
// digit avoids false positives on prose/filenames like "agent-runner-claude-executor.ts". Extend as providers
// are added — the point is that NO concrete model id may live in code.
const MODEL_ID_PATTERNS: readonly RegExp[] = [
  /claude-[a-z]+-[0-9][a-z0-9.-]*/gi,
  /gpt-[0-9o][a-z0-9.-]*/gi,
  /gemini-[0-9][a-z0-9.-]*/gi,
  /llama-[0-9][a-z0-9.-]*/gi,
  /mistral-[a-z0-9]*[0-9][a-z0-9.-]*/gi,
];

// The ONLY allowlisted path under src/**: the config LOADER (it touches the registry by design; it currently
// holds zero model strings, but is allowlisted intentionally as the sanctioned config path per the ADR).
const ALLOWLIST: readonly string[] = ["reasoning/routing-config.ts"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

function relPosix(full: string): string {
  return relative(SRC_ROOT, full).split(sep).join("/");
}

describe("model-agnostic enforcement — zero model-ID literals under src/**", () => {
  const files = walk(SRC_ROOT).filter((f) => !ALLOWLIST.includes(relPosix(f)));

  it("scans a non-trivial number of source files (the walk actually found src/)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("finds NO model-ID string literal in any non-allowlisted source file", () => {
    const offenders: Array<{ file: string; line: number; match: string }> = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const pat of MODEL_ID_PATTERNS) {
          const m = line.match(pat);
          if (m) offenders.push({ file: relPosix(file), line: i + 1, match: m.join(", ") });
        }
      });
    }
    expect(offenders, `model-ID literals leaked into code (move to reasoning-routing.config.json):\n${offenders.map((o) => `  src/${o.file}:${o.line}  ${o.match}`).join("\n")}`).toEqual([]);
  });

  it("the allowlist itself contains zero model-ID literals (the loader stays model-string-free)", () => {
    for (const rel of ALLOWLIST) {
      const content = readFileSync(resolve(SRC_ROOT, rel), "utf8");
      for (const pat of MODEL_ID_PATTERNS) {
        expect(content.match(pat), `${rel} unexpectedly contains a model-ID literal`).toBeNull();
      }
    }
  });
});
