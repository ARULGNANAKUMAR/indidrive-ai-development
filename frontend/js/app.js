// ---------- Navigation ----------
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    const page = btn.dataset.page;
    document.getElementById(`page-${page}`).classList.add("active");
    document.getElementById("page-title").textContent = btn.textContent;
    loadPage(page);
  });
});

// ---------- Theme ----------
const root = document.documentElement;
document.getElementById("theme-toggle").addEventListener("click", () => {
  const cur = root.getAttribute("data-theme");
  root.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
});

// ---------- Page loaders ----------
function loadPage(page) {
  const loaders = {
    dashboard: loadDashboard,
    datasets: loadDatasets,
    models: loadModels,
    analytics: loadAnalytics,
    settings: loadSettings,
  };
  if (loaders[page]) loaders[page]();
}

async function refreshModeBadge() {
  try {
    const mode = await apiGet("/deployment/mode");
    document.getElementById("mode-badge").textContent = `mode: ${mode.mode}`;
  } catch (e) {
    document.getElementById("mode-badge").textContent = "mode: unreachable";
  }
}

// ---------- Dashboard ----------
async function loadDashboard() {
  const grid = document.getElementById("launcher-grid");
  grid.innerHTML = "<div class='muted'>Checking services…</div>";
  try {
    const status = await apiGet("/launcher/status");
    grid.innerHTML = Object.entries(status).map(([name, s]) => `
      <div class="stat-card">
        <div class="label">${name.replace(/_/g, " ")}</div>
        <div class="value"><span class="dot ${s.healthy ? "up" : "down"}"></span>${s.healthy ? "Online" : "Offline"}</div>
        <div class="muted">port ${s.port}</div>
      </div>`).join("");
  } catch (e) {
    grid.innerHTML = `<div class="muted">Phase 5 API unreachable at ${API_BASE}</div>`;
  }
  try {
    const overview = await apiGet("/analytics/overview");
    renderKV("analytics-overview", overview);
  } catch (e) {}
  refreshModeBadge();
}

function renderKV(elementId, obj) {
  const el = document.getElementById(elementId);
  el.innerHTML = Object.entries(obj).map(([k, v]) =>
    `<div class="kv"><strong>${k}</strong><br>${typeof v === "object" ? JSON.stringify(v) : v}</div>`).join("");
}

// ---------- Datasets ----------
async function loadDatasets() {
  const list = document.getElementById("dataset-list");
  list.innerHTML = "<div class='muted'>Loading…</div>";
  try {
    const datasets = await apiGet("/datasets");
    list.innerHTML = datasets.length ? datasets.map(d => `
      <div class="list-item">
        <span>${d.name} — ${d.total_images} images, ${d.total_videos} videos (dup removed: ${d.duplicates_removed})</span>
        <span class="muted">${d.dataset_id}</span>
      </div>`).join("") : "<div class='muted'>No datasets yet.</div>";
  } catch (e) {
    list.innerHTML = "<div class='muted'>Could not load datasets.</div>";
  }
}

async function createDataset() {
  const name = document.getElementById("ds-name").value.trim();
  if (!name) return;
  await apiPost("/datasets", { name });
  document.getElementById("ds-name").value = "";
  loadDatasets();
}

// ---------- Models ----------
async function loadModels() {
  const list = document.getElementById("model-list");
  try {
    const data = await apiGet("/models");
    list.innerHTML = data.models.map(m => `
      <div class="list-item">
        <span>${m.name} (${m.role}) v${m.version} ${data.active[m.role] === m.model_id ? "★ active" : ""}</span>
        <span class="muted">${m.model_id}</span>
      </div>`).join("");
    const compare = await apiGet("/models/compare");
    document.getElementById("model-compare").innerHTML = compare.map(m =>
      `<div class="list-item"><span>${m.name}</span><span>mAP50: ${m.metrics.map50 ?? "—"}</span></div>`).join("");
  } catch (e) {
    list.innerHTML = "<div class='muted'>Could not load models.</div>";
  }
}

// ---------- Testing ----------
async function runBenchmark() {
  const out = document.getElementById("benchmark-results");
  out.innerHTML = "<div class='muted'>Running full benchmark…</div>";
  try {
    const result = await apiPost("/benchmark/run", { seed: Date.now() % 1000 });
    renderKV("benchmark-results", { overall_score: result.overall_score, engine_live: result.engine_live,
      ...Object.fromEntries(Object.entries(result.results).map(([k, v]) => [k, v.score])) });
  } catch (e) {
    out.innerHTML = "<div class='muted'>Benchmark failed to run.</div>";
  }
}

// ---------- Reports ----------
async function runBenchmarkAndReport() {
  const out = document.getElementById("report-links");
  out.innerHTML = "<div class='muted'>Running benchmark and generating reports…</div>";
  try {
    const res = await apiPost("/benchmark/run_and_report", { seed: Date.now() % 1000 });
    const files = res.report_files;
    out.innerHTML = Object.entries(files).map(([type, path]) =>
      `<div class="list-item"><span>${type.toUpperCase()} report</span>
       <a class="btn" href="${API_BASE}/reports/download?path=${encodeURIComponent(path)}">Download</a></div>`).join("");
  } catch (e) {
    out.innerHTML = "<div class='muted'>Could not generate reports.</div>";
  }
}

// ---------- Analytics / ECHO ----------
async function loadAnalytics() {
  try {
    const growth = await apiGet("/echo/memory_growth");
    renderKV("echo-growth", growth);
  } catch (e) {}
}
async function clusterEcho() { await apiPost("/echo/cluster"); loadAnalytics(); }
async function promotePrinciples() { await apiPost("/echo/promote_principles"); loadAnalytics(); }
async function promoteCapabilities() { await apiPost("/echo/promote_capabilities"); loadAnalytics(); }

// ---------- Settings ----------
async function loadSettings() {
  try {
    const modes = await apiGet("/deployment/modes");
    const current = await apiGet("/deployment/mode");
    const container = document.getElementById("mode-buttons");
    container.innerHTML = Object.keys(modes).map(m =>
      `<button class="btn" style="${m === current.mode ? '' : 'opacity:0.6'}" onclick="setMode('${m}')">${m}</button>`).join("");
  } catch (e) {}
}
async function setMode(mode) {
  await apiPost(`/deployment/mode/${mode}`);
  loadSettings();
  refreshModeBadge();
}

// ---------- Init ----------
loadDashboard();
