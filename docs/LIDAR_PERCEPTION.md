# LiDAR Perception

`core/perception/lidar_perception.py` — `LiDARPerceptionPipeline`.

## Pipeline

```
LiDARFrame.points  (Nx4: x, y, z, intensity)
    → _clean()               NaN/Inf removal (np.isfinite mask)
    → _range_height_filter()  min/max range (default 1–80 m), min/max height (default -2.5–3.5 m)
    → _ground_separation()   per-XY-cell local-minimum-height baseline (see below)
    → _cluster()             grid/voxel connected-components clustering (XY plane)
    → _cluster_to_object()   centroid, min/max extents, dimensions, distance, point_count
    → PerceptionObject[]  (object_class="unknown" — LiDAR-only clusters carry no semantic label)
```

## Ground separation — documented baseline, not a claim of perfection

Implementation: points are bucketed into `ground_cell_size_m` (default
1.0 m) XY cells; each cell's minimum Z is treated as the local ground
height; any point within `ground_margin_m` (default 0.25 m) of that
local minimum is classified as ground.

**Limitations (explicitly, per the Phase 2 spec's "no perfect
road-surface segmentation" requirement):**
- Steep terrain or sloped roads will misclassify some road surface as
  obstacle (the local-min assumption weakens as the true ground plane
  tilts within a cell).
- Curbs and low road-edge damage may be absorbed into "ground" if
  within the margin.
- A single large sloped obstacle spanning a cell can lower the cell's
  local minimum and mask smaller nearby obstacles.

This is intentional Phase 2 scope: the spec calls for a "lightweight
geometry-based baseline," not a learned or plane-RANSAC ground model.
`RoadState`/`DrivableArea` (camera-based) do not depend on this LiDAR
ground model — they are independent, classical-CV baselines.

## Clustering — grid-based, no scipy/sklearn dependency

Obstacle (non-ground) points are voxelized into `cluster_cell_size_m`
(default 0.5 m) XY cells; occupied cells are connected via 8-neighbor
flood fill (pure NumPy + Python, no external clustering library) to
form clusters. Clusters below `min_cluster_points` (default 4) are
dropped as noise. `max_clusters` (default 200) bounds the number of
clusters produced from very noisy input — this keeps memory/CPU
bounded per the Phase 2 "no unbounded allocation" requirement.

## Per-cluster confidence

A transparent point-density heuristic (`confidence = min(1.0, 0.3 +
0.05 * point_count)`) — more points in a cluster increases confidence
it's a real object rather than noise. Documented as a heuristic;
`backend=BASELINE` on every LiDAR-derived `PerceptionObject`, never
`REAL`.

## Failure handling

| Input | Status |
|---|---|
| Wrong shape / not `Nx(>=3)` | `INVALID_FRAME` |
| Zero points | `EMPTY_POINT_CLOUD` |
| Valid but all points filtered out by range/height | `OK` with a warning, zero objects |

Tests: `tests/perception/test_lidar_perception.py` (NaN/Inf removal,
range/height filtering, ground separation, clustering),
`tests/perception/test_perception_failure_handling.py` (empty cloud).
