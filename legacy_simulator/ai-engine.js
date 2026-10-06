// ============================================================
// IndiDrive AI Lab — AI Engine (Client-side)
// Modular pipeline: Detection → Tracking → Prediction →
//   Risk → Decision → Path Planning → Collision Avoidance
//
// SIMULATION MODEL — Not validated for real-world deployment.
// Architecture designed for future YOLO/PyTorch integration.
// ============================================================

class IndiDriveAIEngine {
  constructor() {
    this._tracks   = new Map();   // id → track state
    this._decLog   = [];          // decision log for replay
    this._repCount = 0;           // replan counter
    this._frameIdx = 0;

    // Current pipeline state (exposed for HUD / overlays)
    this.state = {
      detections:  [],
      tracks:      [],
      predictions: [],
      risks:       [],
      decision:    null,
      path:        null,
      maxRisk:     0,
      minTTC:      999,
      action:      'IDLE',
      confidence:  0,
      riskLevel:   'SAFE',
    };
  }

  // ══════════════════════════════════════════════════════════
  // MAIN PIPELINE — call every AI update tick
  // ══════════════════════════════════════════════════════════
  process(sensorData, egoState) {
    this._frameIdx++;
    const t0 = performance.now();

    // 1 — Detection
    const dets = this.detect(sensorData, egoState);

    // 2 — Tracking
    const tracks = this.track(dets);

    // 3 — Prediction
    const preds = this.predictAll(tracks);

    // 4 — Risk assessment
    const { risks, maxRisk, minTTC, criticals } = this.assessRisk(tracks, preds, egoState);

    // 5 — Decision
    const decision = this.decide({ maxRisk, minTTC, criticals, egoState });

    // 6 — Path planning
    const path = this.plan(egoState, tracks);

    // 7 — Collision avoidance override
    const finalAction = this.collisionCheck(decision, path, criticals, egoState);

    const latency = Math.round(performance.now() - t0);

    // Update state
    this.state = {
      detections:  dets,
      tracks,
      predictions: preds,
      risks,
      decision,
      path,
      maxRisk,
      minTTC,
      action:      finalAction.action,
      confidence:  finalAction.confidence,
      riskLevel:   getRiskLevel(maxRisk).id,
      latency,
    };

    // Log to decision log (for replay)
    if (decision && decision.action !== 'IDLE') {
      this._logDecision(finalAction, risks, egoState);
    }

    return this.state;
  }

  // ══════════════════════════════════════════════════════════
  // 1. OBJECT DETECTION
  // Simulates camera/LiDAR detection from virtual sensor data.
  // Architecture: plug real YOLO/OpenCV results in here later.
  // ══════════════════════════════════════════════════════════
  detect(sensorData, egoState = {}) {
    if (!Array.isArray(sensorData)) return [];
    const detections = [];
    const visibility = egoState.visibility ?? 1.0;
    const now = Date.now();

    for (const obs of sensorData.slice(0, CONFIG.MAX_OBJECTS)) {
      if (!obs || typeof obs !== 'object') continue;

      const dist    = Security.sanitizeNumber(obs.distance,  0, 200, 30);
      const typeKey = Security.sanitizeString(obs.type || 'car', 20);

      // Simulate detection confidence:
      // Farther objects & lower visibility → lower confidence
      const distFactor  = Math.max(0.45, 1 - (dist / (CONFIG.DETECTION_RANGE * 1.5)));
      const visFactor   = Math.max(0.5, visibility);
      const baseConf    = 0.93;
      const noise       = (Math.random() - 0.5) * CONFIG.SENSOR_NOISE;
      const confidence  = Math.min(0.99, baseConf * distFactor * visFactor + noise);

      // Simulate occasional sensor dropout
      if (confidence < 0.30) continue;

      const direction = Security.sanitizeString(obs.direction || 'ahead', 20);
      const typeInfo  = OBJECT_TYPES[typeKey.toUpperCase()] || OBJECT_TYPES.CAR;

      detections.push({
        id:         Security.sanitizeString(obs.id || `obj_${Date.now()}`, 40),
        type:       typeKey,
        label:      typeInfo.label,
        confidence: parseFloat(confidence.toFixed(3)),
        distance:   parseFloat(dist.toFixed(2)),
        direction,
        vx:         parseFloat((obs.vx || 0).toFixed(2)),
        vy:         parseFloat((obs.vy || -1).toFixed(2)),
        x:          parseFloat((obs.x  || 0).toFixed(2)),
        y:          parseFloat((obs.y  || 0).toFixed(2)),
        w:          typeInfo.w,
        h:          typeInfo.h,
        speed:      parseFloat((obs.speed || 0).toFixed(1)),
        timestamp:  now,
        bbox: obs.bbox || {
          x: (obs.canvasX || 400) - (typeInfo.w * CONFIG.PIXELS_PER_METER / 2),
          y: (obs.canvasY || 200) - (typeInfo.h * CONFIG.PIXELS_PER_METER / 2),
          w: typeInfo.w * CONFIG.PIXELS_PER_METER,
          h: typeInfo.h * CONFIG.PIXELS_PER_METER,
        },
        // Flag for future real-ML integration
        source: 'simulation_sensor',
      });
    }

    return detections;
  }

  // ══════════════════════════════════════════════════════════
  // 2. TRACKING (nearest-neighbour with history)
  // ══════════════════════════════════════════════════════════
  track(detections) {
    const now = Date.now();
    const matched = new Set();

    for (const det of detections) {
      const id = det.id;
      if (this._tracks.has(id)) {
        const tk = this._tracks.get(id);
        // Update with exponential smoothing
        tk.x        = 0.7 * det.x + 0.3 * tk.x;
        tk.y        = 0.7 * det.y + 0.3 * tk.y;
        tk.vx       = det.vx;
        tk.vy       = det.vy;
        tk.speed    = det.speed;
        tk.confidence = det.confidence;
        tk.distance = det.distance;
        tk.age++;
        tk.lastSeen = now;
        tk.det      = det;
        matched.add(id);
      } else {
        this._tracks.set(id, {
          id, type: det.type, x: det.x, y: det.y,
          vx: det.vx, vy: det.vy, speed: det.speed,
          confidence: det.confidence, distance: det.distance,
          direction: det.direction, w: det.w, h: det.h,
          age: 0, lastSeen: now, det,
          history: [],
        });
        matched.add(id);
      }
      // Append position to history (keep last 10)
      const tk = this._tracks.get(id);
      tk.history.push({ x: det.x, y: det.y, t: now });
      if (tk.history.length > 10) tk.history.shift();
    }

    // Remove stale tracks (not seen for 2 seconds)
    for (const [id, tk] of this._tracks) {
      if (!matched.has(id) && now - tk.lastSeen > 2000) {
        this._tracks.delete(id);
      }
    }

    return Array.from(this._tracks.values());
  }

  // ══════════════════════════════════════════════════════════
  // 3. MOTION PREDICTION (kinematic constant-velocity model)
  // Returns predicted positions at t = [0.5, 1, 2, 3, 5] s
  // ══════════════════════════════════════════════════════════
  predictTrajectory(track, steps = [0.5, 1.0, 2.0, 3.0, 5.0]) {
    const pts = [];
    const { x, y, vx = 0, vy = -1, type } = track;

    // Cattle/pedestrians get wider uncertainty
    const typeKey = (type || '').toUpperCase();
    const uncertaintyBase = ['CATTLE', 'PEDESTRIAN'].includes(typeKey) ? 0.25 : 0.10;

    for (const t of steps) {
      // Gaussian noise scaled by time and type uncertainty
      const sigma = uncertaintyBase * Math.sqrt(t);
      const nx = this._gaussNoise() * sigma;
      const ny = this._gaussNoise() * sigma;
      pts.push({
        t,
        x: parseFloat((x + vx * t + nx).toFixed(2)),
        y: parseFloat((y + vy * t + ny).toFixed(2)),
        confidence: parseFloat(Math.max(0.35, 0.97 - 0.09 * t).toFixed(3)),
        uncertainty: parseFloat((sigma * 2).toFixed(2)),
      });
    }
    return pts;
  }

  predictAll(tracks) {
    return tracks.map(tk => ({
      id:         tk.id,
      type:       tk.type,
      trajectory: this.predictTrajectory(tk),
    }));
  }

  // ══════════════════════════════════════════════════════════
  // 4. RISK ASSESSMENT
  // ══════════════════════════════════════════════════════════
  assessRisk(tracks, predictions, egoState = {}) {
    const egoSpeed = egoState.speed || 0;  // km/h
    const egoX     = egoState.x    || 0;
    const egoY     = egoState.y    || 0;

    const risks = [];
    let maxRisk = 0;
    let minTTC  = 999;
    const criticals = [];

    for (const tk of tracks) {
      const typeKey = (tk.type || 'car').toUpperCase();
      const typeInfo = OBJECT_TYPES[typeKey] || OBJECT_TYPES.CAR;
      const typeWeight = typeInfo.risk || 0.6;

      // Distance risk (exponential)
      const dist      = Math.max(0.1, tk.distance);
      const distRisk  = Math.max(0, 1 - Math.pow(dist / 55, 0.65));

      // TTC risk
      const closureMS = (tk.speed + egoSpeed * 0.278);   // m/s approach speed
      const ttc       = closureMS > 0.3 ? dist / closureMS : 999;
      const ttcRisk   = Math.max(0, 1 - Math.min(ttc, 8) / 8);

      // Direction risk
      const dir     = tk.direction || 'ahead';
      const dirMap  = { ahead: 1.0, ahead_left: 0.80, ahead_right: 0.80, left: 0.38, right: 0.38, behind: 0.07 };
      const dirRisk = dirMap[dir] ?? 0.50;

      // Prediction collision check (does any predicted point intersect ego path?)
      const pred = predictions.find(p => p.id === tk.id);
      let predRisk = 0;
      if (pred) {
        for (const pt of pred.trajectory) {
          if (Math.abs(pt.x - egoX) < 2.5 && pt.y > egoY - 5 && pt.y < egoY + 15) {
            predRisk = Math.max(predRisk, (1 - pt.t / 6) * 0.4);
          }
        }
      }

      // Road condition modifier
      const roadMod = egoState.roadDamageFactor || 1.0;

      const rawRisk = (distRisk * 0.30 + ttcRisk * 0.38 + dirRisk * 0.12 + predRisk * 0.20) * typeWeight * roadMod;
      const score   = Math.min(1.0, parseFloat(rawRisk.toFixed(4)));
      const level   = getRiskLevel(score);

      const riskEntry = {
        id: tk.id, type: tk.type,
        risk_score: score, risk_level: level.id,
        ttc: parseFloat(Math.min(ttc, 999).toFixed(2)),
        distance: parseFloat(dist.toFixed(2)),
        direction: dir,
      };

      risks.push(riskEntry);
      if (score > maxRisk) maxRisk = score;
      if (ttc < minTTC)    minTTC  = ttc;
      if (score > 0.50)    criticals.push({ ...tk, risk_score: score, ttc });
    }

    return {
      risks,
      maxRisk: parseFloat(maxRisk.toFixed(4)),
      minTTC:  parseFloat(Math.min(minTTC, 999).toFixed(2)),
      criticals,
    };
  }

  // ══════════════════════════════════════════════════════════
  // 5. DECISION ENGINE
  // Evaluates all possible actions, selects safest feasible.
  // ══════════════════════════════════════════════════════════
  decide({ maxRisk, minTTC, criticals = [], egoState = {} }) {
    const speed   = egoState.speed    || 0;
    const heading = egoState.heading  || 0;

    const leftBlocked  = criticals.some(o => ['ahead_left', 'left'].includes(o.direction));
    const rightBlocked = criticals.some(o => ['ahead_right', 'right'].includes(o.direction));
    const frontBlocked = criticals.some(o => o.direction === 'ahead' && o.risk_score > 0.60);

    const actions = [
      { action: 'Continue',        risk: maxRisk * 1.00, ok: maxRisk < 0.52 },
      { action: 'Slow Down',       risk: maxRisk * 0.74, ok: true },
      { action: 'Brake',           risk: maxRisk * 0.50, ok: true },
      { action: 'Emergency Brake', risk: maxRisk * 0.20, ok: maxRisk > 0.65 || minTTC < 2.5 },
      { action: 'Steer Left',      risk: leftBlocked  ? maxRisk * 0.92 : maxRisk * 0.28, ok: !leftBlocked && !frontBlocked },
      { action: 'Steer Right',     risk: rightBlocked ? maxRisk * 0.92 : maxRisk * 0.28, ok: !rightBlocked && !frontBlocked },
      { action: 'Stop',            risk: maxRisk * 0.10, ok: speed > 1 },
      { action: 'Overtake',        risk: leftBlocked  ? maxRisk * 0.90 : maxRisk * 0.55, ok: !leftBlocked && speed < 80 },
      { action: 'Re-route',        risk: maxRisk * 0.38, ok: true },
    ];

    actions.sort((a, b) => a.risk - b.risk);

    // Select best feasible action
    const selected = actions.find(a => a.ok) || actions[0];

    const reason = this._buildReason(selected.action, maxRisk, minTTC, criticals);

    const result = {
      actions_evaluated: actions,
      action:    selected.action,
      risk:      parseFloat(selected.risk.toFixed(4)),
      confidence: parseFloat(Math.max(0.52, 0.97 - selected.risk * 0.45).toFixed(3)),
      reason,
      ttc:       minTTC,
      max_risk:  maxRisk,
      criticals: criticals.slice(0, 3),
      timestamp: Date.now(),
    };

    return result;
  }

  // ══════════════════════════════════════════════════════════
  // 6. PATH PLANNING (candidate path evaluation)
  // Generates multiple lateral offset paths, selects safest.
  // ══════════════════════════════════════════════════════════
  plan(egoState = {}, tracks = []) {
    const px   = egoState.x       || 0;
    const py   = egoState.y       || 0;
    const road = egoState.roadWidth || 7;
    const halfRoad = road / 2;

    const offsets = [0, -2, 2, -4, 4, -6, 6].filter(o => Math.abs(o) <= halfRoad - 1);
    const paths   = [];

    for (const offset of offsets) {
      const waypoints = [];
      const STEPS = 12;

      for (let i = 0; i <= STEPS; i++) {
        const t  = i / STEPS;
        const x  = px + offset * Math.sin(Math.PI * t);
        const y  = py - 55 * t;            // plan 55m ahead
        waypoints.push({ x: parseFloat(x.toFixed(2)), y: parseFloat(y.toFixed(2)) });
      }

      // Score path against tracked objects and their predictions
      let pathRisk = 0;
      for (const tk of tracks) {
        for (const wp of waypoints) {
          const dx = wp.x - tk.x;
          const dy = wp.y - tk.y;
          const d  = Math.hypot(dx, dy);
          if (d < 4.0) pathRisk = Math.max(pathRisk, 1.0 - d / 4.0);
        }
      }

      const status = pathRisk < 0.25 ? 'safe' : pathRisk < 0.65 ? 'warning' : 'blocked';
      paths.push({ offset, waypoints, risk: parseFloat(pathRisk.toFixed(3)), status });
    }

    paths.sort((a, b) => a.risk - b.risk);
    const best = paths[0];

    const replanning = (this.state.path && this.state.path.risk < 0.30 && best.risk > 0.45);
    if (replanning) this._repCount++;

    return {
      selected:         best,
      all:              paths,
      replanning,
      repcount:         this._repCount,
      planning_latency: Math.round(Math.random() * 20 + 5),  // sim latency
    };
  }

  // ══════════════════════════════════════════════════════════
  // 7. COLLISION AVOIDANCE (final override)
  // Overrides planner if imminent collision detected.
  // ══════════════════════════════════════════════════════════
  collisionCheck(decision, path, criticals, egoState = {}) {
    if (!decision) return { action: 'Continue', confidence: 0.7 };

    const minTTC = decision.ttc;
    const maxRisk = decision.max_risk;

    // Hard override: imminent collision
    if (minTTC < 1.2 && maxRisk > 0.80) {
      return {
        action:     'Emergency Brake',
        confidence: 0.98,
        reason:     `COLLISION AVOIDANCE: TTC ${minTTC.toFixed(1)}s — emergency stop triggered`,
        override:   true,
      };
    }

    // Hard override: path blocked but planner found side path
    if (path && path.selected && path.selected.risk > 0.70 && path.all.length > 1) {
      const alt = path.all.find(p => p.risk < 0.30 && p.status === 'safe');
      if (alt) {
        const steer = alt.offset < 0 ? 'Steer Left' : 'Steer Right';
        return {
          action:     steer,
          confidence: 0.87,
          reason:     `Path replanning: steering to offset ${alt.offset}m`,
          override:   true,
        };
      }
    }

    return { action: decision.action, confidence: decision.confidence, reason: decision.reason, override: false };
  }

  // ══════════════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════════════
  _gaussNoise() {
    // Box-Muller transform for Gaussian noise
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  _buildReason(action, maxRisk, minTTC, criticals) {
    const topObj = criticals[0];
    const objStr = topObj ? `${topObj.type} (${topObj.distance?.toFixed(1) || '?'}m)` : 'obstacle';
    const reasons = {
      'Continue':        `Risk ${(maxRisk*100).toFixed(0)}% within threshold. Path clear.`,
      'Slow Down':       `Reducing speed to extend reaction margin. Risk ${(maxRisk*100).toFixed(0)}%.`,
      'Brake':           `${objStr} detected ahead. Controlled deceleration.`,
      'Emergency Brake': `${objStr} — TTC ${minTTC.toFixed(1)}s. COLLISION IMMINENT. Emergency stop.`,
      'Steer Left':      `${objStr} blocking right path. Steering left to clear trajectory.`,
      'Steer Right':     `${objStr} blocking left path. Steering right to clear trajectory.`,
      'Stop':            `Road blocked by ${objStr}. Full stop until passage clears.`,
      'Overtake':        `Slow vehicle ahead (${objStr}). Safe to overtake left.`,
      'Re-route':        `Primary path blocked. Computing alternate route.`,
    };
    return reasons[action] || `AI decision — risk ${(maxRisk*100).toFixed(0)}%.`;
  }

  _logDecision(action, risks, egoState) {
    this._decLog.push({
      ts:        Date.now(),
      action:    action.action,
      reason:    action.reason,
      confidence: action.confidence,
      override:  action.override || false,
      max_risk:  this.state.maxRisk,
      min_ttc:   this.state.minTTC,
      risk_level: this.state.riskLevel,
      speed:     egoState.speed || 0,
      n_objects: this.state.detections.length,
    });
    if (this._decLog.length > 300) this._decLog.shift();
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC ACCESSORS
  // ══════════════════════════════════════════════════════════
  getDecisionLog()   { return [...this._decLog]; }
  getReplanCount()   { return this._repCount; }
  getState()         { return { ...this.state }; }

  resetSession() {
    this._tracks.clear();
    this._decLog   = [];
    this._repCount = 0;
    this._frameIdx = 0;
    this.state.action    = 'IDLE';
    this.state.maxRisk   = 0;
    this.state.minTTC    = 999;
    this.state.riskLevel = 'SAFE';
  }

  // ══════════════════════════════════════════════════════════
  // GENERATE VIRTUAL SENSOR DATA (for standalone AI Engine page)
  // ══════════════════════════════════════════════════════════
  generateSampleSensorData(n = 5) {
    const types    = Object.keys(OBJECT_TYPES).map(k => k.toLowerCase());
    const dirs     = ['ahead', 'ahead_left', 'ahead_right', 'left', 'right'];
    const samples  = [];

    for (let i = 0; i < n; i++) {
      const t    = types[Math.floor(Math.random() * types.length)];
      const dist = Math.random() * 45 + 3;
      const info = OBJECT_TYPES[t.toUpperCase()] || OBJECT_TYPES.CAR;
      samples.push({
        id:           `gen_${t}_${i}`,
        type:         t,
        x:            parseFloat((Math.random() * 8 - 4).toFixed(1)),
        y:            parseFloat((-dist).toFixed(1)),
        distance:     parseFloat(dist.toFixed(1)),
        speed:        parseFloat((Math.random() * (info.maxSpeed || 40)).toFixed(1)),
        vx:           parseFloat((Math.random() * 2 - 1).toFixed(2)),
        vy:           parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
        direction:    dirs[Math.floor(Math.random() * dirs.length)],
        relative_speed: parseFloat((Math.random() * 30 + 5).toFixed(1)),
      });
    }
    return samples;
  }
}

// Singleton instance
const AI = new IndiDriveAIEngine();
