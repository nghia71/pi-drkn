/**
 * GÓP Ý VÀ LỖI NGƯỜI DÙNG GẶP.
 *  - Nút "Góp ý" ở đầu mọi trang: đánh giá (1–5, không bắt buộc), lời góp ý, trang đang xem → tab Feedback.
 *  - Lỗi trên trang (lỗi JavaScript, thao tác bị máy chủ từ chối) → tab Errors, tự động; mỗi phiên tối đa ERR_PER_HOUR dòng mỗi giờ.
 *  - Quản trị xem cả hai ở trang "Góp ý"; mỗi sáng (DIGEST_HOUR, mặc định 7 giờ) một thư tóm tắt nếu có góp ý / lỗi mới.
 * Mọi người đã vào hệ thống đều gửi được; nội dung lưu như chữ (không thành công thức).
 */
var FEEDBACK_STATUSES = ['mới', 'đã xem', 'đã sửa', 'không làm'];
var ERR_PER_HOUR = 20;

function shortField_(v, max) { return String(v == null ? '' : v).replace(/\s+$/, '').slice(0, max); }

function addFeedback_(w, a) {
  var text = shortField_(a.noi_dung, 2000).trim(), diem = String(a.diem || '');
  if (!text && !diem) throw new Error('Hãy viết vài dòng góp ý (hoặc chọn mức hài lòng).');
  if (diem && !/^[1-5]$/.test(diem)) throw new Error('Mức hài lòng từ 1 đến 5.');
  append_('Feedback', { id: newId_(), ngay: now_(), email: w.email, vai: w.eff.join(', '), trang: shortField_(a.trang, 200),
                        diem: diem, noi_dung: text, trang_thai: FEEDBACK_STATUSES[0] });
  return { ok: true };
}

function logError_(w, a) {
  var cache = CacheService.getScriptCache(), key = 'errn:' + w.email, n = Number(cache.get(key) || 0);
  if (n >= ERR_PER_HOUR) return { ok: false, bo_qua: true };
  cache.put(key, String(n + 1), 3600);
  append_('Errors', { ngay: now_(), email: w.email, vai: w.eff.join(', '), trang: shortField_(a.trang, 200),
                      loi: shortField_(a.loi, 500), chi_tiet: shortField_(a.chi_tiet, 2000), trinh_duyet: shortField_(a.trinh_duyet, 300) });
  return { ok: true };
}

/** Trang "Góp ý" của Quản trị: góp ý (mới nhất trước) và lỗi gần đây. */
function feedbackList_(w) {
  need_(w, ['Quản trị']);
  var fb = rows_('Feedback').slice().reverse(), er = rows_('Errors').slice().reverse().slice(0, 200);
  return { gop_y: fb, loi: er, trang_thai: FEEDBACK_STATUSES };
}

function feedbackStatus_(w, a) {
  need_(w, ['Quản trị']);
  if (FEEDBACK_STATUSES.indexOf(a.trang_thai) < 0) throw new Error('Trạng thái lạ.');
  var hit = findRow_('Feedback', 'id', a.id);
  if (!hit) throw new Error('Không có góp ý này.');
  update_('Feedback', hit.row, { trang_thai: a.trang_thai });
  return { ok: true };
}

/**
 * Thư tóm tắt mỗi sáng cho chủ hệ thống: góp ý và lỗi mới kể từ lần trước. Gọi từ trigger mỗi giờ (autoTests);
 * không có gì mới thì không gửi. Trả về số dòng đã tóm tắt (hoặc null nếu chưa tới giờ / đã gửi hôm nay).
 */
function feedbackDigest_(force) {
  // kiểm thử: mốc lưu trong TEST_CONF, không đụng Script properties thật
  var props = TEST_CONF ? { getProperty: function (k) { return TEST_CONF['P_' + k] || null; }, setProperty: function (k, v) { TEST_CONF['P_' + k] = v; } }
                        : PropertiesService.getScriptProperties(), today = today_();
  var hour = Number(Utilities.formatDate(new Date(), tz_(), 'H'));
  if (!force && (hour < Number(conf_('DIGEST_HOUR') || 7) || props.getProperty('DIGEST_DAY') === today)) return null;
  props.setProperty('DIGEST_DAY', today);
  var since = props.getProperty('DIGEST_SINCE') || '';
  var t0 = since ? new Date(since).getTime() : 0;                 // ô ngày có thể là chữ ISO hoặc kiểu ngày của Sheets
  var newer = function (r) { var t = new Date(r.ngay).getTime(); return !isNaN(t) && t > t0; };
  var fb = rows_('Feedback').filter(newer), er = rows_('Errors').filter(newer);
  props.setProperty('DIGEST_SINCE', now_());
  if (!fb.length && !er.length) return 0;
  var lines = [];
  if (fb.length) {
    lines.push('GÓP Ý MỚI (' + fb.length + ')');
    fb.forEach(function (r) { lines.push('- ' + r.email + ' [' + r.vai + '] ' + (r.diem ? r.diem + '/5 ' : '') + '· ' + r.trang + '\n  ' + r.noi_dung); });
  }
  if (er.length) {
    var groups = {};
    er.forEach(function (r) { var k = r.loi; (groups[k] = groups[k] || []).push(r); });
    lines.push('', 'LỖI NGƯỜI DÙNG GẶP (' + er.length + ' lần, ' + Object.keys(groups).length + ' loại)');
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], who = {};
      g.forEach(function (r) { who[r.email] = 1; });
      lines.push('- ' + g.length + '× ' + k + '\n  ' + Object.keys(who).join(', ') + ' · ' + g[0].trang);
    });
  }
  var url = conf_('SIGNIN_URL');
  lines.push('', 'Xem đầy đủ: trang "Góp ý" (Quản trị)' + (url ? ' — ' + url : '') + ', hoặc tab Feedback / Errors của Sheet dữ liệu.');
  sendMail_(Session.getEffectiveUser().getEmail(), '[Pi ĐRKN] ' + fb.length + ' góp ý, ' + er.length + ' lỗi mới', lines.join('\n'));
  return fb.length + er.length;
}
