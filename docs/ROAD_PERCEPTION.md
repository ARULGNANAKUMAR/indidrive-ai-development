# Road & Drivable-Area Perception

`core/perception/road_perception.py` — `RoadPerceptionPipeline`.

## Backends

| Backend | Status | Method |
|---|---|---|
| `NONE` | `NOT_CONFIGURED` | Road perception disabled |
| `CLASSICAL` (default) | `BASELINE` | Edge-density heuristic on the lower image ROI (see below) |
| `SEGMENTATION` | `NOT_CONFIGURED` | Interface only — no trained segmentation model ships with this repository; requesting this backend without a registered model reports `NOT_CONFIGURED` with an explicit warning, it does **not** silently fall back to `CLASSICAL` |

## CLASSICAL baseline method

1. Take the lower `lower_roi_fraction` (default 55%) of the frame —
   the region below the horizon in a forward-facing camera.
2. Convert to grayscale, run Canny edge detection (OpenCV) or a NumPy
   gradient fallback if `cv2` is unavailable.
3. `edge_density = mean(edges) / 255`. Low edge density in this ROI is
   treated as more likely to be a plain drivable surface (asphalt/dirt)
   than a cluttered/textured non-road region.
4. `road_confidence = clamp(1 - edge_density * 4, 0, 1)`;
   `road_present = road_confidence > 0.35`.
5. `drivable_mask` is a simple binary mask over the same ROI.

**This is NOT semantic segmentation.** It will perform poorly on:
- heavy shadow or strong specular reflection on wet asphalt,
- crowded frames (many vehicles/pedestrians filling the lower ROI),
- non-asphalt road surfaces with high local texture (broken/patched
  roads, gravel).

It is reported with `backend=BASELINE` everywhere — `RoadState.backend`
and `DrivableArea.backend` — and is never claimed as `REAL`.

## Lane markings: `NOT_AVAILABLE` is a valid, expected state

Per the Phase 2 spec, `RoadState.lane_marking` is always
`NOT_AVAILABLE` under the `CLASSICAL` backend — classical edge
detection is not a reliable lane detector, and Indian roads are
frequently unmarked or faded, so fabricating a lane state would be
actively misleading to any future planner consuming this field. A
future `SEGMENTATION` backend, once a real model is registered, is
where a real `lane_marking` value would first become possible.

## Drivable area representation

`DrivableArea` carries `drivable_mask_available`, `drivable_mask_shape`,
`drivable_confidence`, and `road_boundary_candidates` in its `to_dict()`
output. The raw mask array itself (`DrivableArea.mask`) is intentionally
excluded from `to_dict()` — embedding a full-resolution mask in every
serialized `PerceptionFrame` would bloat every frame's JSON output;
callers needing the raw mask read `.mask` directly on the object.

Tests: `tests/perception/test_road_perception.py`.
