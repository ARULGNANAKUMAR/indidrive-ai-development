# IndiDrive AI — Phase 8.3: Feature / Prototype Memory

## 1. Purpose

Phase 8.3 adds a **Scene Feature / Prototype Memory** layer on top of
the existing Phase 5.x memory infrastructure. Its role is to compress
repeated observations of the same driving patterns into compact,
reusable prototypes that can be retrieved quickly at runtime — without
ever storing raw sensor frames or growing unboundedly.

```
RAW OBSERVATION (ObjectFeatureSet + ContextFeature + RiskFeature)
        ↓
FEATURE VALIDATION (NaN/Inf safe, confidence gate)
        ↓
FEATURE NORMALIZATION (deterministic, [0,1] per slot, missing-value safe)
        ↓
SituationFeatureVector (23-dimensional fixed-length compact vector)
        ↓
SIMILARITY SEARCH over existing ScenePrototypes
        ↓
similarity ≥ threshold?
       YES                    NO
        ↓                      ↓
   UPDATE prototype       CREATE new prototype
   (EMA update)           (bounded, evicts oldest)
        ↓                      ↓
           COMPACT MEMORY
                ↓
   SceneFeatureMemory.find_similar(query_vector)
                ↓
   Ranked SimilarityMatch list
                ↓
   Future Situation Reasoning / Adaptive Replanning
```

### What Phase 8.3 is NOT
- It does not replace the Phase 5.2 `PrototypeMemory` (which groups by exact
  `object_type::subtype` key). Both coexist independently.
- It does not implement path planning, steering, braking, or control.
- It does not require internet access, cloud services, or GPU inference.
- It does not store raw camera frames, raw LiDAR point clouds, or full video.

---

## 2. Feature Schema

### 2.1 ObjectFeatureSet (Phase 5.2 — reused unchanged)

| Field group | Key fields | Source |
|-------------|-----------|--------|
| Geometry | length, width, height, aspect_ratio (m) | Sensor fusion bbox |
| Shape | aspect_ratio, descriptor vector (≤64 dim) | Perception shape |
| Appearance | dominant_color, histogram, descriptor | Camera appearance |
| Motion | speed, heading, acceleration, turning, motion_class | Phase 4D prediction |

### 2.2 ContextFeature (Phase 8.3 new)

Compact road-environment context. Derived from `IndianRoadContextState`
and `EnvironmentInfo`. All fields have safe defaults; unknown values
represented as enum `UNKNOWN` or `None`, never fabricated.

| Field | Type | Description |
|-------|------|-------------|
| `road_type` | `RoadTypeClass` | HIGHWAY / ARTERIAL / LOCAL / RURAL / UNPAVED |
| `road_marking` | `RoadMarkingClass` | CLEAR / FADED / NONE |
| `intersection_context` | `IntersectionClass` | STRAIGHT / CURVE / T_JUNCTION / CROSSROADS / ROUNDABOUT |
| `road_damage` | `RoadDamageClass` | NONE / MINOR / MODERATE / SEVERE |
| `road_width_m` | `float?` | Estimated road width in metres |
| `lane_count` | `int?` | Estimated number of lanes |
| `traffic_density` | `TrafficDensityClass` | EMPTY / LIGHT / MODERATE / DENSE / GRIDLOCK |
| `object_count` | `int?` | Total objects in scene (bounded) |
| `pedestrian_count` | `int?` | VRU / pedestrian count |
| `animal_present` | `bool` | Animal on/near road |
| `mixed_traffic` | `bool` | Heterogeneous traffic types present |
| `wrong_side_traffic` | `bool` | Oncoming wrong-side vehicle detected |
| `context_confidence` | `float [0,1]` | Confidence in this context reading |

### 2.3 RiskFeature (Phase 8.3 new)

Compact collision/hazard risk summary. Derived from `ReasoningSnapshot`
and Phase 4D collision outputs. Never recomputes risk — only stores a
compact summary.

| Field | Type | Description |
|-------|------|-------------|
| `overall_risk` | `RiskLevelClass` | NONE / LOW / MEDIUM / HIGH / CRITICAL |
| `critical_hazard_count` | `int` | Number of CRITICAL hazards in scene |
| `total_hazard_count` | `int` | Total hazard count |
| `object_risk` | `RiskLevelClass` | Per-object risk level |
| `ttc_band` | `TtcBandClass` | IMMEDIATE (<1s) / NEAR / MODERATE / FAR / NOT_THREAT |
| `ttc_s` | `float?` | Raw TTC in seconds |
| `distance_m` | `float?` | Distance to object/hazard |
| `closing_speed_ms` | `float?` | Approach rate (positive = closing) |
| `collision_likelihood` | `float? [0,1]` | Collision likelihood from Phase 4D |
| `collision_threat_present` | `bool` | Active collision threat |
| `has_vulnerable_road_users` | `bool` | VRU present |
| `risk_confidence` | `float [0,1]` | Confidence in risk assessment |

### 2.4 SituationFeatureVector (Phase 8.3 new)

Fixed-length normalised numeric vector (`VECTOR_DIM = 23`). All values
in `[0.0, 1.0]`; missing features represented as `None` (never zero-filled).

```
Index  Feature                 Source
-----  -------                 ------
0      geo.length              ObjectFeatureSet.geometry.length
1      geo.width               ObjectFeatureSet.geometry.width
2      geo.height              ObjectFeatureSet.geometry.height
3      geo.aspect_ratio        ObjectFeatureSet.geometry.aspect_ratio
4      mot.speed               ObjectFeatureSet.motion.typical_speed_ms
5      mot.heading             ObjectFeatureSet.motion.heading_rad (circular)
6      mot.accel               ObjectFeatureSet.motion.acceleration_tendency_ms2
7      mot.motion_class        MotionClass (ordinal)
8      ctx.road_type           ContextFeature.road_type (ordinal)
9      ctx.traffic_density     ContextFeature.traffic_density (ordinal)
10     ctx.road_marking        ContextFeature.road_marking (ordinal)
11     ctx.road_damage         ContextFeature.road_damage (ordinal)
12     ctx.intersection        ContextFeature.intersection_context (ordinal)
13     ctx.road_width          ContextFeature.road_width_m (normalised)
14     ctx.object_count        ContextFeature.object_count (normalised)
15     ctx.mixed_traffic       ContextFeature.mixed_traffic (bool → 0/1)
16     ctx.animal_present      ContextFeature.animal_present (bool → 0/1)
17     risk.overall            RiskFeature.overall_risk (ordinal)
18     risk.object             RiskFeature.object_risk (ordinal)
19     risk.ttc_band           RiskFeature.ttc_band (ordinal)
20     risk.collision_likelih. RiskFeature.collision_likelihood
21     risk.closing_speed      RiskFeature.closing_speed_ms (signed, centred)
22     risk.distance           RiskFeature.distance_m (inverted: close=1.0)
```

---

## 3. Prototype Concept

A `ScenePrototype` is a compact, incrementally-updated representative
of a *pattern* of driving situations. It is identified by a generated
ID (`SP-NNNNN`) and located in feature space by its `SituationFeatureVector`.

Unlike Phase 5.2 `ObjectPrototype` (keyed by exact `object_type::subtype`),
a `ScenePrototype` captures **intra-category variation** — e.g. a slow
crossing motorcycle and a fast approaching motorcycle are different
prototypes even though both are `MOTORCYCLE`.

### ScenePrototype fields

| Field | Description |
|-------|-------------|
| `prototype_id` | Stable monotonic ID (SP-NNNNN) |
| `object_type` | Object type this prototype represents |
| `representative` | Current EMA-updated SituationFeatureVector |
| `feature_set_summary` | Last-seen geometry/motion snapshot (human-readable) |
| `context_summary` | Last-seen ContextFeature snapshot |
| `risk_summary` | Last-seen RiskFeature snapshot |
| `confidence` | Running mean confidence (Welford update) |
| `observation_count` | Total observations folded in |
| `created_at` / `updated_at` | Wall-clock timestamps |

---

## 4. Similarity Method

```
distance(query, prototype) = RMSE over mutually available slots

similarity = 1 - distance    ∈ [0.0, 1.0]
```

- Only positions where **both** vectors have a non-None value contribute.
- A camera-only observation (slots 0–7 + 15–22 available, slots 8–14 absent)
  is not penalised for missing LiDAR-derived context.
- Result is always finite and clamped to [0.0, 1.0].
- `similarity = 1.0` → identical on every comparable dimension.
- `similarity = 1.0` returned when no slot is mutually available → treated
  as maximally *distant* (distance=1.0 → similarity=0.0).

### Similarity threshold routing

```
config: similarity_threshold = 0.80   (default)

observation → find_nearest_prototype(same object_type)
    → similarity ≥ 0.80?
        YES: update prototype (EMA)
        NO:  create new prototype
```

---

## 5. Update Method

Prototype representative vector updated using exponential moving average:

```
new_rep[i] = alpha * new_obs[i] + (1 - alpha) * old_rep[i]

Default alpha = 0.10  (configurable in prediction_config.yaml)
```

- `alpha = 0.10` → new observation contributes 10% weight.
- Slots where new observation is `None` keep the old value.
- Slots where old prototype is `None` adopt the new value.
- Result always clamped to `[0.0, 1.0]` — no drift outside unit range.
- `confidence` updated as running mean: `old + (new - old) / n`

---

## 6. Confidence Calculation

```
confidence_n = confidence_{n-1} + (obs_confidence - confidence_{n-1}) / n
```

- Running mean (Welford incremental update).
- Never weighted by a single noisy observation.
- Single noisy observation → low confidence prototype.
- 100+ stable high-confidence observations → high confidence prototype.

---

## 7. Compaction Strategy

**Capacity eviction** (triggered when `prototype_count ≥ max_prototypes`):
- Evicts the prototype with the fewest observations (oldest for ties).
- Bounded to `max_prototypes = 500` (default, configurable).

**Prototype merging** (`compact_memory(max_merge_similarity=0.97)`):
- Scans all same-`object_type` prototype pairs.
- Pairs with `similarity ≥ max_merge_similarity` are merged.
- Merged representative: observation-count-weighted average of both vectors.
- Merged `observation_count` = sum of both.
- Only prototypes of the **same object_type** are ever merged.

---

## 8. Persistence Format

```json
{
  "schema_version": 1,
  "normalizer_version": 1,
  "saved_at": 1727000000.0,
  "prototype_count": 37,
  "prototypes": [
    {
      "schema_version": 1,
      "prototype_id": "SP-00001",
      "object_type": "MOTORCYCLE",
      "representative": {
        "normalizer_version": 1,
        "object_type": "MOTORCYCLE",
        "available_count": 18,
        "values": [0.1, 0.16, 0.24, 0.625, ...]
      },
      "confidence": 0.847,
      "observation_count": 127,
      "created_at": 1726999900.0,
      "updated_at": 1726999999.0,
      ...
    }
  ]
}
```

- Pure JSON — no binary, no pickle, no external dependency.
- Schema-versioned: `schema_version` + `normalizer_version` validated on load.
- Malformed individual prototypes are skipped, not abort-loading.
- Empty file / corrupted JSON → clean failure result, memory unchanged.
- `save()` creates intermediate directories automatically.

---

## 9. Configuration (prediction_config.yaml)

```yaml
scene_feature_memory:
  max_prototypes: 500           # bounded memory cap
  similarity_threshold: 0.80   # route threshold
  update_alpha: 0.10            # EMA weight for new observation
  minimum_confidence: 0.0       # reject observations below this
  object_type_strict: true      # only match same object_type
  max_merge_similarity: 0.97    # compact_memory() merge threshold
  max_feature_dimension: 64     # descriptor vector bound (reuses Phase 5.2)
  normalizer:
    max_length_m: 20.0
    max_width_m: 5.0
    max_height_m: 5.0
    max_aspect_ratio: 10.0
    max_speed_ms: 40.0
    max_accel_ms2: 8.0
    max_road_width_m: 30.0
    max_object_count: 60
    max_ttc_s: 12.0
    max_distance_m: 100.0
    max_closing_speed_ms: 30.0
```

---

## 10. API Reference

```python
from core.memory import (
    SceneFeatureMemory, ContextFeature, RiskFeature,
    FeatureNormalizer, SituationFeatureVector,
)

sfm = SceneFeatureMemory(
    max_prototypes=500,
    similarity_threshold=0.80,
    update_alpha=0.10,
)

# --- Core flow ---
result = sfm.add_observation(feature_set, context, risk)
# result.ok → True / False
# result.memory_id → prototype_id created or updated

# --- Query ---
norm = FeatureNormalizer()
query_vec = norm.normalize(feature_set, context, risk)
matches = sfm.find_similar(query_vec, top_k=5, object_type="MOTORCYCLE")
nearest = sfm.get_nearest_prototype(query_vec, object_type="MOTORCYCLE")

# --- Maintenance ---
sfm.compact_memory(max_merge_similarity=0.97)  # merge near-duplicates

# --- Persistence ---
sfm.save("storage/scene_memory.json")
sfm.load("storage/scene_memory.json")

# --- Stats ---
stats = sfm.stats()
# stats.total_prototypes, total_observations, prototypes_by_type, avg_confidence
```

---

## 11. Failure Handling

The system never crashes for:
- Missing feature groups (context=None, risk=None) → those slots are None
- NaN/Inf in any numeric field → treated as missing, logged
- Invalid ContextFeature → dropped, feature_set still processed
- Low-confidence observation → rejected cleanly, returns failure result
- Empty memory → `find_similar()` returns `[]`
- Missing save file → `load()` returns failure result
- Corrupted JSON → `load()` returns failure result, memory unchanged
- Malformed prototype in file → skipped, rest loaded
- Wrong schema version → `load()` returns failure result

---

## 12. Limitations

| Limitation | Notes |
|------------|-------|
| No cross-type merging | Motorcycle and car prototypes are always kept separate |
| EMA is one-pass | Prototype update does not recompute from full history |
| Vector dim is fixed | Changing VECTOR_DIM requires NORMALIZER_VERSION bump and re-save |
| In-memory only at runtime | No persistent background write; caller must call `save()` |
| Normalizer ranges are static | Reference ranges in NormalizerConfig must be tuned to the deployment domain |
| No learned similarity | Distance metric is Euclidean RMSE; no learned metric adaptation |

---

## 13. IMPLEMENTED vs DESIGNED FOR FUTURE DEPLOYMENT

### IMPLEMENTED (Phase 8.3)
- ✅ `ContextFeature` — road environment feature type
- ✅ `RiskFeature` — collision/hazard risk feature type
- ✅ `FeatureNormalizer` — deterministic, NaN/Inf-safe normalizer
- ✅ `SituationFeatureVector` — fixed-length compact vector (dim=23)
- ✅ `SceneFeatureMemory` — similarity-routed prototype memory
- ✅ `ScenePrototype` — EMA-updated prototype with observation stats
- ✅ Prototype creation / update routing
- ✅ Capacity eviction (bounded)
- ✅ Prototype merging (`compact_memory`)
- ✅ JSON persistence (`save` / `load`)
- ✅ Thread-safe (RLock)
- ✅ Offline-first (no network, no cloud, no GPU)
- ✅ Full test suite (120 tests: unit + integration)
- ✅ Config integration (`prediction_config.yaml`)
- ✅ All Phase 5.x tests still passing (0 regressions)

### DESIGNED FOR FUTURE DEPLOYMENT
- 🔲 C++ implementation (data structures and algorithms already designed for portability)
- 🔲 Real-time vehicle hardware integration
- 🔲 Batch export to embedded device format
- 🔲 Learned similarity metric (Phase 9+)
- 🔲 Cross-session memory accumulation (persistent daemon)
- 🔲 Integration with full ReasoningSnapshot pipeline bridge
  (Phase 8.3 accepts `ObjectFeatureSet + ContextFeature + RiskFeature`;
   caller must extract these from `WorldModelSnapshot` / `ReasoningSnapshot`)

---

## 14. Future C++ Deployment Mapping

| Python component | C++ equivalent path |
|-----------------|---------------------|
| `ContextFeature` | `struct ContextFeature` (POD, enums) |
| `RiskFeature` | `struct RiskFeature` (POD, enums) |
| `SituationFeatureVector` | `std::array<std::optional<float>, 23>` |
| `FeatureNormalizer::normalize()` | `void normalize(FeatureSet&, Context&, Risk&, SitVec&)` |
| `SituationFeatureVector::distance_to()` | `float rmse_distance(const SitVec&, const SitVec&)` |
| `ScenePrototype` | `struct ScenePrototype` |
| `SceneFeatureMemory._find_nearest()` | Linear scan with early exit (N≤500 is fast) |
| `SceneFeatureMemory._ema_vector()` | `void ema_update(SitVec&, const SitVec&, float alpha)` |
| `save()` / `load()` | nlohmann/json or protobuf serialisation |
| Thread safety | `std::shared_mutex` (read/write lock) |

All arithmetic uses only `+`, `-`, `*`, `/`, `sqrt`, `fmod` — portable to
any automotive-grade embedded processor with IEEE 754 float support.
