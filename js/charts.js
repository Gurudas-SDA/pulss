// Līniju grafiki uz <canvas> (tīrs Canvas 2D, bez bibliotēkām).
//
// drawLineChart(canvas, {
//   series: [{ points: [{x, y}], color?, label?, width? }],
//   xLabel?(x) → string, yMin?, yMax?, padding?: {top,right,bottom,left},
//   showDots?: boolean (tikai ja ≤40 punkti), yTicks?: number, xTicks?: number, emptyText?: string
// })
// liveChartAdapter(canvas, {windowSec}) → { push(t, bpm), clear(), redraw(), destroy() } — rullējošs logs.
import { fmtDuration } from './format.js';

const MAX_DOTS = 40;

function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch (_) { return fallback; }
}

function niceStep(raw) {
  if (!(raw > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return n * p;
}

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const cw = canvas.clientWidth || canvas.width || 300;
  const ch = canvas.clientHeight || canvas.height || 200;
  const w = Math.round(cw * dpr);
  const h = Math.round(ch * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  return { ctx, cw, ch };
}

export function drawLineChart(canvas, opts = {}) {
  const {
    series = [], xLabel, yMin: yMinOpt, yMax: yMaxOpt, padding, showDots = false,
    yTicks = 5, xTicks = 5, emptyText = '',
  } = opts;
  const { ctx, cw, ch } = setupCanvas(canvas);
  const colors = {
    text: cssVar('--text', '#1c1c22'),
    muted: cssVar('--muted', '#6b6b76'),
    border: cssVar('--border', '#dcdce2'),
    accent: cssVar('--accent', '#e0324b'),
  };
  ctx.font = '12px system-ui, sans-serif';

  const all = [];
  for (const s of series) for (const p of s.points || []) all.push(p);
  if (!all.length) {
    ctx.fillStyle = colors.muted;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emptyText, cw / 2, ch / 2);
    return;
  }

  let xMin = Infinity; let xMax = -Infinity; let yLo = Infinity; let yHi = -Infinity;
  for (const p of all) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yLo) yLo = p.y;
    if (p.y > yHi) yHi = p.y;
  }
  if (xMax === xMin) xMax = xMin + 1;
  const margin = (yHi - yLo) * 0.05 || 5;
  yLo = yMinOpt != null ? yMinOpt : yLo - margin;
  yHi = yMaxOpt != null ? yMaxOpt : yHi + margin;
  if (yHi <= yLo) yHi = yLo + 1;
  const step = niceStep((yHi - yLo) / Math.max(1, yTicks));
  if (yMinOpt == null) yLo = Math.floor(yLo / step) * step;
  if (yMaxOpt == null) yHi = Math.ceil(yHi / step) * step;

  const pad = Object.assign({ top: 12, right: 12, bottom: 24, left: 40 }, padding || {});
  const x0 = pad.left; const x1 = cw - pad.right;
  const y0 = pad.top; const y1 = ch - pad.bottom;
  const sx = (x) => x0 + ((x - xMin) / (xMax - xMin)) * (x1 - x0);
  const sy = (y) => y1 - ((y - yLo) / (yHi - yLo)) * (y1 - y0);

  // Režģis + y atzīmes
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.fillStyle = colors.muted;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let v = yLo; v <= yHi + step * 1e-6; v += step) {
    const y = Math.round(sy(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.fillText(String(Math.round(v * 100) / 100), x0 - 6, y);
  }

  // x atzīmes
  ctx.textBaseline = 'top';
  const nx = Math.max(1, xTicks);
  for (let i = 0; i <= nx; i++) {
    const x = xMin + ((xMax - xMin) * i) / nx;
    const label = xLabel ? xLabel(x) : String(Math.round(x));
    ctx.textAlign = i === 0 ? 'left' : i === nx ? 'right' : 'center';
    ctx.fillText(label, sx(x), y1 + 6);
    const gx = Math.round(sx(x)) + 0.5;
    ctx.beginPath(); ctx.moveTo(gx, y1); ctx.lineTo(gx, y1 + 3); ctx.stroke();
  }

  // Sērijas
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2); ctx.clip();
  for (const s of series) {
    const pts = (s.points || []).slice().sort((a, b) => a.x - b.x);
    if (!pts.length) continue;
    const color = s.color || colors.accent;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = s.width || 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(sx(p.x), sy(p.y)); else ctx.lineTo(sx(p.x), sy(p.y)); });
    ctx.stroke();
    if (showDots && pts.length <= MAX_DOTS) {
      for (const p of pts) { ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.restore();

  // Leģenda (ja >1 sērija)
  if (series.length > 1) {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    let lx = x1 - 4;
    for (let i = series.length - 1; i >= 0; i--) {
      const s = series[i];
      const label = s.label || `#${i + 1}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = colors.text;
      ctx.fillText(label, lx, y0 + 8);
      lx -= tw + 6;
      ctx.strokeStyle = s.color || colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx - 14, y0 + 8); ctx.lineTo(lx, y0 + 8); ctx.stroke();
      lx -= 22;
    }
  }
}

// Rullējošs "dzīvais" grafiks: pēdējās windowSec sekundes, ≤2 pārzīmēšanas sekundē.
export function liveChartAdapter(canvas, { windowSec = 300, emptyText = '', color } = {}) {
  const MIN_GAP_MS = 500;
  let points = [];
  let lastDraw = 0;
  let timer = null;
  let raf = null;

  function draw() {
    lastDraw = performance.now();
    drawLineChart(canvas, {
      series: [{ points, color }],
      xLabel: (x) => fmtDuration(x),
      emptyText,
      xTicks: 4,
    });
  }

  function schedule() {
    if (timer || raf) return;
    const wait = Math.max(0, MIN_GAP_MS - (performance.now() - lastDraw));
    timer = setTimeout(() => {
      timer = null;
      raf = requestAnimationFrame(() => { raf = null; draw(); });
    }, wait);
  }

  const onResize = () => schedule();
  window.addEventListener('resize', onResize);

  return {
    push(t, bpm) {
      points.push({ x: t, y: bpm });
      const cutoff = t - windowSec;
      let drop = 0;
      while (drop < points.length && points[drop].x < cutoff) drop++;
      if (drop) points = points.slice(drop);
      schedule();
    },
    clear() { points = []; schedule(); },
    redraw: schedule,
    destroy() {
      window.removeEventListener('resize', onResize);
      if (timer) clearTimeout(timer);
      if (raf) cancelAnimationFrame(raf);
      timer = raf = null;
    },
  };
}
