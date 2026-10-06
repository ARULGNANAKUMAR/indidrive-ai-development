# IndiDrive AI — Phase 3: Data Association

Implemented in `core/fusion/data_association.py`.

## Goal

Given the objects each sensor reported this cycle, decide which
objects from *different* sensors are plausibly the same real-world
object — without relying on class alone and without assuming the
nearest object is always the right match (spec §12).

## Cost function

For a candidate pair `(a, b)` from two different sensors:

```
cost = position_weight * (position_distance / max_position_distance_m)
     + bbox_weight     * (1 - 2D_IoU)
     + depth_weight    * (|distance_a - distance_b| / max_depth_error_m)
     + class_weight    * class_mismatch          # 0.0 same, 0.5 unknown-compatible, 1.0 different
     + time_weight     * (|timestamp_a - timestamp_b| / max_timestamp_delta_s)
```

Default weights (`config/fusion_config.yaml` → `fusion.association.weights`):

| Term | Weight |
|---|---|
| position | 0.40 |
| bbox_iou | 0.20 |
| depth | 0.20 |
| class | 0.10 |
| time | 0.10 |

Only the terms both objects actually have data for are included (e.g.
two objects that only share a distance measurement are compared on
depth + class + time, not fabricated position/IoU terms). A pair with
**no** geometric signal in common at all (no position, no bbox
overlap, no depth) is never associated, regardless of class.

## Hard gates (reject before scoring, not just penalize)

- `position_distance > max_position_distance_m` (default 3.0m)
- `2D_IoU < min_iou` (default 0.10) **when there's no 3D signal to fall
  back on**
- `|distance_a - distance_b| > max_depth_error_m` (default 5.0m)
- `|timestamp_a - timestamp_b| > max_timestamp_delta_s` (default 0.2s)

Any of these gates returns "no match" outright — they are not folded
into the weighted cost, so a single wildly-off signal can't be
outvoted by agreement on everything else.

## Matching strategy

Greedy minimum-cost matching (not full Hungarian/Munkres): every valid
cross-sensor pair is scored, sorted by cost ascending, and paired off
without ever reusing a source object. This is intentionally simple —
sufficient for the object counts in this project's scenarios (single
intersection/road segment, tens of objects, not hundreds) — and keeps
`core/fusion/` free of a new optimization-library dependency (spec
§52). Any object left unmatched becomes its own single-sensor
association, which is a perfectly valid Phase 3 output (see
`docs/CAMERA_LIDAR_FUSION.md`).

## Class compatibility

Class mismatch is scored, never gated:

- same class → `0.0`
- either side is `unknown` / `road_obstacle` / `debris` (labels a
  less-informative sensor path may legitimately produce) → `0.5`
- otherwise → `1.0`

This lets a LiDAR "road_obstacle" still associate with a camera "cattle"
detection at the same position — Phase 2's camera classifier is simply
more specific than LiDAR's geometry-only detector for the same object.
