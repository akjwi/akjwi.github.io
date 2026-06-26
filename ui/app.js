// ---------- State ----------
let pages = [];
let crawling = false;
let progressPoints = [];
let sortKey = null;
let sortAsc = true;
let lastResult = null;

// ---------- Elements ----------
const $ = (id) => document.getElementById(id);
const urlInput = $('urlInput');
const startBtn = $('startBtn');
const stopBtn = $('stopBtn');
const progressFill = $('progressFill');
const statusText = $('statusText');

// ---------- Counters ----------
const counters = { pages: $('cPages'), broken: $('cBroken'), errors: $('cErrors'), queued: $('cQueued') };

function animateCounter(el, target) {
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;
  const diff = target - start;
  const steps = 15;
  let i = 0;
  const tick = () => {
    i++;
    el.textContent = Math.round(start + (diff * i) / steps);
    if (i < steps) requestAnimationFrame(tick);
    else el.textContent = target;
  };
  requestAnimationFrame(tick);
}

// ---------- Theme ----------
$('themeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
  renderDashboard();
});

// ---------- Language ----------
$('langSelect').addEventListener('change', (e) => {
  window.i18n.setLang(e.target.value);
  renderTable();
  renderInsights();
});
window.i18n.setLang('en');

// ---------- Navigation ----------
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    const view = item.getAttribute('data-view');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('view-' + view).classList.add('active');
    if (view === 'dashboard') renderDashboard();
  });
});

// ---------- Start crawl ----------
startBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) { alert('Enter a URL'); return; }

  // reset
  pages = [];
  progressPoints = [];
  crawling = true;
  lastResult = null;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  statusText.textContent = window.i18n.tr('crawling');
  progressFill.style.width = '5%';
  Object.values(counters).forEach(c => c.textContent = '0');
  $('resultsBody').innerHTML = '';

  const config = {
    url,
    depth: parseInt($('depthInput').value),
    concurrency: parseInt($('concInput').value),
    maxPages: parseInt($('maxInput').value)
  };

  const res = await window.api.startCrawl(config);

  crawling = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  if (res.ok) {
    finishCrawl(res.result);
  } else {
    statusText.textContent = 'Error: ' + res.error;
  }
});

// ---------- Stop ----------
stopBtn.addEventListener('click', async () => {
  await window.api.stopCrawl();
  statusText.textContent = window.i18n.tr('done');
});

// ---------- Live events ----------
window.api.onPage((page) => {
  pages.push(page);
  appendRow(page);
  updateLiveCounters();
});

window.api.onProgress((data) => {
  const maxP = parseInt($('maxInput').value) || 200;
  const pct = Math.min(95, (data.processed / maxP) * 100);
  progressFill.style.width = pct + '%';
  animateCounter(counters.queued, data.queued);
  progressPoints.push(data.processed);
  statusText.textContent = `${window.i18n.tr('crawling')} ${data.processed} | ${data.currentUrl}`;
  renderDashboard();
});

window.api.onLog((msg) => {
  // optional console logging
  // console.log(msg);
});

function updateLiveCounters() {
  const broken = pages.filter(p => ['Broken', 'Server Error'].includes(p.statusLabel)).length;
  const errors = pages.filter(p => p.status === 0).length;
  animateCounter(counters.pages, pages.length);
  animateCounter(counters.broken, broken);
  animateCounter(counters.errors, errors);
}

// ---------- Finish ----------
function finishCrawl(result) {
  pages = result.pages;
  progressFill.style.width = '100%';
  statusText.textContent = `${window.i18n.tr('done')} — ${pages.length} pages`;

  // compute client-side scoring & insights mirror (backend logic replicated lightly)
  lastResult = result;
  computeAndRender();
}

// ---------- Scoring + Insights (client mirror for instant render) ----------
function computeAndRender() {
  // duplicates
  detectDuplicatesClient(pages);

  const scores = computeScoresClient(pages);
  const insights = generateInsightsClient(pages, scores);

  lastResult.scores = scores;
  lastResult.insights = insights;
  window._scores = scores;
  window._insights = insights;

  updateLiveCounters();
  renderDashboard();
  renderInsights();
  renderTable();
}

function detectDuplicatesClient(pages) {
  const tMap = {}, mMap = {};
  pages.forEach(p => {
    if (p.title) (tMap[p.title] = tMap[p.title] || []).push(p);
    if (p.metaDescription) (mMap[p.metaDescription] = mMap[p.metaDescription] || []).push(p);
  });
  pages.forEach(p => {
    p.issues = p.issues || [];
    if (p.title && tMap[p.title].length > 1 && !p.issues.some(i => i.type === 'duplicate_title'))
      p.issues.push({ type: 'duplicate_title', severity: 'medium', msg: 'Duplicate title' });
    if (p.metaDescription && mMap[p.metaDescription].length > 1 && !p.issues.some(i => i.type === 'duplicate_meta'))
      p.issues.push({ type: 'duplicate_meta', severity: 'low', msg: 'Duplicate meta' });
  });
}

function computeScoresClient(pages) {
  if (!pages.length) return { seo: 0, performance: 0, health: 0, breakdown: {} };
  const total = pages.length;
  let broken = 0, redirects = 0, mTitle = 0, mMeta = 0, mH1 = 0, thin = 0, mAlt = 0, orphans = 0, noindex = 0, okPages = 0;
  let totalResp = 0, slow = 0;
  pages.forEach(p => {
    const iss = p.issues || [];
    if (['Broken', 'Server Error'].includes(p.statusLabel) || p.status === 0) broken++;
    if (p.statusLabel === 'Redirect') redirects++;
    if (p.statusLabel === 'OK') okPages++;
    if (iss.some(i => i.type === 'missing_title')) mTitle++;
    if (iss.some(i => i.type === 'missing_meta')) mMeta++;
    if (iss.some(i => i.type === 'missing_h1')) mH1++;
    if (iss.some(i => i.type === 'thin_content')) thin++;
    if (iss.some(i => i.type === 'missing_alt')) mAlt++;
    if (iss.some(i => i.type === 'noindex')) noindex++;
    if (p.isOrphan) orphans++;
    totalResp += p.responseTime || 0;
    if ((p.responseTime || 0) > 1000) slow++;
  });
  const avg = totalResp / total;
  const clamp = n => Math.max(0, Math.min(100, n));
  let seo = 100 - (mTitle/total)*25 - (mMeta/total)*15 - (mH1/total)*15 - (thin/total)*10 - (mAlt/total)*8 - (noindex/total)*12 - (orphans/total)*10;
  seo = clamp(seo);
  let perf = 100; if (avg > 200) perf -= (avg-200)/30; perf -= (slow/total)*30; perf = clamp(perf);
  let health = 100 - (broken/total)*50 - (redirects/total)*15 - (orphans/total)*10;
  health = clamp(health*0.6 + seo*0.25 + perf*0.15);
  return {
    seo: Math.round(seo), performance: Math.round(perf), health: Math.round(health),
    breakdown: { totalPages: total, okPages, brokenLinks: broken, redirects, missingTitle: mTitle, missingMeta: mMeta, missingH1: mH1, thinContent: thin, missingAlt: mAlt, orphans, noindex, avgResponse: Math.round(avg), slowPages: slow }
  };
}

function generateInsightsClient(pages, scores) {
  const b = scores.breakdown, total = b.totalPages || 1, out = [];
  const pct = n => Math.round((n/total)*100);
  const aff = (fn) => pages.filter(fn).map(p => p.url).slice(0, 8);
  if (b.brokenLinks) out.push({ priority:'critical', icon:'🔴', title:`${b.brokenLinks} broken page(s)`, detail:'Broken links hurt crawlability. Fix or 301-redirect them.', affected: aff(p=>['Broken','Server Error'].includes(p.statusLabel)||p.status===0) });
  if (b.missingTitle) out.push({ priority:'high', icon:'🏷️', title:`${b.missingTitle} missing titles (${pct(b.missingTitle)}%)`, detail:'Add unique 50–60 char titles to every page.', affected: aff(p=>(p.issues||[]).some(i=>i.type==='missing_title')) });
  if (b.missingMeta) out.push({ priority:'high', icon:'📝', title:`${b.missingMeta} missing meta descriptions`, detail:'Write 120–155 char descriptions to boost CTR.', affected: aff(p=>(p.issues||[]).some(i=>i.type==='missing_meta')) });
  if (b.missingH1) out.push({ priority:'high', icon:'🔖', title:`${b.missingH1} missing H1 headings`, detail:'Each page needs exactly one descriptive H1.', affected: aff(p=>(p.issues||[]).some(i=>i.type==='missing_h1')) });
  if (b.orphans) out.push({ priority:'medium', icon:'🧭', title:`${b.orphans} orphan page(s)`, detail:'No internal links point to these. Add contextual links.', affected: aff(p=>p.isOrphan) });
  if (b.thinContent) out.push({ priority:'medium', icon:'📄', title:`${b.thinContent} thin pages (<300 words)`, detail:'Expand or consolidate thin content.', affected: aff(p=>(p.issues||[]).some(i=>i.type==='thin_content')) });
  if (b.slowPages) out.push({ priority:'medium', icon:'⚡', title:`${b.slowPages} slow pages (>1000ms)`, detail:`Avg ${b.avgResponse}ms. Improve caching/CDN/server.`, affected: aff(p=>(p.responseTime||0)>1000) });
  if (b.missingAlt) out.push({ priority:'low', icon:'🖼️', title:`${b.missingAlt} pages with missing alt text`, detail:'Describe meaningful images for accessibility & image SEO.', affected: aff(p=>(p.issues||[]).some(i=>i.type==='missing_alt')) });
  if (!out.length) out.push({ priority:'good', icon:'✅', title:'No major issues detected', detail:'Site is in good shape. Keep monitoring.', affected: [] });
  const w = { critical:0, high:1, medium:2, low:3, good:4 };
  out.sort((a,b)=>w[a.priority]-w[b.priority]);
  return out;
}

// ---------- Render Dashboard ----------
function renderDashboard() {
  const scores = window._scores || computeScoresClient(pages);
  const C = window.charts;
  C.drawRing('ringHealth', scores.health, C.scoreColor(scores.health));
  C.drawRing('ringSeo', scores.seo, C.scoreColor(scores.seo));
  C.drawRing('ringPerf', scores.performance, C.scoreColor(scores.performance));

  const ok = pages.filter(p => p.statusLabel === 'OK').length;
  const redir = pages.filter(p => p.statusLabel === 'Redirect').length;
  const broken = pages.filter(p => ['Broken','Server Error'].includes(p.statusLabel)).length;
  const err = pages.filter(p => p.status === 0).length;

  C.drawPie('pieChart', [
    { label: '2xx OK', value: ok, color: '#16c784' },
    { label: '3xx Redirect', value: redir, color: '#f5a623' },
    { label: '4xx/5xx', value: broken, color: '#ea3943' },
    { label: 'Errors', value: err, color: '#8a94a6' }
  ]);

  const b = scores.breakdown;
  C.drawBar('barChart', [
    { label: 'Title', value: b.missingTitle||0, color: '#ea3943' },
    { label: 'Meta', value: b.missingMeta||0, color: '#f5a623' },
    { label: 'H1', value: b.missingH1||0, color: '#4f8cff' },
    { label: 'Thin', value: b.thinContent||0, color: '#7c5cff' },
    { label: 'Alt', value: b.missingAlt||0, color: '#16c784' },
    { label: 'Orphan', value: b.orphans||0, color: '#8a94a6' }
  ]);

  C.drawLine('lineChart', progressPoints.length ? progressPoints : [0, pages.length]);
}

// ---------- Render Table ----------
function appendRow(p) {
  const tbody = $('resultsBody');
  tbody.appendChild(buildRow(p));
}

function buildRow(p) {
  const tr = document.createElement('tr');
  if (['Broken','Server Error'].includes(p.statusLabel) || p.status === 0) tr.className = 'row-broken';
  else if (p.statusLabel === 'Redirect') tr.className = 'row-redirect';
  if ((p.responseTime||0) > 1000) tr.classList.add('row-slow');

  const badgeCls = ['Broken','Server Error'].includes(p.statusLabel) || p.status===0 ? 'broken'
    : p.statusLabel === 'Redirect' ? 'redirect' : 'ok';

  const metaDot = p.hasMeta ? 'yes' : 'no';
  const h1Dot = p.hasH1 ? 'yes' : 'no';

  tr.innerHTML = `
    <td title="${esc(p.url)}">${esc(p.url)}</td>
    <td>${p.status}</td>
    <td><span class="badge ${badgeCls}">${esc(p.statusLabel)}</span></td>
    <td title="${esc(p.title||'')}">${esc((p.title||'').slice(0,50)) || '—'}</td>
    <td><span class="dot ${metaDot}"></span></td>
    <td><span class="dot ${h1Dot}"></span></td>
    <td>${p.responseTime}ms</td>
    <td>${p.depth}</td>
    <td>${(p.issues||[]).length}</td>`;
  tr.addEventListener('dblclick', () => {
    navigator.clipboard.writeText(JSON.stringify(p, null, 2));
    statusText.textContent = 'Row copied to clipboard';
  });
  return tr;
}

function renderTable() {
  const tbody = $('resultsBody');
  const search = ($('tableSearch').value || '').toLowerCase();
  const filter = $('statusFilter').value;

  let list = [...pages];
  if (search) list = list.filter(p => p.url.toLowerCase().includes(search) || (p.title||'').toLowerCase().includes(search));
  if (filter === 'broken') list = list.filter(p => ['Broken','Server Error'].includes(p.statusLabel) || p.status===0);
  if (filter === 'redirect') list = list.filter(p => p.statusLabel === 'Redirect');

  if (sortKey) {
    list.sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv||'').toLowerCase(); }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }

  tbody.innerHTML = '';
  list.forEach(p => tbody.appendChild(buildRow(p)));
}

$('tableSearch').addEventListener('input', renderTable);
$('statusFilter').addEventListener('change', renderTable);

document.querySelectorAll('#resultsTable th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.getAttribute('data-sort');
    if (sortKey === key) sortAsc = !sortAsc; else { sortKey = key; sortAsc = true; }
    renderTable();
  });
});

// ---------- Render Insights ----------
function renderInsights() {
  const list = $('insightsList');
  const insights = window._insights || [];
  list.innerHTML = insights.map(i => `
    <div class="insight-card ${i.priority}">
      <h3>${i.icon} ${esc(i.title)}</h3>
      <p>${esc(i.detail)}</p>
      ${i.affected && i.affected.length ? `<ul>${i.affected.map(u => `<li>${esc(u)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');
}

// ---------- Export ----------
async function doExport(format) {
  if (!pages.length) { alert('No data to export'); return; }
  const data = {
    startUrl: lastResult?.startUrl || urlInput.value,
    crawledAt: lastResult?.crawledAt || new Date().toISOString(),
    pages,
    scores: window._scores,
    insights: window._insights
  };
  const res = await window.api.exportReport(format, data);
  if (res.ok) statusText.textContent = `${window.i18n.tr('saved')} ${res.filePath}`;
  else if (res.error !== 'Cancelled') statusText.textContent = 'Export error: ' + res.error;
}
$('exportCsv').addEventListener('click', () => doExport('csv'));
$('exportJson').addEventListener('click', () => doExport('json'));
$('exportHtml').addEventListener('click', () => doExport('html'));

// ---------- Util ----------
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// initial dashboard render
renderDashboard();
