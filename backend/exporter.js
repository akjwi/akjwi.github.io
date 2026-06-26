// CSV / JSON / HTML report exporters.

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).replace(/"/g, '""');
  return `"${s}"`;
}

function exportCSV(data) {
  const pages = data.pages || [];
  const headers = [
    'URL', 'Status', 'Status Label', 'Response Time (ms)', 'Depth',
    'Title', 'Title Length', 'Meta Description', 'H1 Count', 'Word Count',
    'Images', 'Images Missing Alt', 'Inbound Links', 'Orphan', 'Issues'
  ];

  const rows = pages.map(p => [
    p.url,
    p.status,
    p.statusLabel,
    p.responseTime,
    p.depth,
    p.title || '',
    p.titleLength || 0,
    p.metaDescription || '',
    p.h1Count || 0,
    p.wordCount || 0,
    p.imageCount || 0,
    p.imagesMissingAlt || 0,
    p.inboundLinks || 0,
    p.isOrphan ? 'Yes' : 'No',
    (p.issues || []).map(i => i.msg).join('; ')
  ].map(escapeCSV).join(','));

  return [headers.map(escapeCSV).join(','), ...rows].join('\n');
}

function exportJSON(data) {
  return JSON.stringify(data, null, 2);
}

function exportHTML(data) {
  const pages = data.pages || [];
  const scores = data.scores || { seo: 0, performance: 0, health: 0, breakdown: {} };
  const insights = data.insights || [];
  const b = scores.breakdown || {};

  const scoreColor = (s) => s >= 80 ? '#16c784' : s >= 50 ? '#f5a623' : '#ea3943';

  const rows = pages.map(p => {
    const cls = p.statusLabel === 'Broken' || p.statusLabel === 'Server Error' ? 'broken'
      : p.statusLabel === 'Redirect' ? 'redirect'
      : (p.responseTime > 1000 ? 'slow' : '');
    return `<tr class="${cls}">
      <td><a href="${p.url}" target="_blank">${p.url}</a></td>
      <td>${p.status}</td>
      <td>${p.statusLabel}</td>
      <td>${p.responseTime}ms</td>
      <td>${p.depth}</td>
      <td>${escapeHTML(p.title || '')}</td>
      <td>${p.wordCount || 0}</td>
      <td>${(p.issues || []).length}</td>
    </tr>`;
  }).join('');

  const insightHTML = insights.map(i => `
    <div class="insight ${i.priority}">
      <h3>${i.icon} ${escapeHTML(i.title)}</h3>
      <p>${escapeHTML(i.detail)}</p>
      ${i.affected && i.affected.length ? `<ul>${i.affected.map(u => `<li>${escapeHTML(u)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<title>SEO Audit Report</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; background: #f4f6fb; color: #1a1f36; }
  .container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .sub { color: #697386; margin-bottom: 32px; }
  .scores { display: flex; gap: 20px; margin-bottom: 40px; flex-wrap: wrap; }
  .score-card { flex: 1; min-width: 200px; background: #fff; border-radius: 14px; padding: 28px; box-shadow: 0 2px 10px rgba(0,0,0,.05); text-align: center; }
  .score-num { font-size: 48px; font-weight: 800; }
  .score-label { color: #697386; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px,1fr)); gap: 14px; margin-bottom: 40px; }
  .stat { background: #fff; border-radius: 10px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
  .stat b { font-size: 24px; display: block; }
  .stat span { color: #697386; font-size: 13px; }
  .insight { background: #fff; border-radius: 12px; padding: 20px; margin-bottom: 14px; border-left: 5px solid #ccc; }
  .insight.critical { border-color: #ea3943; }
  .insight.high { border-color: #f5a623; }
  .insight.medium { border-color: #4f8cff; }
  .insight.low { border-color: #8a94a6; }
  .insight.good { border-color: #16c784; }
  .insight h3 { margin: 0 0 8px; }
  .insight ul { color: #697386; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,.05); }
  th, td { padding: 10px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #eef0f4; }
  th { background: #f8f9fc; font-weight: 600; }
  tr.broken { background: #fff0f0; }
  tr.redirect { background: #fff8e8; }
  tr.slow { background: #f0f5ff; }
  a { color: #4f8cff; text-decoration: none; }
  .section-title { margin: 36px 0 16px; font-size: 20px; }
</style>
</head><body>
<div class="container">
  <h1>SEO Audit Report</h1>
  <div class="sub">${escapeHTML(data.startUrl || '')} &middot; Generated ${new Date(data.crawledAt || Date.now()).toLocaleString()} &middot; ${pages.length} pages</div>

  <div class="scores">
    <div class="score-card"><div class="score-num" style="color:${scoreColor(scores.health)}">${scores.health}</div><div class="score-label">Site Health</div></div>
    <div class="score-card"><div class="score-num" style="color:${scoreColor(scores.seo)}">${scores.seo}</div><div class="score-label">SEO Score</div></div>
    <div class="score-card"><div class="score-num" style="color:${scoreColor(scores.performance)}">${scores.performance}</div><div class="score-label">Performance</div></div>
  </div>

  <div class="stats">
    <div class="stat"><b>${b.totalPages||0}</b><span>Total Pages</span></div>
    <div class="stat"><b>${b.okPages||0}</b><span>OK (200)</span></div>
    <div class="stat"><b>${b.brokenLinks||0}</b><span>Broken</span></div>
    <div class="stat"><b>${b.redirects||0}</b><span>Redirects</span></div>
    <div class="stat"><b>${b.missingTitle||0}</b><span>Missing Titles</span></div>
    <div class="stat"><b>${b.missingMeta||0}</b><span>Missing Meta</span></div>
    <div class="stat"><b>${b.orphans||0}</b><span>Orphan Pages</span></div>
    <div class="stat"><b>${b.avgResponse||0}ms</b><span>Avg Response</span></div>
  </div>

  <h2 class="section-title">Recommendations</h2>
  ${insightHTML}

  <h2 class="section-title">All Pages</h2>
  <table>
    <thead><tr><th>URL</th><th>Code</th><th>Status</th><th>Time</th><th>Depth</th><th>Title</th><th>Words</th><th>Issues</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>
</body></html>`;
}

function escapeHTML(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

module.exports = { exportCSV, exportJSON, exportHTML };
