/**
 * SAO LƯU: mỗi đêm một bản sao của Sheet dữ liệu vào thư mục Drive "Pi ĐRKN — sao lưu" (của tài khoản chủ, không chia sẻ),
 * giữ BACKUP_KEEP bản mới nhất (mặc định 30), bản cũ hơn vào Thùng rác. Chạy từ trigger mỗi giờ (installAutoTests): lần đầu
 * sau BACKUP_HOUR giờ mỗi ngày (mặc định 1 giờ). Không được thì gửi thư cho chủ. Sao lưu ngay: chạy backupNow trong trình soạn thảo.
 * Khôi phục: docs/setup.md mục 15.
 */
var BACKUP_PREFIX = 'Pi ĐRKN — dữ liệu — sao lưu ';

function backupFolder_() {
  var props = PropertiesService.getScriptProperties(), id = (TEST_CONF && TEST_CONF.BACKUP_FOLDER_ID) || props.getProperty('BACKUP_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* thư mục bị xoá: tạo lại */ } }
  var f = DriveApp.createFolder('Pi ĐRKN — sao lưu');
  if (TEST_CONF) TEST_CONF.BACKUP_FOLDER_ID = f.getId(); else props.setProperty('BACKUP_FOLDER_ID', f.getId());
  return f;
}

/** Một bản sao hôm nay (chạy lại trong ngày thì thay bản của ngày đó); xoá bớt bản cũ. */
function backup_() {
  var id = DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Chưa có Sheet dữ liệu (SHEET_ID) — chạy setup().');
  var folder = backupFolder_(), name = BACKUP_PREFIX + today_(), keep = Math.max(1, Number(conf_('BACKUP_KEEP') || 30));
  var list = [], it = folder.getFiles();
  while (it.hasNext()) { var f = it.next(); if (f.getName().indexOf(BACKUP_PREFIX) === 0) list.push(f); }
  list.filter(function (f) { return f.getName() === name; }).forEach(function (f) { f.setTrashed(true); });
  SpreadsheetApp.flush();
  var copy = DriveApp.getFileById(id).makeCopy(name, folder);
  var old = list.filter(function (f) { return f.getName() !== name; })
    .sort(function (a, b) { return a.getName() < b.getName() ? 1 : -1; }).slice(keep - 1);
  old.forEach(function (f) { f.setTrashed(true); });
  audit_('hệ thống', 'sao lưu', name + ' (xoá ' + old.length + ' bản cũ)');
  return { ten: name, id: copy.getId(), xoa: old.length };
}

/** Chạy tay trong trình soạn thảo. */
function backupNow() {
  adminOnly_();
  var r = backup_();
  Logger.log('Đã sao lưu: ' + r.ten + ' trong thư mục "Pi ĐRKN — sao lưu"; xoá ' + r.xoa + ' bản cũ.');
  return r;
}

/** Gọi từ trigger mỗi giờ: một lần mỗi ngày, sau BACKUP_HOUR giờ. Lỗi → thư cho chủ (không làm hỏng việc khác của trigger). */
function nightlyBackup_() {
  var props = PropertiesService.getScriptProperties(), today = today_();
  var hour = Number(Utilities.formatDate(new Date(), tz_(), 'H'));
  if (hour < Number(conf_('BACKUP_HOUR') || 1) || props.getProperty('BACKUP_DAY') === today) return null;
  props.setProperty('BACKUP_DAY', today);
  try { return backup_(); }
  catch (e) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '[Pi ĐRKN] Sao lưu KHÔNG được ngày ' + today,
      'Lỗi: ' + (e && e.message || e) + '\n\nChạy backupNow trong trình soạn thảo để thử lại; xem docs/setup.md mục 15.');
    return null;
  }
}
