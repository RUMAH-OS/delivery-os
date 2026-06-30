#!/usr/bin/env bash
# Delivery OS — assert a host satisfies the Execution Node contract (node-contract.json).
# Read-only. Prints a PASS/WARN/FAIL line per check; exits non-zero if any hard invariant fails.
#
# Usage:  bash verify-node.sh [--require runner,heartbeat]
#   --require <caps>   comma list of capabilities that MUST be active (default: none required;
#                      workstation+localCI are always checked as floors)
set -euo pipefail
REQUIRE="${2:-}"; [ "${1:-}" = "--require" ] && REQUIRE="${2:-}"

fail=0
pass(){ echo "PASS  $1"; }
warn(){ echo "WARN  $1"; }
bad(){  echo "FAIL  $1"; fail=1; }

echo "== Delivery OS Execution Node — contract check =="

# Identity floor: must NOT execute as an admin/login-as-founder. (Heuristic: the runner user is dedicated.)
command -v gh >/dev/null && gh_id="$(gh api user --jq .login 2>/dev/null || echo '?')" || gh_id="?"
[ "$gh_id" != "?" ] && pass "github identity active: $gh_id" || warn "gh identity not resolvable"

# Toolchain floors.
command -v git  >/dev/null && pass "git $(git --version | awk '{print $3}')" || bad "git missing"
if command -v node >/dev/null; then
  nv="$(node -v)"; case "$nv" in v22.*) pass "node $nv (stack pin 22.x)";; *) warn "node $nv (stack pins 22.x — ensure per-project pin honoured)";; esac
else bad "node missing"; fi
command -v pnpm >/dev/null && pass "pnpm $(pnpm -v)" || warn "pnpm not on PATH (corepack may provide per-project)"

# localCI floor: a node must be able to run a verify locally (node present is the minimum substrate).
command -v node >/dev/null && pass "localCI substrate present (build+VERIFY can run with zero hosted minutes)" || bad "localCI substrate missing"

# Optional capabilities — only checked if required.
want(){ echo ",$REQUIRE," | grep -q ",$1,"; }

if want runner; then
  if [ -f "${RUNNER_HOME:-$HOME/actions-runner}/.runner" ]; then
    pass "runner registered ($(sed -n 's/.*"gitHubUrl": *"\([^"]*\)".*/\1/p' "${RUNNER_HOME:-$HOME/actions-runner}/.runner" 2>/dev/null))"
    grep -q '"ephemeral": *true' "${RUNNER_HOME:-$HOME/actions-runner}/.runner" 2>/dev/null && pass "runner ephemeral" || bad "runner NOT ephemeral (invariant)"
  else bad "runner required but not registered"; fi
fi
if want heartbeat; then
  # the heartbeat is the platform engine's continuous tick daemon (com.deliveryos.engine).
  if launchctl list com.deliveryos.engine >/dev/null 2>&1; then
    pgrep -f run-engine-host.ts >/dev/null 2>&1 && pass "heartbeat: engine tick daemon loaded + running" \
      || bad "heartbeat: engine service loaded but no live tick process"
  elif ls "$HOME/Library/LaunchAgents/"*engine*.plist >/dev/null 2>&1; then
    bad "heartbeat: engine service rendered but not loaded (launchctl load -w)"
  else
    bad "heartbeat required but the engine service is not installed"
  fi
fi
if want mesh; then
  command -v tailscale >/dev/null && pass "mesh client present" || bad "mesh required but tailscale missing"
fi

echo "== $([ $fail = 0 ] && echo 'NODE OK' || echo 'NODE INCOMPLETE') =="
exit $fail
