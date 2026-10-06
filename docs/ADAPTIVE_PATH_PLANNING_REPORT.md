# Adaptive Path Planning and Collision Avoidance for Autonomous
# Vehicles on Unstructured Indian Roads

**Project:** IndiDrive AI — Simulation Platform
**Component covered by this report:** `legacy_simulator/` (mounted at `/simulator`
inside the unified app), driven by `ai-engine.js`, `simulator.js`, `config.js`.
**Status:** implemented, runtime-verified in this workspace (server boots,
`/simulator` and all its static assets serve correctly, `pytest` — 12/12 pass).

---

## 1. Problem statement

Most path-planning research (Frenet-frame planners, CARLA benchmarks, Apollo/
Autoware stacks) assumes **structured roads**: painted lanes, predictable
actor classes, and orderly right-of-way. Indian roads routinely violate all
three assumptions:

| Structured-road assumption | Indian-road reality |
|---|---|
| Lane markings define legal position | Faded/absent lane paint; vehicles distribute laterally by gap, not lane |
| Actors are cars/pedestrians with known dynamics | Mixed traffic: cattle, handcarts, autos, two-wheelers, tractors, pedestrians crossing anywhere |
| Road surface is uniform | Potholes, loose debris, fallen rocks, informal speed breakers |
| Right-of-way is respected | Wrong-side movement, informal merges, sudden U-turns |

A planner tuned for the first column fails on the second. This project's
scope is a **local, reactive, re-planning layer** that stays safe under those
conditions — not a full SLAM/localization stack.

## 2. System architecture

```
 ┌────────────┐   ┌──────────┐   ┌────────────┐   ┌───────┐   ┌──────────┐   ┌────────────────┐   ┌──────────────────┐
 │  Sensors   │──▶│ Detection│──▶│  Tracking  │──▶│Predict│──▶│   Risk   │──▶│ Path Planning   │──▶│ Collision Avoid.  │
 │(sim LiDAR/ │   │(confidence,│  │(id, kinematic│ │(future │  │ scoring  │   │(lattice of      │   │(hard override:   │
 │ camera cone)│   │ dropout)  │  │  per-object  │  │ position)│  │(risk,   │   │ candidate       │   │ TTC / max-risk    │
 └────────────┘   └──────────┘   │  state)      │  └───────┘   │ TTC)     │   │ trajectories)   │   │ thresholds)       │
                                  └────────────┘                └───────┘   └────────────────┘   └──────────────────┘
                                                                                     │                       │
                                                                                     ▼                       ▼
                                                                             Selected path,          Final action
                                                                             all candidates          (steer/brake/
                                                                             drawn for HUD           continue) + reason
```

Implementation: `legacy_simulator/ai-engine.js`, class `IndiDriveAIEngine`,
method `process(sensorData, egoState)` runs this full 7-stage pipeline once
per AI tick (`CONFIG.AI_UPDATE_RATE = 200ms`), independent of the render
loop (`CONFIG.FPS_TARGET = 60fps` in `simulator.js`), so planning cadence and
frame rate are decoupled like a real stack.

## 3. Path planning algorithm (the "adaptive" part)

**Type:** lattice-based local planner with a lateral-offset candidate set,
re-evaluated every tick against currently tracked obstacles. This is the
same family of approach used in real reactive planners (e.g. Apollo's
EM-planner lane-sampling stage), simplified to 2D kinematics for real-time
simulation.

`ai-engine.js :: plan(egoState, tracks)`:

1. Generate **7 candidate trajectories**, one per lateral offset
   `[0, ±2, ±4, ±6] m` (clipped to stay inside the road half-width), each a
   12-waypoint curve projected 55 m ahead using a sine-eased lateral blend:
   `x(t) = x_ego + offset · sin(π·t)`, `y(t) = y_ego − 55·t`.
2. **Score each candidate** against every tracked object: for each waypoint,
   compute Euclidean distance to the tracked object; if `< 4.0 m`, accumulate
   a proximity risk `1 − d/4.0`. Take the max over the candidate's waypoints
   as that path's risk.
3. **Classify** each candidate `safe` (`risk < 0.25`), `warning`
   (`< 0.65`), or `blocked` (`≥ 0.65`), then **sort by risk** and pick the
   lowest as `selected`.
4. **Detect a replan event**: if the previous tick's selected path was
   `safe` and this tick's best candidate is no longer (`risk > 0.45`), flag
   `replanning = true` and increment a replan counter — this is the exact
   "car detects object → path changes" moment, and it's counted/exposed to
   the UI (`state.path.repcount`), not just visual.

## 4. Collision-avoidance override (the safety net)

`ai-engine.js :: collisionCheck(decision, path, criticals, egoState)` sits
**after** the planner and can override it:

- **Hard brake:** if time-to-collision `TTC < 1.2s` **and** `maxRisk > 0.80`
  → `Emergency Brake`, confidence 0.98, regardless of what the planner chose.
- **Forced swerve:** if the selected path's risk `> 0.70` but another
  candidate has `risk < 0.30` and status `safe`, immediately steer to that
  candidate's offset (`Steer Left`/`Steer Right`) rather than waiting for
  the next planning cycle.
- Otherwise, the planner's own decision passes through unchanged.

This two-layer design (soft re-planning + hard override) mirrors real ADAS
architecture: a comfort-oriented planner for the common case, and a
latency-sensitive reflex layer for the imminent-collision case.

## 5. Sensing model

Detection is simulated, not hand-scripted, so it degrades realistically:

- `confidence = 0.93 × distFactor × visFactor + noise`, where `distFactor`
  falls off with range (max detection range `50 m`), `visFactor` scales with
  a `visibility` parameter (rain/fog scenarios lower this), and `noise` is
  drawn from `CONFIG.SENSOR_NOISE = 0.05`.
- Detections below `confidence 0.30` are dropped — this simulates sensor
  dropout, so the planner sometimes reacts a beat late, as a real perception
  stack would in monsoon/dust conditions.
- Each detection carries a per-object-class base risk (see §6), which feeds
  into the risk-assessment stage alongside kinematic TTC.

## 6. Unstructured-road hazard model

`config.js :: OBJECT_TYPES` and `BEHAVIOURS` encode the mixed-traffic taxonomy
this project targets, each with its own footprint, speed ceiling, and base
risk weight:

`CAR, BIKE, SCOOTER, AUTO, BUS, TRUCK, TRACTOR, CYCLE, PEDESTRIAN, CATTLE,
PUSHCART, OBSTACLE (pothole), ROCK, DEBRIS`

and behaviours: `WRONG_SIDE, RANDOM_CROSSING, PEDESTRIAN_CROSS,
CATTLE_CROSSING, INFORMAL_MERGE, OVERTAKE, SUDDEN_STOP/TURN/ACCEL`.

`core/scenarios/manager.py` exposes preset environments (`village_road`,
`market_road`, `highway`, `school_zone`, …) that combine a road type,
weather, traffic density, and a hazard list — e.g. `village_road` →
`{"hazards": ["potholes", "unmarked_lanes", "livestock"]}` — plus a random
generator (`/api/scenarios/random/generate`) for stress-testing with unseen
combinations.

## 7. Running the live demo (car detects object → path changes)

```bash
bash setup.sh
bash run.sh
# open http://localhost:8004/simulator/
```

1. Click **▶ Start**. The ego vehicle drives with the default (`offset=0`)
   candidate path drawn in green.
2. Click **`+ Cattle`** (or **`+ Pothole`**, **`+ Pedestrian`**) — this spawns
   the object ahead of the ego vehicle on the current line.
3. Within one AI tick (≤200 ms) you will see, without touching anything else:
   - a **risk halo** grow around the new object,
   - the **candidate path fan** (faint grey dashed lines) re-score,
   - the **selected path** (bold, colour-coded green→amber→red) visibly bend
     to a different lateral offset,
   - the HUD action change to `Steer Left`/`Steer Right`/`Brake`, with a
     human-readable `reason` string (e.g. `"Path replanning: steering to
     offset -4m"`),
   - the replan counter increment.
4. Click **`Block Road`** to spawn a truck+bus pair spanning the road width —
   this exercises the hard-override branch (`Emergency Brake`) when no safe
   candidate offset exists.
5. Try the **SIH-5: Cattle Crossing** preset for a scripted version of the
   same behaviour, or **🎲 Random Scenario** to fuzz it.

## 8. Evaluation

`core/benchmark/suite.py`, exposed at `POST /api/benchmark/run`, scores the
platform across `speed`, `brake` (stopping distance), `steering` (lateral
error), `detection_accuracy`, and further categories described in
`docs/PERFORMANCE_BENCHMARKS.md`, returning a `mode` field (`synthetic` vs.
`live`) so results are never presented as more real than they are.

## 9. Limitations & extension path

- Planning and physics are 2D-kinematic, not a full vehicle dynamics model —
  adequate for demonstrating planning *logic*, not for tuning a real
  controller.
- Perception is simulated (confidence/noise model), not run against actual
  camera/LiDAR frames. `core/carla_integration/` is a working **client** for
  a real CARLA server (`docs/CARLA_SETUP.md`) as the path to 3D, sensor-real
  validation, but it is not yet wired to replace this 2D engine's visuals —
  that integration is the natural next step.
- The lattice planner samples a fixed offset set; a follow-up could add
  velocity-space sampling (a Dynamic-Window-style search) so the planner can
  also choose to slow down mid-maneuver rather than only choosing a lane
  offset.

## 10. Verification performed on this workspace

- `python -m py_compile` on every `.py` file: clean.
- `bash setup.sh` equivalent (`pip install` the core dependency set): clean.
- `uvicorn api.server:app` boots; `GET /`, `GET /simulator/`, and every
  static asset under `/simulator/*` (`style.css`, `app.js`, `ai-engine.js`,
  `simulator.js`, `config.js`, `dataset.js`, `security.js`,
  `test-engine.js`) returns `200`.
- `pytest tests/` → **12/12 passed**.
- Smoke-tested `/api/scenarios`, `/api/scenarios/random/generate`,
  `/api/models`, `/api/echo/experiences`, `/api/benchmark/run`,
  `/api/datasets`, `/api/analytics/overview`, `/api/carla/status` — all
  returned valid `200` JSON.
- Fixed one latent bug found during this verification: `ImportReq.copy` in
  `api/server.py` shadowed a `pydantic.BaseModel` attribute (harmless
  `UserWarning`, not a crash) — renamed to `copy_files` with a `copy` alias
  for backward-compatible request bodies.
