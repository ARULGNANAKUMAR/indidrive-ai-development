# Camera Perception

`core/perception/camera_perception.py` — `CameraPerceptionPipeline`.

## Pipeline

```
CameraFrame.image
    → preprocessing.validate_image()   (dtype/shape/finite checks)
    → preprocessing.to_rgb()           (BGR->RGB view, no copy if already RGB)
    → ObjectDetector.detect()          (pluggable backend, see below)
    → confidence.validate_and_clip_boxes()
    → confidence.filter_by_confidence()
    → confidence.non_max_suppression() (per-class, greedy, IoU-threshold)
    → object_types.normalize_class()
    → PerceptionObject[]
```

Every stage's time is measured with `time.perf_counter()` and reported
in `ProcessingMetrics` (`preprocessing_latency_ms`, `inference_latency_ms`,
`postprocessing_latency_ms`, `total_perception_latency_ms`,
`processing_fps`) — see `docs/PERCEPTION_BENCHMARK.md` for measured
numbers.

## Backend status: **NOT_CONFIGURED by default**

No trained detection weights ship with this repository. `object_detection.py`
implements the full `ObjectDetector` interface (`load_model`, `detect`,
`get_class_names`, `get_model_info`, `is_ready`) with these backends,
selected via `perception.camera.backend` / a `MODEL_BACKEND`-style value:

| Backend | Status | Notes |
|---|---|---|
| `NONE` | Always available | Returns `[]`, `backend=NOT_CONFIGURED` |
| `AUTO` | Resolves to `NONE` unless weights exist | Checks `perception.camera.weights_path`, then `core.models.manager.ModelManager`'s active `detector` role |
| `YOLO` | `REAL` if weights + `ultralytics` present | `UltralyticsYOLOBackend` |
| `ONNX` / `OPENCV_DNN` | `REAL` if weights + class names configured | `OpenCVDNNBackend`, generic YOLO-ONNX output layout |
| `CUSTOM` | Project-specific | `register_custom_backend()` hook, unpopulated by default |
| `MOCK` | Tests only | Deterministic, seeded; never selected by `AUTO`; every object it produces is tagged `backend=MOCK` |

A missing model file raises `ModelNotFoundError` internally, which
`CameraPerceptionPipeline.__init__` catches and downgrades to
`NoneBackend` — construction never raises, and `process()` reports
`status="MODEL_NOT_FOUND"` with the underlying reason in `warnings`.

## Indian road object classes

`object_types.py` defines the normalized taxonomy (`car`, `bus`, `truck`,
`motorcycle`, `scooter`, `auto_rickshaw`, `bicycle`, `pedestrian`,
`cattle`, `animal`, `tractor`, `rickshaw`, `pushcart`, `road_obstacle`,
`debris`, `traffic_cone`, `barrier`, `unknown`) and a default
raw-class→normalized map covering common COCO names (`person`→`pedestrian`,
`cow`→`cattle`, `motorbike`→`motorcycle`, etc.) plus Indian-road synonyms
(`autorickshaw`→`auto_rickshaw`). Unrecognized raw classes map to
`unknown` rather than being silently dropped.

## Confidence & NMS

- `confidence_threshold` (default 0.40) and `nms_threshold` (default
  0.45) are configuration-driven (`config/perception_config.yaml`).
- Class-specific thresholds are supported (`class_thresholds` dict) but
  unset by default.
- `PerceptionObject.confidence` == `raw_confidence` in Phase 2 (no
  learned confidence calibration yet) — both fields are kept distinct
  in the schema so a future calibration step can diverge them without
  a breaking schema change.
- `quality` is a transparent heuristic (`confidence.quality_score()`):
  confidence scaled down for very small boxes and partial visibility —
  documented as a heuristic, not a learned score.

## Real-world honesty

`CameraPerceptionPipeline` never fabricates detections when the
backend isn't ready — it returns an empty object list and an explicit
warning. Tests: `tests/perception/test_camera_perception.py`,
`tests/perception/test_perception_failure_handling.py`.
