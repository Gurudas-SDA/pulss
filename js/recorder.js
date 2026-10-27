// Ieraksta sesijas stāvokļa mašīna: 'idle' → 'recording' → 'stopping' → 'idle'.
//
// Klausās klienta 'hr' notikumus, paraugus tur atmiņā (this.samples: {t,bpm,rr}) un buferī,
// buferi raksta IndexedDB ik 5 s vai pie ≥5 paraugiem, sesijas statistiku — ik 30 s.
// Sesija ar status 'recording' un iestatījums 'activeSessionId' ļauj pēc avārijas
// (pārlāde, akumulators) atrast nepabeigtu ierakstu (findOrphan) un to pabeigt (finalizeOrphan).
//
// Fonā (lietotne nav priekšplānā / ekrāns izslēgts): sesija skaita fonā pavadīto laiku
// (bgSec) un fonā saņemtos paraugus (bgSamples) — tas ir mērījums, vai konkrētajā telefonā
// fona ierakstīšana strādā. Pēc atgriešanās priekšplānā savienojums tiek atjaunots
// (client.ensureConnected); spraugas starp paraugiem > GAP_SEC tiek saglabātas kā
// pārtraukumi (session.gaps). Pēc pārlūka aizvēršanas nepabeigtu ierakstu var turpināt
// (Recorder.resume) — laiks turpinās no sākotnējā sākuma, sprauga paliek kā pārtraukums.
// Fona režīms (keepalive.js): klusa audio cilpa, lai Chrome lapu neapturētu.
//
// Notikumi: 'change' {state}, 'sample' {t,bpm,rr}, 'status' {text} (piem., wake lock nav pieejams).
import { Emitter } from './emitter.js';
import { t } from './i18n.js';
import {
  putSession, getSession, deleteSession, putSamples, listSamples, getSetting, setSetting,
} from './db.js';
import { findGaps, totalGapSec } from './gaps.js';
import { startKeepAlive, resumeKeepAlive, stopKeepAlive } from './keepalive.js';

const FLUSH_MS = 5000;
const FLUSH_N = 5;
const STATS_MS = 30000;
const ACTIVE_KEY = 'activeSessionId';
export const KEEPALIVE_KEY = 'keepAlive'; // iestatījums: fona režīms (noklusēti ieslēgts)

function isHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

// Tīra funkcija: {avgBpm, maxBpm, minBpm, sampleCount} no paraugu masīva ({bpm} pietiek).
export function computeStats(samples) {
  let sum = 0;
  let n = 0;
  let max = null;
  let min = null;
  for (const s of samples || []) {
    const b = s && s.bpm;
    if (typeof b !== 'number' || !Number.isFinite(b)) continue;
    n += 1;
    sum += b;
    if (max === null || b > max) max = b;
    if (min === null || b < min) min = b;
  }
  return { avgBpm: n ? Math.round(sum / n) : null, maxBpm: max, minBpm: min, sampleCount: n };
}

export class Recorder extends Emitter {
  constructor() {
    super();
    this.state = 'idle';
    this.session = null;
    this.samples = [];
    this.startedAt = null;
    this._buffer = [];
    this._flushTimer = null;
    this._statsTimer = null;
    this._wakeLock = null;
    this.wakeLockStatus = null;
    this._client = null;
    this._unsubHr = null;
    this._sum = 0;
    this._max = null;
    this._min = null;
    this._lastT = -1;
    this._hiddenSince = null;
    this._onHr = (p) => this.onHr(p);
    this._onVisibility = () => this._visibilityChanged();
    this._onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
  }

  get elapsedSec() {
    return this.startedAt ? Math.round((Date.now() - this.startedAt) / 1000) : 0;
  }

  get stats() {
    const n = this.samples.length;
    return { avgBpm: n ? Math.round(this._sum / n) : null, maxBpm: this._max, minBpm: this._min, sampleCount: n };
  }

  async start(activityId, client) {
    if (this.state !== 'idle') throw new Error(t.errors.recorderBusy);
    if (!client) throw new Error(t.errors.noClient);
    const now = Date.now();
    this._beginKeepAlive(); // pēc iespējas tuvāk lietotāja pieskārienam (autoplay politika)
    this.session = {
      id: crypto.randomUUID(),
      activityId,
      startedAt: now,
      endedAt: null,
      durationSec: 0,
      avgBpm: null,
      maxBpm: null,
      minBpm: null,
      sampleCount: 0,
      status: 'recording',
      bgSec: 0,
      bgSamples: 0,
    };
    this.samples = [];
    this._buffer = [];
    this._sum = 0;
    this._max = this._min = null;
    this._lastT = -1;
    this.startedAt = now;
    try {
      await putSession(this.session);
      await setSetting(ACTIVE_KEY, this.session.id);
    } catch (e) {
      stopKeepAlive();
      this.session = null;
      this.startedAt = null;
      throw e;
    }
    this._activate(client);
    return this.session;
  }

  // Turpina nepabeigtu ierakstu (pēc pārlūka aizvēršanas / Android apturēšanas).
  // Laiks turpinās no sākotnējā sākuma; sprauga starp pēdējo paraugu un tagad paliek kā pārtraukums.
  async resume(sessionId, client) {
    if (this.state !== 'idle') throw new Error(t.errors.recorderBusy);
    if (!client) throw new Error(t.errors.noClient);
    this._beginKeepAlive();
    try {
      const s = await getSession(sessionId);
      if (!s || s.status !== 'recording') throw new Error(t.errors.sessionNotResumable);
      const samples = await listSamples(sessionId);
      s.bgSec = s.bgSec || 0;
      s.bgSamples = s.bgSamples || 0;
      this.session = s;
      this.samples = samples.map((x) => ({ t: x.t, bpm: x.bpm, rr: x.rr ?? null }));
      this._buffer = [];
      this._sum = 0;
      this._max = this._min = null;
      for (const x of this.samples) {
        this._sum += x.bpm;
        if (this._max === null || x.bpm > this._max) this._max = x.bpm;
        if (this._min === null || x.bpm < this._min) this._min = x.bpm;
      }
      this._lastT = this.samples.length ? this.samples[this.samples.length - 1].t : -1;
      this.startedAt = s.startedAt;
      await setSetting(ACTIVE_KEY, s.id);
    } catch (e) {
      stopKeepAlive();
      this.session = null;
      this.samples = [];
      this.startedAt = null;
      throw e;
    }
    this._activate(client);
    return this.session;
  }

  _activate(client) {
    this.state = 'recording';
    this._hiddenSince = isHidden() ? Date.now() : null;
    this.setClient(client);
    this._flushTimer = setInterval(() => this._flush().catch(console.error), FLUSH_MS);
    this._statsTimer = setInterval(() => {
      this._saveStats().catch(console.error);
      // Ieraksta laikā nepadodas: ja atkārtotas savienošanās cikls beidzās, sāk no jauna.
      if (this._client && this._client.ensureConnected) this._client.ensureConnected();
    }, STATS_MS);
    document.addEventListener('visibilitychange', this._onVisibility);
    window.addEventListener('beforeunload', this._onBeforeUnload);
    this._requestWakeLock();
    this.emit('change', { state: this.state });
  }

  _beginKeepAlive() {
    // play() jāsauc uzreiz (žesta tuvumā), bet iestatījums nāk no DB asinhroni — tāpēc
    // sākam vienmēr un apturam, ja fona režīms izslēgts.
    startKeepAlive(t.record.mediaTitle).catch(() => {});
    getSetting(KEEPALIVE_KEY, true).then((on) => { if (!on) stopKeepAlive(); }).catch(() => {});
  }

  _visibilityChanged() {
    if (this.state !== 'recording' || !this.session) return;
    if (isHidden()) {
      if (this._hiddenSince === null) this._hiddenSince = Date.now();
      // Fonā lapa var tikt apturēta — saglabā tagad.
      this._flush().catch(console.error);
      this._saveStats().catch(console.error);
      return;
    }
    if (!this._wakeLock) this._requestWakeLock();
    resumeKeepAlive();
    if (this._client && this._client.ensureConnected) this._client.ensureConnected();
    this._saveStats().catch(console.error); // pieskaita fonā pavadīto laiku
  }

  // Pieskaita fonā pavadīto laiku sesijai (bgSec); ja joprojām fonā — skaita no jauna.
  _addHidden() {
    if (this._hiddenSince === null || !this.session) return;
    const now = Date.now();
    this.session.bgSec = (this.session.bgSec || 0) + Math.round((now - this._hiddenSince) / 1000);
    this._hiddenSince = isHidden() ? now : null;
  }

  // Pārslēdz 'hr' avotu (piem., ja josta pievienota no jauna ieraksta laikā).
  setClient(client) {
    if (this._unsubHr) { this._unsubHr(); this._unsubHr = null; }
    this._client = client || null;
    if (this._client && this.state === 'recording') this._unsubHr = this._client.on('hr', this._onHr);
  }

  onHr({ bpm, rr, ts }) {
    if (this.state !== 'recording') return;
    if (typeof bpm !== 'number' || !Number.isFinite(bpm) || bpm <= 0) return; // 0 = josta nesajūt pulsu
    const tt = Math.round(((ts ?? Date.now()) - this.startedAt) / 1000);
    if (tt <= this._lastT) return; // dedupe: viens paraugs sekundē
    this._lastT = tt;
    const rrArr = Array.isArray(rr) && rr.length ? rr.slice() : null;
    const sample = { t: tt, bpm, rr: rrArr };
    this.samples.push(sample);
    if (isHidden() && this.session) this.session.bgSamples = (this.session.bgSamples || 0) + 1;
    this._buffer.push({ sessionId: this.session.id, t: tt, bpm, rr: rrArr });
    this._sum += bpm;
    if (this._max === null || bpm > this._max) this._max = bpm;
    if (this._min === null || bpm < this._min) this._min = bpm;
    this.emit('sample', sample);
    if (this._buffer.length >= FLUSH_N) this._flush().catch(console.error);
  }

  async _flush() {
    if (!this._buffer.length || !this.session) return;
    const batch = this._buffer;
    this._buffer = [];
    try {
      await putSamples(batch);
    } catch (e) {
      this._buffer = batch.concat(this._buffer); // atslēga (sessionId,t) → atkārtots put ir drošs
      throw e;
    }
  }

  async _saveStats() {
    if (this.state !== 'recording' || !this.session) return;
    this._addHidden();
    Object.assign(this.session, this.stats, { durationSec: this.elapsedSec });
    await putSession(this.session);
  }

  async stop() { return this._finish(false); }

  async discard() { return this._finish(true); }

  async _finish(discard) {
    if (this.state !== 'recording') return null;
    this.state = 'stopping';
    this.emit('change', { state: this.state });
    this.setClient(null);
    if (this._flushTimer) clearInterval(this._flushTimer);
    if (this._statsTimer) clearInterval(this._statsTimer);
    this._flushTimer = this._statsTimer = null;
    document.removeEventListener('visibilitychange', this._onVisibility);
    window.removeEventListener('beforeunload', this._onBeforeUnload);
    this._releaseWakeLock();
    stopKeepAlive();
    this._addHidden();
    this._hiddenSince = null;
    const s = this.session;
    try {
      if (discard) {
        this._buffer = [];
        await deleteSession(s.id);
      } else {
        await this._flush();
        s.endedAt = Date.now();
        s.durationSec = Math.round((s.endedAt - s.startedAt) / 1000);
        Object.assign(s, computeStats(this.samples));
        s.gaps = findGaps(this.samples);
        s.gapSec = totalGapSec(s.gaps);
        s.status = 'done';
        await putSession(s);
      }
      await setSetting(ACTIVE_KEY, null);
    } finally {
      this.state = 'idle';
      this.session = null;
      this.startedAt = null;
      this.emit('change', { state: this.state });
    }
    return discard ? null : s;
  }

  // Pēdējais wake lock statusa teksts (null = viss kārtībā) — skats to rāda arī tad, ja
  // notikums izšauts pirms skata montēšanas.
  _setWakeStatus(text) {
    this.wakeLockStatus = text;
    this.emit('status', { text });
  }

  async _requestWakeLock() {
    if (this._wakeLock) return;
    if (!navigator.wakeLock || !navigator.wakeLock.request) {
      this._setWakeStatus(t.record.wakeLockUnavailable);
      return;
    }
    try {
      const lock = await navigator.wakeLock.request('screen');
      this._wakeLock = lock;
      this.wakeLockStatus = null;
      lock.addEventListener('release', () => { if (this._wakeLock === lock) this._wakeLock = null; });
    } catch (e) {
      console.warn('Wake lock denied', e);
      this._setWakeStatus(t.record.wakeLockDenied);
    }
  }

  _releaseWakeLock() {
    const lock = this._wakeLock;
    this._wakeLock = null;
    this.wakeLockStatus = null;
    if (lock) lock.release().catch(() => {});
  }

  // Nepabeigta sesija pēc avārijas: atgriež to vai notīra novecojušu iestatījumu.
  static async findOrphan() {
    const id = await getSetting(ACTIVE_KEY, null);
    if (!id) return null;
    const s = await getSession(id);
    if (s && s.status === 'recording') return s;
    await setSetting(ACTIVE_KEY, null);
    return null;
  }

  // Pabeidz nepabeigtu sesiju no DB paraugiem (atsākšana nav paredzēta — tikai pabeigt vai dzēst).
  static async finalizeOrphan(id) {
    const s = await getSession(id);
    if (!s) { await setSetting(ACTIVE_KEY, null); return null; }
    const samples = await listSamples(id);
    const last = samples.length ? samples[samples.length - 1] : null;
    s.endedAt = last ? s.startedAt + last.t * 1000 : s.startedAt;
    s.durationSec = Math.round((s.endedAt - s.startedAt) / 1000);
    Object.assign(s, computeStats(samples));
    s.gaps = findGaps(samples);
    s.gapSec = totalGapSec(s.gaps);
    s.status = 'done';
    await putSession(s);
    await setSetting(ACTIVE_KEY, null);
    return s;
  }

  static async discardOrphan(id) {
    await deleteSession(id);
    await setSetting(ACTIVE_KEY, null);
  }
}
