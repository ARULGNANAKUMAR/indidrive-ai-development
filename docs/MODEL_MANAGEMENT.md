# Perception Model Management

Extends `core/models/manager.py` (Phase 5, unmodified) for the
perception layer's needs.

## Directory structure

```
models/perception/
├── vision/        # camera detection weights (e.g. yolo11n.pt, *.onnx)
├── lidar/         # reserved — Phase 2 LiDAR perception is geometry-based,
│                  # no weights used; kept for a future learned LiDAR model
└── road_damage/   # road-anomaly detection weights (none shipped)
```

All three directories are created empty (`.gitkeep` only) — no model
binaries are committed. `.gitignore` is updated so the directory
structure survives in git while `.pt`/`.onnx`/weight files under them
do not get committed by accident.

## Registering a real camera detector

Two supported paths:

1. **Via `core.models.manager.ModelManager`** (existing Phase 5
   registry): register a model under role `"detector"` with a
   `weights_path` pointing at a real file. `object_detection.resolve_backend("AUTO", ...)`
   automatically discovers it (`_active_yolo_weights_path()`) — no
   perception code change needed.
2. **Via `config/perception_config.yaml`**: set
   `perception.camera.backend: "YOLO"` and add
   `perception.camera.weights_path: "models/perception/vision/<file>.pt"`.

Either path requires the `ultralytics` package (already listed as an
optional dependency in `requirements.txt`) for `.pt` weights, or
`opencv-python` alone for a `.onnx` export via `backend: "ONNX"`.

## Model manifest / versioning

Reuses `core/models/manager.py`'s existing manifest format (model_id,
role, weights_path, version) rather than introducing a second,
perception-specific manifest — one source of truth for "what model is
active" across Phase 2 and Phase 5.

## Checksums

Not currently verified in Phase 2 (`core.models.manager` does not
currently compute or store one either). If added, it would slot into
the same registry entry `object_detection._active_yolo_weights_path()`
reads from.
