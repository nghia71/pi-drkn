/** Truy cập Sheet: đọc/ghi theo tên cột. Mọi ghi đều qua LockService để tránh ghi chồng. */
/** Bộ kiểm thử đặt DB_OVERRIDE = id Sheet kiểm thử để mọi đọc/ghi đi vào đó, không chạm dữ liệu thật. */
var DB_OVERRIDE = null;
/** Bộ kiểm thử đặt TEST_CONF = {KHOÁ: giá trị} để thử các cấu hình (BLIND_REVIEW…) mà không đổi Script properties. */
var TEST_CONF = null;
var SS_MEMO_ = {};

function conf_(key) {
  if (TEST_CONF && Object.prototype.hasOwnProperty.call(TEST_CONF, key)) return TEST_CONF[key];
  return PropertiesService.getScriptProperties().getProperty(key);
}

function sheet_(name) {
  var id = DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Chưa chạy setup().');
  var ss = SS_MEMO_[id] || (SS_MEMO_[id] = SpreadsheetApp.openById(id));
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Thiếu tab ' + name);
  return sh;
}

/**
 * Bộ nhớ đệm trong MỘT lời gọi API chỉ đọc (api() bật/tắt): mỗi tab đọc tối đa một lần, và nếu có dịch vụ nâng cao
 * Sheets thì đọc nhiều tab trong MỘT lần gọi (prefetch_) — nhanh hơn nhiều so với đọc từng tab.
 * Mọi thao tác ghi đều xoá bộ nhớ đệm.
 */
var READ_MEMO_ = null;

function dbId_() {
  var id = DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Chưa chạy setup().');
  return id;
}

function toRows_(name, values) {
  var cols = SCHEMA[name];
  return values.map(function (v, i) {
    var o = { _row: i + 2 };
    cols.forEach(function (c, j) { o[c] = v[j] === undefined ? '' : v[j]; });
    return o;
  });
}

function rows_(name) {
  if (READ_MEMO_ && READ_MEMO_[name]) return READ_MEMO_[name];
  var sh = sheet_(name), cols = SCHEMA[name], n = sh.getLastRow();
  var out = n < 2 ? [] : toRows_(name, sh.getRange(2, 1, n - 1, cols.length).getValues());
  if (READ_MEMO_) READ_MEMO_[name] = out;
  return out;
}

/** Đọc trước nhiều tab bằng một lần gọi Sheets API (nếu dịch vụ nâng cao Sheets được bật); không có thì bỏ qua. */
function prefetch_(names) {
  if (!READ_MEMO_ || typeof Sheets === 'undefined') return;
  var need = names.filter(function (n) { return !READ_MEMO_[n]; });
  if (!need.length) return;
  try {
    var res = Sheets.Spreadsheets.Values.batchGet(dbId_(), {
      ranges: need.map(function (n) { return "'" + n + "'!A2:" + colLetter_(SCHEMA[n].length); }),
      valueRenderOption: 'FORMATTED_VALUE'
    });
    (res.valueRanges || []).forEach(function (vr, k) { READ_MEMO_[need[k]] = toRows_(need[k], vr.values || []); });
  } catch (e) { console.warn('prefetch_ bỏ qua (đọc từng tab): ' + e.message); }   // vẫn chạy đúng, chỉ chậm hơn
}

function colLetter_(n) { var s = ''; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }

/** Giá trị trả về cho trình duyệt phải là JSON thuần: google.script.run trả về null cả gói nếu có đối tượng Date. */
function plain_(x) { return x === undefined ? null : JSON.parse(JSON.stringify(x)); }

function findRow_(name, key, value) {
  var all = rows_(name);
  // email: so khớp không phân biệt hoa/thường và bỏ khoảng trắng (người nhập tay vào Sheet hay gõ thừa)
  var norm = key === 'email' ? function (v) { return String(v).trim().toLowerCase(); } : String;
  for (var i = 0; i < all.length; i++) if (norm(all[i][key]) === norm(value)) return { row: all[i]._row, data: all[i] };
  return null;
}

/**
 * Giá trị ghi vào ô: văn bản bắt đầu bằng = + - @ sẽ bị Google Sheets hiểu là CÔNG THỨC (ví dụ một nhận xét "=IMPORTXML(…)").
 * Thêm dấu ' ở đầu để Sheets lưu nguyên văn; khi đọc lại, dấu ' không xuất hiện trong giá trị.
 */
function cell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  return v;
}
function rowOf_(name, obj) { return SCHEMA[name].map(function (c) { return cell_(obj[c]); }); }

function append_(name, obj) {
  READ_MEMO_ = READ_MEMO_ && {};
  withLock_(function () { sheet_(name).appendRow(rowOf_(name, obj)); });
}

function update_(name, row, patch) {
  READ_MEMO_ = READ_MEMO_ && {};
  var cols = SCHEMA[name], sh = sheet_(name);
  withLock_(function () {
    var cur = sh.getRange(row, 1, 1, cols.length).getValues()[0];
    cols.forEach(function (c, j) { if (patch[c] !== undefined) cur[j] = cell_(patch[c]); });
    sh.getRange(row, 1, 1, cols.length).setValues([cur]);
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function newId_() { return Utilities.getUuid().slice(0, 8); }
function now_() { return new Date().toISOString(); }

function audit_(email, action, detail) {
  try { append_('Audit', { ngay: now_(), email: email, hanh_dong: action, chi_tiet: detail }); } catch (e) { /* audit không được chặn thao tác */ }
}
