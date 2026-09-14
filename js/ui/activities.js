import { t } from '../i18n.js';

export function render(container) {
  container.innerHTML = `
    <h2>${t.activities.title}</h2>
    <p>${t.activities.placeholder}</p>
  `;
  // TODO (3. solis): listSessions() -> saraksts ar saitēm uz #session/:id
}

export function unmount() {}
