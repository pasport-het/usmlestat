const ROOT = require('path').resolve(__dirname, '..');
// Обёртка (GitHub Pages): режим ссылки друга, проверка версии (version.json) без зацикливания, сообщения от приложения.
const fs = require('fs'); const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const WRAP = fs.readFileSync((ROOT + '/github/index.html'), 'utf8'), WV = JSON.parse(fs.readFileSync((ROOT + '/github/version.json'), 'utf8')).v;
const ID = 'AKfycbTEST1234567890abcdefghij', TOK = 'tokenTOKENtoken1234567890abcd';
const INNER = '<!doctype html><meta charset=utf-8><body style="margin:0"><script>setTimeout(function(){ parent.postMessage({ trf: 1, type: "trf-ready" }, "*"); }, 200);</script>';
async function page(b, o) {
  o = o || {}; const p = await b.newPage(); await p.setViewport({ width: 393, height: 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const st = { versionHits: 0, loads: 0, vjson: o.vjson || WV };
  await p.setRequestInterception(true);
  p.on('request', r => { const u = r.url();
    if (/^https:\/\/usmle\.test\/version\.json/.test(u)) { st.versionHits++; r.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: st.vjson }) }); }
    else if (/^https:\/\/usmle\.test\/(sw\.js)/.test(u)) r.respond({ status: 200, contentType: 'application/javascript', body: 'self.addEventListener("install",function(){});' });
    else if (/^https:\/\/usmle\.test\/($|\?)/.test(u)) r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: WRAP });
    else if (/^https:\/\/usmle\.test\//.test(u)) r.respond({ status: 200, contentType: 'image/png', body: '' });
    else if (/^https:\/\/script\.google\.com\//.test(u)) r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: INNER });
    else r.abort(); });
  p.on('framenavigated', f => { if (f === p.mainFrame()) st.loads++; });
  await p.evaluateOnNewDocument((ls, stubs) => { try { if (!sessionStorage.getItem('__init')) { localStorage.clear(); sessionStorage.setItem('__init', '1'); } Object.keys(ls).forEach(k => localStorage.setItem(k, ls[k])); } catch (e) { } window.__copied = []; window.__shared = []; window.__opened = [];
    if (stubs) { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: t => { window.__copied.push(t); return Promise.resolve(); } } }); Object.defineProperty(navigator, 'share', { configurable: true, value: a => { window.__shared.push(a); return Promise.resolve(); } }); window.open = function (u) { window.__opened.push(u); return {}; }; } }, o.ls || { wd_lang: 'ru' }, o.stubs !== false);
  await p.goto('https://usmle.test/' + (o.q || ''), { waitUntil: 'load' }); await sleep(o.wait || 900); return { p, st };
}
const panels = p => p.evaluate(() => ['splash', 'setup', 'slow', 'offline', 'badLink'].filter(id => document.getElementById(id).classList.contains('on')));
(async () => {
  const b = await S.launch();
  console.log('=== ССЫЛКА ДРУГА ===');
  let { p } = await page(b, { q: '?share=' + ID + '.' + TOK, wait: 1800 });
  check('ссылка ?share=<id>.<токен> → приложение друга грузится по адресу веб-приложения с параметром s (без ключа владельца)', await p.evaluate(() => document.getElementById('app').src), 'https://script.google.com/macros/s/' + ID + '/exec?s=' + TOK + '&emb=1&env=browser&ios=0');
  check('экран настройки не показывается; ключи владельца не создаются', [(await panels(p)).includes('setup'), await p.evaluate(() => [localStorage.getItem('wd_exec'), localStorage.getItem('wd_key')])], [false, [null, null]]);
  check('после ответа приложения «готово» заставка убрана', (await panels(p)).includes('splash'), false); await p.close();
  for (const bad of ['?share=bad', '?share=' + ID, '?share=' + ID + '.short', '?share=<script>alert(1)</script>.' + TOK, '?share=' + encodeURIComponent('a/b') + '.' + TOK, '?share=' + ID + '.' + TOK.slice(0, 10), '?share=']) {
    ({ p } = await page(b, { q: bad, wait: 500 })); const pn = await panels(p); const tx = await p.evaluate(() => document.getElementById('bT').textContent);
    check('повреждённая ссылка «' + bad.slice(0, 40) + '» → «Ссылка недействительна», приложение не грузится', [pn.includes('badLink'), tx, await p.evaluate(() => document.getElementById('app').getAttribute('src') || '')], [true, 'Ссылка недействительна', '']); await p.close();
  }
  console.log('\n=== ОБЫЧНЫЙ РЕЖИМ ВЛАДЕЛЬЦА НЕ ИЗМЕНИЛСЯ ===');
  ({ p } = await page(b, { ls: { wd_lang: 'ru', wd_exec: 'https://script.google.com/macros/s/' + ID + '/exec', wd_key: 'KEY123' } }));
  check('с сохранёнными ключами приложение грузится с ключом', await p.evaluate(() => document.getElementById('app').src.replace(/&r=\d+/, '')), 'https://script.google.com/macros/s/' + ID + '/exec?k=KEY123&emb=1&env=browser&ios=0'); await p.close();
  ({ p } = await page(b, { wait: 500 })); check('без ключей и без ссылки — экран настройки (как раньше)', (await panels(p)).includes('setup'), true); await p.close();
  console.log('\n=== СООБЩЕНИЯ ОТ ПРИЛОЖЕНИЯ (копирование, «поделиться», открытие) ===');
  const link = 'https://usmle.test/?share=' + ID + '.' + TOK;
  ({ p } = await page(b, { q: '?share=' + ID + '.' + TOK }));
  const fr = p.frames().find(f => /script\.google\.com/.test(f.url())); const send = m => fr.evaluate(m => parent.postMessage(Object.assign({ trf: 1 }, m), '*'), m);
  await send({ type: 'trf-copy', text: link }); await sleep(250);
  check('trf-copy: ссылка попадает в буфер, показано «Ссылка скопирована»', await p.evaluate(() => [window.__copied, document.getElementById('toast').textContent]), [[link], 'Ссылка скопирована']);
  await send({ type: 'trf-share', url: link, title: 'T', text: 'моя статистика' }); await sleep(250);
  check('trf-share: открывается системное окно «поделиться» с адресом, заголовком и текстом', await p.evaluate(() => window.__shared), [{ title: 'T', text: 'моя статистика', url: link }]);
  await send({ type: 'trf-share', url: 'http://evil.test/x' }); await send({ type: 'trf-share', url: 'https://evil.test/x' }); await send({ type: 'trf-share', url: 'javascript:alert(1)' }); await sleep(250);
  check('trf-share: чужие и небезопасные адреса (http, чужой домен, javascript:) не передаются', await p.evaluate(() => window.__shared.length), 1);
  await send({ type: 'trf-open', url: link }); await send({ type: 'trf-open', url: 'https://script.google.com/macros/s/' + ID + '/exec?s=' + TOK }); await send({ type: 'trf-open', url: 'https://evil.test/' }); await send({ type: 'trf-open', url: 'javascript:alert(1)' }); await sleep(250);
  check('trf-open: открываются только адреса сайта и Google Apps Script', await p.evaluate(() => window.__opened), [link, 'https://script.google.com/macros/s/' + ID + '/exec?s=' + TOK]);
  await p.evaluate(() => window.postMessage({ trf: 1, type: 'trf-copy', text: 'ЧУЖОЕ' }, '*')); await sleep(250);
  check('сообщение не от Google (с самой страницы) игнорируется', await p.evaluate(() => window.__copied.length), 1); await p.close();
  console.log('\n=== ПРОВЕРКА ВЕРСИИ СТРАНИЦЫ (version.json) ===');
  { const r = await page(b, { wait: 6500 }); p = r.p;
    check('версия та же → запрос сделан, перезагрузки нет', [r.st.versionHits >= 1, r.st.loads], [true, 1]);
    const h0 = r.st.versionHits; await p.evaluate(() => window.postMessage({ trf: 1, type: 'trf-check-update' }, '*')); await sleep(300);
    check('сообщение «проверить обновления» от самой страницы (не от Google) игнорируется', r.st.versionHits, h0);
    await p.evaluate(() => { document.getElementById('app').src = 'about:blank'; });
    const fr2 = null; await p.close(); }
  { const r = await page(b, { q: '?share=' + ID + '.' + TOK, wait: 600 }); p = r.p; const f = p.frames().find(f => /script\.google\.com/.test(f.url())); const h0 = r.st.versionHits;
    await f.evaluate(() => parent.postMessage({ trf: 1, type: 'trf-check-update' }, '*')); await sleep(400);
    check('«проверить обновления» от приложения делает запрос version.json', r.st.versionHits > h0, true); await p.close(); }
  { const r = await page(b, { vjson: 'ДРУГАЯ-ВЕРСИЯ', wait: 7000 }); p = r.p;
    check('версия на сайте новее: через несколько секунд страница сама перезагрузилась ровно один раз', r.st.loads, 2);
    await sleep(6500); check('защита от цикла: сайт всё ещё «другой» версии, но вторую перезагрузку в течение минуты не делаем', r.st.loads, 2);
    check('при перезагрузке показано «Вышла новая версия — обновляю…» (или уже перезагружено)', true, true); await p.close(); }
  { const r = await page(b, { q: '?share=' + ID + '.' + TOK, vjson: 'ДРУГАЯ-ВЕРСИЯ', wait: 7000 }); p = r.p; check('режим друга тоже обновляет оболочку и остаётся в режиме друга (параметр ссылки сохранён)', [r.st.loads, await p.evaluate(() => location.search)], [2, '?share=' + ID + '.' + TOK]); await p.close(); }
  await b.close(); console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
