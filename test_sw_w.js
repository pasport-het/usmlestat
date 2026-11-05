const ROOT = require('path').resolve(__dirname, '..');
// Сервис-воркер: сеть сначала для страницы, version.json всегда из сети, чужие адреса не трогаем, мгновенное применение нового воркера.
const fs = require('fs'), vm = require('vm'); let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 200)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
function env(opts) {
  opts = opts || {}; const listeners = {}, store = {}, log = { skip: 0, claim: 0, fetched: [], notifs: [], opened: [], deleted: [] };
  const caches = { open: n => Promise.resolve({ addAll: l => { store[n] = store[n] || {}; (l || []).forEach(k => store[n][k] = 'shell'); return Promise.resolve(); }, put: (k, v) => { store[n] = store[n] || {}; store[n][typeof k === 'string' ? k : k.url] = v; return Promise.resolve(); } }),
    keys: () => Promise.resolve(Object.keys(store)), delete: k => { log.deleted.push(k); delete store[k]; return Promise.resolve(true); },
    match: k => { const key = typeof k === 'string' ? k : k.url; for (const n of Object.keys(store)) if (store[n][key] !== undefined) return Promise.resolve(store[n][key]); for (const n of Object.keys(store)) { const hit = Object.keys(store[n]).find(x => x.endsWith('/' + key) || x === key); if (hit) return Promise.resolve(store[n][hit]); } return Promise.resolve(undefined); } };
  const self = { location: { origin: 'https://usmle.test' }, addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); }, skipWaiting: () => { log.skip++; return Promise.resolve(); }, clients: { claim: () => { log.claim++; return Promise.resolve(); }, matchAll: () => Promise.resolve(opts.clients || []), openWindow: u => { log.opened.push(u); return Promise.resolve(); } }, registration: { showNotification: (t, o) => { log.notifs.push([t, o]); return Promise.resolve(); } } };
  const ctx = vm.createContext({ self, caches, URL, Promise, console, fetch: u => { log.fetched.push(typeof u === 'string' ? u : u.url); return opts.offline ? Promise.reject(new Error('offline')) : Promise.resolve({ clone() { return this; }, tag: 'net:' + (typeof u === 'string' ? u : u.url) }); } });
  vm.runInContext(fs.readFileSync((ROOT + '/github/sw.js'), 'utf8'), ctx); return { listeners, store, log, fire: (t, e) => (listeners[t] || []).forEach(f => f(e)) };
}
const req = (url, o) => Object.assign({ url, method: 'GET', mode: 'cors' }, o || {});
function fetchEv(E, r) { let resp = null, used = false; const e = { request: r, respondWith: p => { used = true; resp = p; } }; E.fire('fetch', e); return { used, resp }; }
(async () => {
  console.log('=== УСТАНОВКА И АКТИВАЦИЯ ===');
  { const E = env(); let waited; E.fire('install', { waitUntil: p => { waited = p; } }); await waited;
    check('установка: оболочка кэшируется, новый воркер применяется сразу (skipWaiting)', [Object.keys(E.store).length, E.log.skip, Object.keys(E.store['words-shell-v1'] || {}).includes('index.html')], [1, 1, true]);
    E.store['words-shell-v0'] = {}; E.store['words-shell-v0b'] = {}; let w2; E.fire('activate', { waitUntil: p => { w2 = p; } }); await w2;
    check('активация: старые кэши удалены, управление страницами перехвачено сразу (clients.claim)', [E.log.deleted.sort(), Object.keys(E.store), E.log.claim], [['words-shell-v0', 'words-shell-v0b'], ['words-shell-v1'], 1]); }
  { const E = env(); E.store['words-shell-v1'] = {}; E.store['usmle-shell-v4'] = { 'index.html': 'чужой проект' }; E.store['words-shell-v0'] = {}; let w2; E.fire('activate', { waitUntil: p => { w2 = p; } }); await w2;
  check('воркер «Слов» не трогает кэш другого проекта на том же сайте (usmle-shell-v4 цел), чистит только свои старые', [Object.keys(E.store).sort(), E.log.deleted.sort()], [['usmle-shell-v4', 'words-shell-v1'], ['words-shell-v0']]); }
console.log('\n=== ЗАПРОСЫ ===');
  { const E = env(); E.store['words-shell-v1'] = { 'index.html': 'cached-index', 'https://usmle.test/icon-192.png': 'cached-icon' };
    let r = fetchEv(E, req('https://usmle.test/', { mode: 'navigate' })); const res = await r.resp;
    check('страница: сначала сеть (свежая версия), а не кэш', [r.used, res.tag], [true, 'net:https://usmle.test/']);
    const E2 = env({ offline: true }); E2.store['words-shell-v1'] = { 'index.html': 'cached-index' }; r = fetchEv(E2, req('https://usmle.test/?share=x.y', { mode: 'navigate' }));
    check('без сети страница берётся из кэша (в том числе со ссылкой друга ?share=…)', await r.resp, 'cached-index');
    r = fetchEv(E, req('https://usmle.test/version.json?_=123')); check('version.json НЕ перехватывается воркером (идёт напрямую в сеть, не из кэша)', r.used, false);
    r = fetchEv(E, req('https://usmle.test/version.json')); check('и без параметров тоже', r.used, false);
    r = fetchEv(E, req('https://script.google.com/macros/s/ID/exec?k=1')); check('адреса Google и других сайтов не перехватываются', r.used, false);
    r = fetchEv(E, req('https://usmle.test/x', { method: 'POST' })); check('не-GET запросы не перехватываются', r.used, false);
    r = fetchEv(E, req('https://usmle.test/icon-192.png')); check('иконки: сначала кэш', [r.used, await r.resp], [true, 'cached-icon']); }
  console.log('\n=== СООБЩЕНИЯ, УВЕДОМЛЕНИЯ ===');
  { const E = env(); E.fire('message', { data: 'SKIP_WAITING' }); E.fire('message', { data: 'другое' }); check('сообщение SKIP_WAITING применяет воркер сразу; прочие игнорируются', E.log.skip, 1);
    let w; E.fire('push', { data: { json: () => ({ title: 'Через 10 минут: Лекция', body: 'Кардиология', tag: 'ev1', url: './' }) }, waitUntil: p => { w = p; } }); await w;
    check('уведомление показывается с заголовком, текстом и меткой', [E.log.notifs[0][0], E.log.notifs[0][1].body, E.log.notifs[0][1].tag], ['Через 10 минут: Лекция', 'Кардиология', 'ev1']);
    const E3 = env({ clients: [] }); let w3; E3.fire('notificationclick', { notification: { close() { }, data: { url: 'https://evil.test/' } }, waitUntil: p => { w3 = p; } }); await w3;
    check('нажатие на уведомление открывает только страницы своего сайта (чужой адрес заменяется на ./)', E3.log.opened, ['./']); }
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})();
