import { t } from '../i18n.js';

export function render(container) {
  container.innerHTML = `
    <h2>${t.analytics.title}</h2>
    <p>${t.analytics.placeholder}</p>
  `;
  // TODO (4. solis): drawLineChart ar tendencēm pa aktivitātēm / nedēļām
}

export function unmount() {}
