# IndiDrive AI — Phase 3: Fusion Benchmark

Implemented in `core/fusion/fusion_benchmark.py`. Run with:

```bash
PYTHONPATH=. python3 -m core.fusion.fusion_benchmark
```

## What it measures

`run_fusion_benchmark()` runs real `PerceptionManager.process_frame()`
+ `FusionEngine.process()` cycles (synthetic camera/LiDAR input via
`MockBackend`, but real preprocessing/association/fusion code paths —
same honesty approach as `core/perception/perception_benchmark.py`)
and times each stage with `time.perf_counter()`. Nothing here is a
placeholder or estimated number.

## Measured result (this environment, 50 iterations, MockBackend, 20,000 synthetic LiDAR points/frame, 640×480 image)

```json
{
  "iterations": 50,
  "total_latency_ms": {"mean": 0.613, "median": 0.6, "p95": 0.778, "min": 0.468, "max": 1.1},
  "mean_fps": 1632.0,
  "stage_latency_ms_mean": {
    "timestamp_alignment": 0.0237,
    "coordinate_transform": 0.0001,
    "association": 0.0318,
    "confidence_fusion": 0.1802
  },
  "mean_objects_per_cycle": 9.52
}
```

**This is a `MockBackend` benchmark, not a real-model throughput
number** — the camera detector returns synthetic bounding boxes
instantly rather than running a real YOLO/etc. inference pass, so
`fusion_latency_ms` here measures the fusion pipeline itself (sync,
association, confidence fusion, lifecycle), not end-to-end
camera-inference-to-fused-object latency. Combined real-world latency
must also add the camera model's own inference time (see
`docs/PERCEPTION_BENCHMARK.md`, which has the same caveat for its own
`camera_backend_kind: MOCK` results) and the LiDAR clustering time
already measured there.

## Reading the stage breakdown

- **confidence_fusion** dominates fusion-internal latency (~0.18ms
  mean) — it does the most per-object arithmetic (existence
  probability product, class/position/velocity confidence, conflict
  detection) for every fused object.
- **association** (~0.03ms mean) is the greedy weighted-cost matcher
  over `camera_detections × lidar_objects` candidate pairs — scales
  roughly with the product of per-sensor object counts, which stays
  small (tens, not hundreds) for this project's scenarios.
- **coordinate_transform** is ~0 here because no calibration is
  configured (`calibration.camera.configured: false` by default) — the
  stage timer still runs, it just has nothing to transform.
- **timestamp_alignment** (~0.02ms) is dominated by Python dict/object
  overhead, not any heavy computation — the algorithm itself is O(number
  of sensors).

## Re-running with different load

```python
from core.fusion.fusion_benchmark import run_fusion_benchmark
report = run_fusion_benchmark(iterations=200, n_lidar_points=50000, n_camera_detections=10)
print(report.to_dict())
```

## Ground-truth accuracy: N/A

No ground-truth-labeled dataset exists in this repository, so this
benchmark reports latency/throughput only — never fabricated position
RMSE, association precision/recall, or class-accuracy numbers (spec
§47). See `docs/PHASE_3_COMPLETION_REPORT.md` for the explicit `N/A`
on that axis.
