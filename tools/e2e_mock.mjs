// E2E pārbaude ar imitēto jostu headless Chrome (Node 22+, bez atkarībām — CDP caur WebSocket).
//   node tools/e2e_mock.mjs
// Palaiž `python -m http.server 8898` un Chrome ar tukšu profilu; abus aizver beigās.
// Pārbauda: ieraksts → pārtraukums (20 s) → saglabāšana ar gaps; automātiskā kopija (lejupielāde,
// derīgs JSON); fona laika uzskaite (imitēts visibilitychange); lapas iesaldēšana (CDP frozen) →
// pārtraukums; nepabeigta ieraksta turpināšana pēc pārlādes; iestatījumu datu drošības karte.
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8898;
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || ''; // ja norādīts — ekrānuzņēmumi šajā mapē

const profile = mkdtempSync(join(tmpdir(), 'pulss-e2e-prof-'));
const dlDir = mkdtempSync(join(tmpdir(), 'pulss-e2e-dl-'));
const server = spawn('python', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
const chrome = spawn(CHROME, [
  '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=9333',
  '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
  'about:blank',
], { stdio: 'ignore', windowsHide: true });

let ws; let id = 0; const pending = new Map(); const events = [];
function send(method, params = {}, sessionId) {
  const msg = { id: ++id, method, params };
  if (sessionId) msg.sessionId = sessionId;
  ws.send(JSON.stringify(msg));
  return new Promise((res, rej) => pending.set(msg.id, { res, rej }));
}
let SID;
const cdp = (m, p) => send(m, p, SID);
async function ev(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`eval failed: ${expr}\n${JSON.stringify(r.exceptionDetails).slice(0, 400)}`);
  return r.result.value;
}
async function waitFor(expr, ms = 10000, label = expr) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await ev(expr).catch(() => false)) return; await sleep(200); }
  throw new Error(`timeout: ${label}`);
}
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
}
const dbSessions = () => ev(`import('./js/db.js').then(m => m.listSessions())`);
const dbSamples = (sid) => ev(`import('./js/db.js').then(m => m.listSamples(${JSON.stringify(sid)}))`);

async function main() {
  let ver;
  for (let i = 0; i < 50; i++) {
    try { ver = await (await fetch('http://127.0.0.1:9333/json/version')).json(); break; } catch (_) { await sleep(200); }
  }
  ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      if (d.error) p.rej(new Error(JSON.stringify(d.error))); else p.res(d.result);
    } else if (d.method) {
      events.push(d);
      if (d.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }, d.sessionId);
    }
  };
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  ({ sessionId: SID } = await send('Target.attachToTarget', { targetId, flatten: true }));
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 412, height: 1400, deviceScaleFactor: 1, mobile: true });
  await cdp('Runtime.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dlDir });
  const base = `http://localhost:${PORT}/?mock=1`;
  for (let i = 0; i < 30; i++) { try { await fetch(base); break; } catch (_) { await sleep(200); } }
  await cdp('Page.navigate', { url: `${base}#home` });
  await waitFor(`!!document.querySelector('#btn-connect')`);
  await ev(`window.confirm = () => true; true`);

  // 1) Pievienot imitēto jostu, sākt ierakstu
  await ev(`document.querySelector('#btn-connect').click(), true`);
  await waitFor(`!document.querySelector('#btn-start').disabled`, 8000, 'connected+start enabled');
  await ev(`document.querySelector('#btn-start').click(), true`);
  await waitFor(`location.hash === '#record'`);
  await sleep(4000);
  assert.equal(await ev(`import('./js/keepalive.js').then(m => m.isKeepAlivePlaying())`), true, 'keepalive audio playing');
  assert.equal(await ev(`navigator.mediaSession.metadata && navigator.mediaSession.metadata.title`), 'Pulss — ieraksts notiek');
  console.log('ok - keepalive audio + media session during recording');

  // 2) Imitēts fons: visibilityState=hidden 4 s (paraugi turpina nākt — mērījums bgSamples)
  await ev(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange')); return true; })()`);
  await sleep(4000);
  await ev(`(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange')); return true; })()`);

  // 3) Pārtraukums 20 s (imitēta atvienošanās)
  await ev(`document.querySelector('#btn-sim-gap').click(), true`);
  await sleep(24000);

  // 4) Lapas iesaldēšana (kā Android fonā) 15 s → vēl viens pārtraukums
  await cdp('Page.setWebLifecycleState', { state: 'frozen' });
  await sleep(15000);
  await cdp('Page.setWebLifecycleState', { state: 'active' });
  await sleep(4000);

  // 5) Beigt
  await ev(`window.confirm = () => true; document.querySelector('#btn-stop').click(), true`);
  await waitFor(`location.hash.startsWith('#session/')`, 10000, 'session view');
  await sleep(1500);
  let sessions = await dbSessions();
  assert.equal(sessions.length, 1);
  const s1 = sessions[0];
  console.log('session1', JSON.stringify({ dur: s1.durationSec, n: s1.sampleCount, gaps: s1.gaps, bgSec: s1.bgSec, bgSamples: s1.bgSamples }));
  assert.equal(s1.status, 'done');
  assert.ok(s1.gaps.length >= 2, 'expected >=2 gaps (sim + freeze)');
  assert.ok(s1.gaps.some((g) => g.sec >= 18 && g.sec <= 24), 'sim gap ~20 s');
  assert.ok(s1.gaps.some((g) => g.sec >= 13), 'freeze gap');
  assert.ok(s1.bgSec >= 3 && s1.bgSec <= 6, `bgSec ${s1.bgSec}`);
  assert.ok(s1.bgSamples >= 2, `bgSamples ${s1.bgSamples}`);
  const sesText = await ev(`document.querySelector('#view').innerText`);
  assert.match(sesText, /Pārtraukumi\s*\n?\s*2 \(kopā/);
  assert.match(sesText, /Fonā/);
  assert.equal(await ev(`import('./js/keepalive.js').then(m => m.isKeepAlivePlaying())`), false, 'keepalive stopped');
  await shot('session1');
  console.log('ok - recording with gaps, background accounting, session view');

  // 6) Automātiskā kopija lejupielādēta un derīga importam
  await sleep(1500);
  const files = readdirSync(dlDir).filter((f) => f.startsWith('pulss-backup-') && f.endsWith('.json'));
  assert.equal(files.length, 1, `download files: ${readdirSync(dlDir)}`);
  const data = JSON.parse(readFileSync(join(dlDir, files[0]), 'utf8'));
  assert.equal(data.schema, 1);
  assert.equal(data.sessions.length, 1);
  assert.equal(data.samples.length, s1.sampleCount);
  const lastAt = await ev(`import('./js/db.js').then(m => m.getSetting('lastBackupAt'))`);
  assert.ok(lastAt > Date.now() - 60000);
  console.log('ok - auto backup', files[0], `${data.samples.length} samples`);

  // 7) Iestatījumi: datu drošības karte
  await ev(`location.hash = '#settings', true`);
  await waitFor(`document.querySelector('#last-backup') && document.querySelector('#last-backup').textContent !== '—'`);
  const set = await ev(`({ persist: document.querySelector('#persist').textContent,
    last: document.querySelector('#last-backup').textContent,
    warn: document.querySelector('#backup-warn').hidden,
    auto: document.querySelector('#auto-backup').checked,
    keep: document.querySelector('#keep-alive').checked })`);
  console.log('settings', JSON.stringify(set));
  assert.ok(['jā', 'nē', 'nav zināms'].includes(set.persist));
  assert.match(set.last, /\(0 d\. atpakaļ\)/);
  assert.equal(set.warn, true);
  assert.equal(set.auto, true);
  assert.equal(set.keep, true);
  // brīdinājums: kopija pirms 8 dienām
  await ev(`import('./js/db.js').then(m => m.setSetting('lastBackupAt', Date.now() - 8 * 86400000)).then(() => true)`);
  await ev(`location.hash = '#home', true`);
  await sleep(300);
  await ev(`location.hash = '#settings', true`);
  await waitFor(`!document.querySelector('#backup-warn').hidden`, 5000, 'stale warning');
  const warnText = await ev(`document.querySelector('#backup-warn').innerText`);
  assert.match(warnText, /8 dienas/);
  await shot('settings_stale');
  console.log('ok - settings safety card + stale warning:', warnText);

  // 8) Nepabeigts ieraksts pēc pārlādes → Turpināt
  await ev(`location.hash = '#home', true`);
  await waitFor(`!!document.querySelector('#btn-connect')`);
  if (!(await ev(`!document.querySelector('#btn-start').disabled`))) {
    await ev(`document.querySelector('#btn-connect').click(), true`);
    await waitFor(`!document.querySelector('#btn-start').disabled`);
  }
  await ev(`document.querySelector('#btn-start').click(), true`);
  await waitFor(`location.hash === '#record'`);
  await sleep(5000);
  await ev(`history.replaceState(null, '', '#home'), true`);
  await cdp('Page.reload', { ignoreCache: false }); // beforeunload dialogs auto-accepted
  await waitFor(`document.querySelector('#orphan') && !document.querySelector('#orphan').hidden`, 10000, 'orphan card');
  await shot('home_orphan');
  await sleep(12000); // sprauga > 10 s
  await ev(`window.confirm = () => true; document.querySelector('#btn-connect').click(), true`);
  await waitFor(`!document.querySelector('#btn-connect').disabled && document.querySelector('#status').classList.contains('ok')`);
  await ev(`document.querySelector('#orphan-resume').click(), true`);
  await waitFor(`location.hash === '#record'`, 5000, 'resumed record view');
  await sleep(5000);
  await ev(`document.querySelector('#btn-stop').click(), true`);
  await waitFor(`location.hash.startsWith('#session/')`);
  await sleep(1000);
  sessions = await dbSessions();
  assert.equal(sessions.length, 2);
  const s2 = sessions[0];
  const smp2 = await dbSamples(s2.id);
  console.log('session2', JSON.stringify({ dur: s2.durationSec, n: s2.sampleCount, stored: smp2.length, gaps: s2.gaps }));
  assert.equal(s2.status, 'done');
  assert.equal(s2.sampleCount, smp2.length);
  assert.ok(s2.gaps.length >= 1 && s2.gaps[0].sec >= 12, 'resume gap recorded');
  assert.ok(smp2[smp2.length - 1].t > s2.gaps[0].to - 1, 'samples after resume');
  console.log('ok - orphan resume after reload');

  // 9) Konsoles kļūdas
  const errs = events.filter((e) => e.method === 'Runtime.exceptionThrown');
  assert.equal(errs.length, 0, JSON.stringify(errs.map((e) => e.params.exceptionDetails.text)));
  console.log('\nE2E PASS');
}

main().then(() => 0, (e) => { console.error('E2E FAIL:', e); return 1; }).then(async (code) => {
  try { ws && ws.close(); } catch (_) { /* */ }
  chrome.kill(); server.kill();
  await sleep(800);
  try { rmSync(profile, { recursive: true, force: true }); } catch (_) { /* Chrome var vēl turēt failus */ }
  try { rmSync(dlDir, { recursive: true, force: true }); } catch (_) { /* */ }
  process.exit(code);
});
