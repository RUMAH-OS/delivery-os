#!/usr/bin/env node
// Delivery OS — framework-side wrapper: run the shipped hook/tool reference-integrity lint
// (fail-closed) against the framework's OWN tree. Consumers get the same tool installed as
// .claude/tools/check-hook-paths.mjs by the scaffolder and wired into their pre-push.
//   node scripts/check-hook-paths.mjs [--self-test|--json]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const tool = join(here, "..", "templates", "tools", "check-hook-paths.mjs");
const r = spawnSync(process.execPath, [tool, ...process.argv.slice(2)], { stdio: "inherit", cwd: join(here, "..") });
process.exit(r.status ?? 1);
