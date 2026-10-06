# IndiDrive AI — Phase 5 API Documentation

Base URL: `http://localhost:8004/api`
Interactive Swagger UI: `http://localhost:8004/api/docs`
ReDoc: `http://localhost:8004/api/redoc`

All request/response bodies are JSON unless noted. Timestamps are Unix
epoch floats (`time.time()`).

---

## Health & Launcher

### `GET /api/health`
Phase 5's own liveness check.
```json
{"status": "ok", "service": "phase5", "ts": 1234567890.12}
```

### `GET /api/launcher/status`
Pings all 5 phases and reports health.
```json
{
  "phase1_frontend": {"port": 8080, "healthy": true, "checked_path": "/"},
  "phase2_perception": {"port": 8001, "healthy": false, "checked_path": null},
  "phase5_product_platform": {"port": 8004, "healthy": true}
}
```

---

## Dataset Manager — `/api/datasets`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/datasets` | List all datasets + metadata |
| POST | `/api/datasets` | Create a new dataset |
| POST | `/api/datasets/{id}/import` | Import files/folders (dedup by SHA-256) |
| GET | `/api/datasets/{id}/stats` | Kind/split counts, dup count |
| POST | `/api/datasets/{id}/split` | Train/val/test split |
| POST | `/api/datasets/{id}/auto_label` | Run YOLO (or heuristic fallback) labeling |
| POST | `/api/datasets/{id}/version` | Snapshot current index as a new version |

**Create dataset**
```bash
curl -X POST localhost:8004/api/datasets -H 'Content-Type: application/json' \
  -d '{"name": "village_road_set_1"}'
```
```json
{"dataset_id": "a1b2c3d4e5f6", "name": "village_road_set_1", "total_images": 0, ...}
```

**Import**
```bash
curl -X POST localhost:8004/api/datasets/a1b2c3d4e5f6/import \
  -H 'Content-Type: application/json' \
  -d '{"source_paths": ["/data/raw_village_images"], "copy": true}'
```
```json
{"added_images": 4820, "added_videos": 0, "duplicates_skipped": 37, "total_images": 4820}
```

**Split**
```bash
curl -X POST localhost:8004/api/datasets/a1b2c3d4e5f6/split \
  -d '{"train": 0.8, "val": 0.1, "test": 0.1, "seed": 42}'
```

---

## Model Manager — `/api/models`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/models` | List registry + active model per role |
| POST | `/api/models` | Install/register a model |
| DELETE | `/api/models/{id}` | Remove a model |
| POST | `/api/models/active` | Set active model for a role |
| GET | `/api/models/compare?role=` | Rank models by mAP@50 |
| POST | `/api/models/{id}/export_onnx` | Export to ONNX (real if ultralytics present) |

Roles: `detector`, `segmenter`, `tracker`, `planner_aux`, `custom`.

```bash
curl -X POST localhost:8004/api/models -d '{
  "name": "YOLOv11-custom-finetune",
  "role": "detector",
  "source": "local",
  "version": "v2",
  "weights_path": "/models/custom.pt"
}'
```

---

## ECHO V2 — `/api/echo`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/echo/experience` | Record one experience |
| GET | `/api/echo/experiences?limit=` | List recent experiences |
| GET | `/api/echo/replay?scenario=&min_importance=` | Replay filtered experiences |
| POST | `/api/echo/cluster?k=` | Cluster experiences into patterns |
| POST | `/api/echo/promote_principles?min_support=&min_consistency=` | Promote patterns to principles |
| POST | `/api/echo/promote_capabilities?min_group=` | Group principles into capabilities |
| GET | `/api/echo/training_hints` | Export capability set for fine-tuning hand-off |
| GET | `/api/echo/memory_growth` | Counts at each pipeline stage |
| POST | `/api/echo/cleanup?keep_last=&min_importance_to_keep=` | Apply forgetting policy |

**Record an experience**
```bash
curl -X POST localhost:8004/api/echo/experience -d '{
  "scenario": "cattle_crossing",
  "features": {"risk_score": 0.82, "ttc_min": 1.1, "speed": 7.5, "drivable_frac": 0.55, "lane_count": 1},
  "action_taken": "BRAKE",
  "outcome": "near_miss",
  "notes": "cow entered lane at 40m"
}'
```

**Run the pipeline in order**
```bash
curl -X POST "localhost:8004/api/echo/cluster?k=6"
curl -X POST "localhost:8004/api/echo/promote_principles?min_support=3&min_consistency=0.7"
curl -X POST "localhost:8004/api/echo/promote_capabilities?min_group=2"
curl localhost:8004/api/echo/training_hints
```

---

## Benchmark & Testing Center — `/api/benchmark`

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/benchmark/run` | Run all 10 test categories |
| POST | `/api/benchmark/run_and_report` | Run + generate JSON/CSV/PDF safety report |

```bash
curl -X POST localhost:8004/api/benchmark/run -d '{
  "scenario": {"road_type": "RURAL", "ego_speed_kmph": 35, "object_count": 6},
  "seed": 7
}'
```
```json
{
  "run_id": "9f8e7d6c5b",
  "engine_live": false,
  "results": {
    "speed": {"score": 90.4, "unit_metrics": {"measured_speed_mps": 16.2}, "mode": "synthetic"},
    "planner_latency": {"score": 82.3, "unit_metrics": {"latency_ms": 17.7}, "mode": "synthetic"},
    "...": "..."
  },
  "overall_score": 76.76
}
```
`"mode"` is `"live"` when Phase 4's engine actually answered the
request, `"synthetic"` when it didn't (or isn't running) — never
silently faked as live.

---

## Scenario Manager — `/api/scenarios`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/scenarios` | List all 11 predefined scenarios |
| GET | `/api/scenarios/{name}` | Get one scenario's definition |
| GET | `/api/scenarios/random/generate?seed=` | Randomized scenario |
| POST | `/api/scenarios/combine` | Merge scenarios, e.g. `["rain","night"]` |

Predefined names: `village_road`, `market_road`, `highway`,
`school_zone`, `hospital_area`, `rain`, `fog`, `night`,
`cattle_crossing`, `wrong_side_traffic`, `construction_zone`.

---

## Reports — `/api/reports`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/reports/download?path=` | Download a previously generated report file |

Report files are produced as side effects of `/api/benchmark/run_and_report`
and land under `storage/reports/`. The endpoint only serves paths inside
the project root.

---

## Deployment Modes — `/api/deployment`

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/deployment/mode` | Current mode |
| POST | `/api/deployment/mode/{mode}` | Switch mode |
| GET | `/api/deployment/modes` | List all modes + descriptions |

Modes: `demo`, `research`, `training`, `benchmark`, `offline`.

---

## Analytics — `/api/analytics`

### `GET /api/analytics/overview`
Aggregates ECHO memory growth, dataset totals, model registry size, and
current deployment mode into one dashboard payload:
```json
{
  "echo_memory": {"total_experiences": 340, "patterns": 6, "principles": 4, "capabilities": 2},
  "dataset_count": 3,
  "total_images": 18420,
  "model_count": 5,
  "active_models": {"detector": "8429274fab", "segmenter": "ae41f78924"},
  "deployment_mode": "research"
}
```

---

## Error format

All errors follow FastAPI's default shape:
```json
{"detail": "dataset a1b2c3 not found"}
```
with the matching HTTP status (404 for missing resources, 400 for bad
input like an invalid deployment mode).
