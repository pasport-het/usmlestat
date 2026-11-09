// Цель по видео на день (сервер): остаток на начало дня / дни до экзамена; стабильность в течение дня; граничные случаи.
const { loadServer, fresh } = require('./h.js'); loadServer();
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 200)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12';
function setup(examOff, vids) { fresh(T); saveSettings({ exam_date: examOff == null ? '' : addDays_(T, examOff), target_score: 240, today: T }); appendText_(SH.PL, ['PL1', 'Кардиология', 'Cardiovascular', '4', T]); vids.forEach((v, i) => appendText_(SH.VID, ['v' + i, 'PL1', String(i + 1), 'Видео ' + i, String(v[0]), v[1] || ''])); return getAll(T); }
console.log('=== ЦЕЛЬ ПО ВИДЕО ===');
{ const V = [[600, addDays_(T, -1)], [1200, T], [1800], [900]]; const D = setup(20, V);
  check('остаток 2700 с + просмотрено сегодня 1200 с = 3900 с (65 мин) на начало дня; 20 дней до экзамена → цель ⌈65/20⌉ = 4 мин/день; сегодня просмотрено 20 мин', [D.forecast.today.vid, D.videos.stats.leftSec], [{ done: 20, goal: 4 }, 2700]);
  const A = setup(20, [[600], [1200], [1800]]), B = setup(20, [[600], [1200], [1800, T]]);
  check('цель не «уезжает» при просмотре: пока ничего не смотрели — ⌈60/20⌉ = 3 мин; посмотрели 30-минутное видео — цель те же 3 мин, а сделано 30', [A.forecast.today.vid, B.forecast.today.vid], [{ done: 0, goal: 3 }, { done: 30, goal: 3 }]); }
check('без даты экзамена цели нет (null), просмотренное считается', (() => { const D = setup(null, [[600, T], [1200]]); return D.forecast.today.vid; })(), { done: 10, goal: null });
check('всё просмотрено раньше — цели нет (null)', setup(20, [[600, addDays_(T, -3)], [1200, addDays_(T, -2)]]).forecast.today.vid, { done: 0, goal: null });
check('видео без длительности (0 с) не создают цели', setup(20, [[0], [0]]).forecast.today.vid, { done: 0, goal: null });
check('экзамен сегодня (0 дней): делим на 1 — всё остаточное на сегодня', setup(0, [[1800], [1800]]).forecast.today.vid, { done: 0, goal: 60 });
check('нет ни одного видео: done 0, goal null, структура на месте', (() => { fresh(T); saveSettings({ exam_date: addDays_(T, 10), today: T }); const D = getAll(T); return [D.forecast.today.vid, Array.isArray(D.videos.items), /^v5\.\d+\.\d+$/.test(D.version)]; })(), [{ done: 0, goal: null }, true, true]);
check('СВОЙСТВО (150 случайных наборов): done = Σ минут просмотренного сегодня (округл.), goal = ⌈(остаток + сегодня)/60/max(1,дни)⌉ или null', (() => { let bad = 0; for (let k = 0; k < 150; k++) { const r = (a, b) => a + Math.floor(Math.abs(Math.sin(k * 97 + a * 13 + b)) * (b - a + 1)); const n = r(0, 8), V = []; for (let i = 0; i < n; i++) V.push([r(0, 5400), [T, addDays_(T, -r(1, 9)), ''][r(0, 2)]]); const off = [null, 0, 1, 7, 45][r(0, 4)]; const D = setup(off, V); const wt = V.filter(v => v[1] === T).reduce((a, v) => a + v[0], 0), left = V.filter(v => !v[1]).reduce((a, v) => a + v[0], 0), st = left + wt, days = D.days; const exp = { done: Math.round(wt / 60), goal: (days != null && st > 0) ? Math.ceil(st / 60 / Math.max(1, days)) : null }; if (J(exp) !== J(D.forecast.today.vid)) bad++; } return bad; })(), 0);
console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
