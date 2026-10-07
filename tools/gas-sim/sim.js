// Mô phỏng Apps Script tối thiểu để chạy apps/main/*.gs trên máy (không cần Google).
// Dùng: node tools/gas-sim/run-tests.js   — chạy bộ kiểm thử phía máy chủ (Tests.gs) với dữ liệu bịa.
// Mô phỏng các điểm hay gây lỗi của Google Sheets: "=…" thành công thức, "TRUE"/"FALSE" thành boolean,
// chuỗi số thành số, dấu ' ở đầu giữ nguyên văn.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

function sheetValue(v) {
  if (typeof v !== 'string') return { v: v, f: '' };
  if (v.startsWith("'")) return { v: v.slice(1), f: '' };
  if (v.startsWith('=')) return { v: '#ERROR!', f: v };
  if (/^(TRUE|FALSE)$/i.test(v.trim())) return { v: v.trim().toUpperCase() === 'TRUE', f: '' };
  if (/^[+-]?\d+(\.\d+)?$/.test(v.trim()) && v.trim().length < 16) return { v: Number(v), f: '' };
  return { v: v, f: '' };
}

class Sheet {
  constructor(name) { this.name = name; this.cells = []; }   // cells[r][c] = {v,f}
  getName() { return this.name; }
  getLastRow() { for (let r = this.cells.length - 1; r >= 0; r--) if ((this.cells[r] || []).some(x => x && x.v !== '')) return r + 1; return 0; }
  getLastColumn() { let m = 0; this.cells.forEach(row => (row || []).forEach((x, c) => { if (x && x.v !== '') m = Math.max(m, c + 1); })); return m; }
  getRange(r, c, nr, nc) { return new Range(this, r, c, nr || 1, nc || 1); }
  deleteRow(r) { this.cells.splice(r - 1, 1); return this; }
  appendRow(vals) { const r = this.getLastRow() + 1; this.getRange(r, 1, 1, vals.length).setValues([vals]); return this; }
  clear() { this.cells = []; return this; }
  setFrozenRows() { return this; }
}
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const x = (this.sh.cells[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(x ? x.v : ''); } out.push(row); }
    return out;
  }
  setValues(vals) {
    if (vals.length !== this.nr || vals.some(r => r.length !== this.nc)) throw new Error('Kích thước dữ liệu không khớp vùng ô');
    vals.forEach((row, i) => row.forEach((v, j) => {
      const R = this.r - 1 + i; this.sh.cells[R] = this.sh.cells[R] || [];
      this.sh.cells[R][this.c - 1 + j] = sheetValue(v);
    }));
    return this;
  }
  clearContent() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) { const R = this.r - 1 + i; if (this.sh.cells[R]) this.sh.cells[R][this.c - 1 + j] = { v: '', f: '' }; } return this; }
  getFormula() { const x = (this.sh.cells[this.r - 1] || [])[this.c - 1]; return x ? x.f : ''; }
  setFontWeight() { return this; }
}
class Spreadsheet {
  constructor(name) { this.id = 'ss-' + crypto.randomUUID(); this.name = name; this.sheets = [new Sheet('Sheet1')]; }
  getId() { return this.id; }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}

function makeEnv(opts) {
  const spreadsheets = {}, props = {}, cache = {}, files = {};
  const root = opts.root, owner = opts.owner;
  const toBytes = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));
  const fromBytes = a => Buffer.from(Array.isArray(a) ? a.map(b => b & 255) : String(a), Array.isArray(a) ? undefined : 'utf8');
  const html = content => {
    const o = { _c: content, getContent: () => o._c, setTitle: () => o, addMetaTag: () => o, setXFrameOptionsMode: () => o };
    return o;
  };
  const readHtml = name => fs.readFileSync(path.join(root, name + '.html'), 'utf8');
  const env = {
    console,
    Logger: { log: m => { if (opts.verbose) console.log('[log]', m); } },
    SpreadsheetApp: {
      create: n => { const s = new Spreadsheet(n); spreadsheets[s.id] = s; return s; },
      openById: id => { if (!spreadsheets[id]) throw new Error('Không mở được Sheet ' + id); return spreadsheets[id]; }
    },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null),
      setProperty: (k, v) => { props[k] = String(v); },
      setProperties: o => { Object.keys(o).forEach(k => { props[k] = String(o[k]); }); },
      deleteProperty: k => { delete props[k]; },
      getProperties: () => Object.assign({}, props)
    }) },
    CacheService: { getScriptCache: () => ({ get: k => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = String(v); }, remove: k => { delete cache[k]; } }) },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, tryLock: () => true, releaseLock: () => {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => owner }), getActiveUser: () => ({ getEmail: () => owner }) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeHmacSha256Signature: (msg, key) => toBytes(crypto.createHmac('sha256', key).update(msg, 'utf8').digest()),
      computeDigest: (alg, s) => toBytes(crypto.createHash('sha256').update(s, 'utf8').digest()),
      DigestAlgorithm: { SHA_256: 'sha256' },
      base64EncodeWebSafe: a => fromBytes(a).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      sleep: () => {}
    },
    HtmlService: {
      createHtmlOutput: c => html(c),
      createHtmlOutputFromFile: n => html(readHtml(n)),
      createTemplateFromFile: n => {
        const t = { evaluate: () => {
          const src = readHtml(n);
          const out = src.replace(/<\?(!?=)([\s\S]*?)\?>/g, (_, kind, expr) => {
            const val = vm.runInContext('(function(){ with (__tpl) { return (' + expr + '); } })()', ctx.__withTpl(t));
            return kind === '!=' ? String(val) : JSON.stringify(val);
          });
          return html(out);
        } };
        return t;
      }
    },
    DriveApp: {
      createFolder: name => ({ getId: () => 'folder-' + crypto.randomUUID(), getName: () => name }),
      createFile: (name, content) => { const id = 'f-' + crypto.randomUUID(); files[id] = { name, content, trashed: false, t: Date.now() }; return fileObj(id); },
      getFileById: id => { if (!files[id]) throw new Error('Không có tệp'); return fileObj(id); },
      searchFiles: () => { const ids = Object.keys(files).filter(i => !files[i].trashed); let k = 0; return { hasNext: () => k < ids.length, next: () => fileObj(ids[k++]) }; }
    }
  };
  function fileObj(id) {
    const f = files[id];
    return { getId: () => id, getName: () => f.name, getLastUpdated: () => new Date(f.t), setTrashed: v => { f.trashed = v; },
             getBlob: () => ({ getDataAsString: () => f.content }) };
  }
  const ctx = vm.createContext(env);
  ctx.__withTpl = t => { ctx.__tpl = t; return ctx; };
  return { ctx, props, spreadsheets, files };
}

function loadApp(appDir, opts) {
  const e = makeEnv(Object.assign({ root: appDir }, opts));
  fs.readdirSync(appDir).filter(f => f.endsWith('.gs')).sort().forEach(f => {
    vm.runInContext(fs.readFileSync(path.join(appDir, f), 'utf8'), e.ctx, { filename: f });
  });
  return e;
}

module.exports = { loadApp };
