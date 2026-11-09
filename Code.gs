/**
 * USMLE Progress v4 — серверная часть (Google Apps Script Web App)
 *
 * Установка:
 *   1) Пустая Google-таблица → Extensions → Apps Script.
 *   2) Code.gs (этот файл) + HTML-файл с именем Index.
 *   3) Один раз запусти функцию authorize_ (Run) и разреши доступ — нужен для YouTube.
 *   4) Deploy → New deployment → Web app → Execute as: Me → Who has access: ANYONE
 *      (иначе Anki не сможет присылать данные; сайт защищён секретным ключом из листа Sozlamalar).
 *   5) Ссылку для открытия бери в меню таблицы: «📈 USMLE Progress → Открыть отчёт».
 * Все листы и заголовки создаются автоматически.
 */

const VERSION = 'v5.4.0';

const SH = {
  SET: 'Sozlamalar', FA: 'FirstAid', LOG: 'Kunlik', UW: 'UWorld', NBME: 'NBME',
  ANKI: 'Anki', ADAY: 'AnkiDay', ATOP: 'AnkiTopics', AMETA: 'AnkiMeta',
  PL: 'Playlists', VID: 'Videos', FLAG: 'Flags', NOTE: 'Notes', CARD: 'Cards',
  ERR: 'Errors', PLAN: 'Planner', DNOTE: 'DayNotes', HAB: 'Habits', HLOG: 'HabitLog', PUSH: 'Push', FOC: 'Focus', UWE: 'UWErrors', COV: 'Coverage'
};

const SYSTEMS = [
  'Biochemistry', 'Immunology', 'Microbiology', 'General Pathology',
  'General Pharmacology', 'Public Health Sciences', 'Cardiovascular',
  'Endocrine', 'Gastrointestinal', 'Hematology & Oncology',
  'Musculoskeletal & Skin', 'Neurology & Special Senses', 'Psychiatry',
  'Renal', 'Reproductive', 'Respiratory'
];

const FA_PAGES = {
  'Biochemistry': 62, 'Immunology': 28, 'Microbiology': 82,
  'General Pathology': 26, 'General Pharmacology': 28,
  'Public Health Sciences': 28, 'Cardiovascular': 46
};

const ANKI_HEAD = ['Дата', 'Область', 'Всего', 'Пройдено', 'Осталось', 'Скрыто',
  'Темп/день', 'Проблемных', 'Сред. сек', 'Карточек сегодня',
  'Повторений сегодня', 'Минут сегодня', 'Повторений 7д', 'Минут 7д',
  'Удержание %', 'Серия дней', 'Зрелых', 'Молодых', 'К повтору завтра', 'Сек/отзыв',
  'Новых (синие)', 'Учится (красные)', 'К повтору (зелёные)', 'Просрочено', 'Скрытых', 'За неделю'];
const ADAY_HEAD = ['Дата', 'Повторений', 'Минут', 'Новых', 'Again', 'Hard', 'Good', 'Easy',
  'Молодых', 'Молодых верно', 'Зрелых', 'Зрелых верно', 'Обучение', 'Обучение верно'];
const ADAY_KEYS = ['n', 'm', 'nw', 'a', 'h', 'g', 'e', 'yn', 'yk', 'mn', 'mk', 'ln', 'lk'];
const ATOP_HEAD = ['Тема', 'Всего', 'Новых', 'Учится', 'Молодых', 'Зрелых', 'Скрыто',
  'Проблемных', 'Просрочено', 'Повторений 30д', 'Верно 30д'];
const ATOP_KEYS = ['n', 'nw', 'lr', 'yg', 'mt', 'sp', 'lc', 'od', 'rn', 'rk'];
const PL_HEAD = ['ID плейлиста', 'Название', 'Система', 'Видео', 'Обновлён'];
const VID_HEAD = ['ID видео', 'ID плейлиста', 'Позиция', 'Название', 'Секунд', 'Просмотрено'];
const FLAG_HEAD = ['ID видео', 'ID плейлиста', 'Дата'];
const NOTE_HEAD = ['ID', 'ID видео', 'ID плейлиста', 'Секунда', 'Текст', 'Создано'];
const CARD_HEAD = ['ID', 'ID заметки', 'ID видео', 'ID плейлиста', 'Вопрос', 'Ответ', 'Система', 'Срок', 'Интервал', 'Лёгкость', 'Повторы', 'Провалы', 'Создано', 'Последнее'];

/* ============================ ДАТЫ ============================ */
var TODAY_OVERRIDE_ = null;

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function isDate_(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const p = s.split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}
function utc_(s) { const p = s.split('-').map(Number); return Date.UTC(p[0], p[1] - 1, p[2]); }
function daysBetween_(a, b) { return Math.round((utc_(b) - utc_(a)) / 86400000); }   // b - a
function addDays_(s, k) {
  const d = new Date(utc_(s) + k * 86400000);
  return d.getUTCFullYear() + '-' + pad2_(d.getUTCMonth() + 1) + '-' + pad2_(d.getUTCDate());
}
function serverToday_() {
  if (typeof SERVER_TODAY_FORCE_ !== 'undefined' && SERVER_TODAY_FORCE_) return SERVER_TODAY_FORCE_;   // только для тестов
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
/** «Сегодня» берём у клиента (его часовой пояс), если оно правдоподобно (±1 день от серверного). */
function setToday_(s) {
  TODAY_OVERRIDE_ = null;
  if (isDate_(s) && Math.abs(daysBetween_(serverToday_(), s)) <= 1) TODAY_OVERRIDE_ = s;
}
function todayStr_() { return TODAY_OVERRIDE_ || serverToday_(); }

function d_(v) {
  if (!v) return '';
  if (v instanceof Date)
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim().slice(0, 10);
}
function n_(v) { const x = parseFloat(v); return isNaN(x) ? 0 : x; }
function r1_(x) { return Math.round(x * 10) / 10; }
function pct_(ok, n) { return n > 0 ? Math.round(ok / n * 1000) / 10 : null; }

/* ============================ АВТОНАСТРОЙКА ============================ */
var ENSURED_ = false;

function header_(sh, cols) {
  const r = sh.getRange(1, 1, 1, cols);
  r.setFontWeight('bold').setFontColor('#FFFFFF').setBackground('#1B2A3F')
    .setVerticalAlignment('middle').setFontFamily('Arial');
  sh.setFrozenRows(1);
}

function ensureSheet_(name, headers, textDateCol) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    header_(sh, headers.length);
    sh.setColumnWidth(1, 120);
    sh.setColumnWidth(2, 200);
    if (textDateCol) sh.getRange(2, 1, 3000, 1).setNumberFormat('@');
  }
  return sh;
}

function ensureAll_() {
  if (ENSURED_) return SpreadsheetApp.getActive();
  const ss = SpreadsheetApp.getActive();

  let st = ss.getSheetByName(SH.SET);
  if (!st) {
    st = ss.insertSheet(SH.SET);
    const rows = [['kalit', 'qiymat'], ['exam_date', ''], ['target_score', 240],
      ['uworld_total', 3200], ['study_days_per_week', 7],
      ['api_key', Utilities.getUuid().replace(/-/g, '').slice(0, 20)],
      ['student_name', ''], ['ui_theme', 'auto'], ['ui_lang', 'ru'], ['ui_font', 'm'], ['site_url', ''], ['yt_api_key', '']];
    st.getRange(1, 1, rows.length, 2).setValues(rows);
    header_(st, 2);
    st.setColumnWidth(1, 180); st.setColumnWidth(2, 320);
  }

  let fa = ss.getSheetByName(SH.FA);
  if (!fa) {
    fa = ss.insertSheet(SH.FA);
    const rows = [['Система', 'Всего страниц']];
    SYSTEMS.forEach(s => rows.push([s, FA_PAGES[s] || '']));
    fa.getRange(1, 1, rows.length, 2).setValues(rows);
    header_(fa, 2);
    fa.setColumnWidth(1, 240);
  }

  ensureSheet_(SH.ERR, ['Время', 'Версия', 'Страница', 'Сообщение', 'Стек', 'Устройство', 'Повторов'], true);
  ensureSheet_(SH.LOG, ['Дата', 'Система', 'Страниц', 'Заметка'], true);
  ensureSheet_(SH.UW, ['Дата', 'Система', 'Вопросов', 'Верных', 'Заметка'], true);

  let nb = ss.getSheetByName(SH.NBME);
  if (!nb) {
    nb = ensureSheet_(SH.NBME, ['Экзамен', 'Дата', 'Балл', 'Заметка']);
    const seed = ['NBME 26', 'NBME 27', 'NBME 28', 'NBME 29', 'NBME 30', 'Free 120']
      .map(x => [x, '', '', '']);
    nb.getRange(2, 1, seed.length, 4).setValues(seed);
  }

  const ak = ensureSheet_(SH.ANKI, ANKI_HEAD, true);
  if (ak.getLastColumn() < ANKI_HEAD.length) {          // миграция со старых версий
    ak.getRange(1, 1, 1, ANKI_HEAD.length).setValues([ANKI_HEAD]);
    header_(ak, ANKI_HEAD.length);
  }
  ensureSheet_(SH.ADAY, ADAY_HEAD, true);
  ensureSheet_(SH.ATOP, ATOP_HEAD);
  ensureSheet_(SH.AMETA, ['key', 'value']);
  ensureSheet_(SH.PL, PL_HEAD);
  ensureSheet_(SH.VID, VID_HEAD);
  ensureSheet_(SH.FLAG, FLAG_HEAD);
  ensureSheet_(SH.NOTE, NOTE_HEAD);
  ensureSheet_(SH.CARD, CARD_HEAD);
  ensureV5_();
  ENSURED_ = true;
  return ss;
}

/* ============================ ДОСТУП ============================
 * Развёртывание — «Anyone» (иначе Anki не сможет присылать данные), поэтому сайт и ВСЕ операции
 * закрыты секретным ключом из листа Sozlamalar (api_key). Ссылка с ключом: меню таблицы →
 * 📈 USMLE Progress → «Открыть отчёт (ссылка)». Без ключа сайт показывает «Доступ закрыт».
 */
function isOwner_() {
  try { const a = Session.getActiveUser().getEmail(), e = Session.getEffectiveUser().getEmail(); return !!a && a === e; }
  catch (x) { return false; }
}
function authOk_(k) {
  const key = String(getSettings().api_key || '');
  return !!key && String(k || '') === key;
}
function needAuth_(o) {
  if (typeof AUTH_OFF_ !== 'undefined' && AUTH_OFF_) return;      // только для тестов
  if (!authOk_(o && o.k)) fail_('AUTH');
}
function deniedPage_() {
  return HtmlService.createHtmlOutput(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:18vh auto;padding:0 24px;text-align:center;color:#394357">' +
    '<div style="font-size:48px">🔒</div><h2 style="margin:12px 0 8px">Доступ закрыт · Access denied</h2>' +
    '<p style="color:#667085;line-height:1.6">Открой отчёт по ссылке из таблицы:<br>меню <b>📈 USMLE Progress → Открыть отчёт</b>.<br><br>' +
    'Open the report using the link from the sheet:<br>menu <b>📈 USMLE Progress → Open report</b>.</p></div>')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ============================ ВЕБ-ПРИЛОЖЕНИЕ ============================ */
/* ============================ ПОДЕЛИТЬСЯ СТАТИСТИКОЙ (только Anki и UWorld) ============================ */
/* Друг получает ссылку; по ней открывается страница только для чтения с цифрами и графиками Anki и UWorld и свежими данными при каждом открытии.
   Отдаётся ТОЛЬКО то, что перечислено в sharePayload_ (явный список полей): заметки, планер, ошибки, First Aid, NBME, видео, ключи и имя владельца не попадают никуда. */
const SHARE_TTL_ = 60;              // секунд хранить собранные данные (защита от лишних пересчётов при многих просмотрах)
function safeEq_(a, b) {            // сравнение за постоянное время (без утечки по времени ответа)
  a = String(a); b = String(b); let d = a.length ^ b.length; const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function shareToken_() { return String(getSettings().share_token || ''); }
function shareOk_(t) { const tok = shareToken_(); return !!tok && typeof t === 'string' && /^[A-Za-z0-9_-]{24,64}$/.test(t) && safeEq_(t, tok); }
function shareNewToken_() {
  const raw = Utilities.getUuid() + '|' + Utilities.getUuid() + '|' + Date.now();
  return String(Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw))).replace(/=+$/, '').slice(0, 32);
}
function shareCacheClear_() { try { const c = CacheService.getScriptCache(); c.remove('share_payload'); c.remove('share_seen'); } catch (e) { } }      // и метку «просмотр уже записан»: первый просмотр новой ссылки должен записаться
function shareLink_(tok) {
  const exec = String(ScriptApp.getService().getUrl() || ''), m = /\/macros\/s\/([A-Za-z0-9_-]+)\/exec/.exec(exec), site = String(getSettings().site_url || '').replace(/\/+$/, '');
  if (site && m) return site + '/?share=' + m[1] + '.' + tok;                               // красивая ссылка через ваш сайт (без баннера Google)
  return exec ? exec + (exec.indexOf('?') < 0 ? '?' : '&') + 's=' + tok : '';
}
function shareInfo_() {
  const st = getSettings(), tok = String(st.share_token || '');
  return { enabled: !!tok, link: tok ? shareLink_(tok) : '', viaSite: !!(tok && String(st.site_url || '') && /\/macros\/s\//.test(String(ScriptApp.getService().getUrl() || ''))),
    name: String(st.share_name || ''), created: String(st.share_created || ''), lastView: String(st.share_last_view || ''), scope: ['anki', 'uworld'] };
}
function shareTouch_() {            // «последний просмотр» — не чаще раза в 5 минут (чтобы не писать в таблицу при каждом обновлении)
  try { const c = CacheService.getScriptCache(); if (!c.get('share_seen')) { c.put('share_seen', '1', 300); setSettingRaw_('share_last_view', new Date().toISOString()); } } catch (e) { }
}
/** Данные для страницы друга. Явный список полей. */
function sharePayload_() {
  const cache = CacheService.getScriptCache(); let hit = null;
  try { hit = cache.get('share_payload'); } catch (e) { }
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  const D = build_(), A = D.anki || {}, an = A.analysis || {}, today = D.today, from = addDays_(today, -89), st = getSettings();
  const byDay = {};
  (D.uworld.rows || []).forEach(r => { if (!isDate_(r.date) || r.date < from || r.date > today) return; const g = byDay[r.date] || (byDay[r.date] = { d: r.date, q: 0, c: 0 }); g.q += n_(r.q); g.c += Math.min(n_(r.correct), n_(r.q)); });
  const uwDaily = Object.keys(byDay).sort().map(k => byDay[k]), weeks = [];
  for (let w = 11; w >= 0; w--) { const a = addDays_(today, -(w * 7 + 6)), b = addDays_(today, -(w * 7)); let q = 0, c = 0; uwDaily.forEach(x => { if (x.d >= a && x.d <= b) { q += x.q; c += x.c; } }); weeks.push({ start: a, q: q, c: c }); }
  const sum7 = uwDaily.filter(x => x.d >= addDays_(today, -6)).reduce((p, x) => ({ q: p.q + x.q, c: p.c + x.c }), { q: 0, c: 0 });
  const mixed = D.uworld.mixed || {};
  const uw = { questions: n_(D.uworld.questions), correct: n_(D.uworld.correct), pct: D.uworld.pct, total: n_(D.uworld.total),
    bySystem: (D.uworld.bySystem || []).map(x => ({ system: String(x.system), q: n_(x.q), c: n_(x.c), pct: x.pct })),
    mixed: { q: n_(mixed.q), c: n_(mixed.c), blocks: n_(mixed.blocks) }, daily: uwDaily, weeks: weeks, last7: sum7 };
  const anki = { hasDaily: !!an.hasDaily };
  if (an.hasDaily) {
    anki.daily = (A.daily || []).filter(x => x.d >= from).map(x => ({ d: x.d, n: n_(x.n), m: n_(x.m), nw: n_(x.nw) }));
    ['today', 'w7', 'd30', 'buttons30', 'retention', 'weeklyReviews', 'weeklyRetention', 'forecast', 'streak', 'totals', 'bestHour', 'peakHour'].forEach(k => { if (an[k] !== undefined) anki[k] = an[k]; });
    anki.sync = { at: an.sync ? an.sync.at : '', staleDays: an.sync ? an.sync.staleDays : null };
  }
  const payload = { v: VERSION, at: new Date().toISOString(), today: today, name: String(st.share_name || ''), uw: uw, anki: anki };
  try { cache.put('share_payload', JSON.stringify(payload), SHARE_TTL_); } catch (e) { }
  return payload;
}
function sharePageDenied_() {
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>USMLE Progress</title>' +
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:18vh auto;padding:0 24px;text-align:center;color:#394357"><h2 style="margin:0 0 10px">Ссылка недействительна · Link is not valid</h2>' +
    '<p style="color:#667085;line-height:1.6">Владелец закрыл доступ или создал новую ссылку. Попросите актуальную.<br>The owner has stopped sharing or created a new link. Ask for the current one.</p></div>');
}
function sharePage_(tok, q) {
  if (!shareOk_(tok)) return sharePageDenied_();
  shareTouch_();
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.viewKeyJs = '""';                                                                      // ключ владельца на страницу друга НЕ попадает никогда
  tpl.envJs = JSON.stringify({ share: true, shareToken: tok, emb: q.emb === '1', site: '' }).replace(/</g, '\\u003c');
  tpl.initJs = JSON.stringify(sharePayload_()).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return tpl.evaluate().setTitle('USMLE Progress').addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/** ПУБЛИЧНАЯ функция (токен вместо ключа): свежие данные для страницы друга. */
function shareData(o) {
  ensureAll_();
  if (!shareOk_(o && o.s)) return { ok: false, error: 'revoked' };
  shareTouch_();
  return { ok: true, payload: sharePayload_() };
}
function shareGet(o) { needAuth_(o); ensureAll_(); return shareInfo_(); }
function shareEnable(o) {
  needAuth_(o); ensureAll_();
  if (!shareToken_()) { setSettingRaw_('share_token', shareNewToken_()); setSettingRaw_('share_created', new Date().toISOString()); setSettingRaw_('share_last_view', ''); }
  shareCacheClear_(); return shareInfo_();
}
function shareRegenerate(o) {
  needAuth_(o); ensureAll_();
  setSettingRaw_('share_token', shareNewToken_()); setSettingRaw_('share_created', new Date().toISOString()); setSettingRaw_('share_last_view', '');
  shareCacheClear_(); return shareInfo_();
}
function shareDisable(o) { needAuth_(o); ensureAll_(); setSettingRaw_('share_token', ''); shareCacheClear_(); return shareInfo_(); }
function shareName(o) {
  needAuth_(o); ensureAll_();
  const name = String((o && o.name) || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 40);
  setSettingRaw_('share_name', name); shareCacheClear_(); return shareInfo_();
}

/* ============================ РЕЗЕРВНЫЕ КОПИИ (на Google Диск) ============================ */
const BACKUP_KEEP_ = 8, BACKUP_FOLDER_ = 'USMLE Progress — копии', BACKUP_PREFIX_ = 'USMLE Progress — копия ';
function backupFolder_() { const it = DriveApp.getFoldersByName(BACKUP_FOLDER_); return it.hasNext() ? it.next() : DriveApp.createFolder(BACKUP_FOLDER_); }
/** Копия всей таблицы в папке на Диске; хранятся BACKUP_KEEP_ последних, старые уходят в корзину. */
function backupRun_() {
  const ss = SpreadsheetApp.getActive(), now = new Date(), name = BACKUP_PREFIX_ + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const folder = backupFolder_(), copy = DriveApp.getFileById(ss.getId()).makeCopy(name, folder), files = [], it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (String(f.getName()).indexOf(BACKUP_PREFIX_) === 0) files.push(f); }
  files.sort((a, b) => b.getDateCreated().getTime() - a.getDateCreated().getTime());
  files.slice(BACKUP_KEEP_).forEach(f => f.setTrashed(true));
  setSettingRaw_('backup_last', now.toISOString()); setSettingRaw_('backup_last_name', name); setSettingRaw_('backup_count', String(Math.min(files.length, BACKUP_KEEP_))); setSettingRaw_('backup_folder_url', folder.getUrl());
  return copy;
}
function backupCron_() { ensureAll_(); try { backupRun_(); } catch (e) { logErrorRaw_({ page: 'backup', msg: String(e && e.message || e), stack: '' }); } }
function backupTriggers_() { return ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'backupCron_'); }
function backupInfo_() {
  const st = getSettings(); let auto = false; try { auto = backupTriggers_().length > 0; } catch (e) { }
  return { auto: auto, last: String(st.backup_last || ''), lastName: String(st.backup_last_name || ''), count: n_(st.backup_count), keep: BACKUP_KEEP_, folderUrl: String(st.backup_folder_url || '') };
}
/** Запустите один раз из редактора Apps Script («Выполнить»): Google запросит доступ к Диску для резервных копий. */
function backupSetup() { ensureAll_(); backupRun_(); }
function backupNow(o) { needAuth_(o); ensureAll_(); const f = backupRun_(); const i = backupInfo_(); i.url = f.getUrl(); return i; }
function backupAuto(o) {
  needAuth_(o); ensureAll_();
  backupTriggers_().forEach(t => ScriptApp.deleteTrigger(t));
  if (o && o.on === true) ScriptApp.newTrigger('backupCron_').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(3).create();
  return backupInfo_();
}

/* ============================ ЖУРНАЛ ОШИБОК ПРИЛОЖЕНИЯ ============================ */
const ERR_MAX_ = 300, ERR_PER_HOUR_ = 40;
function errClean_(v, max) { return String(v == null ? '' : v).replace(/<[^>]*>/g, '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max); }
/** Пишет строку в лист «Errors»; одинаковая ошибка на той же странице не дублируется, а увеличивает счётчик «Повторов». */
function logErrorRaw_(e) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.ERR), msg = errClean_(e.msg, 300), page = errClean_(e.page, 30); if (!msg) return false;
  const last = sh.getLastRow(), vals = last >= 2 ? sh.getRange(Math.max(2, last - 29), 1, Math.min(30, last - 1), 7).getValues() : [], base = Math.max(2, last - 29);
  for (let i = vals.length - 1; i >= 0; i--) if (String(vals[i][3]) === msg && String(vals[i][2]) === page) {
    const rg = sh.getRange(base + i, 1, 1, 7); rg.setNumberFormat('@'); const v = vals[i].slice(); v[0] = new Date().toISOString(); v[6] = String(n_(v[6]) + 1); rg.setValues([v.map(String)]); return true;
  }
  appendText_(SH.ERR, [new Date().toISOString(), errClean_(e.ver, 20), page, msg, errClean_(e.stack, 800), errClean_(e.ua, 140), '1']);
  const total = sh.getLastRow() - 1; if (total > ERR_MAX_) sh.deleteRows(2, total - ERR_MAX_);
  return true;
}
function logError(o) {
  needAuth_(o); ensureAll_();
  const cache = CacheService.getScriptCache(); let n = 0; try { n = n_(cache.get('err_n')); } catch (e) { }
  if (n >= ERR_PER_HOUR_) return { ok: false, limited: true };               // защита таблицы от «шторма» одинаковых сбоев
  try { cache.put('err_n', String(n + 1), 3600); } catch (e) { }
  return { ok: logErrorRaw_({ msg: o && o.msg, stack: o && o.stack, page: o && o.page, ver: o && o.ver, ua: o && o.ua }) };
}
function errorsSummary_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.ERR), last = sh ? sh.getLastRow() : 0; if (last < 2) return { count: 0, last: [] };
  const vals = sh.getRange(Math.max(2, last - 7), 1, Math.min(8, last - 1), 7).getValues().reverse();
  return { count: last - 1, last: vals.map(r => ({ at: String(r[0]), ver: String(r[1]), page: String(r[2]), msg: String(r[3]), count: n_(r[6]) || 1 })) };
}
function clearErrors(o) { needAuth_(o); ensureAll_(); const sh = SpreadsheetApp.getActive().getSheetByName(SH.ERR), n = sh.getLastRow() - 1; if (n > 0) sh.deleteRows(2, n); return { count: 0, last: [] }; }

/* ============================ СМЕНА КЛЮЧА ============================ */
/** Новый ключ; старый перестаёт работать СРАЗУ на всех устройствах (в том числе в виджетах) — устройство, нажавшее кнопку, получает новый. */
function rotateKey(o) {
  needAuth_(o); ensureAll_();
  const key = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').slice(0, 40);
  setSettingRaw_('api_key', key); shareCacheClear_();
  return { key: key };
}

/* ============================ ДАННЫЕ ДЛЯ ВИДЖЕТА ============================ */
function widgetPayload_() {
  const D = build_(), T = D.forecast.today || {}, goals = ['pages', 'q', 'nw', 'vid'].filter(k => T[k] && T[k].goal).map(k => ({ k: k, done: T[k].done, goal: T[k].goal }));
  const pct = goals.length ? Math.round(goals.reduce((a, g) => a + Math.min(1, g.done / g.goal), 0) / goals.length * 100) : null, ex = D.forecast.exam;
  return { ok: true, version: VERSION, today: D.today, days: D.days, pct: pct, goals: goals, ready: ex ? { now: ex.now, atExam: ex.atExam, noNbme: !!ex.noNbme } : null,
    streak: (D.anki && D.anki.analysis && D.anki.analysis.streak) ? D.anki.analysis.streak.current : null, at: new Date().toISOString() };
}
function widgetCached_() {
  const key = 'widget_' + todayStr_(), cache = CacheService.getScriptCache(); let hit = null;
  try { hit = cache.get(key); } catch (e) { }
  if (hit) { try { return JSON.parse(hit); } catch (e) { } }
  const p = widgetPayload_(); try { cache.put(key, JSON.stringify(p), 60); } catch (e) { } return p;
}

function doGet(e) {
  ensureAll_();
  if (e && e.parameter && e.parameter.s) return sharePage_(String(e.parameter.s), e.parameter);      // ссылка для друга: только статистика Anki и UWorld, без ключа
  if (e && e.parameter && e.parameter.widget) {                                      // JSON для виджета Scriptable: ?widget=1&k=КЛЮЧ&d=ГГГГ-ММ-ДД
    if (!authOk_(e.parameter.k)) return json_({ ok: false, error: 'AUTH' });
    setToday_(e.parameter.d); return json_(widgetCached_());
  }
  const key = String(getSettings().api_key || '');
  const k = e && e.parameter && e.parameter.k;
  if (!(authOk_(k) || isOwner_())) return deniedPage_();
  const tpl = HtmlService.createTemplateFromFile('Index');
  tpl.viewKeyJs = JSON.stringify(key).replace(/</g, '\\u003c');
  const q = (e && e.parameter) || {};
  tpl.envJs = JSON.stringify({ emb: q.emb === '1', standalone: q.env === 'standalone', ios: q.ios === '1',
    site: String(getSettings().site_url || '') }).replace(/</g, '\\u003c');
  tpl.initJs = 'null';                                                         // данные приложение запросит само (ранний запрос): страница приходит сразу, не дожидаясь чтения всех листов
  return tpl.evaluate()
    .setTitle('USMLE Progress')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ============================ ЧТЕНИЕ ============================ */
function rows_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) return [];
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
}

function getSettings() {
  ensureAll_();
  const out = {};
  rows_(SH.SET).forEach(r => { if (r[0]) out[String(r[0]).trim()] = r[1]; });
  return out;
}

function readAnkiDaily_() {
  const out = [];
  rows_(SH.ADAY).forEach(r => {
    const d = d_(r[0]);
    if (!isDate_(d)) return;
    const o = { d: d };
    ADAY_KEYS.forEach((k, i) => { o[k] = n_(r[i + 1]); });
    out.push(o);
  });
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  return out;
}

function readAnkiTopics_() {
  const out = [];
  rows_(SH.ATOP).forEach(r => {
    if (!r[0]) return;
    const o = { t: String(r[0]) };
    ATOP_KEYS.forEach((k, i) => { o[k] = n_(r[i + 1]); });
    out.push(o);
  });
  return out;
}

function readAnkiMeta_() {
  const meta = {};
  rows_(SH.AMETA).forEach(r => {
    const k = String(r[0] || '').trim();
    if (!k) return;
    let v = r[1];
    try { v = JSON.parse(String(r[1])); } catch (e) { v = r[1]; }
    meta[k] = v;
  });
  return meta;
}

function readAnkiSnapshots_() {
  return rows_(SH.ANKI).map(r => ({
    date: d_(r[0]), scope: String(r[1] || ''), total: n_(r[2]), learned: n_(r[3]),
    remaining: n_(r[4]), hidden: n_(r[5]), pace: n_(r[6]), leeches: n_(r[7]),
    avgSec: n_(r[8]), today: n_(r[9]), revToday: n_(r[10]), minToday: n_(r[11]),
    rev7: n_(r[12]), min7: n_(r[13]), retention: n_(r[14]), streak: n_(r[15]),
    mature: n_(r[16]), young: n_(r[17]), dueTomorrow: n_(r[18]), secReal: n_(r[19]),
    cntNew: n_(r[20]), cntLearn: n_(r[21]), cntDue: n_(r[22]), cntOverdue: n_(r[23]),
    cntSusp: n_(r[24]), dueWeek: n_(r[25])
  })).filter(x => x.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ============================ ПРОГНОЗЫ ============================ */
/** Окно темпа: реально прошедшие дни с первой записи, но не больше maxW. */
function windowDays_(dates, today, maxW) {
  const ds = dates.filter(isDate_);
  if (!ds.length) return maxW;
  const first = ds.reduce((a, b) => (a < b ? a : b));
  return Math.max(1, Math.min(maxW, daysBetween_(first, today) + 1));
}
function sumSince_(items, valKey, today, W) {
  const from = addDays_(today, -(W - 1));
  let s = 0;
  items.forEach(x => { if (x.date >= from && x.date <= today) s += x[valKey]; });
  return s;
}
function proj_(left, perDay, today) {
  if (!perDay || !(left > 0)) return null;
  const days = Math.ceil(left / perDay);
  return { days: days, date: addDays_(today, days) };
}

/** Линейный тренд NBME (МНК по датам). */
function nbmeTrend_(nbme, exam, today) {
  const pts = nbme.filter(x => x.score > 0 && isDate_(x.date))
    .sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));
  if (pts.length < 2) return null;
  const t0 = utc_(pts[0].date);
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  pts.forEach(p => {
    const x = (utc_(p.date) - t0) / 86400000;
    sx += x; sy += p.score; sxy += x * p.score; sxx += x * x;
  });
  const n = pts.length, den = n * sxx - sx * sx;
  if (den === 0) return null;
  const slope = (n * sxy - sx * sy) / den, inter = (sy - slope * sx) / n;
  const span = daysBetween_(pts[0].date, pts[pts.length - 1].date);
  const out = { perWeek: r1_(slope * 7), points: n, spanDays: span, low: (n < 3 || span < 14) };
  if (n >= 4) {                                           // типичный разброс результатов вокруг прямой (нужно ≥ 4 точек)
    let ss = 0;
    pts.forEach(p => { const r = p.score - (inter + slope * ((utc_(p.date) - t0) / 86400000)); ss += r * r; });
    out.sigma = r1_(Math.sqrt(ss / (n - 2)));
  }
  if (exam && isDate_(exam)) {
    const xe = (utc_(exam) - t0) / 86400000;
    out.projected = Math.max(0, Math.min(300, Math.round(inter + slope * xe)));
    if (out.sigma !== undefined) {
      out.rangeLo = Math.max(0, Math.round(out.projected - out.sigma));
      out.rangeHi = Math.min(300, Math.round(out.projected + out.sigma));
    }
  }
  return out;
}

/* ============================ УМНЫЕ ПРОГНОЗЫ ============================ */
/** Окно темпа. Берётся БОЛЬШЕЕ из двух средних:
 *  1) по последним W ЗАВЕРШЁННЫМ дням (без сегодняшнего: он не закончен, и с утра нулём занижал бы темп);
 *  2) по тем же дням вместе с сегодняшним (если сегодня уже сделано больше обычного — это учитывается сразу).
 *  W не больше maxW и не больше числа дней с первой записи. Если занятия начались только сегодня — берётся сегодня. */
function paceWin_(items, key, today, maxW) {
  const ds = items.filter(x => isDate_(x.date) && x.date <= today).map(x => x.date);
  if (!ds.length) return { W: maxW, from: addDays_(today, -maxW), to: addDays_(today, -1), sum: 0, incl: false };
  const first = ds.reduce((a, b) => (a < b ? a : b));
  const sumIn = (from, to) => { let t = 0; items.forEach(x => { if (x.date >= from && x.date <= to) t += x[key]; }); return t; };
  if (first >= today) return { W: 1, from: today, to: today, sum: sumIn(today, today), incl: true };
  const span = daysBetween_(first, today);                                   // завершённых дней с первой записи
  const Wc = Math.max(1, Math.min(maxW, span)), Wi = Math.max(1, Math.min(maxW, span + 1));
  const c = { W: Wc, from: addDays_(today, -Wc), to: addDays_(today, -1), sum: 0, incl: false };
  c.sum = sumIn(c.from, c.to);
  const w = { W: Wi, from: addDays_(today, -(Wi - 1)), to: today, sum: 0, incl: true };
  w.sum = sumIn(w.from, w.to);
  return (w.sum / w.W > c.sum / c.W) ? w : c;
}
function activeIn_(items, key, from, to) {
  const seen = {}; items.forEach(x => { if (x.date >= from && x.date <= to && x[key] > 0) seen[x.date] = true; });
  return Object.keys(seen).length;
}
function sumRange_(items, key, today, fromAgo, toAgo) {      // сумма за дни today-fromAgo … today-toAgo
  const lo = addDays_(today, -fromAgo), hi = addDays_(today, -toAgo);
  let s = 0;
  items.forEach(x => { if (x.date >= lo && x.date <= hi) s += x[key]; });
  return s;
}
function pctChange_(cur, prev) { return prev > 0 ? Math.round((cur - prev) / prev * 100) : null; }
/** Запас (+) или дефицит (−) в днях: сколько дней до экзамена минус сколько нужно при нынешнем темпе. */
function slack_(days, left, perDay) {
  if (days == null) return null;
  if (!(left > 0)) return days;
  if (!(perDay > 0)) return null;
  return days - Math.ceil(left / perDay);
}
/** Готовность сейчас и к дню экзамена при сохранении текущего темпа (та же формула 40/40/20, что и на карте). */
function examReadiness_(c) {
  if (c.days == null) return null;
  const cl = x => Math.max(0, Math.min(1, x)), t = c.target || 240, acc = c.uwPct || 0;
  const faNow = c.faTotal ? cl(c.faDone / c.faTotal) : 0;
  const faEx = c.faTotal ? cl((c.faDone + c.pagesPerDay * c.days) / c.faTotal) : 0;
  const cvNow = c.uwTotal ? cl(c.uwQ / c.uwTotal) : 0;
  const cvEx = c.uwTotal ? cl((c.uwQ + c.qPerDay * c.days) / c.uwTotal) : 0;
  const sc = c.nbProjected || c.nbLast || 0;
  const nbNow = c.nbLast ? cl(c.nbLast / t) : 0, nbEx = sc ? cl(sc / t) : 0;
  const hasNb = !!c.nbLast;                                                            // без пробника его 20 % не «сгорают»: веса пересчитываются 50/50
  const rd = (fa, cv, nb) => hasNb ? 0.4 * fa + 0.4 * cv * acc + 0.2 * nb : 0.5 * fa + 0.5 * cv * acc;
  const R = x => Math.round(x * 1000) / 1000;
  return { noNbme: !hasNb, now: R(rd(faNow, cvNow, nbNow)), atExam: R(rd(faEx, cvEx, nbEx)),
    fa: { now: R(faNow), exam: R(faEx) }, uw: { now: R(cvNow), exam: R(cvEx), acc: R(acc) }, nb: { now: R(nbNow), exam: R(nbEx) } };
}
/** Проверка прогноза на прошлом (walk-forward): на каждый день t, к которому накопилось ≥ 7 дней истории, прогнозируем сумму
 *  за следующие H дней как «темп × H» (темп = среднее за последние min(14, прошло) дней) и сверяем с фактом.
 *  wape = Σ|прогноз − факт| / Σфакт; bias > 0 — прогноз завышал. Нужно ≥ 7 проверок (≈ 3 недели истории). */
function dayMap_(items, key) { const m = {}; items.forEach(x => { if (isDate_(x.date)) m[x.date] = (m[x.date] || 0) + x[key]; }); return m; }
function backtestPace_(byDate, today, H) {
  const dates = Object.keys(byDate).filter(d => byDate[d] > 0).sort();
  if (!dates.length) return null;
  const first = dates[0], get = d => byDate[d] || 0;
  let n = 0, err = 0, bias = 0, act = 0;
  for (let t = addDays_(first, 6); daysBetween_(t, today) > H; t = addDays_(t, 1)) {      // горизонт целиком в завершённых днях (сегодня не в счёт)
    const W = Math.min(14, daysBetween_(first, t) + 1);
    let s = 0; for (let i = 0; i < W; i++) s += get(addDays_(t, -i));
    const pred = s / W * H;
    let a = 0; for (let i = 1; i <= H; i++) a += get(addDays_(t, i));
    err += Math.abs(pred - a); bias += pred - a; act += a; n++;
  }
  if (n < 7 || act <= 0) return null;
  return { n: n, wape: Math.round(err / act * 100) / 100, bias: Math.round(bias / act * 100) / 100, horizon: H };
}
/** Надёжность прогноза: low / medium / high. Зависит от длины окна, числа активных дней и ошибки на прошлом. */
function confidence_(windowDays, activeDays, wape) {
  if (windowDays < 5 || activeDays < 3) return 'low';
  if (wape != null && wape > 0.5) return 'low';
  if (windowDays >= 10 && activeDays >= 7 && (wape == null || wape <= 0.3)) return 'high';
  return 'medium';
}
function nbmeConfidence_(tr) { return !tr ? null : (tr.points >= 4 && tr.spanDays >= 28 ? 'high' : (tr.points >= 3 ? 'medium' : 'low')); }
/** Коридор дат: быстрый сценарий — лучший из недельного и двухнедельного темпа, медленный — худший. */
function paceRange_(left, p7, p14, today) {
  if (!(left > 0)) return null;
  const hi = Math.max(p7, p14), lo = Math.min(p7, p14);
  return { fast: hi > 0 ? proj_(left, hi, today) : null, slow: lo > 0 ? proj_(left, lo, today) : null };
}
/** Диапазон срока по РАСПРЕДЕЛЕНИЮ недельных темпов за последние 28 дней (10-й и 90-й перцентили). Окно в 7 дней не должно начинаться до первого дня занятий.
 *  Если истории мало (меньше 14 таких окон) — прежний способ: темп за 7 против 14 дней. */
function paceRangePct_(left, dm, today, p7, p14) {
  if (!(left > 0)) return null;
  const days = Object.keys(dm).filter(d => dm[d] > 0).sort(), vals = [];
  if (days.length) {
    const first = days[0];
    for (let k = 1; k <= 28; k++) { const d = addDays_(today, -k); if (addDays_(d, -6) < first) break; let sm = 0; for (let i = 0; i < 7; i++) sm += dm[addDays_(d, -i)] || 0; vals.push(sm / 7); }
  }
  if (vals.length >= 14) {
    vals.sort((a, b) => a - b); const n = vals.length, lo = vals[Math.floor(0.1 * (n - 1))], hi = vals[Math.ceil(0.9 * (n - 1))];
    return { fast: hi > 0 ? proj_(left, hi, today) : null, slow: lo > 0 ? proj_(left, lo, today) : null, method: 'pct', n: n };
  }
  const r = paceRange_(left, p7, p14, today); return r ? { fast: r.fast, slow: r.slow, method: 'two', n: vals.length } : null;
}
/** Сколько времени в день требуют нормы (страницы, вопросы, Anki, видео) и хватает ли часов в сутках. */
function budgetCalc_(o) {
  if (o.days == null) return null;
  const items = [];
  if (o.pagesGoal) items.push({ k: 'pages', n: o.pagesGoal, min: Math.round(o.pagesGoal * o.minPage) });
  if (o.qGoal) items.push({ k: 'q', n: o.qGoal, min: Math.round(o.qGoal * o.minQ) });
  if (o.secPer > 0 && (o.dueAvg7 > 0 || o.newGoal > 0)) { const cards = o.dueAvg7 + (o.newGoal || 0); items.push({ k: 'anki', n: Math.round(cards), min: Math.round(cards * o.secPer / 60) }); }
  if (o.vidGoal) items.push({ k: 'vid', n: o.vidGoal, min: o.vidGoal });
  if (!items.length) return null;
  const total = items.reduce((a, x) => a + x.min, 0), avail = Math.round(o.hours * 60);
  return { items: items, total: total, avail: avail, deficit: Math.max(0, total - avail), ratio: Math.round(total / avail * 100) / 100, params: { minPage: o.minPage, minQ: o.minQ, hours: o.hours } };
}
function activeDays_(items, key, today, W) {
  const from = addDays_(today, -(W - 1)), seen = {};
  items.forEach(x => { if (x.date >= from && x.date <= today && x[key] > 0) seen[x.date] = true; });
  return Object.keys(seen).length;
}

/** Приоритет систем: 0.5·слабость (точность UWorld; неизвестна → 0.25) + 0.3·доля непрочитанного + 0.2·«давно не занимался» (до 14 дней). Не начатые — внизу. */
function focusRank_(rows, today) {
  const out = [], R = x => Math.round(x * 1000) / 1000;
  rows.forEach(r => {
    if (r.total > 0 && r.pct >= 0.95 && (r.uq === 0 || r.upct >= 0.65)) return;      // система закрыта
    const started = r.done > 0 || r.uq > 0 || isDate_(r.last);     // любая отмеченная работа по системе (в т.ч. блок по нескольким системам) — это начало
    if (!started) { out.push({ system: r.system, score: R(0.2 * (r.total > 0 ? 1 : 0.5)), started: false, uq: 0, acc: null, left: r.left, idle: null }); return; }
    const weak = r.uq >= 10 ? Math.max(0, Math.min(1, (0.75 - r.upct) / 0.75)) : 0.25;   // точность неизвестна — слабее, чем доказанно слабая
    const rem = r.total > 0 ? r.left / r.total : 0.5;
    const known = isDate_(r.last), idle = known ? Math.min(14, Math.max(0, daysBetween_(r.last, today))) : 14;
    out.push({ system: r.system, score: R(0.5 * weak + 0.3 * rem + 0.2 * idle / 14), started: true, uq: r.uq,
      acc: r.uq ? Math.round(r.upct * 1000) / 10 : null, left: r.left, idle: known ? idle : null });
  });
  out.sort((a, b) => (b.score - a.score) || (a.system < b.system ? -1 : 1));
  return out.slice(0, 5);
}

/* ============================ АНАЛИТИКА ANKI ============================ */
/**
 * Чистая функция (без обращения к таблице) — её проверяют тестами.
 * daily — история по дням (по возрастанию), meta — слепок коллекции,
 * last — последняя строка листа Anki, ref — «сегодня» по Anki,
 * daysLeft — дней до экзамена (или null), realToday — «сегодня» пользователя.
 */
function ankiAnalysis_(daily, meta, last, ref, daysLeft, realToday) {
  const out = { hasDaily: daily.length > 0 };
  if (!daily.length) return out;
  meta = meta || {};
  const by = {};
  daily.forEach(x => { by[x.d] = x; });
  const KEYS = ADAY_KEYS;

  function win(fromAgo, toAgo) {          // дни ref-fromAgo … ref-toAgo включительно
    const acc = { days: 0, studied: 0 };
    KEYS.forEach(k => { acc[k] = 0; });
    for (let k = fromAgo; k >= toAgo; k--) {
      const x = by[addDays_(ref, -k)];
      acc.days++;
      if (x) { KEYS.forEach(kk => { acc[kk] += x[kk]; }); if (x.n > 0) acc.studied++; }
    }
    return acc;
  }
  const zero = {}; KEYS.forEach(k => { zero[k] = 0; });
  const t0 = by[ref] || zero;
  const w7 = win(6, 0), p7 = win(13, 7), d14 = win(13, 0), d30 = win(29, 0);
  // Среднее делится на дни, реально прошедшие с начала коллекции (не больше длины окна): у новичка 12 дней — это не «12 из 30»
  const first = (meta.first_review && isDate_(meta.first_review)) ? String(meta.first_review).slice(0, 10) : daily.reduce((a, x) => (a && a < x.d ? a : x.d), '');
  const elapsed = first ? Math.max(0, daysBetween_(first, ref)) : 999;           // завершённых дней до ref с начала
  const avail = len => Math.max(1, Math.min(len, elapsed + 1));                  // дней окна, на которые коллекция уже существовала (с ref включительно)

  out.ref = ref;
  out.today = {
    present: !!by[ref], n: t0.n, m: r1_(t0.m), nw: t0.nw,
    secPer: t0.n ? r1_(t0.m * 60 / t0.n) : 0,
    buttons: { a: t0.a, h: t0.h, g: t0.g, e: t0.e }
  };
  out.w7 = { n: w7.n, m: r1_(w7.m), nw: w7.nw, avgN: r1_(w7.n / avail(7)), avgM: r1_(w7.m / avail(7)), studied: w7.studied };
  out.p7 = { n: p7.n, m: r1_(p7.m), nw: p7.nw };
  // Прирост к прошлой неделе: по ЗАВЕРШЁННЫМ дням (сегодня не закончен) и только когда истории хватает на две полные недели
  const c7 = win(7, 1), pc7 = win(14, 8), fullTwoWeeks = elapsed >= 14;
  out.delta = {
    n: (fullTwoWeeks && pc7.n) ? Math.round((c7.n - pc7.n) / pc7.n * 100) : null,
    m: (fullTwoWeeks && pc7.m) ? Math.round((c7.m - pc7.m) / pc7.m * 100) : null
  };
  out.d30 = {
    n: d30.n, m: r1_(d30.m), nw: d30.nw, studied: d30.studied,
    avgN: r1_(d30.n / avail(30)), avgM: r1_(d30.m / avail(30)),
    secPer: d30.n ? r1_(d30.m * 60 / d30.n) : 0,
    consistency: Math.round(d30.studied / avail(30) * 100)
  };

  const bt = d30.a + d30.h + d30.g + d30.e;
  out.buttons30 = {
    total: bt, a: d30.a, h: d30.h, g: d30.g, e: d30.e,
    pct: { a: pct_(d30.a, bt), h: pct_(d30.h, bt), g: pct_(d30.g, bt), e: pct_(d30.e, bt) }
  };

  out.retention = {
    young: { n: d30.yn, ok: d30.yk, pct: pct_(d30.yk, d30.yn) },
    mature: { n: d30.mn, ok: d30.mk, pct: pct_(d30.mk, d30.mn) },
    learn: { n: d30.ln, ok: d30.lk, pct: pct_(d30.lk, d30.ln) },
    review: { n: d30.yn + d30.mn, ok: d30.yk + d30.mk, pct: pct_(d30.yk + d30.mk, d30.yn + d30.mn) },
    review7: { n: w7.yn + w7.mn, ok: w7.yk + w7.mk, pct: pct_(w7.yk + w7.mk, w7.yn + w7.mn) }
  };

  out.weeklyRetention = [];
  out.weeklyReviews = [];
  for (let w = 11; w >= 0; w--) {
    const s = win(w * 7 + 6, w * 7);
    const start = addDays_(ref, -(w * 7 + 6));
    out.weeklyReviews.push({ start: start, n: s.n, m: r1_(s.m), studied: s.studied });
    if (w <= 7) out.weeklyRetention.push({ start: start, n: s.yn + s.mn, pct: pct_(s.yk + s.mk, s.yn + s.mn) });
  }

  const hrs = (meta.hours || []).map((x, h) => ({ h: h, n: n_(x && x.n), pct: pct_(n_(x && x.ok), n_(x && x.n)) }));
  out.hours = hrs;
  let best = null, peak = null;
  hrs.forEach(x => {
    if (x.n >= 30 && (!best || x.pct > best.pct || (x.pct === best.pct && x.n > best.n))) best = x;
    if (x.n > 0 && (!peak || x.n > peak.n)) peak = x;
  });
  out.bestHour = best; out.peakHour = peak;
  out.hoursTotal = hrs.reduce((a, x) => a + x.n, 0);

  const f = (meta.forecast || []).map(n_);
  if (f.length) {
    let n7 = 0, n30 = 0, pk = null;
    for (let i = 1; i < f.length && i <= 30; i++) {
      n30 += f[i]; if (i <= 7) n7 += f[i];
      if (!pk || f[i] > pk.n) pk = { day: i, n: f[i] };
    }
    const secPer = out.d30.secPer;
    out.forecast = {
      days: f, dueNow: f[0], next7: n7, next30: n30,
      avg7: r1_(n7 / 7), avg30: r1_(n30 / 30), peak: pk,
      minutes7: secPer ? r1_((n7 / 7) * secPer / 60) : null
    };
  }

  // Темп новых карточек: большее из двух средних — по завершённым дням и вместе с сегодняшним (как для First Aid и UWorld)
  const lenC = Math.max(1, Math.min(14, elapsed)), lenI = avail(14); let sumC = 0;
  for (let k = lenC; k >= 1; k--) { const x = by[addDays_(ref, -k)]; if (x) sumC += x.nw; }
  const p14 = Math.max(sumC / lenC, d14.nw / lenI);
  out.newPace = { p7: r1_(w7.nw / avail(7)), p14: r1_(p14), p30: r1_(d30.nw / avail(30)) };
  const remaining = last ? n_(last.remaining) : (meta.states ? n_(meta.states.new_all) : 0);
  const need = (daysLeft != null && daysLeft > 0 && remaining > 0) ? Math.ceil(remaining / daysLeft) : null;
  const finish = (remaining > 0 && p14 > 0) ? proj_(remaining, p14, realToday || ref) : null;
  out.finish = {
    remaining: remaining, perDay: r1_(p14), need: need, days: finish ? finish.days : null,
    date: finish ? finish.date : null, ok: (need != null && p14 > 0) ? (p14 >= need) : null
  };

  out.streak = { current: n_(meta.streak), longest: n_(meta.longest_streak) };
  out.totals = {
    reviews: n_(meta.rev_total), hours: r1_(n_(meta.min_total) / 60), first: meta.first_review || '',
    spanDays: (meta.first_review && isDate_(meta.first_review)) ? daysBetween_(meta.first_review, ref) : 0
  };
  const synced = meta.synced_at ? String(meta.synced_at).slice(0, 10) : '';
  out.sync = {
    at: meta.synced_at || '', scope: meta.activity_scope || '',
    staleDays: (isDate_(synced) && realToday) ? Math.max(0, daysBetween_(synced, realToday)) : null,
    historyDays: daily.length
  };
  return out;
}

/** Сколько дней назад Anki присылал данные в последний раз (по метке синхронизации или последнему снимку). */
function staleDays_(meta, last, today) {
  const s = (meta && meta.synced_at) ? String(meta.synced_at).slice(0, 10) : (last ? last.date : '');
  return isDate_(s) ? Math.max(0, daysBetween_(s, today)) : null;
}

/* ============================ КАЧЕСТВО ДАННЫХ ============================ */
function quality_(ctx) {
  const w = [];
  if (!ctx.exam) w.push({ code: 'no_exam' });
  const noTotal = ctx.fa.filter(r => !r.total).length;
  if (noTotal) w.push({ code: 'fa_no_total', n: noTotal });
  ctx.fa.forEach(r => {
    if (r.total > 0 && r.rawDone > r.total)
      w.push({ code: 'fa_over', system: r.system, done: r.rawDone, total: r.total });
  });
  if (ctx.unknownLogs) w.push({ code: 'unknown_system', n: ctx.unknownLogs });
  if (ctx.badUw) w.push({ code: 'uw_bad', n: ctx.badUw });
  if (ctx.uwQuestions > ctx.uwTotal) w.push({ code: 'uw_over', done: ctx.uwQuestions, total: ctx.uwTotal });
  ctx.nbme.forEach(x => { if (x.score > 0 && !isDate_(x.date)) w.push({ code: 'nbme_no_date', exam: x.exam }); });
  if (!ctx.ankiRows) w.push({ code: 'anki_none' });
  else if (ctx.stale != null && ctx.stale >= 2) w.push({ code: 'anki_stale', days: ctx.stale });
  return w;
}

/* ============================ ГЛАВНЫЙ ОТВЕТ ============================ */
function getAll(todayArg, k) {
  needAuth_({ k: k });
  setToday_(todayArg);
  return build_();
}

function build_() {
  ensureAll_();
  const set = getSettings();
  const today = todayStr_();
  const exam = isDate_(d_(set.exam_date)) ? d_(set.exam_date) : '';
  const days = exam ? Math.max(0, daysBetween_(today, exam)) : null;
  const sysSet = {};

  // --- First Aid ---
  const logRows = rows_(SH.LOG);
  const logs = [];
  logRows.forEach((r, i) => {
    const date = d_(r[0]), system = String(r[1] || '').trim();
    if (!date && !system) return;
    logs.push({ row: i + 2, date: date, system: system, pages: n_(r[2]), note: String(r[3] || '') });
  });
  const doneBySys = {};
  logs.forEach(l => { doneBySys[l.system] = (doneBySys[l.system] || 0) + l.pages; });

  const fa = rows_(SH.FA).map(r => {
    const name = String(r[0] || '').trim(), total = n_(r[1]);
    sysSet[name] = true;
    const raw = doneBySys[name] || 0;
    const done = total > 0 ? Math.min(raw, total) : raw;
    return { system: name, total: total, done: done, rawDone: raw,
      left: total ? Math.max(0, total - done) : 0, pct: total ? Math.min(1, done / total) : 0 };
  }).filter(x => x.system);
  const faTotal = fa.reduce((a, b) => a + b.total, 0);
  const faDone = fa.reduce((a, b) => a + (b.total ? b.done : 0), 0);   // без систем, где объём не задан
  const faLeft = Math.max(0, faTotal - faDone);
  const unknownLogs = logs.filter(l => !sysSet[l.system]).length;

  // --- UWorld ---
  const uwRows = [];
  rows_(SH.UW).forEach((r, i) => {
    const date = d_(r[0]);
    const q = n_(r[2]), c = n_(r[3]);
    if (!(q > 0)) return;
    uwRows.push({ row: i + 2, date: date, system: String(r[1] || '').trim(), q: q, correct: c, note: String(r[4] || ''), systems: parseList_(r[5]), breakdown: parseBreakdown_(r[6]) });
  });
  const badUw = uwRows.filter(x => x.correct > x.q || x.correct < 0).length;
  const uwQ = uwRows.reduce((a, b) => a + b.q, 0);
  const uwC = uwRows.reduce((a, b) => a + Math.min(b.correct, b.q), 0);
  const bySys = {};
  const mixed = { q: 0, c: 0, blocks: 0, attributed: 0 };         // блоки по нескольким системам
  uwRows.forEach(x => {
    if (isMulti_(x.system)) {
      mixed.q += x.q; mixed.c += Math.min(x.correct, x.q); mixed.blocks++;
      x.breakdown.forEach(b => { const g = bySys[b.system] || (bySys[b.system] = { q: 0, c: 0 }); g.q += b.q; g.c += Math.min(b.c, b.q); mixed.attributed += b.q; });
      return;
    }
    const g = bySys[x.system] || (bySys[x.system] = { q: 0, c: 0 });
    g.q += x.q; g.c += Math.min(x.correct, x.q);
  });
  const uwTotal = n_(set.uworld_total) || 3200;
  const uwLeft = Math.max(0, uwTotal - uwQ);

  // --- NBME ---
  const nbme = rows_(SH.NBME).map(r => ({
    exam: String(r[0] || ''), date: d_(r[1]), score: n_(r[2]), note: String(r[3] || '')
  })).filter(x => x.exam);

  // --- темп и прогнозы ---
  const pwFa = paceWin_(logs, 'pages', today, 14), pwUw = paceWin_(uwRows, 'q', today, 14);
  const Wfa = pwFa.W, Wuw = pwUw.W;
  const paceFa = pwFa.sum / Wfa, paceUw = pwUw.sum / Wuw;   // точный темп — для расчётов
  const pagesPerDay = r1_(paceFa), qPerDay = r1_(paceUw);                                                          // округлённый — только для показа
  const forecast = {
    pagesPerDay: pagesPerDay, qPerDay: qPerDay, windowFa: Wfa, windowUw: Wuw,
    faLeft: faLeft, uwLeft: uwLeft,
    faNeed: (days != null && faLeft > 0) ? Math.ceil(faLeft / Math.max(1, days)) : null,
    uwNeed: (days != null && uwLeft > 0) ? Math.ceil(uwLeft / Math.max(1, days)) : null,
    faProj: proj_(faLeft, paceFa, today),
    uwProj: proj_(uwLeft, paceUw, today),
    nbme: nbmeTrend_(nbme, exam, today)
  };

  // --- Anki ---
  const snaps = readAnkiSnapshots_();
  const last = snaps.length ? snaps[snaps.length - 1] : null;
  const aday = readAnkiDaily_();
  const atop = readAnkiTopics_();
  const ameta = readAnkiMeta_();
  const ref = (ameta.anki_today && isDate_(String(ameta.anki_today))) ? String(ameta.anki_today) : today;
  const analysis = ankiAnalysis_(aday, ameta, last, ref, days, today);

  // --- умные прогнозы ---
  const lastAct = {};
  logs.concat(uwRows).forEach(x => {
    const touched = isMulti_(x.system) ? x.systems.concat(x.breakdown.map(b => b.system)) : [x.system];
    touched.forEach(sy => { if (x.date && (!lastAct[sy] || x.date > lastAct[sy])) lastAct[sy] = x.date; });
  });
  const sysRows = fa.map(f => {
    const u = bySys[f.system] || { q: 0, c: 0 };
    return { system: f.system, total: f.total, done: f.done, left: f.left, pct: f.pct, uq: u.q, upct: u.q ? Math.min(u.c, u.q) / u.q : 0, last: lastAct[f.system] || '' };
  });
  const pages7 = sumRange_(logs, 'pages', today, 7, 1), pagesPrev7 = sumRange_(logs, 'pages', today, 14, 8);   // 7 завершённых дней против предыдущих 7
  const q7 = sumRange_(uwRows, 'q', today, 7, 1), qPrev7 = sumRange_(uwRows, 'q', today, 14, 8);
  const needNew = (analysis.finish && analysis.finish.need) ? analysis.finish.need : null;
  // Прирост показывается только если история покрывает две полные недели (иначе «+200 %» у новичка — артефакт неполной прошлой недели)
  const histDays = items => { const ds = items.filter(x => isDate_(x.date) && x.date <= today).map(x => x.date); return ds.length ? daysBetween_(ds.reduce((p, q) => (p < q ? p : q)), today) : 0; };
  forecast.trend = { pages: histDays(logs) >= 14 ? pctChange_(pages7, pagesPrev7) : null, q: histDays(uwRows) >= 14 ? pctChange_(q7, qPrev7) : null, anki: analysis.delta ? analysis.delta.n : null };
  forecast.slack = { fa: slack_(days, faLeft, paceFa), uw: slack_(days, uwLeft, paceUw),
    anki: (analysis.finish && analysis.finish.days != null && days != null) ? days - analysis.finish.days : null };
  // Норма на сегодня считается от остатка НА НАЧАЛО дня: иначе она уменьшалась бы по мере вашей работы («403 из 30»)
  const doneStart = {}; logs.forEach(l => { if (l.date !== today) doneStart[l.system] = (doneStart[l.system] || 0) + l.pages; });
  const faLeftStart = fa.reduce((a, f) => a + (f.total ? Math.max(0, f.total - Math.min(doneStart[f.system] || 0, f.total)) : 0), 0);
  const qToday = sumRange_(uwRows, 'q', today, 0, 0), uwLeftStart = Math.max(0, uwTotal - (uwQ - qToday));
  const videos = videosSummary_(today);                                    // видео нужны и для цели дня, и для ответа
  const vidWatchedTodaySec = videos.items.filter(v => v.w === today).reduce((a, v) => a + v.sec, 0), vidLeftStartSec = videos.stats.leftSec + vidWatchedTodaySec;   // остаток на НАЧАЛО дня: цель не «уезжает» при просмотре
  forecast.today = {
    vid: { done: Math.round(vidWatchedTodaySec / 60), goal: (days != null && vidLeftStartSec > 0) ? Math.ceil(vidLeftStartSec / 60 / Math.max(1, days)) : null },
    pages: { done: sumRange_(logs, 'pages', today, 0, 0), goal: (days != null && faLeftStart > 0) ? Math.ceil(faLeftStart / Math.max(1, days)) : null },
    q: { done: qToday, goal: (days != null && uwLeftStart > 0) ? Math.ceil(uwLeftStart / Math.max(1, days)) : null },
    nw: { done: analysis.today ? analysis.today.nw : 0, goal: needNew }
  };
  const nbDone = nbme.filter(x => x.score > 0).sort((a, b) => (a.date < b.date ? -1 : (a.date > b.date ? 1 : 0)));
  forecast.exam = examReadiness_({ days: days, faTotal: faTotal, faDone: faDone, pagesPerDay: paceFa, uwTotal: uwTotal, uwQ: uwQ,
    uwPct: uwQ ? uwC / uwQ : 0, qPerDay: paceUw, target: n_(set.target_score) || 240,
    nbLast: nbDone.length ? nbDone[nbDone.length - 1].score : 0, nbProjected: forecast.nbme && forecast.nbme.projected });
  forecast.focus = focusRank_(sysRows, today);
  const pw7fa = paceWin_(logs, 'pages', today, 7), pw7uw = paceWin_(uwRows, 'q', today, 7);
  forecast.check = { fa: backtestPace_(dayMap_(logs, 'pages'), today, 7), uw: backtestPace_(dayMap_(uwRows, 'q'), today, 7) };
  forecast.active = { fa: activeIn_(logs, 'pages', pwFa.from, pwFa.to), uw: activeIn_(uwRows, 'q', pwUw.from, pwUw.to) };
  forecast.raw = { fa: paceFa, uw: paceUw };
  forecast.sum = { fa: pwFa.sum, uw: pwUw.sum };
  forecast.pace7 = { fa: r1_(pw7fa.sum / pw7fa.W), uw: r1_(pw7uw.sum / pw7uw.W) };
  forecast.conf = {
    fa: confidence_(Wfa, forecast.active.fa, forecast.check.fa && forecast.check.fa.wape),
    uw: confidence_(Wuw, forecast.active.uw, forecast.check.uw && forecast.check.uw.wape),
    nbme: nbmeConfidence_(forecast.nbme)
  };
  forecast.range = {
    fa: paceRangePct_(faLeft, dayMap_(logs, 'pages'), today, pw7fa.sum / pw7fa.W, paceFa),
    uw: paceRangePct_(uwLeft, dayMap_(uwRows, 'q'), today, pw7uw.sum / pw7uw.W, paceUw)
  };
  forecast.budget = budgetCalc_({ days: days, pagesGoal: forecast.today.pages.goal, qGoal: forecast.today.q.goal, newGoal: forecast.today.nw.goal, vidGoal: forecast.today.vid.goal,
    dueAvg7: (analysis.forecast && analysis.forecast.avg7) || 0, secPer: (analysis.d30 && analysis.d30.secPer) || 0, minPage: n_(set.min_page) || 6, minQ: n_(set.min_q) || 2.5, hours: n_(set.hours_day) || 8 });
  forecast.ankiNote = { remaining: analysis.finish ? analysis.finish.remaining : 0, suspended: n_(ameta.states && ameta.states.suspended), available: n_(ameta.states && ameta.states.new) };

  return {
    version: VERSION, today: today, share: shareInfo_(),
    settings: {
      exam_date: exam, target_score: n_(set.target_score) || 240, uworld_total: uwTotal,
      api_key: String(set.api_key || ''), student_name: String(set.student_name || ''),
      webapp_url: ScriptApp.getService().getUrl() || '',
      ui_theme: ['auto', 'light', 'dark'].indexOf(String(set.ui_theme)) > -1 ? String(set.ui_theme) : 'auto',
      ui_lang: String(set.ui_lang) === 'en' ? 'en' : 'ru',
      ui_font: ['xs', 's', 'm', 'l', 'xl'].indexOf(String(set.ui_font)) > -1 ? String(set.ui_font) : 'm',
      site_url: String(set.site_url || ''),
      tz_offset: (String(set.tz_offset) !== '' && set.tz_offset !== undefined && isFinite(Number(set.tz_offset))) ? Number(set.tz_offset) : null,
      tz_name: String(set.tz_name || ''),
      hours_day: n_(set.hours_day) || 8, min_page: n_(set.min_page) || 6, min_q: n_(set.min_q) || 2.5,
      yt_key_set: !!String(set.yt_api_key || ''), yt_key_hint: String(set.yt_api_key || '').slice(-4)
    },
    days: days,
    systems: SYSTEMS,
    firstaid: { rows: fa, total: faTotal, done: faDone, left: faLeft, pct: faTotal ? faDone / faTotal : 0 },
    logs: logs.slice().reverse().slice(0, 400),
    uworld: {
      rows: uwRows.slice().reverse().slice(0, 400), questions: uwQ, correct: uwC, mixed: mixed,
      pct: uwQ ? uwC / uwQ : 0, total: uwTotal,
      bySystem: Object.keys(bySys).map(k => ({
        system: k, q: bySys[k].q, c: bySys[k].c, pct: bySys[k].q ? bySys[k].c / bySys[k].q : 0
      })).sort((a, b) => b.q - a.q)
    },
    nbme: nbme,
    forecast: forecast,
    anki: { rows: snaps.slice(-120), last: last, daily: aday, topics: atop, meta: ameta, analysis: analysis },
    videos: videos,
    errors: errorsSummary_(), backup: backupInfo_(),
    library: librarySummary_(),
    planner: plannerSummary_(today),
    quality: quality_({
      exam: exam, fa: fa, unknownLogs: unknownLogs, badUw: badUw, uwQuestions: uwQ, uwTotal: uwTotal,
      nbme: nbme, ankiRows: snaps.length || aday.length, stale: staleDays_(ameta, last, today)
    })
  };
}

/* ============================ ВАЛИДАЦИЯ ============================ */
function fail_(code) { throw new Error('E_' + code); }
function needDate_(s, allowEmpty) {
  s = d_(s);
  if (!s) { if (allowEmpty) return ''; fail_('DATE'); }
  if (!isDate_(s)) fail_('DATE');
  if (daysBetween_(todayStr_(), s) > 1) fail_('FUTURE');
  return s;
}
function needSystem_(s) {
  s = String(s || '').trim();
  const known = {};
  rows_(SH.FA).forEach(r => { known[String(r[0] || '').trim()] = true; });
  if (!s || !known[s]) fail_('SYSTEM');
  return s;
}
function needInt_(v, lo, hi, code) {
  const x = Number(v);
  if (!isFinite(x) || Math.floor(x) !== x || x < lo || x > hi) fail_(code);
  return x;
}

/* ============================ ЗАПИСЬ ============================ */
function saveSettings(obj) {
  needAuth_(obj);
  setToday_(obj && obj.today);
  ensureAll_();
  obj = obj || {};
  const clean = {};
  if (obj.exam_date !== undefined) {
    const e = d_(obj.exam_date);
    if (e && !isDate_(e)) fail_('DATE');
    clean.exam_date = e;
  }
  if (obj.target_score !== undefined) clean.target_score = needInt_(obj.target_score, 100, 300, 'SCORE');
  if (obj.uworld_total !== undefined) clean.uworld_total = needInt_(obj.uworld_total, 100, 10000, 'TOTAL');
  if (obj.student_name !== undefined) clean.student_name = String(obj.student_name).trim().slice(0, 40);
  if (obj.site_url !== undefined) {
    const u = String(obj.site_url).trim();
    if (u && !/^https:\/\/[^\s<>"']{4,180}$/i.test(u)) fail_('SITE');
    clean.site_url = u;
  }
  if (obj.ui_theme !== undefined && ['auto', 'light', 'dark'].indexOf(obj.ui_theme) > -1) clean.ui_theme = obj.ui_theme;
  if (obj.ui_lang !== undefined && ['ru', 'en'].indexOf(obj.ui_lang) > -1) clean.ui_lang = obj.ui_lang;
  if (obj.tz_offset !== undefined) { const tzv = Number(obj.tz_offset); if (isFinite(tzv) && Math.floor(tzv) === tzv && tzv >= -720 && tzv <= 840) clean.tz_offset = tzv; }
  if (obj.tz_name !== undefined) { const tzn = String(obj.tz_name).trim(); if (tzn === '') clean.tz_name = ''; else if (/^[A-Za-z][A-Za-z0-9_+\-]{0,40}(\/[A-Za-z0-9_+\-]{1,40}){0,2}$/.test(tzn) && tzNameOk_(tzn)) clean.tz_name = tzn; }
  if (obj.ui_font !== undefined && ['xs', 's', 'm', 'l', 'xl'].indexOf(obj.ui_font) > -1) clean.ui_font = obj.ui_font;
  const numIn = (v, lo, hi, step) => { const x = Number(v); return (v !== '' && v !== null && isFinite(x) && x >= lo && x <= hi) ? Math.round(x / step) * step : null; };
  if (obj.hours_day !== undefined) { const v = numIn(obj.hours_day, 1, 16, 0.5); if (v !== null) clean.hours_day = v; }
  if (obj.min_page !== undefined) { const v = numIn(obj.min_page, 1, 60, 0.5); if (v !== null) clean.min_page = v; }
  if (obj.min_q !== undefined) { const v = numIn(obj.min_q, 0.5, 20, 0.1); if (v !== null) clean.min_q = Math.round(v * 10) / 10; }

  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SET);
  const vals = sh.getDataRange().getValues();
  const idx = {};
  for (let i = 1; i < vals.length; i++) idx[String(vals[i][0]).trim()] = i + 1;
  Object.keys(clean).forEach(k => {
    if (idx[k]) sh.getRange(idx[k], 2).setValue(clean[k]);
    else sh.appendRow([k, clean[k]]);
  });
  return build_();
}

function savePages(o) {
  needAuth_(o);     // {system, total}
  setToday_(o && o.today);
  ensureAll_();
  const total = needInt_(o.total, 0, 5000, 'TOTAL');
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.FA);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === String(o.system).trim()) {
      sh.getRange(i + 1, 2).setValue(total);
      return build_();
    }
  }
  fail_('SYSTEM');
}

function addLog(o) {
  needAuth_(o);        // {date, system, pages, note}
  setToday_(o && o.today);
  ensureAll_();
  const date = needDate_(o.date || todayStr_());
  const system = needSystem_(o.system);
  const pages = needInt_(o.pages, 1, 2000, 'PAGES');
  SpreadsheetApp.getActive().getSheetByName(SH.LOG)
    .appendRow([date, system, pages, String(o.note || '').slice(0, 200)]);
  return build_();
}

function addUWorld(o) {
  needAuth_(o);     // {date, system | 'Multi' + systems[] | 'All', q, correct, note, breakdown:[{system,q,correct}]}
  setToday_(o && o.today);
  ensureAll_();
  const date = needDate_(o.date || todayStr_());
  const q = needInt_(o.q, 1, 400, 'Q');
  const c = needInt_(o.correct, 0, q, 'CORRECT');
  const note = String(o.note || '').slice(0, 200);
  const raw = String(o.system || '').trim();
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.UW);
  if (raw !== 'Multi' && raw !== 'All') {                 // обычный блок по одной системе
    sh.appendRow([date, needSystem_(raw), q, c, note, '', '']);
    return build_();
  }
  let systems = [];
  if (raw === 'Multi') {                                   // блок по нескольким системам
    systems = Array.isArray(o.systems) ? o.systems.map(x => needSystem_(x)) : [];
    systems = systems.filter((x, i) => systems.indexOf(x) === i);
    if (systems.length < 2) fail_('MULTI');
  }
  const bd = [];
  (Array.isArray(o.breakdown) ? o.breakdown : []).forEach(b => {   // необязательная разбивка по системам
    const sy = needSystem_(b.system);
    if (raw === 'Multi' && systems.indexOf(sy) < 0) fail_('MULTI');
    const bq = needInt_(b.q, 1, q, 'Q'), bc = needInt_(b.correct, 0, bq, 'CORRECT');
    if (bd.some(x => x.system === sy)) fail_('MULTI');
    bd.push({ system: sy, q: bq, c: bc });
  });
  if (bd.reduce((a, b) => a + b.q, 0) > q || bd.reduce((a, b) => a + b.c, 0) > c) fail_('MULTI');
  sh.appendRow([date, raw, q, c, note, systems.join(','), bd.map(b => b.system + ':' + b.q + ':' + b.c).join('|')]);
  return build_();
}
function isMulti_(sys) { return sys === 'Multi' || sys === 'All'; }
function parseList_(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }
function parseBreakdown_(v) {
  return String(v || '').split('|').map(p => p.split(':')).filter(p => p.length === 3 && p[0])
    .map(p => ({ system: p[0].trim(), q: Number(p[1]) || 0, c: Number(p[2]) || 0 })).filter(b => b.q > 0);
}

function saveNBME(o) {
  needAuth_(o);      // {exam, date, score, note}
  setToday_(o && o.today);
  ensureAll_();
  const exam = String(o.exam || '').trim();
  if (!exam) fail_('EXAM');
  const date = needDate_(o.date, true);
  const score = Number(o.score) || 0;
  if (score !== 0 && (score < 100 || score > 300)) fail_('SCORE');
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.NBME);
  const vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === exam) {
      sh.getRange(i + 1, 2, 1, 3).setValues([[date, score || '', String(o.note || '').slice(0, 200)]]);
      return build_();
    }
  }
  sh.appendRow([exam, date, score || '', String(o.note || '').slice(0, 200)]);
  return build_();
}

/** Удаление записи из дневника / UWorld. Перед удалением сверяем содержимое строки. */
function deleteEntry(o) {
  needAuth_(o);   // {kind:'log'|'uw', row, date, system}
  setToday_(o && o.today);
  ensureAll_();
  const sh = SpreadsheetApp.getActive().getSheetByName(o.kind === 'uw' ? SH.UW : SH.LOG);
  const row = Number(o.row);
  if (!(row >= 2 && row <= sh.getLastRow())) fail_('STALE');
  const cur = sh.getRange(row, 1, 1, 2).getValues()[0];
  if (d_(cur[0]) !== String(o.date) || String(cur[1]).trim() !== String(o.system).trim()) fail_('STALE');
  sh.deleteRow(row);
  return build_();
}

/* ============================ ВИДЕО (YouTube) ============================ */
function ytExtractId_(v) {
  v = String(v || '').trim();
  let m = v.match(/[?&]list=([A-Za-z0-9_-]{10,})/);
  if (m) return m[1];
  if (!/^https?:/i.test(v) && /^[A-Za-z0-9_-]{10,64}$/.test(v)) return v;
  return '';
}
/** ISO 8601 → секунды: PT1H2M3S, PT45S, P1DT2H, P0D */
function ytDuration_(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso || ''));
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}
function ytKey_() { return String(getSettings().yt_api_key || '').trim(); }
function ytGet_(path, params, key) {
  const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const res = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/' + path + '?' + qs + '&key=' + encodeURIComponent(key), { muteHttpExceptions: true });
  const code = res.getResponseCode();
  let body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { body = {}; }
  if (code !== 200) {
    const er = (body.error && body.error.errors && body.error.errors[0]) || {};
    const reason = String(er.reason || ''), txt = JSON.stringify(body.error || {});
    if (/quota/i.test(reason)) fail_('YTQUOTA');
    if (/keyInvalid/i.test(reason) || /API key not valid/i.test(txt)) fail_('YTKEY');
    if (/accessNotConfigured|SERVICE_DISABLED/i.test(reason + txt)) fail_('YTAPI');
    if (/playlistNotFound/i.test(reason) || code === 404) fail_('YTNOTFOUND');
    if (/forbidden|private/i.test(reason)) fail_('YTPRIVATE');
    fail_('YT');
  }
  return body;
}
function ytFetchPlaylist_(id, key) {
  const meta = ytGet_('playlists', { part: 'snippet', id: id }, key);
  if (!meta.items || !meta.items.length) fail_('YTNOTFOUND');
  const title = String(meta.items[0].snippet.title || id).slice(0, 120);
  const items = [], seen = {};
  let token = '', guard = 0;
  do {
    const p = { part: 'snippet,contentDetails', maxResults: 50, playlistId: id };
    if (token) p.pageToken = token;
    const r = ytGet_('playlistItems', p, key);
    (r.items || []).forEach(it => {
      const vid = (it.contentDetails && it.contentDetails.videoId) || (it.snippet && it.snippet.resourceId && it.snippet.resourceId.videoId);
      const ttl = String((it.snippet && it.snippet.title) || '');
      if (!vid || seen[vid] || ttl === 'Deleted video' || ttl === 'Private video') return;     // удалённые и приватные пропускаем
      seen[vid] = true;
      items.push({ id: vid, title: ttl.slice(0, 160), pos: n_(it.snippet.position), sec: 0 });
    });
    token = r.nextPageToken || '';
  } while (token && ++guard < 20 && items.length < 1000);
  for (let i = 0; i < items.length; i += 50) {
    const chunk = items.slice(i, i + 50);
    const v = ytGet_('videos', { part: 'contentDetails', id: chunk.map(x => x.id).join(',') }, key);
    const dur = {};
    (v.items || []).forEach(x => { dur[x.id] = ytDuration_(x.contentDetails && x.contentDetails.duration); });
    chunk.forEach(x => { x.sec = dur[x.id] || 0; });
  }
  items.sort((a, b) => a.pos - b.pos);
  items.forEach((x, i) => { x.pos = i + 1; });                 // позиции подряд: 1, 2, 3 …
  return { title: title, items: items };
}
function readVideos_() {
  return rows_(SH.VID).map((r, i) => ({ row: i + 2, id: String(r[0] || ''), pl: String(r[1] || ''), pos: n_(r[2]), title: String(r[3] || ''), sec: n_(r[4]), w: d_(r[5]) }))
    .filter(x => x.id && x.pl);
}
function readPlaylists_() {
  return rows_(SH.PL).map(r => ({ id: String(r[0] || ''), title: String(r[1] || ''), system: String(r[2] || ''), updated: d_(r[4]) })).filter(x => x.id);
}
function writeSheetBody_(name, head, rows) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, head.length).clearContent();
  if (rows.length) { const rg = sh.getRange(2, 1, rows.length, head.length); rg.setNumberFormat('@'); rg.setValues(rows); }
}
function appendText_(name, row) {         // добавить строку как простой текст (защита от формул вида =HYPERLINK(...))
  const sh = SpreadsheetApp.getActive().getSheetByName(name), r = sh.getLastRow() + 1, rg = sh.getRange(r, 1, 1, row.length);
  rg.setNumberFormat('@'); rg.setValues([row]);
}
function videosSummary_(today) {
  const key = ytKey_(), pls = readPlaylists_(), vids = readVideos_();
  const byPl = {};
  vids.forEach(v => { (byPl[v.pl] || (byPl[v.pl] = [])).push(v); });
  let total = 0, watched = 0, leftSec = 0, wSecAll = 0;
  const playlists = pls.map(p => {
    const list = byPl[p.id] || [];
    const w = list.filter(x => x.w), tSec = list.reduce((a, b) => a + b.sec, 0), wSec = w.reduce((a, b) => a + b.sec, 0);
    total += list.length; watched += w.length; leftSec += tSec - wSec; wSecAll += wSec;
    return { id: p.id, title: p.title, system: p.system, count: list.length, watched: w.length, totalSec: tSec, watchedSec: wSec, updated: p.updated };
  });
  const dates = vids.filter(v => isDate_(v.w)).map(v => v.w);
  const W = windowDays_(dates, today, 14), from = addDays_(today, -(W - 1));
  const rec = vids.filter(v => isDate_(v.w) && v.w >= from && v.w <= today);
  const perDay = rec.length / W, secPerDay = rec.reduce((a, b) => a + b.sec, 0) / W;
  const fin = proj_(leftSec, secPerDay, today);
  return {
    hasKey: !!key, playlists: playlists,
    items: vids.map(v => ({ id: v.id, pl: v.pl, pos: v.pos, title: v.title, sec: v.sec, w: v.w })),
    stats: { total: total, watched: watched, leftSec: leftSec, watchedSec: wSecAll, perDay: r1_(perDay), secPerDay: Math.round(secPerDay), windowDays: W,
      finish: fin ? { days: fin.days, date: fin.date } : null }
  };
}
function ytSetKey(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const k = String((o && o.key) || '').trim();
  if (k && !/^[A-Za-z0-9_-]{20,80}$/.test(k)) fail_('YTKEY');
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SET), vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim() === 'yt_api_key') { sh.getRange(i + 1, 2).setValue(k); return build_(); }
  sh.appendRow(['yt_api_key', k]);
  return build_();
}
/** Добавить плейлист или обновить существующий (отметки «просмотрено» сохраняются). */
function ytAddPlaylist(o) {   // {url, system}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const id = ytExtractId_(o.url);
  if (!id) fail_('YTURL');
  const key = ytKey_();
  if (!key) fail_('YTNOKEY');
  const sys = String(o.system || '').trim();
  if (sys) needSystem_(sys);
  const data = ytFetchPlaylist_(id, key);
  const oldVids = readVideos_(), watchedMap = {};
  oldVids.filter(v => v.pl === id).forEach(v => { if (v.w) watchedMap[v.id] = v.w; });
  const keep = oldVids.filter(v => v.pl !== id).map(v => [v.id, v.pl, v.pos, v.title, v.sec, v.w]);
  const fresh = data.items.map(x => [x.id, id, x.pos, x.title, x.sec, watchedMap[x.id] || '']);
  writeSheetBody_(SH.VID, VID_HEAD, keep.concat(fresh));
  const pls = readPlaylists_().filter(p => p.id !== id);
  const prev = readPlaylists_().find(p => p.id === id);
  const rows = pls.map(p => [p.id, p.title, p.system, 0, p.updated]);
  rows.push([id, data.title, sys || (prev ? prev.system : ''), data.items.length, todayStr_()]);
  writeSheetBody_(SH.PL, PL_HEAD, rows);
  return build_();
}
function ytSetSystem(o) {     // {id, system}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const sys = String(o.system || '').trim();
  if (sys) needSystem_(sys);
  const pls = readPlaylists_();
  if (!pls.some(p => p.id === o.id)) fail_('STALE');
  writeSheetBody_(SH.PL, PL_HEAD, pls.map(p => [p.id, p.title, p.id === o.id ? sys : p.system, 0, p.updated]));
  return build_();
}
function ytRemove(o) {        // {id}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const pls = readPlaylists_();
  if (!pls.some(p => p.id === o.id)) fail_('STALE');
  writeSheetBody_(SH.PL, PL_HEAD, pls.filter(p => p.id !== o.id).map(p => [p.id, p.title, p.system, 0, p.updated]));
  writeSheetBody_(SH.VID, VID_HEAD, readVideos_().filter(v => v.pl !== o.id).map(v => [v.id, v.pl, v.pos, v.title, v.sec, v.w]));
  return build_();
}
function ytMark(o) {          // {pl, id, watched}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const vids = readVideos_(), v = vids.find(x => x.pl === o.pl && x.id === o.id);
  if (!v) fail_('STALE');
  const cell = SpreadsheetApp.getActive().getSheetByName(SH.VID).getRange(v.row, 6);
  cell.setNumberFormat('@'); cell.setValue(o.watched ? todayStr_() : '');
  return o.light === true ? okLight_() : build_();
}
/** Один раз запусти вручную из редактора: Google попросит разрешение на внешние запросы (нужно для YouTube). */
function authorize_() {
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis?name=youtube', { muteHttpExceptions: true });
  SpreadsheetApp.getActive();
}

/* ============================ БИБЛИОТЕКА: флажки, заметки, карточки ============================ */
function readFlags_() { return rows_(SH.FLAG).map((r, i) => ({ row: i + 2, id: String(r[0] || ''), pl: String(r[1] || ''), at: d_(r[2]) })).filter(x => x.id && x.pl); }
function readNotes_() { return rows_(SH.NOTE).map((r, i) => ({ row: i + 2, id: String(r[0] || ''), vid: String(r[1] || ''), pl: String(r[2] || ''), sec: n_(r[3]), text: String(r[4] || ''), at: d_(r[5]) })).filter(x => x.id); }
function readCards_() {
  return rows_(SH.CARD).map((r, i) => ({ row: i + 2, id: String(r[0] || ''), note: String(r[1] || ''), vid: String(r[2] || ''), pl: String(r[3] || ''),
    front: String(r[4] || ''), back: String(r[5] || ''), system: String(r[6] || ''), due: d_(r[7]), ivl: n_(r[8]), ease: n_(r[9]) || 2.5,
    reps: n_(r[10]), lapses: n_(r[11]), at: d_(r[12]), last: d_(r[13]) })).filter(x => x.id);
}
function librarySummary_() {
  const strip = x => { const o = {}; Object.keys(x).forEach(k => { if (k !== 'row') o[k] = x[k]; }); return o; };
  return { flags: readFlags_().map(strip), notes: readNotes_().map(strip), cards: readCards_().map(strip) };
}
function needVideo_(pl, id) { if (!readVideos_().some(v => v.pl === String(pl) && v.id === String(id))) fail_('STALE'); }
function needNewId_(id, prefix, list) {
  id = String(id || '');
  if (!new RegExp('^' + prefix + '_[a-z0-9]{8,24}$').test(id) || list.some(x => x.id === id)) fail_('ID');
  return id;
}
function needText_(v, max, code) { v = String(v == null ? '' : v).replace(/\r/g, '').trim(); if (!v || v.length > max) fail_(code); return v; }
function needSec_(v) { v = (v === undefined || v === '' || v === null) ? 0 : Number(v); if (!isFinite(v) || Math.floor(v) !== v || v < 0 || v > 86400) fail_('SEC'); return v; }
function okLight_() { return { ok: true }; }

function vidFlag(o) {         // {pl, id, flag}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  needVideo_(o.pl, o.id);
  const f = readFlags_().find(x => x.pl === o.pl && x.id === o.id);
  if (o.flag && !f) appendText_(SH.FLAG, [o.id, o.pl, todayStr_()]);
  if (!o.flag && f) SpreadsheetApp.getActive().getSheetByName(SH.FLAG).deleteRow(f.row);
  return okLight_();
}
function noteAdd(o) {         // {id, pl, vid, sec, text}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const all = readNotes_(); if (all.length >= 3000) fail_('LIMIT');
  const id = needNewId_(o.id, 'n', all); needVideo_(o.pl, o.vid);
  appendText_(SH.NOTE, [id, o.vid, o.pl, needSec_(o.sec), needText_(o.text, 2000, 'NOTE'), todayStr_()]);
  return okLight_();
}
function noteEdit(o) {        // {id, text, sec}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const n = readNotes_().find(x => x.id === o.id); if (!n) fail_('STALE');
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.NOTE), rg = sh.getRange(n.row, 4, 1, 2);
  rg.setNumberFormat('@'); rg.setValues([[o.sec === undefined ? n.sec : needSec_(o.sec), needText_(o.text, 2000, 'NOTE')]]);
  return okLight_();
}
function noteDelete(o) {      // {id}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const n = readNotes_().find(x => x.id === o.id); if (!n) fail_('STALE');
  SpreadsheetApp.getActive().getSheetByName(SH.NOTE).deleteRow(n.row);
  return okLight_();
}
function cardAdd(o) {         // {id, note, pl, vid, front, back, system}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const all = readCards_(); if (all.length >= 5000) fail_('LIMIT');
  const id = needNewId_(o.id, 'c', all);
  const sys = String(o.system || '').trim(); if (sys) needSystem_(sys);
  if (o.vid) needVideo_(o.pl, o.vid);
  appendText_(SH.CARD, [id, String(o.note || ''), String(o.vid || ''), String(o.pl || ''), needText_(o.front, 1000, 'CARD'), needText_(o.back, 1000, 'CARD'),
    sys, todayStr_(), 0, 2.5, 0, 0, todayStr_(), '']);
  return okLight_();
}
function cardEdit(o) {        // {id, front, back, system}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const c = readCards_().find(x => x.id === o.id); if (!c) fail_('STALE');
  const sys = String(o.system || '').trim(); if (sys) needSystem_(sys);
  const rg = SpreadsheetApp.getActive().getSheetByName(SH.CARD).getRange(c.row, 5, 1, 3);
  rg.setNumberFormat('@'); rg.setValues([[needText_(o.front, 1000, 'CARD'), needText_(o.back, 1000, 'CARD'), sys]]);
  return okLight_();
}
function cardDelete(o) {      // {id}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const c = readCards_().find(x => x.id === o.id); if (!c) fail_('STALE');
  SpreadsheetApp.getActive().getSheetByName(SH.CARD).deleteRow(c.row);
  return okLight_();
}
/** Клиент считает новое расписание (простая схема SM-2), сервер проверяет допустимость и сохраняет. */
function cardReview(o) {      // {id, due, ivl, ease, reps, lapses}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const c = readCards_().find(x => x.id === o.id); if (!c) fail_('STALE');
  const due = d_(o.due), ivl = Number(o.ivl), ease = Number(o.ease), reps = Number(o.reps), lap = Number(o.lapses);
  if (!isDate_(due) || daysBetween_(todayStr_(), due) > 3650 || daysBetween_(todayStr_(), due) < -1) fail_('CARDSTATE');
  if (!(isFinite(ivl) && ivl >= 0 && ivl <= 3650 && Math.floor(ivl) === ivl)) fail_('CARDSTATE');
  if (!(isFinite(ease) && ease >= 1.3 && ease <= 3.5)) fail_('CARDSTATE');
  if (!(isFinite(reps) && reps >= 0 && reps <= 1000 && Math.floor(reps) === reps)) fail_('CARDSTATE');
  if (!(isFinite(lap) && lap >= 0 && lap <= 1000 && Math.floor(lap) === lap)) fail_('CARDSTATE');
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.CARD);
  const a = sh.getRange(c.row, 8, 1, 5); a.setNumberFormat('@'); a.setValues([[due, ivl, Math.round(ease * 100) / 100, reps, lap]]);
  const b = sh.getRange(c.row, 14, 1, 1); b.setNumberFormat('@'); b.setValues([[todayStr_()]]);
  return okLight_();
}

/* ============================ ПРИЁМ ИЗ ANKI ============================ */
function round1_(x) { return Math.round(n_(x) * 10) / 10; }

function upsertDaily_(incoming) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.ADAY);
  const last = sh.getLastRow();
  const map = {};
  if (last >= 2) {
    sh.getRange(2, 1, last - 1, ADAY_HEAD.length).getValues().forEach(r => {
      const d = d_(r[0]); if (isDate_(d)) map[d] = r.slice();
    });
  }
  let used = 0;
  incoming.forEach(x => {
    const d = String((x && x.d) || '').slice(0, 10);
    if (!isDate_(d)) return;
    const row = [d];
    ADAY_KEYS.forEach(k => { row.push(k === 'm' ? round1_(x[k]) : Math.max(0, Math.round(n_(x[k])))); });
    map[d] = row; used++;
  });
  const keys = Object.keys(map).sort().slice(-400);
  const rows = keys.map(k => map[k]);
  if (last >= 2) sh.getRange(2, 1, last - 1, ADAY_HEAD.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, ADAY_HEAD.length).setValues(rows);
  return used;
}

function replaceTopics_(incoming) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.ATOP);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, ATOP_HEAD.length).clearContent();
  const rows = (incoming || []).slice(0, 80).map(t => {
    const row = [String(t.t || '').slice(0, 80)];
    ATOP_KEYS.forEach(k => { row.push(Math.max(0, Math.round(n_(t[k])))); });
    return row;
  });
  if (rows.length) sh.getRange(2, 1, rows.length, ATOP_HEAD.length).setValues(rows);
  return rows.length;
}

function writeMeta_(meta) {                 // сливаем с имеющейся метой: «живая» отправка присылает только часть полей
  const cur = readAnkiMeta_();
  Object.keys(meta || {}).forEach(k => { cur[k] = meta[k]; });
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.AMETA);
  const last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 2).clearContent();
  const rows = Object.keys(cur).map(k => [k, JSON.stringify(cur[k])]);
  if (rows.length) sh.getRange(2, 1, rows.length, 2).setValues(rows);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    ensureAll_();
    const body = JSON.parse(e.postData.contents);
    const key = String(getSettings().api_key || '');
    if (!key || String(body.key || '') !== key) return json_({ ok: false, error: 'bad key' });
    if (body.push || body.pushOff) return json_(pushFromBody_(body));      // подписка устройства на уведомления

    const live = body.live === true;                  // «живая» отправка во время занятий: только история дня и метка времени
    const today = String((body.meta && body.meta.anki_today) || '') || serverToday_();
    let updated = false;
    if (!live) {
      const row = [today, String(body.scope || ''), n_(body.total), n_(body.learned),
        n_(body.remaining), n_(body.hidden), n_(body.pace), n_(body.leeches), n_(body.avgSec), n_(body.today),
        n_(body.rev_today), n_(body.min_today), n_(body.rev_7d), n_(body.min_7d),
        n_(body.retention), n_(body.streak), n_(body.mature), n_(body.young),
        n_(body.due_tomorrow), n_(body.avg_sec_real),
        n_(body.cnt_new), n_(body.cnt_learn), n_(body.cnt_due),
        n_(body.cnt_overdue), n_(body.cnt_suspended), n_(body.due_week)];
      const sh = SpreadsheetApp.getActive().getSheetByName(SH.ANKI);
      const vals = sh.getDataRange().getValues();
      for (let i = vals.length - 1; i >= 1; i--) {
        if (d_(vals[i][0]) === today) { sh.getRange(i + 1, 1, 1, row.length).setValues([row]); updated = true; break; }
      }
      if (!updated) sh.appendRow(row);
    }

    let days = 0, topics = 0;
    if (Array.isArray(body.daily)) days = upsertDaily_(body.daily);
    if (!live && Array.isArray(body.topics)) topics = replaceTopics_(body.topics);
    if (body.meta && typeof body.meta === 'object') writeMeta_(body.meta);
    return json_({ ok: true, live: live, updated: updated, days: days, topics: topics, version: VERSION });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================ МЕНЮ ТАБЛИЦЫ ============================ */
function onOpen() {
  ensureAll_();
  SpreadsheetApp.getUi().createMenu('📈 USMLE Progress')
    .addItem('Открыть отчёт (ссылка)', 'showUrl')
    .addItem('Показать ключ для Anki', 'showKey')
    .addItem('Включить напоминания (проверка раз в 5 минут)', 'installTriggers')
    .addToUi();
}
function appLink_() {
  const st = getSettings(), u = ScriptApp.getService().getUrl(), k = String(st.api_key || ''), site = String(st.site_url || '').trim();
  if (!u) return null;
  let base = site;
  if (base && !/\.html?$/i.test(base) && !/\/$/.test(base)) base += '/';
  return { direct: u + '?k=' + k, app: base ? (base + '#u=' + encodeURIComponent(u) + '&k=' + encodeURIComponent(k)) : '' };
}
function showUrl() {
  const L = appLink_();
  if (!L) { SpreadsheetApp.getUi().alert('Сначала задеплой: Deploy → New deployment → Web app → Who has access: Anyone.'); return; }
  SpreadsheetApp.getUi().alert((L.app
    ? 'Ссылка для приложения (GitHub, без баннера Google) — открой её один раз на каждом устройстве:\n\n' + L.app + '\n\nЗапасная прямая ссылка (с баннером Google):\n' + L.direct
    : 'Прямая ссылка (с баннером Google; ключ уже внутри, никому не показывай):\n\n' + L.direct +
      '\n\nЧтобы убрать баннер и установить как приложение — укажи GitHub-адрес в разделе «Ещё» на сайте.'));
}
function showKey() {
  const s = getSettings();
  SpreadsheetApp.getUi().alert('Для аддона Anki:\n\nURL:  ' + (ScriptApp.getService().getUrl() || '—') +
    '\nКлюч: ' + (s.api_key || '—'));
}

/*==== PART:push ====*/
/* ============================ WEB PUSH (чистый JS: P-256, ECDSA, ECDH, HKDF, AES-GCM, VAPID) ============================ */
/* Apps Script не умеет эллиптические кривые и AES, поэтому реализовано вручную и сверено с Node.js crypto и библиотекой http_ece. */
var BI_ = (typeof BigInt === 'function');                 // BigInt есть не во всех средах: без него отключаются только уведомления, остальное приложение работает
function bi_(x) { return BI_ ? BigInt(x) : 0; }
var B0_ = bi_(0), B1_ = bi_(1), B2_ = bi_(2), B3_ = bi_(3), B4_ = bi_(4), B8_ = bi_(8), B64_ = bi_(64), B120_ = bi_(120), B255_ = bi_(255), BE1_ = bi_(225);
function pushCryptoOk_() { return BI_ && P256_ !== null; }
var P256_ = BI_ ? {
  p: BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'),
  b: BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b'),
  n: BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
  gx: BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
  gy: BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5')
} : null;

function bMod_(a, m) { const r = a % m; return r >= B0_ ? r : r + m; }
function bInv_(a, m) {                                   // обратный элемент (расширенный алгоритм Евклида)
  let lm = B1_, hm = B0_, low = bMod_(a, m), high = m;
  while (low > B1_) {
    const r = high / low;
    const nm = hm - lm * r, nw = high - low * r;
    hm = lm; high = low; lm = nm; low = nw;
  }
  return bMod_(lm, m);
}
function bytesToBig_(u8) { let r = B0_; for (let i = 0; i < u8.length; i++) r = (r << B8_) | BigInt(u8[i]); return r; }
function bigToBytes_(x, len) { const out = new Uint8Array(len); for (let i = len - 1; i >= 0; i--) { out[i] = Number(x & B255_); x >>= B8_; } return out; }
function u8_(arr) { const o = new Uint8Array(arr.length); for (let i = 0; i < arr.length; i++) o[i] = arr[i] & 255; return o; }          // байты Apps Script (со знаком) → 0..255
function sb_(u8) { const o = new Array(u8.length); for (let i = 0; i < u8.length; i++) o[i] = u8[i] > 127 ? u8[i] - 256 : u8[i]; return o; }   // обратно
function catBytes_() { let n = 0; for (let i = 0; i < arguments.length; i++) n += arguments[i].length; const o = new Uint8Array(n); let k = 0; for (let i = 0; i < arguments.length; i++) { o.set(arguments[i], k); k += arguments[i].length; } return o; }
function utf8_(s) {
  const out = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d < 0xe000) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
}
function b64u_(u8) { return Utilities.base64EncodeWebSafe(sb_(u8)).replace(/=+$/, ''); }
function b64uDec_(s) { s = String(s).replace(/[^A-Za-z0-9_-]/g, ''); while (s.length % 4) s += '='; return u8_(Utilities.base64DecodeWebSafe(s)); }
function sha256_(u8) { return u8_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, sb_(u8))); }
function hmac_(keyU8, dataU8) { return u8_(Utilities.computeHmacSha256Signature(sb_(dataU8), sb_(keyU8))); }
function rand32_() {                                       // 32 случайных байта из защищённого UUID-генератора Google
  return sha256_(utf8_(Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid() + String(Date.now()) + String(Math.random())));
}
function randBytes_(n) { let out = new Uint8Array(0); while (out.length < n) out = catBytes_(out, rand32_()); return out.slice(0, n); }

/* --- эллиптическая кривая P-256 (якобиевы координаты) --- */
function ecDouble_(P) {
  if (P[2] === B0_ || P[1] === B0_) return [B0_, B1_, B0_];
  const p = P256_.p, X = P[0], Y = P[1], Z = P[2];
  const delta = bMod_(Z * Z, p), gamma = bMod_(Y * Y, p), beta = bMod_(X * gamma, p);
  const alpha = bMod_(B3_ * (X - delta) * (X + delta), p);
  const X3 = bMod_(alpha * alpha - B8_ * beta, p);
  const Z3 = bMod_((Y + Z) * (Y + Z) - gamma - delta, p);
  const Y3 = bMod_(alpha * (B4_ * beta - X3) - B8_ * gamma * gamma, p);
  return [X3, Y3, Z3];
}
function ecAdd_(P, Q) {
  if (P[2] === B0_) return Q;
  if (Q[2] === B0_) return P;
  const p = P256_.p;
  const Z1Z1 = bMod_(P[2] * P[2], p), Z2Z2 = bMod_(Q[2] * Q[2], p);
  const U1 = bMod_(P[0] * Z2Z2, p), U2 = bMod_(Q[0] * Z1Z1, p);
  const S1 = bMod_(P[1] * Q[2] * Z2Z2, p), S2 = bMod_(Q[1] * P[2] * Z1Z1, p);
  const H = bMod_(U2 - U1, p), r0 = bMod_(S2 - S1, p);
  if (H === B0_) return r0 === B0_ ? ecDouble_(P) : [B0_, B1_, B0_];
  const I = bMod_(B4_ * H * H, p), J = bMod_(H * I, p), r = bMod_(B2_ * r0, p), V = bMod_(U1 * I, p);
  const X3 = bMod_(r * r - J - B2_ * V, p);
  const Y3 = bMod_(r * (V - X3) - B2_ * S1 * J, p);
  const Z3 = bMod_(((P[2] + Q[2]) * (P[2] + Q[2]) - Z1Z1 - Z2Z2) * H, p);
  return [X3, Y3, Z3];
}
function ecMul_(k, x, y) {                                 // k·(x,y) → аффинная точка [x, y] или null (бесконечность)
  let R = [B0_, B1_, B0_];
  const P = [x, y, B1_];
  for (let i = 255; i >= 0; i--) { R = ecDouble_(R); if ((k >> BigInt(i)) & B1_) R = ecAdd_(R, P); }
  if (R[2] === B0_) return null;
  const zi = bInv_(R[2], P256_.p), zi2 = bMod_(zi * zi, P256_.p);
  return [bMod_(R[0] * zi2, P256_.p), bMod_(R[1] * zi2 * zi, P256_.p)];
}
function ecOnCurve_(x, y) {
  const p = P256_.p;
  return x > B0_ && x < p && y > B0_ && y < p && bMod_(y * y, p) === bMod_(x * x * x - B3_ * x + P256_.b, p);
}
function ecPubFromPriv_(privU8) {                          // 65 байт: 04‖X‖Y
  const pt = ecMul_(bytesToBig_(privU8), P256_.gx, P256_.gy);
  return catBytes_(new Uint8Array([4]), bigToBytes_(pt[0], 32), bigToBytes_(pt[1], 32));
}
function ecdh_(privU8, pubU8) {                            // общий секрет (координата X), 32 байта
  if (pubU8.length !== 65 || pubU8[0] !== 4) throw new Error('E_PUSHKEY');
  const x = bytesToBig_(pubU8.slice(1, 33)), y = bytesToBig_(pubU8.slice(33, 65));
  if (!ecOnCurve_(x, y)) throw new Error('E_PUSHKEY');     // точка должна лежать на кривой
  const pt = ecMul_(bytesToBig_(privU8), x, y);
  if (!pt) throw new Error('E_PUSHKEY');
  return bigToBytes_(pt[0], 32);
}
function ecNewPriv_() {                                    // случайный закрытый ключ в диапазоне [1, n−1]
  for (;;) { const k = rand32_(), v = bytesToBig_(k); if (v > B0_ && v < P256_.n) return k; }
}
function ecdsaSign_(hash32, privU8) {                      // подпись ES256: 64 байта r‖s
  const n = P256_.n, d = bytesToBig_(privU8), z = bytesToBig_(hash32);
  for (;;) {
    const k = bytesToBig_(ecNewPriv_());
    const R = ecMul_(k, P256_.gx, P256_.gy), r = bMod_(R[0], n);
    if (r === B0_) continue;
    const s = bMod_(bInv_(k, n) * (z + r * d), n);
    if (s === B0_) continue;
    return catBytes_(bigToBytes_(r, 32), bigToBytes_(s, 32));
  }
}

/* --- AES-128 и GCM --- */
const AES_SBOX_ = (function () {
  const s = new Array(256); let p = 1, q = 1;
  do {
    p = (p ^ ((p << 1) & 255) ^ ((p & 128) ? 27 : 0)) & 255;
    q ^= (q << 1) & 255; q ^= (q << 2) & 255; q ^= (q << 4) & 255; q &= 255; if (q & 128) q ^= 9;
    const rot = function (v, n) { return ((v << n) | (v >> (8 - n))) & 255; };
    s[p] = (q ^ rot(q, 1) ^ rot(q, 2) ^ rot(q, 3) ^ rot(q, 4) ^ 99) & 255;
  } while (p !== 1);
  s[0] = 99;
  return s;
})();
function aesKeyExp_(key) {
  const w = new Array(176); for (let i = 0; i < 16; i++) w[i] = key[i];
  let rcon = 1;
  for (let i = 16; i < 176; i += 4) {
    let t = [w[i - 4], w[i - 3], w[i - 2], w[i - 1]];
    if (i % 16 === 0) { t = [AES_SBOX_[t[1]] ^ rcon, AES_SBOX_[t[2]], AES_SBOX_[t[3]], AES_SBOX_[t[0]]]; rcon = ((rcon << 1) ^ ((rcon & 128) ? 27 : 0)) & 255; }
    for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
  }
  return w;
}
function aesXt_(x) { return ((x << 1) ^ ((x & 128) ? 27 : 0)) & 255; }
function aesBlock_(rk, inp) {
  const s = new Array(16);
  for (let i = 0; i < 16; i++) s[i] = inp[i] ^ rk[i];
  for (let round = 1; round <= 10; round++) {
    const t = new Array(16);
    for (let i = 0; i < 16; i++) t[i] = AES_SBOX_[s[i]];
    const sh = [t[0], t[5], t[10], t[15], t[4], t[9], t[14], t[3], t[8], t[13], t[2], t[7], t[12], t[1], t[6], t[11]];   // ShiftRows
    if (round < 10) {
      for (let c = 0; c < 4; c++) {                         // MixColumns
        const a0 = sh[c * 4], a1 = sh[c * 4 + 1], a2 = sh[c * 4 + 2], a3 = sh[c * 4 + 3];
        s[c * 4] = aesXt_(a0) ^ (aesXt_(a1) ^ a1) ^ a2 ^ a3;
        s[c * 4 + 1] = a0 ^ aesXt_(a1) ^ (aesXt_(a2) ^ a2) ^ a3;
        s[c * 4 + 2] = a0 ^ a1 ^ aesXt_(a2) ^ (aesXt_(a3) ^ a3);
        s[c * 4 + 3] = (aesXt_(a0) ^ a0) ^ a1 ^ a2 ^ aesXt_(a3);
      }
    } else for (let i = 0; i < 16; i++) s[i] = sh[i];
    for (let i = 0; i < 16; i++) s[i] ^= rk[round * 16 + i];
  }
  return s;
}
function gfMul_(X, Y) {                                    // умножение в GF(2^128) для GHASH (BigInt)
  const R = BE1_ << B120_; let Z = B0_, V = Y;
  for (let i = 127; i >= 0; i--) { if ((X >> BigInt(i)) & B1_) Z ^= V; V = (V & B1_) ? ((V >> B1_) ^ R) : (V >> B1_); }
  return Z;
}
function aesGcmEncrypt_(keyU8, ivU8, plainU8) {            // → шифртекст ‖ тег (16 байт); AAD пуст
  const rk = aesKeyExp_(keyU8), H = bytesToBig_(u8_(aesBlock_(rk, new Array(16).fill(0))));
  const ctr = new Uint8Array(16); ctr.set(ivU8, 0); ctr[15] = 1;
  const tagMask = aesBlock_(rk, ctr);
  const out = new Uint8Array(plainU8.length);
  for (let off = 0, c = 2; off < plainU8.length; off += 16, c++) {
    const cb = new Uint8Array(16); cb.set(ivU8, 0); cb[12] = (c >>> 24) & 255; cb[13] = (c >>> 16) & 255; cb[14] = (c >>> 8) & 255; cb[15] = c & 255;
    const ks = aesBlock_(rk, cb);
    for (let i = 0; i < 16 && off + i < plainU8.length; i++) out[off + i] = plainU8[off + i] ^ ks[i];
  }
  let g = B0_;
  for (let off = 0; off < out.length; off += 16) { const blk = new Uint8Array(16); blk.set(out.slice(off, off + 16)); g = gfMul_(g ^ bytesToBig_(blk), H); }
  const lenBlk = (B0_ << B64_) | BigInt(out.length * 8);     // длина AAD = 0, длина шифртекста в битах
  g = gfMul_(g ^ lenBlk, H);
  const gb = bigToBytes_(g, 16), tag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) tag[i] = gb[i] ^ tagMask[i];
  return catBytes_(out, tag);
}

/* --- HKDF и шифрование сообщения по RFC 8291 (aes128gcm) --- */
function hkdfExpand1_(prk, info, len) { return hmac_(prk, catBytes_(info, new Uint8Array([1]))).slice(0, len); }   // нам нужно ≤ 32 байт
function webPushEncrypt_(payloadU8, uaPubU8, authU8, opts) {      // opts.asPriv / opts.salt — только для тестов
  if (!uaPubU8 || uaPubU8.length !== 65) throw new Error('E_PUSHKEY');
  if (!authU8 || authU8.length !== 16) throw new Error('E_PUSHKEY');
  if (payloadU8.length > 3000) throw new Error('E_PUSHSIZE');
  const asPriv = (opts && opts.asPriv) || ecNewPriv_(), asPub = ecPubFromPriv_(asPriv), salt = (opts && opts.salt) || randBytes_(16);
  const secret = ecdh_(asPriv, uaPubU8);
  const prkKey = hmac_(authU8, secret);
  const keyInfo = catBytes_(utf8_('WebPush: info'), new Uint8Array([0]), uaPubU8, asPub);
  const ikm = hkdfExpand1_(prkKey, keyInfo, 32);
  const prk = hmac_(salt, ikm);
  const cek = hkdfExpand1_(prk, catBytes_(utf8_('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = hkdfExpand1_(prk, catBytes_(utf8_('Content-Encoding: nonce'), new Uint8Array([0])), 12);
  const record = aesGcmEncrypt_(cek, nonce, catBytes_(payloadU8, new Uint8Array([2])));    // 0x02 — разделитель последней записи
  const rs = new Uint8Array([0, 0, 16, 0]);                                                // размер записи 4096
  return catBytes_(salt, rs, new Uint8Array([asPub.length]), asPub, record);
}

/* --- VAPID (RFC 8292) --- */
function vapidAuth_(endpoint, privU8, pubU8, subject, nowSec) {
  const m = /^(https:\/\/[^\/]+)\//.exec(endpoint);
  if (!m) throw new Error('E_PUSHURL');
  const head = b64u_(utf8_('{"typ":"JWT","alg":"ES256"}'));
  const claims = b64u_(utf8_(JSON.stringify({ aud: m[1], exp: (nowSec || Math.floor(Date.now() / 1000)) + 12 * 3600, sub: subject })));
  const input = head + '.' + claims;
  const sig = ecdsaSign_(sha256_(utf8_(input)), privU8);
  return 'vapid t=' + input + '.' + b64u_(sig) + ', k=' + b64u_(pubU8);
}
function pushHostOk_(endpoint) {                          // отправляем только на известные push-сервисы (защита от подмены адреса)
  const m = /^https:\/\/([a-z0-9.-]+)(:\d+)?\//i.exec(String(endpoint || ''));
  if (!m || String(endpoint).length > 700) return false;
  return /(^|\.)push\.apple\.com$/i.test(m[1]) || /^fcm\.googleapis\.com$/i.test(m[1]) || /(^|\.)push\.services\.mozilla\.com$/i.test(m[1]) ||
    /(^|\.)notify\.windows\.com$/i.test(m[1]) || /^android\.googleapis\.com$/i.test(m[1]);
}
/*==== END:push ====*/

/*==== PART:planner ====*/
/* ============================ v5: ПЛАНЕР, ПРИВЫЧКИ, ФОКУС, ОШИБКИ UWORLD, ПОКРЫТИЕ, УВЕДОМЛЕНИЯ ============================ */
const PLAN_HEAD = ['ID', 'Дата', 'Время', 'Название', 'Заметка', 'Тип', 'Напомнить (ч)', 'Выполнено', 'Отправлено', 'Создано'];
const DNOTE_HEAD = ['Дата', 'Текст', 'Обновлено'];
const HAB_HEAD = ['ID', 'Название', 'Дни (1=Пн … 7=Вс)', 'С (раз/нед)', 'До (раз/нед)', 'Шаг (недель)', 'Начало', 'Активна', 'Создано'];
const HLOG_HEAD = ['ID привычки', 'Дата'];
const PUSH_HEAD = ['ID', 'Endpoint', 'p256dh', 'auth', 'Устройство', 'Создано', 'Последний успех', 'Ошибок'];
const FOC_HEAD = ['ID', 'Дата', 'Минут', 'Вид', 'Система', 'Заметка', 'Создано'];
const UWE_HEAD = ['ID', 'Дата', 'Система', 'Тема', 'Причина', 'Заметка', 'Карточка', 'Создано'];
const COV_HEAD = ['Ключ', 'Статус', 'Обновлено'];
const UWE_REASONS = ['knowledge', 'recall', 'misread', 'guess', 'careless', 'time'];
const FOC_KINDS = ['fa', 'uw', 'anki', 'video', 'other'];

function ensureV5_() {
  [[SH.PLAN, PLAN_HEAD], [SH.DNOTE, DNOTE_HEAD], [SH.HAB, HAB_HEAD], [SH.HLOG, HLOG_HEAD], [SH.PUSH, PUSH_HEAD], [SH.FOC, FOC_HEAD], [SH.UWE, UWE_HEAD], [SH.COV, COV_HEAD]]
    .forEach(p => ensureSheet_(p[0], p[1]));
  const uw = SpreadsheetApp.getActive().getSheetByName(SH.UW);          // старые таблицы: добавляем два столбца для блоков по нескольким системам
  if (uw && uw.getLastColumn() < 7) { uw.getRange(1, 6, 1, 2).setValues([['Системы', 'Разбивка']]); header_(uw, 7); }
}

function str_(v) { return String(v == null ? '' : v); }
function needAnyDate_(v) {                                  // для планера даты в будущем допустимы
  v = d_(v);
  if (!isDate_(v)) fail_('DATE');
  const y = Number(v.slice(0, 4));
  if (y < 2000 || y > 2100) fail_('DATE');
  return v;
}
function needTime_(v) {
  v = str_(v).trim();
  if (v === '') return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail_('TIME');
  return v;
}
function setSettingRaw_(key, val) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.SET), vals = sh.getDataRange().getValues();
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]).trim() === key) { sh.getRange(i + 1, 2).setValue(val); return; }
  sh.appendRow([key, val]);
}

/* ---------- чтение ---------- */
function readPlan_() {
  return rows_(SH.PLAN).map((r, i) => ({ row: i + 2, id: str_(r[0]), date: d_(r[1]), time: str_(r[2]), title: str_(r[3]), note: str_(r[4]), kind: str_(r[5]) === 'event' ? 'event' : 'task',
    remind: n_(r[6]), done: d_(r[7]), sent: str_(r[8]), at: d_(r[9]) })).filter(x => x.id);
}
function readDayNotes_() { return rows_(SH.DNOTE).map((r, i) => ({ row: i + 2, date: d_(r[0]), text: str_(r[1]) })).filter(x => isDate_(x.date)); }
function readHabits_() {
  return rows_(SH.HAB).map((r, i) => ({ row: i + 2, id: str_(r[0]), title: str_(r[1]), days: str_(r[2]).split(',').map(Number).filter(x => x >= 1 && x <= 7),
    from: n_(r[3]), to: n_(r[4]), every: n_(r[5]) || 1, start: d_(r[6]), active: str_(r[7]) !== 'no', at: d_(r[8]) })).filter(x => x.id);
}
function readHabitLog_() { return rows_(SH.HLOG).map((r, i) => ({ row: i + 2, id: str_(r[0]), date: d_(r[1]) })).filter(x => x.id && isDate_(x.date)); }
function readFocus_() { return rows_(SH.FOC).map((r, i) => ({ row: i + 2, id: str_(r[0]), date: d_(r[1]), minutes: n_(r[2]), kind: str_(r[3]), system: str_(r[4]), note: str_(r[5]) })).filter(x => x.id); }
function readErrors_() {
  return rows_(SH.UWE).map((r, i) => ({ row: i + 2, id: str_(r[0]), date: d_(r[1]), system: str_(r[2]), topic: str_(r[3]), reason: str_(r[4]), note: str_(r[5]), card: str_(r[6]) })).filter(x => x.id);
}
function readCov_() { return rows_(SH.COV).map((r, i) => ({ row: i + 2, key: str_(r[0]), status: str_(r[1]) })).filter(x => x.key); }
function stripRow_(x) { const o = {}; Object.keys(x).forEach(k => { if (k !== 'row') o[k] = x[k]; }); return o; }

/* ---------- часовой пояс: напоминания считаются по местному времени устройства ---------- */
function tzOffsetMin_(st) {
  const v = st && st.tz_offset;
  if (v !== '' && v !== undefined && v !== null && isFinite(Number(v))) return Number(v);
  try { const z = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'Z'); const m = /^([+-])(\d\d)(\d\d)$/.exec(z); if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])); } catch (e) { }
  return 0;
}
/** Часовой пояс по названию (IANA, например Asia/Tashkent) существует в Apps Script? */
function tzNameOk_(name) { try { return /^[+-]\d{4}$/.test(Utilities.formatDate(new Date(0), name, 'Z')); } catch (e) { return false; } }
/** Смещение пояса (минуты к востоку от UTC) на момент ms — с учётом летнего времени. */
function tzOffsetAtMs_(name, ms) { const m = /^([+-])(\d\d)(\d\d)$/.exec(Utilities.formatDate(new Date(ms), name, 'Z')); return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0; }
/** Местное время (дата + «ЧЧ:ММ») в моменте UTC (мс). Если задано название пояса — смещение берётся на ДАТУ события (летнее время учтено):
 *  неоднозначное время (осенний перевод назад) → более раннее вхождение; несуществующее (весенний перевод вперёд) → время сдвигается вперёд, как «compatible» в Temporal.
 *  Без названия пояса — фиксированное смещение offMin. */
function eventStartMs_(date, time, offMin, tzName) {
  const p = date.split('-'), t = time.split(':'), naive = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]), Number(t[0]), Number(t[1]));
  if (!tzName) return naive - offMin * 60000;
  try {
    const before = tzOffsetAtMs_(tzName, naive - 86400000), after = tzOffsetAtMs_(tzName, naive + 86400000), cands = before === after ? [before] : [before, after];
    const valid = cands.filter(o => tzOffsetAtMs_(tzName, naive - o * 60000) === o).map(o => naive - o * 60000);
    return valid.length ? Math.min.apply(null, valid) : naive - before * 60000;
  } catch (e) { return naive - offMin * 60000; }
}

/* ---------- планер: события и задачи ---------- */
function planAdd(o) {         // {id, date, time, title, note, kind, remind}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const all = readPlan_(); if (all.length >= 4000) fail_('LIMIT');
  const id = needNewId_(o.id, 'p', all);
  const kind = o.kind === 'event' ? 'event' : 'task', time = needTime_(o.time);
  let remind = (o.remind === undefined || o.remind === null || o.remind === '') ? 0 : Number(o.remind);
  if (!(isFinite(remind) && Math.floor(remind) === remind && remind >= 0 && remind <= 168)) fail_('REMIND');
  if (!time) remind = 0;                                    // напоминание возможно только у события со временем
  appendText_(SH.PLAN, [id, needAnyDate_(o.date), time, needText_(o.title, 120, 'TITLE'), str_(o.note).slice(0, 500), kind, remind, '', '', todayStr_()]);
  return okLight_();
}
function planEdit(o) {        // {id, date?, time?, title?, note?, remind?}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const it = readPlan_().find(x => x.id === o.id); if (!it) fail_('STALE');
  const date = o.date !== undefined ? needAnyDate_(o.date) : it.date, time = o.time !== undefined ? needTime_(o.time) : it.time;
  let remind = o.remind !== undefined ? Number(o.remind) : it.remind;
  if (!(isFinite(remind) && Math.floor(remind) === remind && remind >= 0 && remind <= 168)) fail_('REMIND');
  if (!time) remind = 0;
  const title = o.title !== undefined ? needText_(o.title, 120, 'TITLE') : it.title, note = o.note !== undefined ? str_(o.note).slice(0, 500) : it.note;
  const changed = date !== it.date || time !== it.time || remind !== it.remind;
  const rg = SpreadsheetApp.getActive().getSheetByName(SH.PLAN).getRange(it.row, 2, 1, 8);
  rg.setNumberFormat('@'); rg.setValues([[date, time, title, note, it.kind, remind, it.done, changed ? '' : it.sent]]);   // при переносе напоминание отправится заново
  return okLight_();
}
function planDone(o) {        // {id, done}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const it = readPlan_().find(x => x.id === o.id); if (!it) fail_('STALE');
  const c = SpreadsheetApp.getActive().getSheetByName(SH.PLAN).getRange(it.row, 8); c.setNumberFormat('@'); c.setValue(o.done ? todayStr_() : '');
  return okLight_();
}
function planDelete(o) {      // {id}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const it = readPlan_().find(x => x.id === o.id); if (!it) fail_('STALE');
  SpreadsheetApp.getActive().getSheetByName(SH.PLAN).deleteRow(it.row);
  return okLight_();
}
function dayNote(o) {         // {date, text} — пустой текст удаляет заметку
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const date = needAnyDate_(o.date), text = str_(o.text).replace(/\r/g, '').trim();
  if (text.length > 2000) fail_('NOTE');
  const cur = readDayNotes_().find(x => x.date === date), sh = SpreadsheetApp.getActive().getSheetByName(SH.DNOTE);
  if (!text) { if (cur) sh.deleteRow(cur.row); return okLight_(); }
  if (cur) { const rg = sh.getRange(cur.row, 2, 1, 2); rg.setNumberFormat('@'); rg.setValues([[text, todayStr_()]]); }
  else { if (readDayNotes_().length >= 3000) fail_('LIMIT'); appendText_(SH.DNOTE, [date, text, todayStr_()]); }
  return okLight_();
}

/* ---------- привычки ---------- */
function habitFields_(o, cur) {
  const days = o.days !== undefined ? (Array.isArray(o.days) ? o.days.map(Number) : []) : (cur ? cur.days : []);
  const okDays = days.length >= 1 && days.every(d => Math.floor(d) === d && d >= 1 && d <= 7) && days.filter((d, i) => days.indexOf(d) === i).length === days.length;
  if (!okDays) fail_('HABIT');
  days.sort((a, b) => a - b);
  const from = o.from !== undefined ? Number(o.from) : (cur ? cur.from : 1), to = o.to !== undefined ? Number(o.to) : (cur ? cur.to : days.length), every = o.every !== undefined ? Number(o.every) : (cur ? cur.every : 2);
  const ok = x => isFinite(x) && Math.floor(x) === x;
  if (!(ok(from) && ok(to) && ok(every) && from >= 1 && to >= from && to <= days.length && every >= 1 && every <= 12)) fail_('HABIT');
  return { days: days, from: from, to: to, every: every };
}
function habitAdd(o) {        // {id, title, days[], from, to, every, start}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const all = readHabits_(); if (all.length >= 30) fail_('LIMIT');
  const id = needNewId_(o.id, 'h', all), f = habitFields_(o, null);
  appendText_(SH.HAB, [id, needText_(o.title, 60, 'TITLE'), f.days.join(','), f.from, f.to, f.every, o.start ? needAnyDate_(o.start) : todayStr_(), '', todayStr_()]);
  return okLight_();
}
function habitEdit(o) {       // {id, title?, days?, from?, to?, every?, active?}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const h = readHabits_().find(x => x.id === o.id); if (!h) fail_('STALE');
  const f = habitFields_(o, h), title = o.title !== undefined ? needText_(o.title, 60, 'TITLE') : h.title, active = o.active === undefined ? h.active : !!o.active;
  const rg = SpreadsheetApp.getActive().getSheetByName(SH.HAB).getRange(h.row, 2, 1, 7);
  rg.setNumberFormat('@'); rg.setValues([[title, f.days.join(','), f.from, f.to, f.every, h.start, active ? '' : 'no']]);
  return okLight_();
}
function habitDelete(o) {     // {id}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const h = readHabits_().find(x => x.id === o.id); if (!h) fail_('STALE');
  SpreadsheetApp.getActive().getSheetByName(SH.HAB).deleteRow(h.row);
  writeSheetBody_(SH.HLOG, HLOG_HEAD, readHabitLog_().filter(x => x.id !== o.id).map(x => [x.id, x.date]));
  return okLight_();
}
function habitToggle(o) {     // {id, date, done}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const h = readHabits_().find(x => x.id === o.id); if (!h) fail_('STALE');
  const date = needAnyDate_(o.date);
  if (daysBetween_(todayStr_(), date) > 1) fail_('FUTURE');                // отмечать будущее нельзя
  if (daysBetween_(date, todayStr_()) > 90) fail_('DATE');
  const cur = readHabitLog_().find(x => x.id === o.id && x.date === date);
  if (o.done && !cur) appendText_(SH.HLOG, [o.id, date]);
  if (!o.done && cur) SpreadsheetApp.getActive().getSheetByName(SH.HLOG).deleteRow(cur.row);
  return okLight_();
}

/* ---------- фокус, ошибки UWorld, покрытие ---------- */
function focusAdd(o) {        // {id, date, minutes, kind, system, note}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const all = readFocus_(); if (all.length >= 5000) fail_('LIMIT');
  const id = needNewId_(o.id, 'f', all), date = needAnyDate_(o.date);
  if (daysBetween_(todayStr_(), date) > 1) fail_('FUTURE');
  const minutes = needInt_(o.minutes, 1, 600, 'MINUTES'), kind = FOC_KINDS.indexOf(o.kind) > -1 ? o.kind : 'other';
  const sys = str_(o.system).trim(); if (sys) needSystem_(sys);
  appendText_(SH.FOC, [id, date, minutes, kind, sys, str_(o.note).slice(0, 200), todayStr_()]);
  return okLight_();
}
function focusDelete(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const f = readFocus_().find(x => x.id === o.id); if (!f) fail_('STALE');
  SpreadsheetApp.getActive().getSheetByName(SH.FOC).deleteRow(f.row);
  return okLight_();
}
function uweSystem_(v) { v = str_(v).trim(); return (v === 'Multi' || v === 'All' || v === '') ? v : needSystem_(v); }
function uweAdd(o) {          // {id, date, system, topic, reason, note, card}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const all = readErrors_(); if (all.length >= 3000) fail_('LIMIT');
  const id = needNewId_(o.id, 'e', all), date = needAnyDate_(o.date);
  if (daysBetween_(todayStr_(), date) > 1) fail_('FUTURE');
  if (UWE_REASONS.indexOf(o.reason) < 0) fail_('REASON');
  appendText_(SH.UWE, [id, date, uweSystem_(o.system), needText_(o.topic, 120, 'TOPIC'), o.reason, str_(o.note).slice(0, 500), str_(o.card), todayStr_()]);
  return okLight_();
}
function uweEdit(o) {         // {id, topic?, reason?, note?, system?, card?}
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const e = readErrors_().find(x => x.id === o.id); if (!e) fail_('STALE');
  const reason = o.reason !== undefined ? o.reason : e.reason; if (UWE_REASONS.indexOf(reason) < 0) fail_('REASON');
  const rg = SpreadsheetApp.getActive().getSheetByName(SH.UWE).getRange(e.row, 3, 1, 5);
  rg.setNumberFormat('@');
  rg.setValues([[o.system !== undefined ? uweSystem_(o.system) : e.system, o.topic !== undefined ? needText_(o.topic, 120, 'TOPIC') : e.topic, reason, o.note !== undefined ? str_(o.note).slice(0, 500) : e.note, o.card !== undefined ? str_(o.card).slice(0, 40) : e.card]]);
  return okLight_();
}
function uweDelete(o) {
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const e = readErrors_().find(x => x.id === o.id); if (!e) fail_('STALE');
  SpreadsheetApp.getActive().getSheetByName(SH.UWE).deleteRow(e.row);
  return okLight_();
}
function covSet(o) {          // {key, status: '' | 'prog' | 'done'} — отметка темы из официального перечня
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const key = str_(o.key).trim();
  if (!/^\d{1,2}\.\d{1,2}$/.test(key)) fail_('COV');
  const st = str_(o.status); if (['', 'prog', 'done'].indexOf(st) < 0) fail_('COV');
  const cur = readCov_().find(x => x.key === key), sh = SpreadsheetApp.getActive().getSheetByName(SH.COV);
  if (!st) { if (cur) sh.deleteRow(cur.row); return okLight_(); }
  if (cur) { const rg = sh.getRange(cur.row, 2, 1, 2); rg.setNumberFormat('@'); rg.setValues([[st, todayStr_()]]); }
  else { if (readCov_().length >= 500) fail_('LIMIT'); appendText_(SH.COV, [key, st, todayStr_()]); }
  return okLight_();
}

/* ---------- уведомления: ключи, подписки, отправка ---------- */
function vapid_() {           // ключи VAPID создаются один раз и хранятся в листе настроек (виден только владельцу таблицы)
  if (!pushCryptoOk_()) throw new Error('E_NOPUSH');
  const st = getSettings(), pubS = str_(st.vapid_pub), privS = str_(st.vapid_priv);
  if (pubS && privS) { try { return { pub: b64uDec_(pubS), priv: b64uDec_(privS), pubB64: pubS }; } catch (e) { /* пересоздаём */ } }
  const p = ecNewPriv_(), P = ecPubFromPriv_(p);
  setSettingRaw_('vapid_priv', b64u_(p)); setSettingRaw_('vapid_pub', b64u_(P));
  return { pub: P, priv: p, pubB64: b64u_(P) };
}
function readPush_() { return rows_(SH.PUSH).map((r, i) => ({ row: i + 2, id: str_(r[0]), endpoint: str_(r[1]), p256dh: str_(r[2]), auth: str_(r[3]), ua: str_(r[4]) })).filter(x => x.id && x.endpoint); }
function pushFromBody_(body) {                              // подписка устройства (приходит из обёртки на GitHub)
  ensureAll_();
  if (!pushCryptoOk_()) return { ok: false, error: 'unsupported' };
  if (body.pushOff) {
    const ep = str_(body.pushOff.endpoint), cur = readPush_().find(x => x.endpoint === ep);
    if (cur) SpreadsheetApp.getActive().getSheetByName(SH.PUSH).deleteRow(cur.row);
    return { ok: true, devices: readPush_().length };
  }
  const p = body.push || {}, keys = p.keys || p;
  const ep = str_(p.endpoint);
  if (!pushHostOk_(ep)) return { ok: false, error: 'endpoint' };
  let pub, auth;
  try { pub = b64uDec_(keys.p256dh); auth = b64uDec_(keys.auth); } catch (e) { return { ok: false, error: 'keys' }; }
  if (pub.length !== 65 || pub[0] !== 4 || auth.length !== 16 || !ecOnCurve_(bytesToBig_(pub.slice(1, 33)), bytesToBig_(pub.slice(33, 65)))) return { ok: false, error: 'keys' };
  const id = 'd_' + Array.from(sha256_(utf8_(ep)).slice(0, 8)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
  const all = readPush_(), cur = all.find(x => x.id === id), sh = SpreadsheetApp.getActive().getSheetByName(SH.PUSH);
  const ua = str_(body.ua).replace(/[^\x20-\x7e]/g, '').slice(0, 80);
  if (cur) { const rg = sh.getRange(cur.row, 2, 1, 7); rg.setNumberFormat('@'); rg.setValues([[ep, b64u_(pub), b64u_(auth), ua, todayStr_(), '', 0]]); }
  else { if (all.length >= 12) return { ok: false, error: 'limit' }; appendText_(SH.PUSH, [id, ep, b64u_(pub), b64u_(auth), ua, todayStr_(), '', 0]); }
  return { ok: true, devices: readPush_().length };
}
function pushSubject_() { let m = ''; try { m = Session.getEffectiveUser().getEmail(); } catch (e) { } return 'mailto:' + (/^[^@\s]+@[^@\s]+$/.test(m) ? m : 'owner@example.com'); }
function pushSendOne_(sub, payloadObj, vap) {              // → код ответа push-сервиса
  const body = webPushEncrypt_(utf8_(JSON.stringify(payloadObj)), b64uDec_(sub.p256dh), b64uDec_(sub.auth));
  const res = UrlFetchApp.fetch(sub.endpoint, { method: 'post', muteHttpExceptions: true, contentType: 'application/octet-stream', payload: sb_(body),
    headers: { 'Content-Encoding': 'aes128gcm', TTL: '86400', Urgency: 'normal', Authorization: vapidAuth_(sub.endpoint, vap.priv, vap.pub, pushSubject_()) } });
  const code = res.getResponseCode();
  PUSH_LAST_ = (code >= 200 && code < 300) ? '' : String((res.getContentText && res.getContentText()) || '').replace(/[^\x20-\x7e]/g, ' ').slice(0, 140);   // начало ответа сервиса — для диагностики
  return code;
}
var PUSH_LAST_ = '';
/** Рассылка по всем устройствам. Устройства, которые вернули 404/410 (подписка отозвана), удаляются. */
function pushBroadcast_(payloadObj) {
  const subs = readPush_(), out = { sent: 0, failed: 0, removed: 0, codes: [], errs: [] };
  if (!subs.length) return out;
  if (!pushCryptoOk_()) { out.failed = subs.length; out.errs.push('crypto unavailable'); return out; }
  const vap = vapid_(), sh = SpreadsheetApp.getActive().getSheetByName(SH.PUSH), dead = [];
  subs.forEach(s => {
    let code = 0;
    try { code = pushSendOne_(s, payloadObj, vap); } catch (e) { code = -1; }
    out.codes.push(code);
    if ((code < 200 || code >= 300) && PUSH_LAST_ && out.errs.length < 2) out.errs.push(code + ': ' + PUSH_LAST_);
    if (code >= 200 && code < 300) out.sent++;
    else if (code === 404 || code === 410) dead.push(s.row);
    else out.failed++;
  });
  dead.sort((a, b) => b - a).forEach(r => { sh.deleteRow(r); out.removed++; });
  return out;
}
function pushTest(o) {        // кнопка «Отправить тестовое уведомление»
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  const r = pushBroadcast_({ title: 'USMLE Progress', body: 'Тестовое уведомление: всё работает', tag: 'test', url: './' });
  return { ok: true, sent: r.sent, failed: r.failed, removed: r.removed, codes: r.codes, errs: r.errs, devices: readPush_().length };
}
function pushRemoveAll(o) {   // «Отключить уведомления на всех устройствах»
  needAuth_(o); setToday_(o && o.today); ensureAll_();
  writeSheetBody_(SH.PUSH, PUSH_HEAD, []);
  return okLight_();
}

/* ---------- напоминания за N часов до события ---------- */
function dueReminders_(items, nowMs, offMin, tzName) {
  return items.filter(x => x.kind === 'event' && x.time && x.remind > 0 && !x.done && !x.sent && isDate_(x.date)).map(x => {
    const start = eventStartMs_(x.date, x.time, offMin, tzName);
    return { item: x, start: start, remindAt: start - x.remind * 3600000 };
  }).filter(x => nowMs >= x.remindAt && nowMs < x.start);
}
function reminderText_(it, leftMs) {
  const mins = Math.max(1, Math.round(leftMs / 60000)), h = Math.floor(mins / 60), m = mins % 60;
  const left = h >= 1 ? (m >= 30 ? h + 1 : h) + ' ч' : mins + ' мин';
  return { title: 'Через ' + left + ': ' + it.title, body: it.date.slice(8, 10) + '.' + it.date.slice(5, 7) + ' в ' + it.time + (it.note ? ' · ' + it.note : ''), tag: 'plan-' + it.id, url: './' };
}
function sendDueReminders_(nowMs) {
  ensureAll_();
  const st = getSettings(), off = tzOffsetMin_(st), subs = readPush_();
  const due = dueReminders_(readPlan_(), nowMs, off, String(st.tz_name || '')), res = { due: due.length, sent: 0, devices: subs.length };
  if (!subs.length || !due.length) return res;
  const sh = SpreadsheetApp.getActive().getSheetByName(SH.PLAN);
  due.forEach(d => {
    const r = pushBroadcast_(reminderText_(d.item, d.start - nowMs));
    if (r.sent > 0) { const c = sh.getRange(d.item.row, 9); c.setNumberFormat('@'); c.setValue(new Date(nowMs).toISOString()); res.sent++; }   // не отправили никому — повторим на следующем запуске
  });
  return res;
}
function reminderTick() {     // вызывается триггером раз в 5 минут
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { return { skipped: true }; }
  try { return sendDueReminders_(Date.now()); } finally { lock.releaseLock(); }
}
function installTriggers() {  // один раз запускается из меню таблицы: «Включить напоминания»
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'reminderTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('reminderTick').timeBased().everyMinutes(5).create();
  try { SpreadsheetApp.getUi().alert('Готово: напоминания проверяются каждые 5 минут.'); } catch (e) { }
}
function triggersInstalled_() { try { return ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'reminderTick'); } catch (e) { return false; } }

/* ---------- сводка для клиента ---------- */
function plannerSummary_(today) {
  const lo = addDays_(today, -60), hi = addDays_(today, 400), lo180 = addDays_(today, -180);
  let pub = '';
  try { pub = vapid_().pubB64; } catch (e) { pub = ''; }            // сбой шифрования не должен ломать остальное приложение
  return {
    items: readPlan_().filter(x => x.date >= lo && x.date <= hi).map(stripRow_),
    notes: readDayNotes_().filter(x => x.date >= lo).map(stripRow_),
    habits: readHabits_().map(stripRow_),
    hlog: readHabitLog_().filter(x => x.date >= lo180).map(stripRow_),
    focus: readFocus_().filter(x => x.date >= lo180).map(stripRow_),
    errors: readErrors_().map(stripRow_).reverse().slice(0, 1500),
    cov: readCov_().map(stripRow_),
    push: { pub: pub, devices: readPush_().length, trigger: triggersInstalled_() }
  };
}
/*==== END:planner ====*/
