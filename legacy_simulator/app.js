// ============================================================
// IndiDrive AI Lab — Main Application Controller
// Wires all modules: Simulator, AI Engine, Test Engine,
// Dataset Manager, Security, and Flask API.
// ============================================================

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════
  // APP STATE
  // ══════════════════════════════════════════════════════════
  const App = {
    currentPage:   'dashboard',
    serverOnline:  false,
    simRunning:    false,
    modelChart:    null,
    currentScenario: null,
    testResults:   [],
    replayEvents:  [],
  };

  // ══════════════════════════════════════════════════════════
  // INIT
  // ══════════════════════════════════════════════════════════
  window.addEventListener('DOMContentLoaded', () => {
    initNav();
    initSimulator();
    initSimControls();
    initScenarioLab();
    initAIEnginePage();
    initTestingLab();
    initDatasetLab();
    initModelLab();
    initReplayPage();
    initSecurityPage();
    checkServerHealth();
    loadModelComparison();
    startDashboardUpdates();
  });

  // ══════════════════════════════════════════════════════════
  // NAVIGATION
  // ══════════════════════════════════════════════════════════
  function initNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        if (!page) return;
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        item.classList.add('active');
        const section = document.getElementById(`page-${page}`);
        if (section) section.classList.add('active');
        App.currentPage = page;
        if (page === 'models')   refreshModelLab();
        if (page === 'reports')  refreshReports();
      });
    });
  }

  // ══════════════════════════════════════════════════════════
  // SERVER HEALTH
  // ══════════════════════════════════════════════════════════
  async function checkServerHealth() {
    const dot   = document.getElementById('status-dot');
    const label = document.getElementById('status-label');
    try {
      const r = await Security.apiGet('/api/health');
      if (r && r.success) {
        dot.className   = 'online';
        label.textContent = 'Server online';
        App.serverOnline = true;
      } else throw new Error();
    } catch {
      dot.className   = 'offline';
      label.textContent = 'Server offline';
      App.serverOnline = false;
    }
    setTimeout(checkServerHealth, 15000);
  }

  // ══════════════════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════════════════
  function startDashboardUpdates() {
    updateDashboard();
    setInterval(updateDashboard, 800);
    document.getElementById('btn-quick-run').addEventListener('click', quickSimulation);
  }

  function updateDashboard() {
    if (!SIM) return;
    const m   = SIM.getMetrics();
    const ai  = SIM.getAIState();
    const rl  = getRiskLevel(ai?.maxRisk || 0);

    setText('sv-status', App.simRunning ? 'RUNNING' : 'IDLE');
    setText('sv-scenario', App.currentScenario?.name || App.currentScenario?.road_type || '—');
    setText('sv-speed',  m.speed ? `${m.speed.toFixed(0)} km/h` : '0 km/h');
    setText('sv-action', m.action || '—');
    setText('sv-collision', m.collisions > 0 ? `${m.collisions} EVENT(S)` : 'NONE');

    if (ai) {
      setText('sv-risk',       rl.label);
      setText('sv-confidence', ai.confidence ? `${(ai.confidence*100).toFixed(0)}%` : '—');
      setTextClass('sv-risk', `risk-${rl.label}`);

      setText('mc-detection',       `${ai.detections?.length || 0} objects`);
      setText('mc-detection-conf',  ai.detections?.length > 0
        ? `Avg conf: ${(ai.detections.reduce((s,d)=>s+d.confidence,0)/(ai.detections.length)).toFixed(2)}`
        : '—');
      setText('mc-prediction',      ai.predictions?.length > 0 ? `${ai.predictions.length} tracked` : '—');
      setText('mc-pred-ttc',        ai.minTTC < 500 ? `TTC: ${ai.minTTC.toFixed(1)}s` : 'TTC: —');
      setText('mc-decision',        ai.action || '—');
      setText('mc-dec-conf',        ai.confidence ? `${(ai.confidence*100).toFixed(0)}% confidence` : '—');
      setText('mc-planning',        ai.path?.selected ? `Offset ${ai.path.selected.offset}m` : '—');
      setText('mc-plan-status',     ai.path?.selected?.status || '—');
      setText('mc-perf',           `${ai.latency || 0}ms cycle`);
      setText('mc-perf-lat',        `Latency: ${ai.latency || 0} ms`);
    }

    // Live metrics
    setText('lm-coll',    m.collisions);
    setText('lm-replan',  m.replans);
    setText('lm-maxrisk', (m.maxRisk || 0).toFixed(3));
    setText('lm-minttc',  m.minTTC < 500 ? `${m.minTTC.toFixed(1)}s` : '—');
    setText('lm-dec',     m.decisions);
    setText('lm-time',    `${(m.elapsed || 0).toFixed(0)}s`);

    // HUD
    setText('hud-speed',  m.speed ? `${m.speed.toFixed(0)}` : '0');
    setText('hud-action', m.action || 'IDLE');
    setText('hud-risk',   rl.label);
    setText('hud-ttc',    ai?.minTTC < 500 ? ai.minTTC.toFixed(1) : '—');
    setText('hud-objs',   m.objects || 0);
  }

  async function quickSimulation() {
    await loadSIHScenario('sih_2');
    navigateTo('simulator');
    setTimeout(() => { if (SIM) { SIM.start(); App.simRunning = true; updateSimButtons(true); } }, 300);
  }

  // ══════════════════════════════════════════════════════════
  // SIMULATOR INIT & CONTROLS
  // ══════════════════════════════════════════════════════════
  function initSimulator() {
    SIM = new IndiDriveSimulator('sim-canvas', AI);
  }

  function initSimControls() {
    // Start/Pause/Stop/Reset
    document.getElementById('sim-start').addEventListener('click', () => {
      SIM.loadScenario(buildScenarioFromUI());
      SIM.start();
      App.simRunning = true;
      updateSimButtons(true);
    });

    document.getElementById('sim-pause').addEventListener('click', () => {
      SIM.pause();
    });

    document.getElementById('sim-stop').addEventListener('click', () => {
      SIM.stop();
      App.simRunning = false;
      updateSimButtons(false);
    });

    document.getElementById('sim-reset').addEventListener('click', () => {
      SIM.reset();
      App.simRunning = false;
      updateSimButtons(false);
    });

    // Speed buttons
    document.querySelectorAll('.spd-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        SIM.setSpeed(parseFloat(btn.dataset.speed));
      });
    });

    // Overlay toggles
    document.getElementById('tog-detect' ).addEventListener('change', e => SIM.showDetection   = e.target.checked);
    document.getElementById('tog-predict').addEventListener('change', e => SIM.showPredictions = e.target.checked);
    document.getElementById('tog-risk'   ).addEventListener('change', e => SIM.showRisk        = e.target.checked);
    document.getElementById('tog-path'   ).addEventListener('change', e => SIM.showPath        = e.target.checked);

    // Slider updates
    bindSlider('sl-traffic',  'val-traffic');
    bindSlider('sl-damage',   'val-damage');
    bindSlider('sl-unpredict','val-unpredict');
    bindSlider('sl-visibility','val-visibility');

    // Road type select
    document.getElementById('sim-road-select').addEventListener('change', e => {
      if (SIM) SIM.setRoadType(e.target.value);
    });

    // Event injection
    document.getElementById('inj-ped'    ).addEventListener('click', () => SIM.spawnObject('pedestrian'));
    document.getElementById('inj-cattle' ).addEventListener('click', () => SIM.spawnObject('cattle'));
    document.getElementById('inj-car'    ).addEventListener('click', () => SIM.spawnObject('car'));
    document.getElementById('inj-bike'   ).addEventListener('click', () => SIM.spawnObject('bike'));
    document.getElementById('inj-pothole').addEventListener('click', () => SIM.addHazard('POTHOLE'));
    document.getElementById('inj-rock'   ).addEventListener('click', () => SIM.addHazard('FALLEN_ROCKS'));
    document.getElementById('inj-block'  ).addEventListener('click', () => {
      SIM.spawnObject('truck', SIM.W/2, SIM.ego.y - 60);
      SIM.spawnObject('bus',   SIM.W/2 - 30, SIM.ego.y - 70);
    });
    document.getElementById('inj-stop').addEventListener('click', () => {
      if (SIM) { SIM.ego.targetSpeed = 0; SIM.ego.action = 'Emergency Brake'; }
    });

    // SIH scenario buttons (simulator page)
    document.querySelectorAll('.sih-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await loadSIHScenario(btn.dataset.sih);
        if (App.simRunning) { SIM.stop(); App.simRunning = false; updateSimButtons(false); }
        SIM.start();
        App.simRunning = true;
        updateSimButtons(true);
      });
    });
  }

  function buildScenarioFromUI() {
    const rt = document.getElementById('sim-road-select')?.value || 'URBAN';
    return {
      road_type:        rt,
      traffic_density:  parseFloat(document.getElementById('sl-traffic')?.value     || 0.6),
      road_damage:      parseFloat(document.getElementById('sl-damage')?.value      || 0.3),
      unpredictability: parseFloat(document.getElementById('sl-unpredict')?.value   || 0.5),
      visibility:       parseFloat(document.getElementById('sl-visibility')?.value  || 0.8),
      vehicle_speed:    40,
      params: {
        traffic_density:  parseFloat(document.getElementById('sl-traffic')?.value   || 0.6),
        road_damage:      parseFloat(document.getElementById('sl-damage')?.value    || 0.3),
        animal_probability: 0.15,
        pedestrian_density: 0.3,
        obstacle_probability: 0.2,
      },
    };
  }

  function updateSimButtons(running) {
    document.getElementById('sim-start').disabled = running;
    document.getElementById('sim-pause').disabled = !running;
    document.getElementById('sim-stop').disabled  = !running;
  }

  // ══════════════════════════════════════════════════════════
  // SCENARIO LAB
  // ══════════════════════════════════════════════════════════
  function initScenarioLab() {
    // Slider bindings
    ['g-traffic','g-damage','g-ped','g-animal','g-obs','g-unp','g-spd','g-vis'].forEach(id => {
      const el = document.getElementById(id);
      const vId = 'gv-' + id.slice(2);
      if (el) el.addEventListener('input', () => setText(vId, el.value));
    });

    document.getElementById('btn-gen-scenario').addEventListener('click', generateScenario);
    document.getElementById('btn-gen-random').addEventListener('click', generateRandomScenario);
    document.getElementById('btn-load-in-sim')?.addEventListener('click', () => {
      if (App.currentScenario) { SIM.loadScenario(App.currentScenario); navigateTo('simulator'); }
    });

    loadSIHCards();
  }

  async function generateScenario() {
    const params = {
      road_type:            document.getElementById('gen-road-type').value,
      weather:              document.getElementById('gen-weather').value,
      traffic_density:      parseFloat(document.getElementById('g-traffic').value),
      road_damage:          parseFloat(document.getElementById('g-damage').value),
      pedestrian_density:   parseFloat(document.getElementById('g-ped').value),
      animal_probability:   parseFloat(document.getElementById('g-animal').value),
      obstacle_probability: parseFloat(document.getElementById('g-obs').value),
      unpredictability:     parseFloat(document.getElementById('g-unp').value),
      vehicle_speed:        parseFloat(document.getElementById('g-spd').value),
      visibility:           parseFloat(document.getElementById('g-vis').value),
    };

    const el = document.getElementById('gen-scenario-output');
    el.innerHTML = '<div class="empty-state">Generating…</div>';

    const r = await Security.apiPost('/api/scenario/generate', params);
    if (r?.success) {
      App.currentScenario = { ...r.data, name: `Generated ${r.data.road_type}` };
      renderScenarioOutput(r.data, el);
      document.getElementById('gen-scenario-actions').style.display = 'block';
    } else {
      el.innerHTML = `<div class="empty-state">Error: ${Security.escapeHTML(r?.error || 'Failed')}</div>`;
    }
  }

  function generateRandomScenario() {
    const randEl = (id, vals) => { const el = document.getElementById(id); if (el) el.value = vals[Math.floor(Math.random() * vals.length)]; };
    const randRange = (id, lo, hi, step) => {
      const el = document.getElementById(id);
      if (!el) return;
      const steps = Math.floor((hi - lo) / step);
      el.value = (lo + Math.floor(Math.random() * steps) * step).toFixed(2);
      el.dispatchEvent(new Event('input'));
    };
    randEl('gen-road-type', Object.keys(ROAD_TYPES));
    randEl('gen-weather',   ['clear','clear','rain','fog','dust','night']);
    randRange('g-traffic',  0, 1,  0.05);
    randRange('g-damage',   0, 1,  0.05);
    randRange('g-ped',      0, 1,  0.05);
    randRange('g-animal',   0, 1,  0.05);
    randRange('g-unp',      0, 1,  0.05);
    randRange('g-spd',      10, 100, 5);
    generateScenario();
  }

  function renderScenarioOutput(data, el) {
    const dLabel = `tag-diff-${data.difficulty}`;
    el.innerHTML = `
      <div class="gen-out-section">
        <div class="gen-out-title">Road</div>
        <div class="gen-out-val">${Security.escapeHTML(data.road_type)} — ${Security.escapeHTML(data.weather)} — <span class="sih-tag ${dLabel}">${Security.escapeHTML(data.difficulty)}</span></div>
      </div>
      <div class="gen-out-section">
        <div class="gen-out-title">Traffic Objects (${data.objects?.length || 0})</div>
        <div class="gen-out-obj-list">${(data.objects||[]).slice(0,12).map(o => `<span class="gen-obj-tag">${Security.escapeHTML(o.type)}</span>`).join('')}</div>
      </div>
      <div class="gen-out-section">
        <div class="gen-out-title">Road Hazards (${data.hazards?.length || 0})</div>
        <div class="gen-out-obj-list">${(data.hazards||[]).slice(0,8).map(h => `<span class="gen-obj-tag">${Security.escapeHTML(h.type)}</span>`).join('')}</div>
      </div>
      <div class="gen-out-section">
        <div class="gen-out-title">Difficulty Score</div>
        <div class="gen-out-val">${data.difficulty_score}</div>
      </div>
      <div class="code-block">${Security.escapeHTML(JSON.stringify({ road: data.road_type, weather: data.weather, difficulty: data.difficulty, objects: data.objects?.length, hazards: data.hazards?.length }, null, 2))}</div>`;
  }

  async function loadSIHCards() {
    const r = await Security.apiGet('/api/scenario/sih');
    if (!r?.success) return;
    const grid = document.getElementById('sih-cards');
    if (!grid) return;
    grid.innerHTML = '';
    for (const sc of r.data.scenarios) {
      const dLabel = `tag-diff-${sc.difficulty}`;
      const card   = document.createElement('div');
      card.className = 'sih-card';
      card.innerHTML = `
        <div class="sih-card-title">${Security.escapeHTML(sc.name)}</div>
        <div class="sih-card-desc">${Security.escapeHTML(sc.description)}</div>
        <div class="sih-card-tags">
          <span class="sih-tag ${dLabel}">${Security.escapeHTML(sc.difficulty)}</span>
          <span class="sih-tag" style="background:rgba(14,165,233,0.15);color:#38bdf8;border:1px solid #0369a1">${Security.escapeHTML(sc.road_type)}</span>
        </div>
        <div style="font-size:10px;color:#64748b;margin-bottom:8px">Challenge: ${Security.escapeHTML(sc.challenge)}</div>
        <button class="sih-card-btn" data-id="${Security.escapeHTML(sc.id)}">▶ Load in Simulator</button>`;
      card.querySelector('button').addEventListener('click', async () => {
        await loadSIHScenario(sc.id);
        navigateTo('simulator');
      });
      grid.appendChild(card);
    }
  }

  async function loadSIHScenario(id) {
    const r = await Security.apiGet(`/api/scenario/sih/${id}`);
    if (r?.success) {
      App.currentScenario = r.data;
      SIM.loadScenario(r.data);
      setText('sv-scenario', r.data.name || id);
    }
  }

  // ══════════════════════════════════════════════════════════
  // AI ENGINE PAGE
  // ══════════════════════════════════════════════════════════
  function initAIEnginePage() {
    document.getElementById('btn-run-ai-cycle').addEventListener('click', runAICycle);
  }

  async function runAICycle() {
    const sensorData = SIM?.getSensorDataSnapshot()?.length > 0
      ? SIM.getSensorDataSnapshot()
      : AI.generateSampleSensorData(6);

    const egoState = {
      speed: SIM?.ego?.speed || 40, x: 0, y: 0,
      roadWidth: 7, visibility: 0.8,
    };

    // Animate pipeline stages
    const stages = ['ps-sensor','ps-detect','ps-track','ps-predict','ps-risk','ps-decide','ps-plan','ps-action'];
    for (const stage of stages) {
      document.querySelectorAll('.pipe-stage').forEach(s => s.classList.remove('active'));
      const el = document.getElementById(stage);
      if (el) el.classList.add('active');
      await delay(80);
    }

    const result = AI.process(sensorData, egoState);

    // Update pipeline data displays
    setText('psd-sensor',  `${sensorData.length} obs`);
    setText('psd-detect',  `${result.detections?.length || 0} det`);
    setText('psd-track',   `${result.tracks?.length || 0} tracked`);
    setText('psd-predict', `${result.predictions?.length || 0} traj`);
    setText('psd-risk',    getRiskLevel(result.maxRisk).label);
    setText('psd-decide',  result.action || '—');
    setText('psd-plan',    result.path?.selected?.status || '—');
    setText('psd-action',  result.action || '—');

    document.querySelectorAll('.pipe-stage').forEach(s => s.classList.remove('active'));
    document.getElementById('ps-action')?.classList.add('active');

    // Detection list
    renderDetectionList(result.detections || [], result.risks || []);

    // Decision XAI
    renderDecisionDetail(result);

    // Action matrix
    renderActionMatrix(result.decision?.actions_evaluated || result.decisions?.actions_evaluated || []);
  }

  function renderDetectionList(dets, risks) {
    const el = document.getElementById('ai-detections-list');
    if (!dets.length) { el.innerHTML = '<div class="empty-state">No objects detected.</div>'; return; }
    el.innerHTML = dets.map(det => {
      const risk = risks.find(r => r.id === det.id);
      const rl   = getRiskLevel(risk?.risk_score || 0);
      return `<div class="det-item">
        <span class="det-type" style="color:${rl.color}">${Security.escapeHTML(det.type.toUpperCase())}</span>
        <span class="det-conf">${(det.confidence*100).toFixed(0)}%</span>
        <span class="det-dist">${det.distance.toFixed(1)}m</span>
        <span class="det-risk" style="background:rgba(${hexToRGBStr(rl.color)},0.15);color:${rl.color}">${rl.label}</span>
        <span style="font-size:10px;color:#64748b">${Security.escapeHTML(det.direction)}</span>
        ${risk ? `<span style="font-size:10px;color:#64748b">TTC:${risk.ttc.toFixed(1)}s</span>` : ''}
      </div>`;
    }).join('');
  }

  function renderDecisionDetail(result) {
    const el = document.getElementById('ai-decision-detail');
    const d  = result;
    const rl = getRiskLevel(d.maxRisk || 0);
    el.innerHTML = `
      <div class="xai-item"><div class="xai-label">Decision</div><div class="xai-val" style="color:${rl.color}">${Security.escapeHTML(d.action || '—')}</div></div>
      <div class="xai-item"><div class="xai-label">Reason</div><div class="xai-reason">${Security.escapeHTML(d.decision?.reason || '—')}</div></div>
      <div class="xai-item"><div class="xai-label">Max Risk</div><div class="xai-val">${((d.maxRisk||0)*100).toFixed(1)}%</div></div>
      <div class="xai-item"><div class="xai-label">Min TTC</div><div class="xai-val">${d.minTTC < 500 ? d.minTTC.toFixed(2)+'s' : '—'}</div></div>
      <div class="xai-item"><div class="xai-label">Confidence</div><div class="xai-val">${((d.confidence||0)*100).toFixed(0)}%</div></div>
      <div class="xai-item"><div class="xai-label">Risk Level</div><div class="xai-val" style="color:${rl.color}">${rl.label}</div></div>
      <div class="xai-item"><div class="xai-label">Path Status</div><div class="xai-val">${Security.escapeHTML(d.path?.selected?.status || '—')}</div></div>
      <div style="font-size:9px;color:#64748b;margin-top:8px">SIMULATION MODEL — Not validated for real deployment</div>`;
  }

  function renderActionMatrix(actions) {
    const el = document.getElementById('ai-action-matrix');
    if (!actions.length) { el.innerHTML = '<div class="empty-state">Run AI cycle first.</div>'; return; }
    const maxR = Math.max(...actions.map(a => a.risk || 0), 0.001);
    el.innerHTML = actions.map(a => {
      const pct   = Math.round((a.risk / maxR) * 100);
      const color = a.risk < 0.3 ? '#10b981' : a.risk < 0.6 ? '#f59e0b' : '#ef4444';
      const sel   = a.action === (actions.sort((x,y)=>x.risk-y.risk)[0].action);
      return `<div class="action-bar-item ${sel ? 'ab-sel' : ''}">
        <div class="ab-label"><span>${Security.escapeHTML(a.action)}</span><span style="color:${color}">${((a.risk||0)*100).toFixed(0)}%</span></div>
        <div class="ab-track"><div class="ab-fill" style="width:${pct}%;background:${color}"></div></div>
        ${sel ? `<div style="font-size:9px;color:#10b981;margin-top:2px">✓ SELECTED</div>` : ''}
      </div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════
  // TESTING LAB
  // ══════════════════════════════════════════════════════════
  function initTestingLab() {
    const grid = document.getElementById('test-levels-grid');
    if (!grid) return;

    TestEngine.getTestLevels().forEach(lvl => {
      const card = document.createElement('div');
      card.className = 'test-level-card';
      card.id = `tlc-${lvl.level}`;
      card.innerHTML = `
        <div class="tl-num" style="color:${lvl.color}">${lvl.level}</div>
        <div class="tl-name">${Security.escapeHTML(lvl.name)}</div>
        <div class="tl-score" id="tls-${lvl.level}">—</div>
        <div style="font-size:9px;color:#64748b">${Security.escapeHTML(lvl.description)}</div>`;
      card.addEventListener('click', () => runTestLevel(lvl.level));
      grid.appendChild(card);
    });

    document.getElementById('btn-run-all-tests').addEventListener('click', runAllTests);
    document.getElementById('btn-get-suggestions').addEventListener('click', getTestSuggestions);
  }

  async function runTestLevel(level) {
    const modelId = document.getElementById('test-model-select')?.value || 'IndiDrive-V3';
    const card    = document.getElementById(`tlc-${level}`);
    const scoreEl = document.getElementById(`tls-${level}`);
    if (card) card.classList.add('running');

    appendTestResult(`⏳ Running Level ${level} tests on ${modelId}…`);

    const r = await TestEngine.runLevel(level, modelId, (test, result) => {
      appendTestResult(
        `${result.passed ? '✓' : '✗'} [L${level}] ${test.name} — ${result.score.toFixed(0)}% — ${result.ai_action}`,
        result.passed ? 'ok' : 'err'
      );
    });

    if (card)    { card.classList.remove('running'); card.classList.add(r.passed ? 'passed' : 'failed'); }
    if (scoreEl) scoreEl.textContent = `${r.score.toFixed(0)}%`;

    appendTestResult(`Level ${level} complete: ${r.score.toFixed(0)}% — ${r.passedCount}/${r.total} passed`, r.passed ? 'ok' : 'warn');
    App.testResults.push(r);
    updateTestMetrics();

    // Send to backend for logging
    if (App.serverOnline) {
      Security.apiPost('/api/test/run', { level, model_id: modelId });
    }
  }

  async function runAllTests() {
    const modelId = document.getElementById('test-model-select')?.value || 'IndiDrive-V3';
    appendTestResult(`⏳ Running ALL levels on ${modelId}…`, 'info');
    for (let l = 1; l <= 10; l++) {
      await runTestLevel(l);
      await delay(200);
    }
    appendTestResult('✓ All levels complete.', 'ok');
  }

  function appendTestResult(msg, type = 'info') {
    const list = document.getElementById('test-results-list');
    if (!list) return;
    if (list.querySelector('.empty-state')) list.innerHTML = '';
    const div = document.createElement('div');
    div.className = `list-item`;
    div.innerHTML = `<span style="font-family:Consolas;font-size:11px;color:${type==='ok'?'#10b981':type==='err'?'#ef4444':type==='warn'?'#f59e0b':'#64748b'}">${Security.escapeHTML(msg)}</span>`;
    list.appendChild(div);
    list.scrollTop = list.scrollHeight;
  }

  function updateTestMetrics() {
    const stats = TestEngine.getStats();
    setText('tm-run',    stats.run);
    setText('tm-pass',   stats.passed);
    setText('tm-fail',   stats.failed);
    const all = App.testResults;
    if (all.length) {
      const avgSafety = (all.reduce((s,r) => s + r.score, 0) / all.length).toFixed(1);
      const avgColl   = (all.reduce((s,r) => s + (r.metrics?.collision_rate||0), 0) / all.length * 100).toFixed(1);
      const avgSucc   = (all.reduce((s,r) => s + (r.metrics?.pass_rate||0), 0) / all.length).toFixed(1);
      setText('tm-safety', `${avgSafety}%`);
      setText('tm-coll',   `${avgColl}%`);
      setText('tm-succ',   `${avgSucc}%`);
    }
  }

  async function getTestSuggestions() {
    const failedTests = App.testResults.flatMap(r => r.results?.filter(t => !t.passed) || []);
    const sugg = TestEngine.generateSuggestions(failedTests);

    if (App.serverOnline) {
      const r = await Security.apiPost('/api/ai/suggest', { failures: failedTests.slice(0, 10) });
      if (r?.success) renderSuggestions(r.data.suggestions);
      else            renderSuggestions(sugg);
    } else {
      renderSuggestions(sugg);
    }
  }

  function renderSuggestions(suggestions) {
    const el = document.getElementById('test-suggestions-list');
    if (!el) return;
    el.innerHTML = suggestions.map(s => `
      <div class="list-item">
        <div style="flex:1">
          <div style="font-size:11px;font-weight:700;color:#e2e8f0">${Security.escapeHTML(s.test)}</div>
          <div style="font-size:10px;color:#64748b">${Security.escapeHTML(s.scenario || '')}</div>
        </div>
        <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${s.priority==='HIGH'?'rgba(239,68,68,0.15)':s.priority==='MEDIUM'?'rgba(245,158,11,0.15)':'rgba(16,185,129,0.1)'};color:${s.priority==='HIGH'?'#ef4444':s.priority==='MEDIUM'?'#f59e0b':'#10b981'}">${Security.escapeHTML(s.priority)}</span>
      </div>`).join('');
  }

  // ══════════════════════════════════════════════════════════
  // DATASET LAB
  // ══════════════════════════════════════════════════════════
  function initDatasetLab() {
    document.getElementById('btn-ds-validate').addEventListener('click', validateDataset);
    document.getElementById('btn-ds-analyze').addEventListener('click', analyzeDataset);
    document.getElementById('btn-ds-sample').addEventListener('click', loadSampleDataset);
    document.getElementById('btn-run-workflow').addEventListener('click', runSelfLearningWorkflow);

    // File upload
    document.getElementById('ds-file')?.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const check = Security.validateFileUpload(file);
      if (!check.valid) { alert(check.error); return; }
      try {
        const text   = await DatasetManager.readFile(file);
        const format = file.name.endsWith('.csv') ? 'csv' : 'json';
        const parsed = DatasetManager.parseRaw(text, format);
        if (parsed.error) { alert(parsed.error); return; }
        document.getElementById('ds-paste').value = JSON.stringify(parsed.samples.slice(0, 20), null, 2);
      } catch (err) {
        alert('File read failed: ' + err.message);
      }
    });
  }

  function getPasteSamples() {
    const text   = (document.getElementById('ds-paste')?.value || '').trim();
    if (!text) return null;
    const parsed = DatasetManager.parseRaw(text, 'json');
    return parsed.samples || null;
  }

  async function validateDataset() {
    const samples = getPasteSamples() || DatasetManager.getCurrent()?.samples;
    if (!samples) { alert('Paste or load a dataset first.'); return; }

    const result = DatasetManager.validate(samples);
    const out    = document.getElementById('ds-analysis-output');

    const statusColor = result.status === 'valid' ? '#10b981' : result.status === 'warning' ? '#f59e0b' : '#ef4444';
    out.innerHTML = `
      <div style="margin-bottom:10px;padding:8px 12px;background:rgba(${hexToRGBStr(statusColor)},0.1);border:1px solid ${statusColor};border-radius:6px">
        <div style="font-weight:700;color:${statusColor}">${result.status?.toUpperCase()} — Quality: ${(result.quality*100).toFixed(0)}%</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:4px">${Security.escapeHTML(result.recommendation || '')}</div>
      </div>
      <div class="metrics-grid">
        <div class="met-item"><div class="met-label">Total</div><div class="met-val">${result.total}</div></div>
        <div class="met-item"><div class="met-label">Valid</div><div class="met-val green">${result.valid}</div></div>
        <div class="met-item"><div class="met-label">Invalid</div><div class="met-val red">${result.invalid}</div></div>
        <div class="met-item"><div class="met-label">Missing</div><div class="met-val">${result.missing_fields}</div></div>
        <div class="met-item"><div class="met-label">Valid %</div><div class="met-val">${result.valid_pct}%</div></div>
        <div class="met-item"><div class="met-label">Can Train</div><div class="met-val ${result.can_train?'green':'red'}">${result.can_train ? 'YES' : 'NO'}</div></div>
      </div>
      ${result.errors?.length ? `<div class="code-block">${result.errors.map(e=>Security.escapeHTML(e)).join('\n')}</div>` : ''}`;

    if (result.can_train) DatasetManager.store(samples, { name: 'Validated Dataset', format: 'json' });

    // Also call backend validate
    if (App.serverOnline) Security.apiPost('/api/dataset/validate', { samples: samples.slice(0, 100) });
  }

  async function analyzeDataset() {
    const samples = getPasteSamples() || DatasetManager.getCurrent()?.samples;
    if (!samples) { alert('Validate a dataset first.'); return; }

    const result = DatasetManager.analyze(samples);
    const out    = document.getElementById('ds-analysis-output');

    out.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:12px;font-weight:700;color:#38bdf8">Dataset Analysis</div>
        <div style="font-size:10px;color:#64748b">Training readiness: <span style="color:${result.training_readiness==='READY'?'#10b981':result.training_readiness==='MARGINAL'?'#f59e0b':'#ef4444'};font-weight:700">${result.training_readiness}</span></div>
      </div>
      <div class="metrics-grid">
        <div class="met-item"><div class="met-label">Samples</div><div class="met-val">${result.total_samples}</div></div>
        <div class="met-item"><div class="met-label">Classes</div><div class="met-val">${result.unique_classes}</div></div>
        <div class="met-item"><div class="met-label">Balance</div><div class="met-val">${(result.class_balance*100).toFixed(0)}%</div></div>
        <div class="met-item"><div class="met-label">Avg Speed</div><div class="met-val">${result.speed_stats?.avg} km/h</div></div>
      </div>
      <div style="margin-top:10px">
        <div style="font-size:10px;color:#64748b;margin-bottom:6px">CLASS DISTRIBUTION</div>
        ${result.dominant_classes?.map(c=>`
          <div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;border-bottom:1px solid #1e3050">
            <span style="color:#e2e8f0">${Security.escapeHTML(c.type)}</span>
            <span style="color:#38bdf8;font-family:Consolas">${c.count} (${c.pct}%)</span>
          </div>`).join('') || ''}
      </div>
      <div style="font-size:10px;color:#64748b;margin-top:10px">${Security.escapeHTML(result.recommendation || '')}</div>`;
  }

  function loadSampleDataset() {
    const samples = DatasetManager.generateSampleDataset(80);
    document.getElementById('ds-paste').value = JSON.stringify(samples.slice(0, 10), null, 2)
      + `\n/* ... and ${samples.length - 10} more samples */`;
    DatasetManager.store(samples, { name: 'Sample Dataset', format: 'json' });
    alert(`Loaded ${samples.length} sample objects. Click Validate or Analyze.`);
  }

  async function runSelfLearningWorkflow() {
    const logEl = document.getElementById('workflow-log');
    if (!logEl) return;
    logEl.innerHTML = '';
    const steps = document.querySelectorAll('.wf-step');
    steps.forEach(s => s.classList.remove('active','done','error'));

    const ds   = DatasetManager.getCurrent()?.samples || DatasetManager.generateSampleDataset(60);
    const curr = document.getElementById('test-model-select')?.value || 'IndiDrive-V3';

    await TestEngine.runSelfLearningWorkflow(ds.length, curr, (stepId, status, name, msg) => {
      const el = document.getElementById(`wfs-${stepId}`);
      if (el) { el.classList.remove('active','done','error'); el.classList.add(status); }
      if (msg) {
        const line = document.createElement('div');
        line.className = `log-line ${status === 'done' ? 'ok' : status === 'error' ? 'err' : 'info'}`;
        line.textContent = `[Step ${stepId}] ${name}: ${msg}`;
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // MODEL LAB
  // ══════════════════════════════════════════════════════════
  function initModelLab() {
    document.getElementById('btn-refresh-models').addEventListener('click', refreshModelLab);
    refreshModelLab();
  }

  async function refreshModelLab() {
    const data = DatasetManager.getModelComparisonData();
    renderModelCards(data);
    renderModelTable(data);
    renderModelChart(data);
    if (App.serverOnline) {
      const r = await Security.apiGet('/api/model/current');
      if (r?.success) loadModelComparison(r.data);
    }
  }

  function renderModelCards(data) {
    const row = document.getElementById('model-cards-row');
    if (!row) return;
    row.innerHTML = '';
    const current = 'IndiDrive-V3';
    for (const [id, m] of Object.entries(data)) {
      const card = document.createElement('div');
      card.className = `model-card ${id === current ? 'current' : ''}`;
      card.innerHTML = `
        <div class="mc2-version">VERSION ${m.version}</div>
        <div class="mc2-name">${Security.escapeHTML(id)}</div>
        <div class="mc2-label">${Security.escapeHTML(m.label)} ${id === current ? '✓ ACTIVE' : ''}</div>
        <div class="mc2-metric"><span>Safety Score</span><span>${m.safety_score}%</span></div>
        <div class="mc2-metric"><span>Collision Rate</span><span>${(m.collision_rate*100).toFixed(1)}%</span></div>
        <div class="mc2-metric"><span>Prediction Acc</span><span>${(m.prediction_accuracy*100).toFixed(0)}%</span></div>
        <div class="mc2-metric"><span>Replan Latency</span><span>${m.replanning_latency} ms</span></div>
        <div class="mc2-metric"><span>Path Smoothness</span><span>${(m.path_smoothness*100).toFixed(0)}%</span></div>
        <div class="mc2-metric"><span>Scenario Success</span><span>${(m.scenario_success_rate*100).toFixed(0)}%</span></div>
        <div class="mc2-metric"><span>Train Samples</span><span>${m.train_samples.toLocaleString()}</span></div>`;
      row.appendChild(card);
    }
  }

  function renderModelTable(data) {
    const metrics = [
      ['Safety Score (%)',     m => m.safety_score.toFixed(1),                 true],
      ['Collision Rate (%)',   m => (m.collision_rate*100).toFixed(2),         false],
      ['Prediction Acc (%)',   m => (m.prediction_accuracy*100).toFixed(1),    true],
      ['Replan Latency (ms)',  m => m.replanning_latency,                       false],
      ['Path Smoothness (%)',  m => (m.path_smoothness*100).toFixed(1),        true],
      ['Scenario Success (%)', m => (m.scenario_success_rate*100).toFixed(1),  true],
      ['Train Samples',        m => m.train_samples.toLocaleString(),           true],
    ];
    const body = document.getElementById('full-compare-body');
    if (!body) return;
    const models = Object.entries(data);
    body.innerHTML = metrics.map(([label, fn, higherBetter]) => {
      const vals = models.map(([id, m]) => parseFloat(fn(m)));
      const best = higherBetter ? Math.max(...vals) : Math.min(...vals);
      return `<tr>
        <td style="color:#64748b;font-size:11px">${Security.escapeHTML(label)}</td>
        ${models.map(([id, m], i) => {
          const v  = fn(m);
          const isBest = parseFloat(v) === best;
          return `<td style="font-family:Consolas;font-size:12px;font-weight:${isBest?'700':'400'};color:${isBest?'#10b981':'#e2e8f0'}">${Security.escapeHTML(String(v))}${isBest?' ★':''}</td>`;
        }).join('')}
      </tr>`;
    }).join('');
  }

  function renderModelChart(data) {
    const el = document.getElementById('model-chart');
    if (!el) return;
    if (App.modelChart) { App.modelChart.destroy(); }
    const models  = Object.keys(data);
    const labels  = ['Safety','Prediction','Path Smooth','Scenario Success'];
    const datasets = models.map((m, i) => ({
      label:           m,
      data:            [
        data[m].safety_score,
        data[m].prediction_accuracy * 100,
        data[m].path_smoothness * 100,
        data[m].scenario_success_rate * 100,
      ],
      backgroundColor: ['rgba(100,116,139,0.4)','rgba(14,165,233,0.4)','rgba(16,185,129,0.4)'][i],
      borderColor:     ['#64748b','#0ea5e9','#10b981'][i],
      borderWidth:     2,
    }));
    App.modelChart = new Chart(el, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11 } } } },
        scales: {
          x: { ticks: { color: '#64748b' }, grid: { color: '#1e3050' } },
          y: { min: 0, max: 100, ticks: { color: '#64748b' }, grid: { color: '#1e3050' } },
        },
      },
    });
  }

  async function loadModelComparison(data) {
    const d = data?.versions || DatasetManager.getModelComparisonData();
    const body = document.getElementById('model-table-body');
    if (!body) return;
    body.innerHTML = Object.entries(d).map(([id, m]) => `
      <tr>
        <td style="font-weight:700;color:#38bdf8">${Security.escapeHTML(id)}</td>
        <td><span style="color:#10b981;font-weight:700">${m.safety_score?.toFixed?.(1) || m.safety_score}</span></td>
        <td>${((m.collision_rate||0)*100).toFixed(1)}%</td>
        <td>${((m.prediction_accuracy||0)*100).toFixed(0)}%</td>
        <td>${m.replanning_latency} ms</td>
        <td>${((m.scenario_success_rate||0)*100).toFixed(0)}%</td>
      </tr>`).join('');
  }

  // ══════════════════════════════════════════════════════════
  // DECISION REPLAY
  // ══════════════════════════════════════════════════════════
  function initReplayPage() {
    document.getElementById('btn-replay-sim').addEventListener('click', replaySim);
    document.getElementById('btn-replay-clear').addEventListener('click', () => {
      document.getElementById('replay-timeline').innerHTML = '<div class="empty-state">Timeline cleared.</div>';
    });
  }

  function replaySim() {
    const log = SIM?.replayLog || AI.getDecisionLog();
    if (!log || !log.length) { alert('Run a simulation first.'); return; }
    App.replayEvents = log;
    renderReplayTimeline(log);
  }

  function renderReplayTimeline(log) {
    const el = document.getElementById('replay-timeline');
    if (!log.length) { el.innerHTML = '<div class="empty-state">No events.</div>'; return; }
    const t0 = log[0].ts || 0;
    el.innerHTML = log.map((ev, i) => {
      const rl    = getRiskLevel(ev.max_risk || ev.maxRisk || 0);
      const tsRel = ((((ev.ts || ev.timestamp || t0) - t0) / 1000)).toFixed(2);
      return `<div class="timeline-event" data-idx="${i}">
        <div class="te-time">+${tsRel}s</div>
        <div class="te-dot" style="background:${rl.color}"></div>
        <div class="te-body">
          <div class="te-event" style="color:${rl.color}">${Security.escapeHTML(ev.action || '—')}</div>
          <div class="te-detail">Risk: ${((ev.max_risk||ev.maxRisk||0)*100).toFixed(0)}% | Speed: ${(ev.egoSpeed||ev.speed||0).toFixed(0)} km/h | Objects: ${ev.n_objects||0}</div>
        </div>
      </div>`;
    }).join('');

    el.querySelectorAll('.timeline-event').forEach(evt => {
      evt.addEventListener('click', () => {
        const idx = parseInt(evt.dataset.idx);
        renderReplayDetail(log[idx]);
      });
    });
  }

  function renderReplayDetail(ev) {
    const rl = getRiskLevel(ev.max_risk || ev.maxRisk || 0);
    document.getElementById('replay-xai-detail').innerHTML = `
      <div class="xai-item"><div class="xai-label">Decision</div><div class="xai-val" style="color:${rl.color}">${Security.escapeHTML(ev.action || '—')}</div></div>
      <div class="xai-item"><div class="xai-label">Reason</div><div class="xai-reason">${Security.escapeHTML(ev.reason || '—')}</div></div>
      <div class="xai-item"><div class="xai-label">Risk</div><div class="xai-val">${((ev.max_risk||ev.maxRisk||0)*100).toFixed(1)}%</div></div>
      <div class="xai-item"><div class="xai-label">Risk Level</div><div class="xai-val" style="color:${rl.color}">${rl.label}</div></div>
      <div class="xai-item"><div class="xai-label">TTC</div><div class="xai-val">${ev.min_ttc < 500 ? ev.min_ttc?.toFixed(2)+'s' : '—'}</div></div>
      <div class="xai-item"><div class="xai-label">Confidence</div><div class="xai-val">${((ev.confidence||0)*100).toFixed(0)}%</div></div>
      <div class="xai-item"><div class="xai-label">Override</div><div class="xai-val">${ev.override ? '⚠ YES' : 'No'}</div></div>`;

    const altEl = document.getElementById('replay-alternatives');
    altEl.innerHTML = `<div style="font-size:11px;color:#64748b;padding:8px">Alternative actions were evaluated by the decision engine during this event. The action with lowest risk that remained feasible was selected: <strong style="color:#10b981">${Security.escapeHTML(ev.action || '—')}</strong>.</div>`;
  }

  // ══════════════════════════════════════════════════════════
  // REPORTS
  // ══════════════════════════════════════════════════════════
  function refreshReports() {
    const metrics = document.getElementById('report-metrics');
    if (!metrics) return;
    const data = DatasetManager.getModelComparisonData()['IndiDrive-V3'];
    metrics.innerHTML = [
      ['Safety Score',      `${data.safety_score}%`],
      ['Collision Rate',    `${(data.collision_rate*100).toFixed(1)}%`],
      ['Prediction Acc',   `${(data.prediction_accuracy*100).toFixed(0)}%`],
      ['Replan Latency',   `${data.replanning_latency} ms`],
      ['Path Smoothness',  `${(data.path_smoothness*100).toFixed(0)}%`],
      ['Scenario Success', `${(data.scenario_success_rate*100).toFixed(0)}%`],
    ].map(([k,v]) => `<div class="met-item"><div class="met-label">${k}</div><div class="met-val">${Security.escapeHTML(v)}</div></div>`).join('');

    const history = document.getElementById('report-run-history');
    const testR   = App.testResults;
    history.innerHTML = testR.length
      ? testR.slice(-10).map(r => `
          <div class="list-item">
            <span style="font-size:11px">Level ${r.level} — ${r.levelName}</span>
            <span style="font-size:11px;color:${r.passed?'#10b981':'#ef4444'};font-weight:700">${r.score.toFixed(0)}%</span>
          </div>`).join('')
      : '<div class="empty-state">No test runs yet.</div>';

    const recs = document.getElementById('report-recommendations');
    const sugg = TestEngine.generateSuggestions(
      App.testResults.flatMap(r => r.results?.filter(t => !t.passed) || []).slice(0, 8)
    );
    recs.innerHTML = sugg.slice(0, 4).map(s => `
      <div class="list-item">
        <span style="font-size:11px">${Security.escapeHTML(s.test)}</span>
        <span style="font-size:9px;font-weight:700;color:${s.priority==='HIGH'?'#ef4444':s.priority==='MEDIUM'?'#f59e0b':'#10b981'}">${s.priority}</span>
      </div>`).join('');
  }

  // ══════════════════════════════════════════════════════════
  // SECURITY PAGE
  // ══════════════════════════════════════════════════════════
  function initSecurityPage() {
    document.getElementById('btn-run-sec-check').addEventListener('click', runSecurityCheck);
    renderFrontendSecurityChecks();
  }

  function renderFrontendSecurityChecks() {
    const el = document.getElementById('sec-frontend-checks');
    if (!el) return;
    const checks = Security.getSecurityStatus();
    el.innerHTML = Object.entries(checks).map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<div class="sec-check">
        <span class="sec-icon">${v ? '✅' : '❌'}</span>
        <span class="sec-label" style="font-size:12px;color:#e2e8f0">${Security.escapeHTML(label)}</span>
        <span class="sec-status ${v?'pass':'fail'}">${v?'PASS':'FAIL'}</span>
      </div>`;
    }).join('');
  }

  async function runSecurityCheck() {
    if (!App.serverOnline) {
      document.getElementById('sec-backend-checks').innerHTML = '<div class="empty-state">Server offline — cannot check backend.</div>';
      return;
    }
    const r = await Security.apiGet('/api/security/status');
    if (!r?.success) { document.getElementById('sec-backend-checks').innerHTML = '<div class="empty-state">Security check failed.</div>'; return; }
    const el = document.getElementById('sec-backend-checks');
    const d  = r.data;
    el.innerHTML = Object.entries(d).filter(([k]) => k !== 'status').map(([k, v]) => {
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return `<div class="sec-check">
        <span class="sec-icon">${v ? '✅' : '❌'}</span>
        <span class="sec-label">${Security.escapeHTML(label)}</span>
        <span class="sec-status ${v?'pass':'fail'}">${v ? 'PASS' : 'FAIL'}</span>
      </div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════
  // UTILITIES
  // ══════════════════════════════════════════════════════════
  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val ?? '');
  }

  function setTextClass(id, cls) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = el.className.replace(/risk-\w+/g, '').trim();
    el.classList.add(cls);
  }

  function navigateTo(page) {
    const item = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (item) item.click();
  }

  function bindSlider(sliderId, valId) {
    const sl = document.getElementById(sliderId);
    const vl = document.getElementById(valId);
    if (!sl || !vl) return;
    sl.addEventListener('input', () => { vl.textContent = sl.value; });
  }

  function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  function hexToRGBStr(hex) {
    if (!hex || hex.length < 7) return '128,128,128';
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  // Make hexToRGBStr available for modules
  window.hexToRGBStr = hexToRGBStr;

})();
