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

/**
 * Đưa về, trong MỘT khoá ghi (không ai ghi xen vào): đọc lại trạng thái, chụp trạng thái hiện tại, sao chép mọi tab của bản chụp
 * vào Sheet dữ liệu dưới tên tạm, rồi mới thay một loạt. Lỗi khi sao chép: bỏ các bản tạm, dữ liệu chưa đổi gì.
 */
function trialRestore_() {
  return withLock_(function () {
    var st = trialState_();
    if (!st) throw new Error('Không đang dùng thử.');
    var live = SpreadsheetApp.openById(DB_OVERRIDE || PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    var snap = SpreadsheetApp.openById(st.ban_chup);
    var truoc = trialSnapshot_('trước khi đưa về');
    var tabs = Object.keys(SCHEMA).filter(function (t) { return TRIAL_KEEP_TABS.indexOf(t) < 0 && snap.getSheetByName(t); });
    var copies = [];
    try { tabs.forEach(function (t) { copies.push([t, snap.getSheetByName(t).copyTo(live)]); }); }
    catch (e) {
      copies.forEach(function (c) { try { live.deleteSheet(c[1]); } catch (x) { /* bỏ qua */ } });
      throw new Error('Không đưa về được — dữ liệu chưa thay đổi gì. Lỗi: ' + (e && e.message || e));
    }
    var done = [];
    try {
      copies.forEach(function (c) { var old = live.getSheetByName(c[0]); if (old) live.deleteSheet(old); c[1].setName(c[0]); done.push(c[0]); });
    } catch (e) {
      throw new Error('Đưa về dở dang (' + done.length + '/' + copies.length + ' tab). Khôi phục từ bản chụp „trước khi đưa về" ' + truoc +
                      ' theo docs/setup.md mục 15. Lỗi: ' + (e && e.message || e));
    }
    SS_MEMO_ = {}; READ_MEMO_ = READ_MEMO_ && {};
    st.lan_dua_ve = (st.lan_dua_ve || 0) + 1; st.truoc_dua_ve = truoc;
    trialSave_(st);
    return copies.length;
  });
}

/** a.viec: 'bat_dau' | 'dua_ve' | 'ket_thuc' (a.dua_ve: true = đưa về rồi kết thúc, false = giữ mọi thay đổi). */
function trialAction_(w, a) {
  if (a.viec === 'bat_dau') {
    need_(w, TRIAL_MANAGERS);
    withLock_(function () {
      var st = trialState_();
      if (st) throw new Error('Đang dùng thử rồi (từ ' + st.tu + ').');
      trialSave_({ tu: today_(), ban_chup: trialSnapshot_('trước dùng thử'), boi: w.email });
    });
    audit_(w.email, 'bắt đầu dùng thử', 'chụp dữ liệu');
    return { ok: true, trial: trialInfo_() };
  }
  if (a.viec === 'dua_ve') {
    need_(w, TRIAL_RESTORERS);
    var tu = (trialState_() || {}).tu, n = trialRestore_();
    audit_(w.email, 'đưa về như trước khi dùng thử', n + ' tab');
    if (w.eff.indexOf('Quản trị') < 0) {                    // người khác Quản trị đưa về: báo chủ hệ thống
      try { sendMail_(Session.getEffectiveUser().getEmail(), '[Pi ĐRKN] ' + w.email + ' vừa đưa dữ liệu về như trước khi dùng thử',
        'Đang dùng thử từ ' + tu + '. Mọi bài, kỳ, bảng, phiếu, thảo luận đã về như lúc bắt đầu. Bản chụp trạng thái ngay trước khi đưa về nằm trong thư mục sao lưu (docs/setup.md mục 15, 17).'); } catch (e) { /* không chặn */ }
    }
    return { ok: true, tab: n, trial: trialInfo_() };
  }
  if (a.viec === 'ket_thuc') {
    need_(w, TRIAL_MANAGERS);
    if (a.dua_ve === true) trialRestore_();
    withLock_(function () {
      if (!trialState_()) throw new Error('Không đang dùng thử.');
      trialSave_(null);
    });
    audit_(w.email, 'kết thúc dùng thử', a.dua_ve === true ? 'đưa về như trước' : 'giữ mọi thay đổi');
    return { ok: true, trial: null };
  }
  throw new Error('Việc lạ.');
}
