const ROOT = require('path').resolve(__dirname, '..');
// Общий загрузчик серверного кода для тестов: подмена Apps Script + Code.gs в глобальной области
require('./mock4.js'); const fs = require('fs');
global.AUTH_OFF_ = true;
function loadServer(path) { global.SERVER_TODAY_FORCE_ = global.SERVER_TODAY_FORCE_ || '2026-10-12'; (0, eval)(fs.readFileSync(path || (ROOT + '/src/Code.gs'), 'utf8').replace(/^const /gm, 'var ').replace(/^let /gm, 'var ')); }
function fresh(today) { resetSheets(); global.ENSURED_ = false; global.TODAY_OVERRIDE_ = null; global.SERVER_TODAY_FORCE_ = today || '2026-10-12'; ensureAll_(); }
module.exports = { loadServer, fresh };
