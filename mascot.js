
/* =====================================================================================================
   ТЬЮТОР — ОБЪЁМНЫЙ КРУГЛЫЙ ПЕРСОНАЖ (векторная иллюстрация, viewBox 120 × 120). Ось симметрии лица — x = 60.
   Кольцо опыта рисуется отдельным слоем. Руки — отдельные звенья (машут и поднимаются).
   ===================================================================================================== */
var MC_RANKS = ['rookie', 'student', 'intern', 'resident', 'senior', 'fellow', 'attending', 'chief', 'professor'];
/** Экипировка по званию. */
function mcOutfit(rank) {
  var i = MC_RANKS.indexOf(rank); if (i < 0) i = 0;
  return { tassel: ['#94A3B8', '#C98B4A', '#CBD5E1', '#F5B31B', '#F5B31B', '#F5B31B', '#F59E0B', '#F59E0B', '#FBBF24'][i], steth: i >= 2, glasses: i >= 4, star: i >= 5, trim: i >= 6, crown: i >= 8, key: i };
}
/** Масштаб персонажа по уровню: 1-й уровень — 88 %, 25-й и выше — 100 %. */
function mcScale(level) { return 0.88 + 0.12 * Math.min(1, Math.max(0, (level - 1) / 24)); }
function mcFace(mood, ft) {
  var ink = '#0B1426';
  var eye = function (cx) { return '<ellipse cx="' + cx + '" cy="59.5" rx="4.7" ry="6" fill="' + ink + '"/><ellipse cx="' + (cx - 1.5) + '" cy="56.8" rx="1.9" ry="2.3" fill="#fff"/><circle cx="' + (cx + 1.7) + '" cy="62.2" r=".85" fill="#fff" opacity=".85"/>'; };
  var eyes = mood === 'sleepy' ? '<path d="M43.4 60 Q48 64.4 52.6 60 M67.4 60 Q72 64.4 76.6 60" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>' :
    mood === 'cheer' ? '<path d="M43.4 61 Q48 54.4 52.6 61 M67.4 61 Q72 54.4 76.6 61" fill="none" stroke="' + ink + '" stroke-width="3.2" stroke-linecap="round"/>' :
    '<g class="mc-eyes"><g class="mc-blink">' + eye(48) + '</g><g class="mc-blink">' + eye(72) + '</g></g>';
  var brows = mood === 'worried' ? '<path d="M42.6 51 L53 47.6 M77.4 51 L67 47.6" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>' : (mood === 'cheer' ? '<path d="M43 51.6 Q48 47.6 53 50.4 M77 51.6 Q72 47.6 67 50.4" fill="none" stroke="' + ink + '" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>' : '');
  var mouth = mood === 'cheer' ? '<path d="M49.4 70.6 Q60 88 70.6 70.6 Z" fill="#5A1620"/><path d="M52.4 78.8 Q60 86 67.6 78.8 Q60 75.6 52.4 78.8 Z" fill="#F0707F"/><path d="M50.6 70.8 Q60 74 69.4 70.8" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' :
    mood === 'worried' ? '<path d="M52.4 77 Q60 70.4 67.6 77" fill="none" stroke="' + ink + '" stroke-width="3.2" stroke-linecap="round"/>' :
    mood === 'sleepy' ? '<ellipse cx="60" cy="74" rx="3.2" ry="3.8" fill="' + ink + '" opacity=".9"/>' :
    mood === 'neutral' ? '<path d="M53 74 H67" fill="none" stroke="' + ink + '" stroke-width="3.2" stroke-linecap="round"/>' :
    '<path d="M51.6 71.6 Q60 80.6 68.4 71.6" fill="none" stroke="' + ink + '" stroke-width="3.3" stroke-linecap="round"/>';
  var cheeks = '<ellipse cx="38.6" cy="70" rx="5" ry="3.4" fill="#FF8FA3" opacity=".42"/><ellipse cx="81.4" cy="70" rx="5" ry="3.4" fill="#FF8FA3" opacity=".42"/>';
  var glasses = ft.glasses ? '<g fill="rgba(255,255,255,.14)" stroke="#111827" stroke-width="2.3"><circle cx="48" cy="59.5" r="10"/><circle cx="72" cy="59.5" r="10"/></g><path d="M58 58.4 Q60 56.6 62 58.4" fill="none" stroke="#111827" stroke-width="2.1" stroke-linecap="round"/><path d="M42.4 52.6 Q44.6 50.4 47.4 50 M72.6 50 Q75.4 50.4 77.6 52.6" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".6"/>' : '';
  var sweat = mood === 'worried' ? '<path d="M88 40 q4.2 6.4 0 9.8 q-4.2 -3.4 0 -9.8 Z" fill="#7DD3FC"/>' : '';
  return brows + eyes + glasses + cheeks + mouth + sweat;
}
function mcArm(u, side) {                      // тонкий рукав + белая перчатка; side: -1 левая, 1 правая; точка вращения — плечо (29,74) / (91,74)
  var s = side < 0 ? 1 : -1, sx = side < 0 ? 29 : 91, hx = side < 0 ? 20 : 100, d = 'M' + sx + ' 74 Q' + (sx + (hx - sx) * 0.42) + ' 80.5 ' + hx + ' 88';
  return '<g class="mc-arm mc-arm-' + (side < 0 ? 'l' : 'r') + '"><path d="' + d + '" fill="none" stroke="#2A5BCB" stroke-width="8.6" stroke-linecap="round"/><path d="' + d + '" fill="none" stroke="url(#mcB' + u + ')" stroke-width="6.4" stroke-linecap="round"/>' +
    '<circle cx="' + hx + '" cy="91" r="6.2" fill="#FFFFFF" stroke="#BFCDE4" stroke-width="1"/><ellipse cx="' + (hx + s * 1.7) + '" cy="88.8" rx="2.2" ry="1.6" fill="#fff"/><path d="M' + (hx + s * 1.3) + ' 86 Q' + (hx + s * 6) + ' 89.6 ' + (hx + s * 3.4) + ' 94" fill="none" stroke="#BFCDE4" stroke-width=".9" stroke-linecap="round"/></g>';
}
/** o: { mood, rank, uid }. Возвращает строку <svg>. */
function mcSvg(o) {
  var mood = o.mood || 'happy', ft = mcOutfit(o.rank), u = o.uid || '', ref = function (id) { return 'url(#' + id + u + ')'; };
  var defs = '<defs>' +
    '<radialGradient id="mcB' + u + '" cx=".34" cy=".26" r=".95"><stop offset="0" stop-color="#9CC6FF"/><stop offset=".45" stop-color="#4F8EF7"/><stop offset="1" stop-color="#1F4CC8"/></radialGradient>' +
    '<linearGradient id="mcP' + u + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#DCE6F6"/></linearGradient>' +
    '<linearGradient id="mcC' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2C3547"/><stop offset="1" stop-color="#0A0F1C"/></linearGradient>' +
    '<radialGradient id="mcS' + u + '" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#0F172A" stop-opacity=".30"/><stop offset="1" stop-color="#0F172A" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="mcM' + u + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8FAFC"/><stop offset="1" stop-color="#8E9BB0"/></linearGradient></defs>';
  var body = '<circle cx="60" cy="66" r="44" fill="' + ref('mcB') + '"/><path d="M24 78 Q26 100 60 108 Q94 100 96 78 Q94 106 60 112 Q26 106 24 78 Z" fill="#1A3FA8" opacity=".35"/>' +
    '<ellipse cx="42" cy="42" rx="17" ry="9" transform="rotate(-32 42 42)" fill="#fff" opacity=".30"/>';
  var plate = '<rect x="29" y="41" width="62" height="45" rx="22.5" fill="' + ref('mcP') + '" stroke="#9FB4D6" stroke-width="1.1"/><path d="M38 47 Q60 41 82 47" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>';
  var steth = ft.steth ? '<path d="M38 90 Q39 108 60 109 Q81 108 82 90" fill="none" stroke="#2D3A52" stroke-width="2.8" stroke-linecap="round"/><circle cx="60" cy="108" r="4.6" fill="' + ref('mcM') + '" stroke="#5B687C" stroke-width="1"/><circle cx="60" cy="108" r="2" fill="#E6ECF4"/>' : '';
  var cap = '<path d="M60 11 L98 26 L60 41 L22 26 Z" fill="' + ref('mcC') + '"/><path d="M60 11 L98 26 L60 41 Z" fill="#fff" opacity=".06"/>' +
    (ft.trim ? '<path d="M24 26.6 L60 40.2 L96 26.6" fill="none" stroke="#F5B31B" stroke-width="1.6" stroke-linejoin="round"/>' : '') +
    '<path d="M39.4 34 V44.4 Q60 53 80.6 44.4 V34 L60 41 Z" fill="#0F1626"/><circle cx="60" cy="26" r="2.7" fill="' + ft.tassel + '"/>' +
    '<path d="M60 26 L92 28.8 L92 47" fill="none" stroke="' + ft.tassel + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M92 47 l-2.8 8 M92 47 v9 M92 47 l2.8 8" fill="none" stroke="' + ft.tassel + '" stroke-width="2" stroke-linecap="round"/>' +
    (ft.star ? '<path d="M60 14.6 l1.5 3.1 3.4.4 -2.5 2.3.7 3.4 -3.1 -1.7 -3.1 1.7.7 -3.4 -2.5 -2.3 3.4 -.4z" fill="#F5B31B" transform="translate(0 4.4)"/>' : '') +
    (ft.crown ? '<g fill="#FBBF24"><path d="M95 12 l1.2 2.6 2.8.4 -2 2 .5 2.8 -2.5 -1.4 -2.5 1.4 .5 -2.8 -2 -2 2.8 -.4z"/></g>' : '');
  var extra = mood === 'cheer' ? '<g class="mc-spk"><path fill="#FBBF24" d="M11 38 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2z"/><path fill="#FBBF24" d="M110 52 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8z"/></g>' : (mood === 'sleepy' ? '<g fill="#93C5FD" font-weight="800" font-family="sans-serif"><text class="mc-zz" x="94" y="30" font-size="13">z</text><text class="mc-zz mc-zz2" x="104" y="19" font-size="9.5">z</text></g>' : '');
  return '<svg class="mcf" viewBox="4 3 112 112" aria-hidden="true" focusable="false">' + defs + '<ellipse cx="60" cy="113.4" rx="30" ry="4.4" fill="' + ref('mcS') + '"/><g class="mc-fig">' + body + plate + steth + '<g class="mc-face">' + mcFace(mood, ft) + '</g>' + mcArm(u, -1) + mcArm(u, 1) + cap + '</g>' + extra + '</svg>';
}
