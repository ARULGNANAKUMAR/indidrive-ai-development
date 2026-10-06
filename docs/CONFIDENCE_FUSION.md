# IndiDrive AI — Phase 3: Confidence Fusion

Implemented in `core/fusion/confidence_fusion.py`.

**This is a deterministic weighted baseline, not a statistically
calibrated probability estimate** (spec §17: "do not claim
probabilistic perfection"). It combines per-sensor confidence/quality
signals in a documented, reproducible way; it has not been validated
against ground-truth object existence rates.

## `existence_probability`

Independent-evidence combination across contributing sensors:

```
existence_probability = 1 - Π(1 - sensor_confidence_i)
```

More agreeing sensors raises existence probability; no single sensor's
confidence alone can push it near 1.0 unless that sensor's own
confidence already is.

## `class_confidence`

The classification-authority-weighted confidence of the best-suited
sensor, with a penalty when sensors disagree:

- Authority: camera 1.0, LiDAR 0.55, radar 0.35 (camera is the only
  sensor with a real classifier in this codebase; LiDAR/radar
  authority values are placeholders for when geometry-based
  classification is added — see `core/perception/lidar_perception.py`).
- `class_confidence = best_sensor.confidence * best_sensor_authority`
- If contributing sensors disagree on class: `× 0.7` and
  `conflict_state` becomes at least `MINOR_CONFLICT`.

## `position_confidence`

Authority-weighted by which sensor contributed: LiDAR 1.0 > radar 0.75
> camera 0.45 (monocular depth is the least reliable of the three),
boosted slightly (+0.10 per additional contributing sensor) when
multiple sensors agree on the object.

## `velocity_confidence`

`0.0` unless a sensor that actually *measures* motion contributed a
velocity — radar (0.8) or a future tracked-velocity source (0.4).
Never fabricated from position alone within one cycle (finite-difference
velocity estimation from `track_fusion.py`'s temporal matching is
future Phase 4 territory, not claimed here).

## Overall `quality`

```
quality = 0.30*existence + 0.25*class_confidence
        + 0.25*position_confidence + 0.20*velocity_confidence
quality *= max(0.1, synchronization_quality)
quality *= 0.6   if conflict_state == MAJOR_CONFLICT
quality *= 0.85  if conflict_state == MINOR_CONFLICT
```

## Conflict state (spec §18)

| State | Trigger |
|---|---|
| `CONSISTENT` | all contributing sensors agree on class |
| `MINOR_CONFLICT` | class disagreement |
| `MAJOR_CONFLICT` | class disagreement **and** reported distances differ by >5m |
| `UNRESOLVED` | no contributing sensors at all (should not occur in practice — every `Association` has ≥1 member) |

Conflicting sensors are never silently resolved by picking one; the
conflict is recorded on the `FusedObject` (`conflict_state` field) so
downstream consumers (and the completion report / debug API) can see
it.
