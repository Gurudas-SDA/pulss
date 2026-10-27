// Datu drošība: pastāvīgā glabāšana (navigator.storage.persist) un JSON rezerves kopijas.
//
// Kāpēc: IndexedDB dzīvo pārlūka vietnes krātuvē — ja Chrome to iztīra (vietas trūkums,
// "Notīrīt datus", tīrīšanas lietotnes), dati pazūd bez pēdām. Divi aizsardzības slāņi:
//   1) persist() — lūdz Chrome krātuvi neiztīrīt automātiski (Chrome lemj pats, bez dialoga);
//   2) automātiska JSON kopija mapē Download pēc katra pabeigta ieraksta — tā dzīvo ārpus
//      pārlūka un ir derīga "Importēt JSON".
import { exportAll, getSetting, setSetting } from './db.js';
import { fmtDate } from './format.js';
import { downloadFile } from './download.js';

export const BACKUP_STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export const AUTO_BACKUP_KEY = 'autoBackup';     // bool, noklusējums true
export const LAST_BACKUP_KEY = 'lastBackupAt';   // ms | null

export function backupFileName(ts) {
  return `pulss-backup-${fmtDate(ts)}.json`;
}

// true, ja jābrīdina: ir ieraksti un kopijas nav vai tā vecāka par BACKUP_STALE_DAYS.
export function isBackupStale(lastAt, now, hasSessions) {
  if (!hasSessions) return false;
  if (!lastAt) return true;
  return now - lastAt > BACKUP_STALE_DAYS * DAY_MS;
}

export function backupAgeDays(lastAt, now) {
  return lastAt ? Math.floor((now - lastAt) / DAY_MS) : null;
}

// Pilns eksports (tas pats formāts kā "Eksportēt JSON") → lejupielāde → atzīmē laiku.
export async function makeBackup({ name, pretty = false } = {}) {
  const data = await exportAll();
  const fileName = name || backupFileName(Date.now());
  downloadFile(fileName, JSON.stringify(data, null, pretty ? 1 : 0), 'application/json');
  await setSetting(LAST_BACKUP_KEY, Date.now());
  return fileName;
}

// Pēc pabeigta ieraksta: kopija tikai, ja slēdzis ieslēgts. Atgriež faila nosaukumu vai null.
export async function autoBackup() {
  if (!(await getSetting(AUTO_BACKUP_KEY, true))) return null;
  return makeBackup();
}

export async function isPersisted() {
  try {
    if (!navigator.storage || !navigator.storage.persisted) return null; // nav zināms
    return await navigator.storage.persisted();
  } catch (_) { return null; }
}

// Lūdz pastāvīgu glabāšanu. Chrome dialogu nerāda — piešķir pēc savām pazīmēm
// (instalēta lietotne, iesaiste). Atgriež true/false/null (API nav).
export async function requestPersist() {
  try {
    if (!navigator.storage || !navigator.storage.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (_) { return null; }
}
