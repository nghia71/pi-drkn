/**
 * BẢNG CHỌN BÀI theo số báo (ví dụ "10/2026"): PT xếp bài vào các vị trí, gửi TBT; TBT duyệt hoặc trả lại.
 *
 * Tab Issues:    so (số báo, khoá), trang_thai ('đang chọn' | 'chờ duyệt' | 'đã duyệt' | 'đã khoá'), nguoi_duyet, duyet_luc, ghi_chu,
 *                khoa_luc, tep (tệp zip chế bản — xem Close.gs)
 * Tab Shortlist: ky (= số báo), ma_bai, vi_tri (1…N, thứ tự in sau này), phuong_an (mức của vị trí: A/B),
 *                quyet_dinh ('chọn' khi đã duyệt), nguoi, ngay, trang_thai_truoc, muc_truoc
 *
 * Quy ước (Nghĩa, 2026-10-07):
 *  - Bố cục mỗi số: BOARD_LAYOUT (Script property), mặc định 4 bài mức B rồi 6 bài mức A.
 *  - TBT duyệt: các bài được chọn chuyển SL-OK và nhận mức của vị trí (trạng thái, mức cũ được ghi lại).
 *  - Bài đã phản biện mà không được chọn giữ nguyên trạng thái (SL) — còn dùng cho số sau. SL-Fail chỉ khi TBT loại hẳn (đổi tay).
 *  - Muốn thay bài sau khi duyệt: "Mở lại" — trạng thái, mức của các bài trả về như trước khi duyệt; sửa xong gửi TBT duyệt lại.
 *  - Một bài chỉ nằm trong một bảng chưa khoá.
 */
var BOARD_MANAGERS = ['PT', 'Quản trị'];
var BOARD_STATES = ['đang chọn', 'chờ duyệt', 'đã duyệt', 'đã khoá'];

function boardLayout_() {
  var raw = String(conf_('BOARD_LAYOUT') || 'B,B,B,B,A,A,A,A,A,A');
  var out = raw.split(',').map(function (x) { return x.trim().toUpperCase(); }).filter(String);
  if (!out.length || out.some(function (m) { return LEVELS.indexOf(m) < 0; })) throw new Error('BOARD_LAYOUT không hợp lệ: ' + raw);
  return out;
}

function issueRow_(so) {
  var hit = findRow_('Issues', 'so', so);
  if (!hit) throw new Error('Không có bảng chọn bài cho số ' + so);
  return hit;
}
function boardRows_(so) {
  return rows_('Shortlist').filter(function (r) { return String(r.ky) === String(so); })
    .sort(function (a, b) { return Number(a.vi_tri) - Number(b.vi_tri); });
}
function editableBoard_(so) {
  var hit = issueRow_(so);
  if (hit.data.trang_thai !== 'đang chọn') throw new Error('Bảng số ' + so + ' đang ở trạng thái "' + hit.data.trang_thai + '" — mở lại trước khi sửa.');
  return hit;
}

/* ---------------- đọc ---------------- */

/** Trang "Bảng chọn bài": mọi bảng, bố cục, và danh sách bài có thể chọn (kèm tóm tắt phiếu phản biện). */
function boardsView_(w) {
  need_(w, ALL_PROBLEMS_VIEWERS);
  var layout = boardLayout_(), issues = rows_('Issues'), sl = rows_('Shortlist');
  var active = {};   // ma_bai → số báo của bảng đang giữ nó
  sl.forEach(function (r) { active[r.ma_bai] = String(r.ky); });
  var tally = {};
  rows_('Reviews').forEach(function (v) {
    var t = tally[v.ma_bai] = tally[v.ma_bai] || { n: 0, chon: 0, sua: 0, khong: 0, A: 0, B: 0 };
    t.n++;
    if (v.diem === 'chọn') t.chon++; else if (v.diem === 'sửa rồi chọn') t.sua++; else if (v.diem === 'không chọn') t.khong++;
    if (v.muc_de_nghi === 'A' || v.muc_de_nghi === 'B') t[v.muc_de_nghi]++;
  });
  var openChecks = countBy_('Checks', function (c) { return c.trang_thai !== 'xong'; });
  var openConfl = countBy_('Conflicts', function (c) { return String(c.trang_thai).indexOf('mở') >= 0 || String(c.trang_thai).indexOf('chờ') >= 0; });
  var assigned = assignedSet_(w);
  var probs = {};
  rows_('Problems').forEach(function (p) {
    if (!canSee_(w, p.ma_bai, assigned)) return;
    probs[p.ma_bai] = { ma_bai: p.ma_bai, chu_de: p.chu_de, muc: p.muc, trang_thai: p.trang_thai, phieu: tally[p.ma_bai] || null,
                        checks: openChecks[p.ma_bai] || 0, conflicts: openConfl[p.ma_bai] || 0, bang: active[p.ma_bai] || '' };
  });
  return {
    layout: layout, manage: has_(w, BOARD_MANAGERS), tbt: has_(w, ['TBT']), reopen: has_(w, BOARD_MANAGERS.concat(['TBT'])), close: has_(w, CLOSERS), btk: has_(w, ['BTK']),
    boards: issues.map(function (i) {
      return { so: String(i.so), trang_thai: i.trang_thai, nguoi_duyet: i.nguoi_duyet, duyet_luc: i.duyet_luc || '', ghi_chu: i.ghi_chu, khoa_luc: i.khoa_luc || '', tep: i.tep || '',
               rows: boardRows_(i.so).map(function (r) { return { vi_tri: Number(r.vi_tri), ma_bai: r.ma_bai, muc_vi_tri: r.phuong_an }; }) };
    }),
    problems: Object.keys(probs).map(function (k) { return probs[k]; })
  };
}

/* ---------------- PT: lập bảng ---------------- */

function newBoard_(w, a) {
  need_(w, BOARD_MANAGERS);
  var so = shortText_(a.so, 'Số báo', 30, true);
  if (/^[=+\-@']/.test(so)) throw new Error('Số báo không được bắt đầu bằng = + - @ \'.');
  withLock_(function () {
    if (findRow_('Issues', 'so', so)) throw new Error('Đã có bảng cho số ' + so + '.');
    sheet_('Issues').appendRow(rowOf_('Issues', { so: "'" + so, trang_thai: 'đang chọn', ghi_chu: '' }));
  });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'lập bảng chọn bài', so);
  return true;
}

/** Đặt bài vào vị trí (thay bài đang ở đó nếu có; nếu bài đã ở vị trí khác trong bảng thì chuyển chỗ). */
function placeProblem_(w, a) {
  need_(w, BOARD_MANAGERS);
  editableBoard_(a.so);
  var layout = boardLayout_(), pos = Number(a.vi_tri);
  if (!(pos >= 1 && pos <= layout.length && Math.floor(pos) === pos)) throw new Error('Vị trí phải từ 1 đến ' + layout.length + '.');
  needProblem_(w, a.ma_bai);
  var p = findRow_('Problems', 'ma_bai', a.ma_bai).data;
  if (p.trang_thai === 'PL') throw new Error('Bài ' + a.ma_bai + ' đã đăng.');
  var other = rows_('Shortlist').filter(function (r) { return r.ma_bai === a.ma_bai && String(r.ky) !== String(a.so); })[0];
  if (other) throw new Error('Bài ' + a.ma_bai + ' đang ở bảng số ' + other.ky + '.');
  withLock_(function () {
    var sh = sheet_('Shortlist');
    // bỏ dòng ở vị trí đích và dòng cũ của chính bài này (xoá từ dưới lên để số dòng không lệch)
    boardRows_(a.so).filter(function (r) { return Number(r.vi_tri) === pos || r.ma_bai === a.ma_bai; })
      .map(function (r) { return r._row; }).sort(function (x, y) { return y - x; })
      .forEach(function (row) { sh.deleteRow(row); });
    sh.appendRow(rowOf_('Shortlist', { ky: "'" + a.so, ma_bai: a.ma_bai, vi_tri: pos, phuong_an: layout[pos - 1], quyet_dinh: '',
                                       nguoi: w.email, ngay: now_() }));
  });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'xếp bài', a.so + ' #' + pos + ' ← ' + a.ma_bai);
  return true;
}

function unplaceProblem_(w, a) {
  need_(w, BOARD_MANAGERS);
  editableBoard_(a.so);
  var r = boardRows_(a.so).filter(function (x) { return Number(x.vi_tri) === Number(a.vi_tri); })[0];
  if (!r) throw new Error('Vị trí ' + a.vi_tri + ' đang trống.');
  withLock_(function () { sheet_('Shortlist').deleteRow(r._row); });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'bỏ bài khỏi bảng', a.so + ' #' + a.vi_tri + ' (' + r.ma_bai + ')');
  return true;
}

/** Đổi chỗ hai vị trí (thứ tự in); mức của vị trí đi theo vị trí, không theo bài. */
function swapPositions_(w, a) {
  need_(w, BOARD_MANAGERS);
  editableBoard_(a.so);
  var layout = boardLayout_(), x = Number(a.a), y = Number(a.b);
  [x, y].forEach(function (p) { if (!(p >= 1 && p <= layout.length)) throw new Error('Vị trí không hợp lệ.'); });
  var rows = boardRows_(a.so);
  withLock_(function () {
    rows.forEach(function (r) {
      var v = Number(r.vi_tri);
      if (v === x || v === y) update_('Shortlist', r._row, { vi_tri: v === x ? y : x, phuong_an: layout[(v === x ? y : x) - 1] });
    });
  });
  audit_(w.email, 'đổi chỗ', a.so + ' #' + x + ' ↔ #' + y);
  return true;
}

function submitBoard_(w, a) {
  need_(w, BOARD_MANAGERS);
  var hit = editableBoard_(a.so), n = boardLayout_().length;
  if (boardRows_(a.so).length !== n) throw new Error('Bảng chưa đủ ' + n + ' bài.');
  update_('Issues', hit.row, { trang_thai: 'chờ duyệt', ghi_chu: shortText_(a.ghi_chu, 'Ghi chú', 2000, false) || hit.data.ghi_chu });
  audit_(w.email, 'gửi TBT duyệt', a.so);
  return true;
}

/* ---------------- TBT: duyệt / trả lại; mở lại ---------------- */

function approveBoard_(w, a) {
  need_(w, ['TBT']);
  var hit = issueRow_(a.so);
  if (hit.data.trang_thai !== 'chờ duyệt') throw new Error('Bảng số ' + a.so + ' chưa được gửi duyệt.');
  var rows = boardRows_(a.so), t = now_();
  if (rows.length !== boardLayout_().length) throw new Error('Bảng chưa đủ bài.');
  withLock_(function () {
    rows.forEach(function (r) {
      var p = findRow_('Problems', 'ma_bai', r.ma_bai);
      update_('Shortlist', r._row, { quyet_dinh: 'chọn', trang_thai_truoc: p.data.trang_thai, muc_truoc: p.data.muc || '-' });
      update_('Problems', p.row, { trang_thai: 'SL-OK', muc: r.phuong_an, cap_nhat: t, nguoi_cap_nhat: w.email });
    });
    update_('Issues', hit.row, { trang_thai: 'đã duyệt', nguoi_duyet: w.email, duyet_luc: t,
                                 ghi_chu: shortText_(a.ghi_chu, 'Ghi chú', 2000, false) || hit.data.ghi_chu });
  });
  audit_(w.email, 'duyệt bảng chọn bài', a.so + ': ' + rows.map(function (r) { return r.ma_bai; }).join(', '));
  return true;
}

function returnBoard_(w, a) {
  need_(w, ['TBT']);
  var hit = issueRow_(a.so);
  if (hit.data.trang_thai !== 'chờ duyệt') throw new Error('Bảng số ' + a.so + ' không ở trạng thái chờ duyệt.');
  var note = shortText_(a.ghi_chu, 'Lý do trả lại', 2000, true);
  update_('Issues', hit.row, { trang_thai: 'đang chọn', ghi_chu: note });
  audit_(w.email, 'trả lại bảng chọn bài', a.so + ': ' + note);
  return true;
}

/** Mở lại để sửa (PT, TBT, Quản trị). Nếu bảng đã duyệt: trạng thái và mức của các bài trả về như trước khi duyệt. */
function reopenBoard_(w, a) {
  need_(w, BOARD_MANAGERS.concat(['TBT']));
  var hit = issueRow_(a.so);
  if (hit.data.trang_thai === 'đang chọn') return true;
  if (hit.data.trang_thai === 'đã khoá') throw new Error('Số ' + a.so + ' đã khoá kỳ (đã đánh số in) — không mở lại được.');
  var wasApproved = hit.data.trang_thai === 'đã duyệt', t = now_();
  withLock_(function () {
    if (wasApproved) boardRows_(a.so).forEach(function (r) {
      var p = findRow_('Problems', 'ma_bai', r.ma_bai);
      if (p && p.data.trang_thai === 'SL-OK') {
        update_('Problems', p.row, { trang_thai: r.trang_thai_truoc || 'SL', muc: r.muc_truoc === '-' ? '' : (r.muc_truoc || p.data.muc),
                                     cap_nhat: t, nguoi_cap_nhat: w.email });
      }
      update_('Shortlist', r._row, { quyet_dinh: '' });
    });
    update_('Issues', hit.row, { trang_thai: 'đang chọn', nguoi_duyet: '', duyet_luc: '' });
  });
  audit_(w.email, 'mở lại bảng chọn bài', a.so + (wasApproved ? ' (huỷ duyệt)' : ''));
  return true;
}
