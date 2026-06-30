#!/usr/bin/env bash
# =============================================================================
# 6/7  verify-health.sh  —  the go-live gate      [AUTOMATED + FOUNDER GATE]
# -----------------------------------------------------------------------------
# The pure read/verify go-live gate. Mutates NOTHING — always safe to run, and is
# the one-command diagnose path for a degraded node. Asserts (NEO-EXEC-07 §6 C6;
# FOUNDER-INSTALLATION-GUIDE §8/§9; the §8/§9 acceptance checks):
#   1. config-doctor --include-local            (fail-closed secret set)
#   2. GET /ready   == 200 / verdict "ok"       (full report, worst-wins fold)
#   3. GET /health  == ok:true                  (liveness, Supabase-independent)
#   4. platform-health report verdict "ok"      (every failure a NAMED cause)
#   5. engine_heartbeat tick_seq advancing      (the daemon is ticking, not wedged)
#   6. the watchdog check-in is live            (the /ready-gated Healthchecks push)
#
# The cold-boot recovery test (NEO-OPS-06 §3.5) and the runner parity-prove are
# M4/M5 FOUNDER ★ gates — printed as manual checkpoints, not auto-run here.
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

section "6/7 verify-health — the go-live gate (read-only)"
require_macos
require_cmd curl

FAILS=0
note_fail() { log_err "$*"; FAILS=$((FAILS + 1)); }

# --- 1. config-doctor fail-closed --------------------------------------------
section "check 1/6 — config-doctor (fail-closed)"
if config_gate; then :; else note_fail "config-doctor gate failed."; fi

# --- 2. /ready green ----------------------------------------------------------
section "check 2/6 — GET /ready (full report, 200/ok)"
READY_URL="$(health_url /ready)"
READY_CODE="$(http_code "$READY_URL")"
if [ "$READY_CODE" = "200" ]; then
  if have jq; then
    VERDICT="$(curl -s --max-time 5 "$READY_URL" | jq -r '.verdict // "unknown"' 2>/dev/null || echo unknown)"
    [ "$VERDICT" = "ok" ] && log_ok "/ready -> 200, verdict=ok" || note_fail "/ready 200 but verdict='$VERDICT' (expected ok)."
  else
    log_ok "/ready -> 200 (install jq to assert verdict)."
  fi
else
  note_fail "/ready -> HTTP $READY_CODE (expected 200; 503 = verdict down; 000 = unreachable). URL: $READY_URL"
fi

# --- 3. /health liveness (no DB) ---------------------------------------------
section "check 3/6 — GET /health (liveness, Supabase-independent)"
HEALTH_URL="$(health_url /health)"
HEALTH_CODE="$(http_code "$HEALTH_URL")"
if [ "$HEALTH_CODE" = "200" ]; then
  if have jq; then
    OK="$(curl -s --max-time 5 "$HEALTH_URL" | jq -r '.ok // false' 2>/dev/null || echo false)"
    [ "$OK" = "true" ] && log_ok "/health -> ok:true (process up, no DB touch)" || note_fail "/health ok=$OK."
  else
    log_ok "/health -> 200."
  fi
else
  note_fail "/health -> HTTP $HEALTH_CODE (expected 200). URL: $HEALTH_URL"
fi

# --- 4. platform-health report ------------------------------------------------
section "check 4/6 — platform-health report (named-cause fold)"
if [ -f "$PLATFORM_HEALTH" ] && have node; then
  if node "$PLATFORM_HEALTH" >/dev/null 2>&1; then
    log_ok "platform-health report generated (verdict ok)."
  else
    note_fail "platform-health reported a non-ok verdict (a named subsystem cause is printed above)."
  fi
else
  log_warn "platform-health.mjs not runnable here (Core tool at $PLATFORM_HEALTH) — relying on /ready."
fi

# --- 5. engine_heartbeat advancing -------------------------------------------
# /ready already folds heartbeat-freshness; a direct two-sample tick_seq check
# needs DB access (psql). We assert via /ready and offer the direct query as a hint.
section "check 5/6 — engine_heartbeat advancing (daemon ticking)"
if [ "$READY_CODE" = "200" ]; then
  log_ok "heartbeat freshness folds into /ready (verdict ok ⇒ tick_seq fresh < 60s, NEO-HBM Layer B)."
  log_info "Direct proof (optional): query engine_heartbeat for ${DOS_NODE_ID} twice ~30s apart; tick_seq must increase."
else
  note_fail "cannot confirm heartbeat — /ready is not green."
fi

# --- 6. watchdog check-in live -----------------------------------------------
section "check 6/6 — off-node watchdog check-in (the /ready-gated push)"
if launchd_loaded "com.deliveryos.supervisor"; then
  log_ok "supervisor daemon loaded — it POSTs HC_PING_URL every ${DOS_HC_PERIOD_SECONDS}s ONLY when /ready is green (NEO-HBM ADR-003)."
  manual \
    "Confirm the off-Neo dead-man is receiving the push (cannot be probed from Neo):" \
    "  Healthchecks.io -> the ${DOS_NODE_ID}-deadman check shows green/up on a steady cadence."
else
  note_fail "supervisor daemon not loaded — the dead-man push is not running. Run install-daemons.sh."
fi

# --- the M4/M5 FOUNDER ★ gates (manual, not auto-run) ------------------------
founder_approval \
  "Cold-boot recovery test (NEO-OPS-06 §3.5) — run at M4/M5:" \
  "  PLANNED:   sudo fdesetup authrestart -> autostart -> /ready green, NO human." \
  "  UNPLANNED: hard power-cycle (FileVault locked) -> watchdog pages within grace -> you log in." \
  "  KEYCHAIN:  boot with no GUI login -> daemon reads the SYSTEM keychain -> config-doctor passes." \
  "Runner parity-prove — a non-binding ci clone yields a BYTE-IDENTICAL verdict vs GitHub-hosted."

# --- verdict ------------------------------------------------------------------
section "verify-health verdict"
if [ "$FAILS" -eq 0 ]; then
  log_ok "verify-health: ALL automated checks GREEN. (Founder ★ gates above remain a human yes.)"
  exit 0
else
  die "verify-health: $FAILS automated check(s) FAILED — Neo is installed, not accepted. Fix and re-run."
fi
