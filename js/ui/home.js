import { t, fill } from '../i18n.js';
import { state, showToast, escapeHtml, isStandalone } from '../app.js';
import { listActivities, listSessions, getSetting, setSetting } from '../db.js';
import { createClient, HrmClient } from '../ble.js';
import { Recorder } from '../recorder.js';
import { fmtDateTime } from '../format.js';
import { sessionRowHtml } from './analytics.js';

const RECENT_N = 3;

let alive = false;
let root = null;
let viewUnsubs = [];   // klienta notikumi → šis skats (atsaista unmount)
let stateUnsubs = [];  // klienta notikumi → state (dzīvo, kamēr dzīvo klients)

// Pastāvīgā saite klients → state; reģistrē PIRMS skata klausītājiem, lai tie redz jauno state.
function bindClientState(client) {
  for (const u of stateUnsubs) u();
  stateUnsubs = [
    client.on('connected', () => { state.connected = true; }),
    client.on('disconnected', () => { state.connected = false; state.bpm = null; }),
    client.on('battery', ({ level }) => { state.battery = level; }),
    client.on('hr', ({ bpm }) => { state.bpm = bpm; }),
    client.on('error', ({ message }) => showToast(message)),
  ];
}

function unwireView() {
  for (const u of viewUnsubs) u();
  viewUnsubs = [];
}

function wireView(client) {
  unwireView();
  viewUnsubs = [
    client.on('connected', updateView),
    client.on('disconnected', updateView),
    client.on('battery', updateView),
    client.on('hr', updateBpm),
    client.on('status', ({ text }) => setStatus(text, false)),
    client.on('error', updateView),
  ];
}

function q(sel) { return root ? root.querySelector(sel) : null; }

function setStatus(text, ok) {
  const el = q('#status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('ok', !!ok);
}

function updateBpm() {
  const el = q('#bpm-now');
  if (el) el.textContent = state.bpm != null ? String(state.bpm) : '—';
}

function updateView() {
  if (!alive || !root) return;
  const s = t.home;
  setStatus(state.connected ? s.connected : s.notConnected, state.connected);
  q('#btn-connect').textContent = state.connected ? s.disconnect : s.connect;

  const bat = q('#battery');
  const level = state.battery;
  bat.querySelector('.fill').style.setProperty('--pct', `${level == null ? 0 : level}%`);
  bat.querySelector('#battery-text').textContent = level == null ? s.batteryUnknown : `${level} %`;
  bat.classList.toggle('low', level != null && level < 20);

  q('#bpm-row').hidden = !state.connected;
  updateBpm();

  const sel = q('#activity');
  const recording = state.recorder && state.recorder.state !== 'idle';
  q('#btn-start').disabled = !(state.connected && !sel.hidden && sel.value && !recording);
  q('#banner-recording').hidden = !recording;
}

async function fillActivities() {
  const [items, lastId] = await Promise.all([listActivities(), getSetting('lastActivityId', null)]);
  if (!alive) return;
  const sel = q('#activity');
  const hint = q('#activity-hint');
  if (!items.length) {
    sel.hidden = true;
    hint.hidden = false;
    return;
  }
  const chosen = items.some((a) => a.id === lastId) ? lastId : items[0].id;
  sel.innerHTML = items.map((a) =>
    `<option value="${a.id}" ${a.id === chosen ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('');
  sel.hidden = false;
  hint.hidden = true;
  if (chosen !== lastId) await setSetting('lastActivityId', chosen);
}

async function checkOrphan() {
  const s = t.home;
  if (state.recorder.state !== 'idle') return;
  const orphan = await Recorder.findOrphan();
  if (!alive || !orphan) return;
  const acts = await listActivities();
  if (!alive) return;
  const act = acts.find((a) => a.id === orphan.activityId);
  const card = q('#orphan');
  card.innerHTML = `
    <p class="error">${escapeHtml(fill(s.orphanText, {
      when: fmtDateTime(orphan.startedAt), activity: act ? act.name : t.common.unknownActivity,
    }))}</p>
    <div class="stack">
      <button id="orphan-finish" class="btn btn-accent" type="button">${s.orphanFinish}</button>
      <button id="orphan-discard" class="btn danger" type="button">${s.orphanDiscard}</button>
    </div>`;
  card.hidden = false;
  const done = (msg) => { card.hidden = true; card.innerHTML = ''; showToast(msg); };
  card.querySelector('#orphan-finish').addEventListener('click', () => {
    Recorder.finalizeOrphan(orphan.id)
      .then((ses) => done(ses && ses.sampleCount
        ? fill(s.orphanFinished, { avg: ses.avgBpm, max: ses.maxBpm }) : t.record.savedEmpty))
      .catch(dbError);
  });
  card.querySelector('#orphan-discard').addEventListener('click', () => {
    Recorder.discardOrphan(orphan.id).then(() => done(s.orphanDeleted)).catch(dbError);
  });
}

async function fillRecent() {
  const [sessions, acts] = await Promise.all([listSessions(), listActivities()]);
  if (!alive) return;
  const recent = sessions.filter((x) => x.status === 'done').slice(0, RECENT_N);
  const el = q('#recent-list');
  if (!el) return;
  el.innerHTML = recent.length
    ? recent.map((x) => {
      const a = acts.find((y) => y.id === x.activityId);
      return sessionRowHtml(x, { showActivity: true, name: a ? a.name : t.common.unknownActivity });
    }).join('')
    : `<p class="list-empty">${t.home.recent.empty}</p>`;
}

function dbError(err) {
  console.error(err);
  showToast(`${t.errors.dbFailed}: ${err.message || err}`);
}

// Brīdinājuma kartīte, ja nav Web Bluetooth (un nav imitācijas režīma) — redzama uzreiz, ne tikai pie klikšķa.
function updateNoBluetooth() {
  const el = q('#no-bt');
  if (el) el.hidden = !(!state.mock && !HrmClient.isSupported());
}

// Instalēšanas kartīte: tikai ja Chrome iedevis beforeinstallprompt, nav standalone un nav noraidīta.
async function updateInstallCard() {
  const s = t.home;
  const el = q('#install');
  if (!el) return;
  if (!state.installPrompt || isStandalone()) { el.hidden = true; return; }
  const dismissed = await getSetting('installDismissed', false);
  if (!alive || !q('#install')) return;
  if (dismissed || !state.installPrompt) { el.hidden = true; return; }
  el.innerHTML = `
    <p class="install-title">${s.installTitle}</p>
    <p class="hint">${s.installHint}</p>
    <div class="input-row">
      <button id="install-go" class="btn btn-accent" type="button">${s.installButton}</button>
      <button id="install-later" class="btn" type="button">${s.installDismiss}</button>
    </div>`;
  el.hidden = false;
  el.querySelector('#install-go').addEventListener('click', async () => {
    const ev = state.installPrompt;
    if (!ev) { el.hidden = true; return; }
    state.installPrompt = null;
    el.hidden = true;
    try { await ev.prompt(); } catch (e) { console.warn('install prompt failed', e); }
  });
  el.querySelector('#install-later').addEventListener('click', () => {
    el.hidden = true;
    setSetting('installDismissed', true).catch(console.error);
  });
}

const onInstallable = () => { updateInstallCard().catch(console.error); };

async function onConnectClick() {
  const s = t.home;
  const btn = q('#btn-connect');
  if (state.client && state.connected) {
    await state.client.disconnect();
    updateView();
    return;
  }
  if (!state.mock && !HrmClient.isSupported()) { showToast(t.errors.noBluetooth); return; }
  if (state.client) { try { await state.client.disconnect(); } catch (_) { /* jau atvienots */ } }

  const client = createClient(state.mock);
  state.client = client;
  state.connected = false;
  state.battery = null;
  state.bpm = null;
  bindClientState(client);
  wireView(client);
  if (state.recorder.state === 'recording') state.recorder.setClient(client);
  setStatus(s.connecting, false);
  btn.disabled = true;
  try {
    await client.connect();
  } catch (e) {
    console.warn('connect failed', e);
    if (state.client === client) {
      state.client = null;
      for (const u of stateUnsubs) u();
      stateUnsubs = [];
      unwireView();
      if (state.recorder.state === 'recording') state.recorder.setClient(null);
    }
    // NotFoundError = lietotājs aizvēra ierīču izvēli — nav kļūda.
    if (!e || e.name !== 'NotFoundError') showToast(fill(t.errors.connectFailed, { msg: (e && e.message) || e }));
  } finally {
    btn.disabled = false;
    updateView();
  }
}

async function onStartClick() {
  const sel = q('#activity');
  if (state.recorder.state === 'recording') { location.hash = '#record'; return; }
  if (!state.connected || !sel.value) return;
  const btn = q('#btn-start');
  btn.disabled = true;
  try {
    await state.recorder.start(sel.value, state.client);
    location.hash = '#record';
  } catch (e) {
    dbError(e);
    updateView();
  }
}

export function render(container) {
  const s = t.home;
  alive = true;
  root = container;
  container.innerHTML = `
    <h2>${s.title}</h2>
    <p>${s.intro}</p>
    <div id="banner-recording" class="banner" hidden>
      <span>${s.recordingBanner}</span>
      <a href="#record" class="btn btn-small">${s.recordingOpen}</a>
    </div>
    <div id="orphan" class="card" hidden></div>
    <div id="no-bt" class="card warn" hidden>
      <p class="error">${t.errors.noBluetooth}</p>
      <p class="hint">${s.noBluetoothHint}</p>
    </div>
    <div id="install" class="card" hidden></div>
    <div class="card">
      <button id="btn-connect" class="btn" type="button">${s.connect}</button>
      <div class="row">
        <span class="label">${s.status}</span>
        <span>
          <span id="badge-mock" class="badge" ${state.mock ? '' : 'hidden'}>${s.mockBadge}</span>
          <span id="status" class="status">${s.notConnected}</span>
        </span>
      </div>
      <div class="row">
        <span class="label">${s.battery}</span>
        <span class="battery" id="battery">
          <span class="bar"><span class="fill" style="--pct:0%"></span></span>
          <span id="battery-text">${s.batteryUnknown}</span>
        </span>
      </div>
      <div class="row" id="bpm-row" hidden>
        <span class="label">${s.bpmNow}</span>
        <span class="bpm-medium"><span id="bpm-now">—</span> <span class="unit">${t.record.bpmUnit}</span></span>
      </div>
    </div>
    <div class="card">
      <label class="label" for="activity">${s.activity}</label>
      <select id="activity" hidden></select>
      <p id="activity-hint" class="hint" hidden>${s.noActivities} <a href="#activities">${t.nav.activities}</a>.</p>
    </div>
    <button id="btn-start" class="btn btn-accent btn-big" type="button" disabled>${s.start}</button>
    <div class="card-title"><h3>${s.recent.title}</h3><a href="#analytics" class="link">${s.recent.all}</a></div>
    <div id="recent-list" class="card session-list"></div>
  `;

  q('#activity').addEventListener('change', (e) => {
    setSetting('lastActivityId', e.target.value).catch(console.error);
    updateView();
  });
  q('#btn-connect').addEventListener('click', () => onConnectClick().catch(dbError));
  q('#btn-start').addEventListener('click', () => onStartClick());

  if (state.client) wireView(state.client);
  updateView();
  updateNoBluetooth();
  window.addEventListener('pulss:installable', onInstallable);
  updateInstallCard().catch(console.error);
  fillActivities().then(updateView).catch(dbError);
  checkOrphan().catch(dbError);
  fillRecent().catch(dbError);
}

export function unmount() {
  alive = false;
  unwireView();
  window.removeEventListener('pulss:installable', onInstallable);
  root = null;
}
