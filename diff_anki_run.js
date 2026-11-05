const { loadServer } = require('./h.js'); loadServer(); const fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const N = Number(process.argv[2] || 200), seed0 = Number(process.argv[3] || 1), REF = '2026-10-12', out = [];
for (let sc = 0; sc < N; sc++) {
  const R = rng(seed0 * 9973 + sc), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
  const hist = pick([0, 1, 3, 8, 13, 14, 15, 25, 40, 90]), pAct = pick([0.3, 0.7, 1]), daily = [];
  for (let k = hist; k >= 0; k--) { if (R() > pAct) continue; const n = ri(0, 400), yn = ri(0, n), mn = ri(0, n - yn), ln = ri(0, n - yn - mn);
    daily.push({ d: addDays_(REF, -k), n, m: ri(0, 200) / 2, nw: ri(0, 30), a: ri(0, n), h: ri(0, n), g: ri(0, n), e: ri(0, n), yn, yk: ri(0, yn), mn, mk: ri(0, mn), ln, lk: ri(0, ln) }); }
  const firstRev = pick(['', addDays_(REF, -hist), addDays_(REF, -hist - ri(0, 500)), 'мусор']);
  const hours = Array.from({ length: 24 }, () => { const n = pick([0, 0, 10, 29, 30, 80, 200]); return { n, ok: ri(0, n) }; });
  const meta = { first_review: firstRev, hours, forecast: pick([[], Array.from({ length: 31 }, () => ri(0, 90))]), streak: ri(0, 50), longest_streak: ri(0, 90), rev_total: ri(0, 90000), min_total: ri(0, 90000), synced_at: pick(['', '2026-10-12 08:00', '2026-10-05 22:10']), activity_scope: pick(['all', 'main']), states: { new_all: ri(0, 900) } };
  const last = pick([null, { remaining: ri(0, 1200) }, { remaining: 0 }]), daysLeft = pick([null, 0, 1, 20, 91, 200]), realToday = pick([REF, '2026-10-13']);
  let A; try { A = ankiAnalysis_(daily.map(x => Object.assign({}, x)), JSON.parse(JSON.stringify(meta)), last, REF, daysLeft, realToday); } catch (e) { A = { error: String(e.message) }; }
  out.push({ sc, REF, daily, meta, last, daysLeft, realToday, A });
}
fs.writeFileSync('/tmp/diff_anki.json', JSON.stringify(out)); console.log('сценариев:', out.length);
