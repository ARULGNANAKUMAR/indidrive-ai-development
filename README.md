# IndiDrive AI — Merged Project (single app, single port)

> **Project topic: Adaptive Path Planning and Collision Avoidance for
> Autonomous Vehicles on Unstructured Indian Roads.** The live, working
> demo of this is the canvas simulator at `/simulator` (see "Run it"
> below) — for the algorithm write-up, architecture diagram, and exact
> click-by-click steps to see the car detect an obstacle and swerve
> around it automatically, read
> **[`docs/ADAPTIVE_PATH_PLANNING_REPORT.md`](docs/ADAPTIVE_PATH_PLANNING_REPORT.md)**
> first. Verified in this workspace: server boots, `/simulator` and all
> its assets serve, `pytest tests/` passes 12/12 — see §10 of that
> report for the full verification log.

All four uploaded archives (`indidrive-ai.zip`, `indidrive-ai-phase5.zip`,
`indidrive-ai-phase5-1.zip`, `indidrive-carla.zip`) are combined into
**one project that runs as one process**, not three separate services on
three ports like the earlier merge attempt.

## Development Status

| Phase | Status |
|---|---|
| Phase 0 — Foundation | **COMPLETE** |
| Phase 1 — Sensor Pipeline | **COMPLETE** |
| Phase 2 — Perception | **COMPLETE** |
| Phase 3 — Sensor Fusion | **COMPLETE** |
| Phase 4 — Prediction | NEXT |
| Phase 5 — Object Memory | PLANNED |
| Phase 6 — Road Understanding | 6.1 (Drivable Area + Road Boundaries) COMPLETE — 6.2–6.5 PLANNED |
| Phase 7 — World Model | PLANNED |
| Phase 8 — Reasoning Brain | PLANNED |
| Phase 9 — Path Planning | PLANNED |
| Phase 10 — MPC Control | PLANNED |
| Phase 11 — Safety Brain | PLANNED |
| Phase 12 — Experience | PLANNED |
| Phase 13 — Optimization | PLANNED |
| Phase 14 — Closed Loop | PLANNED |
| Phase 15 — Benchmark | PLANNED |

> Note: the "Phase 1–5" numbering above (foundation → benchmark, the
> planned autonomy stack) is separate from the pre-existing "Phase
> 1–5" component names inside this codebase (e.g. `legacy_simulator/`
> = old "Phase 1", `api/server.py` = old "Phase 5" product platform).
> See `docs/PROJECT_AUDIT.md` for the mapping. This table describes
> the *new* roadmap Phase 0 establishes going forward.

Phase 0 added: `config/*.yaml`, `core/health/` (health check system),
`core/logging_system.py`, `core/modes.py`, `app.py`, `.env.example`,
`.gitignore`, and `docs/PROJECT_AUDIT.md` / `docs/BASELINE.md` /
`docs/PHASE_0_COMPLETION_REPORT.md`. Nothing in `core/{dataset,models,
echo,benchmark,scenarios,reports}/`, `core/deployment.py`,
`core/carla_integration/`, `api/server.py`, `legacy_simulator/`, or
`frontend/` was rewritten — see `docs/PROJECT_AUDIT.md` for the full
audit and `docs/PHASE_0_COMPLETION_REPORT.md` for what was verified.

Phase 1 added a structured, thread-safe sensor pipeline on top of the
existing `core/carla_integration/` client: `sensor_types.py` (data
contract), `sensor_buffer.py` (bounded thread-safe buffer),
`sensor_manager.py` (lifecycle orchestration), `sensor_health.py`
(runtime health monitor), `sensor_recorder.py` / `sensor_replay.py`
(recording + offline replay), `sensor_interface.py` (CARLA/offline
abstraction), and a minimal `cpp/` foundation. It does **not** touch
object detection, sensor fusion, or planning — see
`docs/SENSOR_PIPELINE.md` and `docs/PHASE_1_COMPLETION_REPORT.md`.

Phase 2 added the real-time perception layer on top of Phase 1's
sensor pipeline: `core/perception/` (camera detection with a pluggable
model backend, geometry-based LiDAR ground-removal/clustering,
classical-baseline road/drivable-area understanding, a road-anomaly
interface, health/quality tracking, and a benchmark + CLI), plus
`config/perception_config.yaml` and four new `/api/perception/*`
endpoints on the existing single-process server. **No trained
detection/segmentation/road-damage model ships with this repository**
— those honestly report `NOT_CONFIGURED` until real weights are
registered; nothing about accuracy is fabricated. It does **not**
touch sensor fusion, tracking, prediction, or vehicle control — see
`docs/PHASE_2_ARCHITECTURE.md` and `docs/PHASE_2_COMPLETION_REPORT.md`.

### Current limitations (Phase 2)

- Camera object detection, road segmentation, and road-anomaly
  detection all require a trained model to be registered before they
  produce real results — see `docs/MODEL_MANAGEMENT.md`.
- LiDAR ground separation and road drivable-area estimation are
  documented geometric/classical-CV baselines, not learned models —
  see `docs/LIDAR_PERCEPTION.md` / `docs/ROAD_PERCEPTION.md` for their
  known failure modes.

Phase 3 added multi-sensor fusion on top of Phase 2's perception
outputs: `core/fusion/` (timestamp synchronization, coordinate
transforms, weighted-cost data association, deterministic confidence
fusion, camera+LiDAR+optional-radar object fusion, short-term
temporal/lifecycle tracking, health monitoring, benchmark), plus
`config/fusion_config.yaml`, C++ data-contract headers, 74 new tests,
and 9 documentation files. Produces one `FusedWorldState` per cycle —
the primary environmental representation for Phase 4. It does **not**
touch trajectory prediction, path planning, or vehicle control — see
`docs/FUSION_ARCHITECTURE.md` and `docs/PHASE_3_COMPLETION_REPORT.md`.

### Current limitations (Phase 3)

- No real camera/LiDAR/radar calibration exists for this deployment —
  coordinate transforms are implemented and tested but run in
  `NOT_CONFIGURED` mode by default (see `docs/COORDINATE_SYSTEMS.md`).
- This repository has no radar hardware/simulation backend (unchanged
  from Phase 2) — the radar fusion *path* is implemented and tested
  with synthetic radar-shaped input, ready for a real backend with no
  `core/fusion/` change required (see `docs/RADAR_FUSION.md`).
- No object tracking beyond single-cycle nearest-match, no motion
  prediction, no planning exists yet — those are future phases, not
  implemented or claimed here.

> Note: this section (Phase 0–3) was written when those phases landed and
> was not kept up to date as later phases (prediction, memory, Phase 5.x)
> were added to `core/` — see those directories and their own docs
> (`docs/PHASE_*`) for what actually exists. Phase 6.1 below is documented
> accurately as of when it was added.

### Phase 6.1 — Drivable Area & Road Boundary Understanding

Phase 6.1 adds `core/perception/road_understanding.py` +
`road_understanding_types.py`: a lightweight road-geometry layer that
combines Phase 2's classical camera road baseline with Phase 2's LiDAR
ground/obstacle separation into a sampled left/right boundary polyline,
a drivable-corridor polygon, and a road-width profile — all in vehicle
frame. Degrades honestly (camera-only, lidar-only, both-missing, stale,
malformed) instead of fabricating geometry. It is a standalone module —
**not** wired into the live perception/fusion pipeline, the API server, the
planner, or memory. See `docs/PHASE_6_1_ROAD_UNDERSTANDING.md` for the full
write-up and `tests/road_understanding/` for its 47 tests. Explicitly out
of scope for 6.1: lane detection (6.2) and road-damage classification (6.3).

## Run it

```bash
bash setup.sh
bash run.sh
```

- Product platform UI + API: **http://localhost:8004/**
- Legacy canvas simulator: **http://localhost:8004/simulator/**
- API docs: **http://localhost:8004/api/docs**
- CARLA integration status: **http://localhost:8004/api/carla/status**

## Layout

```
requirements.txt        One merged dependency list for everything below.
setup.sh / run.sh        Install + start. run.sh starts exactly one
                          uvicorn process on port 8004.

api/server.py            FastAPI app. Serves the Phase 5 product UI at
                          "/", exposes all Phase 5 API routes, mounts
                          the legacy Flask simulator at "/simulator",
                          and adds /api/carla/status (see below).

core/                     Phase 5's logic modules — dataset, models,
                          benchmark, scenarios, echo, reports, deployment
                          — unchanged, plus:
core/carla_integration/   The CARLA client code (was carla_client/):
                          connection.py, vehicle.py, sensors.py. Kept
                          as a plain importable package (no Flask/FastAPI
                          routes of its own — see "About CARLA" below).

legacy_simulator/         The original indidrive-ai.zip app (Flask +
                          canvas frontend). Its Flask `app` object is
                          imported and mounted into api/server.py rather
                          than run as a separate process.

frontend/                 Phase 5's own product UI (static files).
scripts/                  carla_test_connection.py, carla_spawn_and_record.py
                          — CLI tools for talking to a real CARLA server.
tests/                    test_phase5.py + test_carla_client.py together.
docs/                     Phase 5's docs + CARLA setup docs, in one place.
storage/, logs/, configs/ Phase 5's runtime data directories.
```

## What "merged" means here, concretely

1. **One process, one port.** `legacy_simulator/server.py` is a Flask
   (WSGI) app; `api/server.py` is FastAPI (ASGI). Those don't run in the
   same process for free — I used `a2wsgi.WSGIMiddleware` to mount the
   Flask app inside the FastAPI app at `/simulator`. `bash run.sh` now
   starts only `uvicorn api.server:app`; nothing else needs to run.
2. **Fixed the simulator's own API calls to work either way.**
   `legacy_simulator/config.js` hardcoded `http://localhost:5000` as its
   API base. Since it's no longer served from :5000, I changed it to
   detect its own mount path at runtime
   (`window.location.pathname.startsWith('/simulator')`) so its fetch
   calls go to the right place whether it's mounted here or ever run
   standalone again.
3. **CARLA code merged as a real importable module, not just filed
   away.** `core/carla_integration/` is the actual `carla_client/`
   code (byte-for-byte logic, just relocated + import paths updated).
   `/api/carla/status` in `api/server.py` checks that this module
   imports cleanly and reports whether the real `carla` package (a
   separate, non-PyPI install) is present — a genuine capability check,
   not a stub.
4. **One requirements.txt, one setup step**, merging what all three
   projects needed (Flask, FastAPI/uvicorn, numpy/opencv for CARLA,
   a2wsgi for the bridge, plus Phase 5's optional reportlab/ultralytics).
5. **Graceful degradation kept, nowhere faked.** If `a2wsgi` isn't
   installed, `/simulator/*` returns a clear `501` explaining why,
   instead of the whole platform crashing on import.

## About CARLA

`core/carla_integration/` is a **client**, not a server — it connects
OUT to an already-running CARLA simulator (a separate, GPU-heavy Unreal
Engine application you install and run yourself; see
`docs/CARLA_SETUP.md`). There's no route in this merged app that starts
CARLA or drives through it automatically. Once a real CARLA server is
running elsewhere:
```bash
python3 scripts/carla_test_connection.py
python3 scripts/carla_spawn_and_record.py
```
It also isn't wired to replace the canvas simulator's visuals yet —
different data formats, no shared scenario format — so the two remain
functionally independent even though their code now lives in one repo.

## Verified vs. not verified

- Every `.py` file in this project was byte-compiled
  (`python3 -m py_compile`) with no syntax errors.
- `run.sh` / `setup.sh` were checked with `bash -n`.
- **Not runtime-tested end-to-end** in this environment: this sandbox
  has no network access to `pip install fastapi uvicorn a2wsgi`, so I
  could not actually start the merged server and confirm the
  `/simulator` mount serves pages correctly at runtime. The `a2wsgi`
  API used (`WSGIMiddleware(wsgi_app)`) matches its documented usage,
  but please run `bash setup.sh && bash run.sh` and check
  `http://localhost:8004/simulator/` yourself as the first real test —
  and tell me what you see if anything looks off.
