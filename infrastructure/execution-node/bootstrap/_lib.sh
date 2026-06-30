# shellcheck shell=bash
# =============================================================================
# Delivery OS — Execution-Infra bootstrap shared library (_lib.sh)
# -----------------------------------------------------------------------------
# Sourced by every install-*.sh. It is NOT executable on its own.
#
# This file is an ADAPTER-subsystem asset (under infrastructure/). It orchestrates
# the HOST (Homebrew, Tailscale, launchd, the System keychain). It is NOT Core and
# imports no Core knowledge.
#
# It provides the three things every bootstrap script needs:
#   1. The precondition-probe -> action -> verification TRIAD helpers + logging,
#      so a satisfied node re-runs every script as a green no-op (= the diagnose
#      path). Re-running install-all.sh is the one-command "did the macOS update
#      break it?" answer (NEO-EXEC-07 §3.2).
#   2. The MANUAL / ONE-TIME-AUTH / FOUNDER-APPROVAL step banners (FOUNDER-INSTALLATION
#      -GUIDE tag legend) — the automated body is everything NOT inside a banner.
#   3. Config resolution: every node-specific {{placeholder}} resolves from an env
#      var (optionally seeded by node-config.env — the founder's resolved placeholder
#      sheet, NON-SECRET) falling back to the documented default. NO SECRET is ever
#      a default, hard-coded, or written to the tree.
#
# Portability: written for macOS's stock bash 3.2 AND zsh (`zsh -n` clean). No
# bash-4 features (no associative arrays, no ${v,,}). Targets Neo (Apple Silicon).
# =============================================================================

set -o errexit
set -o nounset
set -o pipefail

# --- paths (resolved relative to bootstrap/, never hard-coded) ----------------
# bootstrap/ -> execution-node/ (SUBSYS_ROOT) -> infrastructure/ -> repo root.
# Resolve this lib's own path portably: bash sets BASH_SOURCE; zsh (sourced, with
# FUNCTION_ARGZERO, the default) sets $0 to the sourced file. Avoids the zsh-only
# ${(%)...} token so `bash -n` parses this file cleanly.
if [ -n "${BASH_SOURCE:-}" ]; then
  _LIB_SELF="${BASH_SOURCE[0]}"
else
  _LIB_SELF="$0"
fi
BOOTSTRAP_DIR="$(cd "$(dirname "$_LIB_SELF")" && pwd)"
SUBSYS_ROOT="$(cd "$BOOTSTRAP_DIR/.." && pwd)"
REPO_ROOT="$(cd "$SUBSYS_ROOT/../.." && pwd)"

# P3.3 config-templates live under the subsystem's config-templates/ tree, organized
# into the canonical subfolders the scripts + the design inventory (NEO-EXEC-07-INV §B)
# reference: supervision/ tailscale/ config/ colima/ runner/ watchdog/ logging/.
# require_template() still fails closed with a clear message if one is absent (a genuine
# missing required template must HALT the install, never warn-skip into a false-green).
TEMPLATE_DIR="$SUBSYS_ROOT/config-templates"
# Rendered (placeholder-resolved) output never overwrites a template and never
# contains a secret. It is git-ignored host state, written under the runner user.
RENDER_DIR="${DOS_RENDER_DIR:-$HOME/.delivery-os/neo-render}"

# Core-owned tools this adapter merely INVOKES as subprocesses (never imports):
CONFIG_DOCTOR="$REPO_ROOT/templates/tools/config-doctor.mjs"
PLATFORM_HEALTH="$REPO_ROOT/templates/tools/platform-health.mjs"

# --- logging ------------------------------------------------------------------
if [ -t 1 ]; then
  _C_RST=$'\033[0m'; _C_RED=$'\033[31m'; _C_GRN=$'\033[32m'
  _C_YEL=$'\033[33m'; _C_BLU=$'\033[34m'; _C_BLD=$'\033[1m'
else
  _C_RST=""; _C_RED=""; _C_GRN=""; _C_YEL=""; _C_BLU=""; _C_BLD=""
fi

log_info() { printf '%s[ .. ]%s %s\n' "$_C_BLU" "$_C_RST" "$*"; }
log_ok()   { printf '%s[ OK ]%s %s\n' "$_C_GRN" "$_C_RST" "$*"; }
log_warn() { printf '%s[WARN]%s %s\n' "$_C_YEL" "$_C_RST" "$*" >&2; }
log_err()  { printf '%s[FAIL]%s %s\n' "$_C_RED" "$_C_RST" "$*" >&2; }

# die <msg> — fail closed: print a clear, actionable error and exit non-zero.
die() { log_err "$*"; exit 1; }

# section <title> — a visual frame for each script's body.
section() {
  printf '\n%s== %s ==%s\n' "$_C_BLD" "$*" "$_C_RST"
}

# --- the MANUAL / ONE-TIME-AUTH / FOUNDER-APPROVAL banners --------------------
# Every step inside one of these banners is irreducibly NOT automated (security or
# governance gated, NEO-EXEC-07 §8). The automated body is everything outside them.
_banner() {
  local tag="$1"; shift
  printf '\n%s+--------------------------------------------------------------------+%s\n' "$_C_YEL" "$_C_RST"
  printf '%s|  %-8s  (a human acts here — NOT automated)%*s|%s\n' "$_C_YEL" "$tag" $((24 - ${#tag})) "" "$_C_RST"
  printf '%s+--------------------------------------------------------------------+%s\n' "$_C_YEL" "$_C_RST"
  local line
  for line in "$@"; do printf '   %s\n' "$line"; done
  printf '\n'
}
manual()          { _banner "MANUAL" "$@"; }
one_time_auth()   { _banner "1-TIME-AUTH" "$@"; }
founder_approval(){ _banner "FOUNDER-OK" "$@"; }

# confirm <prompt> — a blocking founder yes/no. Honors DOS_ASSUME_YES=1 for an
# unattended re-verify run (it still PRINTS the gate so it is never silent).
confirm() {
  local prompt="$1"
  if [ "${DOS_ASSUME_YES:-0}" = "1" ]; then
    log_warn "DOS_ASSUME_YES=1 — auto-confirming: $prompt"
    return 0
  fi
  local reply=""
  printf '%s?%s %s [y/N] ' "$_C_BLD" "$_C_RST" "$prompt"
  read -r reply || reply=""
  case "$reply" in y|Y|yes|YES) return 0 ;; *) return 1 ;; esac
}

# --- environment guards -------------------------------------------------------
require_macos() {
  [ "$(uname -s)" = "Darwin" ] || die "This is a macOS (Neo) installer; host is '$(uname -s)'. Run it on Neo over Tailscale SSH."
}

have() { command -v "$1" >/dev/null 2>&1; }

require_cmd() {
  have "$1" || die "Required command '$1' not found. ${2:-Run install-prereqs.sh first.}"
}

# require_template <relpath> — fail closed if a P3.3 config-template is missing.
require_template() {
  local rel="$1" abs="$TEMPLATE_DIR/$1"
  [ -f "$abs" ] || die "P3.3 dependency missing: config-template '$rel' is not on disk yet.
       It is DESIGNED in NEO-EXEC-07 §5 and materialized by Sprint P3.3.
       This script cannot render it until P3.3 lands. Expected at: $abs"
  printf '%s' "$abs"
}

# --- config resolution (every {{placeholder}} -> an env var with a documented default)
# load_node_config sources the optional NON-SECRET placeholder sheet, then pins a
# default for any value the founder did not override. NO SECRET appears here.
load_node_config() {
  local sheet="${DOS_NODE_CONFIG:-$BOOTSTRAP_DIR/node-config.env}"
  if [ -f "$sheet" ]; then
    log_info "Loading placeholder sheet: $sheet"
    # shellcheck disable=SC1090
    . "$sheet"
  fi
  # {{NODE_ID}} .. the registry ID (hostname is `neo`); see FOUNDER-INSTALLATION-GUIDE §0.
  # This is the ONE canonical node id across the adapter, scripts, templates, and guide
  # (the Neo adapter reads it from DOS_NODE_ID; the composition root passes it through).
  : "${DOS_NODE_ID:=neo-node2}"
  : "${DOS_RUNNER_USER:=ci-runner}"
  # NO PII default: the founder fills this in node-config.env. The placeholder is non-identifying.
  : "${DOS_FOUNDER_EMAIL:=founder@example.com}"
  : "${DOS_GH_OWNER:=RUMAH-OS}"
  : "${DOS_GH_REPO:=delivery-os}"
  : "${DOS_NODE_VERSION:=22}"                  # match each repo's CI (PLOS 22 / admin 20)
  : "${DOS_VERCEL_CLI_VERSION:=48.12.1}"       # pinned; API floor >= 47.2.2
  : "${DOS_RUNNER_VERSION:=2.317.0}"           # pinned actions/runner release
  : "${DOS_RUNNER_LABELS:=neo,macos,self-hosted}"
  : "${DOS_TICK_INTERVAL_MS:=20000}"           # 15-30s; NOT 5s (~60x the bus load)
  : "${DOS_HEALTH_PORT:=8787}"
  : "${DOS_DISPATCH_PORT:=9443}"
  : "${DOS_NEO_MAGICDNS:=neo}"
  : "${DOS_COLIMA_CPU:=4}"
  : "${DOS_COLIMA_MEMORY_GB:=8}"
  : "${DOS_COLIMA_DISK_GB:=60}"
  : "${DOS_HC_PERIOD_SECONDS:=60}"
  : "${DOS_HC_GRACE_SECONDS:=300}"
  : "${DOS_POLL_INTERVAL_MIN:=5}"
  : "${DOS_LOG_DIR:=/Users/${DOS_RUNNER_USER}/Library/Logs/delivery-os}"
  : "${DOS_VERCEL_ORG_ID:=}"                   # NON-SECRET id; used only for registry scope
  : "${DOS_VERCEL_PROJECT_ID:=}"
  # TAILNET_BIND_ADDR is resolved at runtime from `tailscale ip -4` (after §join).
  : "${DOS_TAILNET_BIND_ADDR:=}"
  # --- the launchd composition-root entries (the unclassified `main` the plists invoke) ---
  # WORKER_ENTRY is the worker daemon's composition root; RUNTIME_TICK_ENTRY + SUPERVISOR_ENTRY
  # are the sibling entries it / the supervisor plist wire (all under bootstrap/, .mjs).
  : "${DOS_WORKER_ENTRY:=$BOOTSTRAP_DIR/worker-entry.mjs}"
  : "${DOS_RUNTIME_TICK_ENTRY:=$BOOTSTRAP_DIR/runtime-tick.mjs}"
  : "${DOS_SUPERVISOR_ENTRY:=$BOOTSTRAP_DIR/supervisor-entry.mjs}"
  : "${DOS_WORKING_DIR:=$REPO_ROOT}"           # {{WORKING_DIR}} daemon cwd (the repo root)
  # --- reference/manual template placeholders (rendered by the founder, not these scripts) ---
  : "${DOS_RUNNER_HOME:=/Users/${DOS_RUNNER_USER}/actions-runner}"   # {{RUNNER_HOME}} (svc.sh tree)
  : "${DOS_COLIMA_BIN:=/opt/homebrew/bin/colima}"                    # {{COLIMA_BIN}}
  : "${DOS_COLIMA_PROFILE:=default}"                                 # {{COLIMA_PROFILE}}
  : "${DOS_WATCHDOG_SCRIPT:=/opt/delivery-os/windows-pull-probe.ps1}" # {{WATCHDOG_SCRIPT}} (windows-node1)
}

# render_template <relpath> <out-name> — substitute every {{PLACEHOLDER}} from the
# matching DOS_* env var, FAIL CLOSED if any {{...}} remains unresolved, and assert
# the output carries no obvious secret. Writes to RENDER_DIR (never over a template,
# never into the git tree). Echoes the rendered path.
render_template() {
  local rel="$1" out="$2" src dst
  # FAIL CLOSED, EXPLICITLY: require_template `die`s in its own subshell when the template is missing,
  # but a command-substitution call site can swallow that exit (bash errexit is disabled while the
  # enclosing command's status is tested). So we re-assert here: an unresolved/unreadable source MUST
  # halt — never fall through to sed with an empty src and emit an empty artifact (a false-green).
  src="$(require_template "$rel")"
  if [ -z "$src" ] || [ ! -f "$src" ]; then
    die "render_template: required template '$rel' is missing or unreadable — cannot render '$out' (fail-closed; see the require_template message above)."
  fi
  mkdir -p "$RENDER_DIR"
  dst="$RENDER_DIR/$out"
  # Map the {{placeholder}} vocabulary to its env var, one sed expr per key.
  sed \
    -e "s|{{NODE_ID}}|${DOS_NODE_ID}|g" \
    -e "s|{{RUNNER_USER}}|${DOS_RUNNER_USER}|g" \
    -e "s|{{FOUNDER_EMAIL}}|${DOS_FOUNDER_EMAIL}|g" \
    -e "s|{{OWNER}}|${DOS_GH_OWNER}|g" \
    -e "s|{{REPO}}|${DOS_GH_REPO}|g" \
    -e "s|{{NODE_VERSION}}|${DOS_NODE_VERSION}|g" \
    -e "s|{{VERCEL_CLI_VERSION}}|${DOS_VERCEL_CLI_VERSION}|g" \
    -e "s|{{RUNNER_LABEL}}|${DOS_RUNNER_LABELS}|g" \
    -e "s|{{RUNNER_NAME}}|${DOS_NODE_ID}|g" \
    -e "s|{{TICK_INTERVAL_MS}}|${DOS_TICK_INTERVAL_MS}|g" \
    -e "s|{{HEALTH_PORT}}|${DOS_HEALTH_PORT}|g" \
    -e "s|{{DISPATCH_PORT}}|${DOS_DISPATCH_PORT}|g" \
    -e "s|{{NEO_MAGICDNS}}|${DOS_NEO_MAGICDNS}|g" \
    -e "s|{{TAILNET_BIND_ADDR}}|${DOS_TAILNET_BIND_ADDR}|g" \
    -e "s|{{COLIMA_CPU}}|${DOS_COLIMA_CPU}|g" \
    -e "s|{{COLIMA_MEMORY_GB}}|${DOS_COLIMA_MEMORY_GB}|g" \
    -e "s|{{COLIMA_DISK_GB}}|${DOS_COLIMA_DISK_GB}|g" \
    -e "s|{{HC_PERIOD_SECONDS}}|${DOS_HC_PERIOD_SECONDS}|g" \
    -e "s|{{HC_GRACE_SECONDS}}|${DOS_HC_GRACE_SECONDS}|g" \
    -e "s|{{POLL_INTERVAL_MIN}}|${DOS_POLL_INTERVAL_MIN}|g" \
    -e "s|{{LOG_DIR}}|${DOS_LOG_DIR}|g" \
    -e "s|{{NODE_BIN}}|$(node_bin)|g" \
    -e "s|{{WORKER_ENTRY}}|${DOS_WORKER_ENTRY}|g" \
    -e "s|{{RUNTIME_TICK_ENTRY}}|${DOS_RUNTIME_TICK_ENTRY}|g" \
    -e "s|{{SUPERVISOR_ENTRY}}|${DOS_SUPERVISOR_ENTRY}|g" \
    -e "s|{{WORKING_DIR}}|${DOS_WORKING_DIR}|g" \
    -e "s|{{RUNNER_HOME}}|${DOS_RUNNER_HOME}|g" \
    -e "s|{{COLIMA_BIN}}|${DOS_COLIMA_BIN}|g" \
    -e "s|{{COLIMA_PROFILE}}|${DOS_COLIMA_PROFILE}|g" \
    -e "s|{{WATCHDOG_SCRIPT}}|${DOS_WATCHDOG_SCRIPT}|g" \
    -e "s|{{VERCEL_ORG_ID}}|${DOS_VERCEL_ORG_ID}|g" \
    -e "s|{{VERCEL_PROJECT_ID}}|${DOS_VERCEL_PROJECT_ID}|g" \
    "$src" > "$dst"
  # Fail closed on any unresolved placeholder (a missing value would silently
  # render a broken plist/ACL otherwise).
  if grep -q '{{[A-Za-z_]*}}' "$dst"; then
    local left; left="$(grep -o '{{[A-Za-z_]*}}' "$dst" | sort -u | tr '\n' ' ')"
    rm -f "$dst"
    die "Unresolved placeholder(s) while rendering '$rel': $left
       Set the matching DOS_* env var (see node-config.env / FOUNDER-INSTALLATION-GUIDE §0)."
  fi
  printf '%s' "$dst"
}

# node_bin — the Homebrew Node path on Apple Silicon (used in the worker plist).
node_bin() {
  if have node; then command -v node; else printf '/opt/homebrew/bin/node'; fi
}

# --- the fail-closed config gate (Core tool, invoked — never imported) --------
# config_gate runs config-doctor over the local/trusted plane. Its exit code is the
# fail-closed contract: 0 = every REQUIRED key PRESENT & valid; non-zero names the
# exact missing/invalid key. NOTE: config-doctor exposes `--include-local`; the
# `--enforce` alias named in the design docs is a config-platform follow-up — the
# exit-code-1-on-missing behavior already IS the fail-closed enforcement.
config_gate() {
  [ -f "$CONFIG_DOCTOR" ] || die "config-doctor not found at $CONFIG_DOCTOR (Core tool — is the repo intact?)."
  require_cmd node
  log_info "config-doctor --include-local (fail-closed; prints no secret value)"
  node "$CONFIG_DOCTOR" --include-local ${DOS_CONFIG_DOCTOR_ARGS:-} \
    || die "config-doctor FAILED CLOSED — a required secret is MISSING or INVALID (see the named key above). Seed it via bootstrap-secrets.sh, then re-run."
  log_ok "config-doctor: every required key PRESENT & valid."
}

# --- System-keychain helpers (NEVER the login keychain; NEO-OPS-06 §3 Decision A)
SYSTEM_KEYCHAIN="/Library/Keychains/System.keychain"

# keychain_has <key> — presence probe ONLY (never passes -w, so no value is printed).
keychain_has() {
  sudo security find-generic-password -a "$DOS_RUNNER_USER" -s "$1" "$SYSTEM_KEYCHAIN" >/dev/null 2>&1
}

# secret_hint <key> — the authoritative store to pull a value from (FOUNDER-GUIDE §6.3).
# Pure documentation; never a value.
secret_hint() {
  case "$1" in
    DATABASE_URL)       printf '  Supabase POOLER url (*.pooler.supabase.com:6543; IPv4 => pooler, never the IPv6 direct host).' ;;
    VERCEL_TOKEN)       printf '  deploy-scoped Vercel token (vercel env pull / dashboard). Least-privilege: deploy-only.' ;;
    CRON_SECRET)        printf '  from your vault (source-of-record).' ;;
    PROD_SMOKE_TOKEN)   printf '  from your vault (source-of-record).' ;;
    HC_PING_URL)        printf '  the Healthchecks.io ping URL from the {{NODE_ID}}-deadman check (create it first).' ;;
    BREAK_GLASS_PUBKEY) printf '  the PUBLIC Ed25519 key only (~/.dos/breakglass.pub) — the private key stays on your device.' ;;
    *)                  printf '  pull from its authoritative platform store; never from a file.' ;;
  esac
}

# --- launchd helpers ----------------------------------------------------------
launchd_loaded() { sudo launchctl print "system/$1" >/dev/null 2>&1; }

# --- health probe -------------------------------------------------------------
health_url() { printf 'http://%s:%s%s' "$DOS_NEO_MAGICDNS" "$DOS_HEALTH_PORT" "$1"; }

# http_code <url> — echo the HTTP status (000 on connection failure).
http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null || printf '000'; }
