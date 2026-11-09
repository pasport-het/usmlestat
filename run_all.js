// Запуск всех проверок: `npm test` (без браузера), `npm run test:browser` (нужен Chromium из @sparticuz/chromium), `npm run test:all`.
const { spawnSync } = require('child_process'), path = require('path'); const ROOT = path.resolve(__dirname, '..'); const mode = process.argv[2] || 'fast';
const N = ['node']; const S = (name, cwd, steps) => ({ name, cwd, steps });
const fast = [
  S('Разбор синтаксиса (ES2019)', ROOT, [[...N, 'tests/check_syntax.js']]),
  S('Сервер: общий (доступ по ключу, CRUD)', ROOT, [[...N, 'tests/test_regress.js']]),
  S('Сервер: «Поделиться»', ROOT, [[...N, 'tests/test_share.js']]), S('Сервер: часовые пояса и напоминания', ROOT, [[...N, 'tests/test_tz.js']]), S('Сервер: расписание карточек', ROOT, [[...N, 'tests/test_cards.js']]),
  S('Сервер: цель по видео', ROOT, [[...N, 'tests/test_video_goal.js']]), S('Сервер v5.2: копии, журнал ошибок, ключ, виджет', ROOT, [[...N, 'tests/test_v520_server.js']]),
  S('Воркер (sw.js)', ROOT, [[...N, 'tests/test_sw.js']]), S('Виджет USMLE', ROOT, [[...N, 'tests/test_widget_usmle.js']]),
  S('Эталон: прогнозы (First Aid, UWorld, пробники, диапазон, бюджет)', ROOT, [[...N, 'tests/diff_run.js', '250', '1'], ['python3', 'tests/diff_spec.py']]),
  S('Эталон: Anki', ROOT, [[...N, 'tests/diff_anki_run.js', '250', '1'], ['python3', 'tests/diff_anki_spec.py']]),
  S('Эталон: даты', ROOT, [[...N, 'tests/diff_dates_run.js', '1'], ['python3', 'tests/diff_dates_spec.py']]),
  S('Эталон: опыт, уровни, прогноз уровней', ROOT, [[...N, 'tests/diff_xp_run.js', '100', '1'], ['python3', 'tests/diff_xp_spec.py']]),
  S('Слова: сервер', path.join(ROOT, 'words'), [[...N, 'tests/test_words.js']]), S('Слова: формула слота', path.join(ROOT, 'words'), [[...N, 'tests/diff_slot_run.js', '1'], ['python3', 'tests/diff_slot_spec.py']]), S('Слова: виджет', path.join(ROOT, 'words'), [[...N, 'tests/test_widget.js']]),
];
const browser = [
  ...['test_tutor', 'test_mascot', 'test_share_ui', 'test_update', 'test_video_ui', 'test_tabbar', 'test_v520_ui', 'test_speed', 'test_viz', 'test_design2', 'test_v54', 'test_wrapper', 'audit_ui'].map(t => S('Браузер: ' + t, ROOT, [[...N, 'tests/' + t + '.js']])),
  ...['test_words_ui', 'test_sw_w', 'test_wrapper_w'].map(t => S('Слова, браузер: ' + t, path.join(ROOT, 'words'), [[...N, 'tests/' + t + '.js']])),
];
const list = mode === 'browser' ? browser : mode === 'all' ? fast.concat(browser) : fast; let failed = [];
for (const s of list) { process.stdout.write('▶ ' + s.name + ' … '); let ok = true, tail = '';
  for (const st of s.steps) { const r = spawnSync(st[0], st.slice(1), { cwd: s.cwd, encoding: 'utf8', timeout: 280000, maxBuffer: 1 << 26 }); const out = (r.stdout || '') + (r.stderr || ''); const last = out.split('\n').filter(l => /проверок пройдено|сценариев|разбирается|все файлы|расхождений/.test(l)).pop() || ''; tail = last.trim().slice(0, 110); if (r.status !== 0) { ok = false; tail = out.split('\n').filter(l => /✗|Error|ошибок/.test(l)).slice(0, 3).join(' | ').slice(0, 300) || ('код ' + r.status); break; } }
  console.log((ok ? 'ок' : 'ПРОВАЛ') + (tail ? '  — ' + tail : '')); if (!ok) failed.push(s.name); }
console.log(failed.length ? '\nПровалено: ' + failed.length + '\n  - ' + failed.join('\n  - ') : '\nВсе проверки пройдены (' + list.length + ')'); process.exit(failed.length ? 1 : 0);
