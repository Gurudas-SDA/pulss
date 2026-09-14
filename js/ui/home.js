import { t } from '../i18n.js';
import { state } from '../app.js';

export function render(container) {
  const s = t.home;
  const options = Object.entries(t.activities.types)
    .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
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
      <select id="activity">${options}</select>
    </div>
    <button id="btn-start" class="btn btn-accent btn-big" type="button" disabled>${s.start}</button>
  `;

  container.querySelector('#btn-connect').addEventListener('click', () => {
    // TODO (2. solis): state.client = state.mock ? new MockHrm() : new HrmClient(); await state.client.connect()
  });
  container.querySelector('#btn-start').addEventListener('click', () => {
    location.hash = '#record';
  });
}

export function unmount() {}
