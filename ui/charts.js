// Lightweight custom canvas charts (no external deps).

function drawRing(canvasId, value, color) {
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  const cx = c.width / 2, cy = c.height / 2, r = 48;
  ctx.clearRect(0, 0, c.width, c.height);

  // track
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(128,128,128,.18)';
  ctx.stroke();

  // value arc
  const end = (-Math.PI / 2) + (Math.PI * 2 * (value / 100));
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, end);
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.stroke();

  // text
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text');
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value, cx, cy);
}

function scoreColor(v) {
  return v >= 80 ? '#16c784' : v >= 50 ? '#f5a623' : '#ea3943';
}

function drawPie(canvasId, data) {
  // data: [{label, value, color}]
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = 110, cy = c.height / 2, r = 80;

  if (total === 0) {
    ctx.fillStyle = 'rgba(128,128,128,.2)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    return;
  }

  let start = -Math.PI / 2;
  data.forEach(d => {
    if (d.value === 0) return;
    const slice = (d.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + slice);
    ctx.closePath();
    ctx.fillStyle = d.color;
    ctx.fill();
    start += slice;
  });

  // legend
  let ly = 30;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  data.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillRect(215, ly - 9, 12, 12);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text');
    ctx.fillText(`${d.label} (${d.value})`, 232, ly);
    ly += 22;
  });
}

function drawBar(canvasId, data) {
  // data: [{label, value, color}]
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const max = Math.max(1, ...data.map(d => d.value));
  const padding = 30, bottom = c.height - 40;
  const barW = (c.width - padding * 2) / data.length - 12;

  data.forEach((d, i) => {
    const x = padding + i * ((c.width - padding * 2) / data.length);
    const h = (d.value / max) * (bottom - 20);
    ctx.fillStyle = d.color;
    ctx.fillRect(x, bottom - h, barW, h);
    // value
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text');
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.value, x + barW / 2, bottom - h - 6);
    // label
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted');
    ctx.font = '10px sans-serif';
    ctx.save();
    ctx.translate(x + barW / 2, bottom + 14);
    ctx.fillText(d.label, 0, 0);
    ctx.restore();
  });
}

function drawLine(canvasId, points) {
  // points: array of cumulative page counts
  const c = document.getElementById(canvasId);
  if (!c) return;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  if (points.length < 2) return;

  const padding = 30;
  const max = Math.max(1, ...points);
  const stepX = (c.width - padding * 2) / (points.length - 1);

  // grid
  ctx.strokeStyle = 'rgba(128,128,128,.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding + (i / 4) * (c.height - padding * 2);
    ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(c.width - padding, y); ctx.stroke();
  }

  ctx.beginPath();
  points.forEach((p, i) => {
    const x = padding + i * stepX;
    const y = c.height - padding - (p / max) * (c.height - padding * 2);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#4f8cff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // fill
  ctx.lineTo(padding + (points.length - 1) * stepX, c.height - padding);
  ctx.lineTo(padding, c.height - padding);
  ctx.closePath();
  ctx.fillStyle = 'rgba(79,140,255,.12)';
  ctx.fill();
}

window.charts = { drawRing, drawPie, drawBar, drawLine, scoreColor };
