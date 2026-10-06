#!/usr/bin/env bash
# ============================================================
# IndiDrive AI — unified project, single-process launcher.
#
# This starts ONE server on ONE port (8004) that serves:
#   - the Phase 5 product platform UI + API   at /
#   - the legacy canvas simulator (Phase 1)   at /simulator
#     (mounted in-process via a2wsgi — see api/server.py)
#
# CARLA integration (core/carla_integration/) is a client library,
# not something this script starts — it connects OUT to a separately
# running CARLA server. Check its status once this is running:
#   curl http://localhost:8004/api/carla/status
# To actually drive in CARLA (needs a running CARLA server):
#   python3 scripts/carla_test_connection.py
#   python3 scripts/carla_spawn_and_record.py
# ============================================================
set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
PYTHON=${PYTHON:-python3}
PORT=${PORT:-8004}

echo "Starting IndiDrive AI on http://localhost:$PORT"
echo "  Product platform: http://localhost:$PORT/"
echo "  Legacy simulator: http://localhost:$PORT/simulator/"
echo "  API docs:         http://localhost:$PORT/api/docs"
echo ""
exec "$PYTHON" -m uvicorn api.server:app --host 0.0.0.0 --port "$PORT"
