// Нижнее меню (iOS 26 Liquid Glass): структура, тап, долгое нажатие, перетаскивание, совмещение линзы, отмена, клавиатура, сниженная анимация, размеры.
const { loadServer, fresh } = require('./h.js'); loadServer(); const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 230)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12';
function seed() { fresh(T); saveSettings({ exam_date: '2026-12-01', today: T }); for (let k = 10; k >= 0; k--) { addLog({ date: addDays_(T, -k), system: 'Renal', pages: 6, today: T }); addUWorld({ date: addDays_(T, -k), system: 'Renal', q: 20, correct: 12, today: T }); } }
const PG = ['map', 'fa', 'uw', 'nbme', 'anki', 'set'];
(async () => {
  seed(); const b = await S.launch(); const errs = [];
  const open = async (o) => S.openPage(b, Object.assign({ raf: true, init: getAll(T), wait: 1300, w: 393, h: 852, errors: errs, now: T + 'T10:00:00Z', key: getSettings().api_key }, o || {}));
  const st = p => p.evaluate(() => Drop._state()); const geo = p => p.evaluate(() => { const bar = document.getElementById('tabbar').getBoundingClientRect(); const bt = Array.from(document.querySelectorAll('#tabbar > .tb')).map(x => { const r = x.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }); return { bar: { l: bar.left, r: bar.right, t: bar.top, b: bar.bottom, w: bar.width, h: bar.height }, bt }; });
  const settle = async p => { for (let k = 0; k < 100; k++) { const s = await st(p); if (!s.raf && !s.down) return; await sleep(50); } };       // ждём конца анимации (до 5 с): страница UWorld тяжёлая и занимает главный поток
  console.log('=== СТРУКТУРА ===');
  let p = await open(); let g = await geo(p);
  check('панель: роль tablist, 6 вкладок role=tab, ровно одна выбрана; копия для линзы скрыта от чтения (aria-hidden) и не фокусируется', await p.evaluate(() => { const bar = document.getElementById('tabbar'), tabs = Array.from(bar.querySelectorAll(':scope > .tb')), cl = Array.from(document.querySelectorAll('#tbClone .tb')); return [bar.getAttribute('role'), tabs.length, tabs.every(x => x.getAttribute('role') === 'tab'), tabs.filter(x => x.getAttribute('aria-selected') === 'true').length, cl.length, cl.every(x => x.getAttribute('aria-hidden') === 'true' && x.tabIndex === -1 && !x.getAttribute('role'))]; }), ['tablist', 6, true, 1, 6, true]);
  check('панель плавает: отступы по бокам 14 px, высота 64, нижний край выше края экрана; внутри экрана', [Math.round(g.bar.l), Math.round(393 - g.bar.r), Math.round(g.bar.h), g.bar.b < 852 && g.bar.t > 600], [14, 14, 64, true]);
  let s = await st(p);
  check('в покое капсула стоит точно под выбранной вкладкой (центр совпадает ±1 px), линза скрыта', [Math.abs(s.x - (g.bt[0].cx - g.bar.l)) < 1, await p.evaluate(() => getComputedStyle(document.getElementById('tbLens')).visibility), s.pressed, s.lift], [true, 'hidden', false, 0]);
  check('размытие фона у стекла включено (backdrop-filter с blur), у капсулы-линзы вложенного размытия нет (WebKit глючит на вложенных)', await p.evaluate(() => { const f = e => { const c = getComputedStyle(e); return (c.backdropFilter || c.webkitBackdropFilter || 'none'); }; return [/blur/.test(f(document.querySelector('.tb-glass'))), f(document.getElementById('tbLens')), f(document.getElementById('tbRest'))]; }), [true, 'none', 'none']);
  console.log('\n=== ТАП ПО КАЖДОЙ ВКЛАДКЕ ===');
  for (let i = 0; i < 6; i++) { g = await geo(p); await p.mouse.move(g.bt[i].cx, g.bt[i].cy); await p.mouse.down(); await sleep(50); await p.mouse.up(); await settle(p); s = await st(p);
    const r = await p.evaluate(i => ({ page: PAGE, sel: Array.from(document.querySelectorAll('#tabbar > .tb')).map(x => x.getAttribute('aria-selected')), pressed: document.getElementById('tabbar').classList.contains('pressed') }), i);
    check('тап по вкладке ' + (i + 1) + ': открыта страница «' + PG[i] + '», капсула приехала под вкладку (±1 px), выбрана ровно она, линзы нет', [r.page === PG[i] || (i === 5 && ['set', 'video', 'lib', 'plan', 'cov'].indexOf(r.page) > -1), Math.abs(s.x - (g.bt[i].cx - g.bar.l)) < 1, r.sel.map(x => x === 'true').indexOf(true) === i && r.sel.filter(x => x === 'true').length === 1, r.pressed, s.lift < 0.02], [true, true, true, false, true]); }
  console.log('\n=== ДОЛГОЕ НАЖАТИЕ: ЛИНЗА ПОДНИМАЕТСЯ ===');
  await p.evaluate(() => goto('map')); await sleep(500); g = await geo(p);
  await p.mouse.move(g.bt[2].cx, g.bt[2].cy); await p.mouse.down(); await sleep(60);
  check('в первые 60 мс это ещё «тап»: линзы нет', await p.evaluate(() => [document.getElementById('tabbar').classList.contains('pressed'), Drop._state().pressed]), [false, false]);
  await sleep(500); s = await st(p);
  const L = await p.evaluate(() => { const lens = document.getElementById('tbLens'), cs = getComputedStyle(lens), hotBase = document.querySelector('#tabbar > .tb.hot'), hotClone = document.querySelector('#tbClone .tb.hot'); const bb = hotBase.querySelector('svg').getBoundingClientRect(), cb = hotClone.querySelector('svg').getBoundingClientRect(); const sw = document.querySelector('.tb-glass'); return { vis: cs.visibility, op: +cs.opacity, hot: hotBase.dataset.p, cloneHot: hotClone.dataset.p, dx: (cb.left + cb.width / 2) - (bb.left + bb.width / 2), dy: (cb.top + cb.height / 2) - (bb.top + bb.height / 2), ratio: cb.width / bb.width, swell: new DOMMatrix(getComputedStyle(sw).transform).a, baseFade: +getComputedStyle(hotBase.querySelector('svg')).opacity, restOp: +getComputedStyle(document.getElementById('tbRest')).opacity }; });
  check('через ~0.5 с линза поднялась: видна, панель «набухла» (≈ 1.035), капсула покоя растворилась, настоящий значок под линзой скрыт', [L.vis, L.op > 0.95, Math.abs(L.swell - 1.035) < 0.01, L.restOp < 0.05, L.baseFade < 0.1, s.pressed, s.lift > 0.95], ['visible', true, true, true, true, true, true]);
  check('увеличенная копия значка внутри линзы лежит ровно поверх настоящего (центр ±1.5 px) и увеличена на ≈ 16 %', [L.hot === 'uw', L.cloneHot === 'uw', Math.abs(L.dx) < 1.5, Math.abs(L.dy) < 1.5, L.ratio > 1.13 && L.ratio < 1.2], [true, true, true, true, true]);
  await p.mouse.up(); await settle(p); s = await st(p);
  check('отпустили на той же вкладке: страница «uw», линза спряталась, панель сжалась обратно', [await p.evaluate(() => PAGE), await p.evaluate(() => getComputedStyle(document.getElementById('tbLens')).visibility), s.lift < 0.02, await p.evaluate(() => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector('.tb-glass')).transform).a - 1) < 0.005)], ['uw', 'hidden', true, true]);
  console.log('\n=== ПЕРЕТАСКИВАНИЕ ===');
  await p.evaluate(() => goto('map')); await sleep(500); g = await geo(p);
  await p.mouse.move(g.bt[0].cx, g.bt[0].cy); await p.mouse.down(); await sleep(40); const xs = [];
  for (let k = 1; k <= 12; k++) { await p.mouse.move(g.bt[0].cx + (g.bt[4].cx - g.bt[0].cx) * k / 12, g.bt[0].cy); await sleep(35); if (k % 4 === 0) xs.push((await st(p)).x); }
  await sleep(250); s = await st(p); const hotNow = await p.evaluate(() => (document.querySelector('#tabbar > .tb.hot') || {}).dataset && document.querySelector('#tabbar > .tb.hot').dataset.p);
  check('линза идёт за пальцем вправо (положение растёт на каждом отрезке) и в конце стоит под 5-й вкладкой (anki); «горячая» вкладка — anki', [xs[0] < xs[1] && xs[1] < xs[2], Math.abs(s.x - (g.bt[4].cx - g.bar.l)) < 3, s.pressed, hotNow], [true, true, true, 'anki']);
  await p.mouse.up(); await settle(p); s = await st(p);
  check('отпустили над 5-й вкладкой: открыта «anki», капсула на месте', [await p.evaluate(() => PAGE), Math.abs(s.x - (g.bt[4].cx - g.bar.l)) < 1], ['anki', true]);
  await p.mouse.move(g.bt[4].cx, g.bt[4].cy); await p.mouse.down(); await sleep(200); await p.mouse.move(g.bar.l - 80, g.bt[4].cy, { steps: 6 }); await sleep(500); s = await st(p);
  check('за левый край пальцем не утащить: линза упруго упирается (не дальше ~16 px за центр первой вкладки)', [s.x >= s.centers[0] - 17, s.x < s.centers[0] + 2], [true, true]);
  await p.mouse.move(g.bar.r + 90, g.bt[4].cy, { steps: 6 }); await sleep(500); s = await st(p); check('и за правый край так же', [s.x <= s.centers[5] + 17, s.x > s.centers[5] - 2], [true, true]);
  await p.mouse.up(); await sleep(900); check('отпустили у правого края — выбрана последняя вкладка («Ещё»)', await p.evaluate(() => ['set', 'video', 'lib', 'plan', 'cov'].indexOf(PAGE) > -1), true);
  console.log('\n=== ОТМЕНА ЖЕСТА, КЛАВИАТУРА, СНИЖЕННАЯ АНИМАЦИЯ ===');
  await p.evaluate(() => goto('map')); await sleep(500); g = await geo(p);
  await p.evaluate(() => { const bar = document.getElementById('tabbar'); const r = bar.getBoundingClientRect(); const o = { pointerId: 7, bubbles: true, clientY: r.top + 30, button: 0, pointerType: 'touch' }; bar.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ clientX: r.left + 200 }, o))); });
  await sleep(300); const during = await p.evaluate(() => Drop._state().pressed); await p.evaluate(() => document.getElementById('tabbar').dispatchEvent(new PointerEvent('pointercancel', { pointerId: 7, bubbles: true }))); await sleep(800); s = await st(p);
  check('системная отмена жеста (звонок, свайп): линза спрятана, страница НЕ меняется, капсула возвращается к выбранной', [during, await p.evaluate(() => PAGE), Math.abs(s.x - (g.bt[0].cx - g.bar.l)) < 1, s.pressed, s.lift < 0.02], [true, 'map', true, false, true]);
  await p.evaluate(() => document.querySelector('#tabbar > .tb[data-p=fa]').focus()); await p.keyboard.press('ArrowRight'); const f1 = await p.evaluate(() => document.activeElement.dataset.p); await p.keyboard.press('Enter'); await settle(p);
  check('клавиатура: стрелка вправо переносит фокус на «uw», Enter открывает страницу, капсула приезжает', [f1, await p.evaluate(() => PAGE), Math.abs((await st(p)).x - ((await geo(p)).bt[2].cx - (await geo(p)).bar.l)) < 1], ['uw', 'uw', true]);
  await p.close();
  p = await open(); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); await p.reload({ waitUntil: 'load' }); await sleep(1300); g = await geo(p);
  await p.mouse.move(g.bt[3].cx, g.bt[3].cy); await p.mouse.down(); await sleep(40); await p.mouse.up(); await sleep(200); s = await st(p);
  check('«уменьшить движение»: капсула сразу на месте без пружины, страница открыта', [Math.abs(s.x - (g.bt[3].cx - g.bar.l)) < 1, await p.evaluate(() => PAGE)], [true, 'nbme']); await p.close();
  console.log('\n=== РАЗМЕРЫ, ТЕМЫ, ЧИТАЕМОСТЬ ===');
  for (const [w, h] of [[320, 640], [360, 740], [393, 852], [430, 932], [768, 1024]]) { p = await open({ w, h }); g = await geo(p); s = await st(p); const r = await p.evaluate(() => { const bar = document.getElementById('tabbar'), tabs = Array.from(bar.querySelectorAll(':scope > .tb')); return { over: document.documentElement.scrollWidth - innerWidth, clipped: tabs.filter(t => t.querySelector('span').scrollWidth > t.clientWidth + 1).length, labels: tabs.map(t => Math.round(t.getBoundingClientRect().width)) }; });
    check(w + '×' + h + ': панель целиком на экране, без горизонтальной прокрутки, подписи не обрезаны, капсула под первой вкладкой', [g.bar.l >= 0 && g.bar.r <= w, r.over, r.clipped, Math.abs(s.x - (g.bt[0].cx - g.bar.l)) < 1], [true, 0, 0, true]); await p.close(); }
  p = await open({ desktop: true }); check('на десктопе (≥ 861 px) нижней панели нет — работает боковое меню', await p.evaluate(() => getComputedStyle(document.getElementById('tabbar')).display), 'none'); await p.close();
  for (const theme of ['light', 'dark']) { p = await open({ theme }); const c = await p.evaluate(() => { const cs = e => getComputedStyle(e); const m = s => (/rgba?\(([^)]+)\)/.exec(s) || [0, ''])[1].split(',').map(parseFloat); const tab = document.querySelector('#tabbar > .tb:not(.on)'), on = document.querySelector('#tabbar > .tb.on'); return { grey: m(cs(tab).color), blue: m(cs(on).color), glassBg: cs(document.querySelector('.tb-glass')).backgroundImage.slice(0, 40), restBg: cs(document.getElementById('tbRest')).backgroundImage.length > 20 }; });
    check('тема «' + theme + '»: серые подписи и синяя выбранная различимы, стекло и капсула покоя нарисованы', [c.grey.length >= 3, c.blue.length >= 3 && c.blue[2] > c.blue[0], /gradient/.test(c.glassBg), c.restBg], [true, true, true, true]); await p.screenshot({ path: '/tmp/shots/tb_' + theme + '_rest.png', clip: { x: 0, y: 700, width: 393, height: 152 } }); await p.close(); }
  await b.close(); check('ошибок страницы нет', errs, []);
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
