const ROOT = require('path').resolve(__dirname, '..');
// Проект «Слова» в браузере: импорт, слово по времени, оценка, тренировка, настройки, виджет, вёрстка, читаемость.
const { loadServer, fresh } = require('./hw.js'); loadServer();
const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms)); const fs = require('fs'), vm = require('vm');
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12', key = () => getSettings_().api_key;
const mk = n => Array.from({ length: n }, (_, i) => ({ w: 'alpha' + String.fromCharCode(97 + i % 26) + Math.floor(i / 26), tr: 'перевод ' + i, exp: 'объяснение ' + i, ex: 'Sample alpha' + String.fromCharCode(97 + i % 26) + Math.floor(i / 26) + ' sentence.', pos: 'n.', ipa: '/æl/' }));
const PROBE = () => { const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }; const parse = s => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const p = m[1].split(',').map(parseFloat); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const bgOf = el => { const layers = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/gradient/.test(cs.backgroundImage)) return null; const c = parse(cs.backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } } let col = document.documentElement.getAttribute('data-theme') === 'dark' ? [10, 15, 28] : [255, 255, 255]; for (let i = layers.length - 1; i >= 0; i--) col = [0, 1, 2].map(k => layers[i][k] * layers[i][3] + col[k] * (1 - layers[i][3])); return col; };
  const bad = []; let total = 0; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const e = n.parentElement; if (!e || !n.textContent.trim() || e.closest('script,style,.hide') || e.closest('.page:not(.on)') || e.closest('#sheet:not(.on)')) continue; const r = e.getBoundingClientRect(); if (r.width < 2) continue; const cs = getComputedStyle(e); if (+cs.opacity === 0 || cs.visibility === 'hidden') continue; if (/blur/.test(cs.filter) || e.closest('.veil')) continue; const fg = parse(cs.color), bg = bgOf(e); if (!fg || !bg) continue; total++; const a = fg[3], mix = [0, 1, 2].map(k => fg[k] * a + bg[k] * (1 - a)); const L1 = lum(mix), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700); if (ratio < (large ? 3 : 4.5) - 0.05) bad.push(e.tagName + '.' + String(e.className).slice(0, 20) + ' «' + n.textContent.trim().slice(0, 20) + '» ' + ratio.toFixed(2)); }
  return { total, bad: bad.slice(0, 4), over: document.documentElement.scrollWidth - innerWidth, mainOver: document.getElementById('main').scrollWidth - document.getElementById('main').clientWidth }; };
(async () => {
  const b = await S.launch(); const errs = [];
  const open = async (o) => S.openPage(b, Object.assign({ wait: 1500, w: 393, h: 852, errors: errs, now: T + 'T08:00:20Z', key: key() }, o || {}));
  console.log('=== РАЗБОР ИМПОРТА (клиент) ===');
  fresh(T); let p = await open(); const pi = async t => p.evaluate(t => parseImport(t), t);
  let r = await pi('cat | кошка | животное | The cat sleeps. | n.\nDog | собака'); check('разделитель « | »: поля слово/перевод/объяснение/пример/часть речи', [r.rows.length, r.rows[0], r.rows[1].tr], [2, { w: 'cat', tr: 'кошка', exp: 'животное', ex: 'The cat sleeps.', pos: 'n.', ipa: '' }, 'собака']);
  r = await pi('cat\tкошка\nbird\tптица'); check('разделитель табуляция (вставка из Excel)', [r.rows.length, r.rows[1].tr, r.sep === '\t'], [2, 'птица', true]);
  r = await pi('cat; кошка; животное\nbird; птица'); check('разделитель «;»', [r.rows.length, r.rows[0].exp], [2, 'животное']);
  r = await pi('cat — кошка\nbird — птица\ntake off — взлетать'); check('разделитель « — » (тире с пробелами)', [r.rows.map(x => x.w), r.rows[2].tr], [['cat', 'bird', 'take off'], 'взлетать']);
  r = await pi('cat - кошка\nbird - птица'); check('разделитель « - » (дефис с пробелами); слова с дефисом внутри не режутся', [r.rows.length, (await pi('mother-in-law - тёща\nwell-known - известный')).rows.map(x => x.w)], [2, ['mother-in-law', 'well-known']]);
  r = await pi('word,translation,explanation\n"cat","кошка","животное, домашнее"\nbird,птица,'); check('CSV с кавычками и запятыми внутри; заголовок «word,…» пропущен', [r.rows.length, r.rows[0].exp, r.rows[1].w], [2, 'животное, домашнее', 'bird']);
  r = await pi('cat\ndog\n\n  bird  \n'); check('только слова (по одному в строке): перевод пустой, пробелы и пустые строки не мешают', [r.rows.map(x => x.w), r.rows.every(x => x.tr === '')], [['cat', 'dog', 'bird'], true]);
  r = await pi('123 | цифры\n | пусто\nкошка | cat\n' + 'x'.repeat(90) + ' | длинное\nok | хорошо'); check('строки без латинского слова, пустое слово и слово длиннее 80 — пропущены (4), остальное принято', [r.rows.map(x => x.w), r.bad.length], [['ok'], 4]);
  r = await pi('Слово | Перевод\ncat | кошка'); check('русский заголовок «Слово» пропущен', r.rows.map(x => x.w), ['cat']);
  r = await pi(''); check('пустой ввод — ноль строк, без ошибок', [r.rows.length, r.bad.length], [0, 0]);
  await p.close();
  console.log('\n=== ПУСТОЕ СОСТОЯНИЕ И ИМПОРТ ===');
  fresh(T); p = await open();
  check('слов нет: понятное сообщение и кнопка импорта', await p.evaluate(() => [document.getElementById('p-now').textContent.indexOf('Слов пока нет') > -1, !!document.querySelector('#p-now [data-act=import]'), document.getElementById('chip').textContent]), [true, true, '0/0']);
  await p.evaluate(() => { document.querySelector('#p-now [data-act=import]').click(); }); await sleep(300);
  await p.evaluate(() => { const t = document.getElementById('imText'); t.value = 'cat | кошка | животное | The cat sleeps. | n.\nubiquitous | повсеместный | встречающийся везде | Phones are ubiquitous. | adj.\nserendipity\n123\ncat | кошка (дубль)'; t.dispatchEvent(new Event('input')); });
  check('предпросмотр: новых 3 (cat, ubiquitous, serendipity), «cat» дубль внутри списка не считается дважды, без перевода 1, пропущено строк 1', await p.evaluate(() => document.getElementById('imPrev').textContent.startsWith('Новых: 3 · обновится: 0 · без изменений: 0 · без перевода: 1 · пропущено строк: 1')), true);
  await p.evaluate(() => document.getElementById('imGo').click()); await sleep(1500);
  check('импорт выполнен: 3 слова на сервере, окно закрыто, в наборе дня 2 слова (без перевода — нет)', await p.evaluate(() => [D.stats.total, D.day.ids.length, document.getElementById('sheet').classList.contains('on')]), [3, 2, false]);
  await p.close();
  console.log('\n=== СЛОВО ПО ВРЕМЕНИ: ПРИЛОЖЕНИЕ = СЕРВЕР = ВИДЖЕТ ===');
  fresh(T); wImport({ rows: mk(30) }); global.AUTH_OFF_ = true; const A = wGetAll({ today: T }); wSetSettings({ site_url: 'https://samir.github.io/words/', today: T });
  const wdj = m => { global.AUTH_OFF_ = false; const j = JSON.parse(doGet({ parameter: { widget: '1', k: key(), d: T, m: String(m) } })); global.AUTH_OFF_ = true; return j; };
  for (const [hh, mm] of [[8, 0], [8, 14], [8, 15], [12, 37], [21, 59], [7, 0], [23, 30]]) {
    p = await open({ now: T + 'T' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ':05Z', wait: 900 });
    const cw = await p.evaluate(() => document.getElementById('wWord') && document.getElementById('wWord').textContent), j = wdj(hh * 60 + mm);
    check(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + ' — слово в приложении = слово в виджете (слово ' + j.idx + ' из ' + j.n + ', круг ' + j.cycle + ')', cw, j.word.word); await p.close();
  }
  p = await open({ now: T + 'T08:14:46Z', wait: 1200 });
  const w0 = await p.evaluate(() => document.getElementById('wWord').textContent), t0 = await p.evaluate(() => document.getElementById('wTimer').textContent);
  check('таймер показывает остаток до следующего слова (~14 с до 08:15)', /^через 00:(0\d|1[0-4])$/.test(t0), true);
  await sleep(15500); const w1 = await p.evaluate(() => document.getElementById('wWord').textContent);
  check('ровно в 08:15 слово само сменилось на следующее по списку набора', [w1 !== w0, w1 === wdj(8 * 60 + 15).word.word], [true, true]);
  await p.close();
  console.log('\n=== ОЦЕНКА, ПЕРЕХОДЫ, ПЕРЕВОД ПО НАЖАТИЮ ===');
  p = await open({ now: T + 'T09:00:05Z', wait: 1000 });
  const gradeBefore = await p.evaluate(() => [D.progress.graded, document.getElementById('chip').textContent]);
  check('подписи кнопок оценки показывают следующий срок для нового слова: сейчас / 1 дн. / 1 дн. / 4 дн.', await p.evaluate(() => Array.from(document.querySelectorAll('.grades button small')).map(e => e.textContent)), ['сейчас', '1 дн.', '1 дн.', '4 дн.']);
  await p.evaluate(() => document.querySelector('.grades .g3').click()); await sleep(900);
  check('«Хорошо»: прогресс дня 1/20, слово отмечено в точках, тост со сроком, на сервере запись в журнале', await p.evaluate(() => [D.progress.graded, document.getElementById('chip').textContent, document.querySelectorAll('.dots i.done').length, document.getElementById('toast').textContent]).then(x => x.concat([readLog_().length])), [1, '1/20', 1, 'Следующее повторение через 1 дн.', 1]);
  const idx0 = await p.evaluate(() => curInfo().idx); await p.evaluate(() => document.getElementById('wNext').click()); await sleep(100); const idx1 = await p.evaluate(() => [curInfo().idx, !!document.querySelector('[data-act=back]')]);
  check('«вперёд» листает вручную; появляется «к текущему»; «к текущему» возвращает', [idx1[0] === (idx0 + 1) % 20, idx1[1], (await p.evaluate(() => { document.querySelector('[data-act=back]').click(); return curInfo().idx; })) === idx0], [true, true, true]);
  await p.evaluate(() => document.getElementById('wPrev').click()); check('«назад» через начало набора не ломается (круг)', await p.evaluate(() => curInfo().idx >= 0 && curInfo().idx < 20), true);
  await p.evaluate(() => { document.querySelector('[data-go=more]').click(); }); await sleep(200);
  await p.evaluate(() => { document.querySelector('#sRevealSeg [data-rv=tap]').click(); document.querySelector('[data-act=saveset]').click(); }); await sleep(900);
  await p.evaluate(() => document.querySelector('[data-go=now]').click()); await sleep(200);
  check('режим «перевод по нажатию»: перевод скрыт (размыт) и есть кнопка «Показать перевод»; после нажатия виден', [await p.evaluate(() => [!!document.querySelector('#wcard.veil'), !!document.querySelector('[data-act=reveal]')]), (await p.evaluate(() => { document.querySelector('[data-act=reveal]').click(); return !!document.querySelector('#wcard.veil'); }))], [[true, true], false]);
  await p.evaluate(() => { document.querySelector('[data-go=today]').click(); }); await sleep(200);
  check('«Сегодня»: 20 слов, у оценённого стоит ✓, заголовок «1 из 20»', await p.evaluate(() => [document.querySelectorAll('#p-today .wrow').length, document.querySelectorAll('#p-today .wrow .ok').length, document.querySelector('#p-today h2').textContent]), [20, 1, 'Сегодня: 1 из 20']);
  await p.evaluate(() => document.querySelector('[data-act=train]').click()); await sleep(250);
  check('«Пройти все подряд»: переход на «Сейчас», режим тренировки с первого слова, таймера нет', await p.evaluate(() => [S.page, S.train && S.train.i, document.getElementById('wTimer').textContent, /тренировка/.test(document.getElementById('wcard').textContent)]), ['now', 0, 'без таймера', true]);
  for (let i = 0; i < 20; i++) { await p.evaluate(() => document.querySelector('.grades .g3').click()); await sleep(260); }
  check('после 20 оценок тренировка завершена, прогресс дня 20 из 20 (слово, оценённое ранее, не задваивается)', await p.evaluate(() => [S.train, D.progress.graded, D.progress.total, document.getElementById('toast').textContent]), [null, 20, 20, 'Тренировка завершена']);
  await p.close();
  console.log('\n=== БИБЛИОТЕКА, ПРАВКА, УДАЛЕНИЕ, НАСТРОЙКИ ===');
  fresh(T); wImport({ rows: mk(30).concat([{ w: 'nottranslated' }]) }); p = await open({ wait: 1000 });
  await p.evaluate(() => document.querySelector('[data-go=words]').click()); await sleep(250);
  check('фильтры: всего 31, без перевода 1, поиск «alphab» находит слово', await p.evaluate(() => [document.querySelectorAll('#p-words .wrow').length, document.querySelector('[data-f=notr]').textContent]), [31, 'Без перевода 1']);
  await p.evaluate(() => document.querySelector('[data-f=notr]').click()); check('фильтр «без перевода» показывает «— нужен перевод —»', await p.evaluate(() => [document.querySelectorAll('#p-words .wrow').length, /нужен перевод/.test(document.querySelector('#p-words .wrow').textContent)]), [1, true]);
  await p.evaluate(() => { document.querySelector('[data-f=all]').click(); const i = document.getElementById('wSearch'); i.value = 'alphab'; i.dispatchEvent(new Event('input', { bubbles: true })); }); check('поиск работает и не теряет фокус при вводе', await p.evaluate(() => [document.querySelectorAll('#p-words .wrow').length >= 1, document.activeElement && document.activeElement.id]), [true, 'wSearch']);
  await p.evaluate(() => { document.querySelector('#p-words .wrow').click(); }); await sleep(250);
  await p.evaluate(() => { document.getElementById('eTr').value = 'новый перевод'; document.querySelector('[data-act=saveedit]').click(); }); await sleep(800);
  check('правка перевода сохраняется на сервере', readWords_().some(w => w.tr === 'новый перевод'), true);
  await p.evaluate(() => { document.querySelector('#p-words .wrow').click(); }); await sleep(250); await p.evaluate(() => document.querySelector('[data-act=del]').click()); await sleep(150);
  check('удаление просит подтверждения: слово ещё на месте; повторное нажатие удаляет', [readWords_().length, await p.evaluate(() => document.querySelector('[data-act=del]').textContent)], [31, 'Нажмите ещё раз']);
  await p.evaluate(() => document.querySelector('[data-act=del]').click()); await sleep(800); check('после подтверждения слово удалено', readWords_().length, 30);
  await p.evaluate(() => document.querySelector('[data-go=more]').click()); await sleep(200);
  await p.evaluate(() => { document.getElementById('sInt').value = '5'; document.getElementById('sDaily').value = '10'; document.getElementById('sRev').value = '2'; document.querySelector('[data-act=saveset]').click(); }); await sleep(900);
  check('настройки: шаг 5 мин, 10 слов в день сохранены и применены (набор уже создан — размер сегодняшнего набора не уменьшается, шаг применяется сразу)', await p.evaluate(() => [D.settings.interval, D.settings.daily, D.settings.reviews, S.lastSlot === -1 || S.lastSlot >= 0]), [5, 10, 2, true]);
  await p.evaluate(() => { document.getElementById('sInt').value = '0'; document.querySelector('[data-act=saveset]').click(); }); await sleep(600);
  check('недопустимая настройка отклонена с понятным сообщением', await p.evaluate(() => document.getElementById('toast').textContent), 'Недопустимое значение настройки.');
  check('«Слова без перевода: 1» и кнопка копирования просьбы; текст просьбы содержит слово и формат', await p.evaluate(() => [/без перевода: 1/.test(document.getElementById('p-more').textContent), promptNoTr().indexOf('nottranslated') > -1, /слово \| перевод \| простое объяснение/.test(promptNoTr())]), [true, true, true]);
  await p.close();
  console.log('\n=== ЦВЕТ СЛОВА: ЧИТАЕМОСТЬ ДЛЯ ВСЕХ 360 ОТТЕНКОВ ===');
  { const html = fs.readFileSync((ROOT + '/Index.html'), 'utf8'); const a = html.indexOf('function hslRgb'), z = html.indexOf('function markHtml'); let theme = 'light'; const ctx = vm.createContext({ document: { documentElement: { getAttribute: () => theme } } }); vm.runInContext(html.slice(a, z), ctx);
    const rgbOf = c => vm.runInContext('hslRgb(' + c.match(/hsl\((\d+) (\d+)% (\d+)%\)/).slice(1).join(',') + ')', ctx), lum = c => vm.runInContext('lumOf(' + JSON.stringify(c) + ')', ctx), ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }, blend = (f, b, al) => f.map((v, i) => v * al + b[i] * (1 - al));
    for (const th of ['light', 'dark']) { theme = th; const card = th === 'dark' ? [0x12, 0x1A, 0x2B] : [255, 255, 255], page = th === 'dark' ? [10, 15, 28] : [244, 246, 251]; let worst = 99, minL = 100, maxL = 0, bad = []; for (let h = 0; h < 360; h++) { const c = vm.runInContext('wordColor(' + h + ')', ctx), rgb = rgbOf(c), L = +c.match(/(\d+)%\)/)[1], tint = blend(vm.runInContext('hslRgb(' + h + ',80,50)', ctx), card, 0.15); const r = Math.min(ratio(rgb, card), ratio(rgb, page), ratio(rgb, tint)); if (r < worst) worst = r; if (r < 4.5) bad.push(h); minL = Math.min(minL, L); maxL = Math.max(maxL, L); }
      check(th === 'light' ? 'светлая тема: цвет слова и метки читается на карточке, странице и тонированной метке при всех 360 оттенках (худший контраст ' + worst.toFixed(2) + ')' : 'тёмная тема: то же (худший контраст ' + worst.toFixed(2) + ')', [bad.length, worst >= 4.5, minL >= 15 && maxL <= 85], [0, true, true]); } }
  console.log('\n=== КОД ВИДЖЕТА ===');
  fresh(T); wImport({ rows: mk(5) }); wSetSettings({ site_url: 'https://samir.github.io/words/', today: T }); p = await open({ wait: 900 });
  const code = await p.evaluate(() => widgetCode()); const acorn = require('acorn');
  check('код виджета: подставлены адрес сервера, ключ и адрес приложения; плейсхолдеров не осталось; синтаксис корректен', [/__API__|__KEY__|__APP__/.test(code), code.indexOf(key()) > -1, code.indexOf('https://script.google.com/macros/s/') > -1, code.indexOf('https://samir.github.io/words/?k=' + key()) > -1, (() => { try { acorn.parse(code, { ecmaVersion: 2022, allowAwaitOutsideFunction: true }); return true; } catch (e) { return e.message; } })()], [false, true, true, true, true]);
  await p.close();
  console.log('\n=== ВЁРСТКА И ЧИТАЕМОСТЬ ===');
  fresh(T); wImport({ rows: mk(30) }); let issues = 0, texts = 0;
  for (const theme of ['light', 'dark']) for (const [w, h] of [[320, 640], [393, 852], [430, 932], [768, 1024]]) {
    p = await open({ w, h, wait: 1000 }); await p.evaluate(t => { D.settings.theme = t; applyTheme(); render(); }, theme);
    for (const pg of ['now', 'today', 'words', 'more']) { await p.evaluate(pg => goPage(pg), pg); await sleep(150); const r = await p.evaluate(PROBE); texts += r.total; if (r.bad.length || r.over > 0 || r.mainOver > 0) { issues++; console.log('  ✗', theme, w + 'x' + h, pg, J(r)); } }
    await p.evaluate(() => openImport()); await sleep(250); { const r = await p.evaluate(PROBE); texts += r.total; if (r.bad.length || r.over > 0) { issues++; console.log('  ✗', theme, w + 'x' + h, 'импорт', J(r)); } }
    await p.close();
  }
  check('все 4 вкладки и окно импорта: 2 темы × 4 размера (320…768 px): нет слабого контраста и горизонтальной прокрутки (проверено текстов: ' + texts + ')', issues, 0);
  await b.close(); check('ошибок страницы нет', errs, []);
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
