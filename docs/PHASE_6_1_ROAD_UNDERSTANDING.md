# IndiDrive AI — Phase 6.1: Drivable Area & Road Boundary Understanding

Micro-phase scope: **only** drivable-area + road-boundary geometry
understanding. Lane detection/IDs/centerlines (Phase 6.2) and road-damage
classification (Phase 6.3) are explicitly out of scope and not touched.

## What this phase adds

| File | Purpose |
|---|---|
| `core/perception/road_understanding_types.py` | Data contracts: `RoadUnderstanding`, `RoadBoundary`, `BoundaryPoint`, `RoadWidthSample`, status/availability enums. |
| `core/perception/road_understanding.py` | `RoadUnderstandingPipeline` — combines Phase 2 camera road perception and Phase 2 LiDAR ground/obstacle separation into a road-geometry estimate. |
| `config/perception_config.yaml` (`road_understanding:` block) | Thresholds — nothing hardcoded that should be tunable. |
| `tests/road_understanding/test_road_understanding.py` | Phase 6.1 test suite (47 tests). |

**One small, additive change to existing Phase 2 code**: `LiDARPerceptionResult`
(`core/perception/lidar_perception.py`) gained two new optional fields,
`ground_points` / `obstacle_points` (the actual point arrays, not just the
counts it already returned). This lets road_understanding.py reuse Phase 2's
ground separation instead of duplicating it. Existing fields/behaviour are
unchanged — `tests/perception/test_lidar_perception.py` still passes
unmodified.

## API

```python
from core.perception.road_understanding import RoadUnderstandingPipeline

pipeline = RoadUnderstandingPipeline()
road = pipeline.process(
    perception=perception_frame,   # optional: Phase 2 PerceptionFrame
    fused_state=fused_world_state, # optional: Phase 3 FusedWorldState
    lidar_result=lidar_result,     # optional: an already-computed LiDARPerceptionResult (preferred)
    lidar_points=raw_points,       # optional: raw Nx3(+) point cloud, used only if lidar_result is absent
    frame_id=frame_id,
    timestamp=timestamp,
)
road.to_dict()
```

All arguments are optional; the pipeline degrades gracefully based on
whichever inputs are actually supplied (see below).

## Drivable-area representation

A sampled lateral-boundary representation: at each configured forward
distance (`road_understanding.forward_distances_m`, default `[0, 10, 20,
30]` m), the pipeline estimates a left-boundary `y` and a right-boundary `y`
in vehicle frame (`+X` forward, `+Y` left, `+Z` up — see
`docs/COORDINATE_SYSTEMS.md`). When both sides are available at two or more
distances, a closed drivable-corridor polygon is also built
(`RoadUnderstanding.drivable_polygon`). This is the lightest representation
that fits the existing architecture — no occupancy grid, no new mapping
framework.

## Road-boundary representation

Each side (`left_boundary` / `right_boundary`) is a `RoadBoundary`: a
polyline of `BoundaryPoint(x, y, confidence, point_support)`, sorted by `x`.
Boundaries are estimated from two geometric signals at each sampled
distance, using whichever exist:

1. the nearest LiDAR **obstacle** point on that side (tightest bound — a
   curb, wall, parked vehicle, etc.)
2. the observed **edge of ground-classified points** on that side (works
   for unmarked/edge-only roads with no discrete obstacle)

A sample side is only reported if it has at least
`road_understanding.min_points_per_sample` supporting points — otherwise
that side/sample is left unavailable rather than guessed (Step 12/13 of the
spec: never fabricate precise boundaries from insufficient data).

## Sensor sources & degraded-mode behaviour

| camera | lidar | result |
|---|---|---|
| OK | OK | LiDAR geometry, camera corroborates confidence only; `source="fusion"` |
| OK | unavailable | Qualitative only (`road_present`/`road_confidence` from the classical camera baseline) — **no metric boundaries**, since this repository has no configured camera calibration to convert pixels to vehicle-frame meters; `source="camera"` |
| unavailable | OK | LiDAR-only geometric baseline; `source="lidar"` |
| unavailable | unavailable | `status=UNAVAILABLE`, nothing fabricated |

Malformed/empty LiDAR frames and stale frames (older than
`road_understanding.max_sensor_staleness_s`) are treated as that sensor
being unavailable this cycle, reported honestly in `sensor_status`.

## Explicitly NOT done in this phase

Lane detection/IDs/centerlines/lane-change logic, road-damage/pothole/crack
classification, path planning, Hybrid A*, MPC, steering/braking, collision
avoidance, world-model/reasoning-brain integration, memory changes, and no
LLM or cloud service of any kind. This module is not wired into the live
perception/fusion pipeline or any API endpoint — it is a standalone,
directly-callable module ready for a later phase to integrate.

## Tests

`tests/road_understanding/test_road_understanding.py` — 47 tests covering
basic output, boundary geometry (straight/curved/asymmetric/noisy/partial/
invalid), drivable-area corridor cases (narrow/wide/irregular/partial/
unavailable), road-width profile, sensor degradation (camera-only,
lidar-only, both-missing, stale, malformed, empty), coordinate/NaN/Inf
validation, confidence bounds, determinism, and five synthetic
unstructured-Indian-road cases (unmarked village road, narrow road,
asymmetric shoulder, curved road, partially occluded road).

## Verification

This sandbox has no network access, so `pytest` cannot be installed (same
limitation already documented for this project in `docs/BASELINE.md` /
`tests/configuration/test_config.py`'s fallback). All tests in this report,
new and pre-existing, were run with `tools/mini_pytest.py`, a small
pytest-API-compatible runner covering the subset of `pytest` actually used
across this repository's test suite (`raises`, `approx`, `skip`, `fixture`,
`monkeypatch`, class- and function-based discovery) — see that file's
docstring. Real accuracy/IoU/detection-rate/latency figures were **not**
measured beyond what's reported in the completion report (Not verified
where not measured).
