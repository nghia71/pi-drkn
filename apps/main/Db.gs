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

var LAZY_TABS_ = ['Feedback', 'Errors'];
function sheet_(name) {
  var id = DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Chưa chạy setup().');
  var ss = SS_MEMO_[id] || (SS_MEMO_[id] = SpreadsheetApp.openById(id));
  var sh = ss.getSheetByName(name);
  if (!sh && LAZY_TABS_.indexOf(name) >= 0) {        // tab mới thêm sau khi cài: tự tạo, khỏi phải chạy lại setup()
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold'); sh.setFrozenRows(1);
  }
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
  // Ghi bằng SpreadsheetApp có thể còn nằm trong bộ đệm của lần chạy; Sheets API đọc thẳng bản trên máy chủ → ghi hết trước khi đọc
  // (trang web: mỗi thao tác là một lần chạy riêng nên không gặp; bộ kiểm thử chạy mọi thứ trong một lần chạy — kịch bản 2.3).
  SpreadsheetApp.flush();
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
  for (var i = 0; i < all.length; i++) if (norm(all[i][key]) === norm(value)) {
    FOUND_KEY_[name + '#' + all[i]._row] = keyOf_(name, all[i]);             // update_ kiểm tra lại dòng này trước khi ghi
    return { row: all[i]._row, data: all[i] };
  }
  return null;
}
var FOUND_KEY_ = {};
/** Cột nhận diện một dòng (không đổi khi sửa): mặc định cột đầu; bảng có cột đầu trùng nhau thì ghép thêm cột. */
var ROW_KEY_COLS_ = { Assignments: ['ky', 'ma_bai', 'email'], Shortlist: ['ky', 'ma_bai'] };
function keyOf_(name, obj) {
  var cols = ROW_KEY_COLS_[name] || [SCHEMA[name][0]], out = [];
  for (var i = 0; i < cols.length; i++) { var v = obj[cols[i]]; if (typeof v !== 'string' || v === '') return null; out.push(v); }
  return out.join('\u0001');
}

/**
 * Giá trị ghi vào ô: văn bản bắt đầu bằng = + - @ sẽ bị Google Sheets hiểu là CÔNG THỨC (ví dụ một nhận xét "=IMPORTXML(…)").
 * Thêm dấu ' ở đầu để Sheets lưu nguyên văn; khi đọc lại, dấu ' không xuất hiện trong giá trị.
 */
function cell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' && /^[=+\-@]/.test(v)) return "'" + v;
  // tên như "10/2026" (số báo, tên kỳ) bị Sheets đổi thành ngày — giữ nguyên chữ
  if (typeof v === 'string' && /^\s*\d{1,2}\/(\d{1,2}\/)?\d{2,4}\s*$/.test(v)) return "'" + v;
  return v;
}
function rowOf_(name, obj) { return SCHEMA[name].map(function (c) { return cell_(obj[c]); }); }

function append_(name, obj) {
  READ_MEMO_ = READ_MEMO_ && {};
  withLock_(function () { sheet_(name).appendRow(rowOf_(name, obj)); });
}

/**
 * Chỉ ghi các ô có trong patch. Không ghi lại cả dòng: ô khác đọc ra rồi ghi lại sẽ mất dấu ' bảo vệ, nên chữ như
 * "10/2026" hay "2026-10-20" bị Sheets đổi thành ngày, "=…" thành công thức.
 */
function update_(name, row, patch) {
  READ_MEMO_ = READ_MEMO_ && {};
  var cols = SCHEMA[name], sh = sheet_(name);
  withLock_(function () {
    row = recheckRow_(name, sh, row);
    cols.forEach(function (c, j) { if (patch[c] !== undefined) sh.getRange(row, j + 1).setValue(cell_(patch[c])); });
  });
}

/**
 * Số dòng tìm được (findRow_) có thể đã cũ khi ghi: người khác vừa xoá dòng phía trên (đặt lại bài luyện, xoá kỳ, đưa về như trước
 * khi dùng thử) thì các dòng dưới dịch lên. Trong khoá ghi: so khoá (cột đầu) của dòng với khoá đã đọc; lệch thì tìm lại theo khoá,
 * không thấy thì dừng — không bao giờ ghi nhầm sang dòng khác.
 */
function recheckRow_(name, sh, row) {
  var want = FOUND_KEY_[name + '#' + row];
  if (!want) return row;                                                   // không rõ khoá (ô kiểu ngày…): như cũ
  var cols = SCHEMA[name], width = cols.length;
  var asObj = function (vals) { var o = {}; cols.forEach(function (c, j) { o[c] = vals[j]; }); return o; };
  var got = keyOf_(name, asObj(sh.getRange(row, 1, 1, width).getValues()[0]));
  if (got === null || got === want) return row;
  var n = sh.getLastRow(), all = n < 2 ? [] : sh.getRange(2, 1, n - 1, width).getValues();
  for (var i = 0; i < all.length; i++) if (keyOf_(name, asObj(all[i])) === want) { FOUND_KEY_[name + '#' + (i + 2)] = want; return i + 2; }
  throw new Error('Dữ liệu vừa thay đổi (' + name + ': dòng cần sửa không còn) — tải lại trang rồi thử lại.');
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
