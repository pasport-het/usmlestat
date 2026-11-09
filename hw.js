const ROOT = require('path').resolve(__dirname, '..');
require('./mock4.js'); const fs = require('fs'); global.AUTH_OFF_ = true; global.__INDEX_PATH = (ROOT + '/Index.html');
function loadServer() { global.SERVER_TODAY_FORCE_ = global.SERVER_TODAY_FORCE_ || '2026-10-12'; (0, eval)(fs.readFileSync((ROOT + '/Code.gs'), 'utf8').replace(/^const /gm, 'var ').replace(/^let /gm, 'var ')); }
function fresh(today) { resetSheets(); global.ENSURED_ = false; global.TODAY_OVERRIDE_ = null; global.SERVER_TODAY_FORCE_ = today || '2026-10-12'; for (const k of Object.keys(global.__CACHE || {})) delete global.__CACHE[k]; ensureAll_(); }
module.exports = { loadServer, fresh };
