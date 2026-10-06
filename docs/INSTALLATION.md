# IndiDrive AI — Installation Guide

> **Note (post-merge, corrected in Phase 0):** this project runs as a
> single process on a single port. Use `bash setup.sh` then
> `bash run.sh` (or `python3 app.py`) from the project root. An earlier
> version of this document described a `scripts/launch_all.sh`
> multi-phase launcher (phase folders on ports 8001–8003) — **that
> script does not exist in this project** and the instructions below
> have been corrected to match the actual code. See the top-level
> `README.md` for the current architecture.

## 1. Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ | 3.12 used in development |
| pip | latest | `--break-system-packages` needed on Debian/Ubuntu 24.04+ |
| bash | any | for `setup.sh`/`run.sh` (Linux/macOS/WSL); `setup.bat`/`run.bat` on Windows |
| CARLA | separate install | only needed for `core/carla_integration/` — a GPU-heavy Unreal Engine app you install and run yourself; see `docs/CARLA_SETUP.md`. Not required for the product platform or the legacy simulator |
| Node/npm | — | not required; both frontends are static JS |

No SQL database is required anywhere in this stack — all persistence is
JSON/JSONL files under `storage/` (and, for CARLA test recordings,
wherever `scripts/carla_spawn_and_record.py` is pointed).

## 2. Install dependencies

```bash
bash setup.sh
```
which runs:
```bash
pip install -r requirements.txt --break-system-packages
```

Core deps required for the API to run at all: `fastapi`, `uvicorn`,
`pydantic`, `pyyaml` (also used by Phase 0's `config/` loader),
`httpx`. `flask`/`flask-cors` are needed for the legacy simulator
(`flask-cors` degrades gracefully if missing — CORS is simply
disabled). `a2wsgi` bridges the legacy Flask app into the FastAPI app;
if missing, `/simulator/*` returns a clear `501` instead of crashing
the platform. `pytest` is needed to run the test suite.

Two are optional and the app degrades gracefully without them:
- `reportlab` — without it, "PDF" reports are written as clearly-labeled
  `.txt` fallbacks instead of failing.
- `ultralytics` — without it, dataset auto-labeling produces a flagged
  `heuristic_placeholder` label instead of a real YOLO detection.

Verify the install:
```bash
python3 -c "import fastapi, uvicorn, pydantic, httpx, a2wsgi, flask; print('core deps OK')"
```

Or, more thoroughly, run the Phase 0 health check (see §5 below) —
it checks every package in `requirements.txt` individually and tells
you exactly which are missing and why they matter.

## 3. Run

```bash
bash run.sh
```
or, for the Phase-0-aware entry point that also runs the health check
and bootstraps required directories first:
```bash
python3 app.py
```
Both start `uvicorn api.server:app` on port 8004 (override with
`PORT=8010 bash run.sh` or `python3 app.py --port 8010`).

- Product platform UI + API: **http://localhost:8004/**
- Legacy canvas simulator: **http://localhost:8004/simulator/**
- API docs: **http://localhost:8004/api/docs**
- CARLA integration status: **http://localhost:8004/api/carla/status**

On Windows: `setup.bat` then `run.bat`.

## 4. Run tests

```bash
PYTHONPATH=. pytest tests/ -v
```
Phase 0 added `tests/health/`, `tests/configuration/`,
`tests/integration/`, and `tests/regression/` alongside the existing
`tests/test_phase5.py` and `tests/test_carla_client.py`. See
`docs/PHASE_0_COMPLETION_REPORT.md` for what actually ran and passed
in the sandbox this was built in (which has no network access, so
`pytest` itself could not be installed there — see that report for
exactly what was verified by other means instead).

## 5. Health check

```bash
python3 app.py --health-only
```
or
```bash
PYTHONPATH=. python3 -m core.health.system_report
```
Prints a PASS/WARN/FAIL breakdown per component and an overall
READY/DEGRADED/NOT READY status. Safe to run before `pip install` —
it will tell you exactly which packages are missing rather than
crashing.

## 6. Environment variables

Copy `.env.example` to `.env` and adjust as needed — see that file for
what each variable actually does and which code reads it. None are
required for a default local run.

## 7. Common install issues

| Symptom | Cause | Fix |
|---|---|---|
| `error: externally-managed-environment` | Debian/Ubuntu PEP 668 protection | add `--break-system-packages`, or use a venv: `python3 -m venv .venv && source .venv/bin/activate` |
| `/simulator/*` returns `501` | `a2wsgi` not installed | `pip install a2wsgi --break-system-packages` |
| Auto-labeling always says `heuristic_placeholder` | `ultralytics` not installed, or no internet to fetch YOLO weights on first run | `pip install ultralytics --break-system-packages`; first run downloads `yolo11n.pt` and needs network access once |
| PDF reports come out as `.txt` | `reportlab` not installed | `pip install reportlab --break-system-packages` |
| `/api/carla/status` shows `carla_package_installed: false` | The `carla` Python package isn't a normal PyPI wheel | Install it from your CARLA distribution's `PythonAPI` folder — see `docs/CARLA_SETUP.md` |

## 8. Environment without internet access

If you're installing in a sandboxed/offline environment (no PyPI
access — this is exactly how Phase 0 itself was developed and
verified), `core/`'s dataset manager, model manager, ECHO V2, scenario
manager, deployment manager, and the legacy Flask simulator all run on
the Python standard library (+ `numpy`/`flask`, if present) alone and
need no network. Confirmed working in that state:

```bash
PYTHONPATH=. python3 -c "
from core.dataset.manager import DatasetManager
mgr = DatasetManager()
print(mgr.list_datasets())
"
PYTHONPATH=. python3 -c "
import sys; sys.path.insert(0, 'legacy_simulator')
import server
c = server.app.test_client()
print(c.get('/api/health').get_json())
"
```

Only `api/server.py` itself (needs `fastapi`/`uvicorn`/`a2wsgi`), PDF
export, and real YOLO labeling need their respective packages.

