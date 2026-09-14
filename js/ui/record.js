import { t, fill } from '../i18n.js';
import { state, showToast } from '../app.js';
import { listActivities } from '../db.js';
import { fmtDuration } from '../format.js';
import { liveChartAdapter } from '../charts.js';
import { MockHrm } from '../ble.js';

const LIVE_WINDOW_SEC = 300;

let root = null;
let alive = false;
let timer = null;
let unsubs = [];
let chart = null;

function q(sel) { return root ? root.querySelector(sel) : null; }

function fmtStat(v) { return v == null ? '—' : String(v); }

function updateStats() {
  const st = state.recorder.stats;
  q('#st-avg').textContent = fmtStat(st.avgBpm);
  q('#st-max').textContent = fmtStat(st.maxBpm);
  q('#st-min').textContent = fmtStat(st.minBpm);
}

function tick() {
  if (!alive) return;
  q('#rec-elapsed').textContent = fmtDuration(state.recorder.elapsedSec);
}

function onSample({ t: tt, bpm }) {
  if (!alive) return;
  q('#rec-bpm').textContent = String(bpm);
  updateStats();
  chart.push(tt, bpm);
}

function setConn(text, ok) {
  const el = q('#rec-conn');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('ok', ok);
  el.classList.toggle('warn', !ok);
}

function setBusy(busy) {
  for (const id of ['#btn-stop', '#btn-discard', '#btn-sim']) {
    const b = q(id);
    if (b) b.disabled = busy;
  }
}

async function stopRecording() {
  const s = t.record;
  if (!confirm(s.stopConfirm)) return;
  setBusy(true);
  try {
    const ses = await state.recorder.stop();
    showToast(ses && ses.sampleCount
      ? fill(s.saved, { avg: ses.avgBpm, max: ses.maxBpm }) : s.savedEmpty);
    location.hash = ses ? `#session/${ses.id}` : '#home';
  } catch (e) {
    console.error(e);
    showToast(`${t.errors.dbFailed}: ${e.message || e}`);
    setBusy(false);
  }
}

async function discardRecording() {
  const s = t.record;
  if (!confirm(s.discardConfirm)) return;
  setBusy(true);
  try {
    await state.recorder.discard();
    showToast(s.discarded);
    location.hash = '#home';
  } catch (e) {
    console.error(e);
    showToast(`${t.errors.dbFailed}: ${e.message || e}`);
    setBusy(false);
  }
}

export function render(container) {
  const rec = state.recorder;
  if (!rec || rec.state !== 'recording') { location.replace('#home'); return; }
  const s = t.record;
  alive = true;
  root = container;
  const isMock = state.client instanceof MockHrm;
  container.innerHTML = `
    <div class="row rec-head">
      <span id="rec-activity" class="label"></span>
      <span id="rec-elapsed" class="elapsed">0:00</span>
    </div>
    <div class="bpm-big"><span id="rec-bpm">${state.bpm != null ? state.bpm : '—'}</span>
      <span class="unit">${s.bpmUnit}</span></div>
    <div class="stats-row card">
      <div><span class="label">${s.avg}</span><strong id="st-avg">—</strong></div>
      <div><span class="label">${s.max}</span><strong id="st-max">—</strong></div>
      <div><span class="label">${s.min}</span><strong id="st-min">—</strong></div>
    </div>
    <canvas id="rec-chart" class="chart live" aria-label="${s.title}"></canvas>
    <p id="rec-conn" class="status-line"></p>
    <p id="rec-hint" class="hint" hidden></p>
    <div class="stack">
      <button id="btn-stop" class="btn btn-accent btn-big" type="button">${s.stop}</button>
      ${isMock ? `<button id="btn-sim" class="btn" type="button">${s.simulateDisconnect}</button>` : ''}
      <button id="btn-discard" class="btn btn-link danger" type="button">${s.discard}</button>
    </div>
  `;

  setConn(state.connected ? s.connOk : s.connLost, state.connected);
  updateStats();
  timer = setInterval(tick, 1000);
  tick();

  chart = liveChartAdapter(q('#rec-chart'), { windowSec: LIVE_WINDOW_SEC, emptyText: s.chartEmpty });
  const samples = rec.samples;
  if (samples.length) {
    const cutoff = samples[samples.length - 1].t - LIVE_WINDOW_SEC;
    for (const smp of samples) if (smp.t >= cutoff) chart.push(smp.t, smp.bpm);
  } else {
    chart.redraw();
  }

  const showHint = (text) => {
    const h = q('#rec-hint');
    if (!h) return;
    h.textContent = text || '';
    h.hidden = !text;
  };
  showHint(rec.wakeLockStatus);
  unsubs.push(rec.on('sample', onSample));
  unsubs.push(rec.on('status', ({ text }) => showHint(text)));
  const client = state.client;
  if (client) {
    unsubs.push(client.on('disconnected', () => setConn(s.connLost, false)));
    unsubs.push(client.on('status', ({ text }) => setConn(text, false)));
    unsubs.push(client.on('connected', () => setConn(s.connOk, true)));
    unsubs.push(client.on('error', ({ message }) => setConn(message, false)));
  }

  q('#btn-stop').addEventListener('click', () => { stopRecording(); });
  q('#btn-discard').addEventListener('click', () => { discardRecording(); });
  if (isMock) q('#btn-sim').addEventListener('click', () => client.simulateDisconnect());

  listActivities().then((acts) => {
    if (!alive) return;
    const a = acts.find((x) => x.id === rec.session.activityId);
    q('#rec-activity').textContent = a ? a.name : t.common.unknownActivity;
  }).catch(console.error);
}

export function unmount() {
  alive = false;
  if (timer) clearInterval(timer);
  timer = null;
  for (const u of unsubs) u();
  unsubs = [];
  if (chart) chart.destroy();
  chart = null;
  root = null;
}
