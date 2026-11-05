// Случайные сценарии → сервер (getAll) → JSON для независимого эталона на Python.
const { loadServer, fresh } = require('./h.js'); loadServer(); const fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const N = Number(process.argv[2] || 200), seed0 = Number(process.argv[3] || 1), T = '2026-10-12', out = [];
for (let sc = 0; sc < N; sc++) {
  const R = rng(seed0 * 7919 + sc), ri = (a, b) => a + Math.floor(R() * (b - a + 1)), pick = a => a[Math.floor(R() * a.length)];
  fresh(T); const examOff = pick([null, 1, 5, 20, 45, 90, 150, -3]), uwTotal = pick([3200, 2500, 4000, 1500]);
  saveSettings({ exam_date: examOff == null ? '' : addDays_(T, examOff), target_score: pick([200, 240, 250, 270]), uworld_total: uwTotal, today: T });
  const hist = pick([0, 1, 3, 8, 13, 14, 15, 25, 40, 70]), pAct = pick([0.3, 0.6, 1]), todayAct = R() < 0.6, systems = getAll(T).systems;
  for (let k = hist; k >= 0; k--) { if (k === 0 && !todayAct) continue; if (R() > pAct && k !== hist) continue;
    const d = addDays_(T, -k); if (R() < 0.85) try { addLog({ date: d, system: pick(systems), pages: ri(1, 30), today: T }); } catch (e) { }
    if (R() < 0.75) { const q = ri(1, 80); try { addUWorld({ date: d, system: pick(systems), q, correct: ri(0, q), today: T }); } catch (e) { } } }
  saveSettings({ hours_day: pick([4, 8, 10, 12.5]), min_page: pick([3, 6, 9.5]), min_q: pick([1.5, 2.5, 4]), today: T });
  if (R() < 0.7) { const rows = []; for (let k = pick([3, 10, 25, 40]); k >= 0; k--) if (R() < 0.8) rows.push({ d: addDays_(T, -k), n: ri(20, 500), m: ri(5, 90), nw: ri(0, 30), a: 1, h: 1, g: 1, e: 1, yn: 0, yk: 0, mn: 0, mk: 0, ln: 0, lk: 0 }); if (rows.length) upsertDaily_(rows); if (R() < 0.8) { appendText_(SH.AMETA, ['forecast', JSON.stringify(Array.from({ length: 31 }, () => ri(0, 400)))]); appendText_(SH.AMETA, ['states', JSON.stringify({ new_all: pick([0, 150, 2000, 9000]), suspended: ri(0, 50) })]); } }
  if (R() < 0.5) { appendText_(SH.PL, ['PL1', 'P', 'Cardiovascular', '3', T]); for (let i = 0; i < 3; i++) appendText_(SH.VID, ['v' + i, 'PL1', String(i + 1), 'V' + i, String(pick([600, 1800, 3600])), pick(['', '', T, addDays_(T, -ri(1, 20))])]); }
  const nb = ri(0, 6); for (let i = 0; i < nb; i++) { try { saveNBME({ exam: 'NBME ' + (26 + i), date: R() < 0.1 ? '' : addDays_(T, -ri(1, 90)), score: R() < 0.1 ? 0 : ri(150, 290), today: T }); } catch (e) { } }
  const D = getAll(T);
  out.push({ sc, T, days: D.days, exam: D.settings.exam_date, target: D.settings.target_score, uwTotal: D.uworld.total, logs: D.logs.map(x => ({ date: x.date, system: x.system, pages: x.pages })), uw: D.uworld.rows.map(x => ({ date: x.date, q: x.q, correct: x.correct })), fa: D.firstaid.rows.map(x => ({ system: x.system, total: x.total, done: x.done })), nbme: D.nbme.map(x => ({ exam: x.exam, date: x.date, score: x.score })), F: D.forecast, settings: { hours: D.settings.hours_day, minPage: D.settings.min_page, minQ: D.settings.min_q }, ankiA: { avg7: (D.anki.analysis && D.anki.analysis.forecast && D.anki.analysis.forecast.avg7) || 0, secPer: (D.anki.analysis && D.anki.analysis.d30 && D.anki.analysis.d30.secPer) || 0 } });
}
fs.writeFileSync('/tmp/diff_fc.json', JSON.stringify(out)); console.log('сценариев:', out.length);
