const ROOT = require('path').resolve(__dirname, '..');
// Браузерный стенд: Chromium + страница приложения (адрес https://app.test/), google.script.run → серверные функции из Node
const FS = require('fs');
const chromium = require('@sparticuz/chromium').default || require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');
const CHART = FS.readFileSync(require('path').join(require('path').dirname(require.resolve('chart.js')), 'chart.umd.js'), 'utf8');
async function launch() { return puppeteer.launch({ args: [...chromium.args, '--no-sandbox'], executablePath: await chromium.executablePath(), headless: 'shell' }); }
const PROXY = `(function(){ function mk(ok, fail){ return new Proxy({}, { get: function(_, name){ if (name === 'withSuccessHandler') return function(f){ return mk(f, fail); }; if (name === 'withFailureHandler') return function(f){ return mk(ok, f); }; if (name === 'withUserObject') return function(){ return mk(ok, fail); };
  return function(){ var a = Array.prototype.slice.call(arguments); window.__srv(String(name), a).then(function(r){ if (r.err) { if (fail) fail(new Error(r.err)); } else if (ok) ok(r.ok); }); }; } }); } window.google = { script: { run: mk(null, null) } }; })();`;
/** o: { init, env, key, wait, w, h, desktop, theme, lang, font, now (ISO), errors:[], index (путь) } */
async function openPage(browser, o) {
  o = o || {}; const page = await browser.newPage();
  if (o.desktop) await page.setViewport({ width: 1279, height: 800, deviceScaleFactor: 1 }); else await page.setViewport({ width: o.w || 393, height: o.h || 852, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (o.errors) { page.on('pageerror', e => o.errors.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) o.errors.push('console: ' + m.text()); }); }
  await page.exposeFunction('__srv', async (name, args) => { if (o.calls) o.calls.push({ name, t: Date.now() }); if (o.delay && (o.delayFns || ['getAll']).indexOf(name) > -1) await new Promise(r => setTimeout(r, o.delay)); if (o.fail && o.fail.indexOf(name) > -1) return { err: 'E_FAIL' }; try { if (typeof global[name] !== 'function') return { err: 'E_NOFUNC ' + name }; const res = global[name].apply(null, args); return { ok: JSON.parse(JSON.stringify(res === undefined ? null : res)) }; } catch (e) { return { err: String(e && e.message || e) }; } });
  const html = (o.html || FS.readFileSync(o.index || (ROOT + '/src/Index.html'), 'utf8')).replace(/<\?!= viewKeyJs \?>/g, JSON.stringify(o.key || 'K')).replace(/<\?!= envJs \?>/g, JSON.stringify(o.env || {})).replace(/<\?!= initJs \?>/g, o.init ? JSON.stringify(o.init).replace(/</g, '\\u003c') : 'null');
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (o.reqLog) o.reqLog.push(u);
    if (u === 'https://app.test/' || u === 'https://app.test') r.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
    else if (/chart\.umd(\.min)?\.js/.test(u)) { const send = () => r.respond({ status: 200, contentType: 'application/javascript', headers: { 'Cache-Control': 'no-store' }, body: CHART }); if (o.chartDelay) setTimeout(send, o.chartDelay); else send(); }
    else if (/^https:\/\/app\.test\//.test(u)) r.respond({ status: 200, contentType: 'text/plain', body: '' });
    else r.abort(); });
  await page.evaluateOnNewDocument(PROXY);
  if (o.now) await page.evaluateOnNewDocument(`(function(){ var R = Date, base = new R(${JSON.stringify(o.now)}).getTime(), t0 = R.now(); function D(a,b,c,d,e,f,g){ if (!(this instanceof D)) return new R(base + (R.now() - t0)).toString(); return arguments.length ? new (Function.prototype.bind.apply(R, [null].concat([].slice.call(arguments))))() : new R(base + (R.now() - t0)); } D.prototype = R.prototype; D.now = function(){ return base + (R.now() - t0); }; D.UTC = R.UTC; D.parse = R.parse; window.Date = D; })();`);
  if (o.raf) await page.evaluateOnNewDocument(`(function(){ window.requestAnimationFrame = function (f) { return setTimeout(function () { f(performance.now()); }, 16); }; window.cancelAnimationFrame = function (id) { clearTimeout(id); }; })();`);   // ровные 60 кадров/с: безголовый Chromium без GPU выдаёт кадры нерегулярно
  await page.evaluateOnNewDocument((th, lg, ft, ls) => { try { if (th) localStorage.setItem('trf_theme', th); if (lg) localStorage.setItem('trf_lang', lg); if (ft) localStorage.setItem('trf_font', ft); var L = JSON.parse(ls || '{}'); Object.keys(L).forEach(function (k) { if (L[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, L[k]); }); } catch (e) { } var iv = setInterval(function () { if (window.D && !window.__tD) window.__tD = performance.now(); if (window.CH && Object.keys(window.CH).length && !window.__tCH) { window.__tCH = performance.now(); } if (window.__tD && window.__tCH) clearInterval(iv); }, 4); }, o.theme || '', o.lang || '', o.font || '', JSON.stringify(o.ls || {}));
  await page.goto('https://app.test/', { waitUntil: 'load' }); await new Promise(r => setTimeout(r, o.wait === undefined ? 1000 : o.wait)); return page;
}
module.exports = { launch, openPage, FS };
