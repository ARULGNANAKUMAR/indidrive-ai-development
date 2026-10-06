#!/usr/bin/env python3
"""
Smoke test: can this machine's Python actually reach a running CARLA
server? Run this BEFORE anything else. If this fails, nothing else in
this project will work, so fix this first.

Usage:
    python scripts/test_connection.py [--host localhost] [--port 2000]
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.carla_integration.connection import CarlaConnection, CarlaUnavailableError


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="localhost")
    parser.add_argument("--port", type=int, default=2000)
    args = parser.parse_args()

    print(f"Connecting to CARLA server at {args.host}:{args.port} ...")
    conn = CarlaConnection(host=args.host, port=args.port, timeout=10.0)
    try:
        conn.connect()
    except CarlaUnavailableError as e:
        print(f"\nFAILED: {e}\n")
        sys.exit(1)

    info = conn.server_info()
    print("\nConnected successfully.")
    print(f"  Client API version: {info['client_version']}")
    print(f"  Server version:     {info['server_version']}")
    print(f"  Current map:        {info['current_map']}")
    print(f"  Available maps ({len(info['available_maps'])}):")
    for m in info["available_maps"]:
        print(f"    - {m}")
    print("\nIf client/server versions don't match, expect subtle bugs — "
          "reinstall the matching carla wheel from your CARLA build's PythonAPI/carla/dist/.")


if __name__ == "__main__":
    main()
