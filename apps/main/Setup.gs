/**
 * setup(): chạy MỘT LẦN từ trình soạn thảo Apps Script (Run → setup) bằng tài khoản quản trị.
 *  - tạo Google Sheet "Pi ĐRKN — dữ liệu" (nếu chưa có) với đủ các tab và tiêu đề cột;
 *  - tạo thư mục Drive "Pi ĐRKN — hình" cho hình vẽ;
 *  - sinh khoá SECRET;
 *  - ghi tất cả vào Script properties (không bao giờ vào mã nguồn);
 *  - thêm người chạy làm "Quản trị".
 * Kết quả in ở Execution log: SECRET cần đặt vào Script properties của App A.
 */
function setup() {
  var props = PropertiesService.getScriptProperties();
  var me = Session.getEffectiveUser().getEmail().toLowerCase();
  var ssId = props.getProperty('SHEET_ID');
  var ss = ssId ? SpreadsheetApp.openById(ssId) : SpreadsheetApp.create('Pi ĐRKN — dữ liệu');
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var cols = SCHEMA[name];
    var head = sh.getRange(1, 1, 1, cols.length);
    var cur = head.getValues()[0];
    if (cur.join('') === '') { head.setValues([cols]).setFontWeight('bold'); sh.setFrozenRows(1); }
    else if (cur.join('|') !== cols.join('|')) Logger.log('CẢNH BÁO: tab ' + name + ' có cột khác mô hình — không ghi đè.');
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  var figId = props.getProperty('FIG_FOLDER_ID') || DriveApp.createFolder('Pi ĐRKN — hình').getId();
  var secret = props.getProperty('SECRET') ||
    Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now()));
  props.setProperties({ SHEET_ID: ss.getId(), FIG_FOLDER_ID: figId, SECRET: secret, BLIND_REVIEW: props.getProperty('BLIND_REVIEW') || 'true' });
  // người chạy setup là quản trị
  var users = rows_('Users');
  if (!users.some(function (u) { return u.email === me; })) {
    append_('Users', { email: me, ten: '', vai_tro: 'Quản trị', hoat_dong: true, ghi_chu: 'tạo bởi setup()' });
  }
  audit_(me, 'setup', 'Sheet ' + ss.getId());
  Logger.log('Sheet: ' + ss.getUrl());
  Logger.log('SECRET (đặt vào Script properties của App A): ' + secret);
  Logger.log('Địa chỉ App B: lấy ở Deploy → Manage deployments (đuôi /exec), dán cùng SECRET vào App A.');
}

/** Thêm/cập nhật người dùng (chạy từ trình soạn thảo, hoặc qua trang Quản trị). */
function setUser(email, name, roles) {
  email = String(email).trim().toLowerCase();
  var list = String(roles).split(',').map(function (r) { return r.trim(); }).filter(String);
  list.forEach(function (r) { if (ROLES.indexOf(r) < 0) throw new Error('Vai trò không hợp lệ: ' + r); });
  var r = findRow_('Users', 'email', email);
  if (r) update_('Users', r.row, { ten: name, vai_tro: list.join(', '), hoat_dong: true });
  else append_('Users', { email: email, ten: name, vai_tro: list.join(', '), hoat_dong: true });
  return 'OK';
}
