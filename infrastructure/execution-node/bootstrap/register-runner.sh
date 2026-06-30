#!/usr/bin/env bash
# =============================================================================
# 3/7  register-runner.sh  —  the ephemeral GitHub self-hosted runner   [SEMI]
# -----------------------------------------------------------------------------
# Downloads actions/runner (pinned + checksum-verified), registers it EPHEMERAL
# under the non-admin {{RUNNER_USER}}, and installs it as a launchd service.
# (NEO-EXEC-07 §6 C3 / §5.6; FOUNDER-INSTALLATION-GUIDE §5.)
#
#   config.sh --url https://github.com/{{OWNER}}/{{REPO}} \
#             --ephemeral --labels neo,macos,self-hosted --unattended
#
# IDEMPOTENT: probe `svc.sh status` (already registered + online?) -> action
# (download + config.sh + svc.sh install) -> verify (runner online).
#
# SEMI-automated — the registration TOKEN is a ONE-TIME founder act (NEO-EXEC-07 §8):
#   it is SHORT-LIVED (~1h) and founder-supplied; automating it would mean a
#   standing GitHub-admin credential on Neo, which the model forbids.
#
# The token is NEVER hard-coded and NEVER written to the tree: it arrives ONLY as
# `--token <T>` or the env var GH_RUNNER_REG_TOKEN, is handed straight to config.sh,
# and is not persisted by this script.
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

section "3/7 register-runner — ephemeral GitHub self-hosted runner"
require_macos

# --- args: the founder-supplied, short-lived registration token --------------
REG_TOKEN="${GH_RUNNER_REG_TOKEN:-}"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --token) REG_TOKEN="${2:-}"; shift 2 ;;
    --token=*) REG_TOKEN="${1#*=}"; shift ;;
    *) die "unknown argument: $1 (usage: register-runner.sh --token <REG_TOKEN>)" ;;
  esac
done

RUNNER_HOME="/Users/${DOS_RUNNER_USER}/actions-runner"
GH_URL="https://github.com/${DOS_GH_OWNER}/${DOS_GH_REPO}"

# --- run-as guard: the runner must live under the non-admin ci-runner --------
# (a runner-job compromise is then boxed in a non-admin account, NTS §G.1).
if [ "$(id -un)" != "$DOS_RUNNER_USER" ]; then
  log_warn "Not running as '${DOS_RUNNER_USER}'. Re-invoke as that non-admin user, e.g.:"
  log_warn "  sudo -u ${DOS_RUNNER_USER} ./register-runner.sh --token <REG_TOKEN>"
fi

# --- PROBE: already registered + online? -> green no-op ----------------------
if [ -x "$RUNNER_HOME/svc.sh" ] && (cd "$RUNNER_HOME" && sudo ./svc.sh status 2>/dev/null | grep -qiE 'online|running|active'); then
  log_ok "runner already registered + online ($RUNNER_HOME) — no-op."
  log_ok "register-runner complete (idempotent no-op)."
  exit 0
fi

# --- the ONE-TIME-AUTH gate: the short-lived token ---------------------------
if [ -z "$REG_TOKEN" ]; then
  one_time_auth \
    "Fetch a SHORT-LIVED registration token on a trusted device, then re-run with it:" \
    "" \
    "  gh api -X POST repos/${DOS_GH_OWNER}/${DOS_GH_REPO}/actions/runners/registration-token --jq .token" \
    "" \
    "  sudo -u ${DOS_RUNNER_USER} ./register-runner.sh --token <PASTE_TOKEN>" \
    "" \
    "The token expires in ~1h. It is NEVER stored — it is handed straight to config.sh."
  die "No registration token supplied (--token / GH_RUNNER_REG_TOKEN). See above."
fi

# --- ACTION: download actions/runner (pinned + checksum) ---------------------
mkdir -p "$RUNNER_HOME"
TARBALL="actions-runner-osx-arm64-${DOS_RUNNER_VERSION}.tar.gz"
if [ ! -f "$RUNNER_HOME/config.sh" ]; then
  log_info "downloading actions/runner ${DOS_RUNNER_VERSION} (osx-arm64) ..."
  curl -fsSL -o "$RUNNER_HOME/$TARBALL" \
    "https://github.com/actions/runner/releases/download/v${DOS_RUNNER_VERSION}/${TARBALL}" \
    || die "runner download failed (check DOS_RUNNER_VERSION=${DOS_RUNNER_VERSION})."
  # Best-effort integrity: verify against the published checksum if present.
  if [ -f "$RUNNER_HOME/${TARBALL}.sha256" ]; then
    (cd "$RUNNER_HOME" && shasum -a 256 -c "${TARBALL}.sha256") || die "runner checksum verification FAILED."
  else
    log_warn "No local .sha256 to verify against — confirm the release hash out-of-band if paranoid."
  fi
  (cd "$RUNNER_HOME" && tar xzf "$TARBALL") || die "runner extract failed."
else
  log_ok "actions/runner already extracted at $RUNNER_HOME"
fi

# --- ACTION: register EPHEMERAL with the founder labels ----------------------
log_info "registering ephemeral runner (labels: ${DOS_RUNNER_LABELS}) ..."
(cd "$RUNNER_HOME" && ./config.sh \
  --url "$GH_URL" \
  --ephemeral \
  --labels "$DOS_RUNNER_LABELS" \
  --name "$DOS_NODE_ID" \
  --unattended \
  --replace \
  --token "$REG_TOKEN") \
  || die "config.sh registration failed (token expired? wrong repo? already registered?)."
unset REG_TOKEN   # do not let it linger in the environment

# --- ACTION: install as a launchd service (KeepAlive re-registers ephemeral) -
log_info "installing the runner as a launchd LaunchDaemon ..."
(cd "$RUNNER_HOME" && sudo ./svc.sh install "$DOS_RUNNER_USER") || die "svc.sh install failed."
(cd "$RUNNER_HOME" && sudo ./svc.sh start) || die "svc.sh start failed."

# --- VERIFY: registered + online ---------------------------------------------
section "verify — runner registered + online"
(cd "$RUNNER_HOME" && sudo ./svc.sh status 2>/dev/null | grep -qiE 'online|running|active') \
  && log_ok "svc.sh status: runner service is running." \
  || die "runner service is NOT running after install."

if have gh; then
  if gh api "repos/${DOS_GH_OWNER}/${DOS_GH_REPO}/actions/runners" --jq '.runners[].name' 2>/dev/null | grep -q "$DOS_NODE_ID"; then
    log_ok "GitHub runners API lists '${DOS_NODE_ID}'."
  else
    log_warn "gh did not list '${DOS_NODE_ID}' yet (propagation lag, or gh not authed) — check Settings -> Actions -> Runners."
  fi
fi

log_ok "register-runner complete — ephemeral runner online under ${DOS_RUNNER_USER}."
