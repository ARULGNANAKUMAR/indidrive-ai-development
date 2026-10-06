# IndiDrive AI — Phase 3: Coordinate Systems

Implemented in `core/fusion/coordinate_transform.py` (Python) and
`cpp/include/fusion/coordinate_transform.hpp` (C++ data-contract mirror).

## Frames

| Frame | Definition | Units |
|---|---|---|
| **sensor** | Raw per-sensor output (LiDAR points relative to the LiDAR unit; camera pixels relative to the lens) | meters (LiDAR) / pixels (camera) |
| **vehicle** | +X forward, +Y left, +Z up, right-handed, origin at rear-axle center | meters |
| **world** | CARLA/global frame; only defined when an ego pose is supplied | meters |

`PerceptionObject.position_3d` from Phase 2 is already expressed in
the **vehicle** frame (LiDAR ground-removal and ROI filtering operate
there) — most of Phase 3 works in vehicle frame without needing an
explicit sensor→vehicle transform every cycle. The transform exists
for the cases that do need it: camera pixel projection, and any future
sensor whose driver reports in its own local frame.

## Rotation convention

Intrinsic roll (X) → pitch (Y) → yaw (Z), right-handed, radians:

```
R = Rz(yaw) · Ry(pitch) · Rx(roll)
```

Implemented with plain 3×3 nested lists (`_rotation_matrix` /
`_matvec` in `coordinate_transform.py`) — no NumPy matrix requirement,
no external geometry library, per spec §10/37 ("avoid heavyweight
geometry libraries" / "avoid heavy dependencies").

## `Transform3D`

```python
Transform3D(rotation: 3x3, translation: (x, y, z))
  .apply(point)      # rotate then translate
  .inverse()          # transpose rotation, translate by -R^T·t
```

`CoordinateTransformer` composes these for:

- `sensor_to_vehicle(sensor, point)` — needs that sensor's extrinsics.
- `vehicle_to_world(point, ego_pose)` — needs an external ego pose
  (CARLA/GNSS); without one, returns `(None, "NOT_AVAILABLE")` rather
  than assuming vehicle frame equals world frame.
- `project_to_camera(point_vehicle)` — needs camera extrinsics *and*
  intrinsics; see `docs/CAMERA_LIDAR_FUSION.md` for the full pipeline
  and rejection rules (behind-camera, outside-image).

## Calibration is never invented

Every transform that needs calibration checks
`SensorCalibration.is_configured(sensor)` first. If the entry isn't
configured (the default — see `config/fusion_config.yaml`'s
`calibration:` block, all `configured: false` until real values are
measured), the method returns `(None, "NOT_CONFIGURED")` instead of
falling back to an assumed/identity transform. This is deliberate: a
silent identity fallback would look like a working calibration in logs
and metrics when it is not.
