import { t, fill } from '../i18n.js';
import { showToast, escapeHtml } from '../app.js';
import {
  listActivities, addActivity, renameActivity, deleteActivity, moveActivity,
} from '../db.js';

let root = null;
let alive = false;

function rowHtml(a, i, n) {
  const s = t.activities;
  return `
    <li class="list-row" data-id="${a.id}">
      <span class="list-name">${escapeHtml(a.name)}</span>
      <span class="list-actions">
        <button class="icon-btn" type="button" data-act="up" ${i === 0 ? 'disabled' : ''} title="${s.up}" aria-label="${s.up}">▲</button>
        <button class="icon-btn" type="button" data-act="down" ${i === n - 1 ? 'disabled' : ''} title="${s.down}" aria-label="${s.down}">▼</button>
        <button class="icon-btn" type="button" data-act="rename" title="${s.rename}" aria-label="${s.rename}">✎</button>
        <button class="icon-btn danger" type="button" data-act="delete" title="${s.remove}" aria-label="${s.remove}">🗑</button>
      </span>
    </li>`;
}

async function renderList() {
  const listEl = root && root.querySelector('#act-list');
  if (!listEl) return;
  const items = await listActivities();
  if (!alive) return;
  listEl.innerHTML = items.length
    ? items.map((a, i) => rowHtml(a, i, items.length)).join('')
    : `<li class="list-empty">${t.activities.empty}</li>`;
}

async function handleAction(act, id, name) {
  const s = t.activities;
  if (act === 'up' || act === 'down') {
    await moveActivity(id, act === 'up' ? -1 : 1);
  } else if (act === 'rename') {
    const raw = prompt(s.renamePrompt, name);
    if (raw == null) return;
    const next = raw.trim();
    if (!next || next === name) return;
    if (await isDuplicate(next, id)) { showToast(s.duplicate); return; }
    await renameActivity(id, next);
  } else if (act === 'delete') {
    if (!confirm(fill(s.removeConfirm, { name }))) return;
    try {
      await deleteActivity(id);
      showToast(fill(s.removed, { name }));
    } catch (e) {
      if (e && e.code === 'HAS_SESSIONS') { showToast(s.hasSessions); return; }
      throw e;
    }
  }
  await renderList();
}

async function isDuplicate(name, exceptId) {
  const lower = name.toLowerCase();
  return (await listActivities()).some((a) => a.id !== exceptId && a.name.toLowerCase() === lower);
}

async function handleAdd() {
  const s = t.activities;
  const input = root.querySelector('#act-new');
  const name = input.value.trim();
  if (!name) return;
  if (await isDuplicate(name)) { showToast(s.duplicate); return; }
  await addActivity(name);
  input.value = '';
  showToast(fill(s.added, { name }));
  await renderList();
  input.focus();
}

export function render(container) {
  const s = t.activities;
  root = container;
  alive = true;
  container.innerHTML = `
    <h2>${s.title}</h2>
    <p>${s.intro}</p>
    <ul id="act-list" class="list card"></ul>
    <form id="act-form" class="input-row card">
      <input type="text" id="act-new" placeholder="${s.newPlaceholder}" maxlength="60" autocomplete="off">
      <button class="btn" type="submit">${s.add}</button>
    </form>
  `;

  container.querySelector('#act-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('.list-row');
    const name = row.querySelector('.list-name').textContent;
    handleAction(btn.dataset.act, row.dataset.id, name).catch((err) => {
      console.error(err);
      showToast(`${t.errors.dbFailed}: ${err.message}`);
    });
  });

  container.querySelector('#act-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleAdd().catch((err) => {
      console.error(err);
      showToast(`${t.errors.dbFailed}: ${err.message}`);
    });
  });

  renderList().catch((err) => {
    console.error(err);
    showToast(`${t.errors.dbFailed}: ${err.message}`);
  });
}

export function unmount() {
  alive = false;
  root = null;
}
