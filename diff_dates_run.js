const ROOT = require('path').resolve(__dirname, '..');
const fs = require('fs'), vm = require('vm'); const h = fs.readFileSync((ROOT + '/src/Index.html'), 'utf8'); const ctx = vm.createContext({ console });
const pick = n => { const m = new RegExp('function ' + n + '\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}\\n').exec(h); if (!m) throw new Error('нет ' + n); return m[0]; };
['utcMs', 'addDaysStr', 'daysBetweenStr', 'weekdayOf', 'mondayOf', 'monthGrid', 'shiftMonth', 'pad2'].forEach(n => { try { vm.runInContext(pick(n), ctx); } catch (e) { console.log('пропуск', n, e.message); } });
const run = s => JSON.parse(vm.runInContext('JSON.stringify(' + s + ')', ctx));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const R = rng(Number(process.argv[2] || 1)); const pad = (n, w) => String(n).padStart(w || 2, '0'); const rd = () => (1995 + Math.floor(R() * 90)) + '-' + pad(1 + Math.floor(R() * 12)) + '-' + pad(1 + Math.floor(R() * 28));
const out = { grids: [], add: [], between: [], wd: [], mon: [], shift: [] };
for (let y = 1995; y <= 2060; y++) for (let m = 1; m <= 12; m++) out.grids.push([y + '-' + pad(m), run(`monthGrid('${y}-${pad(m)}')`)]);
for (let i = 0; i < 3000; i++) { const s = rd(), n = Math.floor(R() * 4000) - 2000, t = rd(); out.add.push([s, n, run(`addDaysStr('${s}', ${n})`)]); out.between.push([s, t, run(`daysBetweenStr('${s}', '${t}')`)]); out.wd.push([s, run(`weekdayOf('${s}')`)]); out.mon.push([s, run(`mondayOf('${s}')`)]); const k = Math.floor(R() * 61) - 30; out.shift.push([s.slice(0, 7), k, run(`shiftMonth('${s.slice(0, 7)}', ${k})`)]); }
['1999-12-31', '2000-02-28', '2000-02-29', '2100-02-28', '2024-02-29', '2026-12-31'].forEach(s => { out.add.push([s, 1, run(`addDaysStr('${s}', 1)`)]); out.add.push([s, -1, run(`addDaysStr('${s}', -1)`)]); });
fs.writeFileSync('/tmp/diff_dates.json', JSON.stringify(out)); console.log('ok');
