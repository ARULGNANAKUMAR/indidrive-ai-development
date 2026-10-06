# Perception Benchmark

`core/perception/perception_benchmark.py` (`run_camera_benchmark`,
`run_lidar_benchmark`) and `python3 -m core.perception perception-benchmark`.

## Method

Runs N synthetic-input frames through the **real** pipeline code
(real preprocessing, real NMS/clip logic, real ground-removal/clustering
math) and times each cycle with `time.perf_counter()`. Reports
`mean`/`median`/`p95`/`min`/`max` latency and `mean_fps`, computed
directly from the measured list — never fabricated or hard-coded.

The report always includes `camera_backend_kind` (or is a LiDAR
report, which needs no model) so a `NOT_CONFIGURED`/`MOCK`-backed
number is never mistaken for real-model inference throughput.

## Measured results (this development sandbox — NOT target hardware)

These numbers were captured by actually running the benchmark on the
machine used to build Phase 2 (a shared cloud dev sandbox, not the
target embedded/laptop hardware named in the spec). They demonstrate
the measurement methodology works and is honestly labeled; they are
**not** a claim about production hardware performance.

### Camera pipeline, `backend=NOT_CONFIGURED` (no model — measures pure preprocessing overhead)

30 iterations, 640×480 synthetic RGB frames:

| Metric | Value |
|---|---|
| mean latency | 0.017 ms |
| median latency | 0.014 ms |
| p95 latency | 0.033 ms |
| min / max | 0.009 ms / 0.048 ms |
| mean FPS | ~58,300 |

This isolates preprocessing-stage overhead only — `detect()` short-circuits
immediately when no model is ready, so this number says nothing about
real inference cost.

### Camera pipeline, `backend=MOCK` (deterministic synthetic detector — full pipeline shape, NOT real-model accuracy/speed)

30 iterations, 640×480 frames, 3 mock detections/frame:

| Metric | Value |
|---|---|
| mean latency | 0.290 ms |
| median latency | 0.294 ms |
| p95 latency | 0.366 ms |
| min / max | 0.209 ms / 0.438 ms |
| mean FPS | ~3,440 |

Still not representative of a real model's inference cost (MockBackend
does no actual tensor computation) — this measures the preprocessing +
NMS + normalization overhead the real pipeline adds around whatever
model eventually runs.

### LiDAR pipeline (geometry-based baseline)

30 iterations, 20,000-point synthetic clouds:

| Metric | Value |
|---|---|
| mean latency | 2.192 ms |
| median latency | 2.179 ms |
| p95 latency | 2.426 ms |
| min / max | 1.994 ms / 2.656 ms |
| mean FPS | ~456 |

This IS the real, complete geometry pipeline (clean → filter → ground
separation → grid clustering) — no model dependency, so this number is
representative of the actual algorithm's cost on this hardware, at
this point count.

## Reproducing

```bash
python3 -m core.perception perception-benchmark --sensor camera --iterations 50
python3 -m core.perception perception-benchmark --sensor lidar --iterations 50
```

Once a real detection model is registered (see `docs/MODEL_MANAGEMENT.md`),
re-run the camera benchmark — `camera_backend_kind` will report `REAL`
and the latency will reflect actual model inference cost, on whatever
hardware it's run on.
