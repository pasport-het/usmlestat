const ROOT = require('path').resolve(__dirname, '..');
// Тестовая среда Google Apps Script: таблицы ведут себя как настоящие (даты и числа из строк автоматически превращаются в Date/Number,
// если формат ячейки не «текст»), а также сервисы Utilities, Session, ScriptApp, ContentService, HtmlService, LockService, CacheService, UrlFetchApp.
const fs = require('fs');
const P2 = n => String(n).padStart(2, '0');
global.Utilities = {
  formatDate: (d, tz, pat) => {
    if ((tz && tz !== 'UTC') || /Z|HH|mm/.test(pat)) {
      const z = tz || 'UTC'; let parts;
      try { parts = new Intl.DateTimeFormat('en-CA', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(d); } catch (e) { throw new Error('Unknown time zone: ' + tz); }
      const g = {}; parts.forEach(x => { g[x.type] = x.value; });
      const off = Math.round((Date.UTC(+g.year, +g.month - 1, +g.day, +g.hour, +g.minute, +g.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000), sg = off < 0 ? '-' : '+', ao = Math.abs(off);
      return pat.replace('yyyy', g.year).replace('MM', g.month).replace('dd', g.day).replace('HH', g.hour).replace('mm', g.minute).replace('Z', sg + P2(Math.floor(ao / 60)) + P2(ao % 60));
    }
    return pat.replace('yyyy', d.getFullYear()).replace('MM', P2(d.getMonth() + 1)).replace('dd', P2(d.getDate()));
  },
  getUuid: () => require('crypto').randomUUID(),
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  computeDigest: (alg, bytes) => { const b = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes.map(x => x & 255)); return Array.from(require('crypto').createHash('sha256').update(b).digest(), x => x > 127 ? x - 256 : x); },
  computeHmacSha256Signature: (v, k) => Array.from(require('crypto').createHmac('sha256', Buffer.from(k.map(x => x & 255))).update(Buffer.from(v.map(x => x & 255))).digest(), x => x > 127 ? x - 256 : x),
  base64EncodeWebSafe: bytes => { const b = Buffer.from(bytes.map(x => x & 255)).toString('base64url'); return b + '='.repeat((4 - b.length % 4) % 4); },
  base64DecodeWebSafe: s => Array.from(Buffer.from(s, 'base64url'), x => x > 127 ? x - 256 : x),
  base64Encode: bytes => Buffer.from(bytes.map(x => x & 255)).toString('base64'),
  sleep: () => { }
};
global.Session = { getScriptTimeZone: () => 'UTC', getEffectiveUser: () => ({ getEmail: () => 'owner@gmail.com' }), getActiveUser: () => ({ getEmail: () => global.__ACTIVE_USER === undefined ? '' : global.__ACTIVE_USER }) };
global.__TRIGGERS = [];
global.ScriptApp = { WeekDay: { MONDAY: 'MONDAY', TUESDAY: 'TUESDAY', WEDNESDAY: 'WEDNESDAY', THURSDAY: 'THURSDAY', FRIDAY: 'FRIDAY', SATURDAY: 'SATURDAY', SUNDAY: 'SUNDAY' },
  getService: () => ({ getUrl: () => global.__EXEC_URL || 'https://script.google.com/macros/s/AKfycbTESTDEPLOYMENTID_1234567890abcdefghij/exec' }), getProjectTriggers: () => global.__TRIGGERS.slice(),
  deleteTrigger: t => { global.__TRIGGERS = global.__TRIGGERS.filter(x => x !== t); },
  newTrigger: fn => ({ timeBased: () => ({ everyMinutes: n => ({ create: () => { const t = { getHandlerFunction: () => fn, minutes: n }; global.__TRIGGERS.push(t); return t; } }),
    onWeekDay: d => ({ atHour: h => ({ create: () => { const t = { getHandlerFunction: () => fn, day: d, hour: h }; global.__TRIGGERS.push(t); return t; } }) }) }) }) };
global.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: t => ({ setMimeType: () => t }) };
global.HtmlService = {
  XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
  createHtmlOutput: h => ({ _html: h, addMetaTag() { return this; }, setTitle(t) { this._title = t; return this; }, setXFrameOptionsMode() { return this; } }),
  createTemplateFromFile: name => { const t = { _name: name, evaluate() { let h = fs.readFileSync(global.__INDEX_PATH || (ROOT + '/src/Index.html'), 'utf8'); h = h.replace(/<\?!= (\w+) \?>/g, (m, v) => (t[v] !== undefined ? t[v] : 'null')); return { _html: h, _title: '', setTitle(x) { this._title = x; return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } }; } }; return t; }
};
global.LockService = { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) };
{ const store = {}; global.__CACHE = store; global.CacheService = { getScriptCache: () => ({ get: k => (k in store ? store[k] : null), put: (k, v) => { if (String(v).length > 100000) throw new Error('Argument too large: value'); store[k] = String(v); }, remove: k => { delete store[k]; } }) }; }
global.UrlFetchApp = { fetch: (url, opt) => (global.__fetch ? global.__fetch(url, opt) : { getResponseCode: () => 200, getContentText: () => '{}' }) };
global.Logger = { log() { } };

// ---- Таблицы ----
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, NUM_RE = /^-?\d+(\.\d+)?$/;
class Range {
  constructor(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr; this.nc = nc; return new Proxy(this, { get: (t, p) => (p in t ? t[p] : (typeof p === 'string' && /^(set|merge|auto|protect|apply|add)/.test(p) ? function () { return this; } : undefined)) }); }
  getValues() { const out = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.rows[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; }
  getDisplayValues() { return this.getValues().map(r => r.map(v => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v)))); }
  getValue() { return this.getValues()[0][0]; }
  setValues(vals) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, vals[i][j]); return this; }
  setValue(v) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh._set(this.r + i, this.c + j, v); return this; }
  setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sh.fmt[(this.r + i) + ',' + (this.c + j)] = f; for (let j = 0; j < this.nc; j++) if (this.nr > 50) this.sh.colFmt[this.c + j] = f; return this; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setHorizontalAlignment() { return this; } setWrap() { return this; }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) if (this.sh.rows[this.r - 1 + i]) this.sh.rows[this.r - 1 + i][this.c - 1 + j] = ''; return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.fmt = {}; this.colFmt = {}; return new Proxy(this, { get: (t, p) => (p in t ? t[p] : (typeof p === 'string' && /^(set|auto|hide|protect|add|activate)/.test(p) ? function () { return this; } : undefined)) }); }
  _conv(r, c, v) { if (typeof v !== 'string') return v; const f = this.fmt[r + ',' + c] || this.colFmt[c]; if (f === '@') return v; if (DATE_RE.test(v)) { const p = v.split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); } if (NUM_RE.test(v)) return Number(v); return v; }
  _set(r, c, v) { while (this.rows.length < r) this.rows.push([]); const row = this.rows[r - 1]; while (row.length < c - 1) row.push(''); row[c - 1] = this._conv(r, c, v); }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.rows.length), Math.max(1, ...this.rows.map(x => x.length), 1)); }
  getLastRow() { return this.rows.length; } getLastColumn() { return Math.max(0, ...this.rows.map(x => x.length)); }
  appendRow(a) { const r = this.rows.length + 1; this.rows.push([]); a.forEach((v, j) => this._set(r, j + 1, v)); }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  deleteRows(r, n) { this.rows.splice(r - 1, n); }
  setFrozenRows() { } setColumnWidth() { } setTabColor() { return this; }
  sort(col, asc) { const head = this.rows[0], body = this.rows.slice(1); body.sort((a, b) => { const x = a[col - 1], y = b[col - 1]; return (x < y ? -1 : x > y ? 1 : 0) * (asc === false ? -1 : 1); }); this.rows = [head].concat(body); }
}
let SHEETS = {};
global.resetSheets = () => { SHEETS = {}; };
const SS = { getSheetByName: n => SHEETS[n] || null, insertSheet: n => (SHEETS[n] = new Sheet(n)), getSheets: () => Object.values(SHEETS), getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addSeparator() { return this; }, addToUi() { } }), alert() { } }), getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST', getId: () => 'SSID' };
global.SpreadsheetApp = { getActive: () => SS, getActiveSpreadsheet: () => SS, getUi: () => SS.getUi() };
global.__SHEETS = () => SHEETS;

// ---- Диск ----
{ let seq = 0; const folders = []; global.__DRIVE = { folders, fail: false };
  const mkFile = (name, folder) => { const f = { name, trashed: false, created: new Date(Date.UTC(2026, 0, 1) + (++seq) * 3600000), id: 'F' + seq }; folder.files.push(f); return { getName: () => f.name, getDateCreated: () => f.created, setTrashed: v => { f.trashed = !!v; }, getUrl: () => 'https://drive.google.com/file/' + f.id, _f: f }; };
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  const mkFolder = name => { const fo = { name, files: [] }; folders.push(fo); return { getName: () => name, getUrl: () => 'https://drive.google.com/folder/' + name, getFiles: () => iter(fo.files.filter(x => !x.trashed).map(x => ({ getName: () => x.name, getDateCreated: () => x.created, setTrashed: v => { x.trashed = !!v; }, getUrl: () => 'https://drive.google.com/file/' + x.id }))), _fo: fo }; };
  global.DriveApp = { getFoldersByName: n => iter(folders.filter(f => f.name === n).map(f => ({ getName: () => f.name, getUrl: () => 'https://drive.google.com/folder/' + f.name, getFiles: () => iter(f.files.filter(x => !x.trashed).map(x => ({ getName: () => x.name, getDateCreated: () => x.created, setTrashed: v => { x.trashed = !!v; }, getUrl: () => 'https://drive.google.com/file/' + x.id }))), _fo: f }))), createFolder: n => mkFolder(n),
    getFileById: id => ({ makeCopy: (name, folder) => { if (global.__DRIVE.fail) throw new Error('Drive quota'); return mkFile(name, folder._fo); } }) }; }
