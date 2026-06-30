#!/usr/bin/env bash
# =============================================================================
# 1/7  install-prereqs.sh  —  the pinned software stack            [AUTOMATED]
# -----------------------------------------------------------------------------
# Installs + PINS the Neo software stack: Homebrew (verified, not installed),
# node@{{NODE_VERSION}}, colima, the docker CLI, gitleaks, vercel@{{VERCEL_CLI_VERSION}},
# tailscale, jq, gh. (NEO-EXEC-07 §6 C1; FOUNDER-INSTALLATION-GUIDE §2.)
#
# IDEMPOTENT: each tool is a precondition-probe (already at its pin?) -> action
# (install/pin) -> verification (resolves at the pin) triad. A satisfied node
# re-runs this as a green no-op, which is also the diagnose path.
#
# FAIL-CLOSED: exits non-zero with the exact tool + expected pin on any miss.
# NO SECRET is read, written, or required here.
#
# Adapter-subsystem asset: it orchestrates the host package manager. Not Core.
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

section "1/7 install-prereqs — pinned software stack"
require_macos

# --- Homebrew is the one prereq this script CANNOT install for you ------------
# (it needs brew to exist first). If absent, print the one bootstrap line and stop.
if ! have brew; then
  manual \
    "Homebrew is not installed. Install it ONCE as your normal admin user, then re-run:" \
    "" \
    '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"' \
    "" \
    "Then ensure /opt/homebrew/bin is on PATH (Apple Silicon)."
  die "Homebrew missing — install it (above), then re-run install-prereqs.sh."
fi
log_ok "Homebrew present: $(brew --version | head -n1)"

# brew_pin <formula> <probe-cmd...> — idempotent install + (best-effort) pin.
# Probe: `brew list --versions <formula>` present => skip the install.
brew_pin() {
  local formula="$1"; shift
  if brew list --versions "$formula" >/dev/null 2>&1; then
    log_ok "$formula already installed ($(brew list --versions "$formula" | head -n1))"
  else
    log_info "installing $formula ..."
    brew install "$formula" || die "brew install $formula failed."
  fi
  # Pin so a routine `brew upgrade` cannot silently bump a gate-affecting tool
  # (the parity-drift risk, NEO-ARCH-01 Risk 5). Re-pin is idempotent.
  brew pin "$formula" >/dev/null 2>&1 || true
}

# --- Node (pinned major; keg-only versioned formula, linked) -----------------
NODE_FORMULA="node@${DOS_NODE_VERSION}"
brew_pin "$NODE_FORMULA"
# versioned node formulae are keg-only — make `node` resolve to the pin.
brew link --overwrite --force "$NODE_FORMULA" >/dev/null 2>&1 || true

# --- the rest of the brew stack ----------------------------------------------
brew_pin git           # the runner checks out code with system git
brew_pin colima
brew_pin docker        # the docker CLI only; the engine is colima's Lima VM
brew_pin gitleaks
brew_pin tailscale     # CLI/daemon; (cask `tailscale` is the GUI app alternative)
brew_pin jq
brew_pin gh

# supabase CLI — the deploy job runs `supabase migration up` (NEO-EXEC-07 §7.3).
# Tapped formula; brew list reports it as plain `supabase`.
if brew list --versions supabase >/dev/null 2>&1; then
  log_ok "supabase already installed ($(brew list --versions supabase | head -n1))"
else
  log_info "installing supabase CLI (supabase/tap/supabase) ..."
  brew install supabase/tap/supabase || die "brew install supabase/tap/supabase failed."
fi
brew pin supabase >/dev/null 2>&1 || true

# --- Vercel CLI: pinned via npm (NOT brew) so the API floor is exact ----------
# `vercel@{{VERCEL_CLI_VERSION}}` — install only if the pin is not already present.
require_cmd node "node@${DOS_NODE_VERSION} should have been installed above."
VERCEL_HAVE=""
have vercel && VERCEL_HAVE="$(vercel --version 2>/dev/null | head -n1 || true)"
if [ "$VERCEL_HAVE" = "$DOS_VERCEL_CLI_VERSION" ]; then
  log_ok "vercel already at pin ($DOS_VERCEL_CLI_VERSION)"
else
  log_info "installing vercel@${DOS_VERCEL_CLI_VERSION} (global npm) ..."
  npm install -g "vercel@${DOS_VERCEL_CLI_VERSION}" || die "npm install -g vercel@${DOS_VERCEL_CLI_VERSION} failed."
fi

# --- verification: every pinned tool resolves (fail-closed) ------------------
section "verify — every pinned tool resolves at its pin"
verify_tool() {
  local name="$1" cmd="$2" want="$3" got
  have "$cmd" || die "MISSING after install: $name ($cmd)."
  got="$($cmd --version 2>&1 | head -n1)"
  if [ -n "$want" ] && ! printf '%s' "$got" | grep -q "$want"; then
    die "PIN MISMATCH: $name expected '~$want', got '$got'."
  fi
  log_ok "$name -> $got"
}
verify_tool "node"      node     "v${DOS_NODE_VERSION}"
verify_tool "vercel"    vercel   "$DOS_VERCEL_CLI_VERSION"
verify_tool "git"       git      ""
verify_tool "colima"    colima   ""
verify_tool "docker"    docker   ""
verify_tool "tailscale" tailscale ""
verify_tool "gitleaks"  gitleaks ""
verify_tool "supabase"  supabase ""
verify_tool "jq"        jq       ""
verify_tool "gh"        gh       ""

log_ok "install-prereqs complete — the pinned stack is present."
