/**
 * API cho giao diện (google.script.run.api(token, method, args)).
 * Quy tắc "ai thấy gì":
 *  - PB chỉ thấy các bài được giao trong kỳ đang mở; nếu BLIND_REVIEW=true thì không thấy tên tác giả.
 *  - Thông tin liên hệ tác giả (tab Authors) chỉ VP, PT, TBT, Quản trị.
 *  - Sửa đề/lời giải: NCB, PT, Quản trị. Bản gốc của tác giả (de_bai_goc, loi_giai_goc) không ai sửa qua API.
 */
var EDITORS = ['NCB', 'PT', 'Quản trị'];
var PROP_EDITORS = EDITORS.concat(['TBT']);          // mục cần kiểm tra, xung đột, trạng thái sửa đổi
var STATUS_SETTERS = ['PT', 'TBT', 'Quản trị'];
var CONTACT_VIEWERS = ['VP', 'PT', 'TBT', 'Quản trị'];
var ALL_PROBLEMS_VIEWERS = ['TBT', 'PT', 'NCB', 'VP', 'BTK', 'Quản trị'];

var READ_ONLY_ = { me: 1, listProblems: 1, getProblem: 1, bundle: 1, revisions: 1, rounds: 1, boards: 1, closePreview: 1, exportOf: 1, figures: 1, figureSources: 1, intakeForm: 1 };
var MAX_TEXT_ = 45000;   // giới hạn một ô của Google Sheets là 50 000 ký tự; chừa chỗ cho dấu ' chặn công thức

function api(token, method, args) {
  READ_MEMO_ = READ_ONLY_[method] ? {} : null;
  FIG_INDEX_ = null;
  try {
    if (method === 'bundle') prefetch_(['Users', 'Problems', 'Authors', 'Rounds', 'Assignments', 'Provenance', 'Corrections',
                                        'Checks', 'Conflicts', 'ConversionLog', 'Comments', 'Reviews']);
    if (method === 'rounds') prefetch_(['Users', 'Rounds', 'Assignments', 'Reviews']);
    if (method === 'boards') prefetch_(['Users', 'Problems', 'Issues', 'Shortlist', 'Reviews', 'Checks', 'Conflicts', 'Rounds', 'Assignments']);
    if (method === 'closePreview' || method === 'exportOf') prefetch_(['Users', 'Problems', 'Authors', 'Issues', 'Shortlist', 'Checks', 'Conflicts', 'Published']);
    if (method === 'listProblems') prefetch_(['Users', 'Problems', 'Authors', 'Checks', 'Conflicts', 'Rounds', 'Assignments']);
    if (method === 'getProblem') prefetch_(['Users', 'Problems', 'Authors', 'Rounds', 'Assignments', 'Provenance', 'Corrections',
                                            'Checks', 'Conflicts', 'ConversionLog', 'Comments', 'Reviews']);
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
    case 'closeCheck': return closeCheck_(w, args);
    case 'resolveConflict': return resolveConflict_(w, args);
    case 'setCorrectionStatus': return setCorrectionStatus_(w, args);
    case 'setStatus': return setStatus_(w, args);
    case 'viewAs': return setViewAs_(w, args.role);
    case 'rounds': return roundsView_(w);
    case 'openRound': return openNewRound_(w, args);
    case 'assign': return assign_(w, args);
    case 'unassign': return unassign_(w, args);
    case 'setDeadline': return setDeadline_(w, args);
    case 'closeRound': return closeRound_(w, args);
    case 'releaseSolutions': return releaseSolutions_(w, args);
    case 'deleteRound': return deleteRound_(w, args);
    case 'sendInvites': return sendInvites_(w, args);
    case 'submitReview': return submitReview_(w, args);
    case 'markDone': return markDone_(w, args);
    case 'boards': return boardsView_(w);
    case 'newBoard': return newBoard_(w, args);
    case 'place': return placeProblem_(w, args);
    case 'unplace': return unplaceProblem_(w, args);
    case 'swap': return swapPositions_(w, args);
    case 'submitBoard': return submitBoard_(w, args);
    case 'approveBoard': return approveBoard_(w, args);
    case 'returnBoard': return returnBoard_(w, args);
    case 'reopenBoard': return reopenBoard_(w, args);
    case 'closePreview': return closePreview_(w, args);
    case 'figures': return figuresView_(w);
    case 'intakeForm': return intakeForm_(w);
    case 'addSubmission': return addSubmission_(w, args);
    case 'uploadPictures': return uploadPictures_(w, args);
    case 'figureSources': return figureSources_(w, args);
    case 'uploadFigures': return uploadFigures_(w, args);
    case 'closeIssue': return closeIssue_(w, args);
    case 'exportOf': return exportOf_(w, args);
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
  // bài luyện tập (THU-…) chỉ dành cho Quản trị, người được giao, và hai tài khoản thử (TEST_USERS) khi mang vai trò ban biên tập
  // (B14, B15: T1 = PT, T2 = TBT xếp đủ 10 bài luyện) — không lẫn vào danh sách của ban biên tập thật
  if (String(ma).indexOf('THU-') === 0) return w.roles.indexOf('Quản trị') >= 0 || !!assigned[ma] || (has_(w, ALL_PROBLEMS_VIEWERS) && practiceUser_(w));
  if (has_(w, ALL_PROBLEMS_VIEWERS)) return true;
  return has_(w, ['PB']) && !!assigned[ma];
}

/** Tài khoản thử (Script property TEST_USERS)? Tính một lần cho mỗi lời gọi. */
function practiceUser_(w) {
  if (w._thu === undefined) {
    w._thu = String(conf_('TEST_USERS') || '').split(',').map(function (x) { return x.trim().toLowerCase(); }).indexOf(w.email) >= 0;
  }
  return w._thu;
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
  var mine = {};
  myAssignments_(w).forEach(function (a) { mine[a.ma_bai] = a; });
  return rows_('Problems').filter(function (p) {
    return canSee_(w, p.ma_bai, assigned) &&
      (!f.chu_de || p.chu_de === f.chu_de) && (!f.muc || p.muc === f.muc) && (!f.trang_thai || p.trang_thai === f.trang_thai);
  }).map(function (p) {
    return { ma_bai: p.ma_bai, chu_de: p.chu_de, muc: p.muc, trang_thai: p.trang_thai, dang: p.dang, so_in: p.so_in,
             tac_gia: hideAuthor_(w) ? '' : (authors[p.tac_gia_id] || ''),
             checks: full ? (openChecks[p.ma_bai] || 0) : 0, conflicts: full ? (openConfl[p.ma_bai] || 0) : 0, de_bai: p.de_bai,
             giao: mine[p.ma_bai] || null };
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
            conflicts: of('Conflicts'), log: of('ConversionLog'), comments: commentRoles_(ma, of('Comments')), canEdit: has_(w, EDITORS),
            can: { status: has_(w, STATUS_SETTERS), props: has_(w, PROP_EDITORS), tbt: has_(w, ['TBT']) },
            lists: { statuses: STATUSES, reasonStatuses: REASON_STATUSES, conflictTypes: CONFLICT_TYPES, conflictStatuses: CONFLICT_STATUSES, tbtConflicts: TBT_CONFLICTS,
                     correctionStatuses: CORRECTION_STATUSES } };
  } else {
    // Phản biện chỉ nhận văn bản đã biên tập và thảo luận: nguồn, tên tệp, xung đột, sửa đổi có thể lộ tác giả.
    // … và lời giải chỉ khi PT đã mở lời giải cho kỳ phản biện của họ (Rounds.mo_loi_giai)
    var lgOpen = solutionOpen_(w, ma);
    out = { problem: { ma_bai: p.ma_bai, chu_de: p.chu_de, muc: p.muc, trang_thai: p.trang_thai, de_bai: p.de_bai,
                       loi_giai: lgOpen ? p.loi_giai : '', hinh: p.hinh, phien_ban: p.phien_ban }, loi_giai_an: !lgOpen,
            provenance: null, corrections: [], checks: [], conflicts: [], log: [], comments: of('Comments'), canEdit: false, limited: true };
  }
  if (hideAuthor_(w)) { delete out.problem.tac_gia_id; out.author = null; }
  else {
    var a = findRow_('Authors', 'tac_gia_id', p.tac_gia_id);
    out.author = a ? { ten_in: a.data.ten_in, don_vi: a.data.don_vi, lien_he: has_(w, CONTACT_VIEWERS) ? a.data.lien_he : undefined } : null;
  }
  // phiếu phản biện: ban biên tập xem mọi phiếu; người được giao xem (và sửa) phiếu của chính mình
  var revs = rows_('Reviews').filter(function (v) { return v.ma_bai === ma; });
  if (has_(w, REVIEW_READERS)) out.reviews = revs.map(function (v) {
    return { ky: String(v.ky), email: v.email, muc_de_nghi: v.muc_de_nghi, diem: v.diem, nhan_xet: v.nhan_xet, ngay: v.ngay };
  });
  out.mine = myAssignments_(w).filter(function (a) { return a.ma_bai === ma; }).map(function (a) {
    var v = revs.filter(function (x) { return String(x.ky) === a.ky && sameEmail_(x.email, w.email); })[0];
    a.review = v ? { muc_de_nghi: v.muc_de_nghi, diem: v.diem, nhan_xet: v.nhan_xet, ngay: v.ngay } : null;
    return a;
  });
  out.lists = out.lists || {};
  out.lists.recommendations = REVIEW_RECOMMENDATIONS; out.lists.levels = LEVELS;
  if (!full) out.comments = anonComments_(w, ma, out.comments);
  if (!noAudit) {
    out.hinh = figsFor_(out.problem);          // SVG / ảnh của bài (không gửi trong bundle: nặng, và trang luôn tải lại bài khi mở)
    audit_(w.email, 'xem', ma);
  }
  return out;
}

/**
 * Sửa đề/lời giải (bản biên tập) với khoá lạc quan: phải gửi kèm phien_ban đang xem.
 * Hai loại sửa (Nghĩa, 2026-10-07):
 *  - loai 'nho' (mặc định): chính tả, định dạng, thiếu dữ liệu… — chỉ ghi Revisions;
 *  - loai 'noi_dung': sửa nội dung toán (công thức sai, đáp số…) — bắt buộc vị trí và lý do, ghi thêm một dòng Corrections
 *    "chờ tác giả xác nhận" với đoạn trước/sau tự tách từ hai bản.
 */
function saveText_(w, a) {
  need_(w, EDITORS);
  if (['de_bai', 'loi_giai', 'hinh'].indexOf(a.truong) < 0) throw new Error('Chỉ sửa được de_bai, loi_giai hoặc hinh.');
  if (!canSee_(w, a.ma_bai, assignedSet_(w))) throw new Error('Không có quyền sửa bài này.');
  var text = String(a.noi_dung == null ? '' : a.noi_dung);
  if (text.length > MAX_TEXT_) throw new Error('Văn bản quá dài (tối đa ' + MAX_TEXT_ + ' ký tự).');
  if (a.truong === 'hinh') { var he = hinhError_(text); if (he) throw new Error(he); }
  var loai = a.loai || 'nho';
  if (['nho', 'noi_dung'].indexOf(loai) < 0) throw new Error('Loại sửa không hợp lệ.');
  var viTri = shortText_(a.vi_tri, 'Vị trí', 300, loai === 'noi_dung'), lyDo = shortText_(a.ly_do, 'Lý do', 2000, loai === 'noi_dung');
  var res = withLock_(function () {
    var hit = findRow_('Problems', 'ma_bai', a.ma_bai);
    if (!hit) throw new Error('Không có bài');
    var cur = Number(hit.data.phien_ban || 0);
    if (Number(a.phien_ban) !== cur) throw new Error('Bài vừa được người khác sửa (phiên bản ' + cur + ') — bản của bạn CHƯA được lưu.');
    // không đổi gì thì không tăng phiên bản, không thêm lịch sử
    if (String(hit.data[a.truong]) === text) return { phien_ban: cur, khong_doi: true };
    var r = writeText_(hit, a.truong, text, w.email);
    if (loai === 'noi_dung') {
      var d = changedSpan_(String(hit.data[a.truong] || ''), text);
      sheet_('Corrections').appendRow(rowOf_('Corrections', { id: newId_(), ma_bai: a.ma_bai,
        vi_tri: ({ de_bai: 'đề', loi_giai: 'lời giải', hinh: 'hình' })[a.truong] + ', ' + viTri, truoc: d.truoc, sau: d.sau, ly_do: lyDo,
        trang_thai: CORRECTION_STATUSES[0], nguoi: w.email, ngay: now_() }));
      r.sua_doi = true;
    }
    return r;
  });
  if (!res.khong_doi) audit_(w.email, 'sửa', a.ma_bai + ' ' + a.truong + ' → phiên bản ' + res.phien_ban + (res.sua_doi ? ' (nội dung toán)' : ''));
  return res;
}

/**
 * Ghi đề/lời giải mới vào dòng Problems (phải gọi trong withLock_), tăng phiên bản, thêm một dòng Revisions.
 * Ghi lại cả dòng: mọi ô (không chỉ ô sửa) phải qua cell_, kẻo ô khác bắt đầu bằng "=" thành công thức.
 * Dùng chung cho trang web (saveText_) và bản vá (applyCorrection_).
 */
function writeText_(hit, field, text, who) {
  var cur = Number(hit.data.phien_ban || 0), t = now_();
  var patch = { phien_ban: cur + 1, cap_nhat: t, nguoi_cap_nhat: who };
  patch[field] = text;
  var sh = sheet_('Problems'), cols = SCHEMA.Problems, row = sh.getRange(hit.row, 1, 1, cols.length).getValues()[0];
  cols.forEach(function (c, j) { row[j] = cell_(patch[c] !== undefined ? patch[c] : row[j]); });
  sh.getRange(hit.row, 1, 1, cols.length).setValues([row]);
  sheet_('Revisions').appendRow(rowOf_('Revisions', { id: newId_(), ma_bai: hit.data.ma_bai, truong: field, phien_ban: cur + 1,
    cu: hit.data[field], moi: text, email: who, ngay: t }));
  return { phien_ban: cur + 1, cap_nhat: t, nguoi_cap_nhat: who };
}

/** Đoạn khác nhau giữa hai bản (bỏ phần đầu và phần cuối giống nhau), kèm vài chữ hai bên để dễ tìm; mỗi phía tối đa 1000 ký tự. */
function changedSpan_(a, b) {
  var p = 0, n = Math.min(a.length, b.length);
  while (p < n && a.charAt(p) === b.charAt(p)) p++;
  var s = 0;
  while (s < n - p && a.charAt(a.length - 1 - s) === b.charAt(b.length - 1 - s)) s++;
  var CTX = 20, from = Math.max(0, p - CTX);
  while (from > 0 && /\S/.test(a.charAt(from - 1))) from--;                      // bắt đầu ở đầu một từ
  var cut = function (x) {
    var to = Math.min(x.length, x.length - s + CTX);
    while (to < x.length && /\S/.test(x.charAt(to))) to++;                          // kết thúc ở cuối một từ
    var t = (from > 0 ? '…' : '') + x.slice(from, to) + (to < x.length ? '…' : '');
    return t.length > 1000 ? t.slice(0, 999) + '…' : t;
  };
  return { truoc: cut(a), sau: cut(b) };
}

/** Chuỗi ngắn do người dùng gõ: cắt khoảng trắng, kiểm tra trống/độ dài. */
function shortText_(v, name, max, required) {
  var t = String(v == null ? '' : v).trim();
  if (required && !t) throw new Error(name + ' không được để trống.');
  if (t.length > max) throw new Error(name + ' quá dài (tối đa ' + max + ' ký tự).');
  return t;
}

/**
 * Phản biện thấy thảo luận của nhau nhưng ẩn danh (Nghĩa, 2026-10-07): bỏ email, thay bằng "Bạn", "Phản biện 1, 2…"
 * (theo thứ tự được giao bài này) hoặc "Ban biên tập".
 */
function anonComments_(w, ma, comments) {
  var order = [];
  rows_('Assignments').forEach(function (a) {
    var e = String(a.email).trim().toLowerCase();
    if (a.ma_bai === ma && e !== w.email && order.indexOf(e) < 0) order.push(e);
  });
  return comments.map(function (c) {
    var e = String(c.email).trim().toLowerCase(), k = order.indexOf(e);
    return { id: c.id, ma_bai: c.ma_bai, tra_loi_cho: c.tra_loi_cho, noi_dung: c.noi_dung, ngay: c.ngay,
             ai: e === w.email ? 'Bạn' : k >= 0 ? 'Phản biện ' + (k + 1) : 'Ban biên tập',
             vai: e === w.email || k >= 0 ? 'pb' : 'bbt' };
  });
}

/** Ban biên tập xem thảo luận: đánh dấu nhận xét của phản biện (người từng được giao bài này) để trang hiện khác nhận xét của ban biên tập. */
function commentRoles_(ma, comments) {
  var pb = {};
  rows_('Assignments').forEach(function (a) { if (a.ma_bai === ma) pb[String(a.email).trim().toLowerCase()] = true; });
  return comments.map(function (c) { c.vai = pb[String(c.email).trim().toLowerCase()] ? 'pb' : 'bbt'; return c; });
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

/** Bài phải tồn tại và người này phải thấy được (kiểm tra quyền TRƯỚC khi tra bài, như getProblem_). */
function needProblem_(w, ma) {
  if (!canSee_(w, ma, assignedSet_(w))) throw new Error('Không có quyền với bài này.');
  if (!findRow_('Problems', 'ma_bai', ma)) throw new Error('Không có bài ' + ma);
}

/** Dòng của một mục (Checks/Conflicts/Corrections) theo id; kiểm tra quyền trên bài của nó. */
function propRow_(w, tab, id) {
  var hit = findRow_(tab, 'id', id);
  if (!hit || !canSee_(w, hit.data.ma_bai, assignedSet_(w))) throw new Error('Không có mục này.');
  return hit;
}

function addProp_(w, tab, a) {
  need_(w, PROP_EDITORS);
  if (tab === 'Conflicts' && CONFLICT_TYPES.indexOf(a.loai) < 0) throw new Error('Loại xung đột không hợp lệ.');
  needProblem_(w, a.ma_bai);
  var text = shortText_(tab === 'Checks' ? a.noi_dung : a.mo_ta, tab === 'Checks' ? 'Nội dung' : 'Mô tả', 5000, true);
  var o = { id: newId_(), ma_bai: a.ma_bai, loai: a.loai, mo_ta: text, noi_dung: text, cach_giai_quyet: '',
            trang_thai: 'mở', nguoi: w.email, ngay: now_() };
  append_(tab, o);
  audit_(w.email, tab === 'Checks' ? 'thêm kiểm tra' : 'thêm xung đột', a.ma_bai + (a.loai ? ' (' + a.loai + ')' : ''));
  return o;
}

/** Đóng (hoặc mở lại) một mục cần kiểm tra; đóng thì phải ghi kết quả. */
function closeCheck_(w, a) {
  need_(w, PROP_EDITORS);
  var hit = propRow_(w, 'Checks', a.id);
  var st = a.trang_thai || 'xong';
  if (CHECK_STATUSES.indexOf(st) < 0) throw new Error('Trạng thái không hợp lệ.');
  var kq = shortText_(a.ket_qua, 'Kết quả', 5000, st === 'xong');
  update_('Checks', hit.row, { trang_thai: st, ket_qua: kq || hit.data.ket_qua });
  audit_(w.email, 'kiểm tra → ' + st, hit.data.ma_bai + ' ' + a.id);
  return true;
}

/**
 * Ghi cách giải quyết / đổi trạng thái một xung đột. Loại trong TBT_CONFLICTS (mức, tác giả, trùng bài) là quyết định của TBT:
 * người khác chỉ được chuyển sang "chờ TBT" hoặc mở lại.
 */
function resolveConflict_(w, a) {
  need_(w, PROP_EDITORS);
  var hit = propRow_(w, 'Conflicts', a.id);
  if (CONFLICT_STATUSES.indexOf(a.trang_thai) < 0) throw new Error('Trạng thái không hợp lệ.');
  var tbtOnly = TBT_CONFLICTS.indexOf(hit.data.loai) >= 0;
  if (tbtOnly && a.trang_thai === 'đã giải quyết' && !has_(w, ['TBT'])) throw new Error('Không có quyền: xung đột "' + hit.data.loai + '" do TBT quyết định.');
  var cach = shortText_(a.cach_giai_quyet, 'Cách giải quyết', 5000, a.trang_thai === 'đã giải quyết');
  update_('Conflicts', hit.row, { trang_thai: a.trang_thai, cach_giai_quyet: cach || hit.data.cach_giai_quyet });
  audit_(w.email, 'xung đột → ' + a.trang_thai, hit.data.ma_bai + ' ' + a.id + ' (' + hit.data.loai + ')');
  return true;
}

/** Trạng thái một sửa đổi (tác giả đồng ý / không đồng ý…). Không tự đổi văn bản: muốn trả lại bản cũ thì sửa như thường. */
function setCorrectionStatus_(w, a) {
  need_(w, PROP_EDITORS);
  var hit = propRow_(w, 'Corrections', a.id);
  if (CORRECTION_STATUSES.indexOf(a.trang_thai) < 0) throw new Error('Trạng thái không hợp lệ.');
  update_('Corrections', hit.row, { trang_thai: a.trang_thai });
  audit_(w.email, 'sửa đổi → ' + a.trang_thai, hit.data.ma_bai + ' ' + a.id);
  return true;
}

function setStatus_(w, a) {
  need_(w, STATUS_SETTERS);
  if (STATUSES.indexOf(a.trang_thai) < 0) throw new Error('Trạng thái không hợp lệ.');
  needProblem_(w, a.ma_bai);
  var lyDo = shortText_(a.ly_do, 'Lý do', 2000, REASON_STATUSES.indexOf(a.trang_thai) >= 0);
  var hit = findRow_('Problems', 'ma_bai', a.ma_bai), cu = hit.data.trang_thai, t = now_();
  if (cu === a.trang_thai) return true;
  update_('Problems', hit.row, { trang_thai: a.trang_thai, cap_nhat: t, nguoi_cap_nhat: w.email });
  // quyết định loại (hoặc đổi trạng thái có ghi lý do) lưu thành một mục đã đóng — hiện trong "Nguồn & chỉnh sửa" của bài
  if (lyDo) append_('Checks', { id: newId_(), ma_bai: a.ma_bai, noi_dung: 'Trạng thái: ' + (cu || '—') + ' → ' + a.trang_thai, trang_thai: 'xong',
                                nguoi: w.email, ngay: t, ket_qua: lyDo });
  audit_(w.email, 'trạng thái', a.ma_bai + ' → ' + a.trang_thai + (lyDo ? ' (' + lyDo + ')' : ''));
  return true;
}
