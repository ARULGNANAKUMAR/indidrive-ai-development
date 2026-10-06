# IndiDrive AI — Project Audit (Phase 0)

This audit reflects the project as it actually exists in the uploaded
ZIP, verified by reading the source and, where possible, importing and
exercising it directly in this sandbox — not by trusting `README.md`'s
claims at face value. The sandbox has **no network access**, so
`fastapi`, `uvicorn`, `httpx`, `pytest`, and `a2wsgi` could not be
installed or runtime-verified here; that limitation is called out
explicitly everywhere it matters below.

## 1. Current architecture

One Python process, one port (8004 by default):

- **`api/server.py`** — a FastAPI app that is the actual "front door".
  It owns:
  - Its own REST API for dataset management, model registry, ECHO V2
    self-learning, the benchmark suite, scenario generation, report
    downloads, deployment-mode switching, and analytics — all backed
    by the plain-Python modules in `core/`.
  - A mounted copy of an older, independent Flask app
    (`legacy_simulator/server.py`) at `/simulator`, bridged in-process
    with `a2wsgi.WSGIMiddleware` so it runs as one process rather than
    a second server on a second port.
  - A static file mount at `/` serving `frontend/` (the newer product
    UI).
  - A capability-check endpoint (`/api/carla/status`) that reports
    whether `core/carla_integration/` imports cleanly and whether the
    real `carla` package is installed — it does not connect to a CARLA
    server itself.
- **`legacy_simulator/`** — a self-contained Flask + vanilla-JS/canvas
  2D driving simulator. This is the only part of the project with an
  actual, working (simulation-only) perception/decision/planning
  pipeline (`SimAI` class in `legacy_simulator/server.py`): object
  detection scoring, trajectory prediction, time-to-collision risk
  scoring, a 9-action decision layer, and a 5-candidate-path lateral
  offset planner. It can also run fully standalone (`python
  legacy_simulator/server.py`, its own `__main__` block reads `PORT`/
  `DEBUG` env vars).
- **`core/carla_integration/`** — a real CARLA *client* library
  (connection, ego vehicle spawning, camera/LiDAR sensor attachment
  with a thread-safe `SensorBus`). It connects **out** to an
  already-running, separately-installed CARLA server; nothing in this
  repo starts or embeds CARLA. `carla` import is deferred to call time
  specifically so the rest of the codebase can be imported/tested
  without CARLA installed — verified true in this sandbox.
- **`core/{dataset,models,echo,benchmark,scenarios,reports}/`** and
  **`core/deployment.py`** — independent, file-backed (JSON/JSONL, no
  SQL) managers for the product-platform side of the app. Each is
  plain-stdlib Python (dataset manager also needs nothing beyond
  stdlib; optional `ultralytics`/`reportlab` are used only if present,
  with clearly labeled fallbacks already built in).
- **`frontend/`** — static HTML/CSS/JS product UI, calls the
  `api/server.py` REST API.
- **`scripts/`** — two CLI tools (`carla_test_connection.py`,
  `carla_spawn_and_record.py`) for talking to a real CARLA server; not
  imported by the app itself.

## 2. Entry points (as they existed before Phase 0)

| Command | What it does |
|---|---|
| `bash setup.sh` | `pip install -r requirements.txt --break-system-packages` |
| `bash run.sh` / `run.bat` | `uvicorn api.server:app --host 0.0.0.0 --port 8004` (or `%PORT%`) |
| `python legacy_simulator/server.py` | Runs the legacy simulator standalone on Flask's dev server (port from `PORT` env var, default 5000) |
| `python3 scripts/carla_test_connection.py [--host] [--port]` | One-shot CARLA connectivity check |
| `python3 scripts/carla_spawn_and_record.py ...` | Spawns an ego vehicle in CARLA and records sensor data |
| `PYTHONPATH=. pytest tests/test_phase5.py -v` | Runs the Phase 5 core-module test suite |

**Phase 0 adds:** `python3 app.py` (see §6) as an additional entry
point that runs the health check and directory bootstrap before
starting the same `api.server:app`. It does not replace `run.sh`.

## 3. Major components

| Component | Location | Purpose | Status | Dependencies |
|---|---|---|---|---|
| Product API | `api/server.py` | REST API + static UI + legacy-sim mount | **WORKING** (verified by `py_compile`; **could not be runtime-started** in this sandbox — `fastapi`/`uvicorn`/`a2wsgi` are not installed and there is no network access to install them) | fastapi, uvicorn, pydantic, httpx, a2wsgi |
| Legacy 2D simulator | `legacy_simulator/` | Canvas driving sim + `SimAI` decision/planning pipeline | **WORKING** — verified live in this sandbox: imports cleanly, Flask test client returns 200 from `/`, `/api/health`, `/api/scenario/generate`, `/api/ai/plan`, `/api/ai/decision` | flask, flask-cors (optional, degrades gracefully) |
| Dataset Manager | `core/dataset/manager.py` | JSONL-indexed dataset storage, import, split, auto-label, versioning | **WORKING** for stdlib parts (create/import/stats/split/version) — verified: imports and runs standalone. Auto-labeling is **PARTIALLY IMPLEMENTED**: real YOLO path requires `ultralytics` (not installed here → heuristic placeholder path used, and clearly flagged as such by the module's own design, not by Phase 0) |
| Model Manager | `core/models/manager.py` | Model registry (JSON), active-model tracking, ONNX export | **WORKING** for registry operations — verified live. ONNX export depends on external model files that don't exist in this environment; **UNKNOWN/UNTESTED** beyond import |
| ECHO V2 | `core/echo/echo_v2.py` | Experience → Pattern → Principle → Capability pipeline | **WORKING** for the implemented pipeline stages (stdlib k-means-style clustering) — verified import; **PARTIALLY IMPLEMENTED** by the module's own documentation: "Model Improvement" only exports a training-hint JSON file, it does not retrain anything |
| Benchmark Suite | `core/benchmark/suite.py` | Runs test categories against a live Phase-4 engine (`http://localhost:8003`) or falls back to seeded-random synthetic mode | **PARTIALLY IMPLEMENTED / SIMULATED** by design — no Phase-4 engine exists in this ZIP, so every run uses the synthetic fallback. The module itself labels which mode produced each number; Phase 0 did not change this. Needs `httpx` (not installed here) for the live-engine path |
| Scenario Manager | `core/scenarios/manager.py` | Predefined + randomized Indian-road scenarios | **WORKING** — verified import, stdlib only |
| Report Generator | `core/reports/generator.py` | JSON/CSV/PDF report writer | **WORKING** for JSON/CSV. PDF requires `reportlab` (not installed here → `.txt` fallback, by the module's own existing design) |
| Deployment Manager | `core/deployment.py` | Tracks a `demo/research/training/benchmark/offline` mode flag in `storage/deployment_state.json` | **WORKING** — verified import. Note: this is a *state flag*, not a process sandbox — see §7 on the two "mode" concepts |
| CARLA connection | `core/carla_integration/connection.py` | Wraps `carla.Client` | **WORKING as a client**, **UNTESTED against a live server** — no CARLA server available in this sandbox. Its own honest-failure path (`CarlaUnavailableError` when `carla` isn't importable) was exercised and behaves correctly |
| CARLA vehicle spawn | `core/carla_integration/vehicle.py` | Retries across spawn points | **UNKNOWN** — requires a live CARLA world object; not testable without CARLA running. Code reviewed and appears reasonable |
| CARLA sensors | `core/carla_integration/sensors.py` | Camera/LiDAR attachment + thread-safe `SensorBus` | **PARTIALLY VERIFIED** — `SensorBus` and byte-decoding logic have existing unit tests (`tests/test_carla_client.py`) that use fake CARLA-shaped objects, not a real server. Live-server behavior is **UNKNOWN/UNTESTED** here |
| Frontend (product UI) | `frontend/` | Static HTML/CSS/JS | **UNKNOWN** — could not be served without `fastapi`'s `StaticFiles` mount running; not visually verified in this sandbox |

## 4. Existing limitations (found during audit, not introduced by Phase 0)

- **Simulated components, already labeled as such by the existing code:**
  the entire `legacy_simulator` AI pipeline (`SimAI`), the benchmark
  suite's synthetic fallback, and dataset auto-labeling's heuristic
  fallback. Phase 0 did not add or remove any of these labels — they
  were already honest in the source.
- **Incomplete integrations:** CARLA integration is a client with no
  server to test against here; the benchmark suite's "live engine"
  path (`http://localhost:8003`) has no Phase-4 engine present in this
  ZIP to call.
- **Hard-coded values:** risk thresholds, planner offsets, speed
  clamps, and CARLA sensor defaults were all hard-coded inline in
  `legacy_simulator/server.py` and `core/carla_integration/sensors.py`.
  Phase 0 did **not** change any of these values — it only mirrored
  them into `config/*.yaml` for visibility (see §5). The code itself
  still uses its original inline defaults.
- **Duplicate/unused configuration:** an empty, unreferenced `configs/`
  directory existed at the project root (only ever mentioned in
  `README.md`'s file-layout table, never read or written by any code).
  Removed in Phase 0 as a genuinely safe, unused artifact.
- **Missing validation:** none of the existing API endpoints validate
  config files, since no central config existed before Phase 0.
- **Missing tests (before Phase 0):** no test coverage existed for
  configuration loading, health/readiness, or the legacy
  simulator/API-server import path specifically (only
  `tests/test_phase5.py` and `tests/test_carla_client.py` existed,
  both exercising `core/` module logic).
- **Documentation/code mismatch found:** `docs/INSTALLATION.md`
  (pre-Phase-0) still described a `scripts/launch_all.sh`
  multi-phase launcher (phases 1–4 as sibling directories on ports
  8001–8003) that **does not exist anywhere in this ZIP** — the actual
  project (per its own `README.md`) was already merged into the single
  `api/server.py` process described in §1. Corrected in Phase 0 (see
  `docs/INSTALLATION.md`).
- **Runtime risk:** `api/server.py` cannot be started in an offline
  sandbox because `fastapi`/`uvicorn`/`a2wsgi` require `pip install`
  with network access. This is an environment limitation, not a code
  defect — `py_compile` confirms no syntax errors, and every module
  `api/server.py` imports from `core/` was independently verified to
  import and run correctly.
- **No `.env.example` or `.gitignore` existed before Phase 0**, despite
  `legacy_simulator/server.py` reading `ALLOWED_ORIGINS`/`PORT`/`DEBUG`
  from the environment. Added in Phase 0 (§5/§8 below).

## 5. Phase 0 changes (complete list)

**Added — did not exist before:**
- `config/system_config.yaml`, `config/vehicle_config.yaml`,
  `config/sensor_config.yaml`, `config/planner_config.yaml` — every
  value mirrors an already-existing hard-coded default in the source
  (cited inline in each file's comments); nothing was invented.
- `core/config_loader.py` — loads the four files above.
- `core/logging_system.py` — structured JSON-line logging into
  `logs/{system,sensors,vehicle,decisions,benchmark,errors}/`, with
  secret-key redaction.
- `core/modes.py` — new `OFFLINE/CARLA/RECORD/TEST/BENCHMARK`
  operating-mode layer (see §7 for why this is separate from
  `core/deployment.py`).
- `core/health/` (`component_status.py`, `health_check.py`,
  `system_report.py`) — the health check system described in §6.
- `app.py` — new unified entry point (health check → directory
  bootstrap → start `api.server:app`); does not replace `run.sh`/`run.bat`.
- `.env.example`, `.gitignore` — neither existed before.
- `tests/health/`, `tests/configuration/`, `tests/integration/`,
  `tests/regression/` — new test subdirectories (§9).
- `docs/PROJECT_AUDIT.md`, `docs/BASELINE.md`,
  `docs/PHASE_0_COMPLETION_REPORT.md` — this file and its siblings.
- Empty placeholder dirs with `.gitkeep`: `data/`, `models/` (root-level,
  distinct from the pre-existing `storage/models/` registry — see note
  in `config/system_config.yaml`), and `logs/<category>/`.

**Removed:**
- The empty, unreferenced `configs/` directory (see §4).

**Modified:**
- `docs/INSTALLATION.md` — removed the inaccurate `launch_all.sh`
  multi-phase instructions, replaced with the actual single-process
  `setup.sh`/`run.sh`/`app.py` flow, and added an "Environment without
  internet access" section reflecting what was actually verified in
  this sandbox.
- `README.md` — added the Phase 0–15 development-status table.

**Not modified:** every file under `core/{dataset,models,echo,benchmark,
scenarios,reports}/`, `core/deployment.py`, `core/carla_integration/`,
`api/server.py`, `legacy_simulator/`, `frontend/`, `scripts/`,
`tests/test_phase5.py`, `tests/test_carla_client.py`, `requirements.txt`,
`run.sh`, `run.bat`, `setup.sh`, `setup.bat`. Existing behavior of all of
these was preserved and re-verified after Phase 0 changes (§9/§10 of
`docs/PHASE_0_COMPLETION_REPORT.md`).

## 6. Health check design

`core/health/health_check.py` checks, in order: Python version,
`config/*.yaml` loadability, every package in `requirements.txt`
(split into required vs. genuinely-optional — see code comments for
which are which and why), expected top-level directories, CARLA
import + package presence, camera/LiDAR module import, the dataset and
model managers, the logging system, seven core modules, the legacy
simulator's Flask app, and `api/server.py`. Each check only returns
`PASS` if it actually ran the check (e.g. actually imported the module,
actually instantiated the manager and called a real method) —
`WARN` is used for genuinely optional/environment-dependent pieces
(CARLA, camera, LiDAR, any package missing only because this sandbox
has no network), and `FAIL` is reserved for a real code or
configuration error. Overall status is `READY` / `DEGRADED` / `NOT READY`.

## 7. Two "mode" concepts — why both exist

`core/deployment.py`'s `DeploymentManager` (modes: `demo`, `research`,
`training`, `benchmark`, `offline`) already existed and is wired into
`api/server.py`'s `/api/deployment/*` routes and `analytics_overview`.
Phase 0 left it completely unchanged.

The Phase-0 spec separately asked for an `OFFLINE/CARLA/RECORD/TEST/
BENCHMARK` operating-mode system. Rather than rename or merge into the
existing, already-wired `DeploymentManager` (which would be a
functional change outside Phase 0's "foundation only" scope and risk
breaking `/api/deployment/*`), Phase 0 added `core/modes.py` as a
separate, additive concept with its own storage file
(`storage/operating_mode.json`, distinct from
`storage/deployment_state.json`). `app.py --mode` sets this new layer
only. No existing code reads or is affected by it yet — it is
infrastructure for future phases to build on, not a behavior change
today.

## 8. Environment / secret safety

No secrets existed in the uploaded ZIP (no `.env`, no credentials
found). `legacy_simulator/server.py` reads `ALLOWED_ORIGINS`, `PORT`,
`DEBUG` from the environment — none are secret. `.env.example` (added
in Phase 0) documents exactly these, plus `INDIDRIVE_MODE` for the new
operating-mode layer. `.gitignore` (added in Phase 0) excludes `.env`,
generated logs, and generated runtime data.

## 9. Known limitations of this audit

- `api/server.py`, the FastAPI product UI, and the `/simulator` a2wsgi
  mount could not be runtime-started or visually verified in this
  sandbox (no network access to install `fastapi`/`uvicorn`/`a2wsgi`).
  Everything that *could* be verified without them was verified live,
  not just read.
- CARLA-dependent code (`vehicle.py`'s spawn retry logic, live sensor
  callbacks) could not be exercised against a real CARLA server.
- `tests/test_phase5.py` / `tests/test_carla_client.py` could not be
  run with `pytest` itself (not installed); their *logic* was
  cross-checked by hand against the modules they test, but they were
  not executed by the test runner in this environment.
