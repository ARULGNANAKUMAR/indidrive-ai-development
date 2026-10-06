# IndiDrive AI — Phase 0 Baseline

All numbers below were actually measured in the development sandbox on
2026-09-13 (Python 3.12.3, Linux container, no network access, `fastapi`
/`uvicorn`/`httpx`/`pytest`/`a2wsgi` NOT installed — see
`docs/PROJECT_AUDIT.md` for why). Nothing here is estimated or invented.
Where a metric could not be measured, it is marked `NOT AVAILABLE`.

Re-run this yourself after `pip install -r requirements.txt` with:
```bash
PYTHONPATH=. python3 -c "from core.health.system_report import run_and_time; print(run_and_time())"
```

## Startup / health

| Metric | Value | How measured |
|---|---|---|
| Health check execution time | **0.77 s** | `time.perf_counter()` around `run_health_check()` (first call — imports all core modules + attempts `carla`/`fastapi` imports) |
| `app.py --health-only` cold start (whole process) | **0.28 s** | wall-clock around a fresh `python3 app.py --health-only` subprocess |
| Core module import time (dataset/models/echo/benchmark/scenarios/reports/deployment) | **< 1 ms** | `time.perf_counter()` around 7 `importlib.import_module()` calls |
| Legacy simulator (`legacy_simulator/server.py`) import time | **< 1 ms** | `time.perf_counter()` around `import server` |
| Peak resident memory (health check + core imports, single process) | **9.3 MB** (`ru_maxrss`) | `resource.getrusage(RUSAGE_SELF).ru_maxrss` |
| FastAPI app (`api/server.py`) startup time | **NOT AVAILABLE** | `fastapi`/`uvicorn` are not installed in this sandbox (no network access to `pip install`); health check reports this as `WARN`, not a simulated pass |
| CARLA connection time | **NOT AVAILABLE** | no CARLA server running in this environment; `core/carla_integration/connection.py`'s honest failure path was exercised instead (raises `CarlaUnavailableError` / import fails cleanly) |
| Sensor initialization time | **NOT AVAILABLE** | requires a live CARLA server (see above) |

## Existing simulation AI latency (legacy_simulator/server.py, via Flask test client)

These exercise the actual `SimAI` class already in the codebase — a
deterministic, simulation-only decision/path layer (see
`config/planner_config.yaml` for the documented algorithm). This is
**not** a claim about a real autonomous-driving planner's latency.

| Endpoint | Metric | Value |
|---|---|---|
| `/api/health` | response time | **3.1 ms** (single call, includes Flask test-client dispatch overhead) |
| `/api/ai/plan` (5 candidate paths × 11 waypoints, 20 obstacles) | average latency | **0.64 ms/call** (mean over 100 calls) |
| `/api/ai/decision` (9 candidate actions) | average latency | **0.22 ms/call** (mean over 100 calls) |

## CPU usage

**NOT AVAILABLE** — no sustained workload was run long enough in this
sandbox to produce a meaningful CPU-utilization sample (the checks
above are all sub-millisecond to sub-second one-shot calls). Re-measure
under sustained load (e.g. the benchmark suite, `POST /api/benchmark/run`)
once `fastapi`/`httpx` are installed.

## What this baseline is for

Phase 0 establishes these numbers as the reference point for future
phases. A regression in health-check time, core-module import time, or
the existing `/api/ai/plan` / `/api/ai/decision` latency during Phase 1+
should be visible against this file. None of these numbers should be
read as production performance claims — they describe a single-process
Flask test client in a sandbox, not a deployed service under load.
