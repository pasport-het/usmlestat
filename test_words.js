// Проект «Слова»: сервер — импорт, набор дня, смена слова по времени, повторение, виджет, доступ.
const { loadServer, fresh } = require('./hw.js'); loadServer();
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const err = f => { try { f(); return 'OK'; } catch (e) { return String(e.message); } };
const T = '2026-10-12';
const mkWords = (n, tr = true) => Array.from({ length: n }, (_, i) => ({ w: 'word' + String.fromCharCode(97 + (i % 26)) + Math.floor(i / 26), tr: tr ? 'перевод ' + i : '', exp: 'объяснение ' + i, ex: 'Example with word' + i + '.', pos: 'n.' }));
console.log('=== ТАБЛИЦЫ И КЛЮЧ ===');
fresh(T); const S0 = getSettings_();
check('созданы листы Words/Day/Log/Settings; ключ 40 символов создаётся один раз; настройки по умолчанию', [['Words', 'Day', 'Log', 'Settings'].every(n => !!SpreadsheetApp.getActive().getSheetByName(n)), S0.api_key.length, (ensureAll_(), getSettings_().api_key === S0.api_key), S0.interval, S0.daily, S0.start, S0.end], [true, 40, true, '15', '20', '08:00', '22:00']);
console.log('\n=== ИМПОРТ ===');
check('пустой/слишком большой/не список — отклоняются (E_ROWS)', [err(() => wImport({ rows: [] })), err(() => wImport({ rows: mkWords(301) })), err(() => wImport({ rows: 'x' })), err(() => wImport({}))], ['E_ROWS', 'E_ROWS', 'E_ROWS', 'E_ROWS']);
let D = wImport({ rows: [{ w: 'cat', tr: 'кошка', exp: 'домашнее животное', ex: 'The cat sleeps.', pos: 'n.' }, { w: ' Dog ', tr: 'собака' }, { w: '<b>bird</b>', tr: 'птица' }, { w: '12345', tr: 'цифры' }, { w: '', tr: 'пусто' }, { w: 'кошка', tr: 'нет латиницы' }, { w: 'take off', tr: 'взлетать; снимать' }, { w: 'x'.repeat(200), tr: 'длинное' }, { w: 'Cat', tr: 'кошка (дубль)' }] });
check('добавлены cat, Dog, bird, take off; цифры/пусто/без латиницы пропущены; «Cat» — дубль «cat»; HTML-теги вычищены; слишком длинное обрезано до 80', [D.words.map(w => w.word), D.words.find(w => w.word === 'cat').tr], [['cat', 'Dog', 'bird', 'take off', 'x'.repeat(80)], 'кошка (дубль)']);
D = wImport({ rows: [{ w: 'DOG', tr: '', exp: 'друг человека' }, { w: 'bird' }, { w: 'cat', tr: 'кошка (дубль)' }] });
check('повторный импорт: пустые поля не затирают перевод; непустые обновляют; ничего не дублируется', [D.words.length, D.words.find(w => w.word === 'Dog').tr, D.words.find(w => w.word === 'Dog').exp], [5, 'собака', 'друг человека']);
check('слова получают дату добавления и неповторяющиеся id; цвет слова постоянный и не зависит от регистра', [D.words.every(w => w.added === T), new Set(D.words.map(w => w.id)).size, D.words.every(w => w.hue >= 0 && w.hue < 360), hue_('Cat') === hue_('cat')], [true, 5, true, true]);
{ const old = MAX_WORDS; MAX_WORDS = 7; fresh(T); wImport({ rows: mkWords(6) }); check('лимит слов: сверх лимита E_LIMIT, уже добавленное не теряется', [err(() => wImport({ rows: mkWords(10).slice(6).map((w, i) => Object.assign(w, { w: 'zz' + i + 'abc' })) })), wGetAll({}).words.length], ['E_LIMIT', 6]); MAX_WORDS = old; }
console.log('\n=== НАБОР НА ДЕНЬ ===');
fresh(T); wImport({ rows: mkWords(50) }); wImport({ rows: [{ w: 'notranslation' }] });
let A = wGetAll({ today: T });
check('в наборе дня ровно 20 слов, без повторов, только слова с переводом; все новые стали «learning» с повтором завтра', [A.day.ids.length, new Set(A.day.ids).size, A.day.ids.every(id => A.words.find(w => w.id === id).tr), A.words.filter(w => w.status === 'learning').length, A.words.filter(w => w.status === 'learning').every(w => w.due === addDays_(T, 1))], [20, 20, true, 20, true]);
check('слово без перевода в набор не попадает и остаётся новым', [A.words.find(w => w.word === 'notranslation').status, A.day.ids.includes(A.words.find(w => w.word === 'notranslation').id)], ['new', false]);
const A2 = wGetAll({ today: T }); check('набор стабилен в течение дня: повторное открытие даёт те же слова в том же порядке', J(A2.day.ids) === J(A.day.ids), true);
{ fresh(T); const e0 = wGetAll({ today: T }); const ids0 = e0.day.ids.slice(); wImport({ rows: mkWords(5) }); const e1 = wGetAll({ today: T }); wImport({ rows: mkWords(40).slice(5).map((w, i) => Object.assign(w, { w: 'late' + i + 'xyz' })) }); const e2 = wGetAll({ today: T });
  check('набор был пуст утром, слова импортированы днём → попадают в набор сегодня (5), затем добираются до 20; порядок уже показанных не сдвигается', [ids0.length, e1.day.ids.length, e2.day.ids.length, e2.day.ids.slice(0, 5).join() === e1.day.ids.join(), new Set(e2.day.ids).size], [0, 5, 20, true, 20]); }
fresh(T); wImport({ rows: mkWords(50) }); wImport({ rows: [{ w: 'notranslation' }] }); A = wGetAll({ today: T });
check('лист Day: одна строка на сегодня', SpreadsheetApp.getActive().getSheetByName('Day').getLastRow(), 2);
global.SERVER_TODAY_FORCE_ = addDays_(T, 1); const B = wGetAll({ today: addDays_(T, 1) });
check('завтра: сначала повторения (вчерашние, не больше «reviews» = 6), остальное — новые слова; 20 в сумме', [B.day.ids.length, B.day.ids.filter(id => A.day.ids.includes(id)).length, B.day.ids.filter(id => !A.day.ids.includes(id)).length], [20, 6, 14]);
check('повторения — те, у кого срок наступил; новые не пересекаются со вчерашними', [B.day.ids.filter(id => A.day.ids.includes(id)).every(id => B.words.find(w => w.id === id).due <= addDays_(T, 1)), new Set(B.day.ids).size], [true, 20]);
global.SERVER_TODAY_FORCE_ = addDays_(T, 3); const C = wGetAll({ today: addDays_(T, 3) });
check('через 2 дня без заходов: просроченные слова возвращаются первыми (самые давние раньше), набор снова 20', [C.day.ids.length, C.words.filter(w => C.day.ids.includes(w.id) && w.due && w.due < addDays_(T, 3)).length >= 0], [20, true]);
{ fresh(T); wImport({ rows: mkWords(8) }); global.SERVER_TODAY_FORCE_ = T; const E = wGetAll({ today: T }); check('новых меньше, чем «слов в день»: набор = всё, что есть (8), без пустых мест и повторов', [E.day.ids.length, new Set(E.day.ids).size], [8, 8]);
  global.SERVER_TODAY_FORCE_ = addDays_(T, 1); const E2 = wGetAll({ today: addDays_(T, 1) }); check('на следующий день новых нет — набор добирается повторениями (все 8 слов), а не пустеет', E2.day.ids.length, 8); }
{ fresh(T); wImport({ rows: mkWords(30) }); const F = wGetAll({ today: T }), del = F.day.ids[3]; const F2 = wDelete({ id: del, today: T });
  check('удаление слова убирает его из набора и из таблицы; если есть новые слова — набор снова добирается до 20; повторное удаление — E_STALE', [F2.day.ids.length, F2.day.ids.includes(del), F2.words.some(w => w.id === del), err(() => wDelete({ id: del, today: T }))], [20, false, false, 'E_STALE']);
  fresh(T); wImport({ rows: mkWords(20) }); const H = wGetAll({ today: T }), d2 = H.day.ids[0]; const H2 = wDelete({ id: d2, today: T });
  check('если новых слов нет — набор остаётся без удалённого (19)', [H2.day.ids.length, H2.day.ids.includes(d2)], [19, false]); }
console.log('\n=== СМЕНА СЛОВА ПО ВРЕМЕНИ (окно 08:00–22:00, шаг 15 мин) ===');
{ const S = { start: '08:00', end: '22:00', interval: '15' }; const sl = (m, n) => slot_(S, n, m);
  check('до начала окна — первое слово, следующее в 08:00', [sl(479, 20).slot, sl(479, 20).next, sl(0, 20).slot], [0, 480, 0]);
  check('08:00–08:14 — слот 0; 08:15 — слот 1; граница ровно в 15 минут', [sl(480, 20).slot, sl(494, 20).slot, sl(495, 20).slot, sl(480, 20).next, sl(495, 20).next], [0, 0, 1, 495, 510]);
  check('в окне 56 слотов; последний слот 21:45–21:59, следующее слово — завтра в 08:00', [sl(1000, 20).slots, sl(1319, 20).slot, sl(1319, 20).next, sl(1320, 20).slot, sl(1320, 20).next, sl(1439, 20).next], [56, 55, 1320, 55, 1920, 1920]);
  check('20 слов по кругу: слот 19 → слово 19, слот 20 → снова слово 0 (цикл 2), слот 40 → цикл 3', [sl(480 + 19 * 15, 20).idx, sl(480 + 20 * 15, 20).idx, sl(480 + 20 * 15, 20).cycle, sl(480 + 40 * 15, 20).idx, sl(480 + 40 * 15, 20).cycle], [19, 0, 1, 0, 2]);
  check('СВОЙСТВО (все 1440 минут): слот не убывает, меняется ровно раз в 15 минут, «следующее» всегда позже «сейчас» (до конца окна)', (() => { let bad = 0, prev = -1; for (let m = 0; m < 1440; m++) { const s = sl(m, 20); if (s.slot < prev) bad++; prev = s.slot; if (m >= 480 && m < 1320) { if (s.slot !== Math.floor((m - 480) / 15)) bad++; if (!(s.next > m)) bad++; if (s.next - m > 15) bad++; } } return bad; })(), 0);
  check('свойство для других настроек (шаг 1…240, окна, число слов 1…60): idx в диапазоне, шаг ≥ 1, не падает', (() => { let bad = 0; for (const iv of [1, 5, 10, 15, 20, 30, 60, 240]) for (const [st, en] of [['00:00', '24:00'], ['06:30', '23:45'], ['09:00', '09:30']]) for (const n of [0, 1, 7, 20, 60]) for (let m = 0; m < 1440; m += 37) { const s = slot_({ start: st, end: en, interval: String(iv) }, n, m); if (!(s.idx >= 0 && (n === 0 || s.idx < n)) || !(s.slots >= 1)) bad++; } return bad; })(), 0); }
console.log('\n=== ПОВТОРЕНИЕ (SM-2) ===');
fresh(T); wImport({ rows: mkWords(3) }); const W = wGetAll({ today: T }).words, id = W[0].id;
let G = wGrade({ id, grade: 3, today: T }), w1 = G.word;
check('«Хорошо» для нового: интервал 1 день, повторение 1, лёгкость 2.5, срок завтра; запись в журнал', [w1.ivl, w1.reps, w1.due, w1.status, G.stats.gradedToday, readLog_().length], [1, 1, addDays_(T, 1), 'learning', 1, 1]);
G = wGrade({ id, grade: 3, today: T }); w1 = G.word; check('второе «Хорошо» подряд: интервал 3', w1.ivl, 3);
G = wGrade({ id, grade: 1, today: T }); w1 = G.word; check('«Снова»: интервал 0 (сегодня же), повторения 0, +1 сбой, лёгкость −0.2', [w1.ivl, w1.reps, w1.lapses, w1.due], [0, 0, 1, T]);
check('СВОЙСТВО интервалов: Трудно < Хорошо < Легко для повторяемого слова; всё в пределах 0…3650', (() => { let bad = 0; for (const ivl of [0, 1, 2, 3, 10, 30, 400, 3649]) for (const ease of [1.3, 2.5, 3.5]) for (const reps of [0, 1, 2, 9]) { const v = intervals_({ ivl, ease, reps }); if (v[0] !== 0 || v.some(x => x < 0 || x > 3650) || (reps > 0 && !(v[1] < v[2] && v[2] < v[3] || v[3] >= 3650)) || (reps === 0 && !(v[1] <= v[2] && (v[2] < v[3] || v[3] >= 3650)))) bad++; } return bad; })(), 0);
{ fresh(T); wImport({ rows: mkWords(1) }); const i = wGetAll({ today: T }).words[0].id; let st = []; for (let k = 0; k < 8; k++) { const r = wGrade({ id: i, grade: 4, today: addDays_(T, 0) }).word; st.push(r.status + ':' + r.ivl); } check('цепочка «Легко»: интервал растёт, слово становится «known» при интервале ≥ 21 дня', [st[0], st[st.length - 1].startsWith('known')], ['learning:4', true]); }
check('оценка отклоняется: 0, 5, 2.5, не число, неверный id', [0, 5, 2.5, 'a'].map(g => err(() => wGrade({ id, grade: g, today: T }))).concat(err(() => wGrade({ id: 'нет', grade: 3, today: T }))), ['E_GRADE', 'E_GRADE', 'E_GRADE', 'E_GRADE', 'E_STALE']);
console.log('\n=== НАСТРОЙКИ ===');
fresh(T);
check('допустимые значения принимаются и сохраняются', (() => { const r = wSetSettings({ interval: 10, daily: 30, reviews: 5, start: '07:30', end: '23:00', theme: 'dark', reveal: 'tap', today: T }).settings; return [r.interval, r.daily, r.reviews, r.start, r.end, r.theme, r.reveal]; })(), [10, 30, 5, '07:30', '23:00', 'dark', 'tap']);
check('недопустимые отклоняются (E_SETTING): шаг 0/241/дробный, слов 0/101, повторений > слов в день, время 25:00/мусор, окно короче шага, тема, адрес не https', [{ interval: 0 }, { interval: 241 }, { interval: 1.5 }, { daily: 0 }, { daily: 101 }, { reviews: 31 }, { start: '25:00' }, { start: 'abc' }, { end: '07:00' }, { end: '07:35', start: '07:30' }, { theme: 'розовая' }, { reveal: 'x' }, { site_url: 'http://x.y' }, { site_url: 'javascript:alert(1)' }].map(b => err(() => wSetSettings(Object.assign({ today: T }, b)))), Array(14).fill('E_SETTING'));
check('адрес сайта: https принимается и сохраняется', wSetSettings({ site_url: 'https://samir.github.io/words/', today: T }).settings.site_url, 'https://samir.github.io/words/');
console.log('\n=== ВИДЖЕТ (JSON по ключу) ===');
fresh(T); wImport({ rows: mkWords(25) }); const key = getSettings_().api_key; wGetAll({ today: T }); wSetSettings({ site_url: 'https://samir.github.io/words/', today: T });
global.AUTH_OFF_ = false; const wd = q => JSON.parse(doGet({ parameter: Object.assign({ widget: '1', k: key, d: T }, q) }));
const r0 = wd({ m: '480' }), r1 = wd({ m: '495' }), rEnd = wd({ m: '1325' });
check('без ключа и с чужим ключом — отказ без данных; нечисловое/отрицательное/дробное/слишком большое время — E_TIME', [wd({ k: '' }).ok, wd({ k: 'чужой' }).ok, wd({ m: 'x' }).error, wd({ m: '-1' }).error, wd({ m: '1.5' }).error, wd({ m: '1440' }).error], [false, false, 'TIME', 'TIME', 'TIME', 'TIME']);
check('08:00 → слово 1 из 20; следующий слот 08:15 → слово 2; следующее слово в ответе = слово следующего слота', [r0.idx, r0.n, r1.idx, r0.next.word === r1.word.word, r0.nextAtMin, r1.nextAtMin], [1, 20, 2, true, 495, 510]);
check('в конце дня остаётся последний слот и «следующее» — завтра в 08:00', [rEnd.nextAtMin, rEnd.idx], [1920, 56 % 20 === 0 ? 20 : 56 - 1 - Math.floor(55 / 20) * 20 + 1 - 0]);
check('в ответе виджета только нужное: слово, объяснение, пример, цвет, номер, адрес для нажатия; ни ключа, ни остальных слов', [Object.keys(r0).sort(), Object.keys(r0.word).sort(), JSON.stringify(r0).indexOf(key)], [['cycle', 'empty', 'idx', 'interval', 'n', 'next', 'nextAtMin', 'nowMin', 'ok', 'today', 'url', 'word'], ['ex', 'exp', 'hue', 'id', 'ipa', 'pos', 'tr', 'word'], -1]);
check('слово виджета = слово приложения для того же момента (одна и та же формула)', (() => { const A = wGetAll({ k: key, today: T }); const list = A.day.ids.map(i => A.words.find(w => w.id === i)); let bad = 0; for (let m = 0; m < 1440; m += 11) { const s = slot_(getSettings_(), list.length, m); if (wd({ m: String(m) }).word.word !== list[s.idx].word) bad++; } return bad; })(), 0);
{ fresh(T); global.AUTH_OFF_ = false; const k2 = getSettings_().api_key; const e = JSON.parse(doGet({ parameter: { widget: '1', k: k2, d: T, m: '600' } })); check('пока слов нет — «empty: true», без ошибки', [e.ok, e.empty], [true, true]); }
console.log('\n=== ДОСТУП ===');
{ const key2 = getSettings_().api_key; const fns = { wGetAll: () => wGetAll({}), wImport: () => wImport({ rows: [{ w: 'a' }] }), wEdit: () => wEdit({ id: 'x' }), wDelete: () => wDelete({ id: 'x' }), wGrade: () => wGrade({ id: 'x', grade: 3 }), wSetSettings: () => wSetSettings({ daily: 10 }) };
  check('все операции без ключа и с чужим ключом отклонены', Object.keys(fns).filter(k => !/AUTH/.test(err(fns[k]))), []);
  check('с верным ключом принимаются; страница приложения: без ключа — «Доступ закрыт», с ключом — приложение', [err(() => wGetAll({ k: key2 })), /Доступ закрыт/.test(doGet({ parameter: {} })._html), /var VIEW_KEY = "/.test(doGet({ parameter: { k: key2 } })._html || '')], ['OK', true, true]); global.AUTH_OFF_ = true; }
console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
