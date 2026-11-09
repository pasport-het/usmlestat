// Богатый тестовый набор данных (два месяца подготовки): для просмотра дизайна и проверки графиков.
module.exports = function seedRich(T) {
  const R = (() => { let a = 12345; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })(), ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  fresh(T); global.__DRIVE && (global.__DRIVE.folders.length = 0); global.__TRIGGERS && (global.__TRIGGERS.length = 0);
  saveSettings({ exam_date: addDays_(T, 75), student_name: 'Samir', target_score: 250, uworld_total: 3800, site_url: 'https://samir.github.io/usmle/', today: T });
  const systems = getAll(T).systems; const strong = { Cardiovascular: 0.58, Renal: 0.74, Neurology: 0.66, Respiratory: 0.7, Gastrointestinal: 0.63, Endocrine: 0.61, Biochemistry: 0.68, Immunology: 0.59, Pharmacology: 0.55 };
  for (let k = 60; k >= 0; k--) { const d = addDays_(T, -k); if (R() < 0.82) { try { addLog({ date: d, system: systems[ri(0, systems.length - 1)], pages: ri(3, 16), today: T }); } catch (e) { } }
    if (R() < 0.78) { const sys = systems[ri(0, systems.length - 1)], q = ri(20, 70), p = strong[sys] || 0.62; try { addUWorld({ date: d, system: sys, q, correct: Math.round(q * Math.min(0.95, p + (60 - k) * 0.0012 + (R() - .5) * .1)), today: T }); } catch (e) { } }
    if (R() < 0.9) upsertDaily_([{ d, n: ri(120, 520), m: ri(20, 75), nw: ri(0, 28), a: ri(5, 30), h: ri(20, 60), g: ri(160, 380), e: ri(10, 50), yn: ri(0, 5), yk: ri(0, 3), mn: ri(0, 5), mk: ri(0, 3), ln: ri(0, 5), lk: ri(0, 3) }]);
    if (R() < 0.35) try { focusAdd({ id: 'f' + k, date: d, minutes: ri(25, 120), kind: 'fa', system: systems[ri(0, systems.length - 1)], today: T }); } catch (e) { }
    if (R() < 0.18) try { uweAdd({ id: 'e' + k, date: d, system: systems[ri(0, systems.length - 1)], topic: 'Тема ' + k, reason: ['knowledge', 'misread', 'guess'][ri(0, 2)], today: T }); } catch (e) { } }
  [[-45, 198], [-30, 214], [-17, 226], [-6, 233]].forEach((x, i) => saveNBME({ exam: 'NBME ' + (26 + i), date: addDays_(T, x[0]), score: x[1], today: T }));
  appendText_(SH.AMETA, ['forecast', JSON.stringify(Array.from({ length: 31 }, (_, i) => 150 + ((i * 37) % 120)))]); appendText_(SH.AMETA, ['states', JSON.stringify({ new_all: 3200, suspended: 40 })]);
  appendText_(SH.PL, ['PL1', 'Кардиология: лекции', 'Cardiovascular', '5', T]); appendText_(SH.PL, ['PL2', 'Нефрология: лекции', 'Renal', '4', T]);
  [[1500, -3], [2400, -2], [1800, -1], [2100, 0], [1200, ''], [2700, '']].forEach((v, i) => appendText_(SH.VID, ['v' + i, i < 4 ? 'PL1' : 'PL2', String(i + 1), 'Лекция ' + (i + 1), String(v[0]), v[1] === '' ? '' : addDays_(T, v[1])]));
  try { habitAdd({ id: 'h1', name: 'Утренние карточки', today: T }); habitAdd({ id: 'h2', name: 'Разбор ошибок', today: T }); for (let k = 12; k >= 0; k--) if (R() < 0.8) habitToggle({ id: 'h1', date: addDays_(T, -k), today: T }); } catch (e) { }
  try { planAdd({ id: 'p1', date: T, time: '19:00', title: 'Блок UWorld 40 вопросов', type: 'task', today: T }); planAdd({ id: 'p2', date: addDays_(T, 1), time: '10:00', title: 'NBME 30', type: 'event', today: T }); } catch (e) { }
};
