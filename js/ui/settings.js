import { t } from '../i18n.js';
import { APP_VERSION, state } from '../app.js';

export function render(container) {
  const s = t.settings;
  container.innerHTML = `
    <h2>${s.title}</h2>
    <p>${s.placeholder}</p>
    <div class="card">
      <div class="row">
        <span class="label">${s.version}</span>
        <span>${APP_VERSION}</span>
      </div>
      <label class="check">
        <input type="checkbox" id="mock" ${state.mock ? 'checked' : ''}>
        <span>${s.mock}</span>
      </label>
    </div>
  `;
  container.querySelector('#mock').addEventListener('change', (e) => {
    state.mock = e.target.checked;
    // TODO (3. solis): saglabāt localStorage un pārslēgt HrmClient <-> MockHrm
  });
}

export function unmount() {}
