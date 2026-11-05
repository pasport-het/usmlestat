// USMLE Progress — виджет для Scriptable (экран блокировки и «Домой»): дни до экзамена, выполнение норм дня.
// Установка: Scriptable → «+» → вставить код → назвать «USMLE». Затем добавить виджет Scriptable и выбрать этот скрипт.
const API = '__API__', KEY = '__KEY__', APP = '__APP__';
const fm = FileManager.local(), CACHE = fm.joinPath(fm.documentsDirectory(), 'usmle-cache.json');
const pad = n => String(n).padStart(2, '0');
const NAMES = { pages: 'First Aid', q: 'UWorld', nw: 'Anki new', vid: 'Видео' };

async function load() {
  const d = new Date(), day = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  try {
    const r = new Request(API + '?widget=1&k=' + encodeURIComponent(KEY) + '&d=' + day); r.timeoutInterval = 20;
    const j = await r.loadJSON();
    if (j && j.ok) { fm.writeString(CACHE, JSON.stringify(j)); return j; }
  } catch (e) { /* нет сети — покажем последнее сохранённое */ }
  try { return JSON.parse(fm.readString(CACHE)); } catch (e) { return null; }
}
function bar(p, n) { const k = Math.max(0, Math.min(n, Math.round(p * n))); return '█'.repeat(k) + '░'.repeat(n - k); }
function cut(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function goalLine(g) { return NAMES[g.k] + ' ' + g.done + '/' + g.goal; }

function build(j, fam) {
  const w = new ListWidget(); w.url = APP || ''; w.refreshAfterDate = new Date(Date.now() + 15 * 60000); fam = fam || 'medium';
  if (!j) { const t = w.addText('Нет данных'); t.font = Font.semiboldSystemFont(13); return w; }
  const days = j.days == null ? '—' : String(j.days), pct = j.pct == null ? null : j.pct;
  if (fam === 'accessoryInline') { const t = w.addText(days + ' дн · нормы ' + (pct == null ? '—' : pct + '%')); t.font = Font.semiboldSystemFont(13); return w; }
  if (fam === 'accessoryCircular') { w.addAccessoryWidgetBackground = true; const t = w.addText(days); t.font = Font.boldSystemFont(20); t.centerAlignText(); const s = w.addText('дн.'); s.font = Font.systemFont(9); s.centerAlignText(); return w; }
  if (fam === 'accessoryRectangular') {
    const a = w.addText(days + ' дн. до экзамена'); a.font = Font.boldSystemFont(14); const b = w.addText('Нормы дня: ' + (pct == null ? '—' : pct + '%')); b.font = Font.semiboldSystemFont(12);
    if (j.goals && j.goals.length) { const c = w.addText(cut(j.goals.slice(0, 2).map(goalLine).join(' · '), 36)); c.font = Font.systemFont(10); } return w;
  }
  const g = new LinearGradient(); g.colors = [new Color('#1E3A8A'), new Color('#0B1226')]; g.locations = [0, 1]; w.backgroundGradient = g; w.setPadding(14, 14, 12, 14);
  const top = w.addText('USMLE'); top.font = Font.mediumSystemFont(11); top.textColor = new Color('#FFFFFF', 0.7);
  const big = w.addText(days); big.font = Font.heavySystemFont(fam === 'small' ? 40 : 46); big.textColor = Color.white();
  const cap = w.addText('дней до экзамена'); cap.font = Font.mediumSystemFont(12); cap.textColor = new Color('#FFFFFF', 0.75); w.addSpacer(6);
  if (pct != null) { const p = w.addText(bar(pct / 100, 10) + ' ' + pct + '%'); p.font = Font.semiboldSystemFont(12); p.textColor = pct >= 100 ? new Color('#4ADE80') : Color.white(); }
  if (fam !== 'small' && j.goals) j.goals.slice(0, fam === 'large' ? 4 : 2).forEach(x => { w.addSpacer(2); const l = w.addText(goalLine(x)); l.font = Font.systemFont(12); l.textColor = new Color('#FFFFFF', x.done >= x.goal ? 1 : 0.75); });
  w.addSpacer(); return w;
}
const data = await load(), widget = build(data, config.widgetFamily);
if (config.runsInWidget) Script.setWidget(widget); else { await widget.presentMedium(); }
Script.complete();
