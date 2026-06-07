const state = {
  dashboard: null,
  sitePayloads: {},
  currentSiteId: null,
};

function fmt(value, digits = 2) {
  return Number(value).toFixed(digits);
}

function riskColor(score) {
  const hue = 150 - Math.round(score * 145);
  const sat = 68;
  const light = 46;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function createSummaryCard(card) {
  return `
    <article class="summary-card">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
      <small>${card.note}</small>
    </article>
  `;
}

function renderStationGrid(stations) {
  const grid = document.getElementById("station-grid");
  grid.innerHTML = stations
    .map((site) => {
      const active = site.site_id === state.currentSiteId ? "active" : "";
      return `
        <article class="station-card ${active}" data-site-id="${site.site_id}">
          <span>${site.region}</span>
          <h3>${site.site_name}</h3>
          <small>${site.capacity_mw} MW installed capacity</small>
          <div class="mini-kpis">
            <div class="mini-kpi">
              <span>Validation MAE</span>
              <strong>${fmt(site.validation_mae_mw)} MW</strong>
            </div>
            <div class="mini-kpi">
              <span>Avg Risk</span>
              <strong>${fmt(site.avg_risk, 3)}</strong>
            </div>
            <div class="mini-kpi">
              <span>Forecast Energy</span>
              <strong>${fmt(site.forecast_energy_mwh)} MWh</strong>
            </div>
            <div class="mini-kpi">
              <span>Action</span>
              <strong>${site.dominant_action}</strong>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  grid.querySelectorAll(".station-card").forEach((node) => {
    node.addEventListener("click", () => {
      const siteId = node.getAttribute("data-site-id");
      document.getElementById("site-selector").value = siteId;
      loadSite(siteId);
    });
  });
}

function linePath(points, width, height, maxValue, padding) {
  if (!points.length) return "";
  return points
    .map((value, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - (value / Math.max(maxValue, 1e-6)) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderPowerChart(site) {
  const svg = document.getElementById("power-chart");
  const width = 920;
  const height = 320;
  const padding = 30;
  const forecast = site.forecast_series.map((row) => row.predicted_power_mw);
  const dispatch = site.forecast_series.map((row) => row.dispatch_power_mw);
  const maxValue = Math.max(...forecast, ...dispatch, 1);
  const forecastPath = linePath(forecast, width, height, maxValue, padding);
  const dispatchPath = linePath(dispatch, width, height, maxValue, padding);

  const grid = Array.from({ length: 5 }, (_, idx) => {
    const y = padding + ((height - padding * 2) / 4) * idx;
    const labelValue = maxValue - (maxValue / 4) * idx;
    return `
      <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="gridline"></line>
      <text x="4" y="${y + 4}" class="axis-label">${fmt(labelValue, 0)} MW</text>
    `;
  }).join("");

  const xLabels = [0, 48, 96, 144, 191]
    .map((idx) => {
      const point = site.forecast_series[Math.min(idx, site.forecast_series.length - 1)];
      const x = padding + (Math.min(idx, site.forecast_series.length - 1) / Math.max(site.forecast_series.length - 1, 1)) * (width - padding * 2);
      return `<text x="${x}" y="${height - 6}" text-anchor="middle" class="axis-label">${point ? point.timestamp : ""}</text>`;
    })
    .join("");

  svg.innerHTML = `
    ${grid}
    <path d="${forecastPath}" class="path-forecast"></path>
    <path d="${dispatchPath}" class="path-dispatch"></path>
    ${xLabels}
  `;
}

function renderRiskBand(site) {
  const band = document.getElementById("risk-band");
  band.innerHTML = site.risk_band
    .map((cell) => `<div class="risk-cell" style="background:${riskColor(cell.risk_score)}" title="${cell.timestamp} | risk ${fmt(cell.risk_score, 3)} | ${cell.action_label}"></div>`)
    .join("");
}

function renderRlBars(policies) {
  const container = document.getElementById("rl-bars");
  const maxReward = Math.max(...policies.map((item) => item.avg_reward), 1);
  container.innerHTML = policies
    .map((item) => {
      const width = (item.avg_reward / maxReward) * 100;
      return `
        <div class="bar-row">
          <div>
            <strong>${item.policy}</strong><br>
            <small>incident ${fmt(item.incident_rate, 3)}</small>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <div>${fmt(item.avg_reward, 2)}</div>
        </div>
      `;
    })
    .join("");
}

function renderExperimentModules(modules) {
  const container = document.getElementById("experiment-modules");
  container.innerHTML = modules
    .map((item) => `
      <article class="experiment-card">
        <span>${item.module}</span>
        <strong>${item.algorithm}</strong>
        <small>${item.description}</small>
        <div class="mini-kpis">
          <div class="mini-kpi">
            <span>Avg Reward</span>
            <strong>${fmt(item.avg_reward)}</strong>
          </div>
          <div class="mini-kpi">
            <span>Incident</span>
            <strong>${fmt(item.incident_rate, 4)}</strong>
          </div>
        </div>
      </article>
    `)
    .join("");
}

function renderAlgorithmExamples(targetId, examples) {
  const container = document.getElementById(targetId);
  container.innerHTML = examples
    .map((item) => `
      <article class="example-card">
        <span>${item.site_id} · ${item.date}</span>
        <strong>Reward ${fmt(item.reward)} / Incident ${fmt(item.incident_rate, 4)}</strong>
        <small>前 12 个动作片段</small>
        <div class="action-seq">${item.actions.join(" → ")}</div>
      </article>
    `)
    .join("");
}

function renderRiskTable(rows) {
  const node = document.getElementById("risk-table");
  node.innerHTML = rows
    .map((row) => `
      <div class="table-row">
        <strong>${row.site_id}</strong>
        <span>${row.timestamp}</span>
        <span class="risk-pill" style="background:${riskColor(row.risk_score)}">${fmt(row.risk_score, 3)}</span>
        <span>${row.action_label}</span>
      </div>
    `)
    .join("");
}

function updateSiteSelector(stations) {
  const selector = document.getElementById("site-selector");
  selector.innerHTML = stations
    .map((site) => `<option value="${site.site_id}">${site.site_name}</option>`)
    .join("");
  selector.value = state.currentSiteId;
  selector.addEventListener("change", () => loadSite(selector.value));
}

async function loadDashboard() {
  const response = await fetch("/api/dashboard");
  const payload = await response.json();
  state.dashboard = payload;
  state.currentSiteId = payload.station_overview[0].site_id;

  document.getElementById("agent-status").textContent = "模型与策略已就绪";
  document.getElementById("agent-substatus").textContent = "Forecast / Search / GA / RL / QA";
  document.getElementById("meta-range").textContent = `训练期 ${payload.meta.train_range[0]} 至 ${payload.meta.train_range[1]}，测试期 ${payload.meta.test_range[0]} 至 ${payload.meta.test_range[1]}`;
  const backend = payload.agent_backend;
  document.getElementById("agent-backend-label").textContent = backend.available ? `${backend.backend} · ${backend.model}` : "rule-based fallback";
  document.getElementById("agent-backend-note").textContent = backend.message;
  document.getElementById("summary-cards").innerHTML = payload.summary_cards.map(createSummaryCard).join("");

  updateSiteSelector(payload.station_overview);
  renderStationGrid(payload.station_overview);
  renderRlBars(payload.rl_comparison);
  renderExperimentModules(payload.experiment_modules);
  renderAlgorithmExamples("heuristic-examples", payload.heuristic_examples);
  renderAlgorithmExamples("ga-examples", payload.ga_examples);
  renderRiskTable(payload.top_risk_windows);
  await loadSite(state.currentSiteId);
}

async function loadSite(siteId) {
  if (!state.sitePayloads[siteId]) {
    const response = await fetch(`/api/site/${siteId}`);
    state.sitePayloads[siteId] = await response.json();
  }
  state.currentSiteId = siteId;
  renderStationGrid(state.dashboard.station_overview);
  const site = state.sitePayloads[siteId];
  renderPowerChart(site);
  renderRiskBand(site);
}

async function askQuestion() {
  const input = document.getElementById("question-input");
  const answerBox = document.getElementById("answer-box");
  const question = input.value.trim();
  if (!question) {
    answerBox.textContent = "请先输入问题。";
    return;
  }

  answerBox.textContent = "智能体正在分析问题...";
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const payload = await response.json();
  const meta = document.getElementById("answer-meta");
  meta.textContent = payload.backend === "ollama" ? `本次回答来自本地模型 ${payload.model}` : "本次回答来自内置规则问答";
  answerBox.textContent = payload.answer || "暂无回答。";
}

window.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("ask-button").addEventListener("click", askQuestion);
  await loadDashboard();
});
