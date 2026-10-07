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

function api(token, method, args) {
  var w = who_(token);
  args = args || {};
  switch (method) {
    case 'me': return { email: w.email, name: w.name, roles: w.roles, eff: w.eff };
    case 'listProblems': return listProblems_(w, args);
    case 'getProblem': return getProblem_(w, args.ma_bai);
    case 'saveText': return saveText_(w, args);
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
    if (a.email === w.email && open.indexOf(String(a.ky)) >= 0) set[a.ma_bai] = true;
  });
  return set;
}

function canSee_(w, ma, assigned) {
  if (has_(w, ALL_PROBLEMS_VIEWERS)) return true;
  return has_(w, ['PB']) && !!assigned[ma];
}

function hideAuthor_(w) {
  return !has_(w, ALL_PROBLEMS_VIEWERS) && PropertiesService.getScriptProperties().getProperty('BLIND_REVIEW') !== 'false';
}

function listProblems_(w, f) {
  var assigned = has_(w, ALL_PROBLEMS_VIEWERS) ? {} : assignedSet_(w);
  var authors = {};
  if (!hideAuthor_(w)) rows_('Authors').forEach(function (a) { authors[a.tac_gia_id] = a.ten_in; });
  var openChecks = countBy_('Checks', function (c) { return c.trang_thai !== 'xong'; });
  var openConfl = countBy_('Conflicts', function (c) { return String(c.trang_thai).indexOf('mở') >= 0 || String(c.trang_thai).indexOf('chờ') >= 0; });
  return rows_('Problems').filter(function (p) {
    return canSee_(w, p.ma_bai, assigned) &&
      (!f.chu_de || p.chu_de === f.chu_de) && (!f.muc || p.muc === f.muc) && (!f.trang_thai || p.trang_thai === f.trang_thai);
  }).map(function (p) {
    return { ma_bai: p.ma_bai, chu_de: p.chu_de, muc: p.muc, trang_thai: p.trang_thai, dang: p.dang, so_in: p.so_in,
             tac_gia: hideAuthor_(w) ? '' : (authors[p.tac_gia_id] || ''), checks: openChecks[p.ma_bai] || 0,
             conflicts: openConfl[p.ma_bai] || 0, de_bai: p.de_bai };
  });
}

function countBy_(tab, pred) {
  var m = {};
  rows_(tab).forEach(function (r) { if (pred(r)) m[r.ma_bai] = (m[r.ma_bai] || 0) + 1; });
  return m;
}

function getProblem_(w, ma) {
  var hit = findRow_('Problems', 'ma_bai', ma);
  if (!hit) throw new Error('Không có bài ' + ma);
  var assigned = has_(w, ALL_PROBLEMS_VIEWERS) ? {} : assignedSet_(w);
  if (!canSee_(w, ma, assigned)) throw new Error('Không có quyền xem bài này.');
  var p = hit.data, of = function (tab) { return rows_(tab).filter(function (r) { return r.ma_bai === ma; }); };
  var out = { problem: p, provenance: of('Provenance')[0] || null, corrections: of('Corrections'), checks: of('Checks'),
              conflicts: of('Conflicts'), log: of('ConversionLog'), comments: of('Comments'),
              canEdit: has_(w, EDITORS) };
  if (hideAuthor_(w)) { delete out.problem.tac_gia_id; out.author = null; }
  else {
    var a = findRow_('Authors', 'tac_gia_id', p.tac_gia_id);
    out.author = a ? { ten_in: a.data.ten_in, don_vi: a.data.don_vi, lien_he: has_(w, CONTACT_VIEWERS) ? a.data.lien_he : undefined } : null;
  }
  if (!has_(w, ALL_PROBLEMS_VIEWERS)) { delete out.problem.de_bai_goc; delete out.problem.loi_giai_goc; }
  audit_(w.email, 'xem', ma);
  return out;
}

/** Sửa đề/lời giải (bản biên tập) với khoá lạc quan: phải gửi kèm phien_ban đang xem. */
function saveText_(w, a) {
  need_(w, EDITORS);
  if (['de_bai', 'loi_giai'].indexOf(a.truong) < 0) throw new Error('Chỉ sửa được de_bai hoặc loi_giai.');
  return withLock_(function () {
    var hit = findRow_('Problems', 'ma_bai', a.ma_bai);
    if (!hit) throw new Error('Không có bài');
    var cur = Number(hit.data.phien_ban || 0);
    if (Number(a.phien_ban) !== cur) throw new Error('Bài vừa được người khác sửa (phiên bản ' + cur + '). Hãy tải lại rồi sửa tiếp.');
    var patch = { phien_ban: cur + 1, cap_nhat: now_(), nguoi_cap_nhat: w.email };
    patch[a.truong] = a.noi_dung;
    var sh = sheet_('Problems'), cols = SCHEMA.Problems, row = sh.getRange(hit.row, 1, 1, cols.length).getValues()[0];
    cols.forEach(function (c, j) { if (patch[c] !== undefined) row[j] = patch[c]; });
    sh.getRange(hit.row, 1, 1, cols.length).setValues([row]);
    sheet_('Revisions').appendRow(SCHEMA.Revisions.map(function (c) {
      return { id: newId_(), ma_bai: a.ma_bai, truong: a.truong, phien_ban: cur + 1, cu: hit.data[a.truong], moi: a.noi_dung, email: w.email, ngay: now_() }[c];
    }));
    return { phien_ban: cur + 1 };
  });
}

function addComment_(w, a) {
  var assigned = has_(w, ALL_PROBLEMS_VIEWERS) ? {} : assignedSet_(w);
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
