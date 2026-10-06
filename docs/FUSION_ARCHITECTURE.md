# IndiDrive AI — Phase 3 Architecture: Multi-Sensor Fusion

## Where Phase 3 sits

```
Phase 1 sensors → Phase 2 perception (PerceptionFrame)
                          │
                          ▼
              ┌───────────────────────┐
              │   Phase 3 FUSION       │
              │   core/fusion/         │
              └───────────┬───────────┘
                          │
                          ▼
                 FusedWorldState
                          │
                  (Phase 4 — not built)
```

No Phase 0/1/2 file was rewritten. `core/fusion/` depends on
`core/perception/perception_types.py` (reads `PerceptionFrame`,
`PerceptionObject`) and on `core/config_loader.py` /
`core/logging_system.py`, extended additively (`CONFIG_FILES["fusion"]`
only — the perception/sensor entries are untouched).

## Pipeline (one cycle)

```
PerceptionFrame (camera + lidar objects, each individually timestamped;
                  radar objects when a radar pipeline exists)
      │
      ▼
split objects by source_sensor         (fusion_engine.py)
      │
      ▼
TimestampAligner.align()               (timestamp_alignment.py)
   → per-sensor SyncStatus (OK/STALE/MISSING), synchronization_quality
      │
      ▼
DataAssociator.associate()             (data_association.py)
   → groups of PerceptionObjects judged to be the same object
      │
      ▼
ObjectFusion.fuse() + ConfidenceFusion.fuse()   (object_fusion.py, confidence_fusion.py)
   → one FusedObject per group
      │
      ▼
TrackFusion.update()                   (track_fusion.py)
   → track_id + lifecycle_state across cycles (NEW/CONFIRMED/LOST/...)
      │
      ▼
FusionHealthMonitor.assess()           (fusion_health.py)
   → HealthState + FusionMode (FULL_FUSION/PARTIAL_FUSION/SINGLE_SENSOR/NO_VALID_SENSOR)
      │
      ▼
FusedWorldState                        (fusion_types.py)
```

`FusionManager` (fusion_manager.py) wraps `FusionEngine` with
lifecycle (`initialize`/`shutdown`/`reset`) and bounded history,
mirroring `PerceptionManager`'s role one layer down.

## Why camera/LiDAR objects can already be "misaligned" within one PerceptionFrame

Phase 2's `PerceptionManager.process_frame()` accepts a separate
`camera_timestamp` and `lidar_timestamp` and stamps each
`PerceptionObject` with the timestamp of the sensor that produced it —
not a single frame-wide timestamp. `FusionEngine` reads those
per-object timestamps back out (averaged per sensor) rather than
trusting `PerceptionFrame.timestamp` (a wall-clock processing stamp),
so synchronization is measured against the sensors' own reported
capture times.

## Sensor availability vs. detection count

A sensor counts as "active this cycle" based on `sensor_status` /
whether a timestamp was supplied for it — not whether it happened to
detect zero objects. A LiDAR sweep with nothing in range is a valid
empty active cycle, different from LiDAR not running at all
(`MISSING`).

## Degraded operation (spec §19/20)

| Active sensors | FusionMode | FusionHealth |
|---|---|---|
| camera + lidar + radar | `FULL_FUSION` | HEALTHY (if sync/latency OK) |
| any two of the three | `PARTIAL_FUSION` | HEALTHY (if sync/latency OK) |
| exactly one | `SINGLE_SENSOR` | DEGRADED |
| none | `NO_VALID_SENSOR` | FAILED |

Fusion never crashes because an optional sensor (radar, currently
always `NOT_CONFIGURED` — see `core/perception/radar_perception.py`)
is absent; `test_fusion_failure_handling.py` exercises every row above
plus corrupt-frame and malformed-config inputs.

## Coordinate frames (spec §8)

- **sensor frame** — raw per-sensor output.
- **vehicle frame** — +X forward, +Y left, +Z up, meters, origin at
  the rear-axle center. This is the frame `PerceptionObject.position_3d`
  is already expressed in (LiDAR ground-removal / ROI filtering in
  Phase 2 works in this frame).
- **world frame** — only meaningful with an external ego pose (CARLA
  or GNSS); `CoordinateTransformer.vehicle_to_world()` honestly returns
  `NOT_AVAILABLE` without one rather than assuming vehicle == world.

See `docs/COORDINATE_SYSTEMS.md` for the transform math and
`docs/CAMERA_LIDAR_FUSION.md` for the camera-projection pipeline.

## Python / C++ responsibility

Same split as Phase 1/2:

- **Python (`core/fusion/`)** — fusion research, algorithm development,
  evaluation, the implementation actually exercised by
  `PerceptionManager → FusionManager` and by `tests/fusion/`.
- **C++ (`cpp/include/fusion/`, `cpp/src/fusion/`)** — data-contract
  headers (`FusedObject`, `FusedWorldState`, `Transform3D`) and a pure
  `IFusionEngine` interface for a future low-latency implementation.
  No fusion algorithm is implemented in C++ yet; `fusion_selftest.cpp`
  only checks the types/transform compile and behave sanely.

## What Phase 3 deliberately does NOT do

- No Kalman/EKF/UKF/IMM, no multi-second trajectory prediction
  (`track_fusion.py`'s temporal matching is single-cycle nearest-object,
  not a motion model) — that's Phase 4.
- No path planning, steering, braking, or MPC — that's Phase 9+.
- No fabricated sensor data, calibration values, or accuracy numbers
  (spec §56/57) — every "unavailable" state is reported as
  `NOT_AVAILABLE` / `NOT_CONFIGURED`, never approximated.
