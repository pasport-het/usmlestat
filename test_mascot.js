const ROOT = require('path').resolve(__dirname, '..');
// Рисунок тьютора (mascot.js): корректная разметка, симметрия лица и тела, экипировка по званиям, рост.
const fs = require('fs'), vm = require('vm'); const { JSDOM } = require('jsdom');
const html = fs.readFileSync((ROOT + '/src/Index.html'), 'utf8'); const a = html.indexOf('var MC_RANKS'), b = html.indexOf("extra + '</svg>';\n}\n", a) + "extra + '</svg>';\n}\n".length;
const ctx = vm.createContext({}); vm.runInContext(html.slice(a, b), ctx); const run = s => vm.runInContext(s, ctx);
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 200)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const RANKS = run('MC_RANKS'), MOODS = ['happy', 'cheer', 'worried', 'neutral', 'sleepy'];
const parse = svg => new (new JSDOM('').window.DOMParser)().parseFromString(svg, 'image/svg+xml');
const nums = d => (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
function xsOf(d) { const out = []; const re = /([MLHVQCZ])([^MLHVQCZ]*)/g; let m; while ((m = re.exec(d))) { const n = nums(m[2]), c = m[1]; if (c === 'H') out.push(...n); else if (c === 'V' || c === 'Z') { } else for (let i = 0; i < n.length; i += 2) out.push(n[i]); } return out; }
const mid = d => { const x = xsOf(d); return (Math.min(...x) + Math.max(...x)) / 2; };
console.log('=== РАЗМЕТКА ===');
{ let bad = [], n = 0; for (const r of RANKS) for (const m of MOODS) { n++; const d = parse(run(`mcSvg(${J({ mood: m, rank: r })})`)); if (d.querySelector('parsererror') || !d.querySelector('svg.mcf')) bad.push(r + '/' + m); } check('все ' + 45 + ' сочетаний «звание × настроение» — корректный SVG', [n, bad], [45, []]); }
check('все ссылки на градиенты разрешаются; идентификаторы уникальны; при двух персонажах на странице заливки не путаются', (() => { const bad = []; for (const r of RANKS) for (const m of MOODS) { const s = run(`mcSvg({mood:'${m}',rank:'${r}',uid:'z'})`); const ids = (s.match(/id="([^"]+)"/g) || []).map(x => x.slice(4, -1)); (s.match(/url\(#([^)]+)\)/g) || []).forEach(u => { if (!ids.includes(u.slice(5, -1))) bad.push(r + '/' + m + ':' + u); }); if (new Set(ids).size !== ids.length) bad.push('дубль id'); } const A = run(`mcSvg({mood:'happy',rank:'resident',uid:'a'})`), B = run(`mcSvg({mood:'happy',rank:'resident',uid:'b'})`); const ia = new Set((A.match(/id="([^"]+)"/g) || [])); return [bad, (B.match(/id="([^"]+)"/g) || []).every(x => !ia.has(x))]; })(), [[], true]);
console.log('\n=== СИММЕТРИЯ ЛИЦА И ТЕЛА (ось x = 60) ===');
for (const m of MOODS) {
  const d = parse(run(`mcSvg({mood:'${m}',rank:'senior',uid:'s'})`)), face = d.querySelector('.mc-face');
  const mouth = Array.from(face.querySelectorAll('path,ellipse')).filter(e => { const col = (e.getAttribute('stroke') || '') + (e.getAttribute('fill') || ''); const dd = e.getAttribute('d') || ''; return (/#0B1426/.test(col) && /M5[0-9]\.[0-9] 7[0-9]|M5[0-9] 7[0-9]|M49\.4 70/.test(dd)) || /#5A1620|#F0707F/.test(col) || (e.tagName === 'ellipse' && e.getAttribute('cx') === '60') || (/#fff/.test(col) && /M50\.6 70\.8/.test(dd)); });
  const axes = mouth.map(e => e.tagName === 'ellipse' ? +e.getAttribute('cx') : mid(e.getAttribute('d')));
  check(m + ': рот (' + mouth.length + ' элем.) симметричен относительно оси лица x = 60', mouth.length > 0 && axes.every(v => Math.abs(v - 60) < 0.06), true);
  const eyes = m === 'sleepy' || m === 'cheer' ? [mid(face.querySelector('path[stroke-width="3"], path[stroke-width="3.2"]').getAttribute('d').split(' M')[0]), 0] : Array.from(face.querySelectorAll('.mc-blink ellipse:first-child')).map(e => +e.getAttribute('cx'));
  if (m !== 'sleepy' && m !== 'cheer') check(m + ': глаза равноудалены от оси', Math.abs((eyes[0] + eyes[1]) / 2 - 60) < 0.01 && eyes.length === 2, true);
  const ch = Array.from(face.querySelectorAll('ellipse[opacity=".42"]')); check(m + ': щёки симметричны и на одной высоте', [(+ch[0].getAttribute('cx') + +ch[1].getAttribute('cx')) / 2, ch[0].getAttribute('cy') === ch[1].getAttribute('cy')], [60, true]);
}
check('глаза/брови/«кулисы» в «worried» и «cheer» зеркальны (x → 120 − x)', (() => { const ok = []; for (const m of ['worried', 'cheer']) { const f = parse(run(`mcSvg({mood:'${m}',rank:'rookie'})`)).querySelector('.mc-face'); const p = Array.from(f.querySelectorAll('path')).find(e => /^M4[23]\.?\d* 5[01]/.test(e.getAttribute('d') || '')); const segs = p.getAttribute('d').split(/(?=M)/).map(x => nums(x)); const L = segs[0], R = segs[1]; ok.push(L.length === R.length && L.every((v, i) => i % 2 === 0 ? Math.abs((120 - R[i]) - v) < 0.06 || Math.abs((120 - R[R.length - 2 - (i - (i % 2))]) - v) < 0.06 : true)); } return ok; })(), [true, true]);
check('корпус, лицо-«экран», шапка симметричны', (() => { const d = parse(run(`mcSvg({mood:'happy',rank:'resident'})`)); const body = d.querySelector('circle[cx="60"][r="44"]'), plate = d.querySelector('rect[x="29"]'), cap = Array.from(d.querySelectorAll('path')).find(p => /^M60 11 L98 26/.test(p.getAttribute('d'))); return [!!body, Math.abs(+plate.getAttribute('x') + +plate.getAttribute('width') / 2 - 60) < 0.01, Math.abs(mid(cap.getAttribute('d')) - 60) < 0.01]; })(), [true, true, true]);
check('очки симметричны (круги на x = 48 и 72)', (() => { const d = parse(run(`mcSvg({mood:'happy',rank:'senior'})`)); const c = Array.from(d.querySelectorAll('circle[r="10"]')); return [c.length, (+c[0].getAttribute('cx') + +c[1].getAttribute('cx')) / 2]; })(), [2, 60]);
check('две руки: левая и правая зеркальны (плечо 29/91, кисть 15/105)', (() => { const d = parse(run(`mcSvg({mood:'happy',rank:'rookie'})`)); const L = d.querySelector('.mc-arm-l'), R = d.querySelector('.mc-arm-r'); const c = e => +e.querySelector('circle').getAttribute('cx'); return [!!L, !!R, c(L) + c(R)]; })(), [true, true, 120]);
console.log('\n=== ЗВАНИЯ ===');
const of = r => { const o = run(`mcOutfit('${r}')`); return [o.steth, o.glasses, o.star, o.trim, o.crown]; };
check('rookie/student: без стетоскопа и очков', [of('rookie'), of('student')], [[false, false, false, false, false], [false, false, false, false, false]]);
check('intern/resident: стетоскоп', [of('intern'), of('resident')], [[true, false, false, false, false], [true, false, false, false, false]]);
check('senior: + очки; fellow: + звезда на шапке; attending: + золотая кайма; chief: то же; professor: + корона-звезда', [of('senior'), of('fellow'), of('attending'), of('chief'), of('professor')], [[true, true, false, false, false], [true, true, true, false, false], [true, true, true, true, false], [true, true, true, true, false], [true, true, true, true, true]]);
check('кисточка: у каждого звания свой цвет не хуже предыдущего (бронза → серебро → золото)', RANKS.map(r => run(`mcOutfit('${r}').tassel`)), ['#94A3B8', '#C98B4A', '#CBD5E1', '#F5B31B', '#F5B31B', '#F5B31B', '#F59E0B', '#F59E0B', '#FBBF24']);
check('неизвестное звание не ломает рисунок (как «новичок»)', [run(`mcOutfit('???').key`), run(`mcSvg({mood:'happy',rank:'???'})`).length > 1000], [0, true]);
check('экипировка у каждого следующего звания не пропадает (стетоскоп, очки, звезда, кайма)', (() => { let ok = true, p = null; RANKS.forEach(r => { const o = run(`mcOutfit('${r}')`); if (p) ['steth', 'glasses', 'star', 'trim'].forEach(k => { if (p[k] && !o[k]) ok = false; }); p = o; }); return ok; })(), true);
console.log('\n=== РОСТ ===');
check('масштаб: 1-й уровень 0.88, 25-й и выше 1.00, не выходит за границы, строго растёт', [run('mcScale(1)'), run('mcScale(25)'), run('mcScale(99)'), run('mcScale(-3)'), (() => { let ok = true, p = 0; for (let l = 1; l <= 25; l++) { const s = run(`mcScale(${l})`); if (l > 1 && s <= p) ok = false; p = s; } return ok; })()], [0.88, 1, 1, 0.88, true]);
console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
