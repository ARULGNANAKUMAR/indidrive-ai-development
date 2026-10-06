"""
IndiDrive AI — Phase 5 | Product Platform API
Port 8004. Wraps Dataset Manager, Model Manager, ECHO V2, Benchmark
Center, Scenario Manager, Report Generator, Deployment Modes, and
launcher/health-check aggregation across Phases 1-4, behind one API,
plus serves the Phase 5 product UI as static files.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Optional

try:
    import httpx
    _HTTPX_AVAILABLE = True
except ImportError:
    httpx = None  # type: ignore
    _HTTPX_AVAILABLE = False

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from core.dataset.manager import DatasetManager
from core.models.manager import ModelManager
from core.echo.echo_v2 import EchoV2
from core.benchmark.suite import BenchmarkSuite
from core.scenarios.manager import ScenarioManager
from core.reports.generator import ReportGenerator
from core.deployment import DeploymentManager

app = FastAPI(
    title="IndiDrive AI — Phase 5 Product Platform",
    description="Dataset management, self-learning, benchmarking, analytics, deployment, unified launcher status.",
    version="5.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                    allow_methods=["*"], allow_headers=["*"])

dataset_mgr = DatasetManager()
model_mgr = ModelManager()
echo = EchoV2()
benchmark = BenchmarkSuite()
scenarios = ScenarioManager()
reports = ReportGenerator()
deployment = DeploymentManager()

PHASE_PORTS = {"phase2_perception": 8001, "phase3_echo_brain": 8002, "phase4_engine": 8003}


# ========================================================================
# Launcher / Health
# ========================================================================

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "phase5", "ts": time.time()}


@app.get("/api/launcher/status")
def launcher_status():
    statuses = {}
    for name, port in PHASE_PORTS.items():
        statuses[name] = _check_port(port)
    statuses["phase1_legacy_simulator"] = {"mounted_at": "/simulator", "mounted": _LEGACY_MOUNTED}
    statuses["phase5_product_platform"] = {"port": 8004, "healthy": True}
    return statuses


def _check_port(port: int) -> dict:
    if not _HTTPX_AVAILABLE:
        return {"port": port, "healthy": False, "checked_path": None, "note": "httpx not installed in this environment"}
    for path in ("/api/health", "/api/engine/health", "/"):
        try:
            r = httpx.get(f"http://localhost:{port}{path}", timeout=1.0)
            if r.status_code < 500:
                return {"port": port, "healthy": True, "checked_path": path}
        except Exception:
            continue
    return {"port": port, "healthy": False, "checked_path": None}


# ========================================================================
# Dataset Manager
# ========================================================================

class CreateDatasetReq(BaseModel):
    name: str

class ImportReq(BaseModel):
    source_paths: list[str]
    copy_files: bool = Field(default=True, alias="copy")

    model_config = {"populate_by_name": True}

class SplitReq(BaseModel):
    train: float = 0.8
    val: float = 0.1
    test: float = 0.1
    seed: int = 42


@app.get("/api/datasets")
def list_datasets():
    return dataset_mgr.list_datasets()

@app.post("/api/datasets")
def create_dataset(req: CreateDatasetReq):
    return dataset_mgr.create_dataset(req.name)

@app.post("/api/datasets/{dataset_id}/import")
def import_dataset(dataset_id: str, req: ImportReq):
    try:
        return dataset_mgr.import_files(dataset_id, req.source_paths, req.copy_files)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

@app.get("/api/datasets/{dataset_id}/stats")
def dataset_stats(dataset_id: str):
    try:
        return dataset_mgr.stats(dataset_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))

@app.post("/api/datasets/{dataset_id}/split")
def dataset_split(dataset_id: str, req: SplitReq):
    return dataset_mgr.split_dataset(dataset_id, req.train, req.val, req.test, req.seed)

@app.post("/api/datasets/{dataset_id}/auto_label")
def dataset_auto_label(dataset_id: str, limit: Optional[int] = None):
    return dataset_mgr.auto_label(dataset_id, limit)

@app.post("/api/datasets/{dataset_id}/version")
def dataset_version(dataset_id: str, note: str = ""):
    return dataset_mgr.new_version(dataset_id, note)


# ========================================================================
# Model Manager
# ========================================================================

class InstallModelReq(BaseModel):
    name: str
    role: str
    source: str = ""
    version: str = "v1"
    weights_path: Optional[str] = None

class SetActiveReq(BaseModel):
    role: str
    model_id: str


@app.get("/api/models")
def list_models():
    return model_mgr.list_models()

@app.post("/api/models")
def install_model(req: InstallModelReq):
    return model_mgr.install_model(req.name, req.role, req.source, req.version, req.weights_path)

@app.delete("/api/models/{model_id}")
def remove_model(model_id: str):
    ok = model_mgr.remove_model(model_id)
    if not ok:
        raise HTTPException(404, "model not found")
    return {"removed": model_id}

@app.post("/api/models/active")
def set_active_model(req: SetActiveReq):
    try:
        return model_mgr.set_active(req.role, req.model_id)
    except FileNotFoundError:
        raise HTTPException(404, "model not found")

@app.get("/api/models/compare")
def compare_models(role: Optional[str] = None):
    return model_mgr.compare(role)

@app.post("/api/models/{model_id}/export_onnx")
def export_onnx(model_id: str):
    try:
        return model_mgr.export_onnx(model_id)
    except FileNotFoundError:
        raise HTTPException(404, "model not found")


# ========================================================================
# ECHO V2
# ========================================================================

class ExperienceReq(BaseModel):
    scenario: str
    features: dict
    action_taken: str
    outcome: str
    notes: str = ""


@app.post("/api/echo/experience")
def echo_record(req: ExperienceReq):
    return echo.record_experience(req.scenario, req.features, req.action_taken, req.outcome, req.notes)

@app.get("/api/echo/experiences")
def echo_list(limit: int = 200):
    return echo.list_experiences(limit)

@app.get("/api/echo/replay")
def echo_replay(scenario: Optional[str] = None, min_importance: float = 0.0):
    return echo.replay(scenario, min_importance)

@app.post("/api/echo/cluster")
def echo_cluster(k: int = 6):
    return echo.cluster_patterns(k)

@app.post("/api/echo/promote_principles")
def echo_promote_principles(min_support: int = 3, min_consistency: float = 0.7):
    return echo.promote_principles(min_support, min_consistency)

@app.post("/api/echo/promote_capabilities")
def echo_promote_capabilities(min_group: int = 2):
    return echo.promote_capabilities(min_group)

@app.get("/api/echo/training_hints")
def echo_training_hints():
    return echo.export_training_hints()

@app.get("/api/echo/memory_growth")
def echo_memory_growth():
    return echo.memory_growth()

@app.post("/api/echo/cleanup")
def echo_cleanup(keep_last: int = 5000, min_importance_to_keep: float = 0.3):
    return echo.cleanup(keep_last, min_importance_to_keep)


# ========================================================================
# Benchmark & Testing Center
# ========================================================================

class BenchmarkReq(BaseModel):
    scenario: Optional[dict] = None
    seed: int = 0


@app.post("/api/benchmark/run")
def run_benchmark(req: BenchmarkReq):
    result = benchmark.run_all(req.scenario, req.seed)
    for cat, res in result["results"].items():
        pass  # per-category model metric writeback could be wired here per role
    return result

@app.post("/api/benchmark/run_and_report")
def run_benchmark_and_report(req: BenchmarkReq):
    result = benchmark.run_all(req.scenario, req.seed)
    paths = reports.safety_report(result)
    return {"result": result, "report_files": paths}


# ========================================================================
# Scenario Manager
# ========================================================================

@app.get("/api/scenarios")
def list_scenarios():
    return scenarios.list_scenarios()

@app.get("/api/scenarios/{name}")
def get_scenario(name: str):
    try:
        return scenarios.get_scenario(name)
    except KeyError as e:
        raise HTTPException(404, str(e))

@app.get("/api/scenarios/random/generate")
def random_scenario(seed: Optional[int] = None):
    return scenarios.random_scenario(seed)

@app.post("/api/scenarios/combine")
def combine_scenarios(names: list[str]):
    return scenarios.combine(names)


# ========================================================================
# Reports
# ========================================================================

@app.get("/api/reports/download")
def download_report(path: str):
    p = Path(path)
    if not p.exists() or ROOT not in p.parents:
        raise HTTPException(404, "report not found")
    return FileResponse(p)


# ========================================================================
# Deployment Modes
# ========================================================================

@app.get("/api/deployment/mode")
def get_mode():
    return deployment.get_mode()

@app.post("/api/deployment/mode/{mode}")
def set_mode(mode: str):
    try:
        return deployment.set_mode(mode)
    except ValueError as e:
        raise HTTPException(400, str(e))

@app.get("/api/deployment/modes")
def list_modes():
    return deployment.list_modes()


# ========================================================================
# Analytics (aggregation across the above; live where possible)
# ========================================================================

@app.get("/api/analytics/overview")
def analytics_overview():
    growth = echo.memory_growth()
    datasets = dataset_mgr.list_datasets()
    total_images = sum(d.get("total_images", 0) for d in datasets)
    model_data = model_mgr.list_models()
    return {
        "echo_memory": growth,
        "dataset_count": len(datasets),
        "total_images": total_images,
        "model_count": len(model_data["models"]),
        "active_models": model_data["active"],
        "deployment_mode": deployment.get_mode()["mode"],
    }


# ========================================================================
# Perception (Phase 2)
# ========================================================================
# Exposed on the same single port (this project deliberately runs one
# process — see run.sh) rather than the separate phase2_perception:8001
# placeholder the launcher status check above still probes for future
# phases. The PerceptionManager is constructed lazily so importing this
# module never requires a camera/LiDAR/model to be present.

_perception_mgr = None


def _get_perception_manager():
    global _perception_mgr
    if _perception_mgr is None:
        from core.perception.perception_manager import PerceptionManager
        _perception_mgr = PerceptionManager()
        _perception_mgr.initialize()
    return _perception_mgr


@app.get("/api/perception/health")
def perception_health():
    return _get_perception_manager().get_health()


@app.get("/api/perception/model-status")
def perception_model_status():
    return _get_perception_manager().get_model_status()


@app.get("/api/perception/latest")
def perception_latest():
    frame = _get_perception_manager().get_latest_perception()
    if frame is None:
        return {"status": "NO_FRAME_PROCESSED_YET"}
    return frame.to_dict()


@app.post("/api/perception/run-synthetic")
def perception_run_synthetic():
    """Runs one perception cycle against a synthetic (all-zero) frame,
    for smoke-testing the endpoint without a live camera/LiDAR attached.
    Uses whatever real backend is configured — if none is configured,
    the response honestly reports NOT_CONFIGURED, it does not fabricate
    detections."""
    import numpy as np
    mgr = _get_perception_manager()
    frame = mgr.process_frame(
        camera_image=np.zeros((480, 640, 3), dtype=np.uint8), camera_timestamp=time.time(),
    )
    return frame.to_dict()


# ========================================================================
# Legacy simulator (formerly a separate Flask process on its own port)
# ========================================================================
# `legacy_simulator/server.py` is a Flask (WSGI) app, not an ASGI one, so
# it can't be imported and called directly like the core/ modules above.
# We mount it as a sub-application using a2wsgi's WSGIMiddleware, which
# bridges WSGI apps into an ASGI app like this one. If a2wsgi isn't
# installed, this degrades to a clear 501 instead of crashing the whole
# platform — the legacy simulator can still be run standalone in that
# case (see legacy_simulator/README section in the project README).
LEGACY_SIM_DIR = ROOT / "legacy_simulator"
_LEGACY_MOUNTED = False
if LEGACY_SIM_DIR.exists():
    try:
        from a2wsgi import WSGIMiddleware
        sys.path.insert(0, str(LEGACY_SIM_DIR))
        import importlib
        _legacy_mod = importlib.import_module("server")  # legacy_simulator/server.py
        app.mount("/simulator", WSGIMiddleware(_legacy_mod.app), name="legacy_simulator")
        _LEGACY_MOUNTED = True
    except Exception as _e:  # pragma: no cover - environment-dependent
        _legacy_mount_error = str(_e)

        @app.api_route("/simulator/{_path:path}", methods=["GET", "POST"])
        def legacy_simulator_unavailable(_path: str = ""):
            raise HTTPException(
                501,
                "Legacy simulator not mounted: install 'a2wsgi' "
                f"(pip install a2wsgi) to enable it. Error: {_legacy_mount_error}",
            )


@app.get("/api/carla/status")
def carla_status():
    """
    Reports whether the CARLA integration code is importable and whether
    the real `carla` PyPI package (installed separately from CARLA's own
    distribution, not from this requirements.txt) is available. This does
    NOT connect to a CARLA server — it's a static capability check.
    """
    result = {"module_files_present": (ROOT / "core" / "carla_integration").exists()}
    try:
        sys.path.insert(0, str(ROOT))
        from core.carla_integration import connection as _carla_connection  # noqa: F401
        result["client_wrapper_importable"] = True
    except Exception as e:
        result["client_wrapper_importable"] = False
        result["client_wrapper_error"] = str(e)
    try:
        import carla  # noqa: F401
        result["carla_package_installed"] = True
    except ImportError:
        result["carla_package_installed"] = False
        result["note"] = "Install CARLA's own PythonAPI wheel; see docs/CARLA_SETUP.md"
    return result


# ========================================================================
# Static frontend (Phase 5 product UI)
# ========================================================================

FRONTEND_DIR = ROOT / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
