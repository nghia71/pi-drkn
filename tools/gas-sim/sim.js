// Mô phỏng Apps Script tối thiểu để chạy apps/main/*.gs trên máy (không cần Google).
// Dùng: node tools/gas-sim/run-tests.js   — chạy bộ kiểm thử phía máy chủ (Tests.gs) với dữ liệu bịa.
// Mô phỏng các điểm hay gây lỗi của Google Sheets: "=…" thành công thức, "TRUE"/"FALSE" thành boolean,
// chuỗi số thành số, dấu ' ở đầu giữ nguyên văn.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto');

// Tệp zip tối thiểu (lưu, không nén) để kiểm thử Utilities.zip; đọc lại bằng unzipList()
function crc32(buf) { let c, crc = 0xFFFFFFFF; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xFF; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xFFFFFFFF) >>> 0; }
function zipStore(entries) {
  const parts = [], central = []; let off = 0;
  entries.forEach(e => {
    const name = Buffer.from(e.name, 'utf8'), data = e.data, crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, data);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, name); off += 30 + name.length + data.length;
  });
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cd, end]));
}

function sheetValue(v) {
  if (typeof v !== 'string') return { v: v, f: '' };
  if (v.startsWith("'")) return { v: v.slice(1), f: '' };
  if (v.startsWith('=')) return { v: '#ERROR!', f: v };
  // Sheets tự đổi chuỗi trông như ngày tháng thành kiểu Date
  if (/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?)?$/.test(v.trim())) return { v: new Date(v.trim()), f: '' };
  // "10/2026", "7/10/2026" cũng bị đổi thành ngày
  const mdy = v.trim().match(/^(\d{1,2})\/(?:(\d{1,2})\/)?(\d{4})$/);
  if (mdy) return { v: new Date(Date.UTC(+mdy[3], +mdy[1] - 1, mdy[2] ? +mdy[2] : 1)), f: '' };
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
  setName(n) { this.name = n; return this; }
  copyTo(ss) { const n = new Sheet('Copy of ' + this.name); n.cells = JSON.parse(JSON.stringify(this.cells)); ss.sheets.push(n); return n; }
}
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const x = (this.sh.cells[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(x ? x.v : ''); } out.push(row); }
    return out;
  }
  setValue(v) { return this.setValues([[v]]); }
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
      openById: id => { if (!spreadsheets[id]) throw new Error('Không mở được Sheet ' + id); return spreadsheets[id]; },
      flush: () => {}
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
      Charset: { UTF_8: 'utf8' },
      base64Encode: a => (Buffer.isBuffer(a) ? a : typeof a === 'string' ? Buffer.from(a, 'utf8') : fromBytes(a)).toString('base64'),
      base64Decode: s => toBytes(Buffer.from(String(s), 'base64')),
      base64EncodeWebSafe: a => fromBytes(a).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      sleep: () => {},
      newBlob: (data, type, name) => blob(typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.isBuffer(data) ? data : fromBytes(data), type, name),
      unzip: z => { const b = z.getBytes(), out = []; let i = 0;
        while (b.readUInt32LE(i) === 0x04034b50) { const n = b.readUInt16LE(i + 26), sz = b.readUInt32LE(i + 18), x = b.readUInt16LE(i + 28);
          const method = b.readUInt16LE(i + 8), name = b.slice(i + 30, i + 30 + n).toString('utf8'), raw = b.slice(i + 30 + n + x, i + 30 + n + x + sz);
          const data = method === 8 ? require('zlib').inflateRawSync(raw) : raw;   // zip của Python (nén) hoặc của Utilities.zip (không nén)
          out.push(blob(data, 'application/octet-stream', name)); i += 30 + n + x + sz; }
        return out; },
      zip: (blobs, name) => blob(zipStore(blobs.map(b => ({ name: b.getName(), data: b.getBytes() }))), 'application/zip', name || 'archive.zip'),
      // chỉ hỗ trợ mẫu 'yyyy-MM-dd' (đủ cho mã hiện tại)
      formatDate: (d, tz, fmt) => {
        if (fmt === 'H') return String(Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d)) % 24);
        if (fmt !== 'yyyy-MM-dd') throw new Error('formatDate mô phỏng chỉ hỗ trợ yyyy-MM-dd và H');
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
      }
    },
    // Bộ kiểm thử không bao giờ được gửi thư thật: mọi thư phải đi qua sendMail_ (hộp thư thử khi TEST_CONF).
    MailApp: { sendEmail: () => { throw new Error('MailApp.sendEmail bị gọi trong kiểm thử'); }, getRemainingDailyQuota: () => 100 },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {},
                 newTrigger: () => { throw new Error('ScriptApp.newTrigger bị gọi trong kiểm thử'); } },
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
    Sheets: opts.sheetsApi ? { Spreadsheets: { Values: { batchGet: (id, req) => {
      const ss = spreadsheets[id]; if (!ss) throw new Error('Không có Sheet');
      const fmt = v => v instanceof Date ? (v.getMonth() + 1) + '/' + v.getDate() + '/' + v.getFullYear() + ' ' + v.toTimeString().slice(0, 8)
                     : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
      return { valueRanges: req.ranges.map(r => {
        const m = r.match(/^'(.+)'!A2:([A-Z]+)$/); const sh = ss.getSheetByName(m[1]);
        const ncol = m[2].split('').reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0), n = sh.getLastRow();
        if (n < 2) return { range: r };
        const vals = sh.getRange(2, 1, n - 1, ncol).getValues().map(row => { const o = row.map(fmt); while (o.length && o[o.length - 1] === '') o.pop(); return o; });
        return { range: r, values: vals };
      }) };
    } } } } : undefined,
    DriveApp: {
      createFolder: name => folderObj(newFolder(name, null)),
      getFolderById: id => { if (!folders[id]) throw new Error('Không có thư mục ' + id); return folderObj(id); },
      createFile: (name, content) => addFile(name, content, null),
      getFileById: id => {
        if (spreadsheets[id]) return { getId: () => id, getName: () => spreadsheets[id].name,     // Sheet như một tệp Drive: chỉ makeCopy (sao lưu)
          makeCopy: (name, folder) => { const src = spreadsheets[id], c = new Spreadsheet(name);
            c.sheets = src.sheets.map(sh => { const n = new Sheet(sh.name); n.cells = JSON.parse(JSON.stringify(sh.cells)); return n; });
            spreadsheets[c.id] = c; files[c.id] = { name, content: '', parent: folder ? folder.getId() : null, trashed: false, t: Date.now() }; return fileObj(c.id); } };
        if (!files[id]) throw new Error('Không có tệp'); return fileObj(id); },
      searchFiles: q => { const m = String(q || '').match(/title contains '([^']*)'/);
        const ids = Object.keys(files).filter(i => !files[i].trashed && (!m || files[i].name.indexOf(m[1]) >= 0)); let k = 0; return { hasNext: () => k < ids.length, next: () => fileObj(ids[k++]) }; }
    }
  };
  // Drive mô phỏng: tệp (nội dung chữ hoặc byte), thư mục, blob, zip
  const folders = {};
  function newFolder(name, parent) { const id = 'folder-' + crypto.randomUUID(); folders[id] = { name, parent, trashed: false }; return id; }
  function addFile(name, content, parent) {
    if (content && content._blob) { name = name || content.getName(); content = content._bytes; }
    const id = 'f-' + crypto.randomUUID(); files[id] = { name, content, parent, trashed: false, t: Date.now() }; return fileObj(id);
  }
  function blob(bytes, type, name) {
    const b = { _blob: true, _bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes), 'utf8'), _type: type || 'text/plain', _name: name || '' };
    b.getBytes = () => b._bytes; b.getDataAsString = () => b._bytes.toString('utf8'); b.getName = () => b._name;
    b.setName = n => { b._name = n; return b; }; b.getContentType = () => b._type; return b;
  }
  function folderObj(id) {
    const f = folders[id];
    return { getId: () => id, getName: () => f.name, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
             createFile: (a, c) => (a && a._blob ? addFile(a.getName(), a, id) : addFile(a, c, id)),
             createFolder: n => folderObj(newFolder(n, id)), setTrashed: v => { f.trashed = v; },
             getFiles: () => { const ids = Object.keys(files).filter(i => files[i].parent === id && !files[i].trashed); let k = 0;
                               return { hasNext: () => k < ids.length, next: () => fileObj(ids[k++]) }; },
             getFilesByName: n => { const ids = Object.keys(files).filter(i => files[i].parent === id && files[i].name === n && !files[i].trashed); let k = 0;
                                    return { hasNext: () => k < ids.length, next: () => fileObj(ids[k++]) }; } };
  }
  function fileObj(id) {
    const f = files[id];
    const bytes = () => (Buffer.isBuffer(f.content) ? f.content : Buffer.from(String(f.content), 'utf8'));
    return { getId: () => id, getName: () => f.name, getLastUpdated: () => new Date(f.t), setTrashed: v => { f.trashed = v; },
             getUrl: () => 'https://drive.google.com/file/d/' + id, getParentId_: () => f.parent,
             getBlob: () => blob(bytes(), 'application/octet-stream', f.name) };
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
