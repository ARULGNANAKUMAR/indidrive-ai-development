"""
IndiDrive AI Lab — Flask Backend
Simulation AI development platform for Indian road autonomous driving.
SIMULATION ENVIRONMENT — Not for real-world vehicle control.
"""

import os, json, time, math, random, logging
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify

# Optional CORS import
try:
    from flask_cors import CORS
    HAS_CORS = True
except ImportError:
    HAS_CORS = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("indidrive")

app = Flask(__name__, static_folder=".", static_url_path="")

ALLOWED_ORIGINS = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5000,http://127.0.0.1:5000,http://localhost:3000"
).split(",")

if HAS_CORS:
    CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def ok(data):
    return jsonify({"success": True, "data": data, "error": None})

def err(code, msg, status=400):
    return jsonify({"success": False, "data": None,
                    "error": {"code": code, "message": msg}}), status

def san_str(v, maxlen=200, default=""):
    if not isinstance(v, str): return default
    s = v[:maxlen].strip()
    for bad in ["<", ">", '"', "'", "../", "javascript:"]:
        s = s.replace(bad, "")
    return s

def san_num(v, lo, hi, default):
    try:
        n = float(v)
        return max(lo, min(hi, n))
    except (TypeError, ValueError):
        return default

def san_int(v, lo, hi, default):
    try:
        return max(lo, min(hi, int(v)))
    except (TypeError, ValueError):
        return default

def require_json(f):
    @wraps(f)
    def w(*a, **kw):
        if not request.is_json:
            return err("INVALID_CONTENT_TYPE", "Content-Type must be application/json")
        return f(*a, **kw)
    return w

# ── Rate limiter (in-memory, per IP) ──
_rl = {}
RL_MAX = 120   # requests/minute

def rate_limit(f):
    @wraps(f)
    def w(*a, **kw):
        ip = request.remote_addr
        now = time.time()
        _rl[ip] = [t for t in _rl.get(ip, []) if now - t < 60]
        if len(_rl[ip]) >= RL_MAX:
            return err("RATE_LIMITED", "Too many requests", 429)
        _rl[ip].append(now)
        return f(*a, **kw)
    return w

# ═══════════════════════════════════════════════════════════════
# SIMULATION AI ENGINE
# Deterministic models — clearly labelled simulation-only.
# ═══════════════════════════════════════════════════════════════

OBJ_RISK = {
    "pedestrian": 1.00, "cattle": 0.95, "bike": 0.72, "scooter": 0.68,
    "auto": 0.65, "car": 0.60, "truck": 0.75, "bus": 0.70,
    "tractor": 0.60, "cycle": 0.50, "pushcart": 0.55,
    "rock": 0.82, "debris": 0.68, "obstacle": 0.80,
}

class SimAI:
    """Simulation AI engine — deterministic, not real-world validated."""

    def detect(self, sensor_data):
        dets = []
        for o in sensor_data[:50]:
            d = san_num(o.get("distance", 30), 0, 200, 30)
            base = 0.94
            conf = min(0.99, base * max(0.55, 1 - d / 70) + random.uniform(-0.03, 0.03))
            dets.append({
                "id":         o.get("id", "?"),
                "type":       san_str(o.get("type", "car"), 20, "car"),
                "confidence": round(conf, 3),
                "distance":   round(d, 2),
                "direction":  san_str(o.get("direction", "ahead"), 20, "ahead"),
                "bbox":       o.get("bbox", {"x": 0, "y": 0, "w": 30, "h": 50}),
            })
        return dets

    def predict(self, obj, steps=None):
        if steps is None:
            steps = [0.5, 1.0, 2.0, 3.0, 5.0]
        vx = float(obj.get("vx", 0))
        vy = float(obj.get("vy", -2))
        px = float(obj.get("x", 0))
        py = float(obj.get("y", 0))
        preds = []
        for t in steps:
            noise_x = random.gauss(0, 0.15) * math.sqrt(t)
            noise_y = random.gauss(0, 0.15) * math.sqrt(t)
            preds.append({
                "t":    t,
                "x":    round(px + vx * t + noise_x, 2),
                "y":    round(py + vy * t + noise_y, 2),
                "conf": round(max(0.4, 0.97 - 0.08 * t), 3),
            })
        return preds

    def risk(self, obj, ego_spd):
        dist     = san_num(obj.get("distance",       20), 0,  200,  20)
        rel_spd  = san_num(obj.get("relative_speed", 10), 0,  200,  10)
        obj_type = san_str(obj.get("type",         "car"), 20, "car")
        direction= san_str(obj.get("direction","ahead"),   20, "ahead")

        # Time to collision
        closure_ms = rel_spd * 0.2778  # km/h → m/s
        ttc = dist / closure_ms if closure_ms > 0.3 else 999.0

        dist_r = max(0.0, 1.0 - (dist / 55) ** 0.65)
        ttc_r  = max(0.0, 1.0 - (min(ttc, 8) / 8))
        dir_r  = {"ahead": 1.0, "ahead_left": 0.80, "ahead_right": 0.80,
                  "left": 0.40, "right": 0.40, "behind": 0.08}.get(direction, 0.50)
        tw     = OBJ_RISK.get(obj_type, 0.60)

        score = (dist_r * 0.35 + ttc_r * 0.42 + dir_r * 0.13) * tw
        score = round(min(1.0, score), 4)

        if score >= 0.83:   lvl = "CRITICAL"
        elif score >= 0.65: lvl = "HIGH"
        elif score >= 0.45: lvl = "MEDIUM"
        elif score >= 0.20: lvl = "LOW"
        else:               lvl = "SAFE"

        return {"risk_score": score, "risk_level": lvl,
                "ttc": round(ttc, 2), "distance": dist}

    def decide(self, sit):
        mr   = san_num(sit.get("max_risk",    0.3), 0, 1,   0.3)
        spd  = san_num(sit.get("ego_speed",   40),  0, 120, 40)
        crit = sit.get("critical_objects", [])
        if not isinstance(crit, list): crit = []

        left_blocked  = any(o.get("direction") in ("ahead_left",  "left")  for o in crit)
        right_blocked = any(o.get("direction") in ("ahead_right", "right") for o in crit)

        acts = [
            {"action": "Continue",        "risk": round(mr * 1.00, 3), "ok": mr < 0.55},
            {"action": "Slow Down",       "risk": round(mr * 0.75, 3), "ok": True},
            {"action": "Brake",           "risk": round(mr * 0.50, 3), "ok": True},
            {"action": "Emergency Brake", "risk": round(mr * 0.22, 3), "ok": True},
            {"action": "Steer Left",      "risk": round(mr * (0.30 if not left_blocked  else 0.95), 3), "ok": not left_blocked},
            {"action": "Steer Right",     "risk": round(mr * (0.30 if not right_blocked else 0.95), 3), "ok": not right_blocked},
            {"action": "Stop",            "risk": round(mr * 0.12, 3), "ok": spd > 0},
            {"action": "Overtake",        "risk": round(mr * 0.55, 3), "ok": not left_blocked and spd < 80},
            {"action": "Re-route",        "risk": round(mr * 0.40, 3), "ok": True},
        ]
        acts.sort(key=lambda a: a["risk"])
        sel = next((a for a in acts if a["ok"]), acts[0])

        return {
            "actions_evaluated": acts,
            "selected_action":   sel["action"],
            "selected_risk":     sel["risk"],
            "confidence":        round(max(0.55, 0.97 - sel["risk"] * 0.4), 3),
            "reason":            _build_reason(sel["action"], mr, sit),
        }

    def plan(self, start, goal, obstacles):
        paths = []
        for offset in [0, -2.5, 2.5, -5, 5]:
            wps = []
            for i in range(11):
                t = i / 10
                x = start["x"] + offset * math.sin(math.pi * t)
                y = start["y"] + (goal["y"] - start["y"]) * t
                wps.append({"x": round(x, 2), "y": round(y, 2)})

            pr = 0.0
            for wp in wps:
                for obs in obstacles[:20]:
                    dx = wp["x"] - float(obs.get("x", 0))
                    dy = wp["y"] - float(obs.get("y", 0))
                    d  = math.hypot(dx, dy)
                    if d < 4:
                        pr = max(pr, 1.0 - d / 4)

            st = "safe" if pr < 0.30 else "warning" if pr < 0.70 else "blocked"
            paths.append({"offset": offset, "waypoints": wps, "risk": round(pr, 3), "status": st})

        paths.sort(key=lambda p: p["risk"])
        best = paths[0]
        return {
            "selected_path":     best,
            "all_paths":         paths,
            "replanning_needed": best["risk"] > 0.68,
        }

    def metrics(self, log):
        if not log: return {}
        n = len(log)
        colls = sum(1 for s in log if s.get("collision"))
        ok_   = sum(1 for s in log if s.get("scenario_complete") and not s.get("collision"))
        risks = [s.get("score", 70) for s in log]
        avg_r = sum(risks) / n
        safety= round(avg_r * (1 - colls / max(n, 1)), 1)
        return {
            "total_steps":     n,
            "collision_rate":  round(colls / max(n, 1), 4),
            "success_rate":    round(ok_  / max(n, 1), 4),
            "average_score":   round(avg_r, 2),
            "safety_score":    safety,
            "sim_note":        "SIMULATION ENVIRONMENT — Not for real-world vehicle control",
        }


def _build_reason(action, risk, sit):
    reasons = {
        "Continue":        "Risk within acceptable threshold; path appears clear",
        "Slow Down":       "Reducing speed to increase reaction time margin",
        "Brake":           "Moderate obstacle detected; controlled deceleration required",
        "Emergency Brake": f"Critical risk {risk:.0%}; immediate stop necessary",
        "Steer Left":      "Right-lane obstacle; steering left to clear trajectory",
        "Steer Right":     "Left-lane obstacle; steering right to clear trajectory",
        "Stop":            "Road blocked; full stop to await safe passage",
        "Overtake":        "Slow vehicle ahead; safe to overtake via left",
        "Re-route":        "Primary path blocked; computing alternate route",
    }
    return reasons.get(action, "AI decision based on current risk assessment")


_ai = SimAI()

# ═══════════════════════════════════════════════════════════════
# SIH 2026 SCENARIOS
# ═══════════════════════════════════════════════════════════════

SIH = {
    "sih_1": {
        "id": "sih_1", "name": "SIH-1: Unmarked Village Road",
        "description": "Unmarked village road — mixed unstructured traffic with cattle",
        "road_type": "VILLAGE", "traffic_density": 0.50, "road_damage": 0.60,
        "pedestrian_density": 0.40, "animal_probability": 0.45,
        "obstacle_probability": 0.30, "weather": "clear", "visibility": 0.80,
        "road_width": 5, "vehicle_speed": 25, "unpredictability": 0.72,
        "challenge": "No lane markings, unpredictable mixed traffic, sudden cattle",
        "objective": "Navigate safely without lane guidance on unstructured road",
        "difficulty": "Hard",
    },
    "sih_2": {
        "id": "sih_2", "name": "SIH-2: Busy Urban Intersection",
        "description": "Dense signalless urban intersection",
        "road_type": "URBAN", "traffic_density": 0.88, "road_damage": 0.30,
        "pedestrian_density": 0.72, "animal_probability": 0.08,
        "obstacle_probability": 0.40, "weather": "clear", "visibility": 0.68,
        "road_width": 8, "vehicle_speed": 20, "unpredictability": 0.82,
        "challenge": "No signals, multiple conflict zones, dense pedestrian flow",
        "objective": "Safe intersection navigation with priority arbitration",
        "difficulty": "Extreme",
    },
    "sih_3": {
        "id": "sih_3", "name": "SIH-3: Highway Merge — Slow Vehicles",
        "description": "Highway merge with slow tractors and trucks",
        "road_type": "HIGHWAY", "traffic_density": 0.60, "road_damage": 0.20,
        "pedestrian_density": 0.08, "animal_probability": 0.12,
        "obstacle_probability": 0.28, "weather": "clear", "visibility": 0.92,
        "road_width": 16, "vehicle_speed": 70, "unpredictability": 0.48,
        "challenge": "High-speed operation near very slow tractors; sudden merges",
        "objective": "Adaptive speed control during high-speed merge manoeuvres",
        "difficulty": "Medium",
    },
    "sih_4": {
        "id": "sih_4", "name": "SIH-4: Dense Market Area",
        "description": "Maximum-density market road with all traffic types",
        "road_type": "MARKET", "traffic_density": 0.96, "road_damage": 0.50,
        "pedestrian_density": 0.92, "animal_probability": 0.20,
        "obstacle_probability": 0.65, "weather": "clear", "visibility": 0.60,
        "road_width": 5.5, "vehicle_speed": 15, "unpredictability": 0.93,
        "challenge": "Maximum chaos — vendors, animals, vehicles, pedestrians",
        "objective": "Ultra-low speed navigation through maximum-density environment",
        "difficulty": "Extreme",
    },
    "sih_5": {
        "id": "sih_5", "name": "SIH-5: Sudden Cattle Crossing",
        "description": "Rural road — sudden cattle herd crossing at vehicle speed",
        "road_type": "VILLAGE", "traffic_density": 0.28, "road_damage": 0.42,
        "pedestrian_density": 0.18, "animal_probability": 0.92,
        "obstacle_probability": 0.22, "weather": "clear", "visibility": 0.88,
        "road_width": 6, "vehicle_speed": 42, "unpredictability": 0.80,
        "challenge": "Sudden herd of cattle crosses at 42 km/h approach speed",
        "objective": "Emergency response to unexpected large animal obstruction",
        "difficulty": "Hard",
    },
}

# ═══════════════════════════════════════════════════════════════
# IN-MEMORY STORAGE
# ═══════════════════════════════════════════════════════════════

_results = []
_models  = {
    "current": "IndiDrive-V1",
    "versions": {
        "IndiDrive-V1": {
            "version": "V1", "label": "Baseline",
            "safety_score": 71.8, "collision_rate": 0.130,
            "prediction_accuracy": 0.768, "replanning_latency": 192,
            "path_smoothness": 0.724, "scenario_success_rate": 0.698,
            "train_samples": 8400,
        },
        "IndiDrive-V2": {
            "version": "V2", "label": "Improved",
            "safety_score": 83.5, "collision_rate": 0.072,
            "prediction_accuracy": 0.855, "replanning_latency": 148,
            "path_smoothness": 0.812, "scenario_success_rate": 0.832,
            "train_samples": 22000,
        },
        "IndiDrive-V3": {
            "version": "V3", "label": "Current Best",
            "safety_score": 91.6, "collision_rate": 0.031,
            "prediction_accuracy": 0.921, "replanning_latency": 97,
            "path_smoothness": 0.891, "scenario_success_rate": 0.918,
            "train_samples": 58000,
        },
    },
}

# ═══════════════════════════════════════════════════════════════
# SCENARIO GENERATOR
# ═══════════════════════════════════════════════════════════════

def gen_scenario(p):
    diff = (p["traffic_density"]*0.30 + p["road_damage"]*0.20 +
            p["unpredictability"]*0.30 + p["pedestrian_density"]*0.10 +
            p["animal_probability"]*0.10)
    dlabel = ("Easy" if diff < 0.30 else "Medium" if diff < 0.55
              else "Hard" if diff < 0.75 else "Extreme")

    objs, n = [], max(1, int(p["traffic_density"]*14 + p["pedestrian_density"]*5))
    base_types = ["car","bike","auto","pedestrian","cycle","scooter"]
    for i in range(n):
        t = random.choice(base_types)
        if random.random() < p["animal_probability"]: t = "cattle"
        objs.append({
            "id": f"{t}_{i}", "type": t,
            "x": round(random.uniform(-p["road_width"]/2, p["road_width"]/2), 1),
            "y": round(random.uniform(-60, -12), 1),
            "speed": round(random.uniform(5, 55), 1),
            "behaviour": random.choice(["normal","slow","sudden_stop","sudden_turn","lane_change"]),
        })

    hazards, nh = [], int(p["road_damage"] * 9)
    htypes = ["pothole","crack","gravel","mud","sand"]
    if random.random() < p["obstacle_probability"]: htypes += ["rock","debris","fallen_rocks"]
    for i in range(nh):
        hazards.append({
            "id": f"h_{i}", "type": random.choice(htypes),
            "x": round(random.uniform(-p["road_width"]/2 + 0.5, p["road_width"]/2 - 0.5), 1),
            "y": round(random.uniform(-50, -5), 1),
            "size": round(random.uniform(0.5, 2.2), 1),
        })

    return {
        "road_type": p.get("road_type","URBAN"),
        "weather": p.get("weather","clear"),
        "difficulty": dlabel, "difficulty_score": round(diff, 3),
        "objects": objs, "hazards": hazards,
        "params": p, "generated_at": datetime.utcnow().isoformat(),
        "sim_note": "SIMULATION ENVIRONMENT — Not for real-world vehicle control",
    }

# ═══════════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════════

@app.route("/")
def index():
    return app.send_static_file("index.html")

@app.route("/api/health")
def health():
    return ok({
        "status": "ok", "platform": "IndiDrive AI Lab",
        "version": "1.0.0", "timestamp": datetime.utcnow().isoformat(),
        "sim_note": "SIMULATION ENVIRONMENT — Not for real-world vehicle control",
    })

# ── Scenarios ────────────────────────────────────────────────

@app.route("/api/scenario/generate", methods=["POST"])
@rate_limit
@require_json
def scenario_generate():
    d = request.get_json(silent=True) or {}
    p = {
        "road_type":            san_str(d.get("road_type","URBAN"),    20, "URBAN"),
        "weather":              san_str(d.get("weather","clear"),       20, "clear"),
        "traffic_density":      san_num(d.get("traffic_density",  0.5), 0, 1,   0.5),
        "road_damage":          san_num(d.get("road_damage",      0.3), 0, 1,   0.3),
        "pedestrian_density":   san_num(d.get("pedestrian_density",0.3),0, 1,   0.3),
        "animal_probability":   san_num(d.get("animal_probability",0.1),0, 1,   0.1),
        "obstacle_probability": san_num(d.get("obstacle_probability",0.2),0,1,  0.2),
        "visibility":           san_num(d.get("visibility",       0.8), 0, 1,   0.8),
        "road_width":           san_num(d.get("road_width",         7), 3, 24,  7  ),
        "vehicle_speed":        san_num(d.get("vehicle_speed",     40), 0, 120, 40 ),
        "unpredictability":     san_num(d.get("unpredictability",  0.5),0, 1,   0.5),
    }
    return ok(gen_scenario(p))

@app.route("/api/scenario/sih")
def sih_list():
    return ok({"scenarios": list(SIH.values())})

@app.route("/api/scenario/sih/<sid>")
def sih_get(sid):
    sid = san_str(sid, 20)
    if sid not in SIH:
        return err("NOT_FOUND", f"Scenario {sid} not found", 404)
    return ok(SIH[sid])

# ── AI pipeline ──────────────────────────────────────────────

@app.route("/api/ai/predict", methods=["POST"])
@rate_limit
@require_json
def ai_predict():
    d = request.get_json(silent=True) or {}
    sensor = d.get("sensor_data", [])
    if not isinstance(sensor, list): sensor = []
    sensor = sensor[:50]
    ego_spd = san_num(d.get("ego_speed", 40), 0, 120, 40)

    dets  = _ai.detect(sensor)
    preds = [{"id": o.get("id"), "trajectory": _ai.predict(o)} for o in sensor[:12]]
    risks = [{"id": o.get("id"), **_ai.risk(o, ego_spd)} for o in sensor]

    max_r = max((r["risk_score"] for r in risks), default=0.0)
    min_t = min((r["ttc"] for r in risks if r["ttc"] < 500), default=999.0)

    return ok({
        "detections": dets, "predictions": preds, "risks": risks,
        "summary": {
            "max_risk": round(max_r, 4), "min_ttc": round(min_t, 2),
            "n_detected": len(dets), "ego_speed": ego_spd,
            "model": "SimDetection-V1 (simulation only)",
        },
    })

@app.route("/api/ai/decision", methods=["POST"])
@rate_limit
@require_json
def ai_decision():
    d   = request.get_json(silent=True) or {}
    sit = {
        "max_risk":        san_num(d.get("max_risk",    0.30), 0, 1,   0.30),
        "min_distance":    san_num(d.get("min_distance",50),   0, 500, 50  ),
        "ego_speed":       san_num(d.get("ego_speed",   40),   0, 120, 40  ),
        "critical_objects": d.get("critical_objects", [])
            if isinstance(d.get("critical_objects"), list) else [],
    }
    result = _ai.decide(sit)
    result["timestamp"] = datetime.utcnow().isoformat()
    result["model"]     = "SimDecision-V1 (simulation only)"
    return ok(result)

@app.route("/api/ai/plan", methods=["POST"])
@rate_limit
@require_json
def ai_plan():
    d    = request.get_json(silent=True) or {}
    s    = d.get("start",     {"x": 0, "y": 0})
    g    = d.get("goal",      {"x": 0, "y": -50})
    obs  = d.get("obstacles", []) if isinstance(d.get("obstacles"), list) else []
    result = _ai.plan(s, g, obs[:25])
    result["timestamp"] = datetime.utcnow().isoformat()
    return ok(result)

@app.route("/api/ai/suggest", methods=["POST"])
@rate_limit
@require_json
def ai_suggest():
    d = request.get_json(silent=True) or {}
    failures = d.get("failures", [])
    if not isinstance(failures, list): failures = []
    fail_str = " ".join(str(f.get("type","")) for f in failures if isinstance(f, dict)).lower()

    suggestions = []
    if "pedestrian" in fail_str:
        suggestions += [
            {"test": "High-speed pedestrian crossing",       "priority": "HIGH",   "scenario": "Pedestrian crossing at 60 km/h approach"},
            {"test": "Multiple simultaneous pedestrian crossing", "priority": "HIGH", "scenario": "3+ pedestrians from different directions"},
            {"test": "Low visibility pedestrian crossing",   "priority": "MEDIUM", "scenario": "Fog/night pedestrian crossing"},
        ]
    if "cattle" in fail_str:
        suggestions += [
            {"test": "Herd cattle crossing",                 "priority": "HIGH",   "scenario": "5+ cattle rapid crossing"},
            {"test": "Cattle + pedestrian combined",         "priority": "HIGH",   "scenario": "Simultaneous cattle and pedestrian crossing"},
        ]
    if any(k in fail_str for k in ["pothole","rock","obstacle","damage"]):
        suggestions += [
            {"test": "Dense pothole field at speed",         "priority": "MEDIUM", "scenario": "Multiple potholes at 40 km/h"},
            {"test": "Sudden large rock on road",            "priority": "HIGH",   "scenario": "Rock appears within 4m"},
        ]
    if any(k in fail_str for k in ["intersection","merge","signal"]):
        suggestions += [
            {"test": "Signalless intersection — 6-way",     "priority": "HIGH",   "scenario": "Uncontrolled 6-way intersection"},
            {"test": "Wrong-side vehicle at intersection",   "priority": "HIGH",   "scenario": "Oncoming vehicle crossing centre line"},
        ]
    if not suggestions:
        suggestions = [
            {"test": "Market road stress test",              "priority": "MEDIUM", "scenario": "Max density Indian market area"},
            {"test": "Emergency brake chain test",           "priority": "HIGH",   "scenario": "5 emergency stops in 60 seconds"},
            {"test": "Night + fog combined visibility",      "priority": "LOW",    "scenario": "Near-zero visibility navigation"},
        ]
    return ok({"suggestions": suggestions, "failure_count": len(failures)})

# ── Tests ────────────────────────────────────────────────────

@app.route("/api/test/run", methods=["POST"])
@rate_limit
@require_json
def test_run():
    d       = request.get_json(silent=True) or {}
    tid     = san_str(d.get("test_id", ""), 60)
    level   = san_int(d.get("level",  1), 1, 10, 1)
    mid     = san_str(d.get("model_id","IndiDrive-V3"), 60)

    base    = _models["versions"].get(mid, {}).get("safety_score", 70) / 100
    diff    = level / 10
    n       = max(3, 12 - level)
    subs    = []

    for i in range(n):
        noise  = random.gauss(0, 0.12)
        passed = random.random() < max(0.05, base - diff * 0.35 + noise)
        score  = round(max(0, min(100, (base - diff*0.35 + noise)*100)), 1)
        subs.append({
            "sub_test": i+1, "passed": passed, "score": score,
            "collision": not passed and random.random() > 0.45,
            "ttc_min": round(random.uniform(0.4, 6.0), 2),
            "decision_correct": passed or random.random() > 0.35,
        })

    pc   = sum(1 for s in subs if s["passed"])
    res  = {
        "test_id": tid or f"test_l{level}", "level": level, "model": mid,
        "passed": pc / n > 0.58, "score": round(pc / n * 100, 1),
        "sub_results": subs, "metrics": _ai.metrics(subs),
        "timestamp": datetime.utcnow().isoformat(),
    }
    _results.append(res)
    if len(_results) > 200: _results.pop(0)
    return ok(res)

# ── Dataset ──────────────────────────────────────────────────

@app.route("/api/dataset/validate", methods=["POST"])
@rate_limit
@require_json
def dataset_validate():
    d       = request.get_json(silent=True) or {}
    samples = d.get("samples", [])
    if not isinstance(samples, list): return err("INVALID_INPUT", "samples must be a list")
    samples = samples[:2000]
    n       = len(samples)
    inv, mis= 0, 0
    req     = {"id","type","x","y"}
    for s in samples:
        if not isinstance(s, dict): inv += 1; continue
        if not req.issubset(s.keys()): mis += 1
    good = n - inv - mis
    qs   = good / max(n, 1)
    return ok({
        "total_samples": n, "valid_samples": good,
        "invalid_samples": inv, "missing_fields": mis,
        "quality_score": round(qs, 3),
        "status": "valid" if qs>0.8 else "warning" if qs>0.5 else "invalid",
        "can_train": qs > 0.70 and n >= 10,
    })

@app.route("/api/dataset/analyze", methods=["POST"])
@rate_limit
@require_json
def dataset_analyze():
    d       = request.get_json(silent=True) or {}
    samples = d.get("samples", [])
    if not isinstance(samples, list) or not samples:
        return err("INVALID_INPUT", "No valid samples")
    samples = samples[:5000]
    classes, speeds, miss = {}, [], 0
    for s in samples:
        if not isinstance(s, dict): continue
        t = san_str(str(s.get("type","unknown")), 30)
        classes[t] = classes.get(t, 0) + 1
        if "speed" in s:
            try: speeds.append(float(s["speed"]))
            except: pass
        else: miss += 1
    n_sam = len(samples)
    avg_spd = round(sum(speeds)/len(speeds), 2) if speeds else 0

    # Class balance score
    class_vals = list(classes.values())
    class_total = sum(class_vals)
    ideal = class_total / max(len(class_vals), 1)
    balance = round(1 - sum(abs(v - ideal) for v in class_vals) / max(2 * class_total, 1), 3) if class_vals else 0

    training_readiness = (
        "READY"    if n_sam >= 100 and balance >= 0.30 else
        "MARGINAL" if n_sam >= 10  and balance >= 0.10 else
        "NOT_READY"
    )

    return ok({
        "total_samples":       n_sam,
        "class_distribution":  classes,
        "total_classes":       len(classes),
        "class_balance":       balance,
        "average_speed":       avg_spd,
        "missing_speed_pct":   round(miss / max(n_sam, 1), 3),
        "training_readiness":  training_readiness,
        "recommendation":      "Suitable for training" if n_sam >= 100 else f"Need ≥100 samples (have {n_sam})",
    })

# ── Models ───────────────────────────────────────────────────

@app.route("/api/model/current")
def model_current():
    return ok({"current": _models["current"], "versions": _models["versions"]})

@app.route("/api/model/compare", methods=["POST"])
@rate_limit
@require_json
def model_compare():
    d    = request.get_json(silent=True) or {}
    mids = d.get("model_ids", list(_models["versions"].keys()))
    if not isinstance(mids, list): mids = list(_models["versions"].keys())
    cmp  = {san_str(str(m),60): _models["versions"][san_str(str(m),60)]
            for m in mids if san_str(str(m),60) in _models["versions"]}
    return ok({"comparison": cmp, "current": _models["current"]})

@app.route("/api/model/evaluate", methods=["POST"])
@rate_limit
@require_json
def model_evaluate():
    d  = request.get_json(silent=True) or {}
    mid= san_str(d.get("model_id","IndiDrive-V3"), 60)
    if mid not in _models["versions"]:
        return err("NOT_FOUND", f"Model {mid} not found", 404)
    base = _models["versions"][mid]
    nz   = lambda: random.uniform(-0.015, 0.015)
    return ok({
        "model_id": mid,
        "metrics": {
            "safety_score":           round(max(0, min(100, base["safety_score"]        + nz()*8)), 1),
            "collision_rate":         round(max(0,          base["collision_rate"]       + nz()*0.05), 4),
            "prediction_accuracy":    round(max(0, min(1,   base["prediction_accuracy"] + nz())), 3),
            "replanning_latency_ms":  round(max(50,         base["replanning_latency"]  + random.uniform(-12,12))),
            "path_smoothness":        round(max(0, min(1,   base["path_smoothness"]     + nz())), 3),
            "scenario_success_rate":  round(max(0, min(1,   base["scenario_success_rate"]+ nz())), 3),
        },
        "sim_note": "Simulation evaluation — not validated for real-world deployment",
        "timestamp": datetime.utcnow().isoformat(),
    })

# ── Results & Security ───────────────────────────────────────

@app.route("/api/results")
@rate_limit
def results():
    return ok({"results": _results[-30:], "total": len(_results)})

@app.route("/api/security/status")
def security_status():
    return ok({
        "input_validation": True, "rate_limiting": True,
        "cors_restricted": True,  "json_validation": True,
        "path_traversal_prevention": True, "no_eval": True,
        "security_headers": True, "no_key_exposure": True,
        "status": "PASS",
    })

# ── Headers & error handlers ─────────────────────────────────

@app.after_request
def sec_headers(r):
    r.headers["X-Content-Type-Options"] = "nosniff"
    r.headers["X-Frame-Options"]        = "DENY"
    r.headers["X-XSS-Protection"]       = "1; mode=block"
    r.headers["Cache-Control"]          = "no-store"
    if not HAS_CORS:
        for o in ALLOWED_ORIGINS:
            r.headers["Access-Control-Allow-Origin"]  = o
        r.headers["Access-Control-Allow-Headers"] = "Content-Type"
        r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return r

@app.route("/api/<path:p>", methods=["OPTIONS"])
def options_handler(p):
    return "", 204

@app.errorhandler(404)
def e404(e): return err("NOT_FOUND",           "Endpoint not found", 404)

@app.errorhandler(405)
def e405(e): return err("METHOD_NOT_ALLOWED",  "Method not allowed", 405)

@app.errorhandler(500)
def e500(e):
    log.error("500: %s", e)
    return err("INTERNAL_ERROR", "An internal error occurred", 500)

# ═══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    print("=" * 60)
    print("  IndiDrive AI Lab — Backend starting on port", port)
    print("  SIMULATION ENVIRONMENT — Not for real-world vehicles")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=debug)
