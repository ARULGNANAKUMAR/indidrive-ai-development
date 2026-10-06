# Perception Architecture Reference

See `docs/PHASE_2_ARCHITECTURE.md` for the full before/after audit and
directory-by-directory breakdown. This document is the ongoing
reference for how the pieces fit together and their status labels.

## Data flow, one processing cycle

```
PerceptionManager.process_frame(camera_image, lidar_points, ...)
    → PerceptionEngine.process(...)
        → CameraPerceptionPipeline.process(image)   -> PerceptionObject[]
        → LiDARPerceptionPipeline.process(points)    -> PerceptionObject[]
        → RadarPerceptionPipeline.process(...)       -> [] (NOT_AVAILABLE)
        → RoadPerceptionPipeline.process(image)      -> RoadState, DrivableArea
        → RoadAnomalyDetector.process(image)         -> RoadAnomaly[] (NOT_CONFIGURED)
    → assembles one PerceptionFrame
    → appended to a bounded history (default 30 frames)
```

## Status vocabulary (used consistently across every component)

| Status | Meaning |
|---|---|
| `REAL` | Produced by an actually-loaded, real trained model |
| `BASELINE` | A documented, non-ML heuristic (e.g. LiDAR clustering, classical road-CV) — never claimed to be ML-grade |
| `MOCK` | Deterministic synthetic backend, automated tests only |
| `SIMULATION` | Reserved for CARLA-simulated-truth comparisons (unused in Phase 2) |
| `NOT_CONFIGURED` | Interface exists; no model/weights registered |
| `NOT_AVAILABLE` | No hardware/driver for this sensor exists in the project (radar) |

`PerceptionObject.backend`, `RoadState.backend`, `DrivableArea.backend`,
and `AnomalyDetectionResult.status` all use this vocabulary so a caller
can always tell what actually produced a given field.

## Health states

`PerceptionHealthMonitor` (per-component: camera/lidar/radar/road/anomaly)
tracks `HEALTHY | DEGRADED | FAILED | NOT_CONFIGURED | NOT_AVAILABLE`
from real `frames_processed` / `frames_failed` / `frames_dropped` /
`last_latency_ms` counters — nothing here is a fixed/simulated value.

## Object ID / sensor coupling

Every `PerceptionObject.object_id` is a fresh `uuid4`-based string
tagged with `source_sensor` — IDs are never derived from a shared
counter across sensors, so a future Phase 3 fusion step can associate
objects across camera/LiDAR without ID collisions.

## Known limitations (see individual docs for detail)

- LiDAR ground separation is a per-cell local-minimum heuristic — it
  will misclassify points near steep terrain, curbs, or sloped large
  obstacles as ground/obstacle incorrectly in some cases.
- Classical road-CV (`road_perception.py`) is a rough drivable-region
  estimate, not semantic segmentation — see `docs/ROAD_PERCEPTION.md`.
- No object tracking across frames exists yet (`tracking_ready=True`
  only means the object's shape is tracker-compatible, not that it has
  been tracked).
