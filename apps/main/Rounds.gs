/**
 * KỲ PHẢN BIỆN: PT mở kỳ, giao bài cho phản biện, đặt hạn, gửi thư mời; phản biện điền phiếu và đánh dấu xong;
 * hệ thống nhắc trước hạn (REMINDER_DAYS ngày, mặc định 3 và 1); PT đóng kỳ.
 *
 * Tab Rounds:      ky (tên kỳ, khoá), trang_thai ('mở' | 'đóng'), han_phan_bien (YYYY-MM-DD), khoa_luc, ghi_chu
 * Tab Assignments: ky, ma_bai, email, giao_luc, han, xong, moi_luc (đã gửi thư mời), nhac (các mốc đã nhắc, ví dụ "3,1")
 * Tab Reviews:     một phiếu cho mỗi (kỳ, bài, phản biện): muc_de_nghi (A/B), diem (đề nghị), nhan_xet
 *
 * Thư: chỉ có số bài, hạn và đường dẫn đăng nhập — không có đề, lời giải, tên tác giả.
 */
var ROUND_MANAGERS = ['PT', 'Quản trị'];
var REVIEW_READERS = ['TBT', 'PT', 'NCB', 'Quản trị'];      // xem phiếu của mọi phản biện (kèm email)
/**
 * Lời giải và phản biện (Nghĩa, 2026-10-08): phản biện tự giải trước — KHÔNG thấy lời giải cho tới khi PT (hoặc TBT) "mở lời giải"
 * cho kỳ đó (Rounds.mo_loi_giai = lúc mở). Máy chủ không gửi lời giải (cả hình trong lời giải) cho phản biện khi chưa mở.
 */
var SOLUTION_OPENERS = ['PT', 'TBT', 'Quản trị'];
/** Phản biện này được xem lời giải bài ma chưa: có một kỳ đang mở giao bài cho họ và kỳ đó đã mở lời giải. */
function solutionOpen_(w, ma) {
  var open = {};
  rows_('Rounds').forEach(function (r) { if (r.trang_thai === 'mở' && String(r.mo_loi_giai || '').trim()) open[String(r.ky)] = true; });
  return rows_('Assignments').some(function (a) { return a.ma_bai === ma && open[String(a.ky)] && sameEmail_(a.email, w.email); });
}
/** PT, TBT, Quản trị: mở (hoặc đóng lại) lời giải của một kỳ đang mở cho các phản biện của kỳ. a = {ky, mo: true|false}. */
function releaseSolutions_(w, a) {
  need_(w, SOLUTION_OPENERS);
  var hit = openRound_(a.ky), mo = a.mo !== false;
  update_('Rounds', hit.row, { mo_loi_giai: mo ? now_() : '' });
  audit_(w.email, mo ? 'mở lời giải cho phản biện' : 'đóng lời giải', a.ky);
  return true;
}
var TEST_OUTBOX = null;                                    // bộ kiểm thử: thư không gửi đi mà vào đây

/* ---------------- tiện ích ---------------- */

function truthy_(v) { return v === true || String(v).trim().toUpperCase() === 'TRUE'; }

/** Ngày dạng YYYY-MM-DD theo múi giờ của dự án (Sheets có thể đã đổi chuỗi ngày thành Date). */
function dateOnly_(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}
function tz_() { return conf_('TIMEZONE') || 'Asia/Ho_Chi_Minh'; }
function today_() { return (TEST_CONF && TEST_CONF.TODAY) || Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }
/** Số ngày từ hôm nay tới ngày d (YYYY-MM-DD). */
function daysUntil_(d) {
  var a = today_().split('-').map(Number), b = String(d).split('-').map(Number);
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
}
function validDate_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) throw new Error('Hạn phải có dạng NNNN-TT-NN.');
  var p = d.split('-').map(Number), t = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  if (t.getUTCMonth() !== p[1] - 1 || t.getUTCDate() !== p[2]) throw new Error('Ngày không có thật: ' + d);
  return d;
}
/** Ghi ngày như CHỮ (dấu ' ở đầu) để Sheets không đổi thành Date. */
function textDate_(d) { return d ? "'" + d : ''; }
function addDays_(d, n) { var p = d.split('-').map(Number), t = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)); return t.toISOString().slice(0, 10); }
function reminderDays_() {
  return String(conf_('REMINDER_DAYS') || '3,1').split(',').map(function (x) { return Number(String(x).trim()); })
    .filter(function (n) { return n > 0 && Math.floor(n) === n; });
}

function roundRow_(ky) {
  var hit = findRow_('Rounds', 'ky', ky);
  if (!hit) throw new Error('Không có kỳ ' + ky);
  return hit;
}
function openRound_(ky) {
  var hit = roundRow_(ky);
  if (hit.data.trang_thai !== 'mở') throw new Error('Kỳ ' + ky + ' đã đóng.');
  return hit;
}
function assignmentsOf_(ky) { return rows_('Assignments').filter(function (a) { return String(a.ky) === String(ky); }); }
function sameEmail_(a, b) { return String(a).trim().toLowerCase() === String(b).trim().toLowerCase(); }

/** Người dùng đang hoạt động có vai trò PB (danh sách để PT chọn khi giao bài). */
function reviewers_() {
  return rows_('Users').filter(function (u) {
    var roles = String(u.vai_tro).split(',').map(function (r) { return r.trim(); });
    return roles.indexOf('PB') >= 0 && !(u.hoat_dong === false || String(u.hoat_dong).trim().toUpperCase() === 'FALSE');
  }).map(function (u) { return { email: String(u.email).trim().toLowerCase(), ten: u.ten }; });
}

/** Gửi một thư (hoặc bỏ vào hộp thư thử khi kiểm thử). Không bao giờ gửi khi đang chạy bộ kiểm thử. */
function sendMail_(to, subject, body) {
  if (TEST_CONF) { (TEST_OUTBOX = TEST_OUTBOX || []).push({ to: to, subject: subject, body: body }); return; }
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: 'Pi — Đề ra kỳ này' });
}
function mailQuota_() { return TEST_CONF ? Number(TEST_CONF.MAIL_QUOTA == null ? 100 : TEST_CONF.MAIL_QUOTA) : MailApp.getRemainingDailyQuota(); }

function signinLine_(email) {
  var url = conf_('SIGNIN_URL');
  return (url ? 'Vào hệ thống: ' + url + '\n' : '') + 'Đăng nhập Google bằng đúng địa chỉ ' + email + '.\n';
}

/* ---------------- đọc ---------------- */

/**
 * Trang "Kỳ phản biện". PT, Quản trị: mọi kỳ + phân công + danh sách phản biện; TBT, NCB: xem (không sửa).
 * PB: chỉ các bài được giao cho mình trong kỳ đang mở.
 */
function roundsView_(w) {
  if (has_(w, REVIEW_READERS)) {
    var reviews = rows_('Reviews');
    return {
      manage: has_(w, ROUND_MANAGERS), release: has_(w, SOLUTION_OPENERS),
      rounds: rows_('Rounds').map(function (r) {
        var as = assignmentsOf_(r.ky).map(function (a) {
          return { ma_bai: a.ma_bai, email: String(a.email).trim().toLowerCase(), han: dateOnly_(a.han) || dateOnly_(r.han_phan_bien),
                   xong: truthy_(a.xong), moi_luc: a.moi_luc || '', nhac: String(a.nhac || ''),
                   phieu: reviews.some(function (v) { return String(v.ky) === String(r.ky) && v.ma_bai === a.ma_bai && sameEmail_(v.email, a.email); }) };
        });
        var han = dateOnly_(r.han_phan_bien);
        return { ky: String(r.ky), trang_thai: r.trang_thai, han_phan_bien: han, con_ngay: han ? daysUntil_(han) : null, khoa_luc: r.khoa_luc || '',
                 ghi_chu: r.ghi_chu, mo_loi_giai: r.mo_loi_giai || '', assignments: as };
      }),
      reviewers: has_(w, ROUND_MANAGERS) ? reviewers_() : [],
      reminderDays: reminderDays_(), today: today_(), timezone: tz_()
    };
  }
  return { manage: false, rounds: [], reviewers: [], mine: myAssignments_(w) };
}

/** Bài được giao cho người này trong các kỳ đang mở, kèm hạn, đã xong chưa, đã có phiếu chưa. */
function myAssignments_(w) {
  var open = {};
  rows_('Rounds').forEach(function (r) { if (r.trang_thai === 'mở') open[String(r.ky)] = r; });
  var reviews = rows_('Reviews');
  return rows_('Assignments').filter(function (a) { return open[String(a.ky)] && sameEmail_(a.email, w.email); }).map(function (a) {
    return { ky: String(a.ky), ma_bai: a.ma_bai, han: dateOnly_(a.han) || dateOnly_(open[String(a.ky)].han_phan_bien), xong: truthy_(a.xong),
             phieu: reviews.some(function (v) { return String(v.ky) === String(a.ky) && v.ma_bai === a.ma_bai && sameEmail_(v.email, w.email); }) };
  });
}

/* ---------------- PT: mở kỳ, giao bài, hạn, thư, đóng kỳ ---------------- */

function openNewRound_(w, a) {
  need_(w, ROUND_MANAGERS);
  var ky = shortText_(a.ky, 'Tên kỳ', 60, true);
  if (/^[=+\-@']/.test(ky)) throw new Error('Tên kỳ không được bắt đầu bằng = + - @ \'.');
  var han = validDate_(a.han_phan_bien);
  if (daysUntil_(han) < 1) throw new Error('Hạn phải sau hôm nay.');
  withLock_(function () {
    if (findRow_('Rounds', 'ky', ky)) throw new Error('Đã có kỳ ' + ky + '.');
    sheet_('Rounds').appendRow(rowOf_('Rounds', { ky: ky, trang_thai: 'mở', han_phan_bien: textDate_(han), ghi_chu: shortText_(a.ghi_chu, 'Ghi chú', 1000, false) }));
  });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'mở kỳ', ky + ' hạn ' + han);
  return true;
}

function assign_(w, a) {
  need_(w, ROUND_MANAGERS);
  openRound_(a.ky);
  needProblem_(w, a.ma_bai);
  var email = String(a.email || '').trim().toLowerCase();
  if (!reviewers_().some(function (u) { return u.email === email; })) throw new Error('Địa chỉ này chưa có vai trò PB (hoặc đang tạm ngưng).');
  if (assignmentsOf_(a.ky).some(function (x) { return x.ma_bai === a.ma_bai && sameEmail_(x.email, email); })) throw new Error('Đã giao bài này cho người này.');
  append_('Assignments', { ky: a.ky, ma_bai: a.ma_bai, email: email, giao_luc: now_(), han: '', xong: false, moi_luc: '', nhac: '' });
  audit_(w.email, 'giao bài', a.ky + ' ' + a.ma_bai + ' → ' + email);
  return true;
}

function unassign_(w, a) {
  need_(w, ROUND_MANAGERS);
  openRound_(a.ky);
  var hit = assignmentsOf_(a.ky).filter(function (x) { return x.ma_bai === a.ma_bai && sameEmail_(x.email, a.email); })[0];
  if (!hit) throw new Error('Không có phân công này.');
  withLock_(function () { sheet_('Assignments').deleteRow(hit._row); });   // phiếu đã nộp (nếu có) vẫn giữ trong Reviews
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'bỏ giao bài', a.ky + ' ' + a.ma_bai + ' ← ' + a.email);
  return true;
}

function setDeadline_(w, a) {
  need_(w, ROUND_MANAGERS);
  var hit = openRound_(a.ky), han = validDate_(a.han_phan_bien);
  if (daysUntil_(han) < 0) throw new Error('Hạn không được ở quá khứ.');
  update_('Rounds', hit.row, { han_phan_bien: textDate_(han) });
  audit_(w.email, 'đổi hạn', a.ky + ' → ' + han);
  return true;
}

function closeRound_(w, a) {
  need_(w, ROUND_MANAGERS);
  var hit = openRound_(a.ky);
  update_('Rounds', hit.row, { trang_thai: 'đóng', khoa_luc: now_() });
  audit_(w.email, 'đóng kỳ', a.ky);
  return true;
}

/** Gửi thư mời cho mọi phản biện của kỳ còn phân công chưa mời: mỗi người MỘT thư. Kiểm tra hạn mức trước khi gửi. */
function sendInvites_(w, a) {
  need_(w, ROUND_MANAGERS);
  var r = openRound_(a.ky).data, han = dateOnly_(r.han_phan_bien);
  var pending = assignmentsOf_(a.ky).filter(function (x) { return !x.moi_luc; });
  var by = {};
  pending.forEach(function (x) { var e = String(x.email).trim().toLowerCase(); (by[e] = by[e] || []).push(x); });
  var people = Object.keys(by);
  if (!people.length) return { sent: 0 };
  var quota = mailQuota_();
  if (quota < people.length) throw new Error('Hạn mức thư hôm nay còn ' + quota + ', cần ' + people.length + '. Hãy gửi lại vào ngày mai.');
  var t = now_();
  people.forEach(function (e) {
    var n = assignmentsOf_(a.ky).filter(function (x) { return sameEmail_(x.email, e); }).length;
    sendMail_(e, '[Pi — Đề ra kỳ này] Mời phản biện kỳ ' + r.ky,
      'Chào bạn,\n\nBan biên tập chuyên mục Thách thức Toán học (Tạp chí Pi) mời bạn phản biện ' + n + ' bài trong kỳ ' + r.ky +
      '.\nHạn: ' + han + '.\n\n' + signinLine_(e) +
      '\nTrên trang mỗi bài có Phiếu phản biện (mức đề nghị, đề nghị, nhận xét) và nút "Đánh dấu đã xong".\n' +
      'Câu hỏi về một bài: ghi vào phần Thảo luận của bài đó.\n\nThư tự động từ hệ thống Đề ra kỳ này.\n');
    by[e].forEach(function (x) { update_('Assignments', x._row, { moi_luc: t }); });
  });
  audit_(w.email, 'gửi thư mời', a.ky + ': ' + people.length + ' người');
  return { sent: people.length };
}

/* ---------------- PB: phiếu, đánh dấu xong ---------------- */

function myAssignment_(w, ky, ma) {
  openRound_(ky);
  var hit = assignmentsOf_(ky).filter(function (x) { return x.ma_bai === ma && sameEmail_(x.email, w.email); })[0];
  if (!hit) throw new Error('Bài này không được giao cho bạn trong kỳ ' + ky + '.');
  return hit;
}

function submitReview_(w, a) {
  var as = myAssignment_(w, a.ky, a.ma_bai);
  if (truthy_(as.xong)) throw new Error('Bạn đã đánh dấu xong bài này; bỏ đánh dấu để sửa phiếu.');
  var muc = String(a.muc_de_nghi || '');
  if (muc && LEVELS.indexOf(muc) < 0) throw new Error('Mức đề nghị không hợp lệ.');
  if (REVIEW_RECOMMENDATIONS.indexOf(a.diem) < 0) throw new Error('Hãy chọn đề nghị: ' + REVIEW_RECOMMENDATIONS.join(' / ') + '.');
  var nx = shortText_(a.nhan_xet, 'Nhận xét', 20000, false);
  withLock_(function () {
    var cur = rows_('Reviews').filter(function (v) { return String(v.ky) === String(a.ky) && v.ma_bai === a.ma_bai && sameEmail_(v.email, w.email); })[0];
    var o = { ky: a.ky, ma_bai: a.ma_bai, email: w.email, muc_de_nghi: muc, diem: a.diem, nhan_xet: nx, ngay: now_() };
    if (cur) {
      var sh = sheet_('Reviews'), cols = SCHEMA.Reviews;
      o.id = cur.id;
      sh.getRange(cur._row, 1, 1, cols.length).setValues([rowOf_('Reviews', o)]);
    } else { o.id = newId_(); sheet_('Reviews').appendRow(rowOf_('Reviews', o)); }
  });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'phiếu phản biện', a.ky + ' ' + a.ma_bai + ' (' + a.diem + ')');
  return true;
}

function markDone_(w, a) {
  var as = myAssignment_(w, a.ky, a.ma_bai);
  var done = a.xong !== false;
  if (done && !rows_('Reviews').some(function (v) { return String(v.ky) === String(a.ky) && v.ma_bai === a.ma_bai && sameEmail_(v.email, w.email); })) {
    throw new Error('Hãy lưu Phiếu phản biện trước khi đánh dấu xong.');
  }
  update_('Assignments', as._row, { xong: done });
  audit_(w.email, done ? 'xong phản biện' : 'bỏ đánh dấu xong', a.ky + ' ' + a.ma_bai);
  return true;
}

/* ---------------- nhắc hạn (chạy hằng ngày bằng trigger) ---------------- */

/**
 * Gửi thư nhắc cho mỗi phản biện còn bài chưa xong khi còn đúng N ngày tới hạn (N trong REMINDER_DAYS).
 * Mỗi mốc chỉ nhắc một lần (ghi vào cột nhac). Hàm công khai vì trigger phải gọi được; gọi thêm lần nữa cũng không gửi lại.
 */
function sendReminders() {
  var days = reminderDays_(), sent = 0;
  // Nhật ký giải thích (Execution log khi chạy từ trình soạn thảo): hôm nay theo múi giờ nào, mỗi kỳ còn mấy ngày, ai được / không được nhắc.
  var note = function (m) { Logger.log(m); };
  note('Hôm nay ' + today_() + ' (' + tz_() + '); nhắc khi còn ' + days.join(' hoặc ') + ' ngày.');
  rows_('Rounds').filter(function (r) { return r.trang_thai === 'mở'; }).forEach(function (r) {
    var by = {}, skip = { xong: 0, chuaMoi: 0, khongDungMoc: 0, daNhac: 0, khongHan: 0 };
    assignmentsOf_(r.ky).forEach(function (a) {
      if (truthy_(a.xong)) { skip.xong++; return; }
      if (!a.moi_luc) { skip.chuaMoi++; return; }                       // chưa mời thì chưa nhắc
      var han = dateOnly_(a.han) || dateOnly_(r.han_phan_bien);
      if (!han) { skip.khongHan++; return; }
      var d = daysUntil_(han), done = String(a.nhac || '').split(',').map(function (x) { return x.trim(); });
      if (days.indexOf(d) < 0) { skip.khongDungMoc++; return; }
      if (done.indexOf(String(d)) >= 0) { skip.daNhac++; return; }
      var e = String(a.email).trim().toLowerCase();
      (by[e] = by[e] || { d: d, han: han, rows: [] }).rows.push({ row: a._row, nhac: done.filter(String).concat([String(d)]).join(',') });
    });
    var people = Object.keys(by), rh = dateOnly_(r.han_phan_bien);
    note('Kỳ ' + r.ky + ': hạn ' + (rh || '(chưa có)') + (rh ? ', còn ' + daysUntil_(rh) + ' ngày' : '') + ' → nhắc ' + people.length + ' người' +
         ' (bỏ qua: ' + skip.xong + ' đã xong, ' + skip.chuaMoi + ' chưa mời, ' + skip.khongDungMoc + ' chưa tới mốc, ' + skip.daNhac + ' đã nhắc mốc này, ' +
         skip.khongHan + ' không có hạn).');
    if (!people.length) return;
    if (mailQuota_() < people.length) { note('Hết hạn mức thư hôm nay — để hôm sau.'); return; }
    people.forEach(function (e) {
      var x = by[e];
      sendMail_(e, '[Pi — Đề ra kỳ này] Nhắc: còn ' + x.d + ' ngày — kỳ ' + r.ky,
        'Chào bạn,\n\nCòn ' + x.d + ' ngày tới hạn phản biện kỳ ' + r.ky + ' (' + x.han + '). Bạn còn ' + x.rows.length +
        ' bài chưa đánh dấu xong.\n\n' + signinLine_(e) + '\nThư tự động từ hệ thống Đề ra kỳ này.\n');
      x.rows.forEach(function (o) { update_('Assignments', o.row, { nhac: "'" + o.nhac }); });
      sent++;
    });
  });
  if (sent) audit_('hệ thống', 'nhắc hạn', sent + ' thư');
  return sent;
}

/** Chạy MỘT LẦN từ trình soạn thảo: đặt trigger gọi sendReminders mỗi ngày lúc REMINDER_HOUR giờ (mặc định 8). */
function installReminderTrigger() {
  adminOnly_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'sendReminders') ScriptApp.deleteTrigger(t); });
  var hour = Number(conf_('REMINDER_HOUR') || 8);
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1).atHour(hour).inTimezone(tz_()).create();
  Logger.log('Đã đặt nhắc hạn: mỗi ngày lúc ' + hour + ' giờ; mốc nhắc: ' + reminderDays_().join(', ') + ' ngày trước hạn.');
}
