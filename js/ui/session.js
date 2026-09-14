import { t } from '../i18n.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function render(container, params) {
  const idPart = params.id ? ` #${escapeHtml(params.id)}` : '';
  container.innerHTML = `
    <h2>${t.session.title}${idPart}</h2>
    <p>${t.session.placeholder}</p>
  `;
  // TODO (3./4. solis): getSession(params.id) -> detaļas + drawLineChart; ja null -> t.session.notFound
}

export function unmount() {}
