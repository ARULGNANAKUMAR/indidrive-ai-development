# IndiDrive AI — Phase 2 Architecture: Real-Time Perception Layer

This document records the Phase 1 architecture as audited before Phase
2 changes were made, then the Phase 2 design built on top of it.

## Phase 1 architecture (as found, unchanged)

```
CARLA → SensorInterface (Camera/LiDAR/Radar, live or offline replay)
      → SensorManager (lifecycle, validation gate, health wiring)
      → SensorBuffer (bounded, thread-safe, per sensor)
      → SensorFrame (timestamped, structurally validated)
```

Key Phase 1 interfaces reused as-is by Phase 2 (none modified):

| File | Reused for |
|---|---|
| `core/carla_integration/sensor_types.py` | `CameraFrame.image`, `LiDARFrame.points`, `Timestamp` |
| `core/carla_integration/sensor_manager.py` | `SensorManager.latest()`, `.status_report()` — read via `PerceptionManager.process_from_sensor_manager()` |
| `core/carla_integration/sensor_replay.py`, `sensor_recorder.py` | Offline replay integration tests (`tests/perception/test_replay_perception.py`) |
| `core/config_loader.py` | Extended additively: `CONFIG_FILES["perception"]` |
| `core/logging_system.py` | Extended additively: `"perception"` added to `CATEGORIES` |
| `core/models/manager.py` | `object_detection.py`'s `AUTO` backend checks its `active["detector"]` role for a registered YOLO weights path |
| `core/health/` | Not modified; perception exposes its own `PerceptionHealthMonitor` (mirrors `sensor_health.py`'s design, not its code) |

No Phase 0/1 file was rewritten. `core/carla_integration/` has zero new
dependencies from Phase 2 — the coupling runs one direction, Phase 2
depends on Phase 1's frame types, not the reverse.

## Phase 2 architecture (new)

```
                 ┌─────────────────────┐
                 │   Phase 1 Sensors   │
                 └──────────┬──────────┘
                            │  (CameraFrame.image / LiDARFrame.points)
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Camera          LiDAR          Radar
     (real, pluggable   (real, geometry   (NOT_AVAILABLE —
      backends;         baseline: ground   no hardware/driver
      NOT_CONFIGURED    removal + grid     in this project)
      w/o weights)      clustering)
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                   PerceptionEngine
                            │
            ┌───────────────┼────────────────┐
            ▼               ▼                ▼
       Objects[]      Road/Drivable Area   Road Anomalies[]
      (normalized       (classical CV        (interface only;
       Indian-road       baseline;            NOT_CONFIGURED —
       taxonomy)         SEGMENTATION         no trained model
                         needs a model)       ships with repo)
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                   PerceptionFrame
                            │
                    PerceptionManager
                  (lifecycle, bounded history,
                   SensorManager bridge)
                            │
                     Future Phase 3
                      Sensor Fusion
```

### New files — all under `core/perception/`

| File | Responsibility |
|---|---|
| `perception_types.py` | Data contracts: `PerceptionObject`, `PerceptionFrame`, `RoadState`, `DrivableArea`, `RoadAnomaly`, `ProcessingMetrics`, `PerceptionQuality`, `BackendKind`, `HealthState` |
| `object_types.py` | Indian-road class taxonomy + raw→normalized class mapping |
| `confidence.py` | Confidence filtering, NMS, bbox clip/validate |
| `preprocessing.py` | Image validation, resize, letterbox, normalize |
| `postprocessing.py` | Frame-level quality summary, warning de-dup |
| `object_detection.py` | `ObjectDetector` interface + `NoneBackend`/`MockBackend`/`UltralyticsYOLOBackend`/`OpenCVDNNBackend` + `resolve_backend()` |
| `camera_perception.py` | Full camera pipeline: validate → preprocess → infer → filter/NMS → `PerceptionObject[]` |
| `lidar_perception.py` | Full LiDAR pipeline: clean → filter → ground separation → clustering → `PerceptionObject[]` |
| `radar_perception.py` | Always-`NOT_AVAILABLE` interface (no radar hardware in this project) |
| `road_perception.py` | Road/drivable-area: `CLASSICAL` baseline or `SEGMENTATION` (requires a registered model) |
| `anomaly_detection.py` | Road-damage interface; `NOT_CONFIGURED` until a trained model exists |
| `perception_health.py` | Per-component health tracking from real measurements |
| `perception_engine.py` | Combines one cycle's camera+LiDAR(+road+anomaly) results into one `PerceptionFrame` |
| `perception_manager.py` | Top-level lifecycle + `SensorManager` bridge + bounded history |
| `perception_benchmark.py` | Real measured latency/throughput benchmarking |
| `cli.py`, `__main__.py` | `python3 -m core.perception ...` |
| `utils.py` | `Stopwatch`, `percentile()` |

### Config / logging / model-directory additions (all additive)

- `config/perception_config.yaml` (new file; registered in
  `config_loader.CONFIG_FILES["perception"]`)
- `core/logging_system.py`: `"perception"` appended to `CATEGORIES`
- `models/perception/{vision,lidar,road_damage}/` created (empty,
  `.gitkeep`'d) for future weights
- `api/server.py`: `/api/perception/health`, `/api/perception/model-status`,
  `/api/perception/latest`, `/api/perception/run-synthetic` added to the
  existing single-process server (this project intentionally runs one
  process — see `run.sh` — so perception is not a separate port)

### What Phase 2 deliberately does NOT do

- No sensor fusion (Kalman filter, IMM, track association across sensors)
- No trajectory prediction, world model, or planning of any kind
- No trained model ships with this repository — `object_detection.py`,
  `road_perception.py` (`SEGMENTATION`), and `anomaly_detection.py`
  all report `NOT_CONFIGURED` by default and are never claimed as REAL
- No vehicle control changes

See `docs/PHASE_2_COMPLETION_REPORT.md` for measured results and honest
status per component.
