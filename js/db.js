// IndexedDB slānis — STUB (pilnā implementācija 2./3. solī).
//
// Plānotā shēma:
//   DB 'pulss', versija 1
//   store 'sessions'  keyPath 'id'      — { id, startedAt, endedAt, activity, avgBpm, maxBpm, samples: n }
//   store 'samples'   keyPath ['sid','ts'] — { sid, ts, bpm, rr }   index 'sid'
export const DB_NAME = 'pulss';
export const DB_VERSION = 1;

export async function openDb() {
  // TODO: indexedDB.open(DB_NAME, DB_VERSION) ar onupgradeneeded, kas veido store'us.
  throw new Error('openDb: TODO');
}

export async function saveSession(/* session */) {
  // TODO
  throw new Error('saveSession: TODO');
}

export async function listSessions() {
  // TODO
  return [];
}

export async function getSession(/* id */) {
  // TODO
  return null;
}

export async function deleteSession(/* id */) {
  // TODO
}
