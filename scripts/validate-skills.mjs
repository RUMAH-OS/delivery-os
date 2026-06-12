#!/usr/bin/env node
// Delivery OS — framework-side wrapper: run the shipped skill-format lint (fail-closed, B37/C6)
// against the framework's OWN catalog (skills/). Consumers get the same tool installed as
// .claude/tools/validate-skills.mjs by the scaffolder and wired into their pre-push (Gate 3).
//   node scripts/validate-skills.mjs
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const tool = join(here, "..", "templates", "tools", "validate-skills.mjs");
const r = spawnSync(process.execPath, [tool, join(here, "..", "skills")], { stdio: "inherit" });
process.exit(r.status ?? 1);
