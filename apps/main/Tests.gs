/**
 * BỘ KIỂM THỬ TỰ ĐỘNG (phía máy chủ) — chạy từ trình soạn thảo bằng tài khoản quản trị:
 *   setupTests()   một lần: tạo Sheet "Pi ĐRKN — kiểm thử" (dữ liệu bịa, tách hẳn khỏi dữ liệu thật)
 *   runAllTests()  mỗi lần kiểm thử: chạy mọi kịch bản, ghi kết quả vào tab "Kết quả" và Execution log.
 *                  Nếu sắp hết 6 phút, dừng lại và báo — chạy lại runAllTests() để chạy tiếp phần còn lại.
 *   runTests('3')  chỉ chạy nhóm 3 (hoặc một kịch bản: runTests('3.6')).
 *
 * Ba tài khoản (giống trang "Testing the pipeline" của MCC):
 *   QT  = tài khoản chạy bộ kiểm thử (Nghĩa, chủ hệ thống)
 *   T1, T2 = hai tài khoản thử, lấy từ Script property TEST_USERS (hai địa chỉ, cách nhau dấu phẩy)
 *   LẠ  = một địa chỉ không có trong Users (khach.kiemthu@example.com)
 * Vai trò của mỗi người được đặt lại theo từng kịch bản, chỉ trong Sheet kiểm thử.
 *
 * Mọi đọc/ghi trong khi kiểm thử đi vào Sheet kiểm thử (DB_OVERRIDE); cấu hình thử qua TEST_CONF;
 * Script properties thật không bị đổi (trừ khoá tạm của nhập/vá, được xoá ngay sau đó).
 */

var TK = { tests: [], results: [], acc: null, t0: 0, render: null };
var TEST_BUDGET_MS = 5 * 60 * 1000;
var STRANGER = 'khach.kiemthu@example.com';
var FX_AUTHOR = 'Tác Giả Thử Nghiệm';
var FX_CONTACT = 'liên hệ riêng của tác giả thử';

function setupTests() {
  adminOnly_();
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('TEST_SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Pi ĐRKN — kiểm thử');
  ensureTabs_(ss);
  if (!ss.getSheetByName('Kết quả')) ss.insertSheet('Kết quả');
  props.setProperty('TEST_SHEET_ID', ss.getId());
  if (!props.getProperty('TEST_USERS')) Logger.log('Nhớ thêm Script property TEST_USERS = "<tài khoản thử 1>,<tài khoản thử 2>".');
  Logger.log('Sheet kiểm thử: ' + ss.getUrl());
}

function runAllTests() { return runTests(''); }

function runTests(filter) {
  adminOnly_();
  var props = PropertiesService.getScriptProperties();
  var sheetId = props.getProperty('TEST_SHEET_ID');
  if (!sheetId) throw new Error('Chưa chạy setupTests().');
  var users = String(props.getProperty('TEST_USERS') || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(String);
  if (users.length < 2) throw new Error('Thiếu Script property TEST_USERS (hai địa chỉ, cách nhau dấu phẩy).');
  TK.acc = { QT: Session.getEffectiveUser().getEmail().toLowerCase(), T1: users[0], T2: users[1], LA: STRANGER };
  TK.results = []; TK.t0 = Date.now();
  defineTests_();
  var cursorKey = 'TEST_CURSOR_' + (filter || 'all');
  var start = Number(props.getProperty(cursorKey) || 0);
  var list = TK.tests.filter(function (t) { return !filter || t.id === filter || t.id.indexOf(filter + '.') === 0; });
  DB_OVERRIDE = sheetId;
  TEST_CONF = { SECRET: Utilities.getUuid() + Utilities.getUuid(), BLIND_REVIEW: 'true', SIGNIN_URL: 'https://example.com/dang-nhap' };
  var i = start, stopped = false;
  try {
    if (start === 0) clearTab_('Audit');
    for (; i < list.length; i++) {
      if (Date.now() - TK.t0 > TEST_BUDGET_MS) { stopped = true; break; }
      runOne_(list[i]);
    }
  } finally {
    DB_OVERRIDE = null; TEST_CONF = null;
  }
  if (stopped) props.setProperty(cursorKey, String(i)); else props.deleteProperty(cursorKey);
  return report_(list.length, start, i, stopped, sheetId);
}

/* ---------------- khung chạy ---------------- */

function test_(id, title, who, fn, opts) { TK.tests.push({ id: id, title: title, who: who, fn: fn, fresh: !(opts && opts.keep) }); }

function runOne_(t) {
  var t1 = Date.now(), ok = true, msg = '';
  try {
    if (t.fresh) seed_();
    TEST_CONF.BLIND_REVIEW = 'true';
    t.fn();
  } catch (e) { ok = false; msg = String(e && e.message || e); }
  TK.results.push([t.id, t.title, t.who, ok ? 'ĐẠT' : 'LỖI', msg, Date.now() - t1]);
}

function report_(total, start, end, stopped, sheetId) {
  var ss = SpreadsheetApp.openById(sheetId), sh = ss.getSheetByName('Kết quả') || ss.insertSheet('Kết quả');
  if (start === 0) { sh.clear(); sh.appendRow(['Mã', 'Kịch bản', 'Tài khoản', 'Kết quả', 'Chi tiết', 'ms', 'Lúc']); sh.setFrozenRows(1); }
  var when = new Date().toISOString();
  if (TK.results.length) sh.getRange(sh.getLastRow() + 1, 1, TK.results.length, 7).setValues(TK.results.map(function (r) { return ["'" + r[0]].concat(r.slice(1).map(cell_), [when]); }));
  var fails = TK.results.filter(function (r) { return r[3] !== 'ĐẠT'; });
  TK.results.forEach(function (r) { Logger.log((r[3] === 'ĐẠT' ? 'ĐẠT ' : 'LỖI ') + r[0] + ' — ' + r[1] + (r[4] ? '\n      ' + r[4] : '')); });
  var msg = (stopped ? 'TẠM DỪNG (gần hết 6 phút) — chạy lại để tiếp tục: ' : 'XONG: ') + 'đã chạy ' + (end - start) + ' kịch bản (' +
            end + '/' + total + '), ' + fails.length + ' lỗi.';
  Logger.log(msg);
  return msg;
}

/* ---------------- kiểm tra ---------------- */

function ok_(cond, msg) { if (!cond) throw new Error(msg || 'điều kiện sai'); }
function eq_(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg || 'khác nhau') + ': nhận ' + JSON.stringify(a) + ', cần ' + JSON.stringify(b)); }
function has_s_(hay, needle, msg) { if (String(hay).indexOf(needle) < 0) throw new Error((msg || 'thiếu') + ': "' + needle + '"'); }
function lacks_(hay, needle, msg) { if (String(hay).indexOf(needle) >= 0) throw new Error((msg || 'không được có') + ': "' + needle + '"'); }
function throws_(fn, part) {
  try { fn(); } catch (e) { if (part && String(e.message).indexOf(part) < 0) throw new Error('lỗi khác dự kiến: ' + e.message + ' (cần chứa "' + part + '")'); return e; }
  throw new Error('lẽ ra phải bị từ chối' + (part ? ' ("' + part + '")' : ''));
}

/* ---------------- dữ liệu thử (bịa) ---------------- */

function clearTab_(name) { var sh = sheet_(name), n = sh.getLastRow(); if (n > 1) sh.getRange(2, 1, n - 1, sh.getLastColumn()).clearContent(); }

function putRows_(name, objs) {
  clearTab_(name);
  if (!objs.length) return;
  var cols = SCHEMA[name];
  sheet_(name).getRange(2, 1, objs.length, cols.length).setValues(objs.map(function (o) { return rowOf_(name, o); }));
}

/** Đặt lại toàn bộ dữ liệu thử. Vai trò mặc định: QT = Quản trị; T1 = PB; T2 = PB. */
function seed_(roles) {
  var A = TK.acc;
  roles = roles || { QT: 'Quản trị', T1: 'PB', T2: 'PB' };
  setUsers_(roles);
  var p = function (ma, chu_de, muc, tt, extra) {
    var o = { ma_bai: ma, ma_tam: '', chu_de: chu_de, muc: muc, trang_thai: tt, loai: 'bài', tac_gia_id: 'TG1',
              de_bai: 'Đề thử ' + ma + ': tính $1+1$.', loi_giai: 'Lời giải thử ' + ma + '.', de_bai_goc: 'Đề gốc ' + ma,
              loi_giai_goc: 'Lời giải gốc ' + ma, phien_ban: 1, cap_nhat: now_(), nguoi_cap_nhat: 'kiểm thử' };
    for (var k in extra) o[k] = extra[k];
    return o;
  };
  putRows_('Problems', [p('TEST-01', 'ĐS', 'A', 'Mới'), p('TEST-02', 'HH', 'B', 'SL'), p('TEST-03', 'SH', 'A', 'SL-OK'),
                        p('TEST-04', 'TH', 'B', 'Mới', { tac_gia_id: 'TG2' }), p('TEST-05', 'ĐS', 'B', 'PL')]);
  putRows_('Authors', [{ tac_gia_id: 'TG1', ten_in: FX_AUTHOR, don_vi: 'Trường Thử', lien_he: FX_CONTACT },
                       { tac_gia_id: 'TG2', ten_in: 'Người Viết Khác', don_vi: '', lien_he: '' }]);
  putRows_('Provenance', [{ ma_bai: 'TEST-01', thu_muc: '2026-01-01 ' + FX_AUTHOR, tep_goc: FX_AUTHOR + ' - bai 1.docx', ngay_nhan: '2026-01-01', kenh: 'email' }]);
  putRows_('Corrections', [{ id: 'c1', ma_bai: 'TEST-01', vi_tri: 'đề', truoc: 'x', sau: 'y', ly_do: 'thử', trang_thai: 'đã sửa', nguoi: A.QT, ngay: now_() }]);
  putRows_('Checks', [{ id: 'k1', ma_bai: 'TEST-01', noi_dung: 'mục cần kiểm tra thử (hỏi ' + FX_AUTHOR + ')', trang_thai: 'mở', nguoi: 'kiểm thử', ngay: now_() }]);
  putRows_('Conflicts', [{ id: 'x1', ma_bai: 'TEST-01', loai: 'tác giả', mo_ta: 'Tên in ' + FX_AUTHOR + ' khác tên trong tệp', trang_thai: 'mở', nguoi: 'kiểm thử', ngay: now_() }]);
  putRows_('ConversionLog', []);
  putRows_('Rounds', [{ ky: 'K-MO', trang_thai: 'mở' }, { ky: 'K-DONG', trang_thai: 'đóng' }]);
  putRows_('Assignments', [{ ky: 'K-MO', ma_bai: 'TEST-01', email: A.T1 }, { ky: 'K-MO', ma_bai: 'TEST-02', email: A.T1 },
                           { ky: 'K-MO', ma_bai: 'TEST-02', email: A.T2 }, { ky: 'K-DONG', ma_bai: 'TEST-03', email: A.T1 }]);
  ['Shortlist', 'Reviews', 'Comments', 'Published', 'Revisions', 'Audit'].forEach(function (t) { putRows_(t, []); });
}

/** roles: {QT:'…', T1:'…', T2:'…'}; '' = không có dòng; giá trị có thể kèm cờ {vai_tro, hoat_dong, email}. */
function setUsers_(roles) {
  var A = TK.acc, rows = [];
  ['QT', 'T1', 'T2'].forEach(function (k) {
    var r = roles[k];
    if (r === '' || r === undefined) return;
    if (typeof r === 'string') r = { vai_tro: r };
    rows.push({ email: r.email || A[k], ten: 'Người thử ' + k, vai_tro: r.vai_tro, hoat_dong: r.hoat_dong === undefined ? true : r.hoat_dong, ghi_chu: 'kiểm thử' });
  });
  putRows_('Users', rows);
}

/* ---------------- đăng nhập như thật ---------------- */

function signParams_(email, offsetMs) {
  var t = String(Date.now() + (offsetMs || 0));
  return { u: email, t: t, s: Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(email + '|' + t, TEST_CONF.SECRET)) };
}
function enter_(params) { return doGet({ parameter: params }).getContent(); }
/** Đi đúng đường của người dùng: liên kết đã ký → doGet → lấy token trong trang. */
function login_(email) {
  var html = enter_(signParams_(email));
  var m = html.match(/var TOKEN = ["']?([\w-]{20,})/);
  if (!m) throw new Error('không vào được hệ thống với ' + email + ': ' + html.replace(/<[^>]+>/g, ' ').slice(0, 160));
  return m[1];
}
/** Gọi API như trình duyệt. Kiểm tra luôn: kết quả phải là JSON thuần (google.script.run trả null nếu có Date…). */
function call_(tok, method, args) {
  var r = api(tok, method, args || {});
  (function walk(x, path) {
    if (x === null || typeof x !== 'object') { if (typeof x === 'function') throw new Error('kết quả có hàm ở ' + path); return; }
    if (Object.prototype.toString.call(x) === '[object Date]') throw new Error('kết quả có kiểu Date ở ' + path + ' — trình duyệt sẽ nhận null');
    Object.keys(x).forEach(function (k) { walk(x[k], path + '.' + k); });
  })(r, method);
  return r;
}
function codes_(list) { return list.map(function (p) { return p.ma_bai; }).sort(); }
function auditHas_(action, detailPart) {
  return rows_('Audit').some(function (a) { return a.hanh_dong === action && (!detailPart || String(a.chi_tiet).indexOf(detailPart) >= 0); });
}

/* ---------------- các kịch bản ---------------- */

function defineTests_() {
  TK.tests = [];
  var A = TK.acc;

  // 1. Vào hệ thống
  test_('1.1', 'Liên kết đăng nhập đúng đưa người dùng vào hệ thống', 'QT', function () {
    var html = enter_(signParams_(A.QT));
    has_s_(html, 'var TOKEN = ', 'trang chính phải có phiên');
    ok_(auditHas_('đăng nhập'), 'phải ghi nhật ký đăng nhập');
  });
  test_('1.2', 'Chữ ký bị sửa thì bị từ chối', 'LẠ', function () {
    var p = signParams_(A.QT); p.s = p.s.slice(0, -2) + (p.s.slice(-2) === 'AA' ? 'BB' : 'AA');
    var html = enter_(p); lacks_(html, 'var TOKEN', 'không được cấp phiên'); has_s_(html, 'không hợp lệ');
  });
  test_('1.3', 'Lấy chữ ký của T1 để vào bằng địa chỉ QT thì bị từ chối', 'T1', function () {
    var p = signParams_(A.T1); p.u = A.QT;
    lacks_(enter_(p), 'var TOKEN');
  });
  test_('1.4', 'Liên kết quá 10 phút bị từ chối và có nút Đăng nhập lại', 'QT', function () {
    var html = enter_(signParams_(A.QT, -11 * 60 * 1000));
    lacks_(html, 'var TOKEN'); has_s_(html, 'Đăng nhập lại'); has_s_(html, TEST_CONF.SIGNIN_URL);
  });
  test_('1.5', 'Đồng hồ lệch vài giây vẫn vào được; liên kết "từ tương lai" 5 phút bị từ chối', 'QT', function () {
    has_s_(enter_(signParams_(A.QT, 30 * 1000)), 'var TOKEN');
    lacks_(enter_(signParams_(A.QT, 5 * 60 * 1000)), 'var TOKEN');
  });
  test_('1.6', 'Mở thẳng địa chỉ ứng dụng chính (không có liên kết) bị từ chối', 'LẠ', function () {
    lacks_(enter_({}), 'var TOKEN'); lacks_(enter_({ u: A.QT }), 'var TOKEN');
  });
  test_('1.7', 'Người lạ (không có trong Users) bị từ chối và ghi nhật ký', 'LẠ', function () {
    var html = enter_(signParams_(A.LA));
    lacks_(html, 'var TOKEN'); has_s_(html, 'chưa có vai trò'); ok_(auditHas_('từ chối', ''), 'phải ghi nhật ký từ chối');
  });
  test_('1.8', 'Tài khoản tạm ngưng (hoat_dong = FALSE) bị từ chối', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: { vai_tro: 'PB', hoat_dong: 'FALSE' }, T2: 'PB' });
    lacks_(enter_(signParams_(A.T1)), 'var TOKEN');
  });
  test_('1.9', 'Có dòng trong Users nhưng chưa có vai trò thì bị từ chối', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: { vai_tro: '' }, T2: 'PB' });
    lacks_(enter_(signParams_(A.T1)), 'var TOKEN');
  });
  test_('1.10', 'Email gõ tay có chữ hoa/khoảng trắng trong Users vẫn nhận ra', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: { vai_tro: 'PB', email: '  ' + A.T1.toUpperCase() + ' ' }, T2: 'PB' });
    has_s_(enter_(signParams_(A.T1)), 'var TOKEN');
  });

  // 2. Phiên làm việc
  test_('2.1', 'Token bịa không gọi được API', 'LẠ', function () {
    throws_(function () { call_('token-bia', 'me'); }, 'hết hạn');
  });
  test_('2.2', 'Bị tạm ngưng giữa chừng: lời gọi tiếp theo bị từ chối ngay', 'T1', function () {
    var tok = login_(A.T1);
    call_(tok, 'me');
    setUsers_({ QT: 'Quản trị', T1: { vai_tro: 'PB', hoat_dong: false }, T2: 'PB' });
    throws_(function () { call_(tok, 'me'); }, 'chưa có vai trò');
  });
  test_('2.3', 'Đổi vai trò có hiệu lực ngay, không cần đăng nhập lại', 'T1', function () {
    var tok = login_(A.T1);
    throws_(function () { call_(tok, 'getProblem', { ma_bai: 'TEST-04' }); }, 'Không có quyền');
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    eq_(call_(tok, 'getProblem', { ma_bai: 'TEST-04' }).problem.ma_bai, 'TEST-04');
  });
  test_('2.4', 'Hai người đăng nhập cùng lúc có phiên riêng', 'T1+T2', function () {
    var a = login_(A.T1), b = login_(A.T2);
    ok_(a !== b, 'token phải khác nhau');
    eq_(call_(a, 'me').email, A.T1); eq_(call_(b, 'me').email, A.T2);
  });

  // 3. Ai thấy gì
  test_('3.1', 'Quản trị thấy mọi bài kèm tên tác giả', 'QT', function () {
    var l = call_(login_(A.QT), 'listProblems');
    eq_(codes_(l), ['TEST-01', 'TEST-02', 'TEST-03', 'TEST-04', 'TEST-05']);
    eq_(l.filter(function (p) { return p.ma_bai === 'TEST-01'; })[0].tac_gia, FX_AUTHOR);
  });
  test_('3.2', 'TBT, PT, VP xem được liên hệ tác giả; NCB, BTK thì không', 'T1', function () {
    [['TBT', true], ['PT', true], ['VP', true], ['NCB', false], ['BTK', false]].forEach(function (c) {
      setUsers_({ QT: 'Quản trị', T1: c[0], T2: 'PB' });
      var d = call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-01' });
      eq_(d.author.ten_in, FX_AUTHOR, c[0] + ' thấy tên tác giả');
      eq_(d.author.lien_he === FX_CONTACT, c[1], c[0] + ' thấy liên hệ?');
    });
  });
  test_('3.3', 'Phản biện khi chưa có kỳ nào mở: không thấy bài nào', 'T1', function () {
    putRows_('Rounds', [{ ky: 'K-MO', trang_thai: 'đóng' }, { ky: 'K-DONG', trang_thai: 'đóng' }]);
    eq_(call_(login_(A.T1), 'listProblems').length, 0);
  });
  test_('3.4', 'Phản biện chỉ thấy bài được giao trong kỳ đang mở', 'T1+T2', function () {
    eq_(codes_(call_(login_(A.T1), 'listProblems')), ['TEST-01', 'TEST-02'], 'T1 (TEST-03 thuộc kỳ đã đóng)');
    eq_(codes_(call_(login_(A.T2), 'listProblems')), ['TEST-02'], 'T2');
  });
  test_('3.5', 'Phản biện mở bài không được giao — và bài không tồn tại — nhận cùng một câu từ chối', 'T2', function () {
    var tok = login_(A.T2);
    var e1 = throws_(function () { call_(tok, 'getProblem', { ma_bai: 'TEST-01' }); }, 'Không có quyền');
    var e2 = throws_(function () { call_(tok, 'getProblem', { ma_bai: 'KHONG-CO' }); }, 'Không có quyền');
    eq_(e1.message, e2.message, 'không được lộ bài nào tồn tại');
  });
  test_('3.6', 'Chấm ẩn danh: dữ liệu gửi cho phản biện không chứa tên tác giả ở bất cứ đâu', 'T1', function () {
    var tok = login_(A.T1);
    var all = JSON.stringify(call_(tok, 'listProblems')) + JSON.stringify(call_(tok, 'getProblem', { ma_bai: 'TEST-01' }));
    lacks_(all, FX_AUTHOR, 'lộ tên tác giả'); lacks_(all, 'TG1', 'lộ mã tác giả'); lacks_(all, '.docx', 'lộ tên tệp gốc');
  });
  test_('3.7', 'Tắt chấm ẩn danh (BLIND_REVIEW=false): phản biện thấy tên tác giả, vẫn không thấy nguồn/xung đột', 'T1', function () {
    TEST_CONF.BLIND_REVIEW = 'false';
    var d = call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-01' });
    eq_(d.author.ten_in, FX_AUTHOR); eq_(d.author.lien_he, undefined, 'không có liên hệ');
    eq_(d.provenance, null); eq_(d.conflicts.length, 0);
  });
  test_('3.8', 'Phản biện không nhận bản gốc của tác giả, mục cần kiểm tra, sửa đổi', 'T1', function () {
    var d = call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-01' });
    eq_(d.problem.de_bai_goc, undefined); eq_(d.problem.loi_giai_goc, undefined);
    eq_(d.checks.length + d.corrections.length + d.log.length, 0);
    var l = call_(login_(A.T1), 'listProblems'); eq_(l[0].checks + l[0].conflicts + l[1].checks + l[1].conflicts, 0, 'không lộ số mục');
  });
  test_('3.12', 'Tải gộp (bundle) cho trang: đúng như từng bài — phản biện chỉ bài được giao, ẩn danh; không có bản gốc', 'T1+QT', function () {
    var b = call_(login_(A.T1), 'bundle', {});
    eq_(codes_(b.rows), ['TEST-01', 'TEST-02']); eq_(Object.keys(b.details).sort(), ['TEST-01', 'TEST-02']);
    lacks_(JSON.stringify(b), FX_AUTHOR, 'lộ tên tác giả'); lacks_(JSON.stringify(b), '.docx', 'lộ tên tệp');
    ok_(b.details['TEST-01'].limited, 'phản biện nhận bản rút gọn');
    var q = call_(login_(A.QT), 'bundle', {});
    eq_(Object.keys(q.details).length, 5); eq_(q.details['TEST-01'].author.ten_in, FX_AUTHOR);
    eq_(q.details['TEST-01'].problem.de_bai_goc, undefined, 'không gửi bản gốc'); eq_(q.details['TEST-01'].checks.length, 1);
    ok_(!rows_('Audit').some(function (a) { return a.hanh_dong === 'xem'; }), 'tải gộp không tính là mở bài');
  });
  test_('3.9', 'Bộ lọc chủ đề / mức / trạng thái', 'QT', function () {
    var tok = login_(A.QT);
    eq_(codes_(call_(tok, 'listProblems', { chu_de: 'ĐS' })), ['TEST-01', 'TEST-05']);
    eq_(codes_(call_(tok, 'listProblems', { muc: 'A' })), ['TEST-01', 'TEST-03']);
    eq_(codes_(call_(tok, 'listProblems', { trang_thai: 'Mới' })), ['TEST-01', 'TEST-04']);
    eq_(codes_(call_(tok, 'listProblems', { chu_de: 'ĐS', muc: 'B' })), ['TEST-05']);
  });
  test_('3.10', 'Phân công gõ email có chữ hoa vẫn có hiệu lực', 'T2', function () {
    putRows_('Assignments', [{ ky: 'K-MO', ma_bai: 'TEST-04', email: ' ' + A.T2.toUpperCase() }]);
    eq_(codes_(call_(login_(A.T2), 'listProblems')), ['TEST-04']);
  });
  test_('3.11', 'Người có hai vai trò (PB + NCB) nhận quyền rộng hơn', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'PB, NCB', T2: 'PB' });
    eq_(call_(login_(A.T1), 'listProblems').length, 5);
  });

  // 4. Sửa đề / lời giải
  test_('4.1', 'Người chuẩn bị bài sửa đề: phiên bản tăng, lưu lịch sử, bản gốc không đổi', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1);
    eq_(call_(tok, 'saveText', { ma_bai: 'TEST-01', truong: 'de_bai', noi_dung: 'Đề đã sửa.', phien_ban: 1 }).phien_ban, 2);
    var p = findRow_('Problems', 'ma_bai', 'TEST-01').data;
    eq_(p.de_bai, 'Đề đã sửa.'); eq_(p.de_bai_goc, 'Đề gốc TEST-01', 'bản gốc giữ nguyên'); eq_(p.nguoi_cap_nhat, A.T1);
    var r = rows_('Revisions'); eq_(r.length, 1); eq_(r[0].cu, 'Đề thử TEST-01: tính $1+1$.'); eq_(r[0].moi, 'Đề đã sửa.');
  });
  test_('4.2', 'Hai người sửa cùng lúc: người lưu sau được báo, không ghi đè', 'T1+T2', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'NCB' });
    var a = login_(A.T1), b = login_(A.T2);
    var va = call_(a, 'getProblem', { ma_bai: 'TEST-02' }).problem.phien_ban, vb = call_(b, 'getProblem', { ma_bai: 'TEST-02' }).problem.phien_ban;
    call_(a, 'saveText', { ma_bai: 'TEST-02', truong: 'loi_giai', noi_dung: 'Bản của T1', phien_ban: va });
    throws_(function () { call_(b, 'saveText', { ma_bai: 'TEST-02', truong: 'loi_giai', noi_dung: 'Bản của T2', phien_ban: vb }); }, 'người khác sửa');
    eq_(findRow_('Problems', 'ma_bai', 'TEST-02').data.loi_giai, 'Bản của T1');
  });
  test_('4.3', 'PB, TBT, VP, BTK không sửa được đề', 'T1', function () {
    ['PB', 'TBT', 'VP', 'BTK'].forEach(function (r) {
      setUsers_({ QT: 'Quản trị', T1: r, T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'saveText', { ma_bai: 'TEST-01', truong: 'de_bai', noi_dung: 'x', phien_ban: 1 }); }, 'Không có quyền');
    });
    eq_(findRow_('Problems', 'ma_bai', 'TEST-01').data.de_bai, 'Đề thử TEST-01: tính $1+1$.');
  });
  test_('4.4', 'Không ai sửa được bản gốc của tác giả hay trường khác qua API', 'QT', function () {
    var tok = login_(A.QT);
    ['de_bai_goc', 'loi_giai_goc', 'tac_gia_id', 'trang_thai'].forEach(function (f) {
      throws_(function () { call_(tok, 'saveText', { ma_bai: 'TEST-01', truong: f, noi_dung: 'x', phien_ban: 1 }); }, 'Chỉ sửa được');
    });
  });
  test_('4.5', 'Sửa bài không tồn tại bị từ chối', 'QT', function () {
    throws_(function () { call_(login_(A.QT), 'saveText', { ma_bai: 'KHONG-CO', truong: 'de_bai', noi_dung: 'x', phien_ban: 1 }); }, 'Không có bài');
  });

  test_('4.6', 'Lịch sử sửa: người chuẩn bị bài xem được (mới nhất trước); phản biện không xem được, kể cả bài được giao', 'T1+T2', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1);
    call_(tok, 'saveText', { ma_bai: 'TEST-02', truong: 'de_bai', noi_dung: 'Đề lần 1.', phien_ban: 1 });
    call_(tok, 'saveText', { ma_bai: 'TEST-02', truong: 'loi_giai', noi_dung: 'Lời giải lần 2.', phien_ban: 2 });
    var h = call_(tok, 'revisions', { ma_bai: 'TEST-02' });
    eq_(h.map(function (r) { return r.phien_ban; }), [3, 2], 'mới nhất trước');
    eq_(h[0].truong, 'loi_giai'); eq_(h[0].moi, 'Lời giải lần 2.'); eq_(h[1].cu, 'Đề thử TEST-02: tính $1+1$.'); eq_(h[1].email, A.T1);
    eq_(call_(tok, 'revisions', { ma_bai: 'TEST-01' }).length, 0, 'bài khác không lẫn vào');
    var pb = login_(A.T2);
    var e1 = throws_(function () { call_(pb, 'revisions', { ma_bai: 'TEST-02' }); }, 'Không có quyền');
    var e2 = throws_(function () { call_(pb, 'revisions', { ma_bai: 'KHONG-CO' }); }, 'Không có quyền');
    eq_(e1.message, e2.message, 'không phân biệt được bài không tồn tại');
    throws_(function () { call_(login_(A.QT), 'revisions', { ma_bai: 'KHONG-CO' }); }, 'Không có bài');
  });
  test_('4.7', 'Lưu mà không đổi gì: phiên bản giữ nguyên, không thêm lịch sử', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var r = call_(login_(A.T1), 'saveText', { ma_bai: 'TEST-01', truong: 'de_bai', noi_dung: 'Đề thử TEST-01: tính $1+1$.', phien_ban: 1 });
    eq_(r.phien_ban, 1); ok_(r.khong_doi, 'phải báo không đổi');
    eq_(Number(findRow_('Problems', 'ma_bai', 'TEST-01').data.phien_ban), 1); eq_(rows_('Revisions').length, 0);
  });
  test_('4.8', 'Văn bản quá dài (gần giới hạn một ô của Sheets) bị từ chối, bài không đổi', 'QT', function () {
    throws_(function () { call_(login_(A.QT), 'saveText', { ma_bai: 'TEST-01', truong: 'loi_giai', noi_dung: new Array(MAX_TEXT_ + 2).join('a'), phien_ban: 1 }); }, 'quá dài');
    eq_(findRow_('Problems', 'ma_bai', 'TEST-01').data.loi_giai, 'Lời giải thử TEST-01.');
  });
  test_('4.9', 'Sửa đề hay đổi trạng thái không biến ô khác bắt đầu bằng "=" thành công thức', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1);
    call_(tok, 'saveText', { ma_bai: 'TEST-03', truong: 'loi_giai', noi_dung: '=1+1 là đáp số.', phien_ban: 1 });
    call_(tok, 'saveText', { ma_bai: 'TEST-03', truong: 'de_bai', noi_dung: 'Đề mới.', phien_ban: 2 });
    var hit = findRow_('Problems', 'ma_bai', 'TEST-03');
    eq_(hit.data.loi_giai, '=1+1 là đáp số.');
    eq_(sheet_('Problems').getRange(hit.row, SCHEMA.Problems.indexOf('loi_giai') + 1).getFormula(), '', 'ô lời giải không được thành công thức');
    call_(login_(A.QT), 'setStatus', { ma_bai: 'TEST-03', trang_thai: 'SL' });
    eq_(findRow_('Problems', 'ma_bai', 'TEST-03').data.loi_giai, '=1+1 là đáp số.', 'sau khi đổi trạng thái');
    eq_(sheet_('Problems').getRange(hit.row, SCHEMA.Problems.indexOf('loi_giai') + 1).getFormula(), '', 'đổi trạng thái không được tạo công thức');
  });
  test_('4.10', 'Người chuẩn bị bài không sửa được bài luyện tập (không thấy thì không sửa)', 'T1', function () {
    resetPractice();
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    putRows_('Assignments', []);
    throws_(function () { call_(login_(A.T1), 'saveText', { ma_bai: 'THU-01', truong: 'de_bai', noi_dung: 'x', phien_ban: 1 }); }, 'Không có quyền');
    eq_(rows_('Revisions').length, 0);
  });
  test_('4.11', 'Mỗi lần sửa được ghi vào nhật ký (ai, bài, phiên bản)', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    call_(login_(A.T1), 'saveText', { ma_bai: 'TEST-04', truong: 'de_bai', noi_dung: 'Đề sửa.', phien_ban: 1 });
    ok_(auditHas_('sửa', 'TEST-04 de_bai → phiên bản 2'));
  });

  // 5. Thảo luận
  test_('5.1', 'Phản biện nhận xét bài được giao; người khác cùng được giao và quản trị thấy nhận xét', 'T1+T2', function () {
    call_(login_(A.T1), 'addComment', { ma_bai: 'TEST-02', noi_dung: 'Nhận xét của T1: $x^2$' });
    eq_(call_(login_(A.T2), 'getProblem', { ma_bai: 'TEST-02' }).comments.length, 1);
    eq_(call_(login_(A.QT), 'getProblem', { ma_bai: 'TEST-02' }).comments[0].email, A.T1);
  });
  test_('5.2', 'Phản biện không nhận xét được bài không được giao', 'T2', function () {
    throws_(function () { call_(login_(A.T2), 'addComment', { ma_bai: 'TEST-01', noi_dung: 'x' }); }, 'Không có quyền');
    eq_(rows_('Comments').length, 0);
  });
  test_('5.3', 'Nhận xét trống hoặc quá dài bị từ chối', 'T1', function () {
    var tok = login_(A.T1);
    throws_(function () { call_(tok, 'addComment', { ma_bai: 'TEST-01', noi_dung: '' }); }, 'trống');
    throws_(function () { call_(tok, 'addComment', { ma_bai: 'TEST-01', noi_dung: new Array(20002).join('a') }); }, 'quá dài');
  });
  test_('5.4', 'Nhận xét chứa mã độc (<script>, <img onerror>) được lưu nguyên văn nhưng hiển thị vô hại', 'T1', function () {
    var bad = 'Xem <img src=x onerror=alert(1)> <script>alert(2)</script> $</span><script>alert(3)</script>$';
    call_(login_(A.T1), 'addComment', { ma_bai: 'TEST-01', noi_dung: bad });
    var html = renderInGas_(rows_('Comments')[0].noi_dung);
    lacks_(html, '<img', 'thẻ img lọt qua'); lacks_(html, '<script', 'thẻ script lọt qua');
    has_s_(html, '&lt;img');
  });

  test_('5.5', 'Nhận xét bắt đầu bằng "=" được lưu như chữ, không thành công thức trong Sheet', 'T1', function () {
    call_(login_(A.T1), 'addComment', { ma_bai: 'TEST-01', noi_dung: '=IMPORTXML("https://example.com","//a")' });
    eq_(rows_('Comments')[0].noi_dung, '=IMPORTXML("https://example.com","//a")');
    eq_(sheet_('Comments').getRange(2, 5).getFormula(), '', 'ô không được chứa công thức');
  });

  // 6. Mục cần kiểm tra, xung đột, trạng thái
  test_('6.1', 'NCB và TBT thêm mục cần kiểm tra; PB, VP, BTK thì không', 'T1', function () {
    [['NCB', true], ['TBT', true], ['PB', false], ['VP', false], ['BTK', false]].forEach(function (c) {
      setUsers_({ QT: 'Quản trị', T1: c[0], T2: 'PB' });
      var f = function () { call_(login_(A.T1), 'addCheck', { ma_bai: 'TEST-01', noi_dung: 'kiểm tra của ' + c[0] }); };
      if (c[1]) f(); else throws_(f, 'Không có quyền');
    });
    eq_(rows_('Checks').length, 3);
  });
  test_('6.2', 'Xung đột phải thuộc một trong 7 loại', 'QT', function () {
    var tok = login_(A.QT);
    throws_(function () { call_(tok, 'addConflict', { ma_bai: 'TEST-01', loai: 'linh tinh', mo_ta: 'x' }); }, 'Loại xung đột');
    CONFLICT_TYPES.forEach(function (t) { call_(tok, 'addConflict', { ma_bai: 'TEST-01', loai: t, mo_ta: 'thử ' + t }); });
    eq_(rows_('Conflicts').length, 1 + CONFLICT_TYPES.length);
  });
  test_('6.3', 'Đổi trạng thái: PT, TBT, Quản trị được; NCB, PB không; trạng thái lạ bị từ chối; có nhật ký', 'T1', function () {
    [['PT', true], ['TBT', true], ['NCB', false], ['PB', false]].forEach(function (c) {
      setUsers_({ QT: 'Quản trị', T1: c[0], T2: 'PB' });
      var f = function () { call_(login_(A.T1), 'setStatus', { ma_bai: 'TEST-04', trang_thai: 'SL' }); };
      if (c[1]) f(); else throws_(f, 'Không có quyền');
    });
    throws_(function () { call_(login_(A.QT), 'setStatus', { ma_bai: 'TEST-04', trang_thai: 'Đăng luôn' }); }, 'không hợp lệ');
    eq_(findRow_('Problems', 'ma_bai', 'TEST-04').data.trang_thai, 'SL'); ok_(auditHas_('trạng thái', 'TEST-04'));
  });
  test_('6.4', 'Thao tác không có trong API bị từ chối', 'QT', function () {
    throws_(function () { call_(login_(A.QT), 'xoaHet', {}); }, 'Không có thao tác');
  });

  // 7. Xem như vai trò
  test_('7.1', 'Quản trị "xem như PB" thấy đúng như phản biện, rồi trở lại', 'QT', function () {
    putRows_('Assignments', [{ ky: 'K-MO', ma_bai: 'TEST-05', email: A.QT }]);
    var tok = login_(A.QT);
    call_(tok, 'viewAs', { role: 'PB' });
    eq_(call_(tok, 'me').eff, ['PB']);
    var l = call_(tok, 'listProblems'); eq_(codes_(l), ['TEST-05']); eq_(l[0].tac_gia, '', 'ẩn tác giả');
    call_(tok, 'viewAs', { role: '' });
    eq_(call_(tok, 'listProblems').length, 5);
  });
  test_('7.2', 'Người không phải Quản trị không dùng được "xem như"', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'viewAs', { role: 'Quản trị' }); }, 'Chỉ Quản trị');
  });
  test_('7.3', 'Vai trò lạ bị từ chối', 'QT', function () {
    throws_(function () { call_(login_(A.QT), 'viewAs', { role: 'Siêu quản trị' }); }, 'không hợp lệ');
  });

  // 8. Nhập hàng loạt và bản vá
  test_('8.1', 'Nhập hàng loạt hai lần: lần hai bỏ qua hết, tác giả không bị nhân đôi', 'QT', function () {
    putRows_('Problems', []); putRows_('Authors', []); putRows_('Provenance', []); putRows_('Checks', []);
    var items = [1, 2, 3].map(function (k) {
      return { problem: { ma_bai: 'NHAP-0' + k, chu_de: 'ĐS', muc: 'A', trang_thai: 'Mới', de_bai: 'Đề nhập ' + k, loi_giai: '', de_bai_goc: 'g' },
               author: { ten_in: 'Tác Giả Nhập', don_vi: 'Trường Nhập' }, provenance: { tep_goc: 'tep' + k + '.docx' }, checks: ['kiểm tra ' + k] };
    });
    var f = DriveApp.createFile('pi-drkn-kiemthu-nhap.json', JSON.stringify(items), 'application/json');
    try {
      has_s_(importBatch(f.getId()), 'xong: 3/3 (thêm 3');
      has_s_(importBatch(f.getId()), 'bỏ qua 3');
    } finally { f.setTrashed(true); }
    eq_(rows_('Problems').length, 3); eq_(rows_('Authors').length, 1); eq_(rows_('Checks').length, 3); eq_(rows_('Provenance').length, 3);
  });
  test_('8.2', 'Bản vá: sửa đúng một chỗ, ghi Corrections + Revisions, giữ bản gốc; chạy lại không nhân đôi', 'QT', function () {
    var patch = { id: 'kiemthu-' + Utilities.getUuid().slice(0, 6), nguoi: 'kiểm thử', ops: [
      { op: 'check', ma_bai: 'TEST-03', noi_dung: 'kiểm tra từ bản vá' },
      { op: 'review', ma_bai: 'TEST-03', ky: 'đọc thử', diem: 'Đúng', nhan_xet: 'ổn' },
      { op: 'correction', ma_bai: 'TEST-03', truong: 'de_bai', truoc: '$1+1$', sau: '$1+2$', vi_tri: 'đề', ly_do: 'thử' },
      { op: 'closeCheck', ma_bai: 'TEST-01', chua: 'mục cần kiểm tra thử', trang_thai: 'xong' }] };
    try {
      has_s_(applyPatch_(patch, A.QT), 'xong: 4/4');
      has_s_(applyPatch_(patch, A.QT), 'xong: 4/4');
    } finally { PropertiesService.getScriptProperties().deleteProperty('PATCH_' + patch.id); }
    var p = findRow_('Problems', 'ma_bai', 'TEST-03').data;
    eq_(p.de_bai, 'Đề thử TEST-03: tính $1+2$.'); eq_(p.de_bai_goc, 'Đề gốc TEST-03'); eq_(Number(p.phien_ban), 2);
    eq_(rows_('Corrections').length, 2); eq_(rows_('Revisions').length, 1); eq_(rows_('Reviews').length, 1);
    eq_(rows_('Checks').filter(function (c) { return c.ma_bai === 'TEST-03'; }).length, 1);
    eq_(findRow_('Checks', 'id', 'k1').data.trang_thai, 'xong');
  });
  test_('8.3', 'Bản vá không rõ chỗ sửa (0 hoặc nhiều chỗ khớp) thì báo lỗi, không đổi gì', 'QT', function () {
    var patch = { id: 'kiemthu-' + Utilities.getUuid().slice(0, 6), ops: [
      { op: 'correction', ma_bai: 'TEST-03', truong: 'de_bai', truoc: 'không có đoạn này', sau: 'y', vi_tri: 'đề', ly_do: 'thử' },
      { op: 'correction', ma_bai: 'TEST-03', truong: 'de_bai', truoc: '1', sau: '2', vi_tri: 'đề', ly_do: 'thử' },
      { op: 'check', ma_bai: 'KHONG-CO', noi_dung: 'x' }] };
    var msg;
    try { msg = applyPatch_(patch, A.QT); } finally { PropertiesService.getScriptProperties().deleteProperty('PATCH_' + patch.id); }
    has_s_(msg, '3 lỗi');
    eq_(findRow_('Problems', 'ma_bai', 'TEST-03').data.de_bai, 'Đề thử TEST-03: tính $1+1$.');
    eq_(rows_('Revisions').length, 0);
  });

  // 9. Nhật ký truy cập
  test_('9.1', 'Mỗi lần mở bài đều ghi vào nhật ký (ai, bài nào)', 'T1', function () {
    call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-02' });
    ok_(rows_('Audit').some(function (a) { return a.email === A.T1 && a.hanh_dong === 'xem' && a.chi_tiet === 'TEST-02'; }), 'thiếu dòng nhật ký xem');
  });

  // 11. Bài luyện tập (dùng cho kiểm thử bằng tay)
  test_('11.1', 'resetPractice tạo 3 bài luyện + kỳ K-THU, chạy lại không nhân đôi, không chạm bài thật', 'QT', function () {
    resetPractice(); resetPractice();
    eq_(rows_('Problems').filter(function (p) { return p.ma_bai.indexOf('THU-') === 0; }).length, 3);
    eq_(rows_('Problems').filter(function (p) { return p.ma_bai.indexOf('TEST-') === 0; }).length, 5, 'bài khác giữ nguyên');
    eq_(rows_('Assignments').filter(function (a) { return a.ky === 'K-THU'; }).length, 3);
    eq_(rows_('Rounds').filter(function (r) { return r.ky === 'K-THU'; }).length, 1);
  });
  test_('11.2', 'Bài luyện chỉ hiện với Quản trị và người được giao; TBT/NCB không thấy', 'T1+T2', function () {
    resetPractice();
    eq_(codes_(call_(login_(A.T1), 'listProblems')).filter(function (c) { return c.indexOf('THU-') === 0; }), ['THU-01', 'THU-02']);
    eq_(codes_(call_(login_(A.T2), 'listProblems')).filter(function (c) { return c.indexOf('THU-') === 0; }), ['THU-02']);
    eq_(call_(login_(A.QT), 'listProblems').length, 8);
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'NCB' });
    putRows_('Assignments', []);
    eq_(call_(login_(A.T1), 'listProblems').length, 5, 'TBT không thấy bài luyện');
    eq_(call_(login_(A.T2), 'listProblems').length, 5, 'NCB không thấy bài luyện');
  });

  // 12. Hàm quản trị không gọi được từ trang web
  test_('12.1', 'Khách trên trang web không gọi được setUser, setup, nhập, vá, kiểm thử, resetPractice', 'T1', function () {
    var fns = { setUser: function () { setUser(A.T1, 'x', 'Quản trị'); }, setup: function () { setup(); },
                importLatest: function () { importLatest(); }, importBatch: function () { importBatch('x'); },
                applyPatchLatest: function () { applyPatchLatest(); }, setupTests: function () { setupTests(); },
                runTests: function () { runTests('1'); }, resetPractice: function () { resetPractice(); } };
    try {
      [A.T1, '', A.LA].forEach(function (who) {
        TEST_CONF.ACTIVE_USER = who;
        Object.keys(fns).forEach(function (k) { throws_(fns[k], 'Chỉ chạy được'); });
      });
    } finally { delete TEST_CONF.ACTIVE_USER; }
    eq_(findRow_('Users', 'email', A.T1).data.vai_tro, 'PB', 'vai trò T1 không đổi');
  });

  // 10. Hiển thị công thức (bộ hiển thị chạy trong Apps Script, giống trình duyệt)
  test_('10.1', 'Bộ hiển thị: macro của Pi, công thức, chặn HTML', 'QT', function () {
    var h = renderInGas_('Cho \\dtr $(O)$. <b>đậm giả</b> \\textbf{đậm thật}');
    has_s_(h, 'đường tròn'); has_s_(h, '\\((O)\\)'); has_s_(h, '&lt;b&gt;đậm giả'); has_s_(h, '<b>đậm thật</b>');
  }, { keep: true });
}

/** Chạy bộ hiển thị (ui/RenderJs) bên trong Apps Script để kiểm tra đúng mã mà trình duyệt nhận. */
function renderInGas_(src) {
  if (!TK.render) {
    var js = HtmlService.createHtmlOutputFromFile('ui/RenderJs').getContent().replace(/<\/?script[^>]*>/g, '');
    var box = {};
    (new Function('root', 'var module;' + js.replace(/\}\)\(this\);\s*$/, '})(root);')))(box);
    TK.render = box.PiRender;
  }
  return TK.render.render(src).html;
}

/* ======================= BÀI LUYỆN TẬP CHO KIỂM THỬ BẰNG TAY =======================
 * Giống "practice teams" của MCC: ba bài bịa THU-01..03 và kỳ "K-THU" sống trong dữ liệu THẬT để kiểm thử
 * bằng trình duyệt với ba tài khoản thật. Chỉ Quản trị và người được giao thấy chúng.
 * resetPractice(): xoá mọi dòng THU-… / K-THU rồi tạo lại; không chạm bài thật. Chạy trước mỗi buổi kiểm thử tay.
 *   THU-01 → giao T1;  THU-02 → giao T1 và T2;  THU-03 → không giao ai.  T1, T2 được đặt vai trò PB.
 */
var PRACTICE_PREFIX = 'THU-', PRACTICE_ROUND = 'K-THU';

function resetPractice() {
  adminOnly_();
  var users = String(PropertiesService.getScriptProperties().getProperty('TEST_USERS') || '').split(',')
    .map(function (s) { return s.trim().toLowerCase(); }).filter(String);
  if (users.length < 2) throw new Error('Thiếu Script property TEST_USERS.');
  var removed = 0;
  withLock_(function () {
    Object.keys(SCHEMA).forEach(function (name) {
      var cols = SCHEMA[name], iMa = cols.indexOf('ma_bai'), iKy = cols.indexOf('ky');
      if (iMa < 0 && iKy < 0) return;
      var sh = sheet_(name), n = sh.getLastRow();
      if (n < 2) return;
      var vals = sh.getRange(2, 1, n - 1, cols.length).getValues();
      for (var r = vals.length - 1; r >= 0; r--) {
        var practice = (iMa >= 0 && String(vals[r][iMa]).indexOf(PRACTICE_PREFIX) === 0) || (iKy >= 0 && String(vals[r][iKy]) === PRACTICE_ROUND);
        if (practice) { sh.deleteRow(r + 2); removed++; }
      }
    });
  });
  var t = now_();
  [['THU-01', 'ĐS', 'Bài luyện 1 (bịa, để kiểm thử): Cho $a,b>0$ và $a+b=2$. Chứng minh $ab\\le 1$.', 'Theo AM-GM, $ab\\le\\left(\\frac{a+b}{2}\\right)^2=1$.'],
   ['THU-02', 'HH', 'Bài luyện 2 (bịa, để kiểm thử): Tam giác $ABC$ vuông tại $A$. Chứng minh $BC^2=AB^2+AC^2$.', 'Định lý Pythagore.\n\n$$BC^2=AB^2+AC^2.$$'],
   ['THU-03', 'SH', 'Bài luyện 3 (bịa, để kiểm thử): Tìm số nguyên dương $n$ nhỏ nhất để $n^2+1$ chia hết cho $5$.', '$n=2$.']]
  .forEach(function (b) {
    append_('Problems', { ma_bai: b[0], chu_de: b[1], muc: 'B', trang_thai: 'Mới', loai: 'thử', tac_gia_id: 'THU-TG',
                          de_bai: b[2], loi_giai: b[3], de_bai_goc: b[2], loi_giai_goc: b[3], phien_ban: 1, cap_nhat: t, nguoi_cap_nhat: 'resetPractice' });
    append_('Provenance', { ma_bai: b[0], thu_muc: '(bài luyện)', tep_goc: 'Tác Giả Luyện Tập - ' + b[0] + '.docx', kenh: 'kiểm thử' });
  });
  if (!findRow_('Authors', 'tac_gia_id', 'THU-TG')) append_('Authors', { tac_gia_id: 'THU-TG', ten_in: 'Tác Giả Luyện Tập', don_vi: '(bịa)', lien_he: '' });
  append_('Rounds', { ky: PRACTICE_ROUND, trang_thai: 'mở', ghi_chu: 'kỳ luyện tập cho kiểm thử' });
  [['THU-01', users[0]], ['THU-02', users[0]], ['THU-02', users[1]]].forEach(function (a) {
    append_('Assignments', { ky: PRACTICE_ROUND, ma_bai: a[0], email: a[1], giao_luc: t });
  });
  users.slice(0, 2).forEach(function (u, k) {
    var hit = findRow_('Users', 'email', u);
    if (hit) update_('Users', hit.row, { vai_tro: 'PB', hoat_dong: true });
    else append_('Users', { email: u, ten: 'Tài khoản thử ' + (k + 1), vai_tro: 'PB', hoat_dong: true, ghi_chu: 'kiểm thử' });
  });
  var msg = 'Đã đặt lại bài luyện tập (xoá ' + removed + ' dòng cũ): THU-01 → ' + users[0] + '; THU-02 → ' + users[0] + ', ' + users[1] + '; THU-03 → không ai.';
  audit_(Session.getEffectiveUser().getEmail(), 'resetPractice', msg);
  Logger.log(msg);
  return msg;
}
