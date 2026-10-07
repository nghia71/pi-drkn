/**
 * API cho giao diện (google.script.run.api(token, method, args)).
 * Quy tắc "ai thấy gì":
 *  - PB chỉ thấy các bài được giao trong kỳ đang mở; nếu BLIND_REVIEW=true thì không thấy tên tác giả.
 *  - Thông tin liên hệ tác giả (tab Authors) chỉ VP, PT, TBT, Quản trị.
 *  - Sửa đề/lời giải: NCB, PT, Quản trị. Bản gốc của tác giả (de_bai_goc, loi_giai_goc) không ai sửa qua API.
 */
var EDITORS = ['NCB', 'PT', 'Quản trị'];
var CONTACT_VIEWERS = ['VP', 'PT', 'TBT', 'Quản trị'];
var ALL_PROBLEMS_VIEWERS = ['TBT', 'PT', 'NCB', 'VP', 'BTK', 'Quản trị'];

var READ_ONLY_ = { me: 1, listProblems: 1, getProblem: 1, bundle: 1, revisions: 1 };
var MAX_TEXT_ = 45000;   // giới hạn một ô của Google Sheets là 50 000 ký tự; chừa chỗ cho dấu ' chặn công thức

function api(token, method, args) {
  READ_MEMO_ = READ_ONLY_[method] ? {} : null;
  try {
    if (method === 'bundle') prefetch_(['Users', 'Problems', 'Authors', 'Rounds', 'Assignments', 'Provenance', 'Corrections',
                                        'Checks', 'Conflicts', 'ConversionLog', 'Comments']);
    if (method === 'listProblems') prefetch_(['Users', 'Problems', 'Authors', 'Checks', 'Conflicts', 'Rounds', 'Assignments']);
    if (method === 'getProblem') prefetch_(['Users', 'Problems', 'Authors', 'Rounds', 'Assignments', 'Provenance', 'Corrections',
                                            'Checks', 'Conflicts', 'ConversionLog', 'Comments']);
    return plain_(api_(token, method, args));
  } finally { READ_MEMO_ = null; }
}

function api_(token, method, args) {
  var w = who_(token);
  args = args || {};
  switch (method) {
    case 'me': return { email: w.email, name: w.name, roles: w.roles, eff: w.eff };
    case 'listProblems': return listProblems_(w, args);
    case 'getProblem': return getProblem_(w, args.ma_bai);
    case 'bundle': return bundle_(w);
    case 'saveText': return saveText_(w, args);
    case 'revisions': return revisions_(w, args.ma_bai);
    case 'addComment': return addComment_(w, args);
    case 'addCheck': return addProp_(w, 'Checks', args);
    case 'addConflict': return addProp_(w, 'Conflicts', args);
    case 'setStatus': return setStatus_(w, args);
    case 'viewAs': return setViewAs_(w, args.role);
    default: throw new Error('Không có thao tác ' + method);
  }
}

function assignedSet_(w) {
  var open = rows_('Rounds').filter(function (r) { return r.trang_thai === 'mở'; }).map(function (r) { return String(r.ky); });
  var set = {};
  rows_('Assignments').forEach(function (a) {
    if (String(a.email).trim().toLowerCase() === w.email && open.indexOf(String(a.ky)) >= 0) set[a.ma_bai] = true;
  });
  return set;
}

function canSee_(w, ma, assigned) {
  // bài luyện tập (THU-…) chỉ dành cho Quản trị và người được giao — không lẫn vào danh sách của ban biên tập
  if (String(ma).indexOf('THU-') === 0) return w.roles.indexOf('Quản trị') >= 0 || !!assigned[ma];
  if (has_(w, ALL_PROBLEMS_VIEWERS)) return true;
  return has_(w, ['PB']) && !!assigned[ma];
}

function hideAuthor_(w) {
  return !has_(w, ALL_PROBLEMS_VIEWERS) && String(conf_('BLIND_REVIEW')) !== 'false';
}

function listProblems_(w, f) {
  var full = has_(w, ALL_PROBLEMS_VIEWERS);
  var assigned = assignedSet_(w);
  var authors = {};
  if (!hideAuthor_(w)) rows_('Authors').forEach(function (a) { authors[a.tac_gia_id] = a.ten_in; });
  var openChecks = countBy_('Checks', function (c) { return c.trang_thai !== 'xong'; });
  var openConfl = countBy_('Conflicts', function (c) { return String(c.trang_thai).indexOf('mở') >= 0 || String(c.trang_thai).indexOf('chờ') >= 0; });
  return rows_('Problems').filter(function (p) {
    return canSee_(w, p.ma_bai, assigned) &&
      (!f.chu_de || p.chu_de === f.chu_de) && (!f.muc || p.muc === f.muc) && (!f.trang_thai || p.trang_thai === f.trang_thai);
  }).map(function (p) {
    return { ma_bai: p.ma_bai, chu_de: p.chu_de, muc: p.muc, trang_thai: p.trang_thai, dang: p.dang, so_in: p.so_in,
             tac_gia: hideAuthor_(w) ? '' : (authors[p.tac_gia_id] || ''),
             checks: full ? (openChecks[p.ma_bai] || 0) : 0, conflicts: full ? (openConfl[p.ma_bai] || 0) : 0, de_bai: p.de_bai };
  });
}

function countBy_(tab, pred) {
  var m = {};
  rows_(tab).forEach(function (r) { if (pred(r)) m[r.ma_bai] = (m[r.ma_bai] || 0) + 1; });
  return m;
}

/**
 * Một lần gọi cho cả trang: danh sách + chi tiết mọi bài người này được xem (cùng quy tắc với getProblem_).
 * Trình duyệt giữ sẵn, nên mở bài hiện ngay; mỗi lần mở bài vẫn gọi getProblem (chạy nền) để ghi nhật ký và lấy thảo luận mới.
 */
function bundle_(w) {
  var rows = listProblems_(w, {}), details = {};
  rows.forEach(function (p) {
    var d = getProblem_(w, p.ma_bai, true);
    if (d.problem) { delete d.problem.de_bai_goc; delete d.problem.loi_giai_goc; }   // giao diện không dùng; bớt dung lượng
    details[p.ma_bai] = d;
  });
  return { rows: rows, details: details };
}

function getProblem_(w, ma, noAudit) {
  var full = has_(w, ALL_PROBLEMS_VIEWERS);
  var assigned = assignedSet_(w);
  // kiểm tra quyền TRƯỚC khi tra bài: người không có quyền không phân biệt được "không có bài" với "không được xem"
  if (!canSee_(w, ma, assigned)) throw new Error('Không có quyền xem bài này.');
  var hit = findRow_('Problems', 'ma_bai', ma);
  if (!hit) throw new Error('Không có bài ' + ma);
  var p = hit.data, of = function (tab) { return rows_(tab).filter(function (r) { return r.ma_bai === ma; }); };
  var out;
  if (full) {
    out = { problem: p, provenance: of('Provenance')[0] || null, corrections: of('Corrections'), checks: of('Checks'),
            conflicts: of('Conflicts'), log: of('ConversionLog'), comments: of('Comments'), canEdit: has_(w, EDITORS) };
  } else {
    // Phản biện chỉ nhận văn bản đã biên tập và thảo luận: nguồn, tên tệp, xung đột, sửa đổi có thể lộ tác giả.
    out = { problem: { ma_bai: p.ma_bai, chu_de: p.chu_de, muc: p.muc, trang_thai: p.trang_thai, de_bai: p.de_bai,
                       loi_giai: p.loi_giai, hinh: p.hinh, phien_ban: p.phien_ban },
            provenance: null, corrections: [], checks: [], conflicts: [], log: [], comments: of('Comments'), canEdit: false, limited: true };
  }
  if (hideAuthor_(w)) { delete out.problem.tac_gia_id; out.author = null; }
  else {
    var a = findRow_('Authors', 'tac_gia_id', p.tac_gia_id);
    out.author = a ? { ten_in: a.data.ten_in, don_vi: a.data.don_vi, lien_he: has_(w, CONTACT_VIEWERS) ? a.data.lien_he : undefined } : null;
  }
  if (!noAudit) audit_(w.email, 'xem', ma);
  return out;
}

/** Sửa đề/lời giải (bản biên tập) với khoá lạc quan: phải gửi kèm phien_ban đang xem. */
function saveText_(w, a) {
  need_(w, EDITORS);
  if (['de_bai', 'loi_giai'].indexOf(a.truong) < 0) throw new Error('Chỉ sửa được de_bai hoặc loi_giai.');
  if (!canSee_(w, a.ma_bai, assignedSet_(w))) throw new Error('Không có quyền sửa bài này.');
  var text = String(a.noi_dung == null ? '' : a.noi_dung);
  if (text.length > MAX_TEXT_) throw new Error('Văn bản quá dài (tối đa ' + MAX_TEXT_ + ' ký tự).');
  var res = withLock_(function () {
    var hit = findRow_('Problems', 'ma_bai', a.ma_bai);
    if (!hit) throw new Error('Không có bài');
    var cur = Number(hit.data.phien_ban || 0);
    if (Number(a.phien_ban) !== cur) throw new Error('Bài vừa được người khác sửa (phiên bản ' + cur + ') — bản của bạn CHƯA được lưu.');
    // không đổi gì thì không tăng phiên bản, không thêm lịch sử
    if (String(hit.data[a.truong]) === text) return { phien_ban: cur, khong_doi: true };
    var patch = { phien_ban: cur + 1, cap_nhat: now_(), nguoi_cap_nhat: w.email };
    patch[a.truong] = text;
    var sh = sheet_('Problems'), cols = SCHEMA.Problems, row = sh.getRange(hit.row, 1, 1, cols.length).getValues()[0];
    // ghi lại cả dòng: mọi ô (không chỉ ô sửa) phải qua cell_, kẻo ô khác bắt đầu bằng "=" thành công thức
    cols.forEach(function (c, j) { row[j] = cell_(patch[c] !== undefined ? patch[c] : row[j]); });
    sh.getRange(hit.row, 1, 1, cols.length).setValues([row]);
    sheet_('Revisions').appendRow(rowOf_('Revisions', { id: newId_(), ma_bai: a.ma_bai, truong: a.truong, phien_ban: cur + 1,
      cu: hit.data[a.truong], moi: text, email: w.email, ngay: now_() }));
    return { phien_ban: cur + 1, cap_nhat: patch.cap_nhat, nguoi_cap_nhat: w.email };
  });
  if (!res.khong_doi) audit_(w.email, 'sửa', a.ma_bai + ' ' + a.truong + ' → phiên bản ' + res.phien_ban);
  return res;
}

/**
 * Lịch sử sửa đề/lời giải của một bài (mới nhất trước). Chỉ những vai trò thấy mọi bài: lịch sử chứa các bản trước,
 * gần với bản gốc của tác giả, nên phản biện không được xem.
 */
function revisions_(w, ma) {
  if (!has_(w, ALL_PROBLEMS_VIEWERS) || !canSee_(w, ma, assignedSet_(w))) throw new Error('Không có quyền xem bài này.');
  if (!findRow_('Problems', 'ma_bai', ma)) throw new Error('Không có bài ' + ma);
  return rows_('Revisions').filter(function (r) { return r.ma_bai === ma; }).map(function (r) {
    return { id: r.id, truong: r.truong, phien_ban: Number(r.phien_ban) || 0, cu: r.cu, moi: r.moi, email: r.email, ngay: r.ngay };
  }).sort(function (x, y) { return y.phien_ban - x.phien_ban; });
}

function addComment_(w, a) {
  var assigned = assignedSet_(w);
  if (!canSee_(w, a.ma_bai, assigned)) throw new Error('Không có quyền.');
  if (!a.noi_dung || String(a.noi_dung).length > 20000) throw new Error('Nội dung trống hoặc quá dài.');
  var c = { id: newId_(), ma_bai: a.ma_bai, email: w.email, tra_loi_cho: a.tra_loi_cho || '', noi_dung: a.noi_dung, ngay: now_() };
  append_('Comments', c);
  return c;
}

function addProp_(w, tab, a) {
  need_(w, EDITORS.concat(['TBT']));
  if (tab === 'Conflicts' && CONFLICT_TYPES.indexOf(a.loai) < 0) throw new Error('Loại xung đột không hợp lệ.');
  var o = { id: newId_(), ma_bai: a.ma_bai, loai: a.loai, mo_ta: a.mo_ta, noi_dung: a.noi_dung, cach_giai_quyet: a.cach_giai_quyet || '',
            trang_thai: a.trang_thai || 'mở', nguoi: w.email, ngay: now_() };
  append_(tab, o);
  return o;
}

function setStatus_(w, a) {
  need_(w, ['PT', 'TBT', 'Quản trị']);
  if (STATUSES.indexOf(a.trang_thai) < 0) throw new Error('Trạng thái không hợp lệ.');
  var hit = findRow_('Problems', 'ma_bai', a.ma_bai);
  if (!hit) throw new Error('Không có bài');
  update_('Problems', hit.row, { trang_thai: a.trang_thai, cap_nhat: now_(), nguoi_cap_nhat: w.email });
  audit_(w.email, 'trạng thái', a.ma_bai + ' → ' + a.trang_thai);
  return true;
}
