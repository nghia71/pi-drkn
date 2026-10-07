/**
 * Nhập hàng loạt (chỉ Quản trị): đọc một tệp JSON đã chuẩn bị trên máy (tools/convert/stage.py) và tải
 * lên Drive RIÊNG của tài khoản quản trị, rồi ghi vào Sheet theo từng đợt để không vượt giới hạn 6 phút.
 * Chạy lại importBatch(fileId) cho tới khi kết quả báo "xong". Bài đã có mã_bài thì bỏ qua (không ghi đè).
 *
 * Định dạng mỗi phần tử: {problem:{…Problems}, author:{ten_in, don_vi}, provenance:{…}, corrections:[…],
 *                         checks:[…], conflicts:[…], log:[…]}
 */
var IMPORT_CHUNK = 15;

/** Chạy từ trình soạn thảo: nhập tệp mới nhất tên "pi-drkn-import….json" trong Drive của quản trị. */
function importLatest() {
  adminOnly_();
  var it = DriveApp.searchFiles("title contains 'pi-drkn-import' and trashed = false"), best = null;
  while (it.hasNext()) { var f = it.next(); if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f; }
  if (!best) throw new Error('Không thấy tệp pi-drkn-import….json trong Drive.');
  Logger.log('Tệp: ' + best.getName());
  return importBatch(best.getId());
}

function importBatch(fileId) {
  adminOnly_();
  var props = PropertiesService.getScriptProperties();
  var key = 'IMPORT_' + fileId;
  var start = Number(props.getProperty(key) || 0);
  var items = JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8'));
  var existing = {};
  rows_('Problems').forEach(function (p) { existing[p.ma_bai] = true; });
  var authors = {};
  rows_('Authors').forEach(function (a) { authors[a.ten_in + '|' + a.don_vi] = a.tac_gia_id; });
  var t0 = Date.now(), i = start, added = 0, skipped = 0;
  for (; i < items.length && i < start + IMPORT_CHUNK && Date.now() - t0 < 4 * 60 * 1000; i++) {
    var it = items[i], p = it.problem;
    if (!p || !p.ma_bai) continue;
    if (existing[p.ma_bai]) { skipped++; continue; }
    var aid = '';
    if (it.author && it.author.ten_in) {
      var k = it.author.ten_in + '|' + (it.author.don_vi || '');
      aid = authors[k];
      if (!aid) { aid = newId_(); append_('Authors', { tac_gia_id: aid, ten_in: it.author.ten_in, don_vi: it.author.don_vi || '' }); authors[k] = aid; }
    }
    p.tac_gia_id = aid; p.phien_ban = 1; p.cap_nhat = now_(); p.nguoi_cap_nhat = 'nhập hàng loạt';
    append_('Problems', p);
    if (it.provenance) { it.provenance.ma_bai = p.ma_bai; append_('Provenance', flat_(it.provenance)); }
    (it.corrections || []).forEach(function (c) { c.id = newId_(); c.ma_bai = p.ma_bai; append_('Corrections', flat_(c)); });
    (it.checks || []).forEach(function (c) { append_('Checks', { id: newId_(), ma_bai: p.ma_bai, noi_dung: c, trang_thai: 'mở', nguoi: 'chuyển đổi', ngay: now_() }); });
    (it.conflicts || []).forEach(function (c) { c.id = newId_(); c.ma_bai = p.ma_bai; append_('Conflicts', flat_(c)); });
    (it.reviews || []).forEach(function (g) { append_('Reviews', { id: newId_(), ky: 'trước hệ thống', ma_bai: p.ma_bai, email: '', nhan_xet: g, ngay: now_() }); });
    (it.log || []).forEach(function (l) { append_('ConversionLog', { id: newId_(), ma_bai: p.ma_bai, noi_dung: l, ngay: now_() }); });
    existing[p.ma_bai] = true; added++;
  }
  props.setProperty(key, String(i));
  var done = i >= items.length;
  if (done) props.deleteProperty(key);
  var msg = (done ? 'xong' : 'chưa xong — chạy lại') + ': ' + i + '/' + items.length + ' (thêm ' + added + ', bỏ qua ' + skipped + ')';
  audit_(Session.getEffectiveUser().getEmail(), 'nhập hàng loạt', fileId + ' ' + msg);
  Logger.log(msg);
  return msg;
}

/** Mảng/đối tượng lồng nhau được lưu thành JSON trong ô. */
function flat_(o) {
  var r = {};
  Object.keys(o).forEach(function (k) { r[k] = (o[k] !== null && typeof o[k] === 'object') ? JSON.stringify(o[k]) : o[k]; });
  return r;
}
