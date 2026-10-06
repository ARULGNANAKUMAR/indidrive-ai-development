# IndiDrive AI — CARLA Integration (Real Simulator Milestone)

This replaces the Three.js visualization with a real driving simulator:
[CARLA](https://carla.org/) — Unreal Engine-based, real vehicle physics,
real sensor simulation (camera/LIDAR/collision/lane-invasion), real
traffic via CARLA's built-in Traffic Manager.

## What's real here vs. what's next

**Actually built and verified in this package** (verified means: run
against real or realistic fake data and checked, not just written):
- `carla_client/connection.py` — connects to a CARLA server, reports
  real version/map info, synchronous-mode tick control, actor cleanup
- `carla_client/vehicle.py` — spawns an ego vehicle with real
  spawn-point retry logic (CARLA spawn points collide in practice —
  this handles that instead of assuming spawn point 0 always works)
- `carla_client/sensors.py` — attaches real RGB camera, LIDAR,
  collision, and lane-invasion sensors, with a thread-safe `SensorBus`
  (CARLA sensor callbacks run on a background thread — verified this
  doesn't corrupt data under concurrent writes, see `tests/`)
- `scripts/test_connection.py` and `scripts/spawn_and_record.py` — real
  runnable end-to-end scripts

**Verified how, given I have no GPU/display/CARLA in this sandbox:**
- Decode logic (BGRA→RGB, LIDAR byte layout) tested against fake
  CARLA-shaped data with known values, checked byte-for-byte
- Thread-safety tested with 8 threads × 200 writes each, checked the
  count and no corruption
- The "CARLA not installed" failure path is not simulated — this
  sandbox genuinely doesn't have `carla` installed, so that test
  exercises the real code path
- All files compile cleanly (`python -m py_compile`)
- **Not verified**: actual vehicle spawning, actual camera frames,
  actual CARLA server communication — I cannot do that without CARLA
  running on real hardware. You are the first to run that part. See
  `docs/CARLA_SETUP.md`, then `scripts/test_connection.py`, then
  `scripts/spawn_and_record.py`, in that order, and tell me what
  actually happens.

## Next milestones (not yet built — say which you want next)

1. **Real perception on the live feed** — wire actual YOLOv11 inference
   onto `bus.get("rgb_front")` frames instead of just saving them
2. **A real (even if simple) planner** replacing `enable_autopilot`'s
   CARLA Traffic Manager — read perception + vehicle state, output
   throttle/brake/steer yourself
3. **Feed real CARLA episodes into ECHO V2** from the Phase 5 platform
   — replace synthetic experience recording with real collision/
   lane-invasion events from this sensor bus
4. **Re-point the Phase 5 Benchmark Suite** at this CARLA client instead
   of the old Phase 4 mock engine, so benchmark numbers come from real
   simulated physics

## Directory layout

```
indidrive-carla/
├── carla_client/
│   ├── connection.py     # client/world/tick/cleanup
│   ├── vehicle.py        # spawn + autopilot
│   └── sensors.py        # camera/lidar/collision/lane sensors + SensorBus
├── scripts/
│   ├── test_connection.py
│   └── spawn_and_record.py
├── tests/
│   └── test_carla_client.py   # runs WITHOUT carla installed
├── docs/
│   └── CARLA_SETUP.md
└── storage/carla_runs/<timestamp>/   # created at runtime
```

## Run the tests (no CARLA needed for these)

```bash
pip install numpy pytest --break-system-packages
PYTHONPATH=. pytest tests/test_carla_client.py -v
```
