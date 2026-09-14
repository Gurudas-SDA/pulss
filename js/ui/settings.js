import { t, fill } from '../i18n.js';
import { APP_VERSION, state, showToast, escapeHtml } from '../app.js';
import { exportAll, importAll, clearAll, listSessions, listActivities, setSetting } from '../db.js';
import { fmtDate, fmtTime } from '../format.js';

let pendingImport = null; // { name, data }
let alive = false;

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportJson() {
  const data = await exportAll();
  const name = `pulss-export-${fmtDate(Date.now())}.json`;
  downloadFile(name, JSON.stringify(data, null, 1), 'application/json');
  showToast(fill(t.settings.exported, { name }));
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function exportCsv() {
  const s = t.settings;
  const [sessions, activities] = await Promise.all([listSessions(), listActivities()]);
  if (!sessions.length) { showToast(s.nothingToExport); return; }
  const actName = new Map(activities.map((a) => [a.id, a.name]));
  const lines = [s.csvHeader];
  for (const x of sessions) {
    lines.push([
      fmtDate(x.startedAt),
      fmtTime(x.startedAt),
      x.endedAt ? fmtTime(x.endedAt) : '',
      x.durationSec,
      actName.get(x.activityId) || s.csvUnknownActivity,
      x.avgBpm, x.maxBpm, x.minBpm, x.sampleCount,
    ].map(csvCell).join(';'));
  }
  const name = `pulss-sesijas-${fmtDate(Date.now())}.csv`;
  downloadFile(name, '﻿' + lines.join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
  showToast(fill(s.exported, { name }));
}

async function pickImport(file, container) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (_) {
    showToast(fill(t.settings.importFailed, { msg: t.errors.importParse }));
    return;
  }
  pendingImport = { name: file.name, data };
  const box = container.querySelector('#import-box');
  box.querySelector('#import-name').textContent = fill(t.settings.importPicked, { name: file.name });
  box.hidden = false;
}

async function runImport(mode, container) {
  const s = t.settings;
  if (!pendingImport) return;
  if (mode === 'replace' && !confirm(s.importReplaceConfirm)) return;
  try {
    const counts = await importAll(pendingImport.data, { mode });
    showToast(fill(s.imported, counts));
    cancelImport(container);
    refreshStorage(container);
  } catch (e) {
    showToast(fill(s.importFailed, { msg: e.message }));
  }
}

function cancelImport(container) {
  pendingImport = null;
  container.querySelector('#import-box').hidden = true;
  container.querySelector('#import-file').value = '';
}

async function refreshStorage(container) {
  if (!navigator.storage || !navigator.storage.estimate) return;
  try {
    const est = await navigator.storage.estimate();
    if (!alive) return;
    const mb = ((est.usage || 0) / 1048576).toFixed(2);
    container.querySelector('#storage').textContent = fill(t.settings.storageMb, { mb });
    container.querySelector('#storage-row').hidden = false;
  } catch (_) { /* nav pieejams */ }
}

export function render(container) {
  const s = t.settings;
  alive = true;
  container.innerHTML = `
    <h2>${s.title}</h2>
    <p>${s.placeholder}</p>

    <h3>${s.data}</h3>
    <div class="card stack">
      <button id="btn-export-json" class="btn" type="button">${s.exportJson}</button>
      <button id="btn-export-csv" class="btn" type="button">${s.exportCsv}</button>
      <button id="btn-import" class="btn" type="button">${s.importJson}</button>
      <input type="file" id="import-file" accept=".json,application/json" hidden>
      <div id="import-box" class="stack" hidden>
        <span id="import-name" class="label"></span>
        <button id="btn-import-merge" class="btn btn-accent" type="button">${s.importMerge}</button>
        <button id="btn-import-replace" class="btn danger" type="button">${s.importReplace}</button>
        <button id="btn-import-cancel" class="btn" type="button">${s.cancel}</button>
      </div>
      <div class="row" id="storage-row" hidden>
        <span class="label">${s.storage}</span>
        <span id="storage"></span>
      </div>
      <button id="btn-clear" class="btn danger" type="button">${s.clearAll}</button>
    </div>

    <h3>${s.belt}</h3>
    <div class="card">
      <label class="check">
        <input type="checkbox" id="mock" ${state.mock ? 'checked' : ''}>
        <span>${s.mock}</span>
      </label>
    </div>

    <h3>${s.about}</h3>
    <div class="card">
      <div class="row">
        <span class="label">${s.version}</span>
        <span>${escapeHtml(APP_VERSION)}</span>
      </div>
    </div>
  `;

  const guard = (fn) => () => fn().catch((err) => {
    console.error(err);
    showToast(`${t.errors.dbFailed}: ${err.message}`);
  });

  container.querySelector('#btn-export-json').addEventListener('click', guard(exportJson));
  container.querySelector('#btn-export-csv').addEventListener('click', guard(exportCsv));
  const fileInput = container.querySelector('#import-file');
  container.querySelector('#btn-import').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) pickImport(f, container).catch(console.error);
  });
  container.querySelector('#btn-import-merge').addEventListener('click', guard(() => runImport('merge', container)));
  container.querySelector('#btn-import-replace').addEventListener('click', guard(() => runImport('replace', container)));
  container.querySelector('#btn-import-cancel').addEventListener('click', () => cancelImport(container));
  container.querySelector('#btn-clear').addEventListener('click', guard(async () => {
    if (!confirm(s.clearAllConfirm)) return;
    await clearAll();
    state.mock = new URLSearchParams(location.search).get('mock') === '1';
    container.querySelector('#mock').checked = state.mock;
    showToast(s.cleared);
    refreshStorage(container);
  }));
  container.querySelector('#mock').addEventListener('change', (e) => {
    state.mock = e.target.checked;
    setSetting('mock', state.mock).catch(console.error);
    // TODO (3. solis): pārslēgt HrmClient <-> MockHrm
  });

  refreshStorage(container);
}

export function unmount() {
  alive = false;
  pendingImport = null;
}
