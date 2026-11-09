const ROOT = require('path').resolve(__dirname, '..');
// Скрипт виджета USMLE (Scriptable) на имитации его API: виды виджетов, запрос, кэш без сети, отказ по ключу.
const fs = require('fs'), vm = require('vm'); let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const SRC = fs.readFileSync((ROOT + '/src/widget_usmle.js'), 'utf8').replace('__API__', 'https://script.google.com/macros/s/ID/exec').replace('__KEY__', 'KEY&=1').replace('__APP__', 'https://samir.github.io/usmle/#u=x&k=KEY');
async function run(family, opt) {
  opt = opt || {}; const files = Object.assign({}, opt.files || {}), log = { texts: [], reqs: [], widget: null, completed: false, ranApp: false };
  class Color { constructor(h, a) { this.hex = h; this.a = a; } static white() { return new Color('#FFFFFF'); } } class LinearGradient { }
  const Font = new Proxy({}, { get: (_, n) => (s) => ({ n, s }) });
  class ListWidget { constructor() { this.items = []; log.widget = this; } addText(t) { const x = { text: t, centerAlignText() { } }; log.texts.push(t); return x; } addSpacer() { } setPadding() { } }
  class Request { constructor(u) { this.url = u; log.reqs.push(u); } async loadJSON() { if (opt.offline) throw new Error('offline'); return opt.reply; } }
  const FileManager = { local: () => ({ joinPath: (a, b) => a + '/' + b, documentsDirectory: () => '/docs', writeString: (p, s) => { files[p] = s; }, readString: p => { if (!(p in files)) throw new Error('нет файла'); return files[p]; } }) };
  const Script = { setWidget: w => { log.set = w; }, complete: () => { log.completed = true; } };
  const ctx = vm.createContext({ Color, LinearGradient, Font, ListWidget, Request, FileManager, Script, config: { widgetFamily: family, runsInWidget: opt.inApp ? false : true }, encodeURIComponent, Date, JSON, Math, String, Promise, console });
  await vm.runInContext('(async () => {' + SRC + '\n})()', ctx); log.files = files; return log;
}
const reply = { ok: true, version: 'v5.2.0', today: '2026-10-12', days: 50, pct: 64, goals: [{ k: 'pages', done: 3, goal: 8 }, { k: 'q', done: 40, goal: 40 }, { k: 'nw', done: 5, goal: 20 }, { k: 'vid', done: 0, goal: 12 }], ready: { now: 0.31, atExam: 0.62, noNbme: true }, streak: 12 };
(async () => {
  console.log('=== ВИДЫ ВИДЖЕТОВ ===');
  for (const fam of ['accessoryInline', 'accessoryCircular', 'accessoryRectangular', 'small', 'medium', 'large']) { const l = await run(fam, { reply }); const all = l.texts.join(' | ');
    check(fam + ': строится, показаны дни до экзамена' + (fam === 'small' || fam === 'accessoryCircular' ? '' : ' и нормы'), [!!l.set, l.completed, all.indexOf('50') > -1, fam === 'small' || fam === 'accessoryCircular' || /64|First Aid|UWorld/.test(all)], [true, true, true, true]); }
  console.log('\n=== ЗАПРОС, КЭШ, ОТКАЗЫ ===');
  { const l = await run('medium', { reply }); const u = new URL(l.reqs[0]);
    check('запрос: адрес сервера, widget=1, ключ закодирован, дата локальная ГГГГ-ММ-ДД; ключ не попал в текст виджета', [u.origin + u.pathname, u.searchParams.get('widget'), u.searchParams.get('k'), /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('d')), l.texts.join('|').indexOf('KEY')], ['https://script.google.com/macros/s/ID/exec', '1', 'KEY&=1', true, -1]);
    check('нажатие открывает приложение; ответ сохранён в кэш; «нормы дня» показаны с процентом и полосой', [l.widget.url, JSON.parse(l.files['/docs/usmle-cache.json']).days, l.texts.some(x => /64%/.test(x))], ['https://samir.github.io/usmle/#u=x&k=KEY', 50, true]); }
  { const files = { '/docs/usmle-cache.json': JSON.stringify(reply) }; const l = await run('accessoryRectangular', { offline: true, files }); check('нет сети — показывается последнее сохранённое', l.texts.join('|').indexOf('50 дн.') > -1, true);
    const l2 = await run('medium', { offline: true }); check('нет сети и нет кэша — «Нет данных», без падения', [l2.texts, l2.completed], [['Нет данных'], true]);
    const l3 = await run('medium', { reply: { ok: false, error: 'AUTH' } }); check('сервер ответил «нет доступа» (ключ сменён) — «Нет данных», без падения', l3.texts, ['Нет данных']);
    const l4 = await run('medium', { reply: Object.assign({}, reply, { days: null, pct: null, goals: [] }) }); check('без даты экзамена и без норм: прочерки вместо «null/undefined», без падения', [l4.texts.some(x => /null|undefined|NaN/.test(x)), l4.texts.includes('—'), l4.completed], [false, true, true]);
    const l5 = await run('medium', { reply: Object.assign({}, reply, { pct: 100, goals: [{ k: 'pages', done: 9, goal: 8 }] }) }); check('нормы выполнены с перевыполнением: без ошибок (полоса не вылезает за 10 клеток)', [l5.texts.some(x => /^█{10} 100%/.test(x)), l5.completed], [true, true]); }
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})();
