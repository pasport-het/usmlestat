// Время событий по названию часового пояса (летнее время) против переборного «оракула» на данных Intl.
const { loadServer, fresh } = require('./h.js'); loadServer();
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 200)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ZONES = ['Asia/Tashkent', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'Asia/Kolkata', 'Pacific/Auckland', 'America/Sao_Paulo', 'Africa/Cairo', 'Asia/Tehran', 'Pacific/Chatham'];
const fmtCache = {}; const local = (z, ms) => { const f = fmtCache[z] || (fmtCache[z] = new Intl.DateTimeFormat('en-CA', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })); const g = {}; f.formatToParts(ms).forEach(x => g[x.type] = x.value); return Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute); };
function oracle(z, naive) { const hits = []; for (let t = naive - 16 * 3600000; t <= naive + 16 * 3600000; t += 15 * 60000) if (local(z, t) === naive) hits.push(t); return hits.length ? { hits, first: Math.min(...hits) } : null; }
const T = '2026-10-12'; fresh(T);
console.log('=== НАЗВАНИЕ ПОЯСА: ПРОВЕРКА И ХРАНЕНИЕ ===');
check('настоящие названия принимаются', ['Asia/Tashkent', 'America/New_York', 'Europe/Berlin', 'UTC'].map(n => { saveSettings({ tz_name: n, today: T }); return getAll(T).settings.tz_name; }), ['Asia/Tashkent', 'America/New_York', 'Europe/Berlin', 'UTC']);
saveSettings({ tz_name: 'Asia/Tashkent', today: T });
check('мусор, несуществующие и опасные названия отклоняются (прежнее остаётся)', ['Не/Пояс', 'Mars/Phobos', '../etc/passwd', 'a'.repeat(200), '<script>', 'Asia/Tashkent; DROP', 'A/B/C/D/E'].map(n => { saveSettings({ tz_name: n, today: T }); return getAll(T).settings.tz_name; }), Array(7).fill('Asia/Tashkent'));
console.log('\n=== КОНКРЕТНЫЕ СЛУЧАИ ===');
check('18:00 в UTC+5 (смещение без названия) → 13:00 UTC', eventStartMs_('2026-10-20', '18:00', 300), Date.UTC(2026, 9, 20, 13, 0));
check('Нью-Йорк, лето: 09:00 15 июля → 13:00 UTC (хотя «текущее» смещение зимнее)', eventStartMs_('2026-07-15', '09:00', -300, 'America/New_York'), Date.UTC(2026, 6, 15, 13, 0));
check('Берлин, лето: 18:00 → 16:00 UTC; Ташкент всегда +5', [eventStartMs_('2026-07-20', '18:00', 60, 'Europe/Berlin'), eventStartMs_('2026-01-10', '18:00', 0, 'Asia/Tashkent'), eventStartMs_('2026-07-10', '18:00', 0, 'Asia/Tashkent')], [Date.UTC(2026, 6, 20, 16, 0), Date.UTC(2026, 0, 10, 13, 0), Date.UTC(2026, 6, 10, 13, 0)]);
check('Нью-Йорк, осенний перевод назад (01:30 бывает дважды) → более раннее вхождение (EDT)', eventStartMs_('2026-11-01', '01:30', -300, 'America/New_York'), Date.UTC(2026, 10, 1, 5, 30));
check('Нью-Йорк, весенний перевод (02:30 не существует) → 03:30 EDT', eventStartMs_('2026-03-08', '02:30', -300, 'America/New_York'), Date.UTC(2026, 2, 8, 7, 30));
check('неизвестное название не ломает: запасной вариант — смещение', eventStartMs_('2026-10-20', '18:00', 300, 'Не/Пояс'), Date.UTC(2026, 9, 20, 13, 0));
console.log('\n=== ОКРЕСТНОСТИ ВСЕХ ПЕРЕХОДОВ 2026–2027 В 12 ПОЯСАХ = ОРАКУЛ ===');
{ let bad = [], total = 0, amb = 0, gap = 0, trans = 0;
  for (const z of ZONES) { let prev = null; for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2028, 0, 1); t += 3600000) { const o = tzOffsetAtMs_(z, t); if (prev !== null && o !== prev) { trans++;
      for (let dm = -150; dm <= 150; dm += 15) { const lt = new Date(local(z, t) + dm * 60000), date = lt.toISOString().slice(0, 10), time = lt.toISOString().slice(11, 16), naive = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), +time.slice(0, 2), +time.slice(3, 5)), got = eventStartMs_(date, time, 0, z), orc = oracle(z, naive); total++;
        if (orc) { if (orc.hits.length > 1) amb++; if (got !== orc.first) bad.push([z, date, time]); } else { gap++; const l = local(z, got); if (!(l >= naive && l - naive <= 90 * 60000)) bad.push([z, date, time, 'gap']); } } } prev = o; } }
  check('переходов ' + trans + ', моментов ' + total + ' (неоднозначных ' + amb + ', пропущенных ' + gap + '): отличий от оракула нет', [bad.slice(0, 3), amb > 20, gap > 20], [[], true, true]); }
{ const R = rng(7); let n = 0, bad = []; for (const z of ZONES) for (let i = 0; i < 120; i++) { const y = 2024 + Math.floor(R() * 7), mo = 1 + Math.floor(R() * 12), d = 1 + Math.floor(R() * 28), h = Math.floor(R() * 24), mi = Math.floor(R() * 60); const date = y + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0'), time = String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0'), naive = Date.UTC(y, mo - 1, d, h, mi), got = eventStartMs_(date, time, 0, z), o = oracle(z, naive); n++; if (o && got !== o.first) bad.push([z, date, time]); }
  check('случайные даты 2024–2030 × 12 поясов (' + n + '): результат = оракул', bad.slice(0, 3), []); }
console.log('\n=== НАПОМИНАНИЯ ===');
{ const item = o => Object.assign({ kind: 'event', time: '09:00', remind: 10, done: '', sent: '', date: '2026-07-15', row: 2, id: 'p_x' }, o), start = Date.UTC(2026, 6, 15, 13, 0), due = (now, tz, off) => dueReminders_([item({})], now, off, tz).length;
  check('в окне напоминания (за 9.5 ч до начала): с названием пояса — есть, без названия при зимнем смещении — опаздывает на час (нет)', [due(start - 9.5 * 3600000, 'America/New_York', -300), due(start - 9.5 * 3600000, '', -300)], [1, 0]);
  check('прошедшее, без времени, выполненное и уже отправленное не напоминаются', [dueReminders_([item({ date: '2026-07-14' })], start, -240, 'America/New_York').length, dueReminders_([item({ time: '' })], start - 3600000, -240, 'America/New_York').length, dueReminders_([item({ done: '2026-07-15' })], start - 3600000, -240, 'America/New_York').length, dueReminders_([item({ sent: '2026-07-15T01:00:00Z' })], start - 3600000, -240, 'America/New_York').length], [0, 0, 0, 0]); }
console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
