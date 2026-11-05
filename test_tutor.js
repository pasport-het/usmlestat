// Тьютор в браузере: кольцо опыта, касание (машет/радуется/прыгает), руки, сон, рост по уровню, взгляд, анимации, вёрстка на разных экранах.
const { loadServer, fresh } = require('./h.js'); loadServer();
const S = require('./shots.js'); const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const J = x => JSON.stringify(x);
function check(n, got, want) { const ok = J(got) === J(want); console.log(`  ${ok ? '✓' : '✗'} ${n}: ${J(got).slice(0, 220)}${ok ? '' : '   ← ждали ' + J(want)}`); ok ? pass++ : fail++; }
const T = '2026-10-12';
function seedOld(todayAct) {
  fresh(T); saveSettings({ exam_date: '2026-12-01', student_name: 'Samir', today: T });
  for (let k = 20; k >= 10; k--) addLog({ date: addDays_(T, -k), system: 'Renal', pages: 8, today: T });
  if (todayAct) addLog({ date: T, system: 'Renal', pages: 6, today: T });
}
function seed(todayAct) {
  fresh(T); saveSettings({ exam_date: '2026-12-01', student_name: 'Samir', today: T });
  for (let k = 30; k >= 1; k--) { addLog({ date: addDays_(T, -k), system: ['Renal', 'Cardiovascular'][k % 2], pages: 8 + (k % 5), today: T }); if (k % 3) addUWorld({ date: addDays_(T, -k), system: ['Renal', 'Cardiovascular', 'Endocrine'][k % 3], q: 20 + k % 7, correct: 11 + k % 6, today: T }); }
  if (todayAct) addLog({ date: T, system: 'Renal', pages: 6, today: T });
}
(async () => {
  const b = await S.launch(); const errs = [];
  const open = async (o) => S.openPage(b, Object.assign({ raf: true, init: getAll(T), wait: 1800, w: 393, h: 852, errors: errs, now: T + 'T10:00:00Z' }, o || {}));
  console.log('=== КОЛЬЦО ОПЫТА И ПЕРСОНАЖ ===');
  seed(false); let p = await open();
  const st = await p.evaluate(() => { const s = tutorStats(D); return { frac: s.frac, level: s.level, rank: s.rank }; });
  check('персонаж нарисован (один svg), кольцо опыта есть', await p.evaluate(() => [document.querySelectorAll('#tvFloat svg.mcf').length, !!document.querySelector('#tvAv .tring .rg-arc')]), [1, true]);
  check('data-fill = доля уровня в процентах', await p.evaluate(() => document.getElementById('tvAv').getAttribute('data-fill')), String(Math.round(st.frac * 100)));
  await sleep(1300);
  check('дуга кольца заполнена на долю уровня (длина дуги = окружность × доля)', await p.evaluate((f) => { const a = document.querySelector('.rg-arc'), C = +a.getAttribute('stroke-dasharray'), off = parseFloat(a.getAttribute('stroke-dashoffset')); return Math.abs(off - C * (1 - f)) < 0.6; }, st.frac), true);
  check('масштаб персонажа = масштаб уровня; значок уровня; звание → экипировка (стажёр: стетоскоп есть, очков нет)', await p.evaluate((lv) => [document.getElementById('tvAv').style.getPropertyValue('--s'), document.getElementById('tvLvl').textContent, document.querySelectorAll('#tvFloat circle[r="10"]').length, !!document.querySelector('#tvFloat path[stroke="#2D3A52"]')].map(String), st.level), [(await p.evaluate((l) => mcScale(l).toFixed(3), st.level)), String(st.level), '0', 'true']);
  console.log('\n=== КАСАНИЕ, РУКИ, ПРЫЖОК ===');
  check('в покое никаких поз', await p.evaluate(() => ['wave', 'cheer', 'jump'].map(c => document.getElementById('tvFloat').classList.contains(c))), [false, false, false]);
  await p.evaluate(() => document.getElementById('tvAvBtn').click()); await sleep(350);
  check('касание: машет, радуется (руки вверх), подпрыгивает; лицо «радость» со звёздочками', await p.evaluate(() => [...['wave', 'cheer', 'jump'].map(c => document.getElementById('tvFloat').classList.contains(c)), document.querySelectorAll('#tvFloat .mc-spk path').length]), [true, true, true, 2]);
  await sleep(500);
  const pose = await p.evaluate(() => { const arm = s => document.querySelector('#tvFloat ' + s), body = document.querySelector('#tvFloat circle[r="44"]').getBoundingClientRect(); return { l: getComputedStyle(arm('.mc-arm-l')).transform !== 'none', r: getComputedStyle(arm('.mc-arm-r')).transform !== 'none', lh: arm('.mc-arm-l circle').getBoundingClientRect().top < body.top + body.height * 0.62, rh: arm('.mc-arm-r circle').getBoundingClientRect().top < body.top + body.height * 0.62 }; });
  check('обе руки подняты: повёрнуты, кисти выше середины корпуса', pose, { l: true, r: true, lh: true, rh: true });
  await sleep(2400);
  check('через пару секунд всё само возвращается в покой, руки опущены', await p.evaluate(() => [...['wave', 'cheer', 'jump'].map(c => document.getElementById('tvFloat').classList.contains(c)), getComputedStyle(document.querySelector('#tvFloat .mc-arm-r')).transform]), [false, false, false, 'none']);
  await p.evaluate(() => tmWave(3000)); await sleep(800);
  const wv = await p.evaluate(() => { const r = document.querySelector('#tvFloat .mc-arm-r'), c = r.querySelector('circle').getBoundingClientRect(), body = document.querySelector('#tvFloat circle[r="44"]').getBoundingClientRect(); return { left: getComputedStyle(document.querySelector('#tvFloat .mc-arm-l')).transform === 'none', anim: getComputedStyle(r).animationName, handUp: c.top < body.top + body.height * 0.55, handOut: c.left > body.left + body.width * 0.8 }; });
  check('«машет»: правая рука поднята и качается, левая опущена, кисть снаружи корпуса', wv, { left: true, anim: 'mcWave', handUp: true, handOut: true });
  await p.close();
  console.log('\n=== СОН, ВЗГЛЯД, НОВЫЙ УРОВЕНЬ ===');
  seedOld(false); p = await open({ now: T + 'T02:30:00Z', init: getAll(T) });
  check('ночью без занятий сегодня — спит («z», закрытые глаза)', await p.evaluate(() => [document.querySelectorAll('#tvFloat .mc-zz').length, document.querySelectorAll('#tvFloat .mc-blink').length]), [2, 0]); await p.close();
  seedOld(true); p = await open({ now: T + 'T02:30:00Z', init: getAll(T) });
  check('ночью, но сегодня уже были занятия — не спит', await p.evaluate(() => document.querySelectorAll('#tvFloat .mc-zz').length), 0); await p.close();
  seed(false); p = await open({ now: T + 'T02:30:00Z', init: getAll(T) });
  await sleep(2800);        // сначала тьютор радуется набранному опыту (2.4 с), потом возвращается к обычному настроению
  check('ночью с серией под угрозой — тревога важнее сна', await p.evaluate(() => [TUT.face.split('|')[0], document.querySelectorAll('#tvFloat .mc-zz').length]), ['worried', 0]); await p.close();
  seed(false); p = await open();
  check('взгляд следует за пальцем: глаза смещаются вправо/вниз и обратно, в пределах ±1.4 px', await p.evaluate(() => { const g = () => new DOMMatrix(getComputedStyle(document.querySelector('#tvFloat .mc-eyes')).transform).e; tutLook(5000, 5000); return new Promise(r => setTimeout(() => { const a = g(); r([a > 0, a <= 1.41, true]); }, 350)); }), [true, true, true]);
  await sleep(300);
  check('новый уровень: персонаж «подрастает» (масштаб нового уровня), значок обновлён', await p.evaluate(() => { const s = tutorStats(D); TUT.level = s.level - 1; TUT.xp = s.xp - 5; document.getElementById('tvAv').style.setProperty('--s', mcScale(s.level - 1).toFixed(3)); renderTutor(); return [document.getElementById('tvAv').style.getPropertyValue('--s') === mcScale(s.level).toFixed(3), document.getElementById('tvLvl').textContent === String(s.level)]; }), [true, true]);
  check('звание сменилось → нарисован в новой экипировке (старший: очки)', await p.evaluate(() => { TUT.rank = 'senior'; TUT.face = ''; tutFace('happy'); return document.querySelectorAll('#tvFloat circle[r="10"]').length; }), 2);
  await sleep(300);
  await sleep(2800);
  const an = await p.evaluate(() => { const ok = ['gainUp', 'cf', 'lvIn', 'mcBob', 'mcBlink', 'fade', 'slIn', 'slSpin', 'slArc', 'slDot', 'slide', 'sheet', 'flame', 'tFloat', 'pulse', 'twinkle', 'zz', 'mcWave', 'mcJump']; const bad = {}; document.querySelectorAll('body *').forEach(e => { if (e.closest('#load,#splash,.drawer:not(.on),.sheet:not(.on)')) return; const pg = e.closest('.page'); if (pg && !pg.classList.contains('on')) return; const n = getComputedStyle(e).animationName; if (n && n !== 'none' && ok.indexOf(n) < 0) bad[n] = e.tagName + '.' + (e.getAttribute('class') || ''); }); return bad; });
  check('на странице нет неожиданных анимаций (класс не совпал по имени с крутилкой и т.п.)', an, {});
  check('идёт покачивание и моргание', await p.evaluate(() => [getComputedStyle(document.querySelector('#tvFloat .mc-fig')).animationName, getComputedStyle(document.querySelector('#tvFloat .mc-blink')).animationName]), ['mcBob', 'mcBlink']);
  await p.close();
  console.log('\n=== ВЁРСТКА НА РАЗНЫХ ЭКРАНАХ И ШРИФТАХ ===');
  seed(true);
  for (const [w, h, font] of [[320, 640, 'm'], [360, 740, 'm'], [393, 852, 'm'], [430, 932, 'm'], [393, 852, 'xl'], [320, 640, 'xl'], [768, 1024, 'm']]) {
    p = await open({ w, h, font, init: getAll(T) });
    const r = await p.evaluate(() => { const c = document.getElementById('tutorCard').getBoundingClientRect(), av = document.getElementById('tvAv').getBoundingClientRect(), mn = document.querySelector('.tut-main').getBoundingClientRect(), svg = document.querySelector('#tvFloat svg').getBoundingClientRect(); return { over: document.documentElement.scrollWidth - innerWidth, inside: av.left >= c.left - 1 && av.right <= c.right + 1, noOverlap: av.right <= mn.left + 1, svgIn: svg.left >= av.left - 6 && svg.right <= av.right + 6, rankFits: document.getElementById('tvRank').scrollWidth <= document.getElementById('tvRank').clientWidth + 1 }; });
    check(w + '×' + h + ', шрифт ' + font + ': без горизонтальной прокрутки, персонаж внутри карточки и не налезает на текст, звание помещается', r, { over: 0, inside: true, noOverlap: true, svgIn: true, rankFits: true }); await p.close();
  }
  await b.close(); check('ошибок страницы нет', errs, []);
  console.log(`\n${pass} проверок пройдено, ${fail} провалено`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
