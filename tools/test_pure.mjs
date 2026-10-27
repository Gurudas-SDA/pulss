// Tīro funkciju testi (Node 18+, bez pārlūka): node tools/test_pure.mjs
import assert from 'node:assert/strict';
import { parseHrMeasurement } from '../js/ble.js';
import { computeStats } from '../js/recorder.js';
import { findGaps, totalGapSec, GAP_SEC } from '../js/gaps.js';
import { isBackupStale, backupAgeDays, backupFileName, BACKUP_STALE_DAYS } from '../js/backup.js';
import { makeQuietWav } from '../js/keepalive.js';

let n = 0;
function test(name, fn) { fn(); n += 1; console.log('ok -', name); }

test('parseHrMeasurement uint8 + RR', () => {
  // flags 0x10 (RR present), bpm 72, RR 1024 (=1000 ms), 512 (=500 ms)
  const dv = new DataView(new Uint8Array([0x10, 72, 0x00, 0x04, 0x00, 0x02]).buffer);
  assert.deepEqual(parseHrMeasurement(dv), { bpm: 72, rr: [1000, 500] });
});

test('parseHrMeasurement uint16 bpm, no RR', () => {
  const dv = new DataView(new Uint8Array([0x01, 0x2c, 0x01]).buffer);
  assert.deepEqual(parseHrMeasurement(dv), { bpm: 300, rr: [] });
});

test('computeStats', () => {
  assert.deepEqual(computeStats([{ bpm: 60 }, { bpm: 80 }, { bpm: null }]),
    { avgBpm: 70, maxBpm: 80, minBpm: 60, sampleCount: 2 });
  assert.deepEqual(computeStats([]), { avgBpm: null, maxBpm: null, minBpm: null, sampleCount: 0 });
});

test('findGaps: none for 1 Hz series', () => {
  const s = Array.from({ length: 30 }, (_, i) => ({ t: i }));
  assert.deepEqual(findGaps(s), []);
});

test('findGaps: threshold is strict (> GAP_SEC)', () => {
  assert.equal(GAP_SEC, 10);
  assert.deepEqual(findGaps([{ t: 0 }, { t: 10 }]), []);
  assert.deepEqual(findGaps([{ t: 0 }, { t: 11 }]), [{ from: 0, to: 11, sec: 11 }]);
});

test('findGaps: multiple gaps + total', () => {
  const g = findGaps([{ t: 0 }, { t: 1 }, { t: 61 }, { t: 62 }, { t: 400 }]);
  assert.deepEqual(g, [{ from: 1, to: 61, sec: 60 }, { from: 62, to: 400, sec: 338 }]);
  assert.equal(totalGapSec(g), 398);
});

test('backup staleness', () => {
  const day = 86400000;
  const now = Date.UTC(2026, 9, 27, 12);
  assert.equal(BACKUP_STALE_DAYS, 7);
  assert.equal(isBackupStale(null, now, false), false, 'no sessions → no warning');
  assert.equal(isBackupStale(null, now, true), true, 'sessions, never backed up');
  assert.equal(isBackupStale(now - 6 * day, now, true), false);
  assert.equal(isBackupStale(now - 8 * day, now, true), true);
  assert.equal(backupAgeDays(now - 8 * day, now), 8);
  assert.equal(backupAgeDays(null, now), null);
});

test('backupFileName format', () => {
  assert.match(backupFileName(Date.now()), /^pulss-backup-\d{4}-\d{2}-\d{2}\.json$/);
});

test('makeQuietWav header + amplitude', () => {
  const w = makeQuietWav(8000, 1, 25, 0.003);
  const v = new DataView(w.buffer);
  const str = (o, len) => String.fromCharCode(...w.slice(o, o + len));
  assert.equal(str(0, 4), 'RIFF');
  assert.equal(str(8, 4), 'WAVE');
  assert.equal(v.getUint32(24, true), 8000);
  assert.equal(v.getUint32(40, true), 16000);
  assert.equal(w.length, 44 + 16000);
  let peak = 0;
  for (let i = 0; i < 8000; i++) peak = Math.max(peak, Math.abs(v.getInt16(44 + i * 2, true)));
  assert.ok(peak > 0 && peak <= 100, `peak ${peak}`);
});

console.log(`\n${n} tests passed`);
