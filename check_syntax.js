// Разбор файлов парсером ES2019 (приближение к редактору Apps Script: без BigInt-литералов, ?. и ??)
const acorn = require('acorn'), fs = require('fs'), path = require('path'); const ROOT = path.resolve(__dirname, '..'); let bad = 0;
function parse(name, src, v) { try { acorn.parse(src, { ecmaVersion: v, sourceType: 'script', allowAwaitOutsideFunction: v > 2019 }); console.log('  ✓ ' + name + ' (ES' + v + ')'); } catch (e) { bad++; console.log('  ✗ ' + name + ': ' + e.message + ' | строка ' + e.loc.line); } }
function lastScript(html) { const m = html.match(/<script>([\s\S]*?)<\/script>/g); return m[m.length - 1].replace(/^<script>|<\/script>$/g, '').replace('<?!= viewKeyJs ?>', '"K"').replace('<?!= envJs ?>', '{}').replace('<?!= initJs ?>', 'null'); }
for (const base of [ROOT, path.join(ROOT, 'words')]) {
  const tag = base === ROOT ? 'USMLE' : 'Слова', src = base === ROOT ? 'src' : '.', gh = 'github';
  parse(tag + ': Code.gs', fs.readFileSync(path.join(base, src, 'Code.gs'), 'utf8'), 2019);
  parse(tag + ': Index.html (скрипт)', lastScript(fs.readFileSync(path.join(base, src, 'Index.html'), 'utf8')), 2019);
  parse(tag + ': обёртка GitHub', lastScript(fs.readFileSync(path.join(base, gh, 'index.html'), 'utf8')), 2019);
  parse(tag + ': sw.js', fs.readFileSync(path.join(base, gh, 'sw.js'), 'utf8'), 2019);
  parse(tag + ': виджет Scriptable', fs.readFileSync(path.join(base, src, base === ROOT ? 'widget_usmle.js' : 'widget.js'), 'utf8'), 2022);
}
const wrap = fs.readFileSync(path.join(ROOT, 'github', 'index.html'), 'utf8'), ver = JSON.parse(fs.readFileSync(path.join(ROOT, 'github', 'version.json'), 'utf8')).v;
const wv = (wrap.match(/var WRAP_V = '([^']+)'/) || [])[1]; if (wv !== ver) { bad++; console.log('  ✗ WRAP_V (' + wv + ') ≠ version.json (' + ver + ')'); } else console.log('  ✓ WRAP_V совпадает с version.json (' + ver + ')');
console.log(bad ? '\n' + bad + ' ошибок' : '\nвсе файлы разбираются'); process.exit(bad ? 1 : 0);
