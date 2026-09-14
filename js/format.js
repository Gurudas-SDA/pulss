// Datumu/laika formatēšana (lv-LV). Lieto CSV eksportā, sesiju sarakstā, analītikā.
const LOCALE = 'lv-LV';

function pad2(n) { return String(n).padStart(2, '0'); }

// 2026-09-14
export function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// 13:05
export function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

// 2026-09-14 13:05
export function fmtDateTime(ts) {
  return `${fmtDate(ts)} ${fmtTime(ts)}`;
}

// 1:02:05 vai 12:05
export function fmtDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad2(m)}:${pad2(r)}` : `${m}:${pad2(r)}`;
}
