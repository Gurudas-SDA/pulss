// Viena ieraksta skats: galvene, statistikas režģis, pulsa līkne, aktivitātes maiņa, CSV eksports, dzēšana.
// Grafiks: >600 paraugiem raw līnija tiek zīmēta tievi/blāvi un virsū — slīdošā vidējā (15 s logs) akcenta krāsā.
import { t, fill } from '../i18n.js';
import { escapeHtml, showToast, downloadFile } from '../app.js';
import { getSession, listSamples, listActivities, putSession, deleteSession } from '../db.js';
import { fmtDate, fmtTime, fmtDateTime, fmtDuration, slugify } from '../format.js';
import { drawLineChart } from '../charts.js';
import { csvCell } from './settings.js';

const SMOOTH_FROM = 600;
const SMOOTH_WINDOW = 15;
const RAW_COLOR = '#9a9aa6';

let root = null;
let alive = false;
let session = null;
let samples = [];
let activities = [];
let onResize = null;

function q(sel) { return root ? root.querySelector(sel) : null; }

function activityName(id) {
  const a = activities.find((x) => x.id === id);
  return a ? a.name : t.common.unknownActivity;
}

function movingAverage(pts, win) {
  const out = [];
  let sum = 0;
  const queue = [];
  for (const p of pts) {
    queue.push(p.y);
    sum += p.y;
    if (queue.length > win) sum -= queue.shift();
    out.push({ x: p.x, y: sum / queue.length });
  }
  return out;
}

function drawChart() {
  const canvas = q('#ses-chart');
  if (!canvas) return;
  const s = t.session;
  const raw = samples.map((x) => ({ x: x.t, y: x.bpm }));
  const series = raw.length > SMOOTH_FROM
    ? [
      { points: raw, color: RAW_COLOR, width: 1, label: s.pulse },
      { points: movingAverage(raw, SMOOTH_WINDOW), label: s.smoothed, width: 2 },
    ]
    : [{ points: raw, label: s.pulse }];
  drawLineChart(canvas, { series, xLabel: fmtDuration, xTicks: 4, emptyText: s.chartEmpty });
}

function val(v) { return v == null ? '—' : String(v); }

function exportCsv() {
  const s = t.session;
  if (!samples.length) { showToast(s.nothingToExport); return; }
  const lines = [s.csvHeader];
  for (const x of samples) {
    lines.push([x.t, x.bpm, Array.isArray(x.rr) ? x.rr.join('|') : ''].map(csvCell).join(';'));
  }
  const name = `pulss-${fmtDate(session.startedAt)}-${slugify(activityName(session.activityId))}.csv`;
  downloadFile(name, '﻿' + lines.join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
  showToast(fill(s.exported, { name }));
}

async function reassign(activityId) {
  const s = t.session;
  session.activityId = activityId;
  await putSession(session);
  if (!alive) return;
  q('#ses-name').textContent = activityName(activityId);
  showToast(fill(s.reassigned, { name: activityName(activityId) }));
}

async function remove() {
  const s = t.session;
  if (!confirm(fill(s.removeConfirm, { date: fmtDateTime(session.startedAt) }))) return;
  const btn = q('#btn-delete');
  if (btn) btn.disabled = true;
  await deleteSession(session.id);
  showToast(s.removed);
  location.hash = '#analytics';
}

function dbError(e) {
  console.error(e);
  showToast(`${t.errors.dbFailed}: ${e.message || e}`);
}

function renderNotFound(container) {
  container.innerHTML = `
    <div class="card">
      <p class="error">${t.session.notFound}</p>
      <a href="#home" class="btn">${t.session.backHome}</a>
    </div>`;
}

function renderSession(container) {
  const s = t.session;
  const x = session;
  const orphan = x.status !== 'done';
  const stat = (label, value) => `<div><span class="label">${label}</span><strong>${value}</strong></div>`;
  container.innerHTML = `
    <a href="#analytics" class="link">${s.backAnalytics}</a>
    <h2 class="ses-head"><span id="ses-name">${escapeHtml(activityName(x.activityId))}</span>
      ${orphan ? `<span class="badge">${s.unfinished}</span>` : ''}</h2>
    <p>${fmtDateTime(x.startedAt)}</p>
    <div class="card stats-grid">
      ${stat(s.start, fmtTime(x.startedAt))}
      ${stat(s.end, x.endedAt ? fmtTime(x.endedAt) : '—')}
      ${stat(s.duration, fmtDuration(x.durationSec))}
      ${stat(s.avg, val(x.avgBpm))}
      ${stat(s.max, val(x.maxBpm))}
      ${stat(s.min, val(x.minBpm))}
      ${stat(s.samples, val(x.sampleCount ?? samples.length))}
    </div>
    <div class="card">
      <button id="btn-delete" class="btn danger" type="button">🗑 ${s.remove}</button>
    </div>
    <div class="card">
      <canvas id="ses-chart" class="chart session" aria-label="${s.pulse}"></canvas>
    </div>
    <div class="card stack">
      <label class="label" for="ses-activity">${s.activity}</label>
      <select id="ses-activity">
        ${activities.map((a) =>
          `<option value="${a.id}" ${a.id === x.activityId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
      </select>
      <button id="btn-csv" class="btn" type="button">${s.exportCsv}</button>
    </div>
  `;
  q('#ses-activity').addEventListener('change', (e) => reassign(e.target.value).catch(dbError));
  q('#btn-csv').addEventListener('click', () => { try { exportCsv(); } catch (e) { dbError(e); } });
  q('#btn-delete').addEventListener('click', () => remove().catch(dbError));
  drawChart();
  onResize = () => drawChart();
  window.addEventListener('resize', onResize);
}

export function render(container, params) {
  alive = true;
  root = container;
  session = null;
  samples = [];
  const id = params && params.id;
  if (!id) { renderNotFound(container); return; }
  Promise.all([getSession(id), listSamples(id), listActivities()]).then(([ses, smp, acts]) => {
    if (!alive) return;
    if (!ses) { renderNotFound(container); return; }
    session = ses;
    samples = smp;
    activities = acts;
    renderSession(container);
  }).catch((e) => {
    dbError(e);
    if (alive) renderNotFound(container);
  });
}

export function unmount() {
  alive = false;
  if (onResize) window.removeEventListener('resize', onResize);
  onResize = null;
  root = null;
  session = null;
  samples = [];
}
