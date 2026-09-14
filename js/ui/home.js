import { t } from '../i18n.js';
import { state, showToast, escapeHtml } from '../app.js';
import { listActivities, getSetting, setSetting } from '../db.js';

let alive = false;

async function fillActivities(container) {
  const s = t.home;
  const [items, lastId] = await Promise.all([listActivities(), getSetting('lastActivityId', null)]);
  if (!alive) return;
  const sel = container.querySelector('#activity');
  const hint = container.querySelector('#activity-hint');
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

export function render(container) {
  const s = t.home;
  alive = true;
  container.innerHTML = `
    <h2>${s.title}</h2>
    <p>${s.intro}</p>
    <div class="card">
      <button id="btn-connect" class="btn" type="button">${s.connect}</button>
      <div class="row">
        <span class="label">${s.status}</span>
        <span id="status" class="status">${state.connected ? s.connected : s.notConnected}</span>
      </div>
      <div class="row">
        <span class="label">${s.battery}</span>
        <span class="battery" id="battery">
          <span class="bar"><span class="fill" style="--pct:0%"></span></span>
          <span id="battery-text">${s.batteryUnknown}</span>
        </span>
      </div>
    </div>
    <div class="card">
      <label class="label" for="activity">${s.activity}</label>
      <select id="activity" hidden></select>
      <p id="activity-hint" class="hint" hidden>${s.noActivities} <a href="#activities">${t.nav.activities}</a>.</p>
    </div>
    <button id="btn-start" class="btn btn-accent btn-big" type="button" disabled>${s.start}</button>
  `;

  container.querySelector('#activity').addEventListener('change', (e) => {
    setSetting('lastActivityId', e.target.value).catch(console.error);
  });
  container.querySelector('#btn-connect').addEventListener('click', () => {
    // TODO (3. solis): state.client = state.mock ? new MockHrm() : new HrmClient(); await state.client.connect()
  });
  container.querySelector('#btn-start').addEventListener('click', () => {
    location.hash = '#record';
  });

  fillActivities(container).catch((err) => {
    console.error(err);
    showToast(`${t.errors.dbFailed}: ${err.message}`);
  });
}

export function unmount() {
  alive = false;
}
