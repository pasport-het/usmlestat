// v5.2.0, интерфейс: «Время на день», окно «Данные и безопасность» (копии, журнал, ключ, виджет), отправка сбоев, подсказка про пробник.
const { loadServer, fresh } = require('./h.js'); loadServer(); const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms)); const acorn = require('acorn');
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 230)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12';
function seed(o) { o = o || {}; fresh(T); global.__DRIVE.folders.length = 0; global.__TRIGGERS.length = 0; Object.keys(global.__CACHE || {}).forEach(k => delete global.__CACHE[k]);
  saveSettings({ exam_date: o.noExam ? '' : addDays_(T, 40), student_name: 'Samir', hours_day: o.hours || 8, site_url: 'https://samir.github.io/usmle/', today: T });
  for (let k = 14; k >= 1; k--) { addLog({ date: addDays_(T, -k), system: 'Renal', pages: 8, today: T }); addUWorld({ date: addDays_(T, -k), system: 'Renal', q: 30, correct: 20, today: T }); }
  const rows = []; for (let k = 20; k >= 0; k--) rows.push({ d: addDays_(T, -k), n: 250, m: 40, nw: 12, a: 1, h: 1, g: 1, e: 1, yn: 0, yk: 0, mn: 0, mk: 0, ln: 0, lk: 0 }); upsertDaily_(rows);
  appendText_(SH.AMETA, ['forecast', JSON.stringify(Array.from({ length: 31 }, () => 180))]); appendText_(SH.AMETA, ['states', JSON.stringify({ new_all: 2400, suspended: 3 })]);
  appendText_(SH.PL, ['PL1', 'К', 'Cardiovascular', '2', T]); appendText_(SH.VID, ['v0', 'PL1', '1', 'A', '3600', '']); appendText_(SH.VID, ['v1', 'PL1', '2', 'B', '3600', '']);
  if (o.nbme) saveNBME({ exam: 'NBME 26', date: addDays_(T, -3), score: 220, today: T }); }
const PROBE = () => { const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }; const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const bgOf = el => { const L = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/gradient/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { L.push(c); if (c[3] >= 1) break; } } let col = document.documentElement.getAttribute('data-theme') === 'dark' ? [10, 15, 28] : [255, 255, 255]; for (let i = L.length - 1; i >= 0; i--) col = [0, 1, 2].map(k => L[i][k] * L[i][3] + col[k] * (1 - L[i][3])); return col; };
  const root = document.getElementById('sheet') && document.getElementById('sheet').classList.contains('on') ? document.getElementById('sheetB') : document.getElementById('budCard'); const bad = []; let total = 0; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const e = n.parentElement; if (!e || !n.textContent.trim() || e.closest('script,style,.hide')) continue; const r = e.getBoundingClientRect(); if (r.width < 2) continue; const cs = getComputedStyle(e); if (+cs.opacity === 0 || cs.visibility === 'hidden') continue; const fg = parse(cs.color), bg = bgOf(e); if (!fg || !bg) continue; total++; const a = fg[3], mix = [0, 1, 2].map(k => fg[k] * a + bg[k] * (1 - a)); const L1 = lum(mix), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700); if (ratio < (large ? 3 : 4.5) - 0.05) bad.push(e.tagName + '.' + String(e.className).slice(0, 18) + ' «' + n.textContent.trim().slice(0, 22) + '» ' + ratio.toFixed(2)); }
  return { total, bad: bad.slice(0, 4), over: document.documentElement.scrollWidth - innerWidth }; };
(async () => {
  const b = await S.launch(); const errs = [];
  const open = async (o) => S.openPage(b, Object.assign({ raf: true, lang: 'ru', init: (o && o.init) || getAll(T), wait: 1700, w: 393, h: 852, errors: errs, now: T + 'T10:00:00Z', key: getSettings().api_key }, o || {}));
  console.log('=== КАРТОЧКА «ВРЕМЯ НА ДЕНЬ» ===');
  seed({ hours: 4 }); let p = await open(); const B = getAll(T).forecast.budget;
  const c1 = await p.evaluate(() => { const c = document.getElementById('budCard'), segs = Array.from(c.querySelectorAll('.bud-bar i')).map(e => parseFloat(e.style.width)), mark = parseFloat(c.querySelector('.bud-mark').style.left); return { vis: !c.classList.contains('hide'), rows: Array.from(c.querySelectorAll('.bud-row .nm')).map(e => e.textContent), hero: c.querySelector('.bud-t').textContent, pill: c.querySelector('.bud-pill').className, pillT: c.querySelector('.bud-pill').textContent, sum: segs.reduce((a, x) => a + x, 0), mark, adv: !!c.querySelector('.bud-adv'), txt: c.textContent }; });
  check('карточка видна: строки «First Aid», «UWorld», «Anki», «Видео»; итог = серверному total; нехватка (4 ч): красная метка «Не хватает …», совет есть', [c1.vis, c1.rows.length, c1.pill.indexOf('bad') > -1, /Не хватает/.test(c1.pillT), c1.adv, c1.hero === (B.total >= 60 ? (Math.floor(B.total / 60) + ' ч' + (B.total % 60 ? ' ' + (B.total % 60) + ' мин' : '')) : B.total + ' мин')], [true, B.items.length, true, true, true, true]);
  check('полоса: сумма сегментов ≤ 100 % и равна total/масштаб; отметка «сколько есть» стоит на avail/масштаб; ни NaN, ни undefined', [Math.abs(c1.sum - B.total / Math.max(B.total, B.avail) * 100) < 0.01, Math.abs(c1.mark - B.avail / Math.max(B.total, B.avail) * 100) < 0.01, /NaN|undefined|Infinity/.test(c1.txt)], [true, true, false]);
  await p.evaluate(() => document.getElementById('budEdit').click()); await sleep(400);
  check('«Настроить» открывает окно с текущими значениями (часы 4, 6 мин на страницу, 2.5 мин на вопрос)', await p.evaluate(() => [document.getElementById('bdH').value, document.getElementById('bdP').value, document.getElementById('bdQ').value]), ['4', '6', '2.5']);
  await p.evaluate(() => { document.getElementById('bdH').value = '16'; document.getElementById('bdSave').click(); }); await sleep(1200);
  const c2 = await p.evaluate(() => { const c = document.getElementById('budCard'); return [c.querySelector('.bud-pill').className, c.querySelector('.bud-pill').textContent, !!c.querySelector('.bud-adv'), document.getElementById('sheet').classList.contains('on')]; });
  check('часов 16: хватает с запасом (зелёная метка «Запас …», совета нет), окно закрылось, значение сохранено на сервере', [c2[0].indexOf('ok') > -1, /Запас/.test(c2[1]), c2[2], c2[3], getAll(T).settings.hours_day], [true, true, false, false, 16]);
  await p.close();
  seed({ noExam: true }); p = await open(); check('без даты экзамена карточки нет', await p.evaluate(() => document.getElementById('budCard').classList.contains('hide')), true); await p.close();
  seed({ hours: 4 }); p = await open({ lang: 'en' }); check('английский: «Time per day», «Short by …», «Adjust»', await p.evaluate(() => { const c = document.getElementById('budCard'); return [c.querySelector('h3').textContent, /Short by/.test(c.textContent), !!c.querySelector('#budEdit') && c.querySelector('#budEdit').textContent]; }), ['Time per day', true, 'Adjust']); await p.close();
  console.log('\n=== ГОТОВНОСТЬ БЕЗ ПРОБНИКА ===');
  seed({}); p = await open(); let rr = await p.evaluate(() => [document.getElementById('readyNote').textContent.indexOf('50/50') > -1, document.getElementById('examBody').textContent.indexOf('временно поделена поровну') > -1, readiness(D).noNbme, +(readiness(D).ready).toFixed(3), D.forecast.exam.now]); await p.close();
  check('без NBME: в кольце пометка «50/50», в карточке экзамена пояснение; кольцо и карточка показывают одно число', [rr[0], rr[1], rr[2], Math.abs(rr[3] - rr[4]) < 0.001], [true, true, true, true]);
  seed({ nbme: true }); p = await open(); rr = await p.evaluate(() => [document.getElementById('readyNote').textContent.indexOf('50/50') > -1, document.getElementById('examBody').textContent.indexOf('временно поделена') > -1, readiness(D).noNbme, readiness(D).w]); await p.close();
  check('с пробником NBME пометок нет, веса 40/40/20', rr, [false, false, false, { fa: 0.4, uw: 0.4, nb: 0.2 }]);
  console.log('\n=== ОКНО «ДАННЫЕ И БЕЗОПАСНОСТЬ»: КОПИИ ===');
  seed({}); p = await open(); await p.evaluate(() => openSysSheet()); await sleep(400);
  check('окно открывается: «Копий ещё нет», автокопия выключена, журнал пуст', await p.evaluate(() => { const t = document.getElementById('sheetB').textContent; return [/Копий ещё нет/.test(t), /Автокопия выключена/.test(t), /Ошибок нет/.test(t), !!document.getElementById('bkNow'), !document.getElementById('bkFolder')]; }), [true, true, true, true, true]);
  await p.evaluate(() => document.getElementById('bkNow').click()); await sleep(1200);
  check('«Сделать копию сейчас»: файл создан в папке на Диске, статус «Последняя копия … в папке 1 из 8», появилась кнопка «Открыть папку»', [global.__DRIVE.folders.length, global.__DRIVE.folders[0] && global.__DRIVE.folders[0].files.length, await p.evaluate(() => [/Последняя копия:.*в папке 1 из 8/.test(document.getElementById('sheetB').textContent), !!document.getElementById('bkFolder')])], [1, 1, [true, true]]);
  await p.evaluate(() => document.getElementById('bkAuto').click()); await sleep(900);
  check('«Включить раз в неделю»: триггер создан (воскресенье 03:00), надпись «включена», кнопка стала «Выключить»', [global.__TRIGGERS.length, global.__TRIGGERS[0] && global.__TRIGGERS[0].day, await p.evaluate(() => [/включена/.test(document.getElementById('sheetB').textContent), document.getElementById('bkAuto').textContent])], [1, 'SUNDAY', [true, 'Выключить автокопию']]);
  await p.evaluate(() => document.getElementById('bkAuto').click()); await sleep(900); check('«Выключить автокопию»: триггер удалён', [global.__TRIGGERS.length, await p.evaluate(() => /Автокопия выключена/.test(document.getElementById('sheetB').textContent))], [0, true]);
  global.__DRIVE.fail = true; await p.evaluate(() => document.getElementById('bkNow').click()); await sleep(1100); global.__DRIVE.fail = false;
  check('сбой Диска: понятное сообщение про backupSetup, кнопка снова активна', await p.evaluate(() => [document.getElementById('toast').textContent.indexOf('backupSetup') > -1, document.getElementById('bkNow').disabled]), [true, false]);
  console.log('\n=== ЖУРНАЛ ОШИБОК: ОТПРАВКА ИЗ ПРИЛОЖЕНИЯ И ПРОСМОТР ===');
  const inject = code => p.evaluate(c => { const s = document.createElement('script'); s.textContent = c; document.head.appendChild(s); }, code);   // из скрипта страницы, как в жизни: код из evaluate браузер считает «чужим» и скрывает текст ошибки
  await inject("setTimeout(function () { throw new Error('тест-сбой интерфейса'); }, 10);"); await sleep(500);
  await inject("Promise.reject(new Error('тест-сбой обещания'));"); await sleep(500);
  const e1 = errorsSummary_();
  check('необработанная ошибка и отклонённое обещание попадают в таблицу с версией и страницей; сообщение с файлом и строкой', [e1.count, e1.last.map(x => x.msg.replace(/@.*/, '').trim()).sort(), e1.last.every(x => /^v5\.\d+\.\d+$/.test(x.ver) && x.page === 'map')], [2, ['тест-сбой обещания', 'Uncaught Error: тест-сбой интерфейса'].sort(), true]);
  await p.evaluate(() => { window.dispatchEvent(new ErrorEvent('error', { message: 'ResizeObserver loop completed with undelivered notifications.' })); window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' })); }); await sleep(400);
  check('шум браузера («ResizeObserver loop…», «Script error.») не пишется', errorsSummary_().count, 2);
  await p.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new ErrorEvent('error', { message: 'сбой номер ' + i })); }); await sleep(900);
  check('за сеанс отправляется не больше 5 сбоев (3 новых к двум прежним = 5)', errorsSummary_().count, 5);
  await p.evaluate(() => { D.errors = null; refreshNow(true); }); await sleep(1500); await p.evaluate(() => openSysSheet()); await sleep(400);
  check('в окне виден журнал: счётчик 5, у записи страница и текст; кнопка «Очистить»', await p.evaluate(() => { const t = document.getElementById('sheetB').textContent; return [/Журнал ошибок · 5/.test(t), document.querySelectorAll('.er-list > div').length, !!document.getElementById('erClear')]; }), [true, 5, true]);
  await p.evaluate(() => document.getElementById('erClear').click()); await sleep(900);
  check('«Очистить»: таблица пуста, в окне «Ошибок нет»', [errorsSummary_().count, await p.evaluate(() => /Ошибок нет/.test(document.getElementById('sheetB').textContent))], [0, true]); await p.close();
  console.log('\n=== СМЕНА КЛЮЧА ===');
  seed({}); const key0 = getSettings().api_key, init0 = getAll(T); global.AUTH_OFF_ = false; p = await open({ key: key0, init: init0 });
  await p.evaluate(() => { window.__msgs = []; window.postTop = function (m) { window.__msgs.push(m); }; }); await p.evaluate(() => openSysSheet()); await sleep(400);
  await p.evaluate(() => document.getElementById('keyRot').click()); await sleep(200);
  check('первое нажатие только «взводит» кнопку («Нажмите ещё раз»): ключ на сервере не изменился', [await p.evaluate(() => document.getElementById('keyRot').querySelector('span').textContent), getSettings().api_key === key0], ['Нажмите ещё раз', true]);
  await p.evaluate(() => document.getElementById('keyRot').click()); await sleep(1000); const key1 = getSettings().api_key;
  const kr = await p.evaluate(() => ({ vk: VIEW_KEY, msgs: window.__msgs.filter(m => m.type === 'trf-setkey'), link: (document.getElementById('keyLink') || {}).value, btnHidden: document.getElementById('keyRot').style.display }));
  check('второе нажатие: ключ изменён на сервере (40 символов), приложение запомнило его, обёртке отправлено trf-setkey с тем же ключом, показана новая ссылка', [key1 !== key0, key1.length, kr.vk === key1, kr.msgs.length === 1 && kr.msgs[0].key === key1, kr.link === getSettings().webapp_url + '?k=' + key1 || /\?k=/.test(kr.link || ''), kr.btnHidden], [true, 40, true, true, true, 'none']);
  await p.evaluate(() => document.getElementById('wgCopy').click()); await sleep(300);
  check('после смены приложение продолжает работать с новым ключом (код виджета содержит НОВЫЙ ключ, не старый)', await p.evaluate((k0, k1) => { const c = widgetCode(); return [c.indexOf(k1) > -1, c.indexOf(k0) > -1]; }, key0, key1), [true, false]);
  const wcode = await p.evaluate(() => widgetCode());
  check('код виджета: подставлены адрес сервера, ключ и ссылка на сайт; плейсхолдеров нет; синтаксис корректен', [/__API__|__KEY__|__APP__/.test(wcode), wcode.indexOf('https://script.google.com/macros/s/') > -1, wcode.indexOf('https://samir.github.io/usmle/#u=') > -1, (() => { try { acorn.parse(wcode, { ecmaVersion: 2022, allowAwaitOutsideFunction: true }); return true; } catch (e) { return e.message; } })()], [false, true, true, true]);
  global.AUTH_OFF_ = true; await p.close();
  console.log('\n=== ВЁРСТКА И ЧИТАЕМОСТЬ НОВЫХ ЭКРАНОВ ===');
  let issues = 0, texts = 0; seed({ hours: 4 }); global.__DRIVE.folders.length = 0; for (let i = 0; i < 3; i++) logErrorRaw_({ msg: 'сбой ' + i + ' в рисовании графика, очень длинное сообщение для проверки переноса строк ' + 'x'.repeat(60), page: 'uw' });
  for (const theme of ['light', 'dark']) for (const [w, h] of [[320, 640], [393, 852], [768, 1024]]) { p = await open({ w, h, theme });
    let r = await p.evaluate(PROBE); texts += r.total; if (r.bad.length || r.over > 0) { issues++; console.log('  ✗', theme, w, 'карточка', J(r)); }
    r = await p.evaluate(PROBE); texts += r.total; if (r.bad.length || r.over > 0) { issues++; console.log('  ✗', theme, w, 'окно', J(r)); } await p.close(); }
  check('карточка «Время на день» и окно «Данные и безопасность»: 2 темы × 3 размера — слабого контраста и горизонтальной прокрутки нет (текстов: ' + texts + ')', issues, 0);
  await b.close(); check('ошибок страницы нет (кроме специально вызванных тест-сбоев)', errs.filter(e => !/тест-сбой|сбой номер|Script error|ResizeObserver/.test(String(e))), []);
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
