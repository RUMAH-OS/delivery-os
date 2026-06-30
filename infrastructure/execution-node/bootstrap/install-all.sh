#!/usr/bin/env bash
# =============================================================================
# 7/7  install-all.sh  —  the bootstrap orchestrator             [ORCHESTRATOR]
# -----------------------------------------------------------------------------
# Runs steps 1 -> 6 in order, each GATED on the prior step's verification (exit
# code), HALTING on the first failure with a clear, actionable message. Pauses at
# the manual gates (Tailscale device approval, the GH registration token, the
# one-time secret seeding) with a printed instruction. (NEO-EXEC-07 §3.1 / §6;
# FOUNDER-INSTALLATION-GUIDE the whole guide is this sequence.)
#
# IDEMPOTENT end-to-end: because every sub-script is a green no-op on an already-
# satisfied node, re-running install-all.sh is the one-command "did the macOS
# update break it?" re-verify + diagnose path (NEO-EXEC-07 §3.2).
#
# Usage:
#   ./install-all.sh                      # run the full ordered sequence
#   ./install-all.sh --from 4             # resume at step 4 (e.g. after seeding)
#   GH_RUNNER_REG_TOKEN=... ./install-all.sh   # pass the runner token through to step 3
#   DOS_ASSUME_YES=1 ./install-all.sh     # unattended RE-VERIFY (no new manual seeding)
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

FROM=1
while [ "$#" -gt 0 ]; do
  case "$1" in
    --from) FROM="${2:-1}"; shift 2 ;;
    --from=*) FROM="${1#*=}"; shift ;;
    -h|--help) sed -n '2,24p' "$0"; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

section "Delivery OS — Neo bootstrap orchestrator (steps ${FROM}..6)"
require_macos
log_info "node=${DOS_NODE_ID}  repo=${DOS_GH_OWNER}/${DOS_GH_REPO}  runner-user=${DOS_RUNNER_USER}"

# run_step <n> <script> <gate-args...> — gate each step on its predecessor's exit.
run_step() {
  local n="$1" script="$2"; shift 2
  if [ "$n" -lt "$FROM" ]; then
    log_info "step $n ($script) — skipped (--from $FROM)."
    return 0
  fi
  section "STEP $n / 6 -> $script"
  if [ ! -x "$BOOTSTRAP_DIR/$script" ] && [ ! -f "$BOOTSTRAP_DIR/$script" ]; then
    die "missing sub-script: $BOOTSTRAP_DIR/$script"
  fi
  # Each sub-script is fail-closed; a non-zero exit halts the orchestrator here.
  if bash "$BOOTSTRAP_DIR/$script" "$@"; then
    log_ok "step $n ($script) GREEN — gate satisfied; proceeding."
  else
    die "step $n ($script) FAILED — bootstrap HALTED. Fix the cause above, then resume with: ./install-all.sh --from $n"
  fi
}

# --- the ordered, gated sequence ---------------------------------------------
run_step 1 install-prereqs.sh

# step 2 pauses on the device-approval + ACL-apply console acts (printed by the script).
run_step 2 join-tailnet.sh

# step 3 needs the founder's short-lived token; pass it through if provided.
if [ -n "${GH_RUNNER_REG_TOKEN:-}" ]; then
  run_step 3 register-runner.sh --token "$GH_RUNNER_REG_TOKEN"
else
  section "STEP 3 / 6 -> register-runner.sh"
  if [ "$FROM" -le 3 ]; then
    one_time_auth \
      "Step 3 needs a SHORT-LIVED GitHub runner registration token (founder act):" \
      "  gh api -X POST repos/${DOS_GH_OWNER}/${DOS_GH_REPO}/actions/runners/registration-token --jq .token" \
      "Then resume with EITHER:" \
      "  GH_RUNNER_REG_TOKEN=<token> ./install-all.sh --from 3" \
      "  sudo -u ${DOS_RUNNER_USER} ./register-runner.sh --token <token>   (then ./install-all.sh --from 4)"
    if [ "${DOS_ASSUME_YES:-0}" = "1" ]; then
      log_warn "DOS_ASSUME_YES=1 re-verify — attempting register-runner.sh idempotent no-op (already-online path)."
      run_step 3 register-runner.sh
    else
      die "Step 3 paused for the registration token (above). This is a one-time founder auth, by design."
    fi
  fi
fi

# step 4 is the one-time founder seeding; interactive unless already complete.
run_step 4 bootstrap-secrets.sh

# step 5 renders + loads the daemons.
run_step 5 install-daemons.sh

# step 6 is the go-live gate (automated checks + the founder ★ checkpoints).
run_step 6 verify-health.sh

section "bootstrap complete"
log_ok "All steps green. Neo is INSTALLED. The remaining FOUNDER ★ gates (binding-check"
log_ok "flips, deploy go-live, the cold-boot test) are in verify-health.sh / the guide §11."
log_info "Re-run anytime — ./install-all.sh is a green no-op on a healthy node (the diagnose path)."
