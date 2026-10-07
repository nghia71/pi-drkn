/** Truy cập Sheet: đọc/ghi theo tên cột. Mọi ghi đều qua LockService để tránh ghi chồng. */
function sheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Chưa chạy setup().');
  var sh = SpreadsheetApp.openById(id).getSheetByName(name);
  if (!sh) throw new Error('Thiếu tab ' + name);
  return sh;
}

function rows_(name) {
  var sh = sheet_(name), cols = SCHEMA[name], n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cols.length).getValues().map(function (v, i) {
    var o = { _row: i + 2 };
    cols.forEach(function (c, j) { o[c] = v[j]; });
    return o;
  });
}

function findRow_(name, key, value) {
  var all = rows_(name);
  for (var i = 0; i < all.length; i++) if (String(all[i][key]) === String(value)) return { row: all[i]._row, data: all[i] };
  return null;
}

function append_(name, obj) {
  var cols = SCHEMA[name];
  withLock_(function () { sheet_(name).appendRow(cols.map(function (c) { return obj[c] === undefined ? '' : obj[c]; })); });
}

function update_(name, row, patch) {
  var cols = SCHEMA[name], sh = sheet_(name);
  withLock_(function () {
    var cur = sh.getRange(row, 1, 1, cols.length).getValues()[0];
    cols.forEach(function (c, j) { if (patch[c] !== undefined) cur[j] = patch[c]; });
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
