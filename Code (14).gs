/* =====================================================================================================
   СЛОВА — проект 2. Сервер на Google Apps Script. Таблица: Words, Day, Log, Settings.
   Каждый день набор из N слов (по умолчанию 20), слово меняется каждые M минут (по умолчанию 15) по кругу — в приложении и в виджете.
   ===================================================================================================== */
const VERSION = 'w1.0.0';
const SH = { W: 'Words', DAY: 'Day', LOG: 'Log', SET: 'Settings' };
const WH = ['id', 'word', 'pos', 'tr', 'exp', 'ex', 'ipa', 'added', 'status', 'due', 'ivl', 'ease', 'reps', 'lapses', 'seen', 'first', 'graded'];
const MAX_WORDS = 5000, KEEP_DAYS = 90;
let ENSURED_ = false, TODAY_OVERRIDE_ = null;

function fail_(c) { throw new Error('E_' + c); }
function n_(v) { const x = Number(v); return isFinite(x) ? x : 0; }
function str_(v) { return v == null ? '' : String(v); }
function clean_(v, max) { return str_(v).replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max); }
function isDate_(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; }
function utc_(s) { const p = s.split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
function addDays_(s, n) { return new Date(utc_(s) + n * 86400000).toISOString().slice(0, 10); }
function daysBetween_(a, b) { return Math.round((utc_(b) - utc_(a)) / 86400000); }
function serverToday_() { if (typeof SERVER_TODAY_FORCE_ !== 'undefined' && SERVER_TODAY_FORCE_) return SERVER_TODAY_FORCE_; return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function setToday_(s) { TODAY_OVERRIDE_ = null; if (isDate_(s) && Math.abs(daysBetween_(serverToday_(), s)) <= 1) TODAY_OVERRIDE_ = s; }   // дату клиента берём, только если она в пределах суток от часов сервера
function todayStr_() { return TODAY_OVERRIDE_ || serverToday_(); }
function d_(v) { if (!v) return ''; if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return str_(v).trim().slice(0, 10); }
function safeEq_(a, b) { a = str_(a); b = str_(b); let d = a.length ^ b.length; const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return d === 0; }
function hash32_(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hue_(word) { return hash32_(String(word).toLowerCase()) % 360; }       // постоянный цвет слова для зрительной памяти
function newId_() { return 'w' + Utilities.getUuid().replace(/-/g, '').slice(0, 11); }
function tmin_(hhmm) { const m = /^(\d{1,2}):(\d{2})$/.exec(str_(hhmm)); return m ? (+m[1]) * 60 + (+m[2]) : -1; }
function withLock_(f) { const lock = LockService.getScriptLock(); lock.waitLock(20000); try { return f(); } finally { lock.releaseLock(); } }

/* ---------- таблицы и настройки ---------- */
const SET_DEFAULTS = { interval: '15', daily: '20', reviews: '6', start: '08:00', end: '22:00', theme: 'auto', reveal: 'now', site_url: '', api_key: '' };
function ensureAll_() {
  if (ENSURED_) return; const ss = SpreadsheetApp.getActive();
  [[SH.W, WH], [SH.DAY, ['date', 'ids']], [SH.LOG, ['date', 'id', 'grade']], [SH.SET, ['key', 'value']]].forEach(p => {
    let sh = ss.getSheetByName(p[0]); if (!sh) sh = ss.insertSheet(p[0]);
    if (sh.getLastRow() < 1) { sh.getRange(1, 1, 1, p[1].length).setValues([p[1]]).setFontWeight('bold'); sh.setFrozenRows(1); }
  });
  ENSURED_ = true;
  if (!getSettings_().api_key) setSettingRaw_('api_key', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 40));
}
function getSettings_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SET), out = Object.assign({}, SET_DEFAULTS);
  if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(r => { const k = str_(r[0]).trim(); if (k) out[k] = str_(r[1]); });
  return out;
}
function setSettingRaw_(k, v) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SET), last = sh.getLastRow();
  const vals = last >= 2 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
  for (let i = 0; i < vals.length; i++) if (str_(vals[i][0]).trim() === k) { const c = sh.getRange(i + 2, 2); c.setNumberFormat('@'); c.setValue(str_(v)); return; }
  const r = sh.getLastRow() + 1; const rg = sh.getRange(r, 1, 1, 2); rg.setNumberFormat('@'); rg.setValues([[k, str_(v)]]);
}
function needAuth_(o) { if (typeof AUTH_OFF_ !== 'undefined' && AUTH_OFF_) return; const key = str_(getSettings_().api_key); if (!key || !safeEq_(str_(o && o.k), key)) fail_('AUTH'); }
function pubSettings_(S) { return { interval: n_(S.interval), daily: n_(S.daily), reviews: n_(S.reviews), start: S.start, end: S.end, theme: ['auto', 'light', 'dark'].indexOf(S.theme) > -1 ? S.theme : 'auto', reveal: S.reveal === 'tap' ? 'tap' : 'now', site_url: S.site_url, api_key: S.api_key }; }

/* ---------- слова ---------- */
function toRow_(w) { return [w.id, w.word, w.pos, w.tr, w.exp, w.ex, w.ipa, w.added, w.status, w.due, w.ivl, w.ease, w.reps, w.lapses, w.seen, w.first, w.graded]; }
function readWords_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.W), last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, WH.length).getValues().map((r, i) => ({ row: i + 2, id: str_(r[0]), word: str_(r[1]), pos: str_(r[2]), tr: str_(r[3]), exp: str_(r[4]), ex: str_(r[5]), ipa: str_(r[6]), added: d_(r[7]),
    status: ['new', 'learning', 'known'].indexOf(str_(r[8])) > -1 ? str_(r[8]) : 'new', due: d_(r[9]), ivl: n_(r[10]), ease: n_(r[11]) || 2.5, reps: n_(r[12]), lapses: n_(r[13]), seen: n_(r[14]), first: d_(r[15]), graded: d_(r[16]) })).filter(w => w.id && w.word);
}
function writeWord_(w) { const rg = SpreadsheetApp.getActive().getSheetByName(SH.W).getRange(w.row, 1, 1, WH.length); rg.setNumberFormat('@'); rg.setValues([toRow_(w)]); }
function pubWord_(w) { return { id: w.id, word: w.word, pos: w.pos, tr: w.tr, exp: w.exp, ex: w.ex, ipa: w.ipa, status: w.status, due: w.due, ivl: w.ivl, reps: w.reps, lapses: w.lapses, seen: w.seen, graded: w.graded, added: w.added, hue: hue_(w.word) }; }

function wImport(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const rows = o && Array.isArray(o.rows) ? o.rows : fail_('ROWS'); if (!rows.length || rows.length > 300) fail_('ROWS');
  withLock_(() => {
    const words = readWords_(), byKey = {}; words.forEach(w => { byKey[w.word.toLowerCase()] = w; });
    const fresh = [], changed = {};
    rows.forEach(r => {
      const word = clean_(r && r.w, 80); if (!word || !/[A-Za-z\u00C0-\u024F]/.test(word)) return;
      const vals = { tr: clean_(r.tr, 300), exp: clean_(r.exp, 600), ex: clean_(r.ex, 400), pos: clean_(r.pos, 20), ipa: clean_(r.ipa, 40) }, cur = byKey[word.toLowerCase()];
      if (cur) { let ch = false; Object.keys(vals).forEach(f => { if (vals[f] && cur[f] !== vals[f]) { cur[f] = vals[f]; ch = true; } }); if (ch && cur.row) changed[cur.id] = cur; return; }
      if (words.length + fresh.length >= MAX_WORDS) fail_('LIMIT');
      const w = Object.assign({ id: newId_(), word: word, added: todayStr_(), status: 'new', due: '', ivl: 0, ease: 2.5, reps: 0, lapses: 0, seen: 0, first: '', graded: '' }, vals); byKey[word.toLowerCase()] = w; fresh.push(w);
    });
    Object.keys(changed).forEach(id => writeWord_(changed[id]));
    if (fresh.length) { const sh = SpreadsheetApp.getActive().getSheetByName(SH.W), r0 = sh.getLastRow() + 1, rg = sh.getRange(r0, 1, fresh.length, WH.length); rg.setNumberFormat('@'); rg.setValues(fresh.map(toRow_)); }
    SERVER_LAST_IMPORT_ = { added: fresh.length, updated: Object.keys(changed).length };
  });
  return wBuild_();
}
var SERVER_LAST_IMPORT_ = null;
function wEdit(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  withLock_(() => {
    const words = readWords_(), w = words.find(x => x.id === o.id); if (!w) fail_('STALE');
    if (o.word !== undefined) { const nw = clean_(o.word, 80); if (!nw || !/[A-Za-z\u00C0-\u024F]/.test(nw)) fail_('WORD'); if (words.some(x => x.id !== w.id && x.word.toLowerCase() === nw.toLowerCase())) fail_('DUP'); w.word = nw; }
    [['tr', 300], ['exp', 600], ['ex', 400], ['pos', 20], ['ipa', 40]].forEach(p => { if (o[p[0]] !== undefined) w[p[0]] = clean_(o[p[0]], p[1]); });
    writeWord_(w);
  });
  return wBuild_();
}
function wDelete(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  withLock_(() => {
    const w = readWords_().find(x => x.id === o.id); if (!w) fail_('STALE');
    SpreadsheetApp.getActive().getSheetByName(SH.W).deleteRow(w.row);
    const day = readDay_().find(x => x.date === todayStr_()); if (day && day.ids.indexOf(w.id) > -1) writeDay_(day.date, day.ids.filter(i => i !== w.id), day.row);
  });
  return wBuild_();
}

/* ---------- повторение (схема SM-2: Снова / Трудно / Хорошо / Легко) ---------- */
function intervals_(w) {
  const ease = w.ease || 2.5, ivl = w.ivl || 0, reps = w.reps || 0, CAP = 3650;
  const hard = Math.max(1, Math.round(Math.max(ivl, 1) * 1.2));
  let good = reps === 0 ? 1 : (reps === 1 ? 3 : Math.max(ivl + 1, Math.round(ivl * ease)));
  good = Math.max(good, reps >= 1 ? hard + 1 : hard);
  let easy = reps === 0 ? 4 : Math.max(ivl + 2, Math.round(ivl * Math.min(3.5, ease + 0.15) * 1.3)); easy = Math.max(easy, good + 1);
  return [0, Math.min(CAP, hard), Math.min(CAP, good), Math.min(CAP, easy)];
}
function applyGrade_(w, g, today) {
  const ivl = intervals_(w)[g - 1], r2 = x => Math.round(x * 100) / 100;
  if (g === 1) { w.lapses += 1; w.reps = 0; w.ease = Math.max(1.3, w.ease - 0.2); }
  else if (g === 2) { w.ease = Math.max(1.3, w.ease - 0.15); w.reps += 1; }
  else if (g === 3) { w.reps += 1; }
  else { w.ease = Math.min(3.5, w.ease + 0.15); w.reps += 1; }
  w.ease = r2(w.ease); w.ivl = ivl; w.due = addDays_(today, ivl); w.status = ivl >= 21 ? 'known' : 'learning'; w.seen += 1; w.graded = today; if (!w.first) w.first = today;
}
function wGrade(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const g = Number(o && o.grade); if (!(g >= 1 && g <= 4 && Math.floor(g) === g)) fail_('GRADE');
  let w = null;
  withLock_(() => {
    w = readWords_().find(x => x.id === o.id); if (!w) fail_('STALE');
    applyGrade_(w, g, todayStr_()); writeWord_(w);
    const sh = SpreadsheetApp.getActive().getSheetByName(SH.LOG), r = sh.getLastRow() + 1, rg = sh.getRange(r, 1, 1, 3); rg.setNumberFormat('@'); rg.setValues([[todayStr_(), w.id, String(g)]]);
  });
  const today = todayStr_(), day = ensureDay_();                                // лёгкий ответ: только изменённое слово, прогресс дня и статистика
  return { word: pubWord_(w), progress: dayProgress_(day, today), stats: stats_(readWords_(), readLog_(), today) };
}

/* ---------- набор на день ---------- */
function readDay_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.DAY), last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 2).getValues().map((r, i) => ({ row: i + 2, date: d_(r[0]), ids: str_(r[1]).split(',').filter(Boolean) })).filter(x => x.date);
}
function writeDay_(date, ids, row) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.DAY), r = row || sh.getLastRow() + 1, rg = sh.getRange(r, 1, 1, 2); rg.setNumberFormat('@'); rg.setValues([[date, ids.join(',')]]);
}
/** Набор на сегодня: сначала слова на повторение (не больше «reviews»), остальное — новые слова по порядку добавления; порядок внутри дня перемешан, но одинаков при каждом открытии.
 *  Если в наборе меньше слов, чем «daily», а новые слова с переводом появились позже (импорт днём), они дописываются в КОНЕЦ — уже показанные слова не сдвигаются. */
function ensureDay_() {
  const today = todayStr_(), S0 = getSettings_(), total0 = Math.max(1, n_(S0.daily)), cur0 = readDay_().find(x => x.date === today);
  if (cur0 && cur0.ids.length >= total0) return cur0;
  return withLock_(() => {
    const S = getSettings_(), total = Math.max(1, n_(S.daily)), maxRev = Math.max(0, Math.min(total, n_(S.reviews))), cur = readDay_().find(x => x.date === today), words = readWords_().filter(w => w.tr);
    if (cur) {
      const have = {}; cur.ids.forEach(id => { have[id] = true; });
      const fresh = words.filter(w => w.status === 'new' && !have[w.id]).slice(0, total - cur.ids.length);
      if (!fresh.length) return cur;
      fresh.forEach(w => { w.status = 'learning'; w.first = today; w.due = addDays_(today, 1); w.reps = 0; writeWord_(w); });
      const ids = cur.ids.concat(fresh.map(w => w.id).sort((a, b) => hash32_(today + a) - hash32_(today + b))); writeDay_(today, ids, cur.row);
      return { row: cur.row, date: today, ids: ids };
    }
    const due = words.filter(w => w.status !== 'new' && w.due && w.due <= today).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : b.lapses - a.lapses));
    const pickRev = due.slice(0, maxRev), fresh = words.filter(w => w.status === 'new').slice(0, total - pickRev.length);
    let chosen = pickRev.concat(fresh);
    if (chosen.length < total) {                                                   // новых мало: добираем повторениями (сначала просроченные, затем ближайшие по сроку)
      const have = {}; chosen.forEach(w => { have[w.id] = true; });
      const more = words.filter(w => w.status !== 'new' && !have[w.id]).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
      chosen = chosen.concat(more.slice(0, total - chosen.length));
    }
    fresh.forEach(w => { w.status = 'learning'; w.first = today; w.due = addDays_(today, 1); w.reps = 0; writeWord_(w); });
    const ids = chosen.map(w => w.id).sort((a, b) => hash32_(today + a) - hash32_(today + b));
    const sh = SpreadsheetApp.getActive().getSheetByName(SH.DAY), rowNo = sh.getLastRow() + 1; writeDay_(today, ids, rowNo);
    readDay_().filter(x => daysBetween_(x.date, today) > KEEP_DAYS).sort((a, b) => b.row - a.row).forEach(x => sh.deleteRow(x.row));
    return { row: rowNo, date: today, ids: ids };
  });
}
/** Какое слово сейчас: окно [start, end), шаг interval минут, номер слова = слот по кругу из n слов. */
function slot_(S, n, nowMin) {
  const start = tmin_(S.start), end = tmin_(S.end), iv = Math.max(1, n_(S.interval)), slots = Math.max(1, Math.ceil((end - start) / iv));
  let slot, next;
  if (nowMin < start) { slot = 0; next = start; } else if (nowMin >= end) { slot = slots - 1; next = 1440 + start; } else { slot = Math.floor((nowMin - start) / iv); next = Math.min(end, start + (slot + 1) * iv); }
  return { slot: slot, slots: slots, idx: n ? slot % n : 0, cycle: n ? Math.floor(slot / n) : 0, next: next, interval: iv };
}
function dayProgress_(day, today) {
  const log = readLog_(), ids = {}; log.forEach(l => { if (l.date === today) ids[l.id] = true; });
  return { total: day.ids.length, graded: day.ids.filter(id => ids[id]).length };
}
function readLog_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.LOG), last = sh.getLastRow(); if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 3).getValues().map(r => ({ date: d_(r[0]), id: str_(r[1]), grade: n_(r[2]) })).filter(x => x.date);
}
function stats_(words, log, today) {
  const by = { new: 0, learning: 0, known: 0 }; words.forEach(w => { by[w.status]++; });
  const perDay = {}; log.forEach(l => { perDay[l.date] = (perDay[l.date] || 0) + 1; });
  const last14 = []; for (let k = 13; k >= 0; k--) { const d = addDays_(today, -k); last14.push({ d: d, n: perDay[d] || 0 }); }
  let streak = 0, d = perDay[today] ? today : addDays_(today, -1); while (perDay[d]) { streak++; d = addDays_(d, -1); }
  const dueNow = words.filter(w => w.status !== 'new' && w.tr && w.due && w.due <= today).length;
  return { total: words.length, withTr: words.filter(w => w.tr).length, noTr: words.filter(w => !w.tr).length, byStatus: by, gradedToday: perDay[today] || 0, streak: streak, last14: last14, dueNow: dueNow };
}
function wBuild_() {
  const today = todayStr_(), S = getSettings_(), day = ensureDay_(), words = readWords_(), log = readLog_(), pub = pubSettings_(S);
  return { version: VERSION, today: today, settings: pub, exec: ScriptApp.getService().getUrl() || '', words: words.map(pubWord_), day: { date: day.date, ids: day.ids.filter(id => words.some(w => w.id === id)) },
    progress: dayProgress_({ ids: day.ids }, today), stats: stats_(words, log, today), lastImport: SERVER_LAST_IMPORT_ };
}
function wGetAll(o) { needAuth_(o); setToday_(o && o.today); ensureAll_(); SERVER_LAST_IMPORT_ = null; return wBuild_(); }
function wSetSettings(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const S = getSettings_(), ch = {}, int = (v, lo, hi) => { const x = Number(v); if (!(isFinite(x) && Math.floor(x) === x && x >= lo && x <= hi)) fail_('SETTING'); return String(x); };
  if (o.interval !== undefined) ch.interval = int(o.interval, 1, 240); if (o.daily !== undefined) ch.daily = int(o.daily, 1, 100); if (o.reviews !== undefined) ch.reviews = int(o.reviews, 0, 100);
  if (o.start !== undefined) { if (tmin_(o.start) < 0 || tmin_(o.start) > 1439) fail_('SETTING'); ch.start = String(o.start).padStart(5, '0'); }
  if (o.end !== undefined) { if (tmin_(o.end) < 1 || tmin_(o.end) > 1440) fail_('SETTING'); ch.end = String(o.end).padStart(5, '0'); }
  if (o.theme !== undefined) { if (['auto', 'light', 'dark'].indexOf(o.theme) < 0) fail_('SETTING'); ch.theme = o.theme; }
  if (o.reveal !== undefined) { if (['now', 'tap'].indexOf(o.reveal) < 0) fail_('SETTING'); ch.reveal = o.reveal; }
  if (o.site_url !== undefined) { const u = str_(o.site_url).trim(); if (u && !/^https:\/\/[A-Za-z0-9.\-]+(\/[\w\-./%]*)?$/.test(u)) fail_('SETTING'); ch.site_url = u; }
  const M = Object.assign({}, S, ch); if (tmin_(M.end) - tmin_(M.start) < n_(M.interval)) fail_('SETTING'); if (n_(M.reviews) > n_(M.daily)) fail_('SETTING');
  Object.keys(ch).forEach(k => setSettingRaw_(k, ch[k]));
  return wBuild_();
}

/* ---------- виджет: текущее слово по времени ---------- */
function widgetData_(today, nowMin) {
  const S = getSettings_(), day = ensureDay_(), byId = {}; readWords_().forEach(w => { byId[w.id] = w; });
  const list = day.ids.map(id => byId[id]).filter(Boolean);
  if (!list.length) return { ok: true, empty: true, interval: n_(S.interval), url: S.site_url };
  const s = slot_(S, list.length, nowMin), w = list[s.idx], nx = list[(s.idx + 1) % list.length];
  const p = x => ({ id: x.id, word: x.word, pos: x.pos, tr: x.tr, exp: x.exp, ex: x.ex, ipa: x.ipa, hue: hue_(x.word) });
  return { ok: true, empty: false, word: p(w), next: p(nx), idx: s.idx + 1, n: list.length, cycle: s.cycle + 1, nextAtMin: s.next, nowMin: nowMin, interval: s.interval, today: today, url: S.site_url };
}
const JSON_ = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
function deniedPage_() { return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:420px;margin:18vh auto;padding:0 24px;text-align:center;color:#394357"><h2>Доступ закрыт</h2><p style="color:#667085;line-height:1.6">Откройте приложение по своей ссылке с ключом (в таблице: меню «Слова → Показать ссылку и ключ»).</p></div>'); }
function doGet(e) {
  ensureAll_(); const q = (e && e.parameter) || {};
  if (q.widget) {                                                             // JSON для виджета Scriptable: ?widget=1&k=КЛЮЧ&d=ГГГГ-ММ-ДД&m=минуты_от_полуночи
    try { needAuth_({ k: q.k }); } catch (err) { return JSON_({ ok: false, error: 'AUTH' }); }
    setToday_(q.d); const m = Number(q.m); if (!(isFinite(m) && Math.floor(m) === m && m >= 0 && m < 1440)) return JSON_({ ok: false, error: 'TIME' });
    return JSON_(widgetData_(todayStr_(), m));
  }
  const key = str_(getSettings_().api_key);
  if (!safeEq_(str_(q.k), key)) return deniedPage_();
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.viewKeyJs = JSON.stringify(key).replace(/</g, '\\u003c'); tpl.envJs = JSON.stringify({ emb: q.emb === '1', standalone: q.env === 'standalone', ios: q.ios === '1' }).replace(/</g, '\\u003c');
  tpl.initJs = 'null';                                                       // данные приложение запросит само (вместе со своей датой)
  return tpl.evaluate().setTitle('Слова').addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function onOpen() { try { SpreadsheetApp.getUi().createMenu('Слова').addItem('Показать ссылку и ключ', 'showUrl').addToUi(); } catch (e) { } }
function showUrl() { ensureAll_(); const url = ScriptApp.getService().getUrl(), key = getSettings_().api_key; SpreadsheetApp.getUi().alert('Ссылка для приложения:\n' + url + '?k=' + key + '\n\nКлюч (для виджета):\n' + key); }
