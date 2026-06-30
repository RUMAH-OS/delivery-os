#!/usr/bin/env bash
# =============================================================================
# 2/7  join-tailnet.sh  —  the private fabric                            [SEMI]
# -----------------------------------------------------------------------------
# Brings Neo onto the Tailscale mesh as `{{NEO_MAGICDNS}}` with the exec-node tags,
# enables MagicDNS + Tailscale SSH, renders the ACL policy for the founder to
# apply, and asserts the tailnet-only bind posture (nothing on 0.0.0.0).
# (NEO-EXEC-07 §6 C2; NTS-DOS-v1 §A/§D; FOUNDER-INSTALLATION-GUIDE §4.)
#
# IDEMPOTENT: probe `tailscale status` (already joined + tagged?) -> action
# (`tailscale up ...`) -> verify (online, tagged, MagicDNS resolves, no public bind).
#
# SEMI-automated — the irreducibly-MANUAL parts (NEO-EXEC-07 §8) are:
#   * enabling Device Approval in the admin console                  [MANUAL]
#   * approving the `neo` device after `tailscale up`         [ONE-TIME-AUTH]
#   * pasting the rendered ACL (with its tests[]) into the console  [MANUAL]
# These cannot be automated without a standing Tailscale-admin god-credential on
# Neo — the exact thing the security model forbids.
# =============================================================================
# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
load_node_config

section "2/7 join-tailnet — the private fabric"
require_macos
require_cmd tailscale "Run install-prereqs.sh first."

# --- founder console precondition (cannot be probed from the CLI) ------------
manual \
  "Before joining, in the Tailscale admin console:" \
  "  Settings -> Device approval -> ON   (closes the auth-key -> silent-join hole, NTS §E.1)." \
  "This installer cannot toggle that for you; it is a founder console act."

# --- PROBE: already joined + tagged? -> green no-op --------------------------
TS_TAGS="tag:exec-node,tag:ci-runner"
already_joined() {
  tailscale status >/dev/null 2>&1 || return 1
  # online AND both tags present in the self record
  tailscale status --json 2>/dev/null \
    | grep -q '"Online": *true' || return 1
  tailscale status --json 2>/dev/null | grep -q '"tag:exec-node"' || return 1
  tailscale status --json 2>/dev/null | grep -q '"tag:ci-runner"' || return 1
  return 0
}

if already_joined; then
  log_ok "tailnet: already joined + tagged ($TS_TAGS) — no-op."
else
  log_info "bringing Neo onto the tailnet (you will be shown an approval URL) ..."
  # --ssh: Tailscale SSH (keyless, ACL-governed), no public sshd (NTS §C / ADR-2).
  # The hostname is `neo`; the registry nodeId stays {{NODE_ID}} (NTS §A.3).
  sudo tailscale up \
    --advertise-tags="$TS_TAGS" \
    --hostname="$DOS_NEO_MAGICDNS" \
    --ssh \
    --accept-routes=false \
    || die "tailscale up failed — see the message above."
  one_time_auth \
    "Approve the '${DOS_NEO_MAGICDNS}' device now:" \
    "  open the URL printed above, OR admin console -> Machines -> approve '${DOS_NEO_MAGICDNS}'." \
    "Until you approve it, the node has NO tailnet access (auth != trust)."
fi

# --- resolve + persist the tailnet bind address (for the daemons) ------------
TAILNET_ADDR="$(tailscale ip -4 2>/dev/null | head -n1 || true)"
if [ -n "$TAILNET_ADDR" ]; then
  log_ok "tailnet IPv4: $TAILNET_ADDR  (services bind THIS / tailscale0, NEVER 0.0.0.0)"
  log_info "Set DOS_TAILNET_BIND_ADDR=$TAILNET_ADDR in node-config.env so install-daemons binds correctly."
else
  log_warn "Could not resolve the tailnet IPv4 yet (device may be pending approval)."
fi

# --- render the ACL policy for the founder to apply --------------------------
# tailscale/acl.hujson.template (NEO-EXEC-07 §5.3). We render the {{placeholders}}; the
# founder pastes the result — with its tests[]. FAIL-CLOSED: render_template `die`s if the
# template is genuinely missing (no warn-skip — a missing ACL must HALT, not be silently dropped).
ACL_OUT="$(render_template "tailscale/acl.hujson.template" "acl.hujson")"
manual \
  "Apply the rendered default-deny ACL (ships WITH its tests[] block):" \
  "  1. open: $ACL_OUT" \
  "  2. paste it into admin console -> Access Controls -> Save" \
  "  3. confirm the console TEST RUNNER shows tests[] PASSING" \
  "     (an ACL without passing tests is an assertion, not a gate, NTS §D)." \
  "  Spot-check: tag:ci-runner is DENIED tag:dev:22 and tag:exec-node:${DOS_HEALTH_PORT};" \
  "              funnel:deny is pinned on tag:ci-runner."

# --- VERIFY: joined, tagged, MagicDNS resolves, tailnet-only bind posture ----
section "verify — joined, tagged, MagicDNS, tailnet-only bind"
tailscale status 2>/dev/null | grep -q "$DOS_NEO_MAGICDNS" \
  && log_ok "MagicDNS name '${DOS_NEO_MAGICDNS}' resolves on the tailnet." \
  || log_warn "MagicDNS name not visible yet (pending device approval?)."

# Assert NOTHING listens on 0.0.0.0 / a routable LAN address (NTS §A.2/§E.5).
# The health endpoint binds tailscale0; the test Postgres binds 127.0.0.1 only.
if PUBLIC_BIND="$(sudo lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null | grep -E '\*:|0\.0\.0\.0:' || true)"; [ -n "$PUBLIC_BIND" ]; then
  log_warn "Something is listening on a wildcard address — review (must be tailnet-only):"
  printf '%s\n' "$PUBLIC_BIND" >&2
else
  log_ok "No service is bound to 0.0.0.0 / a wildcard address (tailnet-only posture holds)."
fi

manual \
  "Also enable the macOS application firewall:" \
  "  System Settings -> Network -> Firewall -> ON" \
  "  (Tailscale ACLs govern tailnet traffic, not Neo's local LAN, NTS §E.5)."

log_ok "join-tailnet complete — fabric joined; ACL + firewall are founder console acts."
