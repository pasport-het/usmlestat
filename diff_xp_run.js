// Случайные сценарии → серверные данные D → клиентские расчёты опыта/уровней/прогноза/целей в браузере → JSON для эталона на Python.
const { loadServer, fresh } = require('./h.js'); loadServer(); const S = require('./shots.js'); const fs = require('fs');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const N = Number(process.argv[2] || 100), seed0 = Number(process.argv[3] || 1), T = '2026-10-12', out = [];
(async () => {
  fresh(T); const b = await S.launch(); const p = await S.openPage(b, { init: getAll(T), wait: 800, now: T + 'T10:00:00Z', key: getSettings().api_key });
  for (let sc = 0; sc < N; sc++) {
    const R = rng(seed0 * 7907 + sc), ri = (a, c) => a + Math.floor(R() * (c - a + 1)), pick = a => a[Math.floor(R() * a.length)];
    fresh(T); const examOff = pick([null, 0, 1, 20, 75, 200]); saveSettings({ exam_date: examOff == null ? '' : addDays_(T, examOff), target_score: 240, today: T }); const systems = getAll(T).systems, hist = pick([0, 1, 4, 10, 14, 15, 30, 80]);
    for (let k = hist; k >= 0; k--) { const d = addDays_(T, -k); if (R() < 0.7) try { addLog({ date: d, system: pick(systems), pages: ri(1, 25), today: T }); } catch (e) { }
      if (R() < 0.6) { const q = ri(1, 60); try { addUWorld({ date: d, system: pick(systems), q, correct: ri(0, q), today: T }); } catch (e) { } }
      if (R() < 0.5) upsertDaily_([{ d, n: ri(0, 400), m: ri(0, 90), nw: ri(0, 25), a: 1, h: 1, g: 1, e: 1, yn: 0, yk: 0, mn: 0, mk: 0, ln: 0, lk: 0 }]);
      if (R() < 0.3) try { focusAdd({ id: 'f_' + sc + '_' + k, date: d, minutes: ri(5, 120), kind: 'fa', system: pick(systems), today: T }); } catch (e) { }
      if (R() < 0.2) try { uweAdd({ id: 'e_' + sc + '_' + k, date: d, system: pick(systems), topic: 'x', reason: 'guess', today: T }); } catch (e) { }
      if (R() < 0.15) try { saveNBME({ exam: 'NB' + k, date: d, score: ri(180, 280), today: T }); } catch (e) { } }
    const nv = pick([0, 0, 2, 6, 15]); appendText_(SH.PL, ['PL1', 'Плейлист', 'Cardiovascular', String(nv), T]); for (let i = 0; i < nv; i++) appendText_(SH.VID, ['v' + i, 'PL1', String(i + 1), 'Видео ' + i, String(pick([0, 300, 600, 900, 1800, 3600])), pick(['', '', T, addDays_(T, -ri(1, 40))])]);
    const D = getAll(T);
    const res = await p.evaluate(D => ({ st: (function () { const s = tutorStats(D); return { xp: s.xp, level: s.level, rank: s.rank, today: s.today, week: s.week, byDay: s.byDay, bySource: s.bySource, streak: s.streak, best: s.bestStreak }; })(), lf: levelForecast(D), ach: achievements(D).map(a => [a.id, a.value, a.goal, a.got]), goals: buildToday(D).items.filter(i => i.type === 'goal').map(i => [i.id, i.value, i.goal, i.done]), rd: (function () { const r = readiness(D); return { ready: r.ready, noNbme: r.noNbme, w: r.w }; })(), exNow: D.forecast.exam ? D.forecast.exam.now : null, exNo: D.forecast.exam ? !!D.forecast.exam.noNbme : null }), D);
    out.push({ sc, D: { today: D.today, days: D.days, logs: D.logs.map(x => ({ date: x.date, pages: x.pages })), uw: D.uworld.rows.map(x => ({ date: x.date, q: x.q, correct: x.correct })), anki: D.anki.daily.map(x => ({ d: x.d, n: x.n, nw: x.nw })), planner: { items: D.planner.items.map(x => ({ done: x.done })), hlog: D.planner.hlog.map(x => ({ date: x.date })), focus: D.planner.focus.map(x => ({ date: x.date, minutes: x.minutes })), errors: D.planner.errors.map(x => ({ date: x.date })) }, nbme: D.nbme.map(x => ({ date: x.date, score: x.score })), cards: D.library.cards.map(x => ({ at: x.at })), videos: D.videos.items.map(x => ({ sec: x.sec, w: x.w })), vidGoal: D.forecast.today.vid, target: D.settings.target_score }, res });
  }
  await b.close(); fs.writeFileSync('/tmp/diff_xp.json', JSON.stringify(out)); console.log('сценариев:', out.length);
})();
