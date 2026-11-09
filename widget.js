// Слова — виджет для Scriptable (экран блокировки и «Домой»). Слово меняется каждые N минут, как в приложении.
// Установка: приложение Scriptable → «+» → вставить этот код → назвать «Слова». Затем добавить виджет Scriptable и выбрать этот скрипт.
const API = '__API__', KEY = '__KEY__', APP = '__APP__';
const fm = FileManager.local(), CACHE = fm.joinPath(fm.documentsDirectory(), 'words-cache.json');
const pad = n => String(n).padStart(2, '0');

async function load() {
  const d = new Date(), m = d.getHours() * 60 + d.getMinutes(), day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  try {
    const r = new Request(API + '?widget=1&k=' + encodeURIComponent(KEY) + '&d=' + day + '&m=' + m); r.timeoutInterval = 15;
    const j = await r.loadJSON();
    if (j && j.ok) { fm.writeString(CACHE, JSON.stringify(j)); return j; }
  } catch (e) { /* нет сети — покажем последнее сохранённое */ }
  try { return JSON.parse(fm.readString(CACHE)); } catch (e) { return null; }
}
function hslHex(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = v => pad(Math.round(255 * v).toString(16)); return '#' + x(f(0)) + x(f(8)) + x(f(4));
}
function nextDate(j) { const t = new Date(); t.setHours(0, 0, 0, 0); return new Date(t.getTime() + j.nextAtMin * 60000); }
function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

function build(j, family) {
  const w = new ListWidget(); w.url = APP || ''; w.refreshAfterDate = j && !j.empty ? nextDate(j) : new Date(Date.now() + 15 * 60000);
  const fam = family || 'medium';
  if (!j || j.empty) { const t = w.addText(j ? 'Добавьте слова в приложении' : 'Нет данных'); t.font = Font.semiboldSystemFont(13); return w; }
  const c = j.word, hue = c.hue, light = fam.indexOf('accessory') === 0;
  if (fam === 'accessoryInline') { const t = w.addText(cut(c.word + ' — ' + c.tr, 40)); t.font = Font.semiboldSystemFont(13); return w; }
  if (fam === 'accessoryCircular') { w.addAccessoryWidgetBackground = true; const t = w.addText(cut(c.word, 7)); t.font = Font.boldSystemFont(12); t.centerAlignText(); return w; }
  if (fam === 'accessoryRectangular') {
    const a = w.addText(cut(c.word, 22)); a.font = Font.boldSystemFont(15); const b = w.addText(cut(c.tr, 34)); b.font = Font.semiboldSystemFont(12);
    if (c.exp) { const e = w.addText(cut(c.exp, 60)); e.font = Font.systemFont(10); e.minimumScaleFactor = 0.8; } return w;
  }
  const g = new LinearGradient(); g.colors = [new Color(hslHex(hue, 70, 22)), new Color(hslHex((hue + 30) % 360, 70, 12))]; g.locations = [0, 1]; w.backgroundGradient = g;
  w.setPadding(14, 14, 12, 14);
  const top = w.addText(c.pos ? c.pos + '  ·  ' + j.idx + '/' + j.n : j.idx + '/' + j.n); top.font = Font.mediumSystemFont(11); top.textColor = new Color('#FFFFFF', 0.7);
  w.addSpacer(4);
  const word = w.addText(c.word); word.font = Font.heavySystemFont(fam === 'small' ? 26 : 34); word.textColor = new Color(hslHex(hue, 85, 80)); word.minimumScaleFactor = 0.5; word.lineLimit = 1;
  if (c.ipa && fam !== 'small') { const ip = w.addText(c.ipa); ip.font = Font.systemFont(12); ip.textColor = new Color('#FFFFFF', 0.6); }
  w.addSpacer(4);
  const tr = w.addText(c.tr); tr.font = Font.boldSystemFont(fam === 'small' ? 15 : 19); tr.textColor = Color.white(); tr.minimumScaleFactor = 0.6; tr.lineLimit = fam === 'small' ? 2 : 1;
  if (fam !== 'small') {
    if (c.exp) { w.addSpacer(3); const e = w.addText(cut(c.exp, fam === 'large' ? 220 : 110)); e.font = Font.systemFont(12); e.textColor = new Color('#FFFFFF', 0.82); e.lineLimit = fam === 'large' ? 6 : 2; }
    if (c.ex && fam === 'large') { w.addSpacer(8); const x = w.addText(cut(c.ex, 140)); x.font = Font.italicSystemFont(12); x.textColor = new Color('#FFFFFF', 0.7); }
  }
  w.addSpacer();
  return w;
}
const data = await load(), widget = build(data, config.widgetFamily);
if (config.runsInWidget) Script.setWidget(widget); else { await widget.presentMedium(); }
Script.complete();
