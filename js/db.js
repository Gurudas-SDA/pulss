// IndexedDB slānis — DB 'pulss', versija 1.
//
// Store'i:
//   activities  keyPath 'id'             — { id, name, order, createdAt }
//   sessions    keyPath 'id'             — { id, activityId, startedAt, endedAt, durationSec,
//                                            avgBpm, maxBpm, minBpm, sampleCount, status }
//                                          status: 'recording' | 'done'
//                                          indeksi: byActivity (activityId), byStart (startedAt)
//   samples     keyPath ['sessionId','t'] — { sessionId, t, bpm, rr }
//                                          t = sekundes no sesijas sākuma, rr = ms masīvs | null
//                                          indekss: bySession (sessionId)
//   settings    keyPath 'key'            — { key, value }
import { t, DEFAULT_ACTIVITIES } from './i18n.js';

export const DB_NAME = 'pulss';
export const DB_VERSION = 1;

const DATA_STORES = ['activities', 'sessions', 'samples'];

let dbPromise = null;

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Transakcijas palīgs: fn(stores, txn) saņem store'us (viens vai objekts pēc nosaukuma),
// var atgriezt vērtību vai promise; resolve notiek pie transakcijas 'complete'.
async function tx(storeNames, mode, fn) {
  const db = await openDb();
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  return new Promise((resolve, reject) => {
    const txn = db.transaction(names, mode);
    const stores = {};
    for (const n of names) stores[n] = txn.objectStore(n);
    let result;
    let failed = false;
    txn.oncomplete = () => resolve(result);
    txn.onerror = () => { if (!failed) reject(txn.error); };
    txn.onabort = () => { if (!failed) reject(txn.error || new Error('Transaction aborted')); };
    Promise.resolve()
      .then(() => fn(names.length === 1 ? stores[names[0]] : stores, txn))
      .then((r) => { result = r; })
      .catch((e) => { failed = true; try { txn.abort(); } catch (_) { /* jau aborted */ } reject(e); });
  });
}

// Visi ieraksti no store vai indeksa (IDBObjectStore/IDBIndex.getAll).
function getAll(source, query) {
  return reqToPromise(source.getAll(query));
}

function newActivity(name, order) {
  return { id: crypto.randomUUID(), name, order, createdAt: Date.now() };
}

function seedActivities(store) {
  DEFAULT_ACTIVITIES.forEach((name, i) => store.put(newActivity(name, i)));
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error(t.errors.noIndexedDb));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (ev.oldVersion < 1) {
        const act = db.createObjectStore('activities', { keyPath: 'id' });
        const ses = db.createObjectStore('sessions', { keyPath: 'id' });
        ses.createIndex('byActivity', 'activityId', { unique: false });
        ses.createIndex('byStart', 'startedAt', { unique: false });
        const smp = db.createObjectStore('samples', { keyPath: ['sessionId', 't'] });
        smp.createIndex('bySession', 'sessionId', { unique: false });
        db.createObjectStore('settings', { keyPath: 'key' });
        seedActivities(act);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error(t.errors.dbOpen));
    req.onblocked = () => reject(new Error(t.errors.dbBlocked));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

// ---------- Aktivitātes ----------

export async function listActivities() {
  const all = await tx('activities', 'readonly', (s) => getAll(s));
  return all.sort((a, b) => a.order - b.order);
}

export async function addActivity(name) {
  return tx('activities', 'readwrite', async (s) => {
    const all = await getAll(s);
    const order = all.length ? Math.max(...all.map((a) => a.order)) + 1 : 0;
    const a = newActivity(name, order);
    s.put(a);
    return a;
  });
}

export async function renameActivity(id, name) {
  return tx('activities', 'readwrite', async (s) => {
    const a = await reqToPromise(s.get(id));
    if (!a) throw new Error(t.errors.activityNotFound);
    a.name = name;
    s.put(a);
    return a;
  });
}

export async function deleteActivity(id) {
  return tx(['activities', 'sessions'], 'readwrite', async ({ activities, sessions }) => {
    const n = await reqToPromise(sessions.index('byActivity').count(id));
    if (n > 0) {
      const err = new Error(t.activities.hasSessions);
      err.code = 'HAS_SESSIONS';
      throw err;
    }
    activities.delete(id);
  });
}

// direction: -1 (uz augšu) | 1 (uz leju). Apmaina 'order' ar kaimiņu.
export async function moveActivity(id, direction) {
  return tx('activities', 'readwrite', async (s) => {
    const all = (await getAll(s)).sort((a, b) => a.order - b.order);
    const i = all.findIndex((a) => a.id === id);
    const j = i + (direction < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= all.length) return false;
    // Normalizē kārtību uz 0..n-1 un apmaina divus.
    all.forEach((a, k) => { a.order = k; });
    all[i].order = j;
    all[j].order = i;
    s.put(all[i]);
    s.put(all[j]);
    return true;
  });
}

// ---------- Sesijas ----------

export async function putSession(session) {
  await tx('sessions', 'readwrite', (s) => { s.put(session); });
  return session;
}

export async function getSession(id) {
  return tx('sessions', 'readonly', (s) => reqToPromise(s.get(id))).then((r) => r || null);
}

export async function listSessions({ activityId } = {}) {
  const all = await tx('sessions', 'readonly', (s) =>
    activityId ? getAll(s.index('byActivity'), activityId) : getAll(s));
  return all.sort((a, b) => b.startedAt - a.startedAt);
}

function deleteSamplesOf(samplesStore, sessionId) {
  return new Promise((resolve, reject) => {
    const req = samplesStore.index('bySession').openKeyCursor(IDBKeyRange.only(sessionId));
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) { resolve(); return; }
      samplesStore.delete(cur.primaryKey);
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id) {
  return tx(['sessions', 'samples'], 'readwrite', async ({ sessions, samples }) => {
    sessions.delete(id);
    await deleteSamplesOf(samples, id);
  });
}

// ---------- Paraugi ----------

export async function putSamples(array) {
  if (!array || !array.length) return 0;
  await tx('samples', 'readwrite', (s) => { for (const smp of array) s.put(smp); });
  return array.length;
}

export async function listSamples(sessionId) {
  const all = await tx('samples', 'readonly', (s) => getAll(s.index('bySession'), sessionId));
  return all.sort((a, b) => a.t - b.t);
}

// ---------- Iestatījumi ----------

export async function getSetting(key, fallback = undefined) {
  const row = await tx('settings', 'readonly', (s) => reqToPromise(s.get(key)));
  return row ? row.value : fallback;
}

export async function setSetting(key, value) {
  await tx('settings', 'readwrite', (s) => { s.put({ key, value }); });
}

// ---------- Eksports / imports ----------

export async function exportAll() {
  const { activities, sessions, samples } = await tx(DATA_STORES, 'readonly', async (st) => ({
    activities: await getAll(st.activities),
    sessions: await getAll(st.sessions),
    samples: await getAll(st.samples),
  }));
  activities.sort((a, b) => a.order - b.order);
  sessions.sort((a, b) => a.startedAt - b.startedAt);
  samples.sort((a, b) => (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : a.t - b.t));
  return {
    schema: 1,
    app: 'pulss',
    exportedAt: new Date().toISOString(),
    activities,
    sessions,
    samples,
  };
}

function validateImport(data) {
  if (!data || typeof data !== 'object' || data.schema !== 1) throw new Error(t.errors.importSchema);
  for (const k of DATA_STORES) {
    if (!Array.isArray(data[k])) throw new Error(t.errors.importShape);
  }
  const okId = (r) => r && typeof r === 'object' && typeof r.id === 'string' && r.id;
  if (!data.activities.every((a) => okId(a) && typeof a.name === 'string')) throw new Error(t.errors.importShape);
  if (!data.sessions.every(okId)) throw new Error(t.errors.importShape);
  if (!data.samples.every((s) => s && typeof s.sessionId === 'string' && typeof s.t === 'number')) {
    throw new Error(t.errors.importShape);
  }
}

// mode: 'merge' (put pēc id, esošie pārrakstīti) | 'replace' (vispirms iztīra datu store'us).
export async function importAll(data, { mode = 'merge' } = {}) {
  validateImport(data);
  if (mode !== 'merge' && mode !== 'replace') throw new Error(t.errors.importMode);
  await tx(DATA_STORES, 'readwrite', (st) => {
    if (mode === 'replace') for (const k of DATA_STORES) st[k].clear();
    for (const a of data.activities) st.activities.put(a);
    for (const s of data.sessions) st.sessions.put(s);
    for (const s of data.samples) st.samples.put(s);
  });
  return {
    activities: data.activities.length,
    sessions: data.sessions.length,
    samples: data.samples.length,
  };
}

// Dzēš visu (datus + iestatījumus) un no jauna iesēj noklusējuma aktivitātes.
export async function clearAll() {
  await tx([...DATA_STORES, 'settings'], 'readwrite', (st) => {
    for (const k of DATA_STORES) st[k].clear();
    st.settings.clear();
    seedActivities(st.activities);
  });
}
