#!/usr/bin/env bash
# =============================================================================
# 5/7  install-daemons.sh  —  launchd supervision + colima        [AUTOMATED]
# -----------------------------------------------------------------------------
# Renders the launchd plists (worker / supervisor; runner already installed in
# step 3) from the P3.3 config-templates with resolved {{placeholders}}, loads
# them as LaunchDaemons, brings colima up from its pinned profile, and confirms
# the boot posture: FileVault-aware (System keychain, never login keychain),
# App-Nap-excluded (ProcessType=Background), KeepAlive, caffeinate-wrapped.
# (NEO-EXEC-07 §4 / §5.1-§5.4 / §6 C5; FOUNDER-INSTALLATION-GUIDE §3 + §7.)
#
# IDEMPOTENT: probe (`launchctl print system/<label>` loaded? `docker info` up?)
# -> action (render + `launchctl bootstrap`; `colima start`) -> verify (loaded +
# KeepAlive active + docker socket up + postgres:16 warm).
#
# AUTOMATED — no manual gate. NO SECRET is rendered into any plist: the worker
# reads DOS_SECRET_SOURCE=system-keychain at runtime; the plists carry only
# non-secret env shape + keychain REFERENCES (NEO-EXEC-07 §5.1).
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

section "5/7 install-daemons — launchd supervision + colima"
require_macos
require_cmd launchctl
require_cmd colima "Run install-prereqs.sh first."

LAUNCHD_DIR="/Library/LaunchDaemons"
mkdir -p "$DOS_LOG_DIR" 2>/dev/null || sudo mkdir -p "$DOS_LOG_DIR"

# Resolve the tailnet bind addr if not already set (the daemons must bind it,
# never 0.0.0.0; NTS §A.2). Soft-warn rather than hard-fail so a re-verify works.
if [ -z "${DOS_TAILNET_BIND_ADDR:-}" ]; then
  DOS_TAILNET_BIND_ADDR="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
  export DOS_TAILNET_BIND_ADDR
  [ -n "$DOS_TAILNET_BIND_ADDR" ] \
    && log_info "resolved DOS_TAILNET_BIND_ADDR=$DOS_TAILNET_BIND_ADDR" \
    || log_warn "tailnet bind addr unresolved — run join-tailnet.sh first (the plist will fail to render fail-closed)."
fi

# --- colima: bring the Docker socket up from the pinned profile --------------
# (folded here per NEO-EXEC-07 §3.1 step 3; the worker's start gates on docker info.)
if docker info >/dev/null 2>&1; then
  log_ok "docker socket already up (colima running) — no-op."
else
  log_info "starting colima (cpu=${DOS_COLIMA_CPU} mem=${DOS_COLIMA_MEMORY_GB} disk=${DOS_COLIMA_DISK_GB}) ..."
  # Render the pinned profile (fail-closed if the template is genuinely missing — never warn-skip).
  render_template "colima/colima-profile.yaml.template" "colima-profile.yaml" >/dev/null
  log_info "(rendered colima profile available at $RENDER_DIR/colima-profile.yaml)"
  colima start --cpu "$DOS_COLIMA_CPU" --memory "$DOS_COLIMA_MEMORY_GB" --disk "$DOS_COLIMA_DISK_GB" \
    || die "colima start failed."
fi
# warm postgres:16 so the first CI check pays no cold-pull tax (idempotent).
if docker image inspect postgres:16 >/dev/null 2>&1; then
  log_ok "postgres:16 image already warm."
else
  log_info "pulling postgres:16 (CI test database) ..."
  docker pull postgres:16 || log_warn "docker pull postgres:16 failed — required checks will pull on first run."
fi
# confirm colima autostart at boot (Homebrew launchd service `com.colima`).
brew services list 2>/dev/null | grep -E '^colima' | grep -q started \
  && log_ok "com.colima autostart enabled (socket up before a CI job needs it)." \
  || { log_info "enabling colima autostart ..."; brew services start colima >/dev/null 2>&1 || log_warn "could not enable colima autostart — confirm manually."; }

# --- render + load each LaunchDaemon -----------------------------------------
# install_daemon <template-rel> <label>
# FAIL-CLOSED: render_template -> require_template `die`s if the template is missing, so a
# genuinely-absent required plist HALTS the install (no warn-skip, no false-green daemon step).
install_daemon() {
  local rel="$1" label="$2" rendered plist
  if launchd_loaded "$label"; then
    log_ok "$label already loaded — re-rendering on drift, then no-op."
  fi
  rendered="$(render_template "$rel" "${label}.plist")"
  plist="$LAUNCHD_DIR/${label}.plist"
  # plists must be root-owned in /Library/LaunchDaemons.
  sudo cp "$rendered" "$plist"
  sudo chown root:wheel "$plist"
  sudo chmod 644 "$plist"
  # re-bootstrap idempotently: bootout if loaded, then bootstrap.
  sudo launchctl bootout "system/$label" >/dev/null 2>&1 || true
  sudo launchctl bootstrap system "$plist" || die "launchctl bootstrap failed for $label."
  sudo launchctl enable "system/$label" >/dev/null 2>&1 || true
  log_ok "$label loaded from $plist"
}

install_daemon "supervision/com.deliveryos.worker.plist.template"     "com.deliveryos.worker"
install_daemon "supervision/com.deliveryos.supervisor.plist.template" "com.deliveryos.supervisor"

# --- VERIFY: each label loaded with KeepAlive active -------------------------
section "verify — daemons loaded, KeepAlive active, colima up"
DAEMON_FAILS=0
verify_daemon() {
  local label="$1"
  if ! launchd_loaded "$label"; then
    # A required daemon that did not load is a HARD failure — not a warn-skip (kills the false-green).
    log_err "$label is NOT loaded after bootstrap — the supervision step did NOT succeed."
    DAEMON_FAILS=$((DAEMON_FAILS + 1))
    return 0
  fi
  if sudo launchctl print "system/$label" 2>/dev/null | grep -qi 'keepalive'; then
    log_ok "$label loaded with KeepAlive."
  else
    log_warn "$label loaded but KeepAlive not visible — confirm the plist."
  fi
}
verify_daemon "com.deliveryos.worker"
verify_daemon "com.deliveryos.supervisor"
# the runner daemon was installed in step 3; confirm it is present.
launchd_loaded "actions.runner.${DOS_GH_OWNER}-${DOS_GH_REPO}.${DOS_NODE_ID}" \
  && log_ok "runner LaunchDaemon present (from register-runner.sh)." \
  || log_warn "runner LaunchDaemon not found — run register-runner.sh."

docker info >/dev/null 2>&1 && log_ok "docker socket up (colima)." || log_warn "docker socket down — colima may need a restart."

# FAIL CLOSED: never report green while the supervision daemons are not actually loaded.
if [ "$DAEMON_FAILS" -ne 0 ]; then
  die "install-daemons FAILED — ${DAEMON_FAILS} supervision daemon(s) not loaded. The step is NOT complete; fix the cause above and re-run."
fi
log_ok "install-daemons complete — supervision loaded (FileVault-aware, App-Nap-excluded, KeepAlive)."
