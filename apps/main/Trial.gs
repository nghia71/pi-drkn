/**
 * DÙNG THỬ TRÊN BÀI THẬT: chụp lại toàn bộ dữ liệu trước khi dùng thử; trong lúc dùng thử mọi người làm việc trên bài thật như thật;
 * bất cứ lúc nào Quản trị (hoặc TBT) "đưa về như trước khi dùng thử"; khi kết thúc chọn giữ hay đưa về. Mọi trang hiện dòng báo
 * đang dùng thử, để không ai ngại làm sai.
 *  - Bản chụp: một bản sao của Sheet dữ liệu trong thư mục sao lưu (Backup.gs).
 *  - Đưa về: thay từng tab dữ liệu bằng tab của bản chụp (sao chép nguyên tab — giữ chữ "10/2026" là chữ). GIỮ NGUYÊN: Users (người
 *    dùng, vai trò), Audit (nhật ký), Feedback, Errors (góp ý, lỗi — chính là thứ cần giữ sau dùng thử). Trước khi đưa về, chụp
 *    trạng thái hiện tại — đưa về cũng hoàn tác được (mở bản đó, làm theo docs/setup.md mục 15).
 *  - Ngoài Sheet không đưa về được: thư đã gửi (thư mời, nhắc hạn), tệp đã lưu trên Drive (ảnh, gói chế bản) — vô hại.
 */
var TRIAL_KEEP_TABS = ['Users', 'Audit', 'Feedback', 'Errors'];
var TRIAL_MANAGERS = ['Quản trị'];
var TRIAL_RESTORERS = ['Quản trị', 'TBT'];

function trialState_() {
  var raw = TEST_CONF ? TEST_CONF.TRIAL : PropertiesService.getScriptProperties().getProperty('TRIAL');
  try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function trialSave_(st) {
  var v = st ? JSON.stringify(st) : null;
  if (TEST_CONF) { if (v) TEST_CONF.TRIAL = v; else delete TEST_CONF.TRIAL; return; }
  var p = PropertiesService.getScriptProperties();
  if (v) p.setProperty('TRIAL', v); else p.deleteProperty('TRIAL');
}
/** Cho trang web: đang dùng thử từ khi nào (dòng báo ở mọi trang). */
function trialInfo_() { var st = trialState_(); return st ? { tu: st.tu, lan_dua_ve: st.lan_dua_ve || 0 } : null; }

function trialSnapshot_(label) {
  var id = DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  SpreadsheetApp.flush();
  return DriveApp.getFileById(id).makeCopy('Pi ĐRKN — dữ liệu — ' + label + ' ' + today_(), backupFolder_()).getId();
}

function trialRestore_() {
  var st = trialState_();
  if (!st) throw new Error('Không đang dùng thử.');
  var snap = SpreadsheetApp.openById(st.ban_chup), live = SpreadsheetApp.openById(DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  var truoc = trialSnapshot_('trước khi đưa về');
  var tabs = Object.keys(SCHEMA).filter(function (t) { return TRIAL_KEEP_TABS.indexOf(t) < 0; });
  withLock_(function () {
    tabs.forEach(function (t) {
      var src = snap.getSheetByName(t);
      if (!src) return;                                   // tab mới hơn bản chụp: để nguyên
      var old = live.getSheetByName(t), copy = src.copyTo(live);
      if (old) live.deleteSheet(old);
      copy.setName(t);
    });
  });
  SS_MEMO_ = {}; READ_MEMO_ = READ_MEMO_ && {};
  st.lan_dua_ve = (st.lan_dua_ve || 0) + 1; st.truoc_dua_ve = truoc;
  trialSave_(st);
  return tabs.length;
}

/** a.viec: 'bat_dau' | 'dua_ve' | 'ket_thuc' (a.dua_ve: true = đưa về rồi kết thúc, false = giữ mọi thay đổi). */
function trialAction_(w, a) {
  var st = trialState_();
  if (a.viec === 'bat_dau') {
    need_(w, TRIAL_MANAGERS);
    if (st) throw new Error('Đang dùng thử rồi (từ ' + st.tu + ').');
    trialSave_({ tu: today_(), ban_chup: trialSnapshot_('trước dùng thử'), boi: w.email });
    audit_(w.email, 'bắt đầu dùng thử', 'chụp dữ liệu');
    return { ok: true, trial: trialInfo_() };
  }
  if (a.viec === 'dua_ve') {
    need_(w, TRIAL_RESTORERS);
    var n = trialRestore_();
    audit_(w.email, 'đưa về như trước khi dùng thử', n + ' tab');
    return { ok: true, tab: n, trial: trialInfo_() };
  }
  if (a.viec === 'ket_thuc') {
    need_(w, TRIAL_MANAGERS);
    if (!st) throw new Error('Không đang dùng thử.');
    if (a.dua_ve === true) trialRestore_();
    trialSave_(null);
    audit_(w.email, 'kết thúc dùng thử', a.dua_ve === true ? 'đưa về như trước' : 'giữ mọi thay đổi');
    return { ok: true, trial: null };
  }
  throw new Error('Việc lạ.');
}
