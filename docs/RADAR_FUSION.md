# IndiDrive AI — Phase 3: Radar Fusion

## Current status: `NOT_CONFIGURED`

This codebase has no radar hardware/simulation backend —
`core/perception/radar_perception.py`'s `RadarPerceptionPipeline`
reports `is_available() == False` and `status == "NOT_AVAILABLE"` for
every call (unchanged by Phase 3; not modified). Consequently:

- Every `FusedWorldState.sync_status["radar"]` is `"MISSING"`.
- `FusionMode` can never be `FULL_FUSION` in this deployment — only
  `PARTIAL_FUSION` (camera+LiDAR), `SINGLE_SENSOR`, or `NO_VALID_SENSOR`.
- `calibration.radar.configured` is `false` by default in
  `config/fusion_config.yaml`.

**No fake radar measurements are generated anywhere** (spec §16/57) —
`test_radar_fusion.py::test_radar_pipeline_reports_not_available_no_fake_detections`
asserts this directly.

## What Phase 3's radar path DOES support, ready for real hardware

`core/fusion/` treats radar as a first-class optional third sensor
throughout:

- `TimestampAligner.align()` accepts a `radar` timestamp and reports
  its sync status like any other sensor.
- `DataAssociator.associate()` includes `radar` in its sensor list and
  will associate a `PerceptionObject` tagged `SourceSensor.RADAR`
  against camera/LiDAR objects using the same cost function
  (`docs/DATA_ASSOCIATION.md`).
- `ObjectFusion.fuse()` gives `velocity` priority to radar over
  LiDAR/camera (radar is the only sensor that measures velocity
  directly — Doppler radial velocity).
- `ConfidenceFusion.fuse()` gives radar `velocity_confidence = 0.8`
  when it contributes a measured velocity.
- `FusionHealthMonitor` counts radar toward `FULL_FUSION` alongside
  camera+LiDAR.

`test_radar_fusion.py::test_radar_object_when_present_contributes_measured_velocity_only`
exercises this whole path using a synthetic `PerceptionObject` shaped
exactly like what a real `RadarPerceptionPipeline` would emit
(`range`/`radial_velocity`/`azimuth` → `distance`/`velocity`), without
requiring actual radar hardware to be present.

## Enabling real radar (future work, out of Phase 3 scope)

1. Implement a real backend in `core/perception/radar_perception.py`
   (range, radial velocity, azimuth, elevation if available, RCS if
   available, timestamp — per spec §16) and have it return
   `PerceptionObject`s tagged `SourceSensor.RADAR` with `velocity` set.
2. Set `calibration.radar.configured: true` in
   `config/fusion_config.yaml` with measured `radar_to_vehicle`
   extrinsics once available.
3. No change to `core/fusion/` is required — the fusion path above
   already consumes radar objects as soon as Phase 2 starts producing
   real ones.
