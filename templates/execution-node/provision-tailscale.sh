#!/usr/bin/env bash
# Delivery OS — Execution Node capability: secure mesh (Tailscale) bootstrap.
#
# Installs the mesh client so a node is reachable remotely / can mesh with other nodes. The actual
# device JOIN (`tailscale up`) is an OPERATOR action (authentication / founder physical authorization)
# and is intentionally NOT automated — this script installs and then PRINTS the exact join command.
#
# Usage:  bash provision-tailscale.sh [--tag tag:execution-node]
set -euo pipefail

TAG=""
while [ $# -gt 0 ]; do case "$1" in
  --tag) TAG="${2:?}"; shift 2;;
  *) echo "FATAL: unknown arg '$1'"; exit 2;;
esac; done

[ "$(uname -s)" = "Darwin" ] || { echo "FATAL: this provisioner targets macOS"; exit 1; }
command -v brew >/dev/null || { echo "FATAL: Homebrew required to install tailscale"; exit 1; }

if ! command -v tailscale >/dev/null 2>&1; then
  echo "==> installing tailscale (CLI)"
  brew install tailscale
else
  echo "==> tailscale already installed: $(tailscale version | head -1)"
fi

echo
echo "NEXT — OPERATOR ACTION (authentication; not automated):"
echo "  Run this yourself so the device auth stays in your hands:"
if [ -n "$TAG" ]; then
  echo "      sudo tailscale up --advertise-tags=${TAG} --ssh=false"
else
  echo "      sudo tailscale up --ssh=false      # or add --advertise-tags=tag:execution-node"
fi
echo "  Then scope this device in your tailnet ACLs to only what an Execution Node needs."
echo "OK: tailscale installed; join is yours to authorize."
