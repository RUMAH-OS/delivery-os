#!/usr/bin/env bash
# Delivery OS — Execution Node capability: host the platform Execution Engine runtime (M2, ADR-005).
#
# Stands the platform engine on an Execution Node: applies the vendored engine migrations to the MANAGED
# platform durable store, then installs a launchd service that runs the continuous tick host
# (engine-host/run-engine-host.ts). The engine SOURCE is platform (../workflow-engine, vendored); this is
# the node-side recipe to RUN it. Parameterized; names no project, host, or path.
#
# Usage:
#   ENGINE_DATABASE_URL=postgres://… bash provision-engine-runtime.sh \
#       [--packs mod-a,mod-b] [--label com.deliveryos.engine] [--node-user <osuser>] [--migrate-only] [--load]
#
# Required (env only — never an arg):
#   ENGINE_DATABASE_URL   the MANAGED platform durable store (e.g. a dedicated platform Postgres). REPLACEABILITY
#                         (ADR-005): this is NOT node-local and is NOT a consumer's DB — a node must be
#                         replaceable without losing run/step state.
# Optional:
#   --packs <csv>         domain definition-pack modules to register (ENGINE_PACKS); empty = bare drainer
#   --migrate-only        apply migrations and exit (no service)
#   --load                load the launchd service now (RUNNING the engine = a deploy step; default OFF)
set -euo pipefail

PACKS="" ; LABEL="com.deliveryos.engine" ; NODE_USER="$(id -un)" ; MIGRATE_ONLY=0 ; DO_LOAD=0
while [ $# -gt 0 ]; do case "$1" in
  --packs) PACKS="${2:?}"; shift 2;;
  --label) LABEL="${2:?}"; shift 2;;
  --node-user) NODE_USER="${2:?}"; shift 2;;
  --migrate-only) MIGRATE_ONLY=1; shift;;
  --load) DO_LOAD=1; shift;;
  *) echo "FATAL: unknown arg '$1'"; exit 2;;
esac; done

: "${ENGINE_DATABASE_URL:?FATAL: ENGINE_DATABASE_URL env required (the MANAGED platform durable store; never node-local, never a consumer DB)}"
[[ "$ENGINE_DATABASE_URL" == postgres*://* ]] || { echo "FATAL: ENGINE_DATABASE_URL must be a postgres URL"; exit 2; }
command -v psql >/dev/null || { echo "FATAL: psql required to apply engine migrations"; exit 1; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_DIR="$(cd "$HERE/../workflow-engine" && pwd)"
MIG_DIR="$ENGINE_DIR/migrations"
[ -d "$MIG_DIR" ] || { echo "FATAL: vendored engine migrations not found at $MIG_DIR"; exit 1; }

echo "==> ensuring migration ledger on the platform store"
psql "$ENGINE_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  'CREATE TABLE IF NOT EXISTS _engine_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());'

for f in $(ls "$MIG_DIR"/*.sql | grep -v '\.down\.sql' | sort); do
  name="$(basename "$f")"
  applied="$(psql "$ENGINE_DATABASE_URL" -tA -c "SELECT 1 FROM _engine_migrations WHERE name='${name}'" 2>/dev/null || true)"
  if [ "$applied" = "1" ]; then echo "    skip (applied): $name"; continue; fi
  echo "    apply: $name"
  psql "$ENGINE_DATABASE_URL" -v ON_ERROR_STOP=1 -q -1 -f "$f"
  psql "$ENGINE_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO _engine_migrations(name) VALUES ('${name}');"
done
echo "OK: platform engine schema migrated."
[ "$MIGRATE_ONLY" = 1 ] && { echo "migrate-only: done."; exit 0; }

# Install the host's runtime deps (delivery-os stays dependency-free; the NODE installs them — no-runtime
# invariant). node_modules lands in engine-host/ (gitignored). Then resolve ABSOLUTE node + tsx for launchd.
command -v node >/dev/null || { echo "FATAL: node (22.x) required on the node"; exit 1; }
case "$(node -v)" in v22.*) :;; *) echo "WARN: node $(node -v) — the engine stack pins 22.x";; esac
echo "==> installing engine-host runtime deps (drizzle-orm/postgres/tsx)"
( cd "$HERE/engine-host" && npm install --no-audit --no-fund --silent )
NODE_BIN="$(command -v node)"
TSX_CLI="$HERE/engine-host/node_modules/tsx/dist/cli.mjs"
[ -f "$TSX_CLI" ] || { echo "FATAL: tsx not installed at $TSX_CLI"; exit 1; }

# Render the launchd service for the continuous tick host (runs as the node user).
TEMPLATE="$HERE/launchd/com.deliveryos.engine.plist.template"
[ -f "$TEMPLATE" ] || { echo "FATAL: missing $TEMPLATE"; exit 1; }
SECRET_DIR="$HOME/.config/deliveryos"; mkdir -p "$SECRET_DIR"; chmod 700 "$SECRET_DIR"
# the store URL is a secret → 0600 env file the service reads; NOT embedded in the world-readable plist.
ENVFILE="$SECRET_DIR/engine.env"; : > "$ENVFILE"; chmod 600 "$ENVFILE"
{ echo "ENGINE_DATABASE_URL=$ENGINE_DATABASE_URL"; [ -n "$PACKS" ] && echo "ENGINE_PACKS=$PACKS"; } >> "$ENVFILE"

OUT="$HOME/Library/LaunchAgents/${LABEL}.plist"; mkdir -p "$HOME/Library/LaunchAgents"
sed -e "s|@@LABEL@@|${LABEL}|g" -e "s|@@NODE_USER@@|${NODE_USER}|g" \
    -e "s|@@NODE@@|${NODE_BIN}|g" -e "s|@@TSXCLI@@|${TSX_CLI}|g" \
    -e "s|@@HOST_TS@@|${HERE}/engine-host/run-engine-host.ts|g" \
    -e "s|@@WORKDIR@@|${HERE}/engine-host|g" \
    -e "s|@@ENVFILE@@|${ENVFILE}|g" -e "s|@@LOGDIR@@|${SECRET_DIR}|g" \
    "$TEMPLATE" > "$OUT"
echo "OK: rendered engine service -> $OUT  (node=$NODE_BIN)"

if [ "$DO_LOAD" = 1 ]; then
  launchctl unload "$OUT" 2>/dev/null || true
  launchctl load -w "$OUT"
  echo "OK: engine host loaded (continuous tick). tail $SECRET_DIR/engine.out"
else
  echo "Rendered only (engine NOT started). Starting it RUNS the platform engine on this node — a deploy step."
  echo "Load with:  launchctl load -w \"$OUT\""
fi
