# IndiDrive AI — Phase 0 Completion Report

## Project audit

Full detail in `docs/PROJECT_AUDIT.md`. Summary: the project was
inspected file-by-file (all ~8,200 lines of Python/JS/Markdown), every
Python file was `py_compile`-checked, and every module that could run
without `fastapi`/`uvicorn`/`httpx`/`pytest`/`a2wsgi` (none of which
could be installed — this sandbox has no network access) was actually
imported and exercised, not just read. This included live-testing the
legacy Flask simulator's `/`, `/api/health`, `/api/scenario/generate`,
`/api/scenario/sih`, `/api/ai/plan`, and `/api/ai/decision` endpoints
via Flask's test client, and importing all seven `core/` product
modules plus the CARLA client library directly.

## Changes

See `docs/PROJECT_AUDIT.md` §5 for the complete file-by-file list.
Short version — **added**: `config/*.yaml` (4 files),
`core/config_loader.py`, `core/logging_system.py`, `core/modes.py`,
`core/health/` (4 files), `app.py`, `.env.example`, `.gitignore`,
`tests/{health,configuration,integration,regression}/` (4 new test
files, 30 tests), `docs/PROJECT_AUDIT.md`, `docs/BASELINE.md`, this
file. **Removed**: the empty, unused `configs/` directory. **Modified**:
`docs/INSTALLATION.md` (corrected a stale multi-phase-launcher
description that didn't match the actual merged single-process app),
`README.md` (added the Phase 0–15 status table). **Not touched**:
every existing `core/` module, `api/server.py`, `legacy_simulator/`,
`frontend/`, `scripts/`, `requirements.txt`, `run.sh`/`run.bat`/
`setup.sh`/`setup.bat`, and the two pre-existing test files.

## Preserved functionality

Verified working, unchanged, after all Phase 0 edits:

| Component | Verified how |
|---|---|
| Legacy 2D simulator (`legacy_simulator/server.py`) | Live Flask test-client calls to `/`, `/api/health`, `/api/scenario/generate`, `/api/scenario/sih`, `/api/ai/plan`, `/api/ai/decision` — all return `success: true` / 200 |
| Existing planner (`SimAI.plan`) | `/api/ai/plan` still returns 5 candidate paths (matching the 5 lateral offsets in `config/planner_config.yaml`, which documents rather than changes this) and flags `replanning_needed` correctly |
| Existing collision/decision logic (`SimAI.decide`) | `/api/ai/decision` still returns one of the original 9 actions, selected by risk as before |
| Scenario manager, dataset manager, model manager, ECHO V2, report generator, deployment manager | All import and run their core methods with no errors |
| CARLA client library | Imports cleanly without a `carla` package present, and its own `CarlaUnavailableError` failure path was actually triggered and caught (not just eyeballed) |
| `api/server.py` (FastAPI product API + `/simulator` mount + `/api/carla/status`) | **Not runtime-verified** — `fastapi`/`uvicorn`/`a2wsgi` cannot be installed in this sandbox (no network access). `py_compile` confirms no syntax errors, and every `core/` module it imports was independently verified working, so the risk surface is limited to the FastAPI/a2wsgi wiring itself, which is unchanged from before Phase 0 |
| `frontend/` static UI | **Not visually verified** — requires the FastAPI static mount, which could not be started here |

## Tests

Actual results, this sandbox, 2026-09-13:

```
tests/configuration/test_config.py   7 passed, 0 failed
tests/health/test_health_check.py    6 passed, 0 failed
tests/integration/test_existing_app.py  8 passed, 0 failed
tests/regression/test_regression.py  9 passed, 0 failed
------------------------------------------------------
Total (new, Phase 0)                30 passed, 0 failed
```

Run via each file's own `python3 tests/<dir>/<file>.py` fallback
runner, **not** `pytest` — `pytest` itself isn't installed in this
sandbox (no network access). Every file is also written in standard
pytest style (`assert`, `pytest.raises`) and will run under
`PYTHONPATH=. pytest tests/ -v` once dependencies are installed; the
fallback runner is a genuine test execution, not a simulation of one —
it calls the exact same test functions pytest would collect.

`tests/test_phase5.py` and `tests/test_carla_client.py` (pre-existing,
untouched) could not be executed by either `pytest` or the fallback
runner in this pass, since they use `pytest.fixture`/`monkeypatch` in
ways the minimal fallback doesn't replicate. They were reviewed by
reading and cross-checked against the (unmodified) modules they test;
this is **NOT** the same as running them, and is reported as such.

Distinguishing test types, as required by Phase 0 scope:
- **UNIT TEST**: `tests/configuration/`, most of `tests/health/`
- **MOCK TEST**: `tests/regression/test_carla_connection_raises_clear_error_without_carla_installed` (exercises the real code path that fires when `carla` isn't installed — not a mock of CARLA itself, since none was available)
- **INTEGRATION TEST**: `tests/integration/` (Flask test client against the real, unmodified `legacy_simulator/server.py`)
- **CARLA TEST**: none run — no CARLA server was available in this sandbox (see Baseline)

## Baseline

See `docs/BASELINE.md` for full detail and methodology. Headline numbers:
health check 0.77 s, `app.py --health-only` cold start 0.28 s, legacy
simulator import < 1 ms, `/api/ai/plan` 0.64 ms/call average,
`/api/ai/decision` 0.22 ms/call average, peak RSS 9.3 MB. FastAPI
server startup time, CARLA connection time, and sensor initialization
time are all marked `NOT AVAILABLE` — genuinely not measurable in this
sandbox, not estimated.

## Known limitations

- `fastapi`, `uvicorn`, `httpx`, `pytest`, and `a2wsgi` could not be
  installed (no network access in this sandbox), so `api/server.py`,
  the `/simulator` a2wsgi mount, the `frontend/` static UI, and the
  benchmark suite's live-engine path were never runtime-started here.
  The health check correctly reports this as `DEGRADED`, not `READY`.
- No CARLA server was available, so CARLA connection, vehicle spawn,
  and live sensor callbacks are unverified beyond code review and the
  library's own import-time and failure-path behavior.
- `tests/test_phase5.py` / `tests/test_carla_client.py` were not
  executed in this pass (see "Tests" above) — only reviewed.
- CPU-usage measurement was not meaningful to collect given how short
  every exercised code path is (see `docs/BASELINE.md`).

## Overall

```
PHASE 0 STATUS
====================

Project Audit       PASS
Dependencies        WARN   (5 required packages not installable — no network access in this sandbox)
Configuration       PASS
Health Check        PASS
Logging             PASS
Error Handling      PASS
Tests               PASS   (30/30 new tests; 2 pre-existing test files reviewed, not executed)
Regression          PASS   (every verifiable existing component still behaves as before)
Simulator            PASS
CARLA                WARN   (client code sound; NOT RUN against a live server)
Documentation        PASS

Overall:
PHASE 0 COMPLETE
```

"Complete" here means: the full Phase 0 scope (audit, dependency
review, central config, operating modes, health check, structured
logging, error handling, directory management, baseline measurement,
testing, documentation) was implemented and verified to the extent
this offline sandbox allows. The two genuine gaps — the FastAPI/a2wsgi
server stack and a live CARLA server — are environment limitations
inherited from the original project (its own README already said the
same), not something Phase 0 left undone by choice. Re-running
`python3 app.py --health-only` after `pip install -r requirements.txt`
on a machine with network access should turn `Dependencies` and
`API Server` from `WARN` to `PASS`.
