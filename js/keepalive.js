// Fona režīms ieraksta laikā: klusa audio cilpa + Media Session.
//
// Kāpēc: Android Chrome lapu, kas nav priekšplānā (cita lietotne, izslēgts ekrāns), var
// apturēt vai Android var aizvērt pārlūka procesu. Lapas, kas atskaņo audio, Chrome
// neiesaldē, un Android pārlūku tad tur dzīvu kā mediju atskaņotāju (paziņojums ar
// "Pulss — ieraksts notiek"). Skaņa ir 25 Hz sinusoīda ar ļoti mazu amplitūdu
// (~ -50 dBFS) — telefona skaļrunis to neatskaņo, ausīs tā nav dzirdama.
//
// Ierobežojumi (godīgi): tas ir triks, ne garantija. Ja lietotājs ieslēdz citu mūziku,
// Android var mūsu audio apturēt (audio fokuss); Samsung akumulatora taupīšana var
// pārlūku tomēr apturēt. Tāpēc ieraksts pats atzīmē pārtraukumus (gaps.js) un pēc
// atgriešanās atjauno savienojumu.

const SAMPLE_RATE = 8000;
const SECONDS = 10;      // >5 s — Chrome īsus klipus neuzskata par mediju sesiju
const FREQ_HZ = 25;
const AMPLITUDE = 0.003; // ~ -50 dBFS

let audio = null;
let url = null;
let wanted = false;

// 16-bit PCM mono WAV ar zemas amplitūdas sinusoīdu (tīra funkcija → Uint8Array).
export function makeQuietWav(sampleRate = SAMPLE_RATE, seconds = SECONDS, freq = FREQ_HZ, amp = AMPLITUDE) {
  const n = sampleRate * seconds;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  const peak = Math.round(amp * 32767);
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 2, Math.round(peak * Math.sin((2 * Math.PI * freq * i) / sampleRate)), true);
  }
  return new Uint8Array(buf);
}

function setMediaSession(title) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title, artist: 'Polar H10', album: 'Pulss',
      artwork: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    });
    navigator.mediaSession.playbackState = 'playing';
  } catch (_) { /* nav atbalsta */ }
}

function clearMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
  } catch (_) { /* nav atbalsta */ }
}

// Sāk (vai atsāk) klusās cilpas atskaņošanu. Jāizsauc pēc lietotāja pieskāriena
// (Chrome autoplay politika). Atgriež true, ja atskaņošana sākās.
export async function startKeepAlive(title) {
  wanted = true;
  if (typeof Audio === 'undefined') return false;
  if (!audio) {
    url = URL.createObjectURL(new Blob([makeQuietWav()], { type: 'audio/wav' }));
    audio = new Audio(url);
    audio.loop = true;
    audio.preload = 'auto';
  }
  setMediaSession(title);
  try {
    await audio.play();
    return true;
  } catch (e) {
    console.warn('keepalive play failed', e);
    return false;
  }
}

// Atgriežoties priekšplānā: ja audio apturēts (audio fokuss u.c.), mēģina atsākt.
export function resumeKeepAlive() {
  if (!wanted || !audio || !audio.paused) return;
  audio.play().catch(() => {});
}

export function isKeepAlivePlaying() {
  return !!(audio && !audio.paused);
}

export function stopKeepAlive() {
  wanted = false;
  if (audio) {
    try { audio.pause(); } catch (_) { /* ignorē */ }
    audio.removeAttribute('src');
    try { audio.load(); } catch (_) { /* ignorē */ }
    audio = null;
  }
  if (url) { URL.revokeObjectURL(url); url = null; }
  clearMediaSession();
}
