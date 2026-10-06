#!/usr/bin/env python3
"""
IndiDrive AI — Phase 0 | Unified Entry Point
================================================
This does NOT replace run.sh/run.bat (both still work exactly as
before — see README.md). It is an additional, Phase-0-aware entry
point that:

  1. Ensures required directories exist (config/docs/logs/.../storage
     subfolders), without generating any large files.
  2. Runs the health check and prints a report.
  3. Refuses to start the server if the health check reports NOT READY
     for a reason that would make startup pointless (e.g. Python too
     old, config files missing/corrupt) — but starts anyway, with a
     clear warning, for DEGRADED (e.g. CARLA/optional deps missing),
     since those don't block the product platform or the legacy
     simulator from working.
  4. Starts the same `api.server:app` FastAPI application that
     run.sh starts, via uvicorn.

Usage:
    python3 app.py                 # health check, then start the server
    python3 app.py --health-only   # run the health check and exit
    python3 app.py --mode CARLA    # set the Phase 0 operating mode, then start
    python3 app.py --port 8010     # override the port
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

REQUIRED_DIRS = ["config", "docs", "logs", "data", "models", "tests", "storage"]


def ensure_directories() -> None:
    for d in REQUIRED_DIRS:
        (ROOT / d).mkdir(parents=True, exist_ok=True)
    from core.logging_system import ensure_log_directories
    ensure_log_directories()


def main() -> int:
    parser = argparse.ArgumentParser(description="IndiDrive AI — unified entry point")
    parser.add_argument("--health-only", action="store_true", help="Run the health check and exit")
    parser.add_argument("--mode", choices=["OFFLINE", "CARLA", "RECORD", "TEST", "BENCHMARK"],
                         help="Set the Phase 0 operating mode before starting")
    parser.add_argument("--port", type=int, default=None, help="Override the server port (default 8004)")
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default 0.0.0.0)")
    args = parser.parse_args()

    ensure_directories()

    from core.logging_system import get_logger
    log = get_logger("system", component="app")

    from core.health.system_report import run_and_print
    log.info("startup_health_check_begin")
    result = run_and_print()
    log.info("startup_health_check_complete", status=result["overall"])

    if result["overall"] == "NOT READY":
        print(
            "\nHealth check reports NOT READY. Fix the FAIL items above before starting the server.\n"
            "(This usually means Python is too old, or config/*.yaml is missing or invalid.)",
            file=sys.stderr,
        )
        log.critical("startup_aborted", status="NOT READY")
        return 1

    if args.mode:
        from core.modes import set_mode
        mode_state = set_mode(args.mode)
        log.info("operating_mode_set", mode=mode_state["mode"])
        print(f"Operating mode set to {mode_state['mode']}")

    if args.health_only:
        return 0

    try:
        import uvicorn
    except ImportError:
        print(
            "\nCannot start the server: 'uvicorn' is not installed.\n"
            "Install dependencies first:\n"
            "    pip install -r requirements.txt --break-system-packages\n"
            "Or run the health check alone with: python3 app.py --health-only",
            file=sys.stderr,
        )
        log.error("startup_failed", error="uvicorn not installed")
        return 1

    try:
        from api.server import app as fastapi_app
    except ImportError as e:
        print(
            f"\nCannot start the server: a required dependency is missing ({e}).\n"
            "Install dependencies first:\n"
            "    pip install -r requirements.txt --break-system-packages",
            file=sys.stderr,
        )
        log.error("startup_failed", error=str(e))
        return 1
    except Exception as e:
        print(f"\napi/server.py raised an unexpected error on import: {e}", file=sys.stderr)
        log.critical("startup_failed", error=str(e))
        return 1

    from core.config_loader import get as cfg_get
    port = args.port or cfg_get("system", "server.port", 8004)

    print(f"\nStarting IndiDrive AI on http://{args.host}:{port}")
    print(f"  Product platform: http://localhost:{port}/")
    print(f"  Legacy simulator: http://localhost:{port}/simulator/")
    print(f"  API docs:         http://localhost:{port}/api/docs\n")
    log.info("server_start", host=args.host, port=port)

    uvicorn.run(fastapi_app, host=args.host, port=port)
    return 0


if __name__ == "__main__":
    sys.exit(main())
