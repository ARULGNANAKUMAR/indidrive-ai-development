# IndiDrive AI — Phase 1: Real-Time Sensor Pipeline

Phase 1 builds a reliable, bounded-memory, offline-replayable sensor
acquisition layer on top of the Phase 0 CARLA client
(`core/carla_integration/connection.py`, `vehicle.py`, `sensors.py`).
It performs **no perception** — no object detection, classification,
clustering, or fusion. Those are later phases.

## Architecture

```
                 CARLA
                   │
          ┌────────┼────────┐
          ↓        ↓        ↓
       CAMERA    LiDAR    RADAR
          │        │        │
          └────────┼────────┘
                   ↓
            SensorManager
                   ↓
            SensorBuffer (per sensor, bounded)
                   ↓
          Timestamped SensorFrame
                   ↓
          Future perception (Phase 2+)
```

Files, all under `core/carla_integration/`:

| File | Responsibility |
|---|---|
| `sensor_types.py` | `SensorFrame` / `CameraFrame` / `LiDARFrame` / `RadarFrame` data contract + structural validators |
| `sensor_interface.py` | `SensorInterface` ABC + CARLA and offline-replay implementations |
| `sensor_buffer.py` | Thread-safe, bounded, per-sensor ring buffer |
| `sensor_manager.py` | Lifecycle: register/start/stop/restart, wires interface → buffer → health |
| `sensor_health.py` | Per-sensor ONLINE/OFFLINE/DEGRADED/NOT_CONFIGURED tracking from real measurements |
| `sensor_recorder.py` | Writes sessions to `data/recordings/`, enforces safety limits, writes `sensor_manifest.json` |
| `sensor_replay.py` | Reads a recorded session back into `SensorFrame` objects |
| `sensors.py`, `connection.py`, `vehicle.py` | Unchanged Phase 0 CARLA client (reused, not duplicated) |

## Camera pipeline

`CARLACameraSensor` wraps the existing `attach_rgb_camera` decode logic
in `sensors.py` (`_decode_rgb_image`, BGRA→RGB, alpha dropped, memory
owned via `.copy()`). Each callback produces a `CameraFrame` with
`frame_id` = CARLA's own frame counter, `sensor_time` = CARLA's
`image.timestamp`, and `reception_time` = wall clock on receipt.
`validate_camera_frame()` checks the array exists, is `uint8`, and its
shape matches the declared `(height, width, channels)` — nothing about
image *content* is inspected. Invalid frames are marked
`FrameStatus.INVALID`, logged, and never enter the buffer.

FPS, dropped-frame count, and callback latency are all measured from
real timestamps in `SensorHealthMonitor` — none are hardcoded.

## LiDAR pipeline

`CARLALiDARSensor` wraps `_decode_lidar` (raw bytes → `Nx4` float32
`[x, y, z, intensity]`). `validate_lidar_frame()` rejects empty clouds,
wrong dimensionality, non-float dtypes, and any NaN/Inf via
`np.isfinite(...).all()`. No clustering, segmentation, or obstacle
detection is performed here — that's Phase 2+.

## Radar interface

CARLA exposes a `sensor.other.radar` blueprint, but Phase 0's
`config/sensor_config.yaml` never configured a radar transform for the
vehicle (`radar.enabled: false`, `status: unavailable`). `CARLARadarSensor`
reflects that honestly: unless constructed with `configured=True` (and a
real transform), `.availability` reports `SensorAvailability.NOT_CONFIGURED`
and `.start()` is a no-op — no synthetic detections are ever generated.
`SensorManager.register()` reads `.availability` and marks the sensor
`NOT_CONFIGURED` in the health report instead of attempting to start it.

## Sensor manager

`SensorManager` is the single place that:
- registers a `SensorInterface` and allocates it a `SensorBuffer`
- starts/stops/restarts a sensor safely (catches exceptions, logs, updates health)
- exposes `latest()`, `buffer()`, and `closest_related_frames()` (basic
  timestamp-based frame association — see below)
- produces a combined `status_report()` merging health + buffer stats

It contains no detection/fusion/planning logic by design.

## Thread-safe sensor buffer

`SensorBuffer` is a `deque`-backed, lock-protected, bounded FIFO per
sensor. Two overflow policies (configurable in
`config/sensor_config.yaml` → `buffer.overflow_policy`):

- `DROP_OLDEST` (default) — oldest frame is evicted to make room (the
  underlying `deque(maxlen=N)` does this natively on `append()`)
- `KEEP_LATEST` — the new frame is rejected instead, so the buffer keeps
  representing the oldest unconsumed window

Every eviction/rejection increments `dropped_count`. The buffer never
grows past `capacity`; `close()` stops accepting frames and releases
memory for a clean shutdown.

## Timestamp management & basic frame association

Every `SensorFrame` carries a `Timestamp` with `sensor_time` (CARLA's
clock, when available), `reception_time`, and `processing_time` (set by
`mark_processed()`). From these, `transport_delay`, `processing_delay`,
and `age` are computed — never assumed. Phase 1 does **not** claim
perfect multi-sensor synchronization.

`SensorManager.closest_related_frames(reference_sensor_id, reference_time,
other_sensor_ids)` returns, for each requested sensor, the buffered
frame whose `sensor_time` is closest to the reference — a basic
nearest-timestamp match, not sophisticated multimodal fusion (that is
Phase 3).

## Sensor health monitor

`SensorHealthMonitor` tracks `ONLINE` / `OFFLINE` / `DEGRADED` /
`NOT_CONFIGURED` per sensor from real `record_frame()` /
`record_error()` / `record_dropped()` calls made by `SensorManager`.
`DEGRADED` fires when callback latency exceeds
`config/sensor_config.yaml` → `health.degraded_latency_ms`; a sensor
that hasn't produced a frame within `health.stale_after_s` is demoted
to `OFFLINE` on the next `report()` call. `status_text()` renders the
human-readable block shown in the Phase 1 spec.

## Recording

`SensorRecorder` writes to
`data/recordings/session_YYYYMMDD_HHMMSS/{camera,lidar,radar}/<sensor_id>/`
— only folders for sensors that actually wrote a frame are created.
Each frame is written as `<frame_id>.npy` (camera/LiDAR) or
`<frame_id>.json` (radar) plus a `<frame_id>.meta.json` sidecar holding
the frame's non-payload fields. On `stop()`, `sensor_manifest.json` is
written with real per-sensor and total frame/byte counts — never
fabricated.

**Safety limits** (`config/sensor_config.yaml` → `recording.*`):
`max_duration_s`, `max_frame_count`, `max_storage_bytes`. When any is
hit, the recorder calls `stop(reason=...)` itself, logs the reason, and
future `write_frame()` calls become no-ops. It never deletes existing
files.

## Offline replay

`OfflineSensorReplay(session_dir)` reads a session's
`sensor_manifest.json` and reconstructs `CameraFrame` / `LiDARFrame` /
`RadarFrame` objects from the `.npy`/`.json` + `.meta.json` files.
`OfflineCameraReplay` / `OfflineLiDARReplay` / `OfflineRadarReplay` in
`sensor_interface.py` wrap a loaded frame list behind the exact same
`SensorInterface.start(on_frame)` / `.stop()` contract a live CARLA
sensor uses — so `SensorManager` (and future Phase 2+ consumers) can
run against recorded data or a live sensor without code changes.

This is sensor-data replay only — it is not the autonomous decision
brain.

## Sensor abstraction

`SensorInterface` (ABC) is the boundary future AI modules should depend
on instead of CARLA-specific types. `CARLACameraSensor` /
`CARLALiDARSensor` / `CARLARadarSensor` and `OfflineCameraReplay` /
`OfflineLiDARReplay` / `OfflineRadarReplay` are the two families of
implementations; both hand `SensorManager` identical `SensorFrame`
objects.

## Python / C++ boundary

Phase 1 ships `cpp/` as a lightweight, header-mostly foundation
(`SensorFrame`, `CameraFrame`, `LiDARFrame`, `RadarFrame`, `Timestamp`,
`SensorStatus`, plus structural validators and a `SensorInterface`
abstract class) that mirrors the Python types field-for-field. It is
**not** a rewrite of the Python project and adds no CUDA/TensorFlow/
PyTorch/Eigen dependency.

- **Python responsibility (now):** CARLA client, sensor decode
  callbacks, buffering, health monitoring, recording, replay, tests,
  the API/frontend.
- **C++ responsibility (now):** compiling data-contract structs +
  validators, proving the shape is real-time-viable (no dynamic
  allocation surprises), nothing else.
- **Shared data representation:** the field layout in
  `cpp/include/types/SensorFrame.hpp` matches
  `core/carla_integration/sensor_types.py` 1:1, so a future binding
  layer (pybind11 or a serialized wire format) has a well-defined
  target.
- **Future integration point:** a later phase can replace
  `SensorManager`'s hot path with a C++ implementation of
  `SensorInterface` without changing `SensorBuffer`/`SensorHealthMonitor`
  callers, as long as it produces the same frame shape.

No binding system is built in Phase 1 — the C++ and Python sides are
built, tested, and run independently for now.

## Configuration

All tunables live in `config/sensor_config.yaml` (loaded via the
existing `core/config_loader.py`, no duplicate config path):
`camera.*`, `lidar.*`, `radar.*` (Phase 0, unchanged), plus new
`buffer.capacity` / `buffer.overflow_policy`, `health.stale_after_s` /
`health.degraded_latency_ms`, and `recording.max_duration_s` /
`recording.max_frame_count` / `recording.max_storage_bytes`.

## Logging

Uses the existing `core/logging_system.py` `StructuredLogger` (category
`"sensors"`, one file per category, redaction of anything that looks
like a secret). `SensorManager` and `SensorRecorder` log
initialization, start/stop, invalid frames, dropped frames, connection
failures, and recording start/stop/limit-reached events. Raw frame
content is never logged.

## Troubleshooting

- **`carla` import fails / CARLA unreachable:** `connect()` raises
  `CarlaUnavailableError` with a clear message (Phase 0 behavior,
  unchanged). `SensorManager` never fabricates frames when this
  happens — sensors simply never start.
- **Radar always `NOT_CONFIGURED`:** expected until a real radar
  transform is added to the vehicle config; see "Radar interface"
  above.
- **Buffer looks "empty" right after `start()`:** CARLA sensor
  callbacks fire on a background thread; give the simulation a few
  `world.tick()`s before reading `manager.latest(...)`.
- **Recording stopped unexpectedly:** check
  `sensor_manifest.json["stop_reason"]` — it will name exactly which
  safety limit was hit.

## Limitations (intentional, by Phase 1 scope)

- No object detection/classification/clustering/segmentation.
- No sensor fusion, Kalman/IMM filtering, or trajectory/intent prediction.
- Frame association is nearest-timestamp only, not calibrated
  multi-sensor synchronization.
- No CARLA C++ client and no Python/C++ binding layer yet.
- Radar acquisition code exists but is inert until a vehicle radar
  transform is actually configured.
