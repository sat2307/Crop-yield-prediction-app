/* dashboard.js — interactive logic for Ultra Crop Insights */

/* SAMPLE fallback data (if no server-side injection) */
const SAMPLE_DATA = {
  village: "DemoVillage",
  forecast: {
    Rainfall_Q1: 120, Temp_Q1: 22,
    Rainfall_Q2: 85, Temp_Q2: 28,
    Rainfall_Q3: 210, Temp_Q3: 26,
    Rainfall_Q4: 60, Temp_Q4: 20
  },
  village_avg: { avg_temp: 24.0, avg_rain: 118.75 },
  results: [
    {
      crop: "Paddy",
      predicted_yield: 12450,
      total_pesticide: 4.2,
      pest_per_quarter: { Pest_Q1: 1.0, Pest_Q2: 1.1, Pest_Q3: 1.0, Pest_Q4: 1.1 },
      yield_pest_plus: 13000,
      yield_pest_minus: 11800,
      yield_weather_plus: 13300,
      yield_weather_minus: 11500,
      pct_pest_plus: 4.54,
      pct_pest_minus: -5.21,
      pct_weather_plus: 6.78,
      pct_weather_minus: -7.65,
      top_positive_factors: [["Rainfall_Q3", 21514.1143, 2.306], ["Pest_Q2", 2594.3265,0.278], ["Pest_Q3",62.3006,0.007]],
      top_negative_factors: [["Pest_Q1",-299.8775,-0.032], ["Temp_Q2",-286.6115,-0.031], ["Pest_Q4",-228.4168,-0.024]]
    },
    {
      crop: "Maize",
      predicted_yield: 10240,
      total_pesticide: 3.7,
      pest_per_quarter: { Pest_Q1: 0.9, Pest_Q2: 0.8, Pest_Q3: 1.0, Pest_Q4: 1.0 },
      yield_pest_plus: 10800,
      yield_pest_minus: 9900,
      yield_weather_plus: 11050,
      yield_weather_minus: 9600,
      pct_pest_plus: 5.47,
      pct_pest_minus: -3.32,
      pct_weather_plus: 7.96,
      pct_weather_minus: -6.25,
      top_positive_factors: [["Rainfall_Q2", 15200.5, 1.48], ["Pest_Q1", 1200.5,0.12], ["Temp_Q3",48.3,0.005]],
      top_negative_factors: [["Pest_Q4",-400.2,-0.39], ["Temp_Q1",-200.0,-0.19], ["Rainfall_Q4",-150.3,-0.14]]
    },
    {
      crop: "Jowar",
      predicted_yield: 8900,
      total_pesticide: 2.9,
      pest_per_quarter: { Pest_Q1: 0.5, Pest_Q2: 0.6, Pest_Q3: 0.9, Pest_Q4: 0.9 },
      yield_pest_plus: 9150,
      yield_pest_minus: 8600,
      yield_weather_plus: 9400,
      yield_weather_minus: 8200,
      pct_pest_plus: 2.81,
      pct_pest_minus: -3.37,
      pct_weather_plus: 5.62,
      pct_weather_minus: -7.86,
      top_positive_factors: [["Temp_Q3",800.3,0.9], ["Rainfall_Q3",500.0,0.56], ["Pest_Q3",50.0,0.05]],
      top_negative_factors: [["Pest_Q1",-120.0,-0.13], ["Temp_Q2",-90.0,-0.1], ["Pest_Q4",-70.0,-0.08]]
    }
  ]
};

/* Pick data: prefer server-provided if exists */
const DATA = window.SERVER_DATA && typeof window.SERVER_DATA === 'object' ? window.SERVER_DATA : SAMPLE_DATA;
let VILLAGE = DATA.village || "Unknown";
let FORECAST = DATA.forecast || {};
let VILLAGE_AVG = DATA.village_avg || {};
let RESULTS = DATA.results || [];

/* helper format */
function fmt(n){
  if(n===null || n===undefined) return '—';
  if(typeof n === 'number') return n.toLocaleString(undefined,{maximumFractionDigits:2});
  return n;
}

/* Initialize UI */
function initUI(){
  document.getElementById('topSubtitle').textContent = `Village: ${VILLAGE} · Quarterly analysis`;
  animateKPI('kpiTopYield', RESULTS[0] ? RESULTS[0].predicted_yield : 0);
  animateKPI('kpiTopPest', RESULTS[0] ? RESULTS[0].total_pesticide : 0);
  animateKPI('kpiParams', Object.keys(FORECAST).length);
  renderYields(RESULTS);
  populateSim(RESULTS);
  renderPestTable();
  renderFactors();
  renderWeatherAvg();
  drawGlobalChart('pesticide');
  drawCorrHeat();
  drawWeatherTrend();
  attachControls();
}

/* CountUp */
function animateKPI(id, value){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = '';
  const num = new countUp.CountUp(el, Number(value || 0), { duration: 1.2, separator: ',' });
  if(!num.error) num.start();
}

/* Render yields table */
function renderYields(data){
  const tbody = document.getElementById('yieldsBody');
  tbody.innerHTML = '';
  data.forEach((r, idx)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="left">${r.crop}</td>
      <td>${fmt(r.predicted_yield)}</td>
      <td>${fmt(r.total_pesticide)}</td>
      <td>${fmt(r.yield_pest_plus)}</td>
      <td>${r.pct_pest_plus!=null? `<span class="badge ${r.pct_pest_plus>=0?'green':'red'}">${r.pct_pest_plus.toFixed(2)}%</span>`:'<span class="badge gray">N/A</span>'}</td>
      <td>${fmt(r.yield_pest_minus)}</td>
      <td>${r.pct_pest_minus!=null? `<span class="badge ${r.pct_pest_minus>=0?'green':'red'}">${r.pct_pest_minus.toFixed(2)}%</span>`:'<span class="badge gray">N/A</span>'}</td>
      <td>${fmt(r.yield_weather_plus)}</td>
      <td>${r.pct_weather_plus!=null? `<span class="badge ${r.pct_weather_plus>=0?'green':'red'}">${r.pct_weather_plus.toFixed(2)}%</span>`:'<span class="badge gray">N/A</span>'}</td>
      <td>${fmt(r.yield_weather_minus)}</td>
      <td>${r.pct_weather_minus!=null? `<span class="badge ${r.pct_weather_minus>=0?'green':'red'}">${r.pct_weather_minus.toFixed(2)}%</span>`:'<span class="badge gray">N/A</span>'}</td>
      <td><button class="btn ghost" data-idx="${idx}">View</button></td>
    `;
    tbody.appendChild(tr);
  });

  // events: open modal on crop name or view button
  tbody.querySelectorAll('td.left').forEach((td,i)=> td.addEventListener('click', ()=> openModal(i)));
  tbody.querySelectorAll('button[data-idx]').forEach(btn=> btn.addEventListener('click', ()=> openModal(Number(btn.dataset.idx))));
}

/* Populate simulator crop select */
function populateSim(results){
  const sel = document.getElementById('simCrop');
  sel.innerHTML = '';
  results.forEach((r,i)=> {
    const o=document.createElement('option'); o.value=i; o.textContent=r.crop; sel.appendChild(o);
  });
}

/* Pesticide table */
function renderPestTable(){
  const body = document.getElementById('pestBody');
  body.innerHTML = '';
  RESULTS.forEach(r=>{
    const p = r.pest_per_quarter||{};
    const total = (p.Pest_Q1||0)+(p.Pest_Q2||0)+(p.Pest_Q3||0)+(p.Pest_Q4||0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="left">${r.crop}</td><td>${fmt(p.Pest_Q1)}</td><td>${fmt(p.Pest_Q2)}</td><td>${fmt(p.Pest_Q3)}</td><td>${fmt(p.Pest_Q4)}</td><td>${fmt(total)}</td>`;
    body.appendChild(tr);
  });
}

/* Factors list (cards) */
function renderFactors(){
  const root = document.getElementById('factorsList'); root.innerHTML = '';
  RESULTS.forEach((r, idx)=>{
    const card = document.createElement('div'); card.className='card';
    const posHtml = (r.top_positive_factors||[]).map(f=>`<div class="factor-row"><div>${f[0]}</div><div style="color:var(--accent);font-weight:800">${f[1].toFixed(3)} (≈ ${f[2].toFixed(3)}%)</div></div>`).join('');
    const negHtml = (r.top_negative_factors||[]).map(f=>`<div class="factor-row"><div>${f[0]}</div><div style="color:var(--danger);font-weight:800">${f[1].toFixed(3)} (≈ ${f[2].toFixed(3)}%)</div></div>`).join('');
    const rec = generateRecommendationText(r);
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-weight:900">${r.crop}</div><div class="small">Base: ${fmt(r.predicted_yield)}</div></div><div><button class="btn ghost" onclick="openModal(${idx})">Deep Dive</button></div></div>
      <div style="display:flex;gap:12px;margin-top:10px">
        <div style="flex:1"><div style="font-weight:700">Top Positive</div><div class="small">${posHtml}</div></div>
        <div style="flex:1"><div style="font-weight:700">Top Negative</div><div class="small">${negHtml}</div></div>
        <div style="flex:1"><div style="font-weight:700">Interpretation</div><div class="small">${rec}</div></div>
      </div>`;
    root.appendChild(card);
  });
}

/* Recommendation text generator (short friendly explanation) */
function generateRecommendationText(r){
  const pos = r.top_positive_factors && r.top_positive_factors[0] ? r.top_positive_factors[0][0] : 'key factors';
  const neg = r.top_negative_factors && r.top_negative_factors[0] ? r.top_negative_factors[0][0] : 'risk factors';
  return `Improving ${pos.replace('_',' ')} tends to increase ${r.crop} yield. Reduce or monitor ${neg.replace('_',' ')} which often decreases yield. Combine targeted pest control with weather monitoring.`;
}

/* GLOBAL chart */
let globalChart = null;
function drawGlobalChart(mode='pesticide'){
  const ctx = document.getElementById('globalChart').getContext('2d');
  const labels = RESULTS.map(r=>r.crop);
  const base = RESULTS.map(r=>r.predicted_yield);
  const d1 = mode==='pesticide' ? RESULTS.map(r=>r.yield_pest_plus) : RESULTS.map(r=>r.yield_weather_plus);
  const d2 = mode==='pesticide' ? RESULTS.map(r=>r.yield_pest_minus) : RESULTS.map(r=>r.yield_weather_minus);
  if(globalChart) globalChart.destroy();
  globalChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels,
      datasets:[
        {label:'Base', data:base, backgroundColor:'rgba(16,185,129,0.85)'},
        {label: mode==='pesticide'?'+20% Pest':'+10% Weather', data:d1, backgroundColor:'rgba(59,130,246,0.85)'},
        {label: mode==='pesticide'?'-20% Pest':'-10% Weather', data:d2, backgroundColor:'rgba(239,68,68,0.85)'}
      ]
    },
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}
  });
}

/* small custom heatmap using canvas for correlation (approx) */
function drawCorrHeat(){
  const canvas = document.getElementById('corrHeat');
  const ctx = canvas.getContext('2d');
  const matrix = [[1,0.4,0.1,0.6],[0.4,1,0.05,0.45],[0.1,0.05,1,0.12],[0.6,0.45,0.12,1]];
  const w = canvas.width = canvas.clientWidth, h = canvas.height = canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  const n = matrix.length, cellW = w/n, cellH = h/n;
  for(let i=0;i<n;i++){
    for(let j=0;j<n;j++){
      const v = matrix[i][j];
      ctx.fillStyle = `rgba(14,165,233,${0.2+0.8*Math.abs(v)})`;
      ctx.fillRect(j*cellW, i*cellH, cellW-2, cellH-2);
      ctx.fillStyle='#032'; ctx.font='12px sans-serif';
      ctx.fillText(v.toFixed(2), j*cellW + cellW/2 - 12, i*cellH + cellH/2 + 4);
    }
  }
}

/* Weather trend chart */
function drawWeatherTrend(){
  const ctx = document.getElementById('weatherTrend').getContext('2d');
  const q = ['Q1','Q2','Q3','Q4'];
  const rain = [FORECAST.Rainfall_Q1||0, FORECAST.Rainfall_Q2||0, FORECAST.Rainfall_Q3||0, FORECAST.Rainfall_Q4||0];
  const temp = [FORECAST.Temp_Q1||0, FORECAST.Temp_Q2||0, FORECAST.Temp_Q3||0, FORECAST.Temp_Q4||0];
  new Chart(ctx, { type:'line', data:{labels:q, datasets:[
    {label:'Rainfall (mm)', data:rain, borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.08)', yAxisID:'y'},
    {label:'Temp (°C)', data:temp, borderColor:'#f97316', backgroundColor:'rgba(249,115,22,0.06)', yAxisID:'y1'}
  ]}, options:{responsive:true,maintainAspectRatio:false,scales:{ y:{position:'left'}, y1:{position:'right', grid:{display:false}}}}});
}

/* Modal deep-dive */
const backdrop = document.getElementById('modalBackdrop');
const modalEl = document.getElementById('modal');
let modalChart = null;
function openModal(idx){
  const r = RESULTS[idx];
  modalEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div><div style="font-weight:900">${r.crop}</div><div class="small">Village: ${VILLAGE}</div></div>
      <div><button class="modal-close" onclick="closeModal()">✕</button></div>
    </div>
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <div style="display:flex;gap:8px;align-items:center">
          <div style="width:92px;height:64px;border-radius:8px;background:linear-gradient(90deg,#dff6e9,#c7f0e0);display:flex;align-items:center;justify-content:center;font-weight:800">${r.crop.slice(0,2).toUpperCase()}</div>
          <div><div style="font-weight:800">Base: ${fmt(r.predicted_yield)}</div><div class="small">Total pest: ${fmt(r.total_pesticide)}</div></div>
        </div>

        <div style="margin-top:12px"><label style="font-weight:700">Pesticide multiplier</label><input id="modalPest" type="range" min="0" max="200" value="100" style="width:100%"></div>
        <div style="margin-top:8px"><label style="font-weight:700">Weather multiplier</label><input id="modalWeather" type="range" min="50" max="150" value="100" style="width:100%"></div>

        <div style="display:flex;gap:8px;margin-top:12px">
          <div style="flex:1;padding:10px;border-radius:8px;background:#f6fffa"><div class="small">Simulated Yield</div><div id="modalSim" style="font-weight:800">${fmt(r.predicted_yield)}</div></div>
          <div style="flex:1;padding:10px;border-radius:8px;background:#fff7f7"><div class="small">Scenario</div><div class="small">+20% pest: ${fmt(r.yield_pest_plus)} • -20% pest: ${fmt(r.yield_pest_minus)}</div></div>
        </div>
      </div>
      <div style="width:420px">
        <canvas id="modalChart" style="height:240px"></canvas>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px"><button class="btn" id="downloadModal">Download</button></div>
      </div>
    </div>
  `;
  backdrop.style.display='flex';
  setTimeout(()=>{
    document.getElementById('modalPest').addEventListener('input', ()=> updateModalSim(r));
    document.getElementById('modalWeather').addEventListener('input', ()=> updateModalSim(r));
    document.getElementById('downloadModal').addEventListener('click', ()=> {
      const canvas = document.getElementById('modalChart'); const a=document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = `${r.crop}_detail.png`; a.click();
    });
    drawModalChart(r);
  },100);
}
function closeModal(){ backdrop.style.display='none'; modalEl.innerHTML=''; if(modalChart){modalChart.destroy(); modalChart=null;} }
function drawModalChart(r){
  const ctx = document.getElementById('modalChart').getContext('2d');
  const labels = ['Base','+20%P','-20%P','+10%W','-10%W'];
  const data = [r.predicted_yield,r.yield_pest_plus,r.yield_pest_minus,r.yield_weather_plus,r.yield_weather_minus];
  if(modalChart) modalChart.destroy();
  modalChart = new Chart(ctx,{type:'bar',data:{labels, datasets:[{label:'Yield',data, backgroundColor:['#10b981','#06b6d4','#ef4444','#3b82f6','#f97316']}]}, options:{responsive:true,maintainAspectRatio:false}});
}
function updateModalSim(r){
  const pestMult = +document.getElementById('modalPest').value / 100;
  const weatherMult = +document.getElementById('modalWeather').value / 100;
  const pest = interpolatePest(r, pestMult);
  const weather = interpolateWeather(r, weatherMult);
  const sim = (pest + weather) / 2;
  document.getElementById('modalSim').textContent = sim.toFixed(2);
}

/* interpolation helpers */
function interpolatePest(r, mult){
  if(mult>=1){ const t=(mult-1)/(1.2-1); return r.predicted_yield + t*(r.yield_pest_plus - r.predicted_yield); }
  else { const t=(1-mult)/(1-0.8); return r.predicted_yield - t*(r.predicted_yield - r.yield_pest_minus); }
}
function interpolateWeather(r, mult){
  if(mult>=1){ const t=(mult-1)/(1.1-1); return r.predicted_yield + t*(r.yield_weather_plus - r.predicted_yield); }
  else { const t=(1-mult)/(1-0.9); return r.predicted_yield - t*(r.predicted_yield - r.yield_weather_minus); }
}

/* simulator (page-level) */
function attachControls(){
  document.getElementById('visualScenario').addEventListener('change', e=> drawGlobalChart(e.target.value));
  document.getElementById('exportCSV').addEventListener('click', ()=> exportCSV(RESULTS));
  document.getElementById('exportPDF').addEventListener('click', exportPDF);
  document.getElementById('saveJSON').addEventListener('click', saveJSON);
  document.getElementById('runSim').addEventListener('click', runSim);
  document.getElementById('resetSim').addEventListener('click', resetSim);
  document.getElementById('searchBox').addEventListener('input', e=> filterYields(e.target.value));
  document.getElementById('clearSearch').addEventListener('click', ()=> { document.getElementById('searchBox').value=''; renderYields(RESULTS); });
  document.getElementById('themeToggle').addEventListener('change', applyTheme);
  document.getElementById('compareBtn').addEventListener('click', startCompareMode);
  document.getElementById('simPest').addEventListener('input', liveSimPreview);
  document.getElementById('simWeather').addEventListener('input', liveSimPreview);
}

/* search filter */
function filterYields(q){ q = q.trim().toLowerCase(); if(!q) return renderYields(RESULTS); renderYields(RESULTS.filter(r=> r.crop.toLowerCase().includes(q))); }

/* run sim */
function liveSimPreview(){ const idx = +document.getElementById('simCrop').value; const pest = +document.getElementById('simPest').value/100; const weather = +document.getElementById('simWeather').value/100; const r = RESULTS[idx]; const p = interpolatePest(r,pest); const w = interpolateWeather(r,weather); const sim = (p+w)/2; document.getElementById('simYield').textContent = sim.toFixed(2); const pct = r.predicted_yield ? (((sim - r.predicted_yield)/r.predicted_yield)*100).toFixed(2) : '—'; document.getElementById('simPct').textContent = pct==='—'? '—' : (pct>0? `+${pct}%` : `${pct}%`); }
function runSim(){ liveSimPreview(); highlightSimCrop(); }
function resetSim(){ document.getElementById('simPest').value=100; document.getElementById('simWeather').value=100; document.getElementById('simYield').textContent='—'; document.getElementById('simPct').textContent='—'; clearChartHighlight(); }
function highlightSimCrop(){ if(!globalChart) return; const idx = +document.getElementById('simCrop').value; globalChart.data.datasets.forEach(ds=> ds.borderWidth = ds.data.map((_,i)=> i===idx?3:0)); globalChart.update(); }
function clearChartHighlight(){ if(!globalChart) return; globalChart.data.datasets.forEach(ds=> ds.borderWidth = ds.data.map(()=>0)); globalChart.update(); }

/* compare mode */
function startCompareMode(){
  const html = `<div style="display:flex;flex-direction:column;gap:12px"><div style="font-weight:900">Compare two crops</div>
  <div style="display:flex;gap:8px"><select id="cmpA">${RESULTS.map((r,i)=>`<option value="${i}">${r.crop}</option>`)}</select>
  <select id="cmpB">${RESULTS.map((r,i)=>`<option value="${i}">${r.crop}</option>`)}</select></div>
  <div style="display:flex;justify-content:flex-end;gap:8px"><button class="btn" id="doCompare">Compare</button><button class="btn ghost" id="closeCmp">Cancel</button></div></div>`;
  modalEl.innerHTML = html; backdrop.style.display='flex';
  document.getElementById('closeCmp').addEventListener('click', closeModal);
  document.getElementById('doCompare').addEventListener('click', ()=> {
    const a = +document.getElementById('cmpA').value, b = +document.getElementById('cmpB').value; showCompare(a,b);
  });
}
function showCompare(a,b){
  const A=RESULTS[a], B=RESULTS[b];
  modalEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div style="font-weight:900">${A.crop} vs ${B.crop}</div><button class="modal-close" onclick="closeModal()">✕</button></div>
    <div style="display:flex;gap:12px;margin-top:12px"><div style="flex:1"><div class="small">Base yield</div><div style="font-weight:900">${fmt(A.predicted_yield)} vs ${fmt(B.predicted_yield)}</div></div>
    <div style="flex:1"><canvas id="compareChart" style="height:260px"></canvas></div></div>`;
  setTimeout(()=> {
    const ctx = document.getElementById('compareChart').getContext('2d');
    new Chart(ctx, { type:'bar', data:{ labels:['Base','+20%P','-20%P','+10%W','-10%W'], datasets:[
      {label:A.crop, data:[A.predicted_yield,A.yield_pest_plus,A.yield_pest_minus,A.yield_weather_plus,A.yield_weather_minus], backgroundColor:'#10b981'},
      {label:B.crop, data:[B.predicted_yield,B.yield_pest_plus,B.yield_pest_minus,B.yield_weather_plus,B.yield_weather_minus], backgroundColor:'#3b82f6'}
    ]}, options:{responsive:true,maintainAspectRatio:false} });
  },80);
}

/* exports */
function exportCSV(data){ const header = ['Crop','BaseYield','TotalPest','Yield+20P','Pct+20P','Yield-20P','Pct-20P','Yield+10W','Pct+10W','Yield-10W','Pct-10W']; let csv = header.join(',') + '\\n'; data.forEach(r=> csv += [r.crop,r.predicted_yield||'',r.total_pesticide||'',r.yield_pest_plus||'',r.pct_pest_plus||'',r.yield_pest_minus||'',r.pct_pest_minus||'',r.yield_weather_plus||'',r.pct_weather_plus||'',r.yield_weather_minus||'',r.pct_weather_minus||''].join(',') + '\\n'); const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); saveAs(blob, `crop_insights_${VILLAGE}.csv`); }
function exportPDF(){ const el = document.querySelector('.content'); html2pdf().set({margin:0.4,filename:`crop_report_${VILLAGE}.pdf`,image:{type:'jpeg',quality:0.95},jsPDF:{unit:'in',format:'a4'}}).from(el).save(); }
function saveJSON(){ const payload = {village:VILLAGE,forecast:FORECAST,results:RESULTS,timestamp:new Date().toISOString()}; const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'}); saveAs(blob, `crop_insights_${VILLAGE}.json`); }

/* weather avg display */
function renderWeatherAvg(){ document.getElementById('avgTemp').textContent = fmt(VILLAGE_AVG.avg_temp); document.getElementById('avgRain').textContent = fmt(VILLAGE_AVG.avg_rain); }

/* theme */
function applyTheme(){
  const val = document.getElementById('themeToggle').value;
  if(val==='dark'){ document.documentElement.style.background='linear-gradient(180deg,#071018,#042027)'; document.body.style.background='linear-gradient(180deg,#071018,#042027)'; }
  else { document.body.style.background='linear-gradient(180deg,#f6fff8,#eef8ff)'; }
}

/* helper highlight/clear - reuse globalChart variable */
function clearChartHighlight(){ if(!globalChart) return; globalChart.data.datasets.forEach(ds => ds.borderWidth = ds.data.map(()=>0)); globalChart.update(); }

/* init */
document.addEventListener('DOMContentLoaded', ()=> initUI());

/* keep charts responsive */
window.addEventListener('resize', ()=> { if(window.globalChart) window.globalChart.resize(); if(window.modalChart) window.modalChart && window.modalChart.resize(); });
