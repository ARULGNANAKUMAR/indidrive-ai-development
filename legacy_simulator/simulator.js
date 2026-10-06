// ============================================================
// IndiDrive AI Lab — Indian Road Simulator
// Canvas 2D top-down rendering with AI overlays.
// ============================================================

class IndiDriveSimulator {
  constructor(canvasId, aiEngine) {
    this.canvas   = document.getElementById(canvasId);
    this.ctx      = this.canvas.getContext('2d');
    this.ai       = aiEngine;
    this.W        = this.canvas.width;
    this.H        = this.canvas.height;

    // Overlays toggle
    this.showDetection  = true;
    this.showPredictions= true;
    this.showRisk       = true;
    this.showPath       = true;

    // Simulation state
    this._running      = false;
    this._paused       = false;
    this._animId       = null;
    this._lastTS       = 0;
    this._elapsedMs    = 0;
    this._simSpeed     = 1.0;
    this._aiTimer      = 0;

    // Metrics
    this.metrics = {
      collisions: 0, replans: 0, decisions: 0,
      maxRisk: 0, minTTC: 999, elapsed: 0,
    };

    // Road
    this.roadType    = 'URBAN';
    this.roadConfig  = ROAD_TYPES.URBAN;
    this.roadWidth   = this.roadConfig.width * CONFIG.PIXELS_PER_METER;
    this.roadOffset  = 0;   // world scroll offset in pixels

    // Ego vehicle
    this.ego = {
      x:        this.W / 2,  // canvas X
      y:        this.H * 0.80, // canvas Y (fixed — world scrolls)
      worldY:   0,
      speed:    0,            // km/h
      targetSpeed: CONFIG.DEFAULT_SPEED,
      heading:  0,            // degrees offset from straight-ahead
      w:        16, h: 30,    // pixels
      braking:  false,
      steering: 0,
      action:   'IDLE',
      collision: false,
    };

    // Traffic objects pool
    this.objects    = [];
    this.hazards    = [];
    this._oidx      = 0;

    // AI state from last cycle
    this._aiState   = null;

    // Decision log for replay
    this.replayLog  = [];

    this._setupCanvas();
    this._drawIdle();
  }

  _setupCanvas() {
    // Retina / HiDPI
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  // ══════════════════════════════════════════════════════════
  // SCENARIO LOADING
  // ══════════════════════════════════════════════════════════
  loadScenario(scenario) {
    this.currentScenario = scenario;
    const rt = scenario.road_type || 'URBAN';
    this.setRoadType(rt);

    // Speed from scenario
    this.ego.targetSpeed = scenario.vehicle_speed || CONFIG.DEFAULT_SPEED;
    this.ego.speed       = 0;

    this.objects  = [];
    this.hazards  = [];
    this._oidx    = 0;

    // Spawn objects from scenario definition
    if (Array.isArray(scenario.objects)) {
      for (const obj of scenario.objects.slice(0, CONFIG.MAX_OBJECTS)) {
        this._spawnObjectFromDef(obj);
      }
    } else {
      // Auto-generate from params
      this._autoPopulate(scenario.params || scenario);
    }

    // Spawn hazards
    if (Array.isArray(scenario.hazards)) {
      for (const hz of scenario.hazards.slice(0, 30)) {
        this._addHazardFromDef(hz);
      }
    }

    AI.resetSession();
    this._resetMetrics();
  }

  setRoadType(rt) {
    this.roadType   = rt;
    this.roadConfig = ROAD_TYPES[rt] || ROAD_TYPES.URBAN;
    this.roadWidth  = this.roadConfig.width * CONFIG.PIXELS_PER_METER;
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATION CONTROL
  // ══════════════════════════════════════════════════════════
  start() {
    if (this._running) return;
    this._running = true;
    this._paused  = false;
    this._lastTS  = performance.now();
    if (this.objects.length === 0) this._autoPopulate({});
    this._loop(this._lastTS);
  }

  pause() {
    this._paused = !this._paused;
    if (!this._paused) this._loop(performance.now());
  }

  stop() {
    this._running = false;
    this._paused  = false;
    if (this._animId) cancelAnimationFrame(this._animId);
    this._animId = null;
    this._drawIdle();
  }

  reset() {
    this.stop();
    this.ego.speed   = 0;
    this.ego.heading = 0;
    this.ego.action  = 'IDLE';
    this.ego.collision = false;
    this.roadOffset  = 0;
    this.objects     = [];
    this.hazards     = [];
    this.replayLog   = [];
    AI.resetSession();
    this._resetMetrics();
    this._drawIdle();
  }

  setSpeed(mult) {
    this._simSpeed = Math.max(0.1, Math.min(10, mult));
  }

  // ══════════════════════════════════════════════════════════
  // MAIN LOOP
  // ══════════════════════════════════════════════════════════
  _loop(ts) {
    if (!this._running || this._paused) return;
    this._animId = requestAnimationFrame(t => this._loop(t));

    const rawDT = Math.min((ts - this._lastTS) / 1000, 0.1); // cap at 100ms
    this._lastTS = ts;
    const dt = rawDT * this._simSpeed;

    this._update(dt);
    this._render();

    this._elapsedMs += rawDT * 1000 * this._simSpeed;
    this.metrics.elapsed = this._elapsedMs / 1000;
  }

  // ══════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════
  _update(dt) {
    // Run AI every ~200ms sim-time
    this._aiTimer += dt;
    if (this._aiTimer >= 0.20 / this._simSpeed || this._aiTimer >= 0.20) {
      this._aiTimer = 0;
      this._runAI();
    }

    this._updateEgo(dt);
    this._updateObjects(dt);
    this._checkCollisions();
    this._recycleObjects();
    this._autoSpawn();
    this._updateMetrics();
  }

  // ── Ego vehicle physics ──────────────────────────────────
  _updateEgo(dt) {
    const action = this.ego.action;
    const PX_PER_SEC = this.ego.speed * CONFIG.PIXELS_PER_METER / 3.6; // km/h→m/s→px/s

    // Speed control based on action
    const MAX_DEC = CONFIG.MAX_DECELERATION;
    const MAX_ACC = CONFIG.MAX_ACCELERATION;
    const EMG_DEC = CONFIG.EMERGENCY_DECEL;

    switch (action) {
      case 'Continue':        this.ego.speed = this._accelTo(this.ego.speed, this.ego.targetSpeed, MAX_ACC, dt); break;
      case 'Slow Down':       this.ego.speed = this._accelTo(this.ego.speed, this.ego.targetSpeed * 0.55, MAX_ACC * 0.7, dt); break;
      case 'Brake':           this.ego.speed = this._accelTo(this.ego.speed, this.ego.targetSpeed * 0.25, MAX_DEC, dt); break;
      case 'Emergency Brake': this.ego.speed = this._accelTo(this.ego.speed, 0, EMG_DEC, dt); break;
      case 'Stop':            this.ego.speed = this._accelTo(this.ego.speed, 0, EMG_DEC * 0.6, dt); break;
      default:                this.ego.speed = this._accelTo(this.ego.speed, this.ego.targetSpeed, MAX_ACC, dt);
    }

    this.ego.speed = Math.max(0, Math.min(this.ego.speed, CONFIG.MAX_SPEED));

    // Steering
    let targetHeading = 0;
    if (action === 'Steer Left')  targetHeading = -18;
    if (action === 'Steer Right') targetHeading =  18;
    if (action === 'Overtake')    targetHeading = -22;
    if (action === 'Re-route')    targetHeading = -28;

    this.ego.heading += (targetHeading - this.ego.heading) * Math.min(1, dt * 3.5);
    this.ego.heading  = Math.max(-35, Math.min(35, this.ego.heading));

    // Lateral drift from steering
    const STEER_RATE = 60; // px/s at max heading
    this.ego.x += Math.sin(this.ego.heading * Math.PI / 180) * PX_PER_SEC * dt * 0.6;
    this.ego.x  = Math.max(this._roadLeft() + this.ego.w, Math.min(this._roadRight() - this.ego.w, this.ego.x));

    // World scroll — move road offset forward
    this.roadOffset += PX_PER_SEC * dt;
  }

  _accelTo(current, target, rate, dt) {
    const mps2px = rate * CONFIG.PIXELS_PER_METER;
    const delta  = (target - current);
    const change = Math.min(Math.abs(delta), rate * dt * 3.6) * Math.sign(delta);
    return current + change;
  }

  // ── AI cycle ────────────────────────────────────────────
  _runAI() {
    const sensorData = this._generateSensorData();
    const egoState   = {
      speed:          this.ego.speed,
      x:              (this.ego.x - this.W / 2) / CONFIG.PIXELS_PER_METER,
      y:              0,
      heading:        this.ego.heading,
      roadWidth:      this.roadConfig.width,
      roadDamageFactor: 1 + (this.currentScenario?.road_damage || 0) * 0.3,
      visibility:     this.currentScenario?.visibility ?? 1.0,
    };

    const result = this.ai.process(sensorData, egoState);
    this._aiState = result;

    if (result.action && result.action !== 'IDLE') {
      this.ego.action = result.action;
      this.metrics.decisions++;
      if (result.path?.replanning) this.metrics.replans++;

      // Log for replay
      this.replayLog.push({
        ts:        this._elapsedMs,
        ...result,
        egoSpeed:  this.ego.speed,
        egoX:      this.ego.x,
        egoY:      this.ego.y,
      });
      if (this.replayLog.length > 200) this.replayLog.shift();
    }

    this.metrics.maxRisk = Math.max(this.metrics.maxRisk, result.maxRisk || 0);
    if ((result.minTTC || 999) < this.metrics.minTTC) this.metrics.minTTC = result.minTTC;
  }

  // ── Virtual sensor data generation ──────────────────────
  _generateSensorData() {
    const data = [];
    const egoCanX = this.ego.x;
    const egoCanY = this.ego.y;
    const detRange = CONFIG.DETECTION_RANGE * CONFIG.PIXELS_PER_METER;
    const vis      = this.currentScenario?.visibility ?? 1.0;

    for (const obj of this.objects) {
      if (!obj.alive) continue;
      const dx = obj.cx - egoCanX;
      const dy = obj.cy - egoCanY;
      const distPx = Math.hypot(dx, dy);
      if (distPx > detRange * vis * 1.2) continue;

      const distM = distPx / CONFIG.PIXELS_PER_METER;

      // Determine direction
      const angle   = Math.atan2(dx, -dy) * 180 / Math.PI;
      let direction = 'ahead';
      if (dy > 20) direction = 'behind';
      else if (angle < -25)  direction = 'ahead_left';
      else if (angle >  25)  direction = 'ahead_right';
      else if (angle < -50)  direction = 'left';
      else if (angle >  50)  direction = 'right';

      const spdKmh = obj.speed;
      const egoSpd = this.ego.speed;
      const relSpd = Math.abs(spdKmh - egoSpd);

      // Sensor noise
      const noise = (Math.random() - 0.5) * CONFIG.SENSOR_NOISE * distM;

      data.push({
        id:             obj.id,
        type:           obj.type,
        x:              parseFloat(((obj.cx - this.W / 2) / CONFIG.PIXELS_PER_METER).toFixed(2)),
        y:              parseFloat((-(egoCanY - obj.cy) / CONFIG.PIXELS_PER_METER).toFixed(2)),
        distance:       parseFloat((distM + noise).toFixed(2)),
        speed:          spdKmh,
        relative_speed: parseFloat(relSpd.toFixed(1)),
        direction,
        vx:             parseFloat((obj.vx / CONFIG.PIXELS_PER_METER).toFixed(2)),
        vy:             parseFloat((obj.vy / CONFIG.PIXELS_PER_METER).toFixed(2)),
        canvasX:        obj.cx,
        canvasY:        obj.cy,
        w:              obj.pw, h: obj.ph,
        bbox: {
          x: obj.cx - obj.pw / 2,
          y: obj.cy - obj.ph / 2,
          w: obj.pw, h: obj.ph,
        },
      });
    }
    return data;
  }

  // ── Traffic object movement ──────────────────────────────
  _updateObjects(dt) {
    for (const obj of this.objects) {
      if (!obj.alive) continue;
      obj.behaviorTimer += dt;

      // Update behavior
      this._updateBehavior(obj, dt);

      // Move
      const scrollDY = (this.ego.speed * CONFIG.PIXELS_PER_METER / 3.6) * dt;
      obj.cx += obj.vx * dt;
      obj.cy += obj.vy * dt + scrollDY;   // objects scroll down as ego moves

      // Lateral bounce at road edges
      const rl = this._roadLeft()  + obj.pw / 2;
      const rr = this._roadRight() - obj.pw / 2;
      if (obj.cx < rl) { obj.cx = rl; obj.vx = Math.abs(obj.vx); }
      if (obj.cx > rr) { obj.cx = rr; obj.vx = -Math.abs(obj.vx); }
    }
  }

  _updateBehavior(obj, dt) {
    const SCROLL_PX_S = this.ego.speed * CONFIG.PIXELS_PER_METER / 3.6;

    switch (obj.behaviour) {
      case 'NORMAL':
        // Move at own speed (towards ego or away)
        obj.vy = obj.sameDirection
          ? -(obj.speed * CONFIG.PIXELS_PER_METER / 3.6) + SCROLL_PX_S * 0.05
          : (obj.speed * CONFIG.PIXELS_PER_METER / 3.6);
        break;

      case 'SUDDEN_STOP':
        if (obj.behaviorTimer > obj.behaviorDelay) {
          obj.speed = 0;
          obj.vy    = SCROLL_PX_S;
        }
        break;

      case 'SUDDEN_TURN':
        if (obj.behaviorTimer > obj.behaviorDelay) {
          obj.vx = (Math.random() > 0.5 ? 1 : -1) * 40;
          obj.behaviorTimer = 0;
          obj.behaviorDelay = 1 + Math.random() * 2;
          obj.behaviour = 'NORMAL';
        }
        break;

      case 'LANE_CHANGE':
        if (obj.behaviorTimer > obj.behaviorDelay) {
          obj.vx = (Math.random() > 0.5 ? 1 : -1) * 25;
          obj.behaviorTimer = 0;
          obj.behaviorDelay = 2 + Math.random() * 3;
        }
        if (Math.random() < 0.02) obj.vx *= 0.9;
        break;

      case 'WRONG_SIDE':
        obj.vx = (obj.cx > this.W / 2 ? -1 : 1) * 10;
        obj.vy = (obj.speed * CONFIG.PIXELS_PER_METER / 3.6);
        break;

      case 'RANDOM_CROSSING':
        if (obj.behaviorTimer > obj.behaviorDelay) {
          obj.vx = (Math.random() > 0.5 ? 1 : -1) * (obj.speed * CONFIG.PIXELS_PER_METER / 3.6);
          obj.vy = SCROLL_PX_S * 0.5;
          obj.behaviorTimer = 0;
          obj.behaviorDelay = 0.5 + Math.random();
        }
        break;

      case 'CATTLE_CROSSING':
        // Slow, erratic lateral drift
        if (Math.random() < 0.03) obj.vx = (Math.random() - 0.5) * 30;
        obj.vy = SCROLL_PX_S * 0.9;
        break;

      default:
        obj.vy = SCROLL_PX_S;
    }
  }

  // ── Collision detection ──────────────────────────────────
  _checkCollisions() {
    const ex = this.ego.x, ey = this.ego.y;
    const ew = this.ego.w, eh = this.ego.h;

    for (const obj of this.objects) {
      if (!obj.alive) continue;
      const overlap = !(
        obj.cx + obj.pw / 2 < ex - ew / 2 ||
        obj.cx - obj.pw / 2 > ex + ew / 2 ||
        obj.cy + obj.ph / 2 < ey - eh / 2 ||
        obj.cy - obj.ph / 2 > ey + eh / 2
      );
      if (overlap) {
        if (!this.ego.collision) {
          this.ego.collision = true;
          this.metrics.collisions++;
          this.ego.action = 'Emergency Brake';
          setTimeout(() => { this.ego.collision = false; }, 1500);
        }
      }
    }
  }

  // ── Object lifecycle ─────────────────────────────────────
  _recycleObjects() {
    for (const obj of this.objects) {
      // Recycle if gone far below canvas
      if (obj.cy > this.H + 80) {
        obj.cy = -80 - Math.random() * 200;
        obj.cx = this._roadLeft() + (Math.random() * this.roadWidth);
        this._resetBehavior(obj);
      }
    }
  }

  _autoSpawn() {
    const density = this.currentScenario?.params?.traffic_density
                 ?? this.currentScenario?.traffic_density ?? 0.5;
    const target  = Math.floor(density * 12) + 2;
    while (this.objects.length < target && this.objects.length < CONFIG.MAX_OBJECTS) {
      this._spawnRandom();
    }
  }

  // ══════════════════════════════════════════════════════════
  // RENDERING
  // ══════════════════════════════════════════════════════════
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    this._drawBackground();
    this._drawRoad();
    this._drawHazards();
    this._drawEnvironmentObjects();

    // AI overlays (below vehicles)
    if (this.showRisk && this._aiState) this._drawRiskZones();
    if (this.showPath && this._aiState) this._drawPath();

    this._drawTrafficObjects();
    this._drawEgoVehicle();

    // AI overlays (above vehicles)
    if (this.showDetection  && this._aiState) this._drawDetectionBoxes();
    if (this.showPredictions && this._aiState) this._drawPredictions();

    this._drawHazardWarnings();
    this._drawCollisionFlash();
  }

  // ── Background ───────────────────────────────────────────
  _drawBackground() {
    const ctx = this.ctx;
    const rl  = this._roadLeft();
    const rr  = this._roadRight();

    // Sky
    ctx.fillStyle = '#0a0f1e';
    ctx.fillRect(0, 0, this.W, this.H);

    // Terrain left/right of road
    const terrainColor = this._getTerrainColor();
    ctx.fillStyle = terrainColor;
    ctx.fillRect(0, 0, rl, this.H);
    ctx.fillRect(rr, 0, this.W - rr, this.H);

    // Road shoulder strips
    ctx.fillStyle = '#c9b88a';
    ctx.fillRect(rl - 6, 0, 6, this.H);
    ctx.fillRect(rr, 0, 6, this.H);
  }

  // ── Road ─────────────────────────────────────────────────
  _drawRoad() {
    const ctx = this.ctx;
    const rl  = this._roadLeft();
    const rr  = this._roadRight();
    const W   = this.roadWidth;

    // Road surface
    ctx.fillStyle = this._getRoadSurfaceColor();
    ctx.fillRect(rl, 0, W, this.H);

    // Road damage overlay
    const damage = this.currentScenario?.road_damage || this.currentScenario?.params?.road_damage || 0;
    if (damage > 0.2) {
      ctx.fillStyle = `rgba(40,25,10,${damage * 0.35})`;
      ctx.fillRect(rl, 0, W, this.H);
    }

    // Lane markings
    this._drawLaneMarkings(rl, rr);

    // Road edges
    ctx.strokeStyle = '#e8d870';
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.moveTo(rl, 0); ctx.lineTo(rl, this.H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rr, 0); ctx.lineTo(rr, this.H); ctx.stroke();
  }

  _drawLaneMarkings(rl, rr) {
    const ctx = this.ctx;
    const W   = rr - rl;
    const isUnmarked = this.roadType === 'UNMARKED' || this.roadType === 'VILLAGE';

    if (isUnmarked) return;

    const lanes = this.roadConfig.lanes || 2;
    const laneW = W / lanes;

    for (let l = 1; l < lanes; l++) {
      const lx = rl + l * laneW;
      ctx.setLineDash([22, 14]);
      ctx.strokeStyle = (lanes > 2 && l === lanes / 2) ? '#ffffff' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth   = (lanes > 2 && l === lanes / 2) ? 2.5 : 1.5;
      ctx.beginPath();
      const dashOff = (this.roadOffset * 1.2) % 36;
      ctx.lineDashOffset = dashOff;
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, this.H);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // ── Road hazards ─────────────────────────────────────────
  _drawHazards() {
    const ctx = this.ctx;
    for (const hz of this.hazards) {
      const cx = hz.cx, cy = hz.cy;
      const def = HAZARD_TYPES[hz.type.toUpperCase()] || HAZARD_TYPES.POTHOLE;
      const w   = def.size[0] * CONFIG.PIXELS_PER_METER;
      const h   = def.size[1] * CONFIG.PIXELS_PER_METER;

      switch (hz.type.toLowerCase()) {
        case 'pothole':
          ctx.beginPath();
          ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
          ctx.fillStyle = def.color;
          ctx.fill();
          ctx.strokeStyle = '#3a2010'; ctx.lineWidth = 1;
          ctx.stroke();
          break;

        case 'rock': case 'fallen_rocks':
          ctx.beginPath();
          ctx.moveTo(cx - w/2, cy + h/2);
          ctx.lineTo(cx, cy - h/2);
          ctx.lineTo(cx + w/2, cy + h/2);
          ctx.closePath();
          ctx.fillStyle = def.color; ctx.fill();
          break;

        case 'waterlogging':
          ctx.fillStyle = 'rgba(20,80,160,0.55)';
          ctx.fillRect(cx - w/2, cy - h/2, w, h);
          ctx.strokeStyle = 'rgba(80,140,220,0.4)'; ctx.lineWidth = 1;
          ctx.strokeRect(cx - w/2, cy - h/2, w, h);
          break;

        case 'speed_breaker':
          ctx.fillStyle = '#ffe000';
          ctx.fillRect(cx - w/2, cy - h/2, w, h);
          ctx.fillStyle = '#111';
          for (let sx = cx - w/2 + 6; sx < cx + w/2 - 4; sx += 14) {
            ctx.fillRect(sx, cy - h/2, 6, h);
          }
          break;

        case 'manhole':
          ctx.beginPath();
          ctx.arc(cx, cy, w/2, 0, Math.PI * 2);
          ctx.fillStyle = '#0a0a0a'; ctx.fill();
          ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.stroke();
          break;

        default:
          ctx.fillStyle = def.color;
          ctx.fillRect(cx - w/2, cy - h/2, w, h);
      }

      // Warning label for hazards
      ctx.font      = '8px Consolas';
      ctx.fillStyle = '#ffaa00';
      ctx.textAlign = 'center';
      ctx.fillText(def.label.slice(0, 8).toUpperCase(), cx, cy - h/2 - 3);
    }
  }

  // ── Environment decorations ──────────────────────────────
  _drawEnvironmentObjects() {
    const ctx   = this.ctx;
    const rl    = this._roadLeft();
    const rr    = this._roadRight();
    const trees = this._getTreePositions();

    for (const tr of trees) {
      const ty = ((tr.y + this.roadOffset * 0.4) % (this.H + 80)) - 40;

      if (tr.side === 'left' && tr.x < rl - 8) {
        ctx.fillStyle = '#1a5c1a';
        ctx.beginPath(); ctx.arc(tr.x, ty, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(tr.x - 2, ty + 4, 4, 14);
      } else if (tr.side === 'right' && tr.x > rr + 8) {
        ctx.fillStyle = tr.isBuilding ? '#1e293b' : '#1a5c1a';
        if (tr.isBuilding) {
          ctx.fillRect(tr.x - 10, ty - 18, 22, 30);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(tr.x - 6, ty - 14, 5, 6);
          ctx.fillRect(tr.x + 3, ty - 14, 5, 6);
        } else {
          ctx.beginPath(); ctx.arc(tr.x, ty, 12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#6b4226';
          ctx.fillRect(tr.x - 2, ty + 4, 4, 14);
        }
      }
    }

    // Electric poles along road edge
    const poleSpacing = 120;
    for (let py = (this.roadOffset % poleSpacing) - 20; py < this.H + 20; py += poleSpacing) {
      ctx.strokeStyle = '#8a7060';
      ctx.lineWidth   = 2;
      ctx.beginPath(); ctx.moveTo(rl - 12, py); ctx.lineTo(rl - 12, py + 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rl - 5,  py); ctx.lineTo(rl + 5,  py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rr + 12, py); ctx.lineTo(rr + 12, py + 40); ctx.stroke();
    }
  }

  // ── Traffic objects ──────────────────────────────────────
  _drawTrafficObjects() {
    const ctx = this.ctx;
    for (const obj of this.objects) {
      if (!obj.alive) continue;
      const info = OBJECT_TYPES[obj.type.toUpperCase()] || OBJECT_TYPES.CAR;
      ctx.save();
      ctx.translate(obj.cx, obj.cy);

      // Draw body
      const r = this.ctx;
      ctx.fillStyle = info.color;
      ctx.fillRect(-obj.pw / 2, -obj.ph / 2, obj.pw, obj.ph);

      // Windshield highlight
      ctx.fillStyle = 'rgba(200,230,255,0.3)';
      ctx.fillRect(-obj.pw / 2 + 2, -obj.ph / 2 + 2, obj.pw - 4, obj.ph * 0.3);

      // Lights
      ctx.fillStyle = obj.sameDirection ? '#ff4444' : '#ffff88';
      ctx.fillRect(-obj.pw / 2 + 1, -obj.ph / 2 + 1, 3, 3);
      ctx.fillRect(obj.pw / 2 - 4, -obj.ph / 2 + 1, 3, 3);

      // Label
      ctx.font      = '7px Consolas';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText(info.label.slice(0, 5), 0, -obj.ph / 2 - 4);

      // Speed badge for fast movers
      if (obj.speed > 50) {
        ctx.font      = '6px Consolas';
        ctx.fillStyle = '#ff6600';
        ctx.fillText(`${obj.speed.toFixed(0)}`, 0, obj.ph / 2 + 10);
      }

      ctx.restore();
    }
  }

  // ── Ego vehicle ──────────────────────────────────────────
  _drawEgoVehicle() {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(this.ego.x, this.ego.y);
    ctx.rotate(this.ego.heading * Math.PI / 180);

    const w = this.ego.w, h = this.ego.h;

    // Body gradient (blue → cyan)
    const grad = ctx.createLinearGradient(-w/2, -h/2, w/2, h/2);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(1, '#0ea5e9');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(-w/2, -h/2, w, h, 4);
    ctx.fill();

    // Roof
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-w/2 + 2, -h/2 + 4, w - 4, h * 0.4);

    // Lights
    ctx.fillStyle = '#00ffff';
    ctx.fillRect(-w/2 + 1, -h/2 + 1, 4, 3);
    ctx.fillRect(w/2 - 5,  -h/2 + 1, 4, 3);

    // Brake lights
    if (this.ego.action === 'Brake' || this.ego.action === 'Emergency Brake') {
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(-w/2 + 1, h/2 - 4, 4, 3);
      ctx.fillRect(w/2 - 5,  h/2 - 4, 4, 3);
    }

    // Collision flash
    if (this.ego.collision) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.roundRect(-w/2 - 2, -h/2 - 2, w + 4, h + 4, 5);
      ctx.stroke();
    }

    // Glow ring for ego
    const glow = ctx.createRadialGradient(0, 0, 5, 0, 0, 30);
    glow.addColorStop(0, 'rgba(14,165,233,0.25)');
    glow.addColorStop(1, 'rgba(14,165,233,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.fill();

    // Label
    ctx.font      = '8px Consolas';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'center';
    ctx.fillText('EGO', 0, h / 2 + 12);

    ctx.restore();
  }

  // ── AI Detection boxes ───────────────────────────────────
  _drawDetectionBoxes() {
    if (!this._aiState?.detections) return;
    const ctx = this.ctx;

    for (const det of this._aiState.detections) {
      const obj = this.objects.find(o => o.id === det.id);
      if (!obj || !obj.alive) continue;
      const risk = this._aiState.risks.find(r => r.id === det.id);
      const rl   = getRiskLevel(risk?.risk_score || 0);

      ctx.save();
      ctx.strokeStyle = rl.color;
      ctx.lineWidth   = 1.5;
      ctx.shadowColor = rl.color;
      ctx.shadowBlur  = 6;
      ctx.strokeRect(obj.cx - obj.pw/2 - 3, obj.cy - obj.ph/2 - 3, obj.pw + 6, obj.ph + 6);
      ctx.shadowBlur = 0;

      // Label box
      const label = `${det.type.toUpperCase()} ${(det.confidence * 100).toFixed(0)}%`;
      const bw    = label.length * 5.5 + 8;
      ctx.fillStyle = `rgba(${this._hexToRGBStr(rl.color)}, 0.85)`;
      ctx.fillRect(obj.cx - obj.pw/2 - 3, obj.cy - obj.ph/2 - 17, bw, 14);
      ctx.font      = 'bold 8px Consolas';
      ctx.fillStyle = '#000';
      ctx.textAlign = 'left';
      ctx.fillText(label, obj.cx - obj.pw/2, obj.cy - obj.ph/2 - 7);

      // Risk badge
      if (risk) {
        ctx.font      = '7px Consolas';
        ctx.fillStyle = rl.color;
        ctx.textAlign = 'center';
        ctx.fillText(`${rl.label} ${det.distance.toFixed(1)}m`, obj.cx, obj.cy + obj.ph/2 + 11);
      }
      ctx.restore();
    }
  }

  // ── Predicted trajectories ───────────────────────────────
  _drawPredictions() {
    if (!this._aiState?.predictions) return;
    const ctx = this.ctx;

    for (const pred of this._aiState.predictions) {
      const obj = this.objects.find(o => o.id === pred.id);
      if (!obj || !obj.alive || !pred.trajectory?.length) continue;

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,200,0,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(obj.cx, obj.cy);

      for (const pt of pred.trajectory) {
        const px = this.ego.x + pt.x * CONFIG.PIXELS_PER_METER;
        const py = this.ego.y - pt.y * CONFIG.PIXELS_PER_METER;
        ctx.lineTo(px, py);

        // Dot at each time step
        ctx.save();
        ctx.setLineDash([]);
        const alpha = Math.max(0.2, pt.confidence);
        ctx.fillStyle = `rgba(255,200,0,${alpha})`;
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Risk zones ───────────────────────────────────────────
  _drawRiskZones() {
    if (!this._aiState?.risks) return;
    const ctx = this.ctx;

    for (const risk of this._aiState.risks) {
      if (risk.risk_score < 0.20) continue;
      const obj = this.objects.find(o => o.id === risk.id);
      if (!obj || !obj.alive) continue;

      const rl = getRiskLevel(risk.risk_score);
      const r  = Math.max(20, risk.distance * CONFIG.PIXELS_PER_METER * 0.5);

      ctx.save();
      const grad = ctx.createRadialGradient(obj.cx, obj.cy, 4, obj.cx, obj.cy, r);
      grad.addColorStop(0, `rgba(${this._hexToRGBStr(rl.color)}, 0.25)`);
      grad.addColorStop(1, `rgba(${this._hexToRGBStr(rl.color)}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(obj.cx, obj.cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── Planned path ─────────────────────────────────────────
  _drawPath() {
    if (!this._aiState?.path?.selected) return;
    const ctx  = this.ctx;
    const path = this._aiState.path;

    // Draw all candidate paths (faint)
    for (const p of (path.all || [])) {
      if (p === path.selected) continue;
      ctx.save();
      ctx.setLineDash([3, 8]);
      ctx.strokeStyle = 'rgba(100,100,100,0.25)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      for (let i = 0; i < p.waypoints.length; i++) {
        const wp = p.waypoints[i];
        const wx = this.ego.x + wp.x * CONFIG.PIXELS_PER_METER;
        const wy = this.ego.y - wp.y * CONFIG.PIXELS_PER_METER;
        i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Draw selected path
    const sel = path.selected;
    const color = sel.status === 'safe' ? '#10b981' : sel.status === 'warning' ? '#f59e0b' : '#ef4444';

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();

    for (let i = 0; i < sel.waypoints.length; i++) {
      const wp = sel.waypoints[i];
      const wx = this.ego.x + wp.x * CONFIG.PIXELS_PER_METER;
      const wy = this.ego.y - wp.y * CONFIG.PIXELS_PER_METER;
      i === 0 ? ctx.moveTo(wx, wy) : ctx.lineTo(wx, wy);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Waypoint dots
    ctx.setLineDash([]);
    for (const wp of sel.waypoints) {
      const wx = this.ego.x + wp.x * CONFIG.PIXELS_PER_METER;
      const wy = this.ego.y - wp.y * CONFIG.PIXELS_PER_METER;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(wx, wy, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // Path label
    ctx.font      = '9px Consolas';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    const firstWP = sel.waypoints[sel.waypoints.length - 1];
    if (firstWP) {
      const fx = this.ego.x + firstWP.x * CONFIG.PIXELS_PER_METER;
      const fy = this.ego.y - firstWP.y * CONFIG.PIXELS_PER_METER;
      ctx.fillText(`PATH [${sel.status.toUpperCase()}]`, fx, fy - 8);
    }

    ctx.restore();
  }

  // ── Hazard warnings ──────────────────────────────────────
  _drawHazardWarnings() {
    const ctx = this.ctx;
    for (const hz of this.hazards) {
      const distPx = Math.abs(hz.cy - this.ego.y);
      if (distPx < 80) {
        ctx.font      = 'bold 10px Consolas';
        ctx.fillStyle = '#f59e0b';
        ctx.textAlign = 'center';
        ctx.fillText(`⚠ ${hz.type.toUpperCase()}`, hz.cx, hz.cy - 12);
      }
    }
  }

  // ── Collision flash ───────────────────────────────────────
  _drawCollisionFlash() {
    if (!this.ego.collision) return;
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,0,0,${0.15 + 0.1 * Math.sin(Date.now() / 80)})`;
    ctx.fillRect(0, 0, this.W, this.H);
    ctx.font      = 'bold 22px Consolas';
    ctx.fillStyle = '#ff4444';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ COLLISION DETECTED', this.W / 2, this.H / 2);
  }

  // ── Idle screen ───────────────────────────────────────────
  _drawIdle() {
    const ctx = this.ctx;
    ctx.fillStyle = '#080d18';
    ctx.fillRect(0, 0, this.W, this.H);

    // Draw static road
    const rl = this._roadLeft(), rr = this._roadRight();
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(rl, 0, this.roadWidth, this.H);
    ctx.strokeStyle = '#e8d870'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rl, 0); ctx.lineTo(rl, this.H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rr, 0); ctx.lineTo(rr, this.H); ctx.stroke();

    // Idle message
    ctx.font      = 'bold 16px Consolas';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('IndiDrive AI Lab — Simulator', this.W / 2, this.H / 2 - 24);
    ctx.font      = '12px Consolas';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Select a scenario and press Start to begin simulation.', this.W / 2, this.H / 2 + 4);
    ctx.font      = '10px Consolas';
    ctx.fillStyle = '#78350f';
    ctx.fillText('SIMULATION ENVIRONMENT — Not for real-world vehicle control', this.W / 2, this.H - 14);
  }

  // ══════════════════════════════════════════════════════════
  // OBJECT SPAWNING
  // ══════════════════════════════════════════════════════════
  spawnObject(type, cx, cy) {
    const info    = OBJECT_TYPES[(type || 'CAR').toUpperCase()] || OBJECT_TYPES.CAR;
    const pw      = info.w * CONFIG.PIXELS_PER_METER;
    const ph      = info.h * CONFIG.PIXELS_PER_METER;
    const speed   = Math.random() * (info.maxSpeed * 0.6) + 5;
    const beh     = this._randomBehavior(type, this.currentScenario);
    const sameDir = Math.random() > 0.4;
    const id      = `${type}_inj_${++this._oidx}`;

    this.objects.push({ id, type, cx: cx || this.W/2, cy: cy || 80, pw, ph, speed, vx: 0, vy: speed*CONFIG.PIXELS_PER_METER/3.6, behaviour: beh, sameDirection: sameDir, alive: true, behaviorTimer: 0, behaviorDelay: 1 + Math.random() * 2 });
    return id;
  }

  addHazard(type, cx, cy) {
    const def = HAZARD_TYPES[(type || 'POTHOLE').toUpperCase()] || HAZARD_TYPES.POTHOLE;
    this.hazards.push({ type, cx: cx || this.W/2, cy: cy || this.ego.y - 80, size: def.size });
  }

  _spawnRandom() {
    const types  = Object.keys(OBJECT_TYPES).map(k => k.toLowerCase());
    const anProb = this.currentScenario?.params?.animal_probability ?? this.currentScenario?.animal_probability ?? 0.1;
    let type = types[Math.floor(Math.random() * types.length)];
    if (Math.random() < anProb) type = Math.random() < 0.5 ? 'cattle' : 'pedestrian';

    const x = this._roadLeft() + Math.random() * this.roadWidth;
    const y = -50 - Math.random() * 150;
    this.spawnObject(type, x, y);
  }

  _spawnObjectFromDef(def) {
    const type = (def.type || 'car').toLowerCase();
    const info = OBJECT_TYPES[type.toUpperCase()] || OBJECT_TYPES.CAR;
    const pw   = info.w * CONFIG.PIXELS_PER_METER;
    const ph   = info.h * CONFIG.PIXELS_PER_METER;
    const cx   = this.W/2 + (def.x || 0) * CONFIG.PIXELS_PER_METER;
    const cy   = this.ego.y + (def.y || -60) * CONFIG.PIXELS_PER_METER;
    const beh  = (def.behaviour || 'NORMAL').toUpperCase().replace(/ /g, '_');
    const sDir = Math.random() > 0.4;
    const id   = def.id || `${type}_${++this._oidx}`;

    this.objects.push({ id, type, cx, cy, pw, ph, speed: def.speed || 20, vx: 0, vy: 0, behaviour: beh, sameDirection: sDir, alive: true, behaviorTimer: 0, behaviorDelay: 1 + Math.random() * 2 });
  }

  _addHazardFromDef(def) {
    const type = (def.type || 'POTHOLE').toUpperCase();
    const d    = HAZARD_TYPES[type] || HAZARD_TYPES.POTHOLE;
    const cx   = this.W/2 + (def.x || 0) * CONFIG.PIXELS_PER_METER;
    const cy   = this.ego.y + (def.y || -40) * CONFIG.PIXELS_PER_METER;
    this.hazards.push({ type, cx, cy, size: d.size });
  }

  _autoPopulate(p) {
    const density = p.traffic_density ?? 0.5;
    const n = Math.floor(density * 10) + 2;
    for (let i = 0; i < n; i++) this._spawnRandom();
    if (p.road_damage > 0.3) {
      const nh = Math.floor(p.road_damage * 6);
      const types = ['POTHOLE','CRACK','GRAVEL','MUD'];
      for (let i = 0; i < nh; i++) {
        const x = this._roadLeft() + Math.random() * this.roadWidth;
        const y = this.ego.y - (60 + Math.random() * 200);
        this.addHazard(types[Math.floor(Math.random() * types.length)], x, y);
      }
    }
  }

  _resetBehavior(obj) {
    obj.behaviorTimer = 0;
    obj.behaviorDelay = 1 + Math.random() * 2;
    obj.vx = 0;
    obj.vy = 0;
  }

  _randomBehavior(type, scenario) {
    const unp = scenario?.params?.unpredictability ?? scenario?.unpredictability ?? 0.5;
    const std = ['NORMAL','SLOW','NORMAL','NORMAL'];
    const extra = ['SUDDEN_STOP','SUDDEN_TURN','LANE_CHANGE','RANDOM_CROSSING'];
    if (type === 'cattle') return 'CATTLE_CROSSING';
    if (type === 'pedestrian') return Math.random() < unp ? 'RANDOM_CROSSING' : 'PEDESTRIAN_CROSS';
    return Math.random() < unp ? extra[Math.floor(Math.random() * extra.length)] : std[Math.floor(Math.random() * std.length)];
  }

  // ══════════════════════════════════════════════════════════
  // UTILITY
  // ══════════════════════════════════════════════════════════
  _roadLeft()  { return (this.W - this.roadWidth) / 2; }
  _roadRight() { return (this.W + this.roadWidth) / 2; }

  _getRoadSurfaceColor() {
    const d = this.currentScenario?.road_damage ?? this.currentScenario?.params?.road_damage ?? 0;
    if (d > 0.7) return '#3a2a1a';
    if (d > 0.4) return '#3d3328';
    return '#2d2d2d';
  }

  _getTerrainColor() {
    const rt = this.roadType;
    if (rt === 'HIGHWAY')  return '#1a3a1a';
    if (rt === 'MOUNTAIN') return '#4a4040';
    if (rt === 'VILLAGE')  return '#2a4a1a';
    return '#1a3a20';
  }

  _getTreePositions() {
    const positions = [];
    const rl = this._roadLeft(), rr = this._roadRight();
    for (let i = 0; i < 8; i++) {
      positions.push({ x: rl - 18 - Math.sin(i * 3.7) * 20, y: i * 88, side: 'left', isBuilding: false });
      const isB = this.roadType === 'URBAN' && Math.random() > 0.5;
      positions.push({ x: rr + 16 + Math.sin(i * 2.9) * 18, y: i * 95, side: 'right', isBuilding: isB });
    }
    return positions;
  }

  _hexToRGBStr(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r},${g},${b}`;
  }

  _resetMetrics() {
    this.metrics = { collisions: 0, replans: 0, decisions: 0, maxRisk: 0, minTTC: 999, elapsed: 0 };
    this.replayLog = [];
  }

  _updateMetrics() {
    const ai = this._aiState;
    if (!ai) return;
    if (ai.maxRisk > this.metrics.maxRisk) this.metrics.maxRisk = ai.maxRisk;
    if ((ai.minTTC || 999) < this.metrics.minTTC) this.metrics.minTTC = ai.minTTC;
  }

  getMetrics() {
    return {
      ...this.metrics,
      objects: this.objects.filter(o => o.alive).length,
      hazards: this.hazards.length,
      speed:   this.ego.speed,
      action:  this.ego.action,
    };
  }

  getSensorDataSnapshot() { return this._generateSensorData(); }
  getAIState()            { return this._aiState; }
}

// Simulator instance — created by app.js after DOM load
let SIM = null;
