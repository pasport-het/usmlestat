const { loadServer, fresh } = require('./h.js'); global.fresh = fresh; loadServer(); const seedRich = require('./seed_rich.js'); const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms)); const T = '2026-11-05';
const OUT = process.argv[2] || 'before'; const PAGES = (process.argv[3] || 'map,fa,uw,nbme,anki,set,plan,cov,video,lib').split(','); const THEMES = (process.argv[4] || 'light').split(',');
(async () => {
  global.SERVER_TODAY_FORCE_ = T; seedRich(T); const b = await S.launch(); const errs = [];
  for (const theme of THEMES) for (const pg of PAGES) { const p = await S.openPage(b, { raf: true, init: getAll(T), wait: 2300, w: 393, h: 4200, errors: errs, theme, lang: 'ru', now: T + 'T10:00:00Z', key: getSettings().api_key });
    await p.evaluate(pg => goto(pg), pg); await sleep(1700); const hgt = await p.evaluate(() => { const m = document.querySelector('.main'); return Math.min(4200, Math.ceil(m.scrollHeight + 120)); });
    await p.screenshot({ path: `/tmp/shots/${OUT}_${theme}_${pg}.png`, clip: { x: 0, y: 0, width: 393, height: hgt } }); await p.close(); }
  await b.close(); console.log('ошибки:', errs.length ? errs.slice(0, 3) : 'нет');
})();
