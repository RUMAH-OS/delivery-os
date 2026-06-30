#!/usr/bin/env bash
# Delivery OS — Execution Node capability: self-hosted GitHub Actions runner (hardened).
#
# The runner is ONE capability of an Execution Node, not the reason a node exists. This script is the
# platform's parameterized RECIPE; a node invokes it with its own values + a registration token. It
# names no project, host, or path (clean-room / Governance §14).
#
# Usage:
#   REG_TOKEN=xxxx bash provision-runner.sh --repo <owner/repo> [--labels self-hosted,arm64] \
#       [--runner-user <osuser>] [--work _work] [--version 2.335.1]
#
# Required:
#   --repo <owner/repo>     the SINGLE private repo this runner serves (repo-level scope = smallest blast radius)
#   REG_TOKEN  (env only)   a short-lived runner registration token (Settings > Actions > Runners > New),
#                           OR mint one as the builder:  gh api -X POST repos/<owner/repo>/actions/runners/registration-token --jq .token
#
# Security posture enforced by this script:
#   * --ephemeral            one job per registration; no state bleed between jobs
#   * private repos only     (operator must NOT point this at a public repo — fork PRs = RCE vector)
#   * dedicated OS user      if --runner-user is given and differs from the caller, refuses to run as an admin
#   * least privilege        does not store the builder's gh token; uses the registration token once
set -euo pipefail

REPO="" ; LABELS="self-hosted" ; RUNNER_USER="$(id -un)" ; WORKDIR="_work" ; VERSION=""
while [ $# -gt 0 ]; do case "$1" in
  --repo) REPO="${2:?}"; shift 2;;
  --labels) LABELS="${2:?}"; shift 2;;
  --runner-user) RUNNER_USER="${2:?}"; shift 2;;
  --work) WORKDIR="${2:?}"; shift 2;;
  --version) VERSION="${2:?}"; shift 2;;
  *) echo "FATAL: unknown arg '$1'"; exit 2;;
esac; done

: "${REPO:?FATAL: --repo <owner/repo> required (one PRIVATE repo)}"
: "${REG_TOKEN:?FATAL: REG_TOKEN env required (a runner registration token; never pass tokens as args)}"
[[ "$REPO" == */* ]] || { echo "FATAL: --repo must be owner/repo"; exit 2; }

# Fail-closed prerequisites.
command -v curl >/dev/null || { echo "FATAL: curl not found"; exit 1; }
[ "$(uname -s)" = "Darwin" ] || { echo "FATAL: this provisioner targets macOS; add a linux branch to extend"; exit 1; }
ARCH="$(uname -m)"; case "$ARCH" in arm64) RUNNER_ARCH="osx-arm64";; x86_64) RUNNER_ARCH="osx-x64";; *) echo "FATAL: unsupported arch $ARCH"; exit 1;; esac

# Refuse to run execution as an admin user (isolation invariant).
if id -Gn "$RUNNER_USER" 2>/dev/null | tr ' ' '\n' | grep -qx admin; then
  echo "FATAL: runner user '$RUNNER_USER' is an admin. Use a dedicated NON-admin user (isolation invariant)."
  echo "       create one (needs sudo / founder physical auth), e.g.:"
  echo "         sudo sysadminctl -addUser ghrunner -fullName 'Delivery OS Runner' -password -"
  exit 1
fi

# Resolve latest runner version if not pinned.
if [ -z "$VERSION" ]; then
  VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p' | head -1)"
fi
: "${VERSION:?FATAL: could not resolve runner version; pass --version}"

RUNNER_HOME="${RUNNER_HOME:-$HOME/actions-runner}"
mkdir -p "$RUNNER_HOME"; cd "$RUNNER_HOME"
TARBALL="actions-runner-${RUNNER_ARCH}-${VERSION}.tar.gz"

if [ ! -x ./run.sh ]; then
  echo "==> downloading runner ${VERSION} (${RUNNER_ARCH})"
  curl -fsSL -o "$TARBALL" "https://github.com/actions/runner/releases/download/v${VERSION}/${TARBALL}"
  tar xzf "$TARBALL" && rm -f "$TARBALL"
fi

# Idempotent (re)configure: remove a stale registration, then register fresh + ephemeral.
[ -f .runner ] && { echo "==> removing stale registration"; ./config.sh remove --token "$REG_TOKEN" || true; }

echo "==> registering ephemeral runner for repo ${REPO} (labels: ${LABELS})"
./config.sh \
  --url "https://github.com/${REPO}" \
  --token "$REG_TOKEN" \
  --name "$(scutil --get LocalHostName 2>/dev/null || hostname)-runner" \
  --labels "$LABELS" \
  --work "$WORKDIR" \
  --ephemeral \
  --unattended \
  --replace

echo "OK: runner configured (ephemeral, repo-scoped). Start it via the launchd template"
echo "    (launchd/com.deliveryos.runner.plist.template) so it runs as '${RUNNER_USER}' on boot,"
echo "    or one-shot with ./run.sh. Verify with verify-node.sh."
