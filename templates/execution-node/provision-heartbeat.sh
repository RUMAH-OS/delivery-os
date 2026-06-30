#!/usr/bin/env bash
# Delivery OS — Execution Node capability: always-on heartbeat / runtime host.
#
# Drives the execution-engine tick at a REAL interval from an always-on node — the thing serverless
# daily-granularity cron tiers cannot honour and hosted-CI minutes cannot afford. Platform recipe;
# parameterized; names no project/host/path.
#
# Usage:
#   HEARTBEAT_SECRET=xxxx bash provision-heartbeat.sh --endpoint <https-url> [--interval 300] \
#       [--label com.deliveryos.heartbeat] [--load]
#
# Required:
#   --endpoint <url>            the engine tick endpoint to POST (e.g. .../api/cron/tick or /v1/heartbeat)
#   HEARTBEAT_SECRET (env only) the shared secret the endpoint expects (sent as a bearer header)
# Optional:
#   --interval <seconds>        default 300 (matches a */5 tick); contract floor is 60
#   --label <reverse-dns>       launchd label, default com.deliveryos.heartbeat
#   --load                      render + load the launchd service now (otherwise just render the plist)
set -euo pipefail

ENDPOINT="" ; INTERVAL=300 ; LABEL="com.deliveryos.heartbeat" ; DO_LOAD=0
while [ $# -gt 0 ]; do case "$1" in
  --endpoint) ENDPOINT="${2:?}"; shift 2;;
  --interval) INTERVAL="${2:?}"; shift 2;;
  --label) LABEL="${2:?}"; shift 2;;
  --load) DO_LOAD=1; shift;;
  *) echo "FATAL: unknown arg '$1'"; exit 2;;
esac; done

: "${ENDPOINT:?FATAL: --endpoint <https-url> required}"
: "${HEARTBEAT_SECRET:?FATAL: HEARTBEAT_SECRET env required (never pass secrets as args)}"
[[ "$ENDPOINT" == https://* ]] || { echo "FATAL: endpoint must be https"; exit 2; }
[ "$INTERVAL" -ge 60 ] || { echo "FATAL: interval floor is 60s (node-contract)"; exit 2; }
[ "$(uname -s)" = "Darwin" ] || { echo "FATAL: launchd is macOS; add a systemd branch to extend"; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$HERE/launchd/com.deliveryos.heartbeat.plist.template"
[ -f "$TEMPLATE" ] || { echo "FATAL: missing $TEMPLATE"; exit 1; }

# Secret is written to a 0600 file owned by the runner user — NOT embedded in the plist (which is
# world-readable). The tick script reads it at runtime.
SECRET_DIR="$HOME/.config/deliveryos"; mkdir -p "$SECRET_DIR"; chmod 700 "$SECRET_DIR"
printf '%s' "$HEARTBEAT_SECRET" > "$SECRET_DIR/heartbeat.secret"; chmod 600 "$SECRET_DIR/heartbeat.secret"

TICK="$SECRET_DIR/heartbeat-tick.sh"
cat > "$TICK" <<TICKEOF
#!/usr/bin/env bash
set -euo pipefail
curl -fsS -m 60 -X POST "$ENDPOINT" \\
  -H "Authorization: Bearer \$(cat "$SECRET_DIR/heartbeat.secret")" \\
  -H "Content-Type: application/json" -d '{}' >/dev/null
TICKEOF
chmod 700 "$TICK"

OUT="$HOME/Library/LaunchAgents/${LABEL}.plist"
mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|@@LABEL@@|${LABEL}|g" \
    -e "s|@@PROGRAM@@|${TICK}|g" \
    -e "s|@@INTERVAL@@|${INTERVAL}|g" \
    -e "s|@@LOGDIR@@|${SECRET_DIR}|g" \
    "$TEMPLATE" > "$OUT"
echo "OK: rendered launchd service -> $OUT (interval ${INTERVAL}s)"

if [ "$DO_LOAD" = 1 ]; then
  launchctl unload "$OUT" 2>/dev/null || true
  launchctl load -w "$OUT"
  echo "OK: heartbeat service loaded. tail $SECRET_DIR/heartbeat.out for ticks."
else
  echo "Rendered only. Load with:  launchctl load -w \"$OUT\""
fi
