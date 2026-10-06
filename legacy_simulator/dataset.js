// ============================================================
// IndiDrive AI Lab — Dataset Manager
// Dataset import, validation, analysis, and self-learning.
// ============================================================

const DatasetManager = (() => {
  'use strict';

  // ── State ────────────────────────────────────────────────
  let _currentDataset  = null;
  let _datasetHistory  = [];

  // ══════════════════════════════════════════════════════════
  // SAMPLE GENERATOR (demonstration dataset)
  // ══════════════════════════════════════════════════════════
  function generateSampleDataset(n = 50) {
    const types = ['car','bike','pedestrian','auto','cattle','truck','cycle','scooter','bus','pushcart'];
    const roads = ['URBAN','VILLAGE','HIGHWAY','MARKET','NARROW','UNMARKED'];
    const behaviours = ['normal','slow','sudden_stop','sudden_turn','lane_change','random_crossing'];
    const hazards = ['pothole','rock','gravel','mud','waterlogging','debris'];

    const samples = [];
    for (let i = 0; i < n; i++) {
      const type  = types[Math.floor(Math.random() * types.length)];
      const info  = OBJECT_TYPES[type.toUpperCase()] || OBJECT_TYPES.CAR;
      samples.push({
        id:          `sample_${i}`,
        type,
        x:           parseFloat(((Math.random() - 0.5) * 8).toFixed(2)),
        y:           parseFloat((-Math.random() * 55 - 3).toFixed(2)),
        speed:       parseFloat((Math.random() * info.maxSpeed * 0.8 + 2).toFixed(1)),
        vx:          parseFloat(((Math.random() - 0.5) * 3).toFixed(2)),
        vy:          parseFloat((Math.random() * 3 + 0.5).toFixed(2)),
        heading:     parseFloat((Math.random() * 360).toFixed(1)),
        distance:    parseFloat((Math.random() * 48 + 2).toFixed(2)),
        confidence:  parseFloat((0.75 + Math.random() * 0.24).toFixed(3)),
        road_type:   roads[Math.floor(Math.random() * roads.length)],
        behaviour:   behaviours[Math.floor(Math.random() * behaviours.length)],
        ego_speed:   parseFloat((Math.random() * 80 + 10).toFixed(1)),
        risk_label:  ['SAFE','LOW','MEDIUM','HIGH','CRITICAL'][Math.floor(Math.random() * 5)],
        action_label:['Continue','Brake','Steer Left','Steer Right','Emergency Brake'][Math.floor(Math.random() * 5)],
        hazards:     Math.random() > 0.6 ? [hazards[Math.floor(Math.random() * hazards.length)]] : [],
        timestamp:   Date.now() - Math.floor(Math.random() * 86400000),
        source:      'IndianRoadDataset-v1-SIMULATION',
        sim_note:    'Simulation data — not real-world validated',
      });
    }
    return samples;
  }

  // ══════════════════════════════════════════════════════════
  // VALIDATION
  // ══════════════════════════════════════════════════════════
  function validate(samples) {
    if (!Array.isArray(samples)) return { valid: false, error: 'Samples must be an array', samples: 0 };

    const n       = samples.length;
    const req     = ['id', 'type', 'x', 'y'];
    const results = {
      total:          n,
      valid:          0,
      invalid:        0,
      missing_fields: 0,
      suspicious:     0,
      type_errors:    0,
      range_errors:   0,
      errors:         [],
    };

    if (n === 0) return { ...results, valid_pct: 0, quality: 0, status: 'empty', can_train: false };

    for (let i = 0; i < Math.min(n, 2000); i++) {
      const s = samples[i];
      if (!s || typeof s !== 'object') { results.invalid++; continue; }

      // Check required fields
      const missing = req.filter(f => !(f in s));
      if (missing.length > 0) {
        results.missing_fields++;
        if (results.errors.length < 8) results.errors.push(`Row ${i}: missing ${missing.join(', ')}`);
        continue;
      }

      // Type validation
      if (typeof s.x !== 'number' || typeof s.y !== 'number') {
        results.type_errors++;
        if (results.errors.length < 8) results.errors.push(`Row ${i}: x/y must be numbers`);
        continue;
      }

      // Range checks
      if (Math.abs(s.x) > 50 || Math.abs(s.y) > 200) {
        results.range_errors++;
        if (results.errors.length < 8) results.errors.push(`Row ${i}: x/y out of expected range`);
      }

      // Security check on string fields
      if (Security.isSuspicious(String(s.id)) || Security.isSuspicious(String(s.type || ''))) {
        results.suspicious++;
        if (results.errors.length < 8) results.errors.push(`Row ${i}: suspicious content in string field`);
        continue;
      }

      results.valid++;
    }

    const validPct = results.valid / Math.min(n, 2000);
    const quality  = parseFloat((validPct * (1 - results.suspicious / Math.max(n, 1))).toFixed(3));
    const status   = quality > 0.80 ? 'valid' : quality > 0.50 ? 'warning' : 'invalid';

    return {
      ...results,
      valid_pct:  parseFloat((validPct * 100).toFixed(1)),
      quality,
      status,
      can_train:  quality > 0.70 && n >= 10,
      recommendation: quality > 0.85 ? 'Dataset ready for training pipeline.'
                    : quality > 0.65 ? 'Dataset acceptable but consider cleaning.'
                    : 'Dataset needs significant cleaning before use.',
    };
  }

  // ══════════════════════════════════════════════════════════
  // ANALYSIS
  // ══════════════════════════════════════════════════════════
  function analyze(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return { error: 'No samples to analyze' };

    const n = Math.min(samples.length, 5000);
    const sl = samples.slice(0, n);

    // Class distribution
    const classes = {};
    const speeds  = [];
    const roads   = {};
    const risks   = {};
    const behaviours = {};
    let   missing_speed = 0;
    let   missing_road  = 0;

    for (const s of sl) {
      if (!s || typeof s !== 'object') continue;

      // Object type
      const t = Security.sanitizeString(String(s.type || 'unknown'), 30);
      classes[t] = (classes[t] || 0) + 1;

      // Speed
      if (s.speed !== undefined && !isNaN(s.speed)) {
        speeds.push(Math.min(200, Math.max(0, parseFloat(s.speed))));
      } else { missing_speed++; }

      // Road type
      if (s.road_type) {
        const rt = Security.sanitizeString(String(s.road_type), 20);
        roads[rt] = (roads[rt] || 0) + 1;
      } else { missing_road++; }

      // Risk label
      if (s.risk_label) {
        const rl = Security.sanitizeString(String(s.risk_label), 10);
        risks[rl] = (risks[rl] || 0) + 1;
      }

      // Behaviour
      if (s.behaviour) {
        const bh = Security.sanitizeString(String(s.behaviour), 30);
        behaviours[bh] = (behaviours[bh] || 0) + 1;
      }
    }

    // Speed stats
    const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
    const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
    const minSpeed = speeds.length ? Math.min(...speeds) : 0;

    // Class balance score (0-1, 1 = perfectly balanced)
    const classVals  = Object.values(classes);
    const classTotal = classVals.reduce((a, b) => a + b, 0);
    const ideal      = classTotal / Math.max(classVals.length, 1);
    const balance    = classVals.length > 0
      ? 1 - classVals.reduce((s, v) => s + Math.abs(v - ideal), 0) / (2 * classTotal)
      : 0;

    // Dominant classes
    const sortedClasses = Object.entries(classes).sort((a, b) => b[1] - a[1]);

    return {
      total_samples:    n,
      unique_classes:   Object.keys(classes).length,
      class_distribution: classes,
      dominant_classes: sortedClasses.slice(0, 5).map(([k, v]) => ({ type: k, count: v, pct: parseFloat((v/n*100).toFixed(1)) })),
      class_balance:    parseFloat(balance.toFixed(3)),
      speed_stats: {
        avg:     parseFloat(avgSpeed.toFixed(1)),
        max:     parseFloat(maxSpeed.toFixed(1)),
        min:     parseFloat(minSpeed.toFixed(1)),
        samples: speeds.length,
        missing: missing_speed,
      },
      road_distribution:      roads,
      risk_distribution:      risks,
      behaviour_distribution: behaviours,
      missing_speed_pct:      parseFloat((missing_speed / n * 100).toFixed(1)),
      missing_road_pct:       parseFloat((missing_road  / n * 100).toFixed(1)),
      recommendation:         _analyzeRecommendation(n, balance, classes, risks),
      training_readiness:     n >= 100 && balance > 0.3 ? 'READY' : n >= 10 && balance > 0.15 ? 'MARGINAL' : 'NOT_READY',
    };
  }

  function _analyzeRecommendation(n, balance, classes, risks) {
    const recs = [];
    if (n < 100)       recs.push(`Need more samples (have ${n}, recommend ≥100).`);
    if (balance < 0.4) recs.push('Class imbalance detected — consider augmenting underrepresented classes.');
    if (!classes.pedestrian && !classes.Pedestrian) recs.push('No pedestrian samples — critical for Indian road safety.');
    if (!classes.cattle && !classes.Cattle) recs.push('No cattle samples — important for village/rural scenarios.');
    if (!risks.CRITICAL && !risks.HIGH) recs.push('No high-risk samples — add more dangerous scenario recordings.');
    if (recs.length === 0) return 'Dataset appears well-structured for training.';
    return recs.join(' ');
  }

  // ══════════════════════════════════════════════════════════
  // PARSE RAW FILE/TEXT
  // ══════════════════════════════════════════════════════════
  function parseRaw(text, format = 'json') {
    if (format === 'json') {
      const parsed = Security.safeJSONParse(text);
      if (!parsed) return { error: 'Invalid JSON format', samples: [] };
      if (Array.isArray(parsed)) return { samples: parsed, error: null };
      if (parsed.samples && Array.isArray(parsed.samples)) return { samples: parsed.samples, error: null };
      if (parsed.data && Array.isArray(parsed.data))    return { samples: parsed.data, error: null };
      return { error: 'JSON must contain an array or {samples: [...]}', samples: [] };
    }

    if (format === 'csv') {
      try {
        const lines  = text.trim().split('\n');
        if (lines.length < 2) return { error: 'CSV must have header + data rows', samples: [] };
        const headers = lines[0].split(',').map(h => Security.sanitizeString(h.trim(), 30));
        const samples = [];
        for (let i = 1; i < lines.length; i++) {
          const vals = lines[i].split(',');
          const obj  = {};
          headers.forEach((h, j) => {
            const v = (vals[j] || '').trim();
            obj[h]  = isNaN(v) ? Security.sanitizeString(v, 50) : parseFloat(v);
          });
          if (obj.id || obj.type) samples.push(obj);
        }
        return { samples, error: null };
      } catch (e) {
        return { error: 'CSV parse error', samples: [] };
      }
    }

    return { error: `Unsupported format: ${format}`, samples: [] };
  }

  // ══════════════════════════════════════════════════════════
  // READ FILE (browser FileReader)
  // ══════════════════════════════════════════════════════════
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const check = Security.validateFileUpload(file);
      if (!check.valid) { reject(new Error(check.error)); return; }

      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsText(file);
    });
  }

  // ══════════════════════════════════════════════════════════
  // STORE & RETRIEVE
  // ══════════════════════════════════════════════════════════
  function store(samples, meta = {}) {
    const name = Security.sanitizeString(meta.name || 'Dataset', 100);
    _currentDataset = {
      name,
      format:    Security.sanitizeString(meta.format || 'json', 10),
      samples:   samples.slice(0, 10000),
      size:      samples.length,
      stored_at: new Date().toISOString(),
    };
    _datasetHistory.push({ name, size: samples.length, stored_at: _currentDataset.stored_at });
    if (_datasetHistory.length > 10) _datasetHistory.shift();
    return _currentDataset;
  }

  function getCurrent()  { return _currentDataset; }
  function getHistory()  { return [..._datasetHistory]; }

  // ══════════════════════════════════════════════════════════
  // GENERATE TRAINING SAMPLES (from stored dataset)
  // ══════════════════════════════════════════════════════════
  function generateTrainingSamples(n = 20) {
    const source = _currentDataset?.samples || generateSampleDataset(n);
    const shuffled = [...source].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n).map((s, i) => ({
      ...s,
      train_id:    `train_${i}`,
      augmented:   Math.random() > 0.7,
      split:       Math.random() > 0.2 ? 'train' : 'val',
    }));
  }

  // ══════════════════════════════════════════════════════════
  // MODEL COMPARISON DATA
  // ══════════════════════════════════════════════════════════
  function getModelComparisonData() {
    return {
      'IndiDrive-V1': {
        safety_score:          71.8,
        collision_rate:        0.130,
        prediction_accuracy:   0.768,
        replanning_latency:    192,
        path_smoothness:       0.724,
        scenario_success_rate: 0.698,
        train_samples:         8400,
        label:                 'Baseline',
      },
      'IndiDrive-V2': {
        safety_score:          83.5,
        collision_rate:        0.072,
        prediction_accuracy:   0.855,
        replanning_latency:    148,
        path_smoothness:       0.812,
        scenario_success_rate: 0.832,
        train_samples:         22000,
        label:                 'Improved',
      },
      'IndiDrive-V3': {
        safety_score:          91.6,
        collision_rate:        0.031,
        prediction_accuracy:   0.921,
        replanning_latency:    97,
        path_smoothness:       0.891,
        scenario_success_rate: 0.918,
        train_samples:         58000,
        label:                 'Current Best',
      },
    };
  }

  function getImprovements(modelA, modelB, data) {
    const a = data[modelA], b = data[modelB];
    if (!a || !b) return {};
    return {
      safety_score:          pctChange(a.safety_score,          b.safety_score),
      collision_rate:        pctChange(a.collision_rate,        b.collision_rate, true),
      prediction_accuracy:   pctChange(a.prediction_accuracy,   b.prediction_accuracy),
      replanning_latency:    pctChange(a.replanning_latency,    b.replanning_latency,    true),
      path_smoothness:       pctChange(a.path_smoothness,       b.path_smoothness),
      scenario_success_rate: pctChange(a.scenario_success_rate, b.scenario_success_rate),
    };
  }

  function pctChange(from, to, lowerIsBetter = false) {
    if (from === 0) return '+∞';
    const chg = ((to - from) / Math.abs(from) * 100).toFixed(1);
    const positive = lowerIsBetter ? to < from : to > from;
    return (positive ? '+' : '') + chg + '%';
  }

  // ══════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════
  return Object.freeze({
    generateSampleDataset,
    validate,
    analyze,
    parseRaw,
    readFile,
    store,
    getCurrent,
    getHistory,
    generateTrainingSamples,
    getModelComparisonData,
    getImprovements,
  });
})();
