# IndiDrive AI — Phase 3: Camera + LiDAR Fusion

Implemented in `core/fusion/object_fusion.py` (field selection) plus
`data_association.py` / `confidence_fusion.py` (association and
confidence, documented separately).

## Field-selection priority

Once `DataAssociator` groups a camera object and a LiDAR object
together, `ObjectFusion.fuse()` picks each output field from whichever
contributing sensor is authoritative for it — never averaging
incompatible representations, never fabricating a field neither sensor
provided:

| Field | Priority order | Why |
|---|---|---|
| `object_class` | camera → lidar → radar | Camera has the only real classifier in this codebase |
| `position_3d` | lidar → radar → camera | LiDAR range is far more accurate than monocular depth |
| `dimensions` | lidar → camera | Only LiDAR/camera currently estimate extent |
| `bbox_2d` | camera | Only camera produces a 2D image-space box |
| `heading` / `distance` | lidar → radar → camera | Same rationale as position |
| `velocity` | radar → lidar → camera | Only radar measures velocity directly today |

If no contributing sensor has a field, it stays `None` /
`NOT_AVAILABLE` in `FusedObject` — e.g. a LiDAR-only object has no
`bbox_2d`, a camera-only object has no LiDAR-measured `dimensions`.

## Camera projection (when calibration is configured)

```
LiDAR point (vehicle frame)
      │
      ▼
vehicle → camera transform   (CoordinateTransformer.project_to_camera)
      │
      ▼
reject if behind camera (z <= 0)          → status BEHIND_CAMERA
      │
      ▼
apply pinhole intrinsics (fx, fy, cx, cy)
      │
      ▼
reject if outside image bounds             → status OUTSIDE_IMAGE
      │
      ▼
pixel (u, v, depth)
```

This path is exercised directly by `tests/fusion/test_coordinate_transform.py`
and is available for future 2D-3D refinement (e.g. tightening a
LiDAR-derived box against the camera's 2D detection), but the current
association step does not require it — `DataAssociator` already
compares `PerceptionObject.distance` (camera's monocular depth
estimate, when available) against LiDAR's measured distance directly,
which needs no projection.

## What happens without LiDAR depth

Per spec §15: **camera-only detections never get a fabricated 3D
position.** A camera object with no associated LiDAR/radar partner
stays a single-sensor `FusedObject` with `position_3d = None`,
`sensor_count = 1`, `position_confidence` capped at the camera
authority value (0.45, see `docs/CONFIDENCE_FUSION.md`).

## Example (from spec §4, actual shape)

```json
{
  "fused_object_id": "fused_a1b2c3d4e5",
  "class": "car",
  "class_confidence": 0.94,
  "position_3d": {"x": 18.4, "y": -2.1, "z": 0.8},
  "dimensions": {"length": 4.2, "width": 1.8, "height": 1.6},
  "source_sensors": "CAMERA+LIDAR",
  "sensor_count": 2,
  "existence_probability": 0.97,
  "quality": 0.93,
  "status": "FUSED"
}
```

produced by feeding a matched camera+LiDAR `Association` through
`ObjectFusion().fuse()` — see `tests/fusion/test_camera_lidar_fusion.py`
for the exact runnable version of this example.
