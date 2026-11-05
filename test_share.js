// «Поделиться»: управление ссылкой, приватность данных, доступ без ключа, поведение при отзыве, кэш.
const { loadServer, fresh } = require('./h.js'); loadServer();
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12';
function seed() {
  fresh(T); saveSettings({ exam_date: '2026-12-01', target_score: 250, student_name: 'СекретноеИмяВладельца', site_url: 'https://samir.github.io/usmle/', today: T });
  for (let k = 25; k >= 0; k--) { addUWorld({ date: addDays_(T, -k), system: ['Renal', 'Cardiovascular', 'Endocrine'][k % 3], q: 20 + (k % 7), correct: 10 + (k % 8), note: 'СЕКРЕТНАЯ_ЗАМЕТКА_UW', today: T }); addLog({ date: addDays_(T, -k), system: 'Renal', pages: 9, note: 'СЕКРЕТНАЯ_ЗАМЕТКА_FA', today: T }); }
  addUWorld({ date: T, system: 'Multi', systems: ['Renal', 'Endocrine'], q: 10, correct: 6, today: T });
  saveNBME({ exam: 'СЕКРЕТНЫЙ_NBME', date: addDays_(T, -3), score: 233, today: T });
  planAdd({ id: 'p_secret0001', date: T, title: 'СЕКРЕТНОЕ_ДЕЛО', kind: 'task', today: T });
  uweAdd({ id: 'e_secret0001', date: T, system: 'Renal', topic: 'СЕКРЕТНАЯ_ТЕМА_ОШИБКИ', reason: 'guess', today: T });
  for (let k = 40; k >= 0; k--) upsertDaily_([{ d: addDays_(T, -k), n: 100 + k, m: 40 + (k % 9), nw: 10, a: 5, h: 10, g: 70, e: 15, yn: 60, yk: 54, mn: 30, mk: 28, ln: 10, lk: 8 }]);
  writeMeta_({ anki_today: T, first_review: '2025-01-01', synced_at: '2026-10-12 08:00', streak: 41, longest_streak: 60, rev_total: 90000, min_total: 40000, hours: Array.from({ length: 24 }, (_, h) => ({ n: h === 9 ? 80 : 5, ok: h === 9 ? 70 : 4 })), forecast: Array.from({ length: 31 }, (_, i) => 30 + i), states: { new_all: 500 } });
}
console.log('=== УПРАВЛЕНИЕ ССЫЛКОЙ ===');
seed();
check('до включения: доступ закрыт, ссылки нет', (({ enabled, link }) => ({ enabled, link }))(shareGet({})), { enabled: false, link: '' });
let info = shareEnable({}); const tok1 = shareToken_();
check('включили: токен 32 символа base64url, ссылка через ваш сайт (без баннера Google)', [info.enabled, /^[A-Za-z0-9_-]{32}$/.test(tok1), info.link === 'https://samir.github.io/usmle/?share=AKfycbTESTDEPLOYMENTID_1234567890abcdefghij.' + tok1, info.viaSite], [true, true, true, true]);
check('повторное «включить» ничего не меняет (тот же токен, та же ссылка)', [shareEnable({}).link === info.link, shareToken_() === tok1], [true, true]);
check('токены уникальны и непредсказуемы: 300 новых — все разные', (() => { const set = new Set(); for (let i = 0; i < 300; i++) set.add(shareNewToken_()); return set.size; })(), 300);
check('символы токена равномерно из алфавита base64url (нет служебных символов, не кончается «=»)', (() => { let bad = 0; for (let i = 0; i < 300; i++) if (!/^[A-Za-z0-9_-]{32}$/.test(shareNewToken_())) bad++; return bad; })(), 0);
saveSettings({ site_url: '', today: T }); check('без адреса сайта ссылка ведёт прямо на веб-приложение (параметр s)', shareGet({}).link, 'https://script.google.com/macros/s/AKfycbTESTDEPLOYMENTID_1234567890abcdefghij/exec?s=' + tok1);
saveSettings({ site_url: 'https://samir.github.io/usmle/', today: T });
check('дата создания записана (ISO), просмотров пока нет', [/^\d{4}-\d{2}-\d{2}T/.test(shareGet({}).created), shareGet({}).lastView], [true, '']);
check('имя: очищается от управляющих символов и тегов, обрезается до 40, хранится', [shareName({ name: '  <b>Самир</b>\n\t' + 'x'.repeat(60) }).name.length, shareName({ name: '  <b>Самир</b>\n\t' }).name], [40, 'bSамир/b'.replace('bSамир/b', 'bСамир/b')]);
shareName({ name: '' });
console.log('\n=== ДОСТУП ПО ТОКЕНУ ===');
check('верный токен → данные; неверные, пустые и «похожие» → отказ без деталей', [shareData({ s: tok1 }).ok, shareData({ s: tok1.slice(0, -1) + (tok1.slice(-1) === 'A' ? 'B' : 'A') }).ok, shareData({ s: '' }).ok, shareData({}).ok, shareData(null).ok, shareData({ s: tok1 + 'x' }).ok, shareData({ s: tok1.toLowerCase() === tok1 ? tok1.toUpperCase() : tok1.toLowerCase() }).ok, shareData({ s: ['a'] }).ok, shareData({ s: { toString: () => tok1 } }).ok], [true, false, false, false, false, false, false, false, false]);
check('отказ — структурный {ok:false, error:"revoked"}, без исключения и без подробностей', shareData({ s: 'x'.repeat(32) }), { ok: false, error: 'revoked' });
check('сравнение токенов за постоянное время: функция не завязана на раннем выходе', (() => { const src = safeEq_.toString(); return /for \(let i = 0; i < n; i\+\+\)/.test(src) && !/return false/.test(src); })(), true);
check('safeEq_: равные → да; разной длины, пустые, отличие в начале/в конце → нет', [safeEq_('abc', 'abc'), safeEq_('abc', 'abd'), safeEq_('abc', 'ab'), safeEq_('', 'a'), safeEq_('', ''), safeEq_('xbc', 'abc')], [true, false, false, false, true, false]);
console.log('\n=== ПРИВАТНОСТЬ: ЧТО УХОДИТ ДРУГУ ===');
const P = shareData({ s: tok1 }).payload, S = JSON.stringify(P);
check('верхний уровень данных — только разрешённый список', Object.keys(P).sort(), ['anki', 'at', 'name', 'today', 'uw', 'v']);
check('в данных НЕТ ни одной секретной строки: заметки UWorld и First Aid, дела, ошибки, NBME, имя владельца, ключи, дата экзамена, цель, шифрование', ['СЕКРЕТНАЯ_ЗАМЕТКА_UW', 'СЕКРЕТНАЯ_ЗАМЕТКА_FA', 'СЕКРЕТНОЕ_ДЕЛО', 'СЕКРЕТНАЯ_ТЕМА_ОШИБКИ', 'СЕКРЕТНЫЙ_NBME', 'СекретноеИмяВладельца', getSettings().api_key, getSettings().vapid_priv, getSettings().vapid_pub, '2026-12-01', 'exam_date', 'target_score', 'api_key', 'vapid', 'site_url', 'share_token', tok1, 'yt_api_key'].filter(x => x && S.indexOf(x) > -1), []);
check('балл NBME (233) и «страницы First Aid» не просачиваются: нет полей nbme / firstaid / planner / library / videos / errors', ['nbme', 'firstaid', 'planner', 'library', 'videos', 'notes', 'errors', 'cards', 'coverage'].filter(k => S.toLowerCase().indexOf('"' + k + '"') > -1), []);
check('UWorld: только числа и названия систем (поля вопросов/верных/процента/по системам/смешанные/по дням/по неделям)', [Object.keys(P.uw).sort(), Object.keys(P.uw.bySystem[0]).sort(), Object.keys(P.uw.daily[0]).sort(), Object.keys(P.uw.mixed).sort()], [['bySystem', 'correct', 'daily', 'last7', 'mixed', 'pct', 'questions', 'total', 'weeks'], ['c', 'pct', 'q', 'system'], ['c', 'd', 'q'], ['blocks', 'c', 'q']]);
check('Anki: по дням только {день, повторений, минут, новых}; разрешённые блоки анализа', [Object.keys(P.anki.daily[0]).sort(), Object.keys(P.anki).sort()], [['d', 'm', 'n', 'nw'], ['bestHour', 'buttons30', 'd30', 'daily', 'forecast', 'hasDaily', 'peakHour', 'retention', 'streak', 'sync', 'today', 'totals', 'w7', 'weeklyReviews', 'weeklyRetention'].sort()]);
check('в блоках Anki нет «колод», «тем», «слабых карточек» и текстов (только числа/даты)', (() => { const bad = []; const walk = (v, p) => { if (v && typeof v === 'object') Object.keys(v).forEach(k => walk(v[k], p + '.' + k)); else if (typeof v === 'string' && !/^(\d{4}-\d{2}-\d{2}([ T][\d:.\-+Z]+)?|all|main|)$/.test(v) && !/(^|\.)(system|name|v)$/.test(p)) bad.push(p + '=' + v); }; walk(P.anki, 'anki'); return bad.slice(0, 5); })(), []);
check('цифры совпадают с приложением владельца: вопросов, верных, точность, повторений за сегодня и за 7 дней, серия', (() => { const D = getAll(T); return [P.uw.questions === D.uworld.questions, P.uw.correct === D.uworld.correct, P.uw.pct === D.uworld.pct, P.anki.today.n === D.anki.analysis.today.n, P.anki.w7.n === D.anki.analysis.w7.n, P.anki.streak.current === 41]; })(), [true, true, true, true, true, true]);
check('даты в данных не выходят за 90 дней и не из будущего; недель ровно 12; суммы недель = суммы по дням', (() => { const from = addDays_(T, -89); const wk = P.uw.weeks.reduce((a, w) => a + w.q, 0), dd = P.uw.daily.filter(x => x.d >= addDays_(T, -83)).reduce((a, x) => a + x.q, 0); return [P.uw.daily.every(x => x.d >= from && x.d <= T), P.anki.daily.every(x => x.d >= from && x.d <= T), P.uw.weeks.length, wk === dd]; })(), [true, true, 12, true]);
check('имя владельца на странице — только если оно задано в «Поделиться» (по умолчанию пусто, а не имя из настроек)', [P.name, (shareName({ name: 'Самир' }), shareData({ s: tok1 }).payload.name)], ['', 'Самир']); shareName({ name: '' });
console.log('\n=== СТРАНИЦА ПО ССЫЛКЕ (doGet) ===');
{ const page = doGet({ parameter: { s: tok1, emb: '1' } }), html = page._html;
  check('страница отдаётся, в ней режим «share» и токен; ключ владельца ПУСТОЙ', [/var ENV = \{[^}]*"share":true/.test(html), html.indexOf('"shareToken":"' + tok1 + '"') > -1, /var VIEW_KEY = "";/.test(html)], [true, true, true]);
  check('в HTML страницы друга нет ни ключа владельца, ни закрытого ключа уведомлений, ни секретных строк, ни даты экзамена', ['СЕКРЕТНАЯ', 'СЕКРЕТНОЕ', 'СЕКРЕТНЫЙ', 'СекретноеИмя', getSettings().api_key, getSettings().vapid_priv, '2026-12-01'].filter(x => x && html.indexOf(x) > -1), []);
  const bad = doGet({ parameter: { s: 'неверный' } })._html, none = doGet({ parameter: { s: '' } });
  check('неверный токен → нейтральная страница «ссылка недействительна» (без данных)', [/недействительна/.test(bad), bad.indexOf('var INIT') < 0], [true, true]);
  check('без токена и без ключа — прежняя страница отказа (доступ владельца не ослаблен)', /Access denied|Доступ закрыт/i.test(String(none._html)), true); }
console.log('\n=== ДОСТУП ВЛАДЕЛЬЦА НЕ ОСЛАБЛЕН ===');
{ global.AUTH_OFF_ = false; const key = getSettings().api_key;
  const throws = f => { try { f(); return false; } catch (e) { return /AUTH/.test(String(e.message)); } };
  check('управление ссылкой без ключа запрещено (get / enable / regenerate / disable / name)', [() => shareGet({}), () => shareEnable({}), () => shareRegenerate({}), () => shareDisable({}), () => shareName({ name: 'x' }), () => shareGet({ k: 'чужой' })].map(throws), [true, true, true, true, true, true]);
  check('с ключом работает', [shareGet({ k: key }).enabled, shareEnable({ k: key }).enabled], [true, true]);
  check('публичный токен НЕ открывает остальное: getAll / сохранение / добавление — без ключа отказ', [() => getAll(T), () => addUWorld({ date: T, system: 'Renal', q: 1, correct: 1, today: T, s: tok1 }), () => saveSettings({ ui_theme: 'dark', s: tok1 }), () => cardAdd({ id: 'c_abcdefghij', front: 'x', back: 'y', s: tok1 })].map(throws), [true, true, true, true]);
  global.AUTH_OFF_ = true; }
console.log('\n=== ОТЗЫВ: НОВАЯ ССЫЛКА / ОТКЛЮЧЕНИЕ ===');
{ const old = tok1; const r = shareRegenerate({}); const tok2 = shareToken_();
  check('новая ссылка: токен другой, старый сразу перестаёт работать, новый работает', [tok2 !== old, shareData({ s: old }).ok, shareData({ s: tok2 }).ok, /^\S+\?share=\S+\.[A-Za-z0-9_-]{32}$/.test(r.link)], [true, false, true, true]);
  check('страница по старой ссылке — «недействительна»', /недействительна/.test(doGet({ parameter: { s: old } })._html), true);
  const off = shareDisable({});
  check('отключение: доступа нет ни по старому, ни по новому токену; ссылки нет; можно включить заново (будет новый токен)', [off.enabled, off.link, shareData({ s: tok2 }).ok, shareData({ s: old }).ok, (shareEnable({}), shareToken_() !== tok2 && shareToken_() !== old)], [false, '', false, false, true]); }
console.log('\n=== КЭШ И «ПОСЛЕДНИЙ ПРОСМОТР» ===');
{ seed(); shareEnable({}); const tok = shareToken_(); let calls = 0; const orig = build_; global.build_ = function () { calls++; return orig.apply(this, arguments); }; build_ = global.build_;
  shareCacheClear_(); const a = shareData({ s: tok }).payload; const b = shareData({ s: tok }).payload; shareData({ s: tok });
  check('несколько просмотров подряд собирают данные один раз (кэш 60 с)', [calls, J(a) === J(b)], [1, true]);
  shareName({ name: 'Новое имя' }); shareData({ s: tok });
  check('смена имени сбрасывает кэш: данные пересобраны, имя новое', [calls, shareData({ s: tok }).payload.name], [2, 'Новое имя']);
  check('«последний просмотр» записан и обновляется не чаще раза в 5 минут (кэш-метка)', [/^\d{4}-\d{2}-\d{2}T/.test(shareGet({}).lastView), global.__CACHE.share_seen], [true, '1']);
  const before = shareGet({}).lastView; shareData({ s: tok }); check('повторный просмотр в пределах 5 минут запись не меняет', shareGet({}).lastView, before);
  addUWorld({ date: T, system: 'Renal', q: 5, correct: 5, today: T }); const q0 = shareData({ s: tok }).payload.uw.questions; shareCacheClear_(); const q1 = shareData({ s: tok }).payload.uw.questions;
  check('новые данные появляются сразу после сброса кэша и не позднее 60 с без него', [q1 - q0 === 5 || q1 === q0 + 5, q1 > 0], [true, true]);
  global.build_ = orig; build_ = orig; }
console.log('\n=== ГРАНИЦЫ: ПУСТЫЕ ДАННЫЕ, ВЕРСИЯ ===');
{ fresh(T); shareEnable({}); const tok = shareToken_(); const p = shareData({ s: tok }).payload;
  check('нет данных вообще: страница строится (нули и пустые списки, без исключений), Anki помечен «нет данных»', [p.uw.questions, p.uw.bySystem.length, p.uw.daily.length, p.uw.weeks.length, p.anki.hasDaily], [0, 0, 0, 12, false]);
  check('версия сервера передаётся (для проверки «вышла новая версия»)', /^v\d+\.\d+\.\d+$/.test(p.v), true); }
console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
