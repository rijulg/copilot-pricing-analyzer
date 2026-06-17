// State: selected models -> { modelId, prompts }
const selected = [];

// Which chart(s) to show: "both" | "cost" | "breakeven".
let chartView = "both";

// Per-chart x-axis zoom factor (>1 zooms in / shrinks the visible range,
// <1 zooms out / shows more). Adjusted by the per-chart zoom buttons.
const zoom = { cost: 1, breakeven: 1 };

const $ = (id) => document.getElementById(id);

function getProfile() {
  return {
    input: +$("tokIn").value || 0,
    cached: +$("tokCached").value || 0,
    cacheWrite: +$("tokCacheWrite").value || 0,
    output: +$("tokOut").value || 0,
    growth: +$("tokGrowth").value || 0,
  };
}

// Cost of a single isolated prompt (turn 1, before any history accumulates).
function costPerPrompt(model, p) {
  return (
    (p.input * model.input) +
    (p.cached * model.cached) +
    (p.cacheWrite * model.cacheWrite) +
    (p.output * model.output)
  ) / 1000000;
}

// Context explosion: each turn re-reads the conversation history that has piled
// up so far (prior messages, tool results, re-read files) as cached input. After
// k-1 previous turns the context has grown by (k-1)·growth cached tokens, so the
// k-th prompt costs `base + (k-1)·delta`, where delta is the price of one growth
// step's worth of cached reads.
function growthStepCost(model, p) {
  return (p.growth * model.cached) / 1000000;
}

function costAtPrompt(model, p, k) {
  return costPerPrompt(model, p) + (k - 1) * growthStepCost(model, p);
}

// Cumulative cost of n prompts = n·base + delta·n(n-1)/2 (closed form of the
// arithmetic series). Accepts fractional n for smooth chart curves.
function cumulativeCost(model, p, n) {
  const base = costPerPrompt(model, p);
  const delta = growthStepCost(model, p);
  return n * base + delta * (n * (n - 1)) / 2;
}

// Smallest n where the cheaper model's cumulative cost reaches `target` spend.
// Solves (delta/2)n^2 + (base - delta/2)n - target = 0 for the positive root.
function breakEvenPrompts(model, p, target) {
  const base = costPerPrompt(model, p);
  const delta = growthStepCost(model, p);
  if (delta <= 0) return base > 0 ? target / base : Infinity;
  const a = delta / 2;
  const b = base - delta / 2;
  const c = -target;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return Infinity;
  return (-b + Math.sqrt(disc)) / (2 * a);
}

function fmt(n) {
  if (n >= 1) return "$" + n.toFixed(3);
  return "$" + n.toFixed(5);
}

function populatePicker() {
  const sel = $("modelPicker");
  sel.innerHTML = "";
  let currentProvider = "";
  MODELS.forEach((m) => {
    if (m.provider !== currentProvider) {
      currentProvider = m.provider;
      const og = document.createElement("optgroup");
      og.label = m.provider;
      og.dataset.provider = m.provider;
      sel.appendChild(og);
    }
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name + " (" + m.tier + ")";
    sel.querySelector('optgroup[data-provider="' + m.provider + '"]').appendChild(opt);
  });
}

function addModel(modelId, prompts) {
  prompts = prompts || 1;
  if (selected.some((s) => s.modelId === modelId)) return;
  selected.push({ modelId: modelId, prompts: prompts });
  render();
}

function removeModel(modelId) {
  const i = selected.findIndex((s) => s.modelId === modelId);
  if (i >= 0) selected.splice(i, 1);
  render();
}

function renderModelList() {
  const list = $("modelList");
  list.innerHTML = "";
  $("emptyMsg").style.display = selected.length ? "none" : "block";
  const p = getProfile();
  selected.forEach((s) => {
    const m = MODELS.find((x) => x.id === s.modelId);
    const cpp = costPerPrompt(m, p);
    const card = document.createElement("div");
    card.className = "modelcard";
    card.innerHTML =
      '<div class="minfo">' +
        '<div class="name">' + m.name + '</div>' +
        '<div class="sub">' + m.provider + ' · ' + m.tier + ' · <span class="cpp">' + fmt(cpp) + '</span>/1st prompt</div>' +
      '</div>' +
      '<input type="range" min="1" max="20" step="1" value="' + Math.min(20, s.prompts) + '" data-range="' + m.id + '" />' +
      '<input class="promptnum" type="number" min="1" step="1" value="' + s.prompts + '" data-prompts="' + m.id + '" />' +
      '<button class="remove" title="Remove" data-remove="' + m.id + '">✕</button>';
    list.appendChild(card);
  });
  list.querySelectorAll("[data-remove]").forEach((b) =>
    b.addEventListener("click", () => removeModel(b.dataset.remove))
  );
  function applyPrompts(id, val) {
    const s = selected.find((x) => x.modelId === id);
    if (!s) return;
    s.prompts = Math.max(1, Math.round(val) || 1);
    const range = list.querySelector('[data-range="' + id + '"]');
    const num = list.querySelector('[data-prompts="' + id + '"]');
    if (range) range.value = Math.min(20, s.prompts);
    if (num && +num.value !== s.prompts) num.value = s.prompts;
    renderResults();
    renderCharts();
    renderDerivation();
    updateURL();
  }
  list.querySelectorAll("[data-range]").forEach((inp) =>
    inp.addEventListener("input", () => applyPrompts(inp.dataset.range, +inp.value))
  );
  list.querySelectorAll("[data-prompts]").forEach((inp) =>
    inp.addEventListener("input", () => applyPrompts(inp.dataset.prompts, +inp.value))
  );
}

function computeRows() {
  const p = getProfile();
  return selected.map((s) => {
    const m = MODELS.find((x) => x.id === s.modelId);
    const cpp = costPerPrompt(m, p);
    const total = cumulativeCost(m, p, s.prompts);
    return { model: m, cpp: cpp, prompts: s.prompts, total: total, avg: total / s.prompts };
  });
}

function renderResults() {
  const rows = computeRows();
  const tbody = $("resultsTable").querySelector("tbody");
  tbody.innerHTML = "";
  if (!rows.length) { $("takeaway").style.display = "none"; return; }
  const sorted = rows.slice().sort((a, b) => a.total - b.total);
  const min = sorted[0].total;
  sorted.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.total === min) tr.className = "cheapest";
    const badge = r.total === min
      ? '<span class="pill win">cheapest</span>'
      : '<span class="pill">+' + (((r.total - min) / min) * 100).toFixed(0) + '%</span>';
    tr.innerHTML =
      '<td>' + r.model.name + '</td>' +
      '<td class="cpp">' + fmt(r.avg) + '</td>' +
      '<td>' + r.prompts + '</td>' +
      '<td class="cpp">' + fmt(r.total) + '</td>' +
      '<td>' + badge + '</td>';
    tbody.appendChild(tr);
  });
  renderTakeaway(sorted);
}

function renderTakeaway(sorted) {
  const box = $("takeaway");
  if (sorted.length < 2) { box.style.display = "none"; return; }
  const p = getProfile();
  const cheap = sorted[0];
  const next = sorted[1];
  const cheapestPerPrompt = sorted.slice().sort((a, b) => a.cpp - b.cpp)[0];
  const pricestPerPrompt = sorted.slice().sort((a, b) => b.cpp - a.cpp)[0];
  let msg = "<strong>" + cheap.model.name + "</strong> is cheapest at <strong>" + fmt(cheap.total) + "</strong> (" +
    cheap.prompts + " prompt" + (cheap.prompts > 1 ? "s" : "") + "), beating " + next.model.name +
    " by " + (((next.total - cheap.total) / cheap.total) * 100).toFixed(0) + "%.";
  if (cheapestPerPrompt.model.id !== pricestPerPrompt.model.id) {
    const breakeven = breakEvenPrompts(cheapestPerPrompt.model, p, pricestPerPrompt.total);
    msg += "<br><span class=\"muted\">Break-even:</span> " + pricestPerPrompt.model.name + " at " +
      pricestPerPrompt.prompts + " prompt" + (pricestPerPrompt.prompts > 1 ? "s" : "") +
      " costs the same as " + cheapestPerPrompt.model.name + " running <strong>" + breakeven.toFixed(1) +
      "</strong> prompts. If " + cheapestPerPrompt.model.name + " needs more than " + Math.floor(breakeven) +
      " prompts, " + pricestPerPrompt.model.name + " wins. <span class=\"muted\">Context growth makes each extra prompt cost more than the last.</span>";
  }
  box.innerHTML = msg;
  box.style.display = "block";
}

function renderChart() {
  const rows = computeRows();
  const chart = $("chart");
  const legend = $("legend");
  legend.innerHTML = "";
  if (!rows.length) { chart.innerHTML = '<p class="muted">Add models to see the chart.</p>'; return; }

  const p = getProfile();
  const W = 720, H = 240, pad = { l: 56, r: 24, t: 16, b: 38 };

  // Most expensive model (by first-prompt cost) is the break-even reference.
  // Each cheaper model has its own break-even: how many prompts it would take to
  // spend the same as the most expensive model's chosen total. With context
  // explosion the cost curves bend upward, so break-even is solved, not divided.
  const expCpp = rows.slice().sort((a, b) => b.cpp - a.cpp)[0];
  const breakevens = rows
    .filter((r) => r.model.id !== expCpp.model.id && r.cpp > 0 && r.cpp < expCpp.cpp)
    .map((r) => ({ row: r, x: breakEvenPrompts(r.model, p, expCpp.total) }))
    .filter((b) => isFinite(b.x))
    .sort((a, b) => a.x - b.x);
  const maxBeX = breakevens.reduce((m, b) => Math.max(m, b.x), 0);

  // Focus the x-axis on the data region (chosen prompts + break-even), not a fixed width
  const maxPrompt = Math.max(...rows.map((r) => r.prompts));
  const baseXMax = Math.max(4, Math.ceil(Math.max(maxPrompt + 1, maxBeX * 1.3)));
  const xMax = Math.max(2, Math.round(baseXMax / zoom.cost));
  const yMax = (Math.max(...rows.map((r) => cumulativeCost(r.model, p, xMax))) * 1.05) || 1;

  const xScale = (x) => pad.l + (x / xMax) * (W - pad.l - pad.r);
  const yScale = (y) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Break-even chart">';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yv = (yMax / yTicks) * i;
    const y = yScale(yv);
    svg += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" stroke="#21262d" />';
    svg += '<text x="' + (pad.l - 6) + '" y="' + (y + 3) + '" fill="#8b949e" font-size="8" text-anchor="end">$' + yv.toFixed(yv < 0.1 ? 4 : 3) + '</text>';
  }
  const xTicks = Math.min(xMax, 10);
  for (let i = 0; i <= xTicks; i++) {
    const xv = Math.round((xMax / xTicks) * i);
    const x = xScale(xv);
    svg += '<line x1="' + x + '" y1="' + pad.t + '" x2="' + x + '" y2="' + (H - pad.b) + '" stroke="#161b22" />';
    svg += '<text x="' + x + '" y="' + (H - pad.b + 14) + '" fill="#8b949e" font-size="8" text-anchor="middle">' + xv + '</text>';
  }
  svg += '<text x="' + ((pad.l + W - pad.r) / 2) + '" y="' + (H - 6) + '" fill="#8b949e" font-size="9" text-anchor="middle">Prompts to finish task</text>';

  // Cumulative cost curves (bend upward as context grows) + chosen-prompt dots
  rows.forEach((r, i) => {
    const color = COLORS[i % COLORS.length];
    const steps = 60;
    let pts = "";
    for (let s = 0; s <= steps; s++) {
      const xv = (xMax / steps) * s;
      pts += xScale(xv).toFixed(1) + "," + yScale(cumulativeCost(r.model, p, xv)).toFixed(1) + " ";
    }
    svg += '<polyline points="' + pts.trim() + '" fill="none" stroke="' + color + '" stroke-width="2" opacity="0.85" />';
    const mx = xScale(r.prompts), my = yScale(r.total);
    svg += '<circle cx="' + mx + '" cy="' + my + '" r="5" fill="' + color + '" stroke="#0d1117" stroke-width="1.5" />';
    const sw = document.createElement("span");
    sw.innerHTML = '<span class="swatch" style="background:' + color + '"></span>' + r.model.name + ' · ' + fmt(r.total);
    legend.appendChild(sw);
  });

  // Break-even markers: where each cheaper model's cost curve reaches the most
  // expensive model's total. Reference level + one marker per cheaper model.
  if (breakevens.length) {
    const refY = yScale(expCpp.total);
    svg += '<line x1="' + pad.l + '" y1="' + refY + '" x2="' + (W - pad.r) + '" y2="' + refY + '" stroke="#8b949e" stroke-width="1" stroke-dasharray="2 4" opacity="0.5" />';
    breakevens.forEach((b, idx) => {
      if (b.x <= 0 || b.x > xMax) return;
      const bx = xScale(b.x);
      const color = COLORS[rows.indexOf(b.row) % COLORS.length];
      svg += '<line x1="' + bx + '" y1="' + (H - pad.b) + '" x2="' + bx + '" y2="' + pad.t + '" stroke="' + color + '" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7" />';
      svg += '<circle cx="' + bx + '" cy="' + refY + '" r="4" fill="none" stroke="' + color + '" stroke-width="2" />';
      const labelY = pad.t + 9 + (idx % 2) * 12;
      svg += '<text x="' + (bx + 5) + '" y="' + labelY + '" fill="' + color + '" font-size="9" font-weight="600">' + b.x.toFixed(1) + '</text>';
    });
  }

  svg += '</svg>';
  chart.innerHTML = svg;
}

// Second chart: how the break-even point scales. For the most expensive model
// (reference E) running k prompts, each cheaper model C can run breakEven(C, E@k)
// prompts for the same spend. Plot that break-even count (y) against the
// reference's prompt count (x), so you can see how much head-room each cheaper
// model gains as the pricier one is used for longer tasks.
function renderChart2() {
  const rows = computeRows();
  const chart = $("chart2");
  const legend = $("legend2");
  legend.innerHTML = "";
  if (!rows.length) { chart.innerHTML = '<p class="muted">Add models to see the chart.</p>'; return; }

  const p = getProfile();
  const exp = rows.slice().sort((a, b) => b.cpp - a.cpp)[0];
  const cheaper = rows.filter((r) => r.model.id !== exp.model.id && r.cpp > 0 && r.cpp < exp.cpp);
  if (!cheaper.length) {
    chart.innerHTML = '<p class="muted">Add a cheaper-per-prompt model to see break-even scaling against ' + exp.model.name + '.</p>';
    return;
  }

  const W = 720, H = 240, pad = { l: 56, r: 24, t: 16, b: 38 };

  // x-axis = reference model's prompt count. Default to a wide range so the
  // break-even scaling is visible far out; zoom narrows or widens it on demand.
  const dataMax = Math.max(exp.prompts + 2, Math.max(...rows.map((r) => r.prompts)) + 1);
  const baseXMax = Math.max(50, Math.ceil(dataMax));
  const xMax = Math.max(4, Math.round(baseXMax / zoom.breakeven));

  // breakEven for cheaper model C when reference E has run k prompts.
  const beAt = (model, k) => breakEvenPrompts(model, p, cumulativeCost(exp.model, p, k));

  let yMax = xMax; // the y=x reference line reaches xMax
  cheaper.forEach((r) => {
    const be = beAt(r.model, xMax);
    if (isFinite(be)) yMax = Math.max(yMax, be);
  });
  yMax = (yMax * 1.08) || 1;

  const xScale = (x) => pad.l + (x / xMax) * (W - pad.l - pad.r);
  const yScale = (y) => H - pad.b - (y / yMax) * (H - pad.t - pad.b);

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Break-even scaling chart">';
  const yTicks = 5;
  for (let i = 0; i <= yTicks; i++) {
    const yv = (yMax / yTicks) * i;
    const y = yScale(yv);
    svg += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (W - pad.r) + '" y2="' + y + '" stroke="#21262d" />';
    svg += '<text x="' + (pad.l - 6) + '" y="' + (y + 3) + '" fill="#8b949e" font-size="8" text-anchor="end">' + yv.toFixed(yv < 10 ? 1 : 0) + '</text>';
  }
  const xTicks = Math.min(xMax, 10);
  for (let i = 0; i <= xTicks; i++) {
    const xv = Math.round((xMax / xTicks) * i);
    const x = xScale(xv);
    svg += '<line x1="' + x + '" y1="' + pad.t + '" x2="' + x + '" y2="' + (H - pad.b) + '" stroke="#161b22" />';
    svg += '<text x="' + x + '" y="' + (H - pad.b + 14) + '" fill="#8b949e" font-size="8" text-anchor="middle">' + xv + '</text>';
  }
  svg += '<text x="' + ((pad.l + W - pad.r) / 2) + '" y="' + (H - 6) + '" fill="#8b949e" font-size="9" text-anchor="middle">' + exp.model.name + ' prompts (reference)</text>';
  svg += '<text transform="translate(14,' + ((pad.t + H - pad.b) / 2) + ') rotate(-90)" fill="#8b949e" font-size="9" text-anchor="middle">Break-even prompts</text>';

  // Reference: a cheaper model breaks even where its cost matches E. E itself sits
  // on the y=x identity line (it always "breaks even" with itself at k prompts).
  const expColor = COLORS[rows.indexOf(exp) % COLORS.length];
  svg += '<line x1="' + xScale(0) + '" y1="' + yScale(0) + '" x2="' + xScale(xMax) + '" y2="' + yScale(xMax) + '" stroke="' + expColor + '" stroke-width="1.5" stroke-dasharray="2 4" opacity="0.6" />';
  const expSw = document.createElement("span");
  expSw.innerHTML = '<span class="swatch" style="background:' + expColor + '"></span>' + exp.model.name + ' (reference)';
  legend.appendChild(expSw);

  // One curve per cheaper model: break-even prompts vs reference prompts.
  cheaper.forEach((r) => {
    const color = COLORS[rows.indexOf(r) % COLORS.length];
    const steps = 60;
    let pts = "";
    for (let s = 0; s <= steps; s++) {
      const xv = (xMax / steps) * s;
      const be = beAt(r.model, xv);
      if (!isFinite(be)) continue;
      pts += xScale(xv).toFixed(1) + "," + yScale(Math.min(be, yMax)).toFixed(1) + " ";
    }
    svg += '<polyline points="' + pts.trim() + '" fill="none" stroke="' + color + '" stroke-width="2" opacity="0.85" />';
    const sw = document.createElement("span");
    sw.innerHTML = '<span class="swatch" style="background:' + color + '"></span>' + r.model.name;
    legend.appendChild(sw);
  });

  // Marker at the reference's chosen prompt count: the break-even values currently
  // shown on the first chart, read off here as the head-room each model has.
  const markX = xScale(exp.prompts);
  svg += '<line x1="' + markX + '" y1="' + (H - pad.b) + '" x2="' + markX + '" y2="' + pad.t + '" stroke="#8b949e" stroke-width="1" stroke-dasharray="4 4" opacity="0.5" />';
  cheaper.forEach((r) => {
    const be = beAt(r.model, exp.prompts);
    if (!isFinite(be) || be > yMax) return;
    const color = COLORS[rows.indexOf(r) % COLORS.length];
    const my = yScale(be);
    svg += '<circle cx="' + markX + '" cy="' + my + '" r="4" fill="' + color + '" stroke="#0d1117" stroke-width="1.5" />';
    svg += '<text x="' + (markX + 5) + '" y="' + (my - 4) + '" fill="' + color + '" font-size="9" font-weight="600">' + be.toFixed(1) + '</text>';
  });

  svg += '</svg>';
  chart.innerHTML = svg;
}

// Show/hide each graph block per the selected view and (re)render the visible ones.
function renderCharts() {
  const showCost = chartView === "both" || chartView === "cost";
  const showBe = chartView === "both" || chartView === "breakeven";
  $("chartBlock1").style.display = showCost ? "block" : "none";
  $("chartBlock2").style.display = showBe ? "block" : "none";
  document.querySelector(".chart-grid").classList.toggle("single", chartView !== "both");
  if (showCost) renderChart();
  if (showBe) renderChart2();
}

function setChartView(view) {
  chartView = view;
  $("chartToggle").querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  renderCharts();
}

// Zoom the x-axis of one chart in/out (or reset). Higher factor = narrower range.
function setZoom(chart, action) {
  if (action === "reset") zoom[chart] = 1;
  else if (action === "in") zoom[chart] = Math.min(8, zoom[chart] * 1.5);
  else if (action === "out") zoom[chart] = Math.max(0.125, zoom[chart] / 1.5);
  renderCharts();
}

function render() {
  renderModelList();
  renderResults();
  renderCharts();
  renderDerivation();
  updateURL();
}

// Group digits with thousands separators for readable worked examples.
function grp(n) { return n.toLocaleString("en-US"); }

// Plug the current token profile and selected models into each formula so the
// reader can follow the arithmetic with real numbers, not just symbols.
function renderDerivation() {
  const promptBox = $("derivPrompt");
  const totalBox = $("derivTotal");
  const beBox = $("derivBreakeven");
  if (!promptBox) return;

  const rows = computeRows();
  if (!rows.length) {
    promptBox.innerHTML = totalBox.innerHTML = beBox.innerHTML =
      '<span class="muted">Add at least one model to see the derivation with real numbers.</span>';
    return;
  }

  const p = getProfile();
  // Reference E = most expensive per prompt; C = cheapest per prompt.
  const byCpp = rows.slice().sort((a, b) => b.cpp - a.cpp);
  const E = byCpp[0];
  const C = byCpp[byCpp.length - 1];

  function promptDerivation(r) {
    const m = r.model;
    return '<div class="dwork"><span class="dlabel">' + m.name + '</span>' +
      'base = ( ' +
      grp(p.input) + '·' + m.input.toFixed(2) + ' + ' +
      grp(p.cached) + '·' + m.cached.toFixed(2) + ' + ' +
      grp(p.cacheWrite) + '·' + m.cacheWrite.toFixed(2) + ' + ' +
      grp(p.output) + '·' + m.output.toFixed(2) + ' ) / 1,000,000' +
      ' = <strong>' + fmt(r.cpp) + '</strong></div>';
  }

  // Section 1: base (first-prompt) cost for every selected model.
  promptBox.innerHTML =
    '<div class="dhead">With the current token profile (t<sub>in</sub>=' + grp(p.input) +
    ', t<sub>cache</sub>=' + grp(p.cached) + ', t<sub>write</sub>=' + grp(p.cacheWrite) +
    ', t<sub>out</sub>=' + grp(p.output) + '), the first prompt costs:</div>' +
    rows.map(promptDerivation).join("");

  // Section 2: context-growth step + cumulative total for every model.
  totalBox.innerHTML =
    '<div class="dhead">Each prompt adds g=' + grp(p.growth) +
    ' cached tokens of history, so the per-step surcharge is δ = ' + grp(p.growth) +
    '·p<sub>cache</sub>/1,000,000, and the total is n·base + δ·n(n−1)/2:</div>' +
    rows.map((r) => {
      const delta = growthStepCost(r.model, p);
      const n = r.prompts;
      return '<div class="dwork"><span class="dlabel">' + r.model.name + '</span>' +
        'δ = ' + grp(p.growth) + '·' + r.model.cached.toFixed(2) + '/1M = ' + fmt(delta) + '; ' +
        'total = ' + n + '·' + fmt(r.cpp) + ' + ' + fmt(delta) + '·' + n + '·' + (n - 1) + '/2' +
        ' = <strong>' + fmt(r.total) + '</strong></div>';
    }).join("");

  // Section 3: break-even of cheaper models against the most expensive one.
  if (rows.length < 2 || E.model.id === C.model.id || E.cpp <= 0) {
    beBox.innerHTML = '<span class="muted">Add a second, cheaper-per-prompt model to see a break-even number.</span>';
    return;
  }
  const cheaper = rows.filter((r) => r.model.id !== E.model.id && r.cpp > 0 && r.cpp < E.cpp)
    .sort((a, b) => a.cpp - b.cpp);
  let beHtml =
    '<div class="dhead">Reference E = <strong>' + E.model.name + '</strong> at ' +
    fmt(E.total) + ' (' + E.prompts + ' prompt' + (E.prompts > 1 ? 's' : '') +
    '). Solving (δ/2)n² + (base−δ/2)n − ' + fmt(E.total) + ' = 0:</div>';
  beHtml += cheaper.map((r) => {
    const be = breakEvenPrompts(r.model, p, E.total);
    const delta = growthStepCost(r.model, p);
    const detail = delta > 0
      ? 'base=' + fmt(r.cpp) + ', δ=' + fmt(delta) + ' → n'
      : 'n = ' + fmt(E.total) + ' / ' + fmt(r.cpp);
    return '<div class="dwork"><span class="dlabel">' + r.model.name + '</span>' +
      detail + ' = <strong>' + be.toFixed(1) + '</strong> prompts' +
      ' <span class="muted">→ past ' + Math.floor(be) + ', ' + E.model.name + ' wins</span></div>';
  }).join("");
  beBox.innerHTML = beHtml;
}

// Encode the current comparison (model + prompts) into the URL so it can be
// shared as a deep link, e.g. ?models=sonnet-4.6:2,opus-4.8:1
function updateURL() {
  const parts = selected.map((s) => s.modelId + ":" + s.prompts);
  const qs = parts.length ? "?models=" + encodeURIComponent(parts.join(",")) : "";
  history.replaceState(null, "", qs || location.pathname);
}

function parseURL() {
  const raw = new URLSearchParams(location.search).get("models");
  if (!raw) return false;
  let any = false;
  raw.split(",").forEach((tok) => {
    const bits = tok.split(":");
    const id = bits[0];
    const prompts = Math.max(1, parseInt(bits[1], 10) || 1);
    if (MODELS.some((m) => m.id === id) && !selected.some((s) => s.modelId === id)) {
      selected.push({ modelId: id, prompts: prompts });
      any = true;
    }
  });
  return any;
}

function init() {
  $("addBtn").addEventListener("click", () => addModel($("modelPicker").value));
  $("presetBtn").addEventListener("click", () => {
    selected.length = 0;
    addModel("sonnet-4.6", 2);
    addModel("opus-4.8", 1);
  });
  ["tokIn", "tokCached", "tokCacheWrite", "tokOut"].forEach((id) =>
    $(id).addEventListener("input", () => { renderModelList(); renderResults(); renderCharts(); renderDerivation(); })
  );

  $("chartToggle").querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => setChartView(b.dataset.view))
  );

  document.querySelectorAll(".zoom").forEach((z) =>
    z.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => setZoom(z.dataset.chart, b.dataset.zoom))
    )
  );

  populatePicker();
  // Deep link wins; otherwise start with the example scenario:
  // Sonnet 4.6 (2 prompts) vs Opus 4.8 (1 prompt).
  if (parseURL()) {
    render();
  } else {
    addModel("sonnet-4.6", 2);
    addModel("opus-4.8", 1);
  }
}

document.addEventListener("DOMContentLoaded", init);
