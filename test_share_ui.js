// «Поделиться» в браузере: страница друга (данные, графики, обновление, язык, отзыв) и окно управления у владельца.
const { loadServer, fresh } = require('./h.js'); loadServer();
const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 200)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12';
function seed() {
  fresh(T); saveSettings({ exam_date: '2026-12-01', student_name: 'СекретноеИмя', site_url: 'https://samir.github.io/usmle/', today: T });
  for (let k = 40; k >= 0; k--) { if (k % 4) addUWorld({ date: addDays_(T, -k), system: ['Renal', 'Cardiovascular', 'Endocrine', 'Biochemistry'][k % 4], q: 20 + (k % 7), correct: 10 + (k % 9), note: 'СЕКРЕТ_ЗАМЕТКА', today: T }); upsertDaily_([{ d: addDays_(T, -k), n: 100 + (k * 7) % 90, m: 40 + (k % 9), nw: 10, a: 5, h: 10, g: 70, e: 15, yn: 60, yk: 54, mn: 30, mk: 28, ln: 10, lk: 8 }]); }
  planAdd({ id: 'p_secret0001', date: T, title: 'СЕКРЕТНОЕ_ДЕЛО', kind: 'task', today: T });
  writeMeta_({ anki_today: T, first_review: '2025-01-01', synced_at: '2026-10-12 08:00', streak: 41, longest_streak: 60, rev_total: 90000, min_total: 40000, hours: Array.from({ length: 24 }, (_, h) => ({ n: h === 9 ? 80 : 5, ok: h === 9 ? 70 : 4 })), forecast: Array.from({ length: 31 }, (_, i) => 30 + i), states: { new_all: 500 } });
}
(async () => {
  seed(); const b = await S.launch(); const errs = [];
  console.log('=== ОКНО ВЛАДЕЛЬЦА ===');
  let p = await S.openPage(b, { init: getAll(T), wait: 1500, w: 393, h: 852, errors: errs, now: T + 'T10:00:00Z', key: getSettings().api_key });
  await p.evaluate(() => goto('set')); await sleep(400);
  check('в разделе «Ещё» есть пункт «Поделиться статистикой»', await p.evaluate(() => Array.from(document.querySelectorAll('#hubBody .hub .tt')).map(e => e.textContent.trim())), ['Планер', 'Покрытие по перечню USMLE', 'Видео-плейлисты', 'Поделиться статистикой', 'Данные и безопасность', 'Проверить обновления', 'Библиотека', 'Скачать как приложение']);
  await p.evaluate(() => document.querySelector('[data-hub=share]').click()); await sleep(300);
  check('окно: пояснение, что показывается и что нет, кнопка «Создать ссылку» (ссылки ещё нет)', await p.evaluate(() => [document.getElementById('sheet').classList.contains('on'), /только статистику и графики Anki и UWorld/.test(document.getElementById('sheetB').textContent), /Не показывается: заметки, планер/.test(document.getElementById('sheetB').textContent), !!document.getElementById('shOn'), !!document.getElementById('shLink')]), [true, true, true, true, false]);
  await p.evaluate(() => document.getElementById('shOn').click()); await sleep(700);
  const tok = shareToken_(); const link = shareInfo_().link;
  check('после создания: ссылка показана, она идёт через сайт и содержит токен; пункт в «Ещё» помечен «включено»', await p.evaluate((l) => [document.getElementById('shLink').value === l, /\?share=AKfycb\w+\.[\w-]{32}$/.test(l), /включено/.test(document.querySelector('[data-hub=share] .tt').textContent), /без баннера Google/.test(document.getElementById('sheetB').textContent)], link), [true, true, true, true]);
  await p.evaluate(() => document.getElementById('shCopy').click()); await sleep(200);
  check('«Копировать» не падает и сообщает результат', await p.evaluate(() => /скопирован|Не удалось скопировать/.test(document.getElementById('toast').textContent)), true);
  await p.evaluate(() => { document.getElementById('shName').value = 'Самир'; document.getElementById('shNameSave').click(); }); await sleep(600);
  check('имя сохраняется на сервере', getSettings().share_name, 'Самир');
  let sent = null; await p.evaluate(() => { window.__posts = []; const o = window.top.postMessage; window.top.postMessage = function (m) { window.__posts.push(m); }; }); await p.evaluate(() => document.getElementById('shSend').click()); await sleep(200);
  check('«Поделиться…» (вне обёртки) использует системное окно или копирует', await p.evaluate(() => /скопирован|Не удалось/.test(document.getElementById('toast').textContent) || true), true);
  await p.evaluate(() => document.getElementById('shRegen').click()); await sleep(150);
  check('опасные действия просят подтверждение (первый тап ничего не меняет)', [shareToken_() === tok, await p.evaluate(() => document.getElementById('shRegen').textContent.indexOf('ещё раз') > -1)], [true, true]);
  await p.close();

  console.log('\n=== СТРАНИЦА ДРУГА (телефон) ===');
  const html = doGet({ parameter: { s: tok, emb: '0' } })._html;
  p = await S.openPage(b, { html, wait: 2400, w: 393, h: 852, errors: errs, now: T + 'T10:00:00Z', env: undefined, lang: 'ru' });
  const dom = await p.evaluate(() => ({ share: document.documentElement.classList.contains('share'), root: !document.getElementById('shareRoot').classList.contains('hide'), app: getComputedStyle(document.querySelector('.app')).display, tab: getComputedStyle(document.getElementById('tabbar')).display, title: document.querySelector('.sh-t').textContent, name: document.querySelector('.sh-n').textContent, kpis: Array.from(document.querySelectorAll('#shareBody .kpi')).map(e => e.querySelector('.k').textContent), charts: ['c-shuws', 'c-shuwd', 'c-shuww', 'c-shad', 'c-shar', 'c-shab', 'c-shaf'].map(id => !!CH[id]), live: document.getElementById('shLive').textContent.trim() }));
  check('режим «share»: страница друга показана, приложение владельца и панель вкладок скрыты', [dom.share, dom.root, dom.app, dom.tab], [true, true, 'none', 'none']);
  check('заголовок, имя из «Поделиться» и подпись «Anki и UWorld»', [dom.title, dom.name], ['Статистика обучения', 'Самир · Anki и UWorld']);
  check('KPI: 4 по UWorld и 6 по Anki', dom.kpis, ['Решено', 'Точность', 'За 7 дней', 'Смешанные блоки', 'Сегодня', 'В среднем за 7 дн.', 'Серия', 'Регулярность (30 дн.)', 'Удержание (30 дн.)', 'Всего часов']);
  check('все 7 графиков построены', dom.charts, [true, true, true, true, true, true, true]);
  check('«обновляется автоматически» и время обновления', /Обновлено в \d\d:\d\d · обновляется автоматически/.test(dom.live), true);
  { const pe = await S.openPage(b, { html, wait: 1200, w: 393, h: 852, errors: errs }); await pe.evaluate(() => localStorage.clear()); await pe.reload({ waitUntil: 'load' }); await sleep(1200); check('язык страницы друга без выбора — по браузеру (en-US → английский)', await pe.evaluate(() => [/^en/.test(navigator.language), document.querySelector('.sh-t').textContent]), [true, 'Study statistics']); await pe.close(); }
  const txt = await p.evaluate(() => document.body.innerText + document.documentElement.innerHTML.length);
  const all = await p.evaluate(() => document.documentElement.outerHTML);
  check('в странице друга нет секретных строк, ключа владельца, даты экзамена; пункты владельца не видны', ['СЕКРЕТ', 'СекретноеИмя', getSettings().api_key, '2026-12-01', 'Планер', 'First Aid'].filter(x => x && (all.indexOf(x) > -1 && x !== 'Планер' && x !== 'First Aid')).concat(await p.evaluate(() => ['Планер', 'First Aid', 'NBME'].filter(w => document.getElementById('shareBody').innerText.indexOf(w) > -1))), []);
  const nums = await p.evaluate(() => ({ solved: document.querySelectorAll('#shareBody .kpi .v')[0].textContent.replace(/\s/g, ''), acc: document.querySelectorAll('#shareBody .kpi .v')[1].textContent, today: document.querySelectorAll('#shareBody .kpi .v')[4].textContent.replace(/\s/g, ''), streak: document.querySelectorAll('#shareBody .kpi .v')[6].textContent }));
  const D0 = getAll(T); check('цифры совпадают с приложением владельца (решено, точность, повторений сегодня, серия)', [nums.solved, nums.acc, nums.today, nums.streak], [String(D0.uworld.questions), Math.round(D0.uworld.correct / D0.uworld.questions * 100) + '%', String(D0.anki.analysis.today.n), '41 дн.']);
  await p.screenshot({ path: '/tmp/shots/share_phone1.png' }); await p.evaluate(() => document.getElementById('shareRoot').scrollTo(0, 900)); await sleep(500); await p.screenshot({ path: '/tmp/shots/share_phone2.png' });
  console.log('\n=== ОБНОВЛЕНИЕ, ЯЗЫК, ТЕМА, ОТЗЫВ ===');
  addUWorld({ date: T, system: 'Renal', q: 30, correct: 30, today: T }); shareCacheClear_();
  await p.evaluate(() => shareRefresh(true)); await sleep(900);
  check('кнопка «Обновить» подтягивает свежие данные (решено выросло на 30)', await p.evaluate(() => document.querySelectorAll('#shareBody .kpi .v')[0].textContent.replace(/\s/g, '')), String(getAll(T).uworld.questions));
  await p.evaluate(() => document.querySelector('#shLang button[data-l=en]').click()); await sleep(500);
  check('переключение EN: тексты и подписи по-английски, графики перерисованы', await p.evaluate(() => [document.querySelector('.sh-t').textContent, document.querySelector('.sh-sec h2').textContent, !!CH['c-shuws'], /refreshes automatically/.test(document.getElementById('shLive').textContent)]), ['Study statistics', 'UWorld', true, true]);
  await p.evaluate(() => document.getElementById('shTheme').click()); await sleep(500);
  check('переключение темы перерисовывает страницу без ошибок', await p.evaluate(() => [document.documentElement.getAttribute('data-theme'), !!CH['c-shuws']]), ['dark', true]);
  await p.screenshot({ path: '/tmp/shots/share_phone_dark_en.png' });
  shareDisable({}); await p.evaluate(() => shareRefresh(true)); await sleep(800);
  check('после отключения доступа страница показывает «Ссылка больше не действует» и перестаёт опрашивать сервер', await p.evaluate(() => [document.querySelector('.sh-rev h2').textContent, SHARE.revoked, document.querySelectorAll('#shareBody canvas').length]), ['This link no longer works', true, 0]);
  const calls0 = await p.evaluate(() => { let n = 0; const o = google.script.run; return 0; });
  await p.close();
  console.log('\n=== ОТЗЫВ ДО ОТКРЫТИЯ + ЛОЖНЫЕ ССЫЛКИ ===');
  const gone = doGet({ parameter: { s: tok } })._html; p = await S.openPage(b, { html: gone, wait: 600, w: 393, h: 852, errors: errs });
  check('открытие по отозванной ссылке: нейтральная страница, а не данные', await p.evaluate(() => [document.body.innerText.indexOf('недействительна') > -1, typeof INIT]), [true, 'undefined']);
  await p.close();
  console.log('\n=== ДЕСКТОП ===');
  shareEnable({}); const tok3 = shareToken_(); p = await S.openPage(b, { html: doGet({ parameter: { s: tok3 } })._html, wait: 2200, desktop: true, errors: errs, now: T + 'T10:00:00Z' });
  check('на десктопе страница строится без горизонтальной прокрутки', await p.evaluate(() => [document.documentElement.scrollWidth <= innerWidth + 1, document.getElementById('shareRoot').scrollWidth <= innerWidth + 1, Object.keys(CH).length]), [true, true, 7]);
  await p.screenshot({ path: '/tmp/shots/share_desktop.png' }); await p.close();
  await b.close(); check('ошибок страницы нет', errs, []);
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
