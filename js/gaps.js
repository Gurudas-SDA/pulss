// Pārtraukumi ierakstā (tīras funkcijas — testējamas Node bez pārlūka).
//
// Pārtraukums = sprauga starp diviem secīgiem paraugiem, kas garāka par GAP_SEC sekundēm
// (josta 1 paraugu sekundē; sprauga nozīmē, ka lietotne tobrīd paraugus nesaņēma —
// savienojums zuda, Android apturēja pārlūku fonā u.tml.).
export const GAP_SEC = 10;

// samples: [{t}] (kārtoti pēc t) → [{ from, to, sec }]; from/to = sekundes no sesijas sākuma.
export function findGaps(samples, minGapSec = GAP_SEC) {
  const out = [];
  let prev = null;
  for (const s of samples || []) {
    if (!s || typeof s.t !== 'number') continue;
    if (prev !== null && s.t - prev > minGapSec) out.push({ from: prev, to: s.t, sec: s.t - prev });
    prev = s.t;
  }
  return out;
}

export function totalGapSec(gaps) {
  return (gaps || []).reduce((a, g) => a + (g.sec || 0), 0);
}
