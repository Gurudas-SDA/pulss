// Analītika: aktivitāšu čipi → tendenču grafiks (vid./maks. pa sesijām) → statistikas kartīte → sesiju saraksts.
// Izvēlētā aktivitāte un periods glabājas settings ('analyticsActivityId', 'analyticsPeriod').
import { t, fill } from '../i18n.js';
import { escapeHtml } from '../app.js';
import { listActivities, listSessions, getSetting, setSetting } from '../db.js';
import { fmtDate, fmtDayMonth, fmtDateTime, fmtDuration } from '../format.js';
import { drawLineChart } from '../charts.js';

const ALL = 'all';
const MAX_COLOR = '#f28c28';
const PERIODS = [
  { key: '30', days: 30, label: () => t.analytics.period30 },
  { key: '90', days: 90, label: () => t.analytics.period90 },
  { key: 'all', days: 0, label: () => t.analytics.periodAll },
];

let root = null;
let alive = false;
let activities = [];
let sessions = [];      // visas sesijas, jaunākās vispirms
let activityId = ALL;
let period = 'all';
let onResize = null;

function q(sel) { return root ? root.querySelector(sel) : null; }

function activityName(id) {
  const a = activities.find((x) => x.id === id);
  return a ? a.name : t.common.unknownActivity;
}

function filtered() {
  let list = sessions;
  if (activityId !== ALL) list = list.filter((s) => s.activityId === activityId);
  const p = PERIODS.find((x) => x.key === period);
  if (p && p.days) {
    const cutoff = Date.now() - p.days * 86400000;
    list = list.filter((s) => s.startedAt >= cutoff);
  }
  return list;
}

function chipsHtml(items, active, attr) {
  return items.map((c) =>
    `<button type="button" class="chip${c.id === active ? ' active' : ''}" data-${attr}="${c.id}">${escapeHtml(c.label)}</button>`
  ).join('');
}

function mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; }

function statHtml(label, value, sub) {
  return `<div><span class="label">${label}</span><strong>${value}</strong>${sub ? `<span class="label small">${sub}</span>` : ''}</div>`;
}

function drawChart(done) {
  const canvas = q('#an-chart');
  if (!canvas) return;
  const s = t.analytics;
  const asc = done.slice().sort((a, b) => a.startedAt - b.startedAt);
  const xLabel = asc.length > 2 ? fmtDayMonth : fmtDate;
  drawLineChart(canvas, {
    series: [
      { points: asc.map((x) => ({ x: x.startedAt, y: x.avgBpm })), label: s.avg },
      { points: asc.filter((x) => x.maxBpm != null).map((x) => ({ x: x.startedAt, y: x.maxBpm })), color: MAX_COLOR, label: s.max },
    ],
    xLabel,
    showDots: true,
    xTickValues: asc.map((x) => x.startedAt), // atzīmes tieši sesiju datumos
    emptyText: s.chartEmpty,
  });
}

function renderStats(done) {
  const s = t.analytics;
  const el = q('#an-stats');
  if (!el) return;
  if (!done.length) { el.hidden = true; return; }
  el.hidden = false;
  const asc = done.slice().sort((a, b) => a.startedAt - b.startedAt);
  const total = done.reduce((sum, x) => sum + (x.durationSec || 0), 0);
  const avg = Math.round(mean(done.map((x) => x.avgBpm)));
  const best = Math.max(...done.map((x) => x.maxBpm == null ? -Infinity : x.maxBpm));
  let change; let changeSub;
  if (asc.length >= 4) {
    const d = Math.round(mean(asc.slice(-3).map((x) => x.avgBpm)) - mean(asc.slice(0, 3).map((x) => x.avgBpm)));
    change = d > 0 ? fill(s.changeUp, { n: d }) : d < 0 ? fill(s.changeDown, { n: -d }) : s.changeFlat;
    changeSub = s.changeHint;
  } else {
    change = '—';
    changeSub = s.changeNeed;
  }
  el.innerHTML =
    statHtml(s.sessions, done.length) +
    statHtml(s.totalTime, fmtDuration(total)) +
    statHtml(s.avgBpm, avg) +
    statHtml(s.bestMax, Number.isFinite(best) ? best : '—') +
    statHtml(s.avgDuration, fmtDuration(total / done.length)) +
    statHtml(s.change, change, changeSub);
}

export function sessionRowHtml(x, { showActivity, name }) {
  const s = t.analytics;
  const orphan = x.status !== 'done';
  const stats = orphan
    ? s.unfinished
    : `${fmtDuration(x.durationSec)} · ${fill(s.rowStats, { avg: x.avgBpm ?? '—', max: x.maxBpm ?? '—' })}`;
  return `<a class="session-row${orphan ? ' muted' : ''}" href="#session/${encodeURIComponent(x.id)}">` +
    `<span class="sr-main"><strong>${fmtDateTime(x.startedAt)}</strong>` +
    `${showActivity ? `<span class="label">${escapeHtml(name)}</span>` : ''}</span>` +
    `<span class="sr-sub">${stats}</span></a>`;
}

function renderList(list) {
  const el = q('#an-list');
  if (!el) return;
  el.innerHTML = list.length
    ? list.map((x) => sessionRowHtml(x, { showActivity: activityId === ALL, name: activityName(x.activityId) })).join('')
    : `<p class="list-empty">${t.analytics.listEmpty}</p>`;
}

function refresh() {
  if (!alive) return;
  const list = filtered();
  const done = list.filter((x) => x.status === 'done' && x.avgBpm != null);
  drawChart(done);
  renderStats(done);
  renderList(list);
}

async function load() {
  const [acts, all, savedAct, savedPeriod] = await Promise.all([
    listActivities(), listSessions(),
    getSetting('analyticsActivityId', null), getSetting('analyticsPeriod', 'all'),
  ]);
  if (!alive) return;
  activities = acts;
  sessions = all;
  const validAct = savedAct === ALL || acts.some((a) => a.id === savedAct);
  activityId = validAct ? savedAct : (acts[0] ? acts[0].id : ALL);
  period = PERIODS.some((p) => p.key === savedPeriod) ? savedPeriod : 'all';
  q('#an-chips').innerHTML = chipsHtml(
    [{ id: ALL, label: t.analytics.all }, ...acts.map((a) => ({ id: a.id, label: a.name }))], activityId, 'act');
  q('#an-periods').innerHTML = chipsHtml(PERIODS.map((p) => ({ id: p.key, label: p.label() })), period, 'period');
  refresh();
}

function onChipClick(e, attr, apply) {
  const btn = e.target.closest(`[data-${attr}]`);
  if (!btn) return;
  apply(btn.dataset[attr]);
  for (const b of btn.parentNode.children) b.classList.toggle('active', b === btn);
  refresh();
}

export function render(container) {
  const s = t.analytics;
  alive = true;
  root = container;
  container.innerHTML = `
    <div id="an-chips" class="chips" role="tablist"></div>
    <div class="card">
      <canvas id="an-chart" class="chart trend" aria-label="${s.title}"></canvas>
    </div>
    <div id="an-stats" class="card stats-grid" hidden></div>
    <div class="card-title"><h3>${s.list}</h3><div id="an-periods" class="chips small"></div></div>
    <div id="an-list" class="card session-list"></div>
  `;
  q('#an-chips').addEventListener('click', (e) => onChipClick(e, 'act', (v) => {
    activityId = v;
    setSetting('analyticsActivityId', v).catch(console.error);
  }));
  q('#an-periods').addEventListener('click', (e) => onChipClick(e, 'period', (v) => {
    period = v;
    setSetting('analyticsPeriod', v).catch(console.error);
  }));
  onResize = () => refresh();
  window.addEventListener('resize', onResize);
  load().catch((e) => {
    console.error(e);
    container.innerHTML = `<div class="card"><p class="error">${t.errors.dbFailed}: ${escapeHtml(e.message || e)}</p></div>`;
  });
}

export function unmount() {
  alive = false;
  if (onResize) window.removeEventListener('resize', onResize);
  onResize = null;
  root = null;
}
