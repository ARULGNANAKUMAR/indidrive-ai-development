# IndiDrive AI — Phase 3: Timestamp Synchronization

Implemented in `core/fusion/timestamp_alignment.py`.

## Problem

Camera and LiDAR (and, if configured, radar) frames are not guaranteed
to be captured at exactly the same instant. `TimestampAligner` decides,
per fusion cycle, which sensors' data can be treated as "the same
moment" and which are too old to trust.

## Algorithm

1. Collect whatever timestamps are available this cycle:
   `{"camera": t | None, "lidar": t | None, "radar": t | None}`.
2. **Reference timestamp** = the newest (max) timestamp among the
   sensors that reported one. Newest data anchors the cycle — an older
   sensor reading is judged against it, not the other way around.
3. For every sensor with a timestamp, compute
   `delta_ms = |reference - sensor_timestamp| * 1000`.
4. Classify:
   - `delta_ms > stale_threshold_ms` → `SyncStatus.STALE` (rejected
     from association this cycle, but still reported — never silently
     dropped).
   - `delta_ms <= max_timestamp_delta_ms` → `SyncStatus.OK`.
   - otherwise → `SyncStatus.STALE` ("outside sync window").
5. A sensor with no timestamp at all → `SyncStatus.MISSING` (the
   sensor didn't run this cycle — different from `STALE`, which means
   it ran but too long ago).

## Configuration (`config/fusion_config.yaml` → `fusion.synchronization`)

```yaml
synchronization:
  enabled: true
  max_timestamp_delta_ms: 50
  stale_threshold_ms: 200
```

`enabled: false` treats every present timestamp as `OK` regardless of
delta (useful for offline replay of recordings known to already be
aligned) — it does not disable `MISSING` detection.

## Synchronization quality

```
coverage  = (# sensors marked OK) / (# sensors expected)
tightness = 1 - (avg delta_ms of OK sensors / max_timestamp_delta_ms)
quality   = 0.5 * coverage + 0.5 * tightness
```

A deterministic, documented baseline (spec §17's "no claimed
statistical perfection" applies here too) — rewards both how many
sensors are usable and how tightly aligned they are. `quality == 0.0`
only when nothing is usable at all.

## What this module does NOT do

- Does not interpolate/extrapolate a missing sensor's pose or
  measurements to "fill in" a timestamp.
- Does not silently treat two out-of-window frames as synchronized.
- Is stateless per call — it has no notion of a frame counter or
  history; `FusionEngine` owns frame numbering.
