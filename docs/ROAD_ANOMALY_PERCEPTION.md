# Road Anomaly (Pothole / Crack / Debris) Perception

`core/perception/anomaly_detection.py` — `RoadAnomalyDetector`.

## Status: **NOT_CONFIGURED** (honest, by design)

No trained road-damage detection model ships with this repository. Per
the Phase 2 spec's explicit instruction ("Do NOT claim that potholes
are actually detected from camera unless a real trained model is
available"), `RoadAnomalyDetector` reports `status="NOT_CONFIGURED"`
for every frame, with `anomalies=[]`, unless a real model has been
registered and successfully loaded.

## Interface (ready for a future trained model)

```python
RoadAnomalyDetector(backend="REAL", model_path="models/perception/road_damage/<weights>")
```

`RoadAnomaly` fields: `anomaly_type` (`pothole | crack | debris | mud |
gravel | road_edge_damage | water_patch`), `confidence`, `location`
(`BoundingBox2D` or `NOT_AVAILABLE`), `size_estimate`, `severity`
(`LOW | MEDIUM | HIGH | UNKNOWN`), `source`, `timestamp`, `status`.

Today, constructing `RoadAnomalyDetector(backend="REAL", ...)` without
a real weights file present at `model_path` automatically downgrades
`self.backend` to `NOT_CONFIGURED` — it never raises and never
fabricates a detection. When a real model is added in a future phase,
loading logic goes in the marked spot in `__init__`/`process()`
without changing the public interface any caller depends on.

## Why this file exists now, before a model does

Per the Phase 2 spec: "The architecture must be ready for future
trained road-damage models." Building the interface and data contract
now — rather than skipping road anomalies until a model exists — means
`PerceptionEngine`/`PerceptionFrame`/the API/CLI already have a stable
`road_anomalies: RoadAnomaly[]` field today, and a future model swap
requires no schema or caller change.

Tests: `tests/perception/test_road_perception.py`
(`test_road_anomaly_schema_honest_not_configured`,
`test_road_anomaly_real_backend_without_weights_falls_back_honestly`).
