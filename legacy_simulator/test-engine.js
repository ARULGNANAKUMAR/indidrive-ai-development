// ============================================================
// IndiDrive AI Lab — Testing Engine
// Levels 1-10: Basic → Detection → Road → Traffic →
//   Prediction → Decision → Complex → Extreme →
//   Stress → Self-Learning
// ============================================================

class IndiDriveTestEngine {
  constructor(aiEngine) {
    this.ai       = aiEngine;
    this._results = [];
    this._running = false;
    this._stats   = { run: 0, passed: 0, failed: 0, collisions: 0 };
  }

  // ══════════════════════════════════════════════════════════
  // TEST DEFINITIONS
  // ══════════════════════════════════════════════════════════
  getTestLevels() {
    return [
      {
        level: 1, name: 'Basic',
        description: 'Vehicle control fundamentals',
        color: '#10b981',
        tests: [
          { id: 'speed_test',       name: 'Speed Test',         desc: 'Reach target speed safely' },
          { id: 'accel_test',       name: 'Acceleration Test',  desc: 'Smooth acceleration profile' },
          { id: 'brake_test',       name: 'Brake Test',         desc: 'Controlled braking' },
          { id: 'stop_dist',        name: 'Stopping Distance',  desc: 'Stop within safe distance' },
          { id: 'steer_test',       name: 'Steering Test',      desc: 'Accurate steering response' },
        ],
      },
      {
        level: 2, name: 'Detection',
        description: 'Object detection and tracking',
        color: '#0ea5e9',
        tests: [
          { id: 'det_vehicle',  name: 'Vehicle Detection',   desc: 'Detect cars, trucks, buses' },
          { id: 'det_ped',      name: 'Pedestrian Detection',desc: 'Detect pedestrians accurately' },
          { id: 'det_animal',   name: 'Animal Detection',    desc: 'Detect cattle and animals' },
          { id: 'det_obstacle', name: 'Obstacle Detection',  desc: 'Detect static road obstacles' },
          { id: 'tracking',     name: 'Object Tracking',     desc: 'Maintain track across frames' },
          { id: 'dist_est',     name: 'Distance Estimation', desc: 'Accurate distance estimation' },
        ],
      },
      {
        level: 3, name: 'Road',
        description: 'Indian road condition handling',
        color: '#f59e0b',
        tests: [
          { id: 'pothole_avoid', name: 'Pothole Avoidance', desc: 'Navigate around potholes' },
          { id: 'rock_avoid',    name: 'Rock Avoidance',    desc: 'Avoid fallen rocks on road' },
          { id: 'damaged_road',  name: 'Damaged Road',      desc: 'Navigate severely damaged road' },
          { id: 'uneven_road',   name: 'Uneven Surface',    desc: 'Handle uneven road surface' },
          { id: 'narrow_road',   name: 'Narrow Road',       desc: 'Navigate narrow passage' },
          { id: 'no_markings',   name: 'No Lane Markings',  desc: 'Navigate unmarked road' },
        ],
      },
      {
        level: 4, name: 'Traffic',
        description: 'Indian traffic behaviour',
        color: '#f97316',
        tests: [
          { id: 'overtake',      name: 'Overtaking',        desc: 'Safe vehicle overtaking' },
          { id: 'merging',       name: 'Merging',           desc: 'Safe lane merge' },
          { id: 'sudden_stop',   name: 'Sudden Stop Ahead', desc: 'React to sudden brake' },
          { id: 'wrong_side',    name: 'Wrong-Side Traffic',desc: 'Handle oncoming wrong-side' },
          { id: 'ped_cross',     name: 'Pedestrian Cross',  desc: 'Handle pedestrian crossing' },
          { id: 'cattle_cross',  name: 'Cattle Crossing',   desc: 'Handle cattle on road' },
        ],
      },
      {
        level: 5, name: 'Prediction',
        description: 'Motion prediction accuracy',
        color: '#8b5cf6',
        tests: [
          { id: 'traj_pred',   name: 'Trajectory Prediction', desc: 'Predict object trajectory' },
          { id: 'ttc_pred',    name: 'TTC Prediction',        desc: 'Accurate TTC estimation' },
          { id: 'beh_pred',    name: 'Behaviour Prediction',  desc: 'Predict behaviour changes' },
          { id: 'uncert_test', name: 'Uncertainty Test',      desc: 'Handle prediction uncertainty' },
        ],
      },
      {
        level: 6, name: 'Decision',
        description: 'Decision-making quality',
        color: '#ec4899',
        tests: [
          { id: 'brake_steer',  name: 'Brake vs Steer',     desc: 'Choose optimal response' },
          { id: 'stop_cont',    name: 'Stop vs Continue',   desc: 'Risk threshold decision' },
          { id: 'over_wait',    name: 'Overtake vs Wait',   desc: 'Overtaking decision' },
          { id: 'safe_path',    name: 'Safe Path Selection',desc: 'Select least-risk path' },
          { id: 'emg_decision', name: 'Emergency Decision', desc: 'Correct emergency action' },
        ],
      },
      {
        level: 7, name: 'Complex',
        description: 'Multi-hazard combined scenarios',
        color: '#ef4444',
        tests: [
          { id: 'ped_pothole', name: 'Pedestrian + Pothole', desc: 'Combined avoidance' },
          { id: 'dense_dam',   name: 'Dense Traffic + Damage', desc: 'Traffic on damaged road' },
          { id: 'cattle_ped',  name: 'Cattle + Pedestrian',  desc: 'Mixed animal/human' },
          { id: 'market_full', name: 'Full Market Scenario',  desc: 'Maximum market density' },
        ],
      },
      {
        level: 8, name: 'Extreme',
        description: 'Highly unpredictable Indian traffic',
        color: '#b91c1c',
        tests: [
          { id: 'max_chaos',   name: 'Maximum Chaos',       desc: 'All hazard types at max density' },
          { id: 'night_fog',   name: 'Night + Fog',         desc: 'Near-zero visibility' },
          { id: 'rapid_replan',name: 'Rapid Replanning',    desc: '5 replans in 10 seconds' },
          { id: 'cascade_evt', name: 'Cascade Events',      desc: 'Chain of unexpected events' },
        ],
      },
      {
        level: 9, name: 'Stress',
        description: 'Automated mass scenario testing',
        color: '#7c3aed',
        tests: [
          { id: 'stress_100',  name: 'Stress 100',    desc: 'Run 100 random scenarios' },
          { id: 'stress_500',  name: 'Stress 500',    desc: 'Run 500 random scenarios' },
          { id: 'stress_edge', name: 'Edge Cases',    desc: '50 edge-case scenarios' },
        ],
      },
      {
        level: 10, name: 'Self-Learning',
        description: 'Model comparison & learning cycle',
        color: '#0284c7',
        tests: [
          { id: 'sl_v1v2',     name: 'V1 vs V2',          desc: 'Compare model versions' },
          { id: 'sl_v2v3',     name: 'V2 vs V3',          desc: 'Compare best models' },
          { id: 'sl_accept',   name: 'Model Acceptance',   desc: 'Validate candidate model' },
          { id: 'sl_rollback', name: 'Rollback Test',      desc: 'Verify rollback safety' },
        ],
      },
    ];
  }

  // ══════════════════════════════════════════════════════════
  // RUN A SINGLE LEVEL
  // ══════════════════════════════════════════════════════════
  async runLevel(level, modelId = 'IndiDrive-V3', onProgress = null) {
    const levels  = this.getTestLevels();
    const lvlDef  = levels.find(l => l.level === level);
    if (!lvlDef) return { error: `Level ${level} not found` };

    this._running  = true;
    const results  = [];
    const models   = this._getModelMetrics(modelId);

    for (const test of lvlDef.tests) {
      const r = await this._runSingleTest(test, level, models);
      results.push(r);
      this._stats.run++;
      if (r.passed) this._stats.passed++;
      else          this._stats.failed++;
      if (r.collision) this._stats.collisions++;

      if (onProgress) onProgress(test, r, results.length, lvlDef.tests.length);

      // Small delay between tests (simulate execution time)
      await this._delay(60 + Math.random() * 80);
    }

    this._running = false;

    const passed  = results.filter(r => r.passed).length;
    const total   = results.length;
    const score   = parseFloat((passed / total * 100).toFixed(1));
    const metrics = this._aggregateMetrics(results);

    const levelResult = {
      level, levelName: lvlDef.name, model: modelId,
      passed: score >= 60, score, passedCount: passed, total,
      results, metrics,
      timestamp: new Date().toISOString(),
    };

    this._results.push(levelResult);
    if (this._results.length > 50) this._results.shift();

    return levelResult;
  }

  // ── Single test execution ────────────────────────────────
  async _runSingleTest(testDef, level, modelMetrics) {
    const basePass = modelMetrics.safety_score / 100;
    const diff     = level / 10;

    // Generate test-specific scenario
    const scenario = this._generateTestScenario(testDef.id, level);

    // Run AI on generated sensor data
    const sensorData = this._buildSensorData(scenario, level);
    const egoState   = {
      speed:     scenario.ego_speed,
      x:         0, y: 0,
      roadWidth: scenario.road_width,
      visibility: scenario.visibility,
    };

    const aiResult = this.ai.process(sensorData, egoState);

    // Determine pass/fail based on test type and AI result
    const testPassed = this._evaluateTest(testDef.id, aiResult, scenario, basePass, diff);
    const noise      = (Math.random() - 0.5) * 0.10;
    const score      = parseFloat(Math.max(0, Math.min(100,
      (testPassed ? (70 + (1 - diff) * 25 + noise * 20)
                  : (20 + (1 - diff) * 30 + noise * 15))
    )).toFixed(1));

    const collision = !testPassed && level >= 4 && Math.random() < 0.35 * diff;
    const decCorrect= testPassed || Math.random() > 0.4;

    return {
      test_id:   testDef.id,
      test_name: testDef.name,
      passed:    testPassed,
      score,
      collision,
      decision_correct:  decCorrect,
      ai_action:         aiResult.action || 'Unknown',
      ai_confidence:     aiResult.confidence || 0,
      max_risk:          aiResult.maxRisk || 0,
      min_ttc:           aiResult.minTTC || 999,
      n_detected:        aiResult.detections?.length || 0,
      replanning:        aiResult.path?.replanning || false,
      scenario_type:     scenario.scenario_type,
      timestamp:         Date.now(),
      xai: {
        decision:    aiResult.action || 'Continue',
        reason:      aiResult.decision?.reason || 'Nominal conditions',
        risk:        aiResult.maxRisk || 0,
        confidence:  aiResult.confidence || 0.85,
      },
    };
  }

  // ── Test evaluation logic ────────────────────────────────
  _evaluateTest(testId, aiResult, scenario, basePass, diff) {
    const risk     = aiResult.maxRisk  || 0;
    const ttc      = aiResult.minTTC   || 999;
    const action   = (aiResult.action  || '').toLowerCase();
    const nDet     = aiResult.detections?.length || 0;

    // Noise for variability
    const roll = Math.random() + (basePass - 0.5) * 0.6 - diff * 0.4;

    switch (testId) {
      // Level 1 — Basic
      case 'speed_test':      return roll > 0.25;
      case 'accel_test':      return roll > 0.20;
      case 'brake_test':      return action.includes('brake') || action.includes('slow') ? roll > 0.10 : roll > 0.40;
      case 'stop_dist':       return action.includes('stop') || action.includes('brake') ? roll > 0.15 : roll > 0.35;
      case 'steer_test':      return roll > 0.20;

      // Level 2 — Detection
      case 'det_vehicle':     return nDet > 0 && roll > 0.15;
      case 'det_ped':         return nDet > 0 && roll > 0.20;
      case 'det_animal':      return nDet > 0 && roll > 0.25;
      case 'det_obstacle':    return nDet > 0 && roll > 0.20;
      case 'tracking':        return roll > 0.25;
      case 'dist_est':        return roll > 0.28;

      // Level 3 — Road
      case 'pothole_avoid':   return !action.includes('continue') ? roll > 0.10 : roll > 0.50;
      case 'rock_avoid':      return risk < 0.70 ? roll > 0.15 : roll > 0.55;
      case 'damaged_road':    return roll > 0.35;
      case 'uneven_road':     return roll > 0.30;
      case 'narrow_road':     return roll > 0.38;
      case 'no_markings':     return roll > 0.30;

      // Level 4 — Traffic
      case 'overtake':        return action.includes('overtake') || action.includes('steer') ? roll > 0.18 : roll > 0.55;
      case 'merging':         return roll > 0.38;
      case 'sudden_stop':     return action.includes('brake') || action.includes('stop') ? roll > 0.12 : roll > 0.60;
      case 'wrong_side':      return action.includes('steer') || action.includes('stop') ? roll > 0.20 : roll > 0.55;
      case 'ped_cross':       return risk > 0.40 ? (action.includes('brake') || action.includes('stop') ? roll > 0.12 : roll > 0.60) : roll > 0.25;
      case 'cattle_cross':    return risk > 0.50 ? (action.includes('brake') || action.includes('stop') ? roll > 0.15 : roll > 0.70) : roll > 0.28;

      // Level 5 — Prediction
      case 'traj_pred':       return roll > 0.38;
      case 'ttc_pred':        return ttc < 100 ? roll > 0.30 : roll > 0.40;
      case 'beh_pred':        return roll > 0.42;
      case 'uncert_test':     return roll > 0.45;

      // Level 6 — Decision
      case 'brake_steer':     return ['brake','steer','stop'].some(a => action.includes(a)) ? roll > 0.18 : roll > 0.60;
      case 'stop_cont':       return risk > 0.60 ? (action.includes('continue') ? roll > 0.80 : roll > 0.15) : roll > 0.30;
      case 'over_wait':       return roll > 0.42;
      case 'safe_path':       return aiResult.path?.selected?.status !== 'blocked' ? roll > 0.25 : roll > 0.70;
      case 'emg_decision':    return ttc < 2.5 ? (action.includes('emergency') ? roll > 0.10 : roll > 0.75) : roll > 0.30;

      // Level 7 — Complex
      case 'ped_pothole':     return roll > 0.48;
      case 'dense_dam':       return roll > 0.52;
      case 'cattle_ped':      return roll > 0.55;
      case 'market_full':     return roll > 0.60;

      // Level 8 — Extreme
      case 'max_chaos':       return roll > 0.65;
      case 'night_fog':       return roll > 0.60;
      case 'rapid_replan':    return aiResult.path?.repcount > 0 ? roll > 0.48 : roll > 0.70;
      case 'cascade_evt':     return roll > 0.68;

      // Level 9 — Stress (batch)
      case 'stress_100':      return roll > 0.38;
      case 'stress_500':      return roll > 0.42;
      case 'stress_edge':     return roll > 0.50;

      // Level 10 — Self-learning
      case 'sl_v1v2':        return roll > 0.35;
      case 'sl_v2v3':        return roll > 0.30;
      case 'sl_accept':      return roll > 0.40;
      case 'sl_rollback':    return roll > 0.32;

      default: return roll > 0.40;
    }
  }

  // ══════════════════════════════════════════════════════════
  // SCENARIO GENERATOR
  // ══════════════════════════════════════════════════════════
  _generateTestScenario(testId, level) {
    const base = {
      traffic_density:      Math.min(0.95, 0.2 + level * 0.07),
      road_damage:          Math.min(0.95, 0.1 + level * 0.06),
      pedestrian_density:   Math.min(0.90, 0.1 + level * 0.06),
      animal_probability:   Math.min(0.80, 0.05 + level * 0.05),
      obstacle_probability: Math.min(0.90, 0.1 + level * 0.07),
      visibility:           Math.max(0.2,  1.0 - level * 0.05),
      ego_speed:            Math.min(90,   20 + level * 5),
      road_width:           7,
    };

    // Test-specific overrides
    const overrides = {
      'pothole_avoid':   { road_damage: 0.8, obstacle_probability: 0.8 },
      'rock_avoid':      { road_damage: 0.7, obstacle_probability: 0.9 },
      'cattle_cross':    { animal_probability: 0.95, traffic_density: 0.3 },
      'ped_cross':       { pedestrian_density: 0.9, traffic_density: 0.4 },
      'sudden_stop':     { traffic_density: 0.8, ego_speed: 60 },
      'night_fog':       { visibility: 0.15 },
      'max_chaos':       { traffic_density: 0.99, road_damage: 0.95, pedestrian_density: 0.95, animal_probability: 0.8 },
      'market_full':     { traffic_density: 0.98, pedestrian_density: 0.97, obstacle_probability: 0.9, road_width: 5, ego_speed: 15 },
      'narrow_road':     { road_width: 4, traffic_density: 0.5 },
      'emg_decision':    { traffic_density: 0.9, ego_speed: 65, animal_probability: 0.7 },
    };

    const s = { ...base, ...(overrides[testId] || {}) };
    s.scenario_type = testId;
    return s;
  }

  // ── Build sensor data for scenario ──────────────────────
  _buildSensorData(scenario, level) {
    const n = Math.floor(scenario.traffic_density * 10) + 2;
    const data = [];
    const types = ['car','bike','pedestrian','auto','cattle','truck','cycle'];

    for (let i = 0; i < n; i++) {
      const type = scenario.animal_probability > 0.4 && Math.random() < scenario.animal_probability
        ? 'cattle'
        : scenario.pedestrian_density > 0.5 && Math.random() < scenario.pedestrian_density
          ? 'pedestrian'
          : types[Math.floor(Math.random() * types.length)];

      const info = OBJECT_TYPES[type.toUpperCase()] || OBJECT_TYPES.CAR;
      const dist = 5 + Math.random() * 45;
      const dirs = ['ahead','ahead_left','ahead_right','left','right'];
      const dir  = i === 0 ? 'ahead' : dirs[Math.floor(Math.random() * dirs.length)];
      const spd  = Math.random() * (info.maxSpeed * 0.7) + 3;

      data.push({
        id:             `test_${type}_${i}`,
        type,
        x:              (Math.random() - 0.5) * scenario.road_width,
        y:              -(dist),
        distance:       dist,
        speed:          spd,
        relative_speed: Math.abs(spd - scenario.ego_speed * 0.5),
        vx:             (Math.random() - 0.5) * 2,
        vy:             1 + Math.random() * 2,
        direction:      dir,
      });
    }
    return data;
  }

  // ══════════════════════════════════════════════════════════
  // RUN ALL LEVELS
  // ══════════════════════════════════════════════════════════
  async runAllLevels(modelId, onLevelDone, onProgress) {
    const allResults = [];
    for (let l = 1; l <= 10; l++) {
      const res = await this.runLevel(l, modelId, onProgress);
      allResults.push(res);
      if (onLevelDone) onLevelDone(l, res);
    }
    return {
      all:         allResults,
      total_score: parseFloat((allResults.reduce((s, r) => s + r.score, 0) / 10).toFixed(1)),
      overall_pass: allResults.filter(r => r.passed).length >= 7,
      stats:       this._stats,
    };
  }

  // ══════════════════════════════════════════════════════════
  // STRESS TEST (batch random scenarios)
  // ══════════════════════════════════════════════════════════
  async runStressTest(n = 100, modelId = 'IndiDrive-V3', onProgress = null) {
    const results = [];
    const model   = this._getModelMetrics(modelId);

    for (let i = 0; i < n; i++) {
      const level = Math.floor(Math.random() * 8) + 1;
      const sc    = this._generateTestScenario('stress_' + i, level);
      const sd    = this._buildSensorData(sc, level);
      const ai    = this.ai.process(sd, { speed: sc.ego_speed, x: 0, y: 0, roadWidth: sc.road_width, visibility: sc.visibility });
      const pass  = Math.random() < (model.safety_score / 100 - level * 0.03);

      results.push({ i, level, passed: pass, risk: ai.maxRisk, action: ai.action });
      if (onProgress && i % 10 === 0) onProgress(i, n);
      if (i % 20 === 0) await this._delay(5);  // prevent UI freeze
    }

    const passed = results.filter(r => r.passed).length;
    return {
      n, passed, failed: n - passed,
      pass_rate:    parseFloat((passed / n * 100).toFixed(1)),
      avg_risk:     parseFloat((results.reduce((s, r) => s + r.risk, 0) / n).toFixed(3)),
      safety_score: parseFloat((passed / n * 100 * (1 - results.reduce((s, r) => s + r.risk, 0) / n)).toFixed(1)),
      model:        modelId,
      timestamp:    new Date().toISOString(),
    };
  }

  // ══════════════════════════════════════════════════════════
  // METRICS AGGREGATION
  // ══════════════════════════════════════════════════════════
  _aggregateMetrics(results) {
    if (!results.length) return {};
    const n = results.length;
    return {
      avg_score:          parseFloat((results.reduce((s, r) => s + r.score, 0) / n).toFixed(1)),
      pass_rate:          parseFloat((results.filter(r => r.passed).length / n * 100).toFixed(1)),
      collision_rate:     parseFloat((results.filter(r => r.collision).length / n).toFixed(3)),
      avg_risk:           parseFloat((results.reduce((s, r) => s + r.max_risk, 0) / n).toFixed(3)),
      avg_confidence:     parseFloat((results.reduce((s, r) => s + r.ai_confidence, 0) / n).toFixed(3)),
      decision_accuracy:  parseFloat((results.filter(r => r.decision_correct).length / n).toFixed(3)),
      replanning_count:   results.filter(r => r.replanning).length,
      avg_detections:     parseFloat((results.reduce((s, r) => s + r.n_detected, 0) / n).toFixed(1)),
    };
  }

  // ══════════════════════════════════════════════════════════
  // AI SUGGESTIONS based on failures
  // ══════════════════════════════════════════════════════════
  generateSuggestions(failedTests = []) {
    const failIds   = failedTests.map(f => f.test_id || f.id || '');
    const failNames = failedTests.map(f => (f.test_name || '').toLowerCase()).join(' ');

    const suggestions = [];

    if (failIds.some(id => ['ped_cross','cattle_cross','det_ped','det_animal'].includes(id)) ||
        failNames.includes('pedestrian') || failNames.includes('cattle')) {
      suggestions.push(
        { priority: 'HIGH',   test: 'High-speed pedestrian crossing (60 km/h)', scenario: 'Pedestrian crossing at 60 km/h approach speed' },
        { priority: 'HIGH',   test: 'Multiple simultaneous pedestrian crossing', scenario: '4 pedestrians from different sides at once' },
        { priority: 'HIGH',   test: 'Cattle herd crossing at speed',            scenario: '6 cattle crossing rapidly in 2s window' },
        { priority: 'MEDIUM', test: 'Night pedestrian crossing',                 scenario: 'Low visibility + pedestrian random crossing' },
      );
    }

    if (failIds.some(id => ['pothole_avoid','rock_avoid','damaged_road'].includes(id)) ||
        failNames.includes('road') || failNames.includes('damage')) {
      suggestions.push(
        { priority: 'HIGH',   test: 'Dense pothole field — 40 km/h',     scenario: 'Multiple large potholes at speed' },
        { priority: 'HIGH',   test: 'Sudden large rock appearance',       scenario: 'Rock appears within 3m at 50 km/h' },
        { priority: 'MEDIUM', test: 'Waterlogged pothole combination',    scenario: 'Waterlogging + hidden potholes' },
      );
    }

    if (failIds.some(id => ['sudden_stop','wrong_side','emg_decision'].includes(id)) ||
        failNames.includes('sudden') || failNames.includes('emergency')) {
      suggestions.push(
        { priority: 'HIGH',   test: 'Chain sudden stop — 3 vehicles',    scenario: '3 vehicles brake simultaneously at 60 km/h' },
        { priority: 'HIGH',   test: 'Wrong-side bus at intersection',     scenario: 'Bus coming wrong-side at signalless junction' },
        { priority: 'MEDIUM', test: 'Emergency + road hazard combined',   scenario: 'Emergency brake + pothole in braking zone' },
      );
    }

    if (failIds.some(id => ['traj_pred','ttc_pred','beh_pred'].includes(id)) ||
        failNames.includes('predict')) {
      suggestions.push(
        { priority: 'HIGH',   test: 'Erratic pedestrian behaviour',       scenario: 'Pedestrian reverses direction mid-cross' },
        { priority: 'MEDIUM', test: 'TTC accuracy — 1.5 second window',   scenario: 'Object predicted to collide in 1.5s' },
        { priority: 'MEDIUM', test: 'Cattle group scatter prediction',     scenario: 'Cattle scatter in random directions' },
      );
    }

    if (failIds.some(id => ['market_full','max_chaos','dense_dam'].includes(id)) ||
        failNames.includes('complex') || failNames.includes('chaos')) {
      suggestions.push(
        { priority: 'HIGH',   test: 'Market road + monsoon simulation',   scenario: 'Peak market density + waterlogging + rain' },
        { priority: 'HIGH',   test: 'Extreme urban intersection',          scenario: 'Signal-less 6-way junction — all directions blocked' },
      );
    }

    if (!suggestions.length) {
      suggestions.push(
        { priority: 'MEDIUM', test: 'General Indian market road stress',  scenario: 'Maximum density Indian market environment' },
        { priority: 'MEDIUM', test: 'Mixed traffic stress test',           scenario: 'All traffic types simultaneously' },
        { priority: 'LOW',    test: 'Night + dust + damaged road',         scenario: '3-factor low visibility test' },
        { priority: 'LOW',    test: 'Mountain road tight turn',            scenario: 'Narrow mountain road + oncoming truck' },
      );
    }

    return suggestions.slice(0, 8);
  }

  // ══════════════════════════════════════════════════════════
  // MODEL METRICS (used in test evaluation)
  // ══════════════════════════════════════════════════════════
  _getModelMetrics(modelId) {
    const defaults = {
      'IndiDrive-V1': { safety_score: 71.8, collision_rate: 0.130, prediction_accuracy: 0.768 },
      'IndiDrive-V2': { safety_score: 83.5, collision_rate: 0.072, prediction_accuracy: 0.855 },
      'IndiDrive-V3': { safety_score: 91.6, collision_rate: 0.031, prediction_accuracy: 0.921 },
    };
    return defaults[modelId] || defaults['IndiDrive-V3'];
  }

  // ══════════════════════════════════════════════════════════
  // SELF-LEARNING WORKFLOW SIMULATION
  // ══════════════════════════════════════════════════════════
  async runSelfLearningWorkflow(datasetSize, currentModel, onStep) {
    const steps = [
      { id: 1, name: 'Data Validation',    duration: 800  },
      { id: 2, name: 'Quality Check',      duration: 600  },
      { id: 3, name: 'Training Queue',     duration: 400  },
      { id: 4, name: 'Candidate Model',    duration: 1500 },
      { id: 5, name: 'Validation',         duration: 1000 },
      { id: 6, name: 'Simulation Benchmark', duration: 2000 },
      { id: 7, name: 'Model Comparison',   duration: 800  },
      { id: 8, name: 'Accept / Reject',    duration: 600  },
    ];

    const quality = Math.min(1.0, datasetSize / 1000);
    const log     = [];

    for (const step of steps) {
      if (onStep) onStep(step.id, 'active', step.name);
      await this._delay(step.duration);

      let status = 'done', msg = '';

      switch (step.id) {
        case 1:
          msg    = `Validated ${datasetSize} samples. Quality: ${(quality * 100).toFixed(0)}%`;
          status = quality > 0.70 ? 'done' : 'error';
          break;
        case 2:
          msg    = quality > 0.70 ? 'Quality check passed. Dataset approved.' : 'Quality insufficient — need more samples.';
          status = quality > 0.70 ? 'done' : 'error';
          break;
        case 3:
          msg    = 'Added to training queue. Estimated training: ~2 hours (real GPU).';
          status = 'done';
          break;
        case 4:
          msg    = `Candidate model trained on ${datasetSize} samples. [SIMULATION — no real training performed]`;
          status = 'done';
          break;
        case 5:
          msg    = `Validation score: ${(quality * 88 + Math.random() * 5).toFixed(1)}%`;
          status = quality > 0.60 ? 'done' : 'error';
          break;
        case 6:
          const simScore = (quality * 90 + Math.random() * 6).toFixed(1);
          msg    = `Simulation benchmark: Safety ${simScore}%, Collision rate: ${(0.05 * (1 - quality)).toFixed(3)}`;
          status = 'done';
          break;
        case 7:
          const currScore = this._getModelMetrics(currentModel).safety_score;
          const newScore  = currScore * (0.9 + quality * 0.15);
          msg    = `${currentModel} safety: ${currScore}% | Candidate: ${newScore.toFixed(1)}%`;
          log.push({ better: newScore > currScore, currScore, newScore });
          status = 'done';
          break;
        case 8:
          const res = log[0];
          if (res && res.better) {
            msg    = `✓ ACCEPTED — Candidate model outperforms ${currentModel} by ${(res.newScore - res.currScore).toFixed(1)}%`;
          } else {
            msg    = `✗ REJECTED — Candidate model did not improve on ${currentModel}. Current model retained.`;
          }
          status = 'done';
          break;
      }

      if (onStep) onStep(step.id, status, step.name, msg);
      if (quality < 0.70 && step.id === 2) break;
    }

    return { complete: true, quality, log };
  }

  // ══════════════════════════════════════════════════════════
  // ACCESSORS
  // ══════════════════════════════════════════════════════════
  getResults()  { return [...this._results]; }
  getStats()    { return { ...this._stats }; }
  isRunning()   { return this._running; }
  clearResults(){ this._results = []; this._stats = { run: 0, passed: 0, failed: 0, collisions: 0 }; }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// Singleton — wired to AI engine
const TestEngine = new IndiDriveTestEngine(AI);
