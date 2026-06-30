#!/usr/bin/env bash
# =============================================================================
# 4/7  bootstrap-secrets.sh  —  seed the System keychain, fail-closed  [MANUAL]
# -----------------------------------------------------------------------------
# The one-time founder seeding of Neo's secrets into the macOS SYSTEM keychain
# (NOT a login keychain — NEO-OPS-06 §3 Decision A: a root LaunchDaemon at boot
# cannot read a user-login keychain). For each registry key that is not already
# PRESENT, it prompts the founder to paste the value and writes it with
# `security add-generic-password ... -U`. Then `config-doctor` fail-closes a
# half-bootstrapped node. (NEO-EXEC-07 §6 C4 / §5.7; NTS §F; FOUNDER-GUIDE §6.)
#
# IDEMPOTENT: probe (key already in the System keychain?) -> action (prompt +
# write ONLY missing keys) -> verify (config-doctor exits 0).
#
# MANUAL by security design (NEO-EXEC-07 §8): the values are typed into the SSH
# session, pulled live from the AUTHORITATIVE platform stores. This script NEVER
# hard-codes a secret, NEVER writes a value to a file or the git tree, NEVER
# echoes a value, and reads each with `read -s`.
#
# The Ed25519 break-glass keypair is generated on the FOUNDER'S device, never on
# Neo (ADR-SEC-3): only the PUBLIC key is ever seeded here.
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

section "4/7 bootstrap-secrets — seed the System keychain (fail-closed)"
require_macos
require_cmd security "macOS keychain tool 'security' is required."

# --- the key list comes from the registry template (the single source of truth) -------------
# FAIL-CLOSED: require_template `die`s if the manifest is genuinely missing — never silently
# fall back to a hardcoded key list (that drift is exactly what masks a half-seeded node).
REG_TEMPLATE="$(require_template "config/secret-registry.neo.template")"
# extract every "key": "NAME" from the metadata-only manifest (NO values in it).
SECRET_KEYS="$(grep -oE '"key"[[:space:]]*:[[:space:]]*"[^"]+"' "$REG_TEMPLATE" | sed -E 's/.*"([^"]+)"$/\1/' | tr '\n' ' ')"
[ -n "$SECRET_KEYS" ] || die "secret-registry manifest parsed ZERO keys ($REG_TEMPLATE) — the registry is empty or malformed. Cannot seed a node with no key set."
log_ok "registry keys from $REG_TEMPLATE: $SECRET_KEYS"

# --- the founder-device keygen reminder (NEVER run on Neo) -------------------
if printf '%s' "$SECRET_KEYS" | grep -q "BREAK_GLASS_PUBKEY"; then
  manual \
    "BREAK_GLASS_PUBKEY: generate the Ed25519 keypair on YOUR FOUNDER DEVICE, not Neo:" \
    "" \
    "  ssh-keygen -t ed25519 -f ~/.dos/breakglass -C dos-break-glass -N ''" \
    "" \
    "  The PRIVATE key (~/.dos/breakglass) STAYS on your device (ADR-SEC-3) — a" \
    "  compromised Neo must be UNABLE to mint a prod-write grant. Seed ONLY the" \
    "  PUBLIC key (~/.dos/breakglass.pub) when prompted below."
fi

# --- per-key: probe -> (prompt + write) ONLY if missing ----------------------
SEEDED=0
SKIPPED=0
for KEY in $SECRET_KEYS; do
  if keychain_has "$KEY"; then
    log_ok "$KEY already present in the System keychain — skip."
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  manual \
    "Seed '$KEY' — pull the value LIVE from its authoritative store, never a file:" \
    "$(secret_hint "$KEY")"

  if [ "${DOS_ASSUME_YES:-0}" = "1" ]; then
    log_warn "DOS_ASSUME_YES=1 (non-interactive) — cannot seed '$KEY'; leaving it MISSING (config-doctor will fail closed)."
    continue
  fi

  # read -s: no echo. The value never touches a file, a log, or the tree.
  printf '   Paste value for %s (input hidden): ' "$KEY"
  VALUE=""
  read -r -s VALUE || VALUE=""
  printf '\n'
  if [ -z "$VALUE" ]; then
    log_warn "empty input — '$KEY' left MISSING (re-run to seed it)."
    continue
  fi

  # Write to the SYSTEM keychain under the runner account; -U updates if present.
  sudo security add-generic-password \
    -a "$DOS_RUNNER_USER" \
    -s "$KEY" \
    -w "$VALUE" \
    -T /usr/bin/security \
    -U "$SYSTEM_KEYCHAIN" \
    || die "failed to write '$KEY' to the System keychain."
  VALUE=""        # scrub the value from the environment immediately
  unset VALUE
  log_ok "$KEY written to the System keychain (value not echoed)."
  SEEDED=$((SEEDED + 1))
done

log_info "secrets: $SEEDED seeded, $SKIPPED already present."

# --- VERIFY: fail-closed config gate -----------------------------------------
section "verify — config-doctor (fail-closed; prints no secret value)"
config_gate

# --- anti-leak self-check: assert nothing landed in the tree -----------------
if have gitleaks; then
  log_info "gitleaks detect (confirm no secret leaked into the tree) ..."
  (cd "$REPO_ROOT" && gitleaks detect --no-banner --redact >/dev/null 2>&1) \
    && log_ok "gitleaks: clean — no tree-resident secret." \
    || log_warn "gitleaks reported findings — investigate (a secret must NEVER be tree-resident)."
fi

log_ok "bootstrap-secrets complete — System keychain seeded; config-doctor green."
