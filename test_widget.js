const ROOT = require('path').resolve(__dirname, '..');
// Скрипт виджета Scriptable на имитации его API: все виды виджетов, обновление по времени, кэш при отсутствии сети, пустой набор.
const fs = require('fs'), vm = require('vm'); let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const SRC = fs.readFileSync((ROOT + '/widget.js'), 'utf8').replace('__API__', 'https://script.google.com/macros/s/ID/exec').replace('__KEY__', 'KEY&=1').replace('__APP__', 'https://samir.github.io/words/?k=KEY');
async function run(family, opt) {
  opt = opt || {}; const files = Object.assign({}, opt.files || {}), log = { texts: [], reqs: [], widget: null, completed: false };
  class Color { constructor(h, a) { this.hex = h; this.a = a; } static white() { return new Color('#FFFFFF'); } }
  class LinearGradient { }
  const Font = new Proxy({}, { get: (_, n) => (s) => ({ n, s }) });
  class ListWidget { constructor() { this.items = []; log.widget = this; } addText(t) { const x = { text: t }; this.items.push(x); log.texts.push(t); x.centerAlignText = () => { }; return x; } addSpacer() { } setPadding() { } }
  class Request { constructor(u) { this.url = u; log.reqs.push(u); } async loadJSON() { if (opt.offline) throw new Error('offline'); return opt.reply; } }
  const FileManager = { local: () => ({ joinPath: (a, b) => a + '/' + b, documentsDirectory: () => '/docs', writeString: (p, s) => { files[p] = s; }, readString: p => { if (!(p in files)) throw new Error('нет файла'); return files[p]; } }) };
  const Script = { setWidget: w => { log.set = w; }, complete: () => { log.completed = true; } };
  const ctx = vm.createContext({ Color, LinearGradient, Font, ListWidget, Request, FileManager, Script, config: { widgetFamily: family, runsInWidget: true }, encodeURIComponent, Date, JSON, Math, String, Promise, console });
  await vm.runInContext('(async () => {' + SRC + '\n})()', ctx); log.files = files; return log;
}
const reply = { ok: true, empty: false, idx: 3, n: 20, cycle: 2, nextAtMin: 9 * 60 + 15, interval: 15, url: 'https://samir.github.io/words/', word: { id: 'w1', word: 'ubiquitous', pos: 'adj.', tr: 'повсеместный', exp: 'встречающийся везде', ex: 'Phones are ubiquitous.', ipa: '/juːˈbɪkwɪtəs/', hue: 70 }, next: { word: 'edema' } };
(async () => {
  console.log('=== ВИДЫ ВИДЖЕТОВ ===');
  for (const fam of ['accessoryInline', 'accessoryCircular', 'accessoryRectangular', 'small', 'medium', 'large']) { const l = await run(fam, { reply }); const all = l.texts.join(' | ');
    check(fam + ': строится без ошибок, показано слово' + (fam === 'accessoryCircular' ? '' : ' и перевод') + ', виджет передан системе', [!!l.set, l.completed, all.indexOf('ubiquitous') > -1 || all.indexOf('ubiqui') > -1, fam === 'accessoryCircular' || all.indexOf('повсеместный') > -1], [true, true, true, true]); }
  console.log('\n=== ЗАПРОС, ОБНОВЛЕНИЕ, ОТСУТСТВИЕ СЕТИ ===');
  { const l = await run('medium', { reply }); const u = new URL(l.reqs[0]);
    check('запрос: адрес сервера, widget=1, ключ закодирован, дата локальная ГГГГ-ММ-ДД, время — минуты от полуночи (0…1439)', [u.origin + u.pathname, u.searchParams.get('widget'), u.searchParams.get('k'), /^\d{4}-\d{2}-\d{2}$/.test(u.searchParams.get('d')), +u.searchParams.get('m') >= 0 && +u.searchParams.get('m') < 1440], ['https://script.google.com/macros/s/ID/exec', '1', 'KEY&=1', true, true]);
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    check('следующее обновление назначено на момент смены слова (09:15 сегодня), нажатие открывает приложение', [l.widget.refreshAfterDate.getTime() === t0.getTime() + (9 * 60 + 15) * 60000, l.widget.url], [true, 'https://samir.github.io/words/?k=KEY']);
    check('успешный ответ сохранён в кэш', JSON.parse(l.files['/docs/words-cache.json']).word.word, 'ubiquitous'); }
  { const files = { '/docs/words-cache.json': JSON.stringify(reply) }; const l = await run('accessoryRectangular', { offline: true, files });
    check('нет сети — показывается последнее сохранённое слово', l.texts.join('|').indexOf('ubiquitous') > -1, true);
    const l2 = await run('medium', { offline: true }); check('нет сети и нет кэша — «Нет данных», без падения', [l2.texts, l2.completed], [['Нет данных'], true]);
    const l3 = await run('medium', { reply: { ok: false, error: 'AUTH' } }); check('сервер ответил «нет доступа» — «Нет данных» (ключ неверный), без падения', l3.texts, ['Нет данных']);
    const l4 = await run('medium', { reply: { ok: true, empty: true, interval: 15 } }); check('слов в наборе нет — понятная подсказка', l4.texts, ['Добавьте слова в приложении']); }
  console.log('\n=== ЦВЕТ ===');
  { const ctx = vm.createContext({ String, Math }); vm.runInContext('const pad = n => String(n).padStart(2, "0");' + SRC.slice(SRC.indexOf('function hslHex'), SRC.indexOf('function nextDate')), ctx);
    check('hslHex даёт корректный #RRGGBB для всех 360 оттенков', (() => { let bad = 0; for (let h = 0; h < 360; h++) for (const [s, l] of [[70, 22], [70, 12], [85, 80]]) { const x = vm.runInContext(`hslHex(${h},${s},${l})`, ctx); if (!/^#[0-9a-f]{6}$/.test(x)) bad++; } return bad; })(), 0);
    check('известные значения: красный hsl(0,100,50)=#ff0000, зелёный hsl(120,100,50)=#00ff00, синий hsl(240,100,50)=#0000ff, серый hsl(0,0,50)=#808080', ['hslHex(0,100,50)', 'hslHex(120,100,50)', 'hslHex(240,100,50)', 'hslHex(0,0,50)'].map(e => vm.runInContext(e, ctx)), ['#ff0000', '#00ff00', '#0000ff', '#808080']); }
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})();
