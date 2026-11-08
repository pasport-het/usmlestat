// v5.3: скорость входа. Без шрифтов из сети, Chart.js не блокирует показ, ранний запрос данных, мгновенный показ последних данных (снимок).
const { loadServer, fresh } = require('./h.js'); loadServer(); const S = require('./shots.js'); const seedRich = require('./seed_rich.js'); const sleep = ms => new Promise(r => setTimeout(r, ms)); global.fresh = fresh;
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 230)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-11-05';
(async () => {
  global.SERVER_TODAY_FORCE_ = T; seedRich(T); const key = getSettings().api_key; const b = await S.launch(); const errs = [];
  const open = async (o) => S.openPage(b, Object.assign({ raf: true, lang: 'ru', init: null, env: { emb: true }, wait: 0, w: 393, h: 852, errors: errs, now: T + 'T10:00:00Z', key }, o || {}));
  const waitFor = async (p, fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 8000)) { if (await p.evaluate(fn)) return Date.now() - t0; await sleep(30); } return -1; };
  console.log('=== СЕТЬ И БЛОКИРОВКА ПОКАЗА ===');
  { const log = []; const p = await open({ reqLog: log, wait: 1500 });
    check('никаких обращений к Google Fonts (шрифт системный: ни одного запроса, который мог бы задержать показ)', log.filter(u => /fonts\.(googleapis|gstatic)\.com/.test(u)).length, 0);
    check('Chart.js подключён асинхронно (не блокирует разбор страницы), с обработчиком «догрузился»', await p.evaluate(() => { const s = document.querySelector('script[src*="chart"]'); return [!!s.async, /__chartReady/.test(s.getAttribute('onload') || '')]; }), [true, true]);
    check('ранний запрос данных стоит ДО основного скрипта (в начале страницы)', await p.evaluate(() => { const ss = Array.from(document.querySelectorAll('script')); const iE = ss.findIndex(s => /EARLY = \{/.test(s.textContent)), iM = ss.findIndex(s => /function LS\(/.test(s.textContent)); return [iE >= 0, iE < iM]; }), [true, true]);
    await p.close(); }
  console.log('\n=== РАННИЙ ЗАПРОС ДАННЫХ ===');
  { const calls = []; const p = await open({ calls, delay: 900, wait: 100, ls: { trf_snap: null } });
    const tFirst = await waitFor(p, () => !!window.D, 6000); await sleep(1200); const names = calls.filter(c => c.name === 'getAll').length;
    check('сервер вызывается ОДИН раз за вход (ранний запрос используется, повторного reload нет); данные появились после ответа сервера (≈ 0,9 с)', [names, tFirst > 600 && tFirst < 2200], [1, true]);
    check('страница отрисована полностью из ответа (карточки главной заполнены, «дней до экзамена» не «?»)', await p.evaluate(() => [document.getElementById('cdN').textContent !== '?', document.querySelectorAll('#p-map .card').length > 8]), [true, true]); await p.close(); }
  console.log('\n=== СНИМОК: МГНОВЕННЫЙ ВХОД ===');
  let p = await open({ delay: 600, wait: 3200 });
  const snapRaw = await p.evaluate(() => localStorage.getItem('trf_snap')); const snap = snapRaw && JSON.parse(snapRaw);
  check('после первого входа снимок сохранён (сборка v5.3.0, свежее время, данные с настройками)', [!!snap, snap && snap.b, snap && Math.abs(snap.at - new Date(T + 'T10:00:00Z').getTime()) < 120000, snap && !!snap.d.settings && snap.d.today], [true, 'v5.3.0', true, T]); await p.close();
  { const p2 = await open({ delay: 3000, wait: 0, ls: { trf_snap: snapRaw } }); const tSnap = await waitFor(p2, () => !!window.D, 4000);
    const stale = await p2.evaluate(() => [document.documentElement.classList.contains('stale'), document.querySelectorAll('#p-map .card').length > 8, document.getElementById('cdN').textContent !== '?']);
    check('со снимком данные на экране почти сразу (< 1,2 с), хотя сервер отвечает только через 3 с; пока ждём — отметка «обновляется»', [tSnap >= 0 && tSnap < 1200, stale], [true, [true, true, true]]);
    const tFresh = await waitFor(p2, () => !document.documentElement.classList.contains('stale'), 6000);
    check('через ≈ 3 с приходят свежие данные: отметка «обновляется» снимается, страница остаётся целой', [tFresh > 1500 && tFresh < 5000, await p2.evaluate(() => [D.today, !!D.version, document.querySelectorAll('#p-map .card').length > 8])], [true, ['2026-11-05', true, true]]); await p2.close(); }
  console.log('\n=== ПОВРЕЖДЁННЫЙ, ЧУЖОЙ И СТАРЫЙ СНИМОК ===');
  for (const [name, val] of [['битый JSON', '{не json'], ['другая сборка', JSON.stringify(Object.assign({}, snap, { b: 'v5.2.0' }))], ['старше 30 дней', JSON.stringify(Object.assign({}, snap, { at: new Date(T + 'T10:00:00Z').getTime() - 31 * 86400000 }))], ['пустые данные', JSON.stringify({ b: 'v5.3.0', at: new Date(T + 'T10:00:00Z').getTime(), d: {} })]]) {
    const q = await open({ delay: 700, wait: 0, ls: { trf_snap: val } }); const t = await waitFor(q, () => !!window.D, 5000); const st = await q.evaluate(() => document.documentElement.classList.contains('stale'));
    check('снимок «' + name + '» игнорируется: показ не раньше ответа сервера (≥ 0,5 с), без отметки, без ошибок', [t >= 500, st], [true, false]); await q.close(); }
  { const q = await open({ delay: 500, wait: 0, ls: { trf_snap: snapRaw } }); await q.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); }; }); await sleep(2500);
    check('переполнение хранилища при сохранении снимка не ломает приложение', await q.evaluate(() => [!!window.D, document.querySelectorAll('#p-map .card').length > 8]), [true, true]); await q.close(); }
  console.log('\n=== СБОЙ СЕРВЕРА ПРИ ВХОДЕ ===');
  { const q = await open({ delay: 400, wait: 0, fail: ['getAll'], ls: { trf_snap: snapRaw } }); await waitFor(q, () => !!window.D, 3000); await sleep(1500);
    check('сервер недоступен, но снимок есть: данные показаны, «обновляется» снято, пользователь видит сообщение об ошибке (а не вечную загрузку)', await q.evaluate(() => [!!window.D, document.documentElement.classList.contains('stale'), /Не удалось|ошиб|связ/i.test(document.getElementById('toast').textContent)]), [true, false, true]); await q.close(); }
  console.log('\n=== МЕДЛЕННЫЙ Chart.js ===');
  { const q = await open({ delay: 100, wait: 600, chartDelay: 4500, ls: { trf_snap: null } });                                  // goto ждёт 'load' (в том числе асинхронный скрипт): ориентируемся на отметки внутри страницы
    const m = await q.evaluate(() => { const r = performance.getEntriesByType('resource').filter(e => /chart/.test(e.name))[0]; return { tD: window.__tD, tCH: window.__tCH, chartEnd: r.responseEnd, ch: Object.keys(CH).length, Chart: typeof Chart }; });
    check('Chart.js пришёл только на 4,5-й секунде, а данные и страницы показаны уже на первой (до загрузки скрипта) — показ не заблокирован', [m.tD < 1000, m.chartEnd > 4400, m.tD < m.chartEnd - 3000], [true, true, true]);
    check('после загрузки Chart.js графики нарисовались сами (без перезагрузки): первый график не раньше загрузки скрипта и не позже чем через 1 с после неё; ошибок нет', [m.ch > 0, m.tCH >= m.chartEnd - 50, m.tCH - m.chartEnd < 1000], [true, true, true]); await q.close(); }
  await b.close(); check('ошибок страницы нет', errs.filter(e => !/E_FAIL/.test(e)), []);
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
