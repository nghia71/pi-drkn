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
  if (start === 0) ensureTabs_(SpreadsheetApp.openById(sheetId));   // tab, cột mới của lần triển khai mới — khỏi phải chạy lại setupTests
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
    delete TEST_CONF.TODAY; delete TEST_CONF.MAIL_QUOTA; delete TEST_CONF.REMINDER_DAYS; delete TEST_CONF.BOARD_LAYOUT; TEST_OUTBOX = [];
    delete TEST_CONF.EXPORT_FOLDER_ID; TEST_CONF.FIG_FOLDER_ID = '';   // không đụng thư mục hình thật; kịch bản cần thì tạo thư mục tạm
    TEST_CONF.TEST_USERS = '';   // mặc định: T1, T2 là người thường; 11.3 bật lại
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
  ['Shortlist', 'Issues', 'Reviews', 'Comments', 'Published', 'Revisions', 'Audit'].forEach(function (t) { putRows_(t, []); });
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

  test_('4.12', 'Sửa nội dung toán: phải có vị trí và lý do; ghi một dòng Sửa đổi "chờ tác giả xác nhận" với đoạn trước/sau', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1), base = { ma_bai: 'TEST-02', truong: 'loi_giai', loai: 'noi_dung', noi_dung: 'Lời giải thử TEST-02, đáp số $x=2$.', phien_ban: 1 };
    var w = function (o) { var x = {}; for (var k in base) x[k] = base[k]; for (k in o) x[k] = o[k]; return x; };
    throws_(function () { call_(tok, 'saveText', w({ ly_do: 'đáp số sai' })); }, 'Vị trí');
    throws_(function () { call_(tok, 'saveText', w({ vi_tri: 'kết luận', ly_do: '  ' })); }, 'Lý do');
    throws_(function () { call_(tok, 'saveText', w({ loai: 'lon', vi_tri: 'x', ly_do: 'y' })); }, 'Loại sửa');
    eq_(Number(findRow_('Problems', 'ma_bai', 'TEST-02').data.phien_ban), 1, 'bị từ chối thì bài không đổi');
    var r = call_(tok, 'saveText', w({ vi_tri: 'kết luận', ly_do: 'bước trước tính ra 2' }));
    eq_(r.phien_ban, 2); ok_(r.sua_doi);
    var c = rows_('Corrections').filter(function (x) { return x.ma_bai === 'TEST-02'; });
    eq_(c.length, 1); eq_(c[0].vi_tri, 'lời giải, kết luận'); eq_(c[0].ly_do, 'bước trước tính ra 2');
    eq_(c[0].trang_thai, 'chờ tác giả xác nhận'); eq_(c[0].nguoi, A.T1);
    has_s_(c[0].sau, 'đáp số $x=2$'); lacks_(c[0].truoc, 'đáp số');
    eq_(rows_('Revisions').length, 1, 'vẫn có lịch sử');
    ok_(auditHas_('sửa', '(nội dung toán)'));
  });
  test_('4.13', 'Sửa nhỏ (mặc định) không tạo dòng Sửa đổi', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    call_(login_(A.T1), 'saveText', { ma_bai: 'TEST-02', truong: 'de_bai', noi_dung: 'Đề thử TEST-02: tính $1 + 1$.', phien_ban: 1 });
    eq_(rows_('Corrections').filter(function (x) { return x.ma_bai === 'TEST-02'; }).length, 0);
    eq_(rows_('Revisions').length, 1);
  });
  test_('4.14', 'Đoạn trước/sau của sửa đổi chỉ gồm chỗ khác nhau và vài chữ quanh đó', 'QT', function () {
    var pre = new Array(60).join('chữ '), post = new Array(60).join(' đuôi');
    var d = changedSpan_(pre + 'đáp số $x=\\frac{4}{3}$ vậy' + post, pre + 'đáp số $x=\\frac{2}{3}$ vậy' + post);
    has_s_(d.truoc, '\\frac{4}{3}'); has_s_(d.sau, '\\frac{2}{3}'); has_s_(d.truoc, 'số'); has_s_(d.sau, 'vậy');
    ok_(d.truoc.length < 80 && d.sau.length < 80, 'không chép cả văn bản: ' + d.truoc.length);
    ok_(d.truoc.charAt(0) === '…' && d.sau.slice(-1) === '…', 'có dấu … ở chỗ cắt');
    var e = changedSpan_('ngắn', 'ngắn hơn');
    eq_(e.truoc, 'ngắn'); eq_(e.sau, 'ngắn hơn');
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

  test_('6.5', 'Đóng mục cần kiểm tra: phải ghi kết quả; NCB, TBT được; PB, VP không; danh sách bớt một chấm', 'T1', function () {
    [['PB', false], ['VP', false], ['BTK', false]].forEach(function (c) {
      setUsers_({ QT: 'Quản trị', T1: c[0], T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'closeCheck', { id: 'k1', ket_qua: 'x' }); }, 'Không có quyền');
    });
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1);
    eq_(call_(tok, 'listProblems').filter(function (p) { return p.ma_bai === 'TEST-01'; })[0].checks, 1);
    throws_(function () { call_(tok, 'closeCheck', { id: 'k1', ket_qua: ' ' }); }, 'Kết quả');
    throws_(function () { call_(tok, 'closeCheck', { id: 'k1', ket_qua: 'x', trang_thai: 'bỏ' }); }, 'không hợp lệ');
    throws_(function () { call_(tok, 'closeCheck', { id: 'khong-co', ket_qua: 'x' }); }, 'Không có mục');
    call_(tok, 'closeCheck', { id: 'k1', ket_qua: 'Đã hỏi tác giả: đúng như bản gốc.' });
    var k = findRow_('Checks', 'id', 'k1').data; eq_(k.trang_thai, 'xong'); eq_(k.ket_qua, 'Đã hỏi tác giả: đúng như bản gốc.');
    eq_(call_(tok, 'listProblems').filter(function (p) { return p.ma_bai === 'TEST-01'; })[0].checks, 0);
    call_(tok, 'closeCheck', { id: 'k1', trang_thai: 'mở' });
    eq_(findRow_('Checks', 'id', 'k1').data.ket_qua, 'Đã hỏi tác giả: đúng như bản gốc.', 'mở lại vẫn giữ kết quả cũ');
    ok_(auditHas_('kiểm tra → mở', 'TEST-01'));
  });
  test_('6.6', 'Xung đột mức / tác giả / trùng bài: chỉ TBT ghi cách giải quyết, người khác chỉ chuyển "chờ TBT"', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1);
    throws_(function () { call_(tok, 'resolveConflict', { id: 'x1', trang_thai: 'đã giải quyết', cach_giai_quyet: 'giữ tên in' }); }, 'TBT quyết định');
    call_(tok, 'resolveConflict', { id: 'x1', trang_thai: 'chờ TBT' });
    eq_(findRow_('Conflicts', 'id', 'x1').data.trang_thai, 'chờ TBT');
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    tok = login_(A.T1);
    throws_(function () { call_(tok, 'resolveConflict', { id: 'x1', trang_thai: 'đã giải quyết' }); }, 'Cách giải quyết');
    throws_(function () { call_(tok, 'resolveConflict', { id: 'x1', trang_thai: 'xong rồi', cach_giai_quyet: 'x' }); }, 'không hợp lệ');
    call_(tok, 'resolveConflict', { id: 'x1', trang_thai: 'đã giải quyết', cach_giai_quyet: 'Giữ tên in theo hồ sơ.' });
    var x = findRow_('Conflicts', 'id', 'x1').data; eq_(x.trang_thai, 'đã giải quyết'); eq_(x.cach_giai_quyet, 'Giữ tên in theo hồ sơ.');
    eq_(call_(tok, 'listProblems').filter(function (p) { return p.ma_bai === 'TEST-01'; })[0].conflicts, 0, 'hết chấm xung đột mở');
    // loại khác: NCB giải quyết được
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    tok = login_(A.T1);
    var c = call_(tok, 'addConflict', { ma_bai: 'TEST-02', loai: 'số hiệu', mo_ta: 'Hai danh sách đánh số khác nhau' });
    call_(tok, 'resolveConflict', { id: c.id, trang_thai: 'đã giải quyết', cach_giai_quyet: 'Theo danh sách của NCB.' });
    eq_(findRow_('Conflicts', 'id', c.id).data.trang_thai, 'đã giải quyết');
    // PB không động vào xung đột, kể cả bài được giao
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'resolveConflict', { id: 'x1', trang_thai: 'mở' }); }, 'Không có quyền');
  });
  test_('6.7', 'Trạng thái sửa đổi (tác giả đồng ý / không đồng ý): NCB, TBT được; PB không; trạng thái lạ bị từ chối; văn bản không đổi', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'setCorrectionStatus', { id: 'c1', trang_thai: 'tác giả đồng ý' }); }, 'Không có quyền');
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    var tok = login_(A.T1);
    throws_(function () { call_(tok, 'setCorrectionStatus', { id: 'c1', trang_thai: 'tuỳ' }); }, 'không hợp lệ');
    call_(tok, 'setCorrectionStatus', { id: 'c1', trang_thai: 'tác giả không đồng ý' });
    eq_(findRow_('Corrections', 'id', 'c1').data.trang_thai, 'tác giả không đồng ý');
    eq_(findRow_('Problems', 'ma_bai', 'TEST-01').data.de_bai, 'Đề thử TEST-01: tính $1+1$.', 'không tự đổi văn bản');
    ok_(auditHas_('sửa đổi → tác giả không đồng ý', 'TEST-01'));
  });
  test_('6.8', 'Thêm mục / xung đột / đổi trạng thái cho bài không tồn tại, bài không được thấy, hoặc nội dung trống: bị từ chối', 'T1', function () {
    resetPractice();
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'TBT' });
    putRows_('Assignments', []);      // bài luyện không giao ai: NCB, TBT không thấy
    var a = login_(A.T1), b = login_(A.T2);
    throws_(function () { call_(a, 'addCheck', { ma_bai: 'KHONG-CO', noi_dung: 'x' }); }, 'Không có bài');
    throws_(function () { call_(a, 'addCheck', { ma_bai: 'THU-01', noi_dung: 'x' }); }, 'Không có quyền');
    throws_(function () { call_(a, 'addConflict', { ma_bai: 'THU-01', loai: 'mức', mo_ta: 'x' }); }, 'Không có quyền');
    throws_(function () { call_(b, 'setStatus', { ma_bai: 'THU-01', trang_thai: 'SL' }); }, 'Không có quyền');
    throws_(function () { call_(a, 'addCheck', { ma_bai: 'TEST-01', noi_dung: '   ' }); }, 'trống');
    throws_(function () { call_(a, 'addConflict', { ma_bai: 'TEST-01', loai: 'mức' }); }, 'trống');
    var th = rows_('Checks').filter(function (c) { return c.ma_bai === 'THU-01'; });
    eq_(th.length, 0); eq_(rows_('Checks').length, 1);
    // mục của bài luyện: người không thấy bài cũng không đóng được, và không biết mục có tồn tại
    var k = call_(login_(A.QT), 'addCheck', { ma_bai: 'THU-01', noi_dung: 'mục của bài luyện' });
    var e1 = throws_(function () { call_(a, 'closeCheck', { id: k.id, ket_qua: 'x' }); }, 'Không có mục');
    var e2 = throws_(function () { call_(a, 'closeCheck', { id: 'khong-co', ket_qua: 'x' }); }, 'Không có mục');
    eq_(e1.message, e2.message);
  });
  test_('6.9', 'Trang bài cho biết người xem được làm gì (đổi trạng thái, mục kiểm tra, quyết định của TBT)', 'T1', function () {
    var can = function (role) { setUsers_({ QT: 'Quản trị', T1: role, T2: 'PB' }); return call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-01' }).can; };
    eq_(can('NCB'), { status: false, props: true, tbt: false });
    eq_(can('PT'), { status: true, props: true, tbt: false });
    eq_(can('TBT'), { status: true, props: true, tbt: true });
    eq_(can('VP'), { status: false, props: false, tbt: false });
    eq_(can('PB'), undefined, 'phản biện không nhận');
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
  test_('8.6', 'Bản vá "tác giả thay bài": giữ mã, đề/lời giải và bản gốc là bản mới, lịch sử giữ bản cũ; phiếu cũ → mục cần kiểm tra; chạy lại không đổi; bài đã đăng thì không thay', 'QT', function () {
    putRows_('Reviews', [{ id: 'r1', ky: 'K-MO', ma_bai: 'TEST-02', email: A.T1, muc_de_nghi: 'A', diem: 'chọn' }]);
    var patch = { id: 'kiemthu-' + Utilities.getUuid().slice(0, 6), nguoi: 'kiểm thử', ops: [
      { op: 'replace', ma_bai: 'TEST-02', de_bai: 'Đề mới: tính $2+2$.', loi_giai: 'Lời giải mới: $4$.', tep_goc: 'bai-moi.tex', ly_do: 'tác giả gửi bản thay' },
      { op: 'replace', ma_bai: 'TEST-05', de_bai: 'x', loi_giai: 'y' }] };
    var v0 = Number(findRow_('Problems', 'ma_bai', 'TEST-02').data.phien_ban);
    try {
      var m = applyPatch_(patch, A.QT); has_s_(m, 'xong: 2/2'); has_s_(m, 'đã đăng');
      PropertiesService.getScriptProperties().deleteProperty('PATCH_' + patch.id);
      applyPatch_(patch, A.QT);
    } finally { PropertiesService.getScriptProperties().deleteProperty('PATCH_' + patch.id); }
    var p = findRow_('Problems', 'ma_bai', 'TEST-02').data;
    eq_([p.de_bai, p.loi_giai, p.de_bai_goc, p.loi_giai_goc], ['Đề mới: tính $2+2$.', 'Lời giải mới: $4$.', 'Đề mới: tính $2+2$.', 'Lời giải mới: $4$.']);
    eq_(Number(p.phien_ban), v0 + 2, 'chạy lại không tăng phiên bản');
    eq_(rows_('Revisions').map(function (r) { return [r.truong, r.cu]; }), [['de_bai', 'Đề thử TEST-02: tính $1+1$.'], ['loi_giai', 'Lời giải thử TEST-02.']]);
    eq_(rows_('ConversionLog').length, 1); has_s_(rows_('ConversionLog')[0].noi_dung, 'Tác giả thay bài (bai-moi.tex)');
    var ck = rows_('Checks').filter(function (c) { return c.ma_bai === 'TEST-02'; });
    eq_(ck.length, 1); has_s_(ck[0].noi_dung, '1 phiếu phản biện');
    eq_(findRow_('Problems', 'ma_bai', 'TEST-05').data.de_bai, 'Đề thử TEST-05: tính $1+1$.', 'bài đã đăng không đổi');
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

  test_('8.4', 'Bản vá sửa đề không biến ô khác bắt đầu bằng "=" thành công thức', 'QT', function () {
    var hit = findRow_('Problems', 'ma_bai', 'TEST-03');
    update_('Problems', hit.row, { loi_giai: '=đáp số 2' });
    var patch = { id: 'kiemthu-' + Utilities.getUuid().slice(0, 6), nguoi: 'kiểm thử', ops: [
      { op: 'correction', ma_bai: 'TEST-03', truong: 'de_bai', truoc: '$1+1$', sau: '$1+2$', vi_tri: 'đề', ly_do: 'thử' }] };
    try { has_s_(applyPatch_(patch, A.QT), 'xong: 1/1'); } finally { PropertiesService.getScriptProperties().deleteProperty('PATCH_' + patch.id); }
    eq_(findRow_('Problems', 'ma_bai', 'TEST-03').data.loi_giai, '=đáp số 2');
    eq_(sheet_('Problems').getRange(hit.row, SCHEMA.Problems.indexOf('loi_giai') + 1).getFormula(), '');
  });

  test_('8.5', 'Nhập: một lần chạy nhập mọi tệp chờ (cũ trước), chạy lại thì báo không còn tệp; tệp mới sau đó được nhập riêng', 'QT', function () {
    TEST_CONF.IMPORT_PREFIX = 'pi-drkn-kiemthu-cho-' + Utilities.getUuid().slice(0, 6);
    var mk = function (codes) {
      return DriveApp.createFile(TEST_CONF.IMPORT_PREFIX + '-' + codes[0] + '.json', JSON.stringify(codes.map(function (c) {
        return { problem: { ma_bai: c, chu_de: 'ĐS', muc: '', trang_thai: 'Mới', de_bai: 'Đề ' + c, loi_giai: '' }, author: { ten_in: 'Tác Giả Nhập' } };
      })), 'application/json');
    };
    var files = [mk(['CHO-01', 'CHO-02']), mk(['CHO-03'])];
    try {
      var m = importLatest(); has_s_(m, 'thêm 2'); has_s_(m, 'thêm 1');
      ok_(m.indexOf('CHO-01') < m.indexOf('CHO-03'), 'tệp cũ trước');
      has_s_(importLatest(), 'Không có tệp nào chờ nhập');
      files.push(mk(['CHO-04']));
      m = importLatest(); has_s_(m, 'thêm 1'); lacks_(m, 'CHO-01');
      eq_(rows_('Problems').filter(function (p) { return p.ma_bai.indexOf('CHO-') === 0; }).length, 4);
    } finally {
      files.forEach(function (f) { f.setTrashed(true); PropertiesService.getScriptProperties().deleteProperty('IMPORT_DONE_' + f.getId()); });
      delete TEST_CONF.IMPORT_PREFIX;
    }
  });

  // 9. Nhật ký truy cập
  test_('9.1', 'Mỗi lần mở bài đều ghi vào nhật ký (ai, bài nào)', 'T1', function () {
    call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-02' });
    ok_(rows_('Audit').some(function (a) { return a.email === A.T1 && a.hanh_dong === 'xem' && a.chi_tiet === 'TEST-02'; }), 'thiếu dòng nhật ký xem');
  });

  // 11. Bài luyện tập (dùng cho kiểm thử bằng tay)
  test_('11.1', 'resetPractice tạo 10 bài luyện (4 B, 6 A) + kỳ K-THU, chạy lại không nhân đôi, không chạm bài thật', 'QT', function () {
    resetPractice(); resetPractice();
    eq_(rows_('Problems').filter(function (p) { return p.ma_bai.indexOf('THU-') === 0; }).length, 10);
    eq_(rows_('Problems').filter(function (p) { return p.ma_bai.indexOf('THU-') === 0 && p.muc === 'B'; }).length, 4, 'đủ cho bố cục mặc định');
    eq_(rows_('Problems').filter(function (p) { return p.ma_bai.indexOf('TEST-') === 0; }).length, 5, 'bài khác giữ nguyên');
    eq_(rows_('Assignments').filter(function (a) { return a.ky === 'K-THU'; }).length, 3);
    eq_(rows_('Rounds').filter(function (r) { return r.ky === 'K-THU'; }).length, 1);
    eq_(daysUntil_(dateOnly_(findRow_('Rounds', 'ky', 'K-THU').data.han_phan_bien)), 14, 'kỳ luyện có hạn 14 ngày');
    // bảng chọn bài luyện (số báo THU-…) cũng được dọn
    // … và một bảng luyện đủ 10 vị trí (bố cục mặc định), đã khoá kỳ — Published của bài luyện cũng được dọn
    var tok = login_(A.QT), so = 'THU-99/2026';
    call_(tok, 'newBoard', { so: so });
    ['THU-01', 'THU-02', 'THU-03', 'THU-04', 'THU-05', 'THU-06', 'THU-07', 'THU-08', 'THU-09', 'THU-10']
      .forEach(function (m, i) { call_(tok, 'place', { so: so, vi_tri: i + 1, ma_bai: m }); });
    call_(tok, 'submitBoard', { so: so });
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' }); call_(login_(A.T1), 'approveBoard', { so: so });
    var ex = DriveApp.createFolder('Pi ĐRKN — kiểm thử xuất (xoá được)'); TEST_CONF.EXPORT_FOLDER_ID = ex.getId();
    try { call_(tok, 'closeIssue', { so: so, bat_dau: '9001', xac_nhan: true }); } finally { ex.setTrashed(true); }
    eq_(rows_('Published').length, 10);
    call_(tok, 'newBoard', { so: '10/2026' });
    resetPractice();
    eq_(rows_('Issues').map(function (i) { return String(i.so); }), ['10/2026'], 'chỉ xoá bảng luyện');
    eq_(rows_('Shortlist').length, 0); eq_(rows_('Published').length, 0);
    eq_(findRow_('Problems', 'ma_bai', 'THU-01').data.trang_thai, 'Mới', 'bài luyện trở lại như mới');
  });
  test_('11.3', 'Hai tài khoản thử (TEST_USERS) mang vai trò ban biên tập thấy mọi bài luyện (B14, B15); với vai trò PB chỉ thấy bài được giao; người khác không thấy', 'T1+T2', function () {
    resetPractice();
    TEST_CONF.TEST_USERS = A.T1 + ', ' + A.T2.toUpperCase();
    setUsers_({ QT: 'Quản trị', T1: 'PT', T2: 'TBT' });
    var thu = function (tok) { return codes_(call_(tok, 'listProblems')).filter(function (c) { return c.indexOf('THU-') === 0; }); };
    eq_(thu(login_(A.T1)).length, 10); eq_(thu(login_(A.T2)).length, 10);
    var tok = login_(A.T1);
    call_(tok, 'newBoard', { so: 'THU-99/2026' }); call_(tok, 'place', { so: 'THU-99/2026', vi_tri: 3, ma_bai: 'THU-03' });
    eq_(call_(tok, 'getProblem', { ma_bai: 'THU-07' }).problem.ma_bai, 'THU-07');
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'TBT' });
    eq_(thu(login_(A.T1)), ['THU-01', 'THU-02'], 'PB chỉ thấy bài được giao');
    TEST_CONF.TEST_USERS = A.T1;
    eq_(thu(login_(A.T2)), ['THU-02'], 'không phải tài khoản thử: chỉ bài được giao');
  });
  test_('11.2', 'Bài luyện chỉ hiện với Quản trị và người được giao; TBT/NCB không thấy', 'T1+T2', function () {
    resetPractice();
    eq_(codes_(call_(login_(A.T1), 'listProblems')).filter(function (c) { return c.indexOf('THU-') === 0; }), ['THU-01', 'THU-02']);
    eq_(codes_(call_(login_(A.T2), 'listProblems')).filter(function (c) { return c.indexOf('THU-') === 0; }), ['THU-02']);
    eq_(call_(login_(A.QT), 'listProblems').length, 15);
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

  test_('12.2', 'Cài đặt lại trên Sheet cũ: tab thiếu cột mới ở cuối (Checks.ket_qua) được thêm tiêu đề, dữ liệu giữ nguyên', 'QT', function () {
    var sh = sheet_('Checks'), cols = SCHEMA.Checks;
    sh.getRange(1, 1, 1, cols.length).setValues([cols.slice(0, -1).concat([''])]);
    ensureTabs_(SpreadsheetApp.openById(DB_OVERRIDE));
    eq_(sh.getRange(1, 1, 1, cols.length).getValues()[0], cols);
    eq_(findRow_('Checks', 'id', 'k1').data.noi_dung, 'mục cần kiểm tra thử (hỏi ' + FX_AUTHOR + ')');
    // tiêu đề khác hẳn thì không đụng tới
    sh.getRange(1, 1, 1, 2).setValues([['ma', 'khac']]);
    ensureTabs_(SpreadsheetApp.openById(DB_OVERRIDE));
    eq_(sh.getRange(1, 1, 1, 2).getValues()[0], ['ma', 'khac']);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
  });

  // 13. Kỳ phản biện
  var R = function (role1, role2) { setUsers_({ QT: 'Quản trị', T1: role1 || 'PB', T2: role2 || 'PB' }); };
  test_('13.1', 'PT mở kỳ: tên trùng, hạn sai dạng hoặc đã qua bị từ chối; chỉ PT, Quản trị mở được; hạn lưu như chữ', 'T1', function () {
    TEST_CONF.TODAY = '2026-10-10';
    ['NCB', 'TBT', 'PB', 'VP'].forEach(function (r) {
      R(r); throws_(function () { call_(login_(A.T1), 'openRound', { ky: 'K-MOI', han_phan_bien: '2026-10-20' }); }, 'Không có quyền');
    });
    R('PT'); var tok = login_(A.T1);
    throws_(function () { call_(tok, 'openRound', { ky: 'K-MO', han_phan_bien: '2026-10-20' }); }, 'Đã có kỳ');
    throws_(function () { call_(tok, 'openRound', { ky: 'K-MOI', han_phan_bien: '20/10/2026' }); }, 'NNNN-TT-NN');
    throws_(function () { call_(tok, 'openRound', { ky: 'K-MOI', han_phan_bien: '2026-02-30' }); }, 'không có thật');
    throws_(function () { call_(tok, 'openRound', { ky: 'K-MOI', han_phan_bien: '2026-10-10' }); }, 'sau hôm nay');
    throws_(function () { call_(tok, 'openRound', { ky: '=HYPERLINK(1)', han_phan_bien: '2026-10-20' }); }, 'không được bắt đầu');
    call_(tok, 'openRound', { ky: 'K-MOI', han_phan_bien: '2026-10-20', ghi_chu: 'kỳ thử' });
    var r = findRow_('Rounds', 'ky', 'K-MOI').data;
    eq_(r.trang_thai, 'mở'); eq_(typeof r.han_phan_bien, 'string', 'hạn không bị Sheets đổi thành Date'); eq_(r.han_phan_bien, '2026-10-20');
    var v = call_(tok, 'rounds'); ok_(v.manage); eq_(v.rounds.filter(function (x) { return x.ky === 'K-MOI'; })[0].han_phan_bien, '2026-10-20');
    ok_(auditHas_('mở kỳ', 'K-MOI'));
  });
  test_('13.2', 'Giao bài: chỉ cho người có vai trò PB đang hoạt động; không trùng; không giao vào kỳ đã đóng; PB thấy bài kèm hạn', 'T1+T2', function () {
    TEST_CONF.TODAY = '2026-10-10';
    setUsers_({ QT: 'Quản trị', T1: 'PT', T2: 'PB' });
    var tok = login_(A.T1);
    call_(tok, 'openRound', { ky: 'K2', han_phan_bien: '2026-10-20' });
    throws_(function () { call_(tok, 'assign', { ky: 'K2', ma_bai: 'TEST-04', email: A.T1 }); }, 'chưa có vai trò PB');
    throws_(function () { call_(tok, 'assign', { ky: 'K2', ma_bai: 'TEST-04', email: STRANGER }); }, 'chưa có vai trò PB');
    throws_(function () { call_(tok, 'assign', { ky: 'K-DONG', ma_bai: 'TEST-04', email: A.T2 }); }, 'đã đóng');
    throws_(function () { call_(tok, 'assign', { ky: 'K2', ma_bai: 'KHONG-CO', email: A.T2 }); }, 'Không có bài');
    call_(tok, 'assign', { ky: 'K2', ma_bai: 'TEST-04', email: ' ' + A.T2.toUpperCase() + ' ' });
    throws_(function () { call_(tok, 'assign', { ky: 'K2', ma_bai: 'TEST-04', email: A.T2 }); }, 'Đã giao');
    var l = call_(login_(A.T2), 'listProblems'), row = l.filter(function (p) { return p.ma_bai === 'TEST-04'; })[0];
    ok_(row, 'PB thấy bài vừa giao'); eq_(row.giao.han, '2026-10-20'); eq_(row.giao.xong, false);
    setUsers_({ QT: 'Quản trị', T1: 'PT', T2: { vai_tro: 'PB', hoat_dong: false } });
    throws_(function () { call_(tok, 'assign', { ky: 'K2', ma_bai: 'TEST-05', email: A.T2 }); }, 'tạm ngưng');
  });
  test_('13.3', 'Thư mời: mỗi phản biện một thư, không có đề / tên tác giả; gửi lại không gửi trùng; thiếu hạn mức thì không gửi gì', 'QT', function () {
    TEST_CONF.TODAY = '2026-10-10';
    var tok = login_(A.QT);
    update_('Rounds', findRow_('Rounds', 'ky', 'K-MO').row, { han_phan_bien: "'2026-10-20" });
    TEST_CONF.MAIL_QUOTA = 1;
    throws_(function () { call_(tok, 'sendInvites', { ky: 'K-MO' }); }, 'Hạn mức');
    eq_(TEST_OUTBOX.length, 0); ok_(assignmentsOf_('K-MO').every(function (a) { return !a.moi_luc; }), 'chưa ghi đã mời');
    TEST_CONF.MAIL_QUOTA = 100;
    eq_(call_(tok, 'sendInvites', { ky: 'K-MO' }).sent, 2);
    eq_(TEST_OUTBOX.map(function (m) { return m.to; }).sort(), [A.T1, A.T2].sort());
    var t1 = TEST_OUTBOX.filter(function (m) { return m.to === A.T1; })[0];
    has_s_(t1.body, '2 bài'); has_s_(t1.body, '2026-10-20'); has_s_(t1.body, 'https://example.com/dang-nhap'); has_s_(t1.body, A.T1);
    TEST_OUTBOX.forEach(function (m) { lacks_(m.body, 'Đề thử'); lacks_(m.body, FX_AUTHOR); lacks_(m.body, 'TEST-0'); });
    eq_(call_(tok, 'sendInvites', { ky: 'K-MO' }).sent, 0); eq_(TEST_OUTBOX.length, 2);
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'sendInvites', { ky: 'K-MO' }); }, 'Không có quyền');
  });
  test_('13.4', 'Phiếu phản biện: chỉ người được giao; phải chọn đề nghị; lưu lại thay phiếu cũ; phản biện khác không thấy; TBT thấy mọi phiếu', 'T1+T2', function () {
    var a = login_(A.T1), b = login_(A.T2);
    throws_(function () { call_(b, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-01', diem: 'chọn' }); }, 'không được giao');
    throws_(function () { call_(a, 'submitReview', { ky: 'K-DONG', ma_bai: 'TEST-03', diem: 'chọn' }); }, 'đã đóng');
    throws_(function () { call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-02', diem: '' }); }, 'Hãy chọn đề nghị');
    throws_(function () { call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-02', diem: 'chọn', muc_de_nghi: 'C' }); }, 'Mức đề nghị');
    call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-02', diem: 'sửa rồi chọn', muc_de_nghi: 'B', nhan_xet: 'Bước 2 thiếu $x>0$.' });
    call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-02', diem: 'chọn', muc_de_nghi: 'A', nhan_xet: '=đã sửa' });
    call_(b, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-02', diem: 'không chọn', nhan_xet: 'Trùng bài cũ.' });
    var rv = rows_('Reviews'); eq_(rv.length, 2, 'lưu lại thay phiếu cũ');
    var mine = call_(a, 'getProblem', { ma_bai: 'TEST-02' });
    eq_(mine.reviews, undefined, 'phản biện không nhận phiếu của người khác'); eq_(mine.mine.length, 1);
    eq_(mine.mine[0].review.diem, 'chọn'); eq_(mine.mine[0].review.nhan_xet, '=đã sửa');
    lacks_(JSON.stringify(mine), 'Trùng bài cũ', 'phiếu của T2 lọt sang T1');
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    var all = call_(login_(A.T1), 'getProblem', { ma_bai: 'TEST-02' }).reviews;
    eq_(all.length, 2); eq_(all.map(function (v) { return v.email; }).sort(), [A.T1, A.T2].sort());
  });
  test_('13.5', 'Đánh dấu xong: cần phiếu trước; đã xong thì khoá phiếu; bỏ đánh dấu được; PT thấy tiến độ', 'T1', function () {
    var a = login_(A.T1);
    throws_(function () { call_(a, 'markDone', { ky: 'K-MO', ma_bai: 'TEST-01' }); }, 'Phiếu phản biện trước');
    call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-01', diem: 'chọn', muc_de_nghi: 'A' });
    call_(a, 'markDone', { ky: 'K-MO', ma_bai: 'TEST-01' });
    throws_(function () { call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-01', diem: 'không chọn' }); }, 'đã đánh dấu xong');
    var v = call_(login_(A.QT), 'rounds').rounds.filter(function (r) { return r.ky === 'K-MO'; })[0];
    var x = v.assignments.filter(function (y) { return y.ma_bai === 'TEST-01'; })[0]; ok_(x.xong); ok_(x.phieu);
    eq_(call_(a, 'listProblems').filter(function (p) { return p.ma_bai === 'TEST-01'; })[0].giao.xong, true);
    call_(a, 'markDone', { ky: 'K-MO', ma_bai: 'TEST-01', xong: false });
    call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-01', diem: 'không chọn' });
    eq_(rows_('Reviews')[0].diem, 'không chọn');
  });
  test_('13.6', 'Nhắc hạn: đúng 3 và 1 ngày trước hạn (đổi được bằng REMINDER_DAYS); mỗi mốc một lần; không nhắc người đã xong hoặc chưa mời', 'T1+T2', function () {
    update_('Rounds', findRow_('Rounds', 'ky', 'K-MO').row, { han_phan_bien: "'2026-10-20" });
    TEST_CONF.TODAY = '2026-10-10';
    call_(login_(A.QT), 'sendInvites', { ky: 'K-MO' }); TEST_OUTBOX = [];
    call_(login_(A.T2), 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-02', diem: 'chọn' });
    call_(login_(A.T2), 'markDone', { ky: 'K-MO', ma_bai: 'TEST-02' });
    call_(login_(A.QT), 'assign', { ky: 'K-MO', ma_bai: 'TEST-04', email: A.T2 });      // giao thêm, chưa mời
    TEST_CONF.TODAY = '2026-10-16'; eq_(sendReminders(), 0, '4 ngày: chưa nhắc');
    TEST_CONF.TODAY = '2026-10-17'; eq_(sendReminders(), 1, '3 ngày: nhắc T1');
    eq_(TEST_OUTBOX[0].to, A.T1); has_s_(TEST_OUTBOX[0].subject, 'còn 3 ngày'); has_s_(TEST_OUTBOX[0].body, '2 bài');
    eq_(sendReminders(), 0, 'chạy lại cùng ngày không gửi trùng');
    TEST_CONF.TODAY = '2026-10-18'; eq_(sendReminders(), 0);
    TEST_CONF.TODAY = '2026-10-19'; eq_(sendReminders(), 1, '1 ngày: nhắc lần hai');
    eq_(findRow_('Assignments', 'ma_bai', 'TEST-01').data.nhac, '3,1');
    eq_(TEST_OUTBOX.filter(function (m) { return m.to === A.T2; }).length, 0, 'T2 đã xong / bài mới chưa mời: không nhắc');
    var v = call_(login_(A.QT), 'rounds'); eq_(v.today, '2026-10-19');
    eq_(v.rounds.filter(function (r) { return r.ky === 'K-MO'; })[0].con_ngay, 1, 'trang Kỳ phản biện cho biết còn mấy ngày');
    TEST_CONF.REMINDER_DAYS = '2'; TEST_CONF.TODAY = '2026-10-18';
    putRows_('Assignments', [{ ky: 'K-MO', ma_bai: 'TEST-01', email: A.T1, moi_luc: now_(), xong: false }]);
    eq_(sendReminders(), 1, 'REMINDER_DAYS=2');
  });
  test_('13.7', 'Đóng kỳ: phản biện không còn thấy bài, không nộp phiếu; không giao thêm; chỉ PT, Quản trị đóng được', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'closeRound', { ky: 'K-MO' }); }, 'Không có quyền');
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
    call_(login_(A.QT), 'closeRound', { ky: 'K-MO' });
    eq_(call_(login_(A.T1), 'listProblems').length, 0);
    throws_(function () { call_(login_(A.T1), 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-01', diem: 'chọn' }); }, 'đã đóng');
    throws_(function () { call_(login_(A.QT), 'assign', { ky: 'K-MO', ma_bai: 'TEST-04', email: A.T1 }); }, 'đã đóng');
    throws_(function () { call_(login_(A.QT), 'closeRound', { ky: 'K-MO' }); }, 'đã đóng');
    ok_(findRow_('Rounds', 'ky', 'K-MO').data.khoa_luc, 'ghi lúc đóng');
  });
  test_('13.8', 'Thảo luận ẩn danh: phản biện thấy "Bạn", "Phản biện 1", "Ban biên tập" — không có email nào; ban biên tập thấy email', 'T1+T2', function () {
    call_(login_(A.T1), 'addComment', { ma_bai: 'TEST-02', noi_dung: 'Nhận xét của T1' });
    call_(login_(A.QT), 'addComment', { ma_bai: 'TEST-02', noi_dung: 'Ý kiến ban biên tập' });
    call_(login_(A.T2), 'addComment', { ma_bai: 'TEST-02', noi_dung: 'Nhận xét của T2' });
    var d = call_(login_(A.T2), 'getProblem', { ma_bai: 'TEST-02' });
    eq_(d.comments.map(function (c) { return c.ai; }), ['Phản biện 1', 'Ban biên tập', 'Bạn']);
    var j = JSON.stringify(d); lacks_(j, A.T1); lacks_(j, A.QT); lacks_(j, '"email"');
    var b = JSON.stringify(call_(login_(A.T2), 'bundle')); lacks_(b, A.T1, 'tải gộp'); lacks_(b, A.QT, 'tải gộp');
    eq_(call_(login_(A.QT), 'getProblem', { ma_bai: 'TEST-02' }).comments.map(function (c) { return c.email; }), [A.T1, A.QT, A.T2]);
  });
  test_('13.9', 'Bỏ giao bài: phản biện mất quyền xem, phiếu đã nộp vẫn giữ; trang Kỳ phản biện của PB chỉ có bài của mình', 'T1', function () {
    var a = login_(A.T1);
    call_(a, 'submitReview', { ky: 'K-MO', ma_bai: 'TEST-01', diem: 'chọn' });
    var v = call_(a, 'rounds'); eq_(v.manage, false); eq_(v.rounds, []); eq_(v.mine.map(function (m) { return m.ma_bai; }).sort(), ['TEST-01', 'TEST-02']);
    call_(login_(A.QT), 'unassign', { ky: 'K-MO', ma_bai: 'TEST-01', email: A.T1 });
    throws_(function () { call_(a, 'getProblem', { ma_bai: 'TEST-01' }); }, 'Không có quyền');
    eq_(rows_('Reviews').length, 1, 'phiếu giữ nguyên');
    throws_(function () { call_(login_(A.QT), 'unassign', { ky: 'K-MO', ma_bai: 'TEST-01', email: A.T1 }); }, 'Không có phân công');
  });
  test_('13.10', 'Đổi hạn: chỉ PT, Quản trị; ngày sai bị từ chối; mốc nhắc tính theo hạn mới', 'QT', function () {
    TEST_CONF.TODAY = '2026-10-10';
    var tok = login_(A.QT);
    throws_(function () { call_(tok, 'setDeadline', { ky: 'K-MO', han_phan_bien: '2026-10-01' }); }, 'quá khứ');
    call_(tok, 'setDeadline', { ky: 'K-MO', han_phan_bien: '2026-10-13' });
    eq_(findRow_('Rounds', 'ky', 'K-MO').data.han_phan_bien, '2026-10-13');
    call_(tok, 'sendInvites', { ky: 'K-MO' }); TEST_OUTBOX = [];
    eq_(sendReminders(), 2, 'còn 3 ngày theo hạn mới');
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'setDeadline', { ky: 'K-MO', han_phan_bien: '2026-10-30' }); }, 'Không có quyền');
  });

  test_('13.11', 'Kỳ phản biện tên "10/2026" (dạng ngày) vẫn giữ nguyên chữ qua giao bài, thư mời, đóng kỳ', 'QT', function () {
    TEST_CONF.TODAY = '2026-10-10'; var tok = login_(A.QT);
    call_(tok, 'openRound', { ky: '10/2026', han_phan_bien: '2026-10-20' });
    call_(tok, 'assign', { ky: '10/2026', ma_bai: 'TEST-04', email: A.T1 });
    eq_(call_(tok, 'sendInvites', { ky: '10/2026' }).sent, 1);
    eq_(call_(login_(A.T1), 'listProblems').filter(function (p) { return p.ma_bai === 'TEST-04'; })[0].giao.ky, '10/2026');
    call_(tok, 'closeRound', { ky: '10/2026' });
    eq_(findRow_('Rounds', 'ky', '10/2026').data.trang_thai, 'đóng');
  });

  test_('13.12', 'Lời giải: phản biện KHÔNG nhận lời giải (cả trong tải gộp) cho tới khi PT/TBT mở cho kỳ; mở rồi thì thấy; đóng lại thì ẩn; NCB, PB không mở được; ban biên tập luôn thấy', 'T1', function () {
    var tok = login_(A.T1), lg = function (t) { return call_(t, 'getProblem', { ma_bai: 'TEST-02' }).problem.loi_giai; };
    eq_(lg(tok), '', 'chưa mở'); ok_(call_(tok, 'getProblem', { ma_bai: 'TEST-02' }).loi_giai_an);
    eq_(call_(tok, 'bundle').details['TEST-02'].problem.loi_giai, '', 'tải gộp cũng không có');
    lacks_(JSON.stringify(call_(tok, 'bundle')), 'Lời giải thử TEST-02');
    eq_(lg(login_(A.QT)), 'Lời giải thử TEST-02.', 'Quản trị luôn thấy');
    ['NCB', 'PB'].forEach(function (r) {
      setUsers_({ QT: 'Quản trị', T1: 'PB', T2: r });
      throws_(function () { call_(login_(A.T2), 'releaseSolutions', { ky: 'K-MO' }); }, 'Không có quyền');
    });
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'TBT' });
    call_(login_(A.T2), 'releaseSolutions', { ky: 'K-MO' });
    ok_(String(findRow_('Rounds', 'ky', 'K-MO').data.mo_loi_giai), 'ghi lúc mở');
    eq_(lg(tok), 'Lời giải thử TEST-02.', 'đã mở');
    eq_(call_(login_(A.QT), 'rounds').rounds.filter(function (r) { return r.ky === 'K-MO'; })[0].mo_loi_giai !== '', true);
    call_(login_(A.QT), 'releaseSolutions', { ky: 'K-MO', mo: false });
    eq_(lg(tok), '', 'đóng lại');
    ok_(auditHas_('mở lời giải cho phản biện', 'K-MO')); ok_(auditHas_('đóng lời giải', 'K-MO'));
    throws_(function () { call_(login_(A.QT), 'releaseSolutions', { ky: 'K-DONG' }); });
  });

  // 14. Bảng chọn bài
  var B3 = function () { TEST_CONF.BOARD_LAYOUT = 'B,A,A'; };
  var placeAll = function (tok, so, list) { list.forEach(function (m, i) { call_(tok, 'place', { so: so, vi_tri: i + 1, ma_bai: m }); }); };
  test_('14.1', 'PT lập bảng cho một số báo; số "10/2026" lưu như chữ; bố cục mặc định 4 bài B rồi 6 bài A; NCB, TBT, PB không lập được', 'T1', function () {
    ['NCB', 'TBT', 'PB'].forEach(function (r) {
      setUsers_({ QT: 'Quản trị', T1: r, T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'newBoard', { so: '10/2026' }); }, 'Không có quyền');
    });
    setUsers_({ QT: 'Quản trị', T1: 'PT', T2: 'PB' });
    var tok = login_(A.T1);
    call_(tok, 'newBoard', { so: '10/2026' });
    throws_(function () { call_(tok, 'newBoard', { so: '10/2026' }); }, 'Đã có bảng');
    var i = findRow_('Issues', 'so', '10/2026'); ok_(i, 'tìm được theo chữ "10/2026"'); eq_(typeof i.data.so, 'string');
    var v = call_(tok, 'boards'); eq_(v.layout, ['B', 'B', 'B', 'B', 'A', 'A', 'A', 'A', 'A', 'A']); ok_(v.manage); eq_(v.boards[0].trang_thai, 'đang chọn');
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'boards'); }, 'Không có quyền');
  });
  test_('14.2', 'Xếp bài: vị trí ngoài bố cục, bài đã đăng, bài ở bảng khác bị từ chối; đặt vào chỗ có bài thì thay; đặt lại bài đã có thì chuyển chỗ', 'QT', function () {
    B3(); var tok = login_(A.QT);
    call_(tok, 'newBoard', { so: '10/2026' }); call_(tok, 'newBoard', { so: '11/2026' });
    throws_(function () { call_(tok, 'place', { so: '10/2026', vi_tri: 4, ma_bai: 'TEST-01' }); }, 'Vị trí phải từ 1 đến 3');
    throws_(function () { call_(tok, 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'TEST-05' }); }, 'đã đăng');
    throws_(function () { call_(tok, 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'KHONG-CO' }); }, 'Không có bài');
    call_(tok, 'place', { so: '11/2026', vi_tri: 1, ma_bai: 'TEST-04' });
    throws_(function () { call_(tok, 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'TEST-04' }); }, 'đang ở bảng số 11/2026');
    call_(tok, 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'TEST-02' });
    call_(tok, 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'TEST-01' });          // thay
    call_(tok, 'place', { so: '10/2026', vi_tri: 2, ma_bai: 'TEST-01' });          // chuyển chỗ
    var rows = boardRows_('10/2026'); eq_(rows.map(function (r) { return [Number(r.vi_tri), r.ma_bai, r.phuong_an]; }), [[2, 'TEST-01', 'A']]);
    eq_(typeof rows[0].ky, 'string', 'số báo vẫn là chữ sau khi ghi Shortlist');
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'TEST-02' }); }, 'Không có quyền');
    eq_(call_(login_(A.T1), 'boards').boards.length, 2, 'NCB xem được');
  });
  test_('14.3', 'Gửi TBT: phải đủ bài; khi chờ duyệt không sửa được; TBT trả lại phải ghi lý do; số báo không bị đổi thành ngày', 'T1', function () {
    B3(); setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    var pt = login_(A.QT), tbt = login_(A.T1);
    call_(pt, 'newBoard', { so: '10/2026' });
    placeAll(pt, '10/2026', ['TEST-02', 'TEST-01']);
    throws_(function () { call_(pt, 'submitBoard', { so: '10/2026' }); }, 'chưa đủ 3');
    call_(pt, 'place', { so: '10/2026', vi_tri: 3, ma_bai: 'TEST-03' });
    call_(pt, 'submitBoard', { so: '10/2026' });
    throws_(function () { call_(pt, 'unplace', { so: '10/2026', vi_tri: 1 }); }, 'mở lại trước khi sửa');
    throws_(function () { call_(tbt, 'returnBoard', { so: '10/2026', ghi_chu: ' ' }); }, 'Lý do');
    call_(tbt, 'returnBoard', { so: '10/2026', ghi_chu: 'Thay bài vị trí 1.' });
    var i = findRow_('Issues', 'so', '10/2026');
    ok_(i, 'số báo vẫn tìm được sau khi đổi trạng thái'); eq_(typeof i.data.so, 'string'); eq_(i.data.trang_thai, 'đang chọn'); eq_(i.data.ghi_chu, 'Thay bài vị trí 1.');
  });
  test_('14.4', 'TBT duyệt: bài được chọn thành SL-OK và nhận mức của vị trí; bài khác giữ nguyên; PT không duyệt được', 'T1', function () {
    B3(); setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    var pt = login_(A.QT), tbt = login_(A.T1);
    call_(pt, 'newBoard', { so: '10/2026' });
    placeAll(pt, '10/2026', ['TEST-01', 'TEST-02', 'TEST-03']);     // TEST-01 (mức A) vào vị trí B; TEST-02 (B) vào vị trí A
    throws_(function () { call_(tbt, 'approveBoard', { so: '10/2026' }); }, 'chưa được gửi duyệt');
    call_(pt, 'submitBoard', { so: '10/2026' });
    setUsers_({ QT: 'Quản trị', T1: 'PT', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'approveBoard', { so: '10/2026' }); }, 'Không có quyền');
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    call_(login_(A.T1), 'approveBoard', { so: '10/2026', ghi_chu: 'Đồng ý.' });
    var g = function (m) { return findRow_('Problems', 'ma_bai', m).data; };
    eq_([g('TEST-01').trang_thai, g('TEST-01').muc], ['SL-OK', 'B']); eq_([g('TEST-02').trang_thai, g('TEST-02').muc], ['SL-OK', 'A']);
    eq_(g('TEST-03').trang_thai, 'SL-OK'); eq_(g('TEST-04').trang_thai, 'Mới', 'bài không chọn giữ nguyên');
    var i = findRow_('Issues', 'so', '10/2026').data; eq_(i.trang_thai, 'đã duyệt'); eq_(i.nguoi_duyet, A.T1);
    ok_(auditHas_('duyệt bảng chọn bài', 'TEST-01, TEST-02, TEST-03'));
  });
  test_('14.5', 'Mở lại sau khi duyệt để thay bài: trạng thái, mức trả về như trước; bài bị thay giữ trạng thái cũ; duyệt lại thì bài mới thành SL-OK', 'T1', function () {
    B3(); setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    var pt = login_(A.QT), tbt = login_(A.T1);
    var hit = findRow_('Problems', 'ma_bai', 'TEST-02'); update_('Problems', hit.row, { muc: '' });       // bài chưa có mức
    call_(pt, 'newBoard', { so: '10/2026' });
    placeAll(pt, '10/2026', ['TEST-01', 'TEST-02', 'TEST-03']);
    call_(pt, 'submitBoard', { so: '10/2026' }); call_(tbt, 'approveBoard', { so: '10/2026' });
    setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
    throws_(function () { call_(login_(A.T1), 'reopenBoard', { so: '10/2026' }); }, 'Không có quyền');
    setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    call_(login_(A.T1), 'reopenBoard', { so: '10/2026' });
    var g = function (m) { return findRow_('Problems', 'ma_bai', m).data; };
    eq_([g('TEST-01').trang_thai, g('TEST-01').muc], ['Mới', 'A']); eq_([g('TEST-02').trang_thai, g('TEST-02').muc], ['SL', '']);
    eq_(g('TEST-03').trang_thai, 'SL-OK', 'bài vốn đã SL-OK trước khi duyệt');
    call_(pt, 'place', { so: '10/2026', vi_tri: 2, ma_bai: 'TEST-04' });
    call_(pt, 'submitBoard', { so: '10/2026' }); call_(login_(A.T1), 'approveBoard', { so: '10/2026' });
    eq_([g('TEST-04').trang_thai, g('TEST-04').muc], ['SL-OK', 'A']); eq_(g('TEST-02').trang_thai, 'SL', 'bài bị thay giữ trạng thái cũ');
    ok_(auditHas_('mở lại bảng chọn bài', '(huỷ duyệt)'));
  });
  test_('14.6', 'Đổi chỗ hai vị trí: thứ tự đổi, mức đi theo vị trí', 'QT', function () {
    B3(); var tok = login_(A.QT);
    call_(tok, 'newBoard', { so: '10/2026' });
    placeAll(tok, '10/2026', ['TEST-01', 'TEST-02']);
    call_(tok, 'swap', { so: '10/2026', a: 1, b: 2 });
    eq_(boardRows_('10/2026').map(function (r) { return [Number(r.vi_tri), r.ma_bai, r.phuong_an]; }), [[1, 'TEST-02', 'B'], [2, 'TEST-01', 'A']]);
  });
  test_('14.7', 'Trang bảng chọn bài: mỗi bài kèm tóm tắt phiếu phản biện, chấm kiểm tra/xung đột và bảng đang giữ bài', 'QT', function () {
    putRows_('Reviews', [{ id: 'r1', ky: 'K-MO', ma_bai: 'TEST-02', email: A.T1, muc_de_nghi: 'A', diem: 'chọn' },
                         { id: 'r2', ky: 'K-MO', ma_bai: 'TEST-02', email: A.T2, muc_de_nghi: 'B', diem: 'sửa rồi chọn' }]);
    var tok = login_(A.QT); B3();
    call_(tok, 'newBoard', { so: '10/2026' }); call_(tok, 'place', { so: '10/2026', vi_tri: 1, ma_bai: 'TEST-02' });
    var ps = call_(tok, 'boards').problems, by = {}; ps.forEach(function (p) { by[p.ma_bai] = p; });
    eq_(by['TEST-02'].phieu, { n: 2, chon: 1, sua: 1, khong: 0, A: 1, B: 1 }); eq_(by['TEST-02'].bang, '10/2026');
    eq_(by['TEST-01'].checks, 1); eq_(by['TEST-01'].conflicts, 1); eq_(by['TEST-01'].bang, '');
  });

  // 15. Khoá kỳ: số in, tệp .tex chỉ có đề bài, Published, PL
  var L4 = function () { TEST_CONF.BOARD_LAYOUT = 'B,B,A,A'; };
  /** Bảng 10/2026 đã duyệt: TEST-04 (TH), TEST-02 (HH) ở vị trí B; TEST-01 (ĐS), TEST-03 (SH) ở vị trí A. QT = Quản trị, T1 = TBT. */
  var approved4 = function () {
    L4(); setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' });
    var pt = login_(A.QT);
    call_(pt, 'newBoard', { so: '10/2026' });
    placeAll(pt, '10/2026', ['TEST-04', 'TEST-02', 'TEST-01', 'TEST-03']);
    call_(pt, 'submitBoard', { so: '10/2026' }); call_(login_(A.T1), 'approveBoard', { so: '10/2026' });
    return pt;
  };
  /** Thư mục Drive tạm cho tệp xuất (và thư mục hình), xoá sau kịch bản. */
  var withFolders = function (fn) {
    var ex = DriveApp.createFolder('Pi ĐRKN — kiểm thử xuất (xoá được)'), fig = DriveApp.createFolder('Pi ĐRKN — kiểm thử hình (xoá được)');
    TEST_CONF.EXPORT_FOLDER_ID = ex.getId(); TEST_CONF.FIG_FOLDER_ID = fig.getId();
    try { fn(ex, fig); } finally { ex.setTrashed(true); fig.setTrashed(true); }
  };
  var zipNames = function (url) {
    var id = String(url).replace(/^.*\/d\/([^/?]+).*$/, '$1');
    var out = {}; Utilities.unzip(DriveApp.getFileById(id).getBlob()).forEach(function (b) { out[b.getName()] = b; });
    return out;
  };
  test_('15.1', 'Xem trước khoá kỳ: chỉ bảng đã duyệt; thứ tự B rồi A, trong mức SH, ĐS, HH, TH; Published trống thì không gợi ý số; NCB, PB, BTK không xem được', 'QT', function () {
    L4(); var pt = login_(A.QT);
    call_(pt, 'newBoard', { so: '10/2026' });
    throws_(function () { call_(pt, 'closePreview', { so: '10/2026' }); }, 'đã được TBT duyệt');
    putRows_('Issues', []); putRows_('Shortlist', []);
    approved4();
    var v = call_(pt, 'closePreview', { so: '10/2026' });
    eq_(v.goi_y, null); eq_(v.bat_dau, null); eq_(v.tex, '');
    eq_(v.items.map(function (i) { return i.ma_bai; }), ['TEST-02', 'TEST-04', 'TEST-03', 'TEST-01']);
    v = call_(pt, 'closePreview', { so: '10/2026', bat_dau: 'P1041' });
    eq_(v.items.map(function (i) { return i.so_in; }), ['P1041', 'P1042', 'P1043', 'P1044']);
    eq_(v.blockers, []);
    ok_(v.warnings.some(function (x) { return x.indexOf('TEST-01: còn 1 mục cần kiểm tra') === 0; }), 'báo mục cần kiểm tra');
    ok_(v.warnings.some(function (x) { return x.indexOf('TEST-01: còn 1 xung đột mở') === 0; }), 'báo xung đột mở');
    ['NCB', 'PB', 'BTK'].forEach(function (r) {
      setUsers_({ QT: 'Quản trị', T1: r, T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'closePreview', { so: '10/2026' }); }, 'Không có quyền');
    });
  });
  test_('15.2', 'Số in gợi ý = số lớn nhất trong Published + 1', 'QT', function () {
    approved4();
    putRows_('Published', [{ ma_bai: 'CU-1', so_tap_chi: "'9/2026", so_in: 'P1040', ngay: now_() },
                           { ma_bai: 'CU-2', so_tap_chi: "'9/2026", so_in: 'P0999', ngay: now_() }]);
    var v = call_(login_(A.QT), 'closePreview', { so: '10/2026' });
    eq_(v.goi_y, 1041); eq_(v.items[0].so_in, 'P1041'); has_s_(v.tex, '\\setcounter{stthuc}{1040}');
  });
  test_('15.3', 'Khoá kỳ: phải xác nhận lưu ý; ghi Published, bài thành PL kèm số in; bảng "đã khoá", không mở lại, không sửa, không khoá lần hai', 'T1', function () {
    approved4();
    withFolders(function () {
      var tbt = login_(A.T1);
      throws_(function () { call_(tbt, 'closeIssue', { so: '10/2026', bat_dau: '1041' }); }, 'cần xác nhận');
      eq_(rows_('Published').length, 0, 'chưa ghi gì');
      var r = call_(tbt, 'closeIssue', { so: '10/2026', bat_dau: '1041', xac_nhan: true });
      eq_(r.so_in, ['TEST-02 → P1041', 'TEST-04 → P1042', 'TEST-03 → P1043', 'TEST-01 → P1044']);
      var pub = rows_('Published');
      eq_(pub.map(function (x) { return [x.ma_bai, x.so_tap_chi, x.so_in]; }),
          [['TEST-02', '10/2026', 'P1041'], ['TEST-04', '10/2026', 'P1042'], ['TEST-03', '10/2026', 'P1043'], ['TEST-01', '10/2026', 'P1044']]);
      var g = function (m) { return findRow_('Problems', 'ma_bai', m).data; };
      eq_([g('TEST-02').trang_thai, g('TEST-02').so_in, g('TEST-02').dang], ['PL', 'P1041', '10/2026']);
      var i = findRow_('Issues', 'so', '10/2026').data; eq_(i.trang_thai, 'đã khoá'); ok_(i.tep, 'có đường dẫn tệp xuất'); ok_(i.khoa_luc);
      ok_(auditHas_('khoá kỳ', 'TEST-02 → P1041'));
      throws_(function () { call_(tbt, 'reopenBoard', { so: '10/2026' }); }, 'đã khoá kỳ');
      throws_(function () { call_(login_(A.QT), 'unplace', { so: '10/2026', vi_tri: 1 }); }, 'mở lại trước khi sửa');
      throws_(function () { call_(tbt, 'closeIssue', { so: '10/2026', bat_dau: '1051', xac_nhan: true }); }, 'đã được TBT duyệt');
      eq_(rows_('Published').length, 4);
      eq_(call_(tbt, 'boards').boards[0].trang_thai, 'đã khoá');
    });
  });
  test_('15.4', 'Số in trùng với Published hoặc không hợp lệ bị từ chối, không ghi gì', 'QT', function () {
    approved4();
    putRows_('Published', [{ ma_bai: 'CU-1', so_tap_chi: "'9/2026", so_in: 'P1042', ngay: now_() }]);
    withFolders(function (ex) {
      var pt = login_(A.QT);
      throws_(function () { call_(pt, 'closeIssue', { so: '10/2026', bat_dau: '1041', xac_nhan: true }); }, 'Số in đã dùng: P1042 (CU-1)');
      throws_(function () { call_(pt, 'closeIssue', { so: '10/2026', bat_dau: 'abc', xac_nhan: true }); }, 'số nguyên dương');
      throws_(function () { call_(pt, 'closeIssue', { so: '10/2026', bat_dau: '0', xac_nhan: true }); }, 'số nguyên dương');
      eq_(rows_('Published').length, 1); eq_(findRow_('Problems', 'ma_bai', 'TEST-02').data.trang_thai, 'SL-OK');
      eq_(findRow_('Issues', 'so', '10/2026').data.trang_thai, 'đã duyệt');
      ok_(!ex.getFilesByName('de-ra-ky-nay-10-2026.zip').hasNext(), 'không lưu tệp xuất');
    });
  });
  test_('15.5', 'Thiếu tên tác giả để in hoặc đề trống thì chặn khoá (dù đã xác nhận)', 'QT', function () {
    approved4();
    var hit = findRow_('Authors', 'tac_gia_id', 'TG2'); update_('Authors', hit.row, { ten_in: ' ' });
    var pt = login_(A.QT), v = call_(pt, 'closePreview', { so: '10/2026', bat_dau: '1041' });
    eq_(v.blockers, ['TEST-04: thiếu tên tác giả để in']);
    throws_(function () { call_(pt, 'closeIssue', { so: '10/2026', bat_dau: '1041', xac_nhan: true }); }, 'thiếu tên tác giả');
    update_('Authors', hit.row, { ten_in: 'Người Viết Khác' });
    var p = findRow_('Problems', 'ma_bai', 'TEST-03'); update_('Problems', p.row, { de_bai: '' });
    throws_(function () { call_(pt, 'closeIssue', { so: '10/2026', bat_dau: '1041', xac_nhan: true }); }, 'TEST-03: đề bài trống');
    eq_(rows_('Published').length, 0);
  });
  test_('15.6', 'Tệp .tex: chỉ đề bài, theo mẫu cột (setcounter, thụt dòng, dòng tác giả); không lời giải, ghi chú, liên hệ; **đậm**/*nghiêng* ngoài công thức; NFC', 'QT', function () {
    approved4();
    var p = findRow_('Problems', 'ma_bai', 'TEST-02');
    var au = findRow_('Authors', 'tac_gia_id', 'TG2'); update_('Authors', au.row, { ten_in: 'Người Vie\u0302\u0301t Khác' });
    update_('Problems', p.row, { de_bai: 'Cho **tam giác** $a*b*c$ và *đẹp* cafe\u0301.\n\\begin{enumerate}\n\\item Ý một.\n\\end{enumerate}' });
    var t = call_(login_(A.QT), 'closePreview', { so: '10/2026', bat_dau: '1041' }).tex;
    has_s_(t, '\\input{structure/dinhdang}'); has_s_(t, '\\setcounter{stthuc}{1040}'); has_s_(t, '\\graphicspath{{pic/}}');
    eq_(t.split('\\thachthuc (Mức $B$)').length - 1, 2); eq_(t.split('\\thachthuc (Mức $A$)').length - 1, 2);
    has_s_(t, '\n\\thachthuc (Mức $B$)\n  Cho \\textbf{tam giác} $a*b*c$ và \\emph{đẹp} caf\u00e9.\n  \\begin{enumerate}\n    \\item Ý một.\n  \\end{enumerate}\n');
    has_s_(t, '\\begin{flushright}\n\\textit{' + FX_AUTHOR + ' (Trường Thử)}\n\\end{flushright}');
    has_s_(t, '\\textit{Người Viết Khác}\n');
    ['Lời giải thử', 'Đề gốc', FX_CONTACT, 'mục cần kiểm tra', 'Tên in ' + FX_AUTHOR, '\\usepackage{mathrsfs}\n\\usepackage'].forEach(function (x) { lacks_(t, x); });
    lacks_(t, 'e\u0301', 'phải ở dạng NFC');
    ok_(t.indexOf('P1041 — Mức B — Hình học — TEST-02') < t.indexOf('P1042 — Mức B — Tổ hợp — TEST-04'), 'thứ tự');
    has_s_(t.slice(-16), '\\end{document}\n');
  });
  test_('15.7', 'Hình: TikZ đặt ngay trong tệp; hình ảnh vào pic/ của zip; hình thiếu được báo; BTK tải lại được tệp của số đã khoá', 'QT', function () {
    approved4();
    var set = function (m, h) { var p = findRow_('Problems', 'ma_bai', m); update_('Problems', p.row, { hinh: h }); };
    set('TEST-02', '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}');
    set('TEST-03', 'hinh-thu.png'); set('TEST-01', 'khong-co.png');
    withFolders(function (ex, fig) {
      fig.createFile(Utilities.newBlob('ảnh thử', 'image/png', 'hinh-thu.png'));
      var pt = login_(A.QT);
      var r = call_(pt, 'closeIssue', { so: '10/2026', bat_dau: '7', xac_nhan: true });
      eq_(r.missing_pics, ['khong-co.png']); eq_(r.name, 'de-ra-ky-nay-10-2026.zip');
      var z = zipNames(r.url);
      eq_(Object.keys(z).sort(), ['de-ra-ky-nay-10-2026.tex', 'pic/hinh-thu.png']);
      eq_(z['pic/hinh-thu.png'].getDataAsString(), 'ảnh thử');
      var t = z['de-ra-ky-nay-10-2026.tex'].getDataAsString();
      has_s_(t, '\\setcounter{stthuc}{6}');
      has_s_(t, '\\begin{center}\n\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}\n\\end{center}');
      has_s_(t, '\\includegraphics[width=0.45\\textwidth]{hinh-thu.png}');
      setUsers_({ QT: 'Quản trị', T1: 'BTK', T2: 'PB' });
      var e = call_(login_(A.T1), 'exportOf', { so: '10/2026' });
      eq_(e.url, r.url); eq_(e.tex, t, 'tệp tải lại giống tệp đã lưu');
      setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'exportOf', { so: '10/2026' }); }, 'Không có quyền');
    });
  });

  // 16. Hình: cột Hình, SVG theo mã của khối TikZ, trang Hình (tải mã nguồn, tải SVG lên)
  var TZ = '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}';
  var SVG_OK = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10">' +
               '<defs><path id="g1" d="M0 0L5 5"/></defs><use xlink:href="#g1"/></svg>';
  var setP = function (ma, o) { var h = findRow_('Problems', 'ma_bai', ma); update_('Problems', h.row, o); };
  var b64zip = function (name, files) {
    return { name: name, b64: Utilities.base64Encode(Utilities.zip(files.map(function (f) { return Utilities.newBlob(f[1], 'text/plain', f[0]); }), name).getBytes()) };
  };
  test_('16.1', 'Mã hình (SHA-256 của khối TikZ) khớp tools/hinh/build.py; không phụ thuộc NFC/NFD, \\r\\n', 'QT', function () {
    eq_(figKey_(TZ), '1435a39e5123382b', 'cùng giá trị với tests/hinh.test.py');
    eq_(figKey_('\\begin{tikzpicture}\r\n\\node{Điểm};\r\n\\end{tikzpicture}'), figKey_('\\begin{tikzpicture}\n\\node{Đie\u0302\u0309m};\n\\end{tikzpicture}'));
    eq_(tikzBlocks_('a ' + TZ + ' b ' + TZ.replace('1,1', '2,2')).length, 2);
  }, { keep: true });
  test_('16.2', 'Sửa cột Hình: TikZ hoặc tên tệp ảnh; nội dung lạ, lệnh đọc tệp, khối lệch, tên lạ bị từ chối, bài không đổi; PB không sửa được', 'T1', function () {
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var tok = login_(A.T1), v = function () { return Number(findRow_('Problems', 'ma_bai', 'TEST-02').data.phien_ban); }, v0 = v();
    eq_(call_(tok, 'saveText', { ma_bai: 'TEST-02', truong: 'hinh', noi_dung: TZ, phien_ban: v0 }).phien_ban, v0 + 1);
    ok_(rows_('Revisions').some(function (r) { return r.truong === 'hinh' && r.moi === TZ; }), 'có lịch sử');
    eq_(call_(tok, 'saveText', { ma_bai: 'TEST-02', truong: 'hinh', noi_dung: 'hinh-a.png\nhinh b.jpg', phien_ban: v0 + 1 }).phien_ban, v0 + 2);
    [['ghi chú ' + TZ, 'Ngoài các khối'], ['\\begin{tikzpicture}\\input{/etc/hostname}\\end{tikzpicture}', 'không được dùng lệnh \\input'],
     ['\\begin{tikzpicture}\\draw (0,0)--(1,1);', 'không bằng nhau'], ['../bi-mat.png', 'không hiểu'], ['=HYPERLINK("x")', 'không hiểu']]
      .forEach(function (c) { throws_(function () { call_(tok, 'saveText', { ma_bai: 'TEST-02', truong: 'hinh', noi_dung: c[0], phien_ban: v0 + 2 }); }, c[1]); });
    eq_(v(), v0 + 2, 'bài không đổi'); eq_(findRow_('Problems', 'ma_bai', 'TEST-02').data.hinh, 'hinh-a.png\nhinh b.jpg');
    throws_(function () { call_(login_(A.T2), 'saveText', { ma_bai: 'TEST-02', truong: 'hinh', noi_dung: '', phien_ban: v0 + 2 }); }, 'Không có quyền');
  });
  test_('16.3', 'Trang bài: hình TikZ hiện SVG khi đã dựng (cả khối trong đề bài), "chưa dựng" khi sửa TikZ; ảnh theo tên; tên thiếu được báo; phản biện được giao cũng thấy', 'T1', function () {
    withFolders(function (ex, fig) {
      var tz2 = TZ.replace('1,1', '3,1');
      setP('TEST-02', { hinh: TZ, de_bai: 'Cho hình ' + tz2 + ' sau.' });
      var tok = login_(A.T1), h = call_(tok, 'getProblem', { ma_bai: 'TEST-02' }).hinh;
      eq_(Object.keys(h.figs).length, 0, 'chưa dựng');
      fig.createFile(Utilities.newBlob(SVG_OK, 'image/svg+xml', 'tikz-' + figKey_(TZ) + '.svg'));
      fig.createFile(Utilities.newBlob(SVG_OK, 'image/svg+xml', 'tikz-' + figKey_(tz2) + '.svg'));
      h = call_(tok, 'getProblem', { ma_bai: 'TEST-02' }).hinh;
      eq_(Object.keys(h.figs).sort(), [TZ, tz2].sort());
      ok_(/^data:image\/svg\+xml;base64,/.test(h.figs[TZ]), 'data URI SVG');
      setP('TEST-02', { hinh: TZ.replace('1,1', '1,2') });
      h = call_(tok, 'getProblem', { ma_bai: 'TEST-02' }).hinh;
      eq_(Object.keys(h.figs), [tz2], 'TikZ đã sửa: hình cũ không hiện cho mã mới');
      fig.createFile(Utilities.newBlob('ảnh thử', 'image/png', 'hinh-a.png'));
      setP('TEST-02', { hinh: 'hinh-a.png\nkhong-co.png' });
      h = call_(login_(A.QT), 'getProblem', { ma_bai: 'TEST-02' }).hinh;
      eq_(Object.keys(h.pics), ['hinh-a.png']); eq_(h.thieu, ['khong-co.png']);
      eq_(call_(login_(A.QT), 'bundle').details['TEST-02'].hinh, undefined, 'tải gộp không mang hình');
    });
  });
  test_('16.4', 'Trang Hình: liệt kê hình TikZ (đề, lời giải, cột Hình) và ảnh, đã dựng chưa; chỉ NCB, PT, Quản trị', 'T1', function () {
    withFolders(function (ex, fig) {
      setP('TEST-02', { hinh: TZ, loi_giai: 'Xem ' + TZ.replace('1,1', '0,1') });
      setP('TEST-04', { hinh: 'mat.png' });
      fig.createFile(Utilities.newBlob(SVG_OK, 'image/svg+xml', 'tikz-' + figKey_(TZ) + '.svg'));
      setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
      var it = call_(login_(A.T1), 'figures').items;
      eq_(it.map(function (x) { return [x.ma_bai, x.noi, x.da_dung]; }),
          [['TEST-02', 'lời giải', false], ['TEST-02', 'hình', true], ['TEST-04', 'ảnh (đề)', false]]);
      ok_(it.every(function (x) { return x.src === undefined; }), 'danh sách không mang mã nguồn');
      ['PB', 'TBT', 'VP', 'BTK'].forEach(function (r) {
        setUsers_({ QT: 'Quản trị', T1: r, T2: 'PB' });
        throws_(function () { call_(login_(A.T1), 'figures'); }, 'Không có quyền');
      });
    });
  });
  test_('16.5', 'Tải mã nguồn: zip gồm tikz-<mã>.tex (đúng khối) và danh sách; mặc định chỉ hình chưa dựng; không còn gì thì báo 0', 'QT', function () {
    withFolders(function (ex, fig) {
      var tz2 = TZ.replace('1,1', '0,1');
      setP('TEST-02', { hinh: TZ, loi_giai: 'Xem ' + tz2 });
      setP('TEST-03', { de_bai: 'Cùng hình: ' + TZ });
      fig.createFile(Utilities.newBlob(SVG_OK, 'image/svg+xml', 'tikz-' + figKey_(tz2) + '.svg'));
      var tok = login_(A.QT), r = call_(tok, 'figureSources', {});
      eq_(r.n, 1, 'một hình chưa dựng (dùng ở hai bài)');
      var z = {}; Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(r.b64), 'application/zip', 'x.zip')).forEach(function (b) { z[b.getName()] = b.getDataAsString(); });
      eq_(Object.keys(z).sort(), ['danh-sach.txt', 'tikz-' + figKey_(TZ) + '.tex']);
      eq_(z['tikz-' + figKey_(TZ) + '.tex'], TZ);
      has_s_(z['danh-sach.txt'], 'TEST-02'); has_s_(z['danh-sach.txt'], 'TEST-03');
      eq_(call_(tok, 'figureSources', { tat_ca: true }).n, 2);
      fig.createFile(Utilities.newBlob(SVG_OK, 'image/svg+xml', 'tikz-' + figKey_(TZ) + '.svg'));
      eq_(call_(tok, 'figureSources', {}).n, 0);
    });
  });
  test_('16.6', 'Tải SVG lên: chỉ nhận tikz-<mã>.svg của hình đang có; chặn SVG có mã chạy được hoặc liên kết ngoài; tải lại thì thay; PB, TBT không tải được', 'T1', function () {
    withFolders(function (ex, fig) {
      setP('TEST-02', { hinh: TZ });
      setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'TBT' });
      var k = figKey_(TZ), name = 'tikz-' + k + '.svg', tok = login_(A.T1);
      var r = call_(tok, 'uploadFigures', { files: [b64zip('hinh-svg.zip', [[name, SVG_OK], ['tikz-0000000000000000.svg', SVG_OK], ['ghi-chu.txt', 'x']])] });
      eq_(r.saved.map(function (x) { return [x.ten, x.ma_bai]; }), [[name, 'TEST-02']]);
      eq_(r.skipped.map(function (x) { return x.ten; }), ['tikz-0000000000000000.svg', 'ghi-chu.txt']);
      [['<svg><script>alert(1)</script></svg>', 'mã chạy được'], ['<svg onload="x()"></svg>', 'mã chạy được'],
       ['<svg><image href="https://example.com/a.png"/></svg>', 'liên kết ra ngoài'], ['xin chào', 'không phải SVG']].forEach(function (c) {
        var rr = call_(tok, 'uploadFigures', { files: [{ name: name, b64: Utilities.base64Encode(c[0]) }] });
        eq_(rr.saved.length, 0); has_s_(rr.skipped[0].ly_do, c[1]);
      });
      var n = function () { var c = 0, it = fig.getFiles(); while (it.hasNext()) { if (it.next().getName() === name) c++; } return c; };
      eq_(n(), 1);
      call_(tok, 'uploadFigures', { files: [{ name: name, b64: Utilities.base64Encode(SVG_OK.replace('10', '12')) }] });
      eq_(n(), 1, 'tải lại thì thay, không nhân đôi');
      ok_(Utilities.newBlob(Utilities.base64Decode(call_(tok, 'getProblem', { ma_bai: 'TEST-02' }).hinh.figs[TZ].split(',')[1])).getDataAsString().indexOf('width="12"') >= 0, 'trang hiện bản mới');
      ok_(auditHas_('tải hình lên', 'TEST-02'));
      ['PB', 'TBT'].forEach(function (rl) {
        setUsers_({ QT: 'Quản trị', T1: rl, T2: 'PB' });
        throws_(function () { call_(login_(A.T1), 'uploadFigures', { files: [{ name: name, b64: Utilities.base64Encode(SVG_OK) }] }); }, 'Không có quyền');
      });
    });
  });
  test_('16.7', 'Khoá kỳ: cột Hình nhiều tên ảnh → mỗi ảnh một \\includegraphics, cả hai vào pic/', 'QT', function () {
    approved4();
    withFolders(function (ex, fig) {
      setP('TEST-03', { hinh: 'a.png\nb.png' });
      fig.createFile(Utilities.newBlob('A', 'image/png', 'a.png')); fig.createFile(Utilities.newBlob('B', 'image/png', 'b.png'));
      var r = call_(login_(A.QT), 'closeIssue', { so: '10/2026', bat_dau: '1', xac_nhan: true });
      eq_(r.missing_pics, []);
      var z = zipNames(r.url), t = z['de-ra-ky-nay-10-2026.tex'].getDataAsString();
      has_s_(t, '\\includegraphics[width=0.45\\textwidth]{a.png}\\quad\n\\includegraphics[width=0.45\\textwidth]{b.png}');
      ok_(z['pic/a.png'] && z['pic/b.png'], 'cả hai ảnh trong pic/');
    });
  });

  // 17. Thêm bài trên trang web (VP, NCB, PT, TBT, Quản trị) và thêm ảnh
  var SVG_A = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/><text x="1" y="8">A</text></svg>';
  var PNG_1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  var b64s = function (t) { return Utilities.base64Encode(t); };
  var sub = function (o) {
    var base = { thang: '2026-10', kenh: 'email', tac_gia: { ten_in: 'Tác Giả Mới Thử', don_vi: 'Trường Mới', lien_he: 'lien-he-moi@example.com' },
                 bai: [{ chu_de: 'SH', muc_de_xuat: 'A', de_bai: 'Đề mới 1: $n^2$.', loi_giai: 'Lời giải mới 1.', tep_goc: 'bai1.tex' },
                       { chu_de: 'HH', de_bai: 'Đề mới 2.', loi_giai: 'Lời giải mới 2.' }] };
    for (var k in o) base[k] = o[k];
    return base;
  };
  test_('17.1', 'Thêm bài: mã = tháng + thư mục kế tiếp còn trống + a, b; tác giả mới (liên hệ chỉ ở Authors); Provenance, nhật ký; NCB, TBT, VP thêm được; PB, BTK thì không', 'T1', function () {
    putRows_('Problems', rows_('Problems').concat([{ ma_bai: '2026-10-03b', chu_de: 'ĐS', trang_thai: 'Mới', de_bai: 'y' }, { ma_bai: '2026-10-01a', chu_de: 'ĐS', trang_thai: 'Mới', de_bai: 'x' }]));
    TEST_CONF.TODAY = '2026-10-08';
    ['NCB', 'TBT', 'VP'].forEach(function (r) {
      setUsers_({ QT: 'Quản trị', T1: r, T2: 'PB' });
      eq_(call_(login_(A.T1), 'intakeForm').ma_tiep, '2026-10-04', 'thư mục kế tiếp sau 01, 03');
    });
    setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
    var r = call_(login_(A.T1), 'addSubmission', sub({}));
    eq_(r.bai.map(function (x) { return x.ma_bai; }), ['2026-10-04a', '2026-10-04b']);
    var p = findRow_('Problems', 'ma_bai', '2026-10-04a').data;
    eq_([p.chu_de, p.trang_thai, p.de_bai, p.de_bai_goc, Number(p.phien_ban), p.muc], ['SH', 'Mới', 'Đề mới 1: $n^2$.', 'Đề mới 1: $n^2$.', 1, '']);
    var au = findRow_('Authors', 'tac_gia_id', p.tac_gia_id).data;
    eq_([au.ten_in, au.don_vi, au.lien_he], ['Tác Giả Mới Thử', 'Trường Mới', 'lien-he-moi@example.com']);
    eq_(findRow_('Problems', 'ma_bai', '2026-10-04b').data.tac_gia_id, p.tac_gia_id, 'cùng tác giả');
    lacks_(JSON.stringify(findRow_('Problems', 'ma_bai', '2026-10-04a').data), 'lien-he-moi', 'liên hệ không vào bài');
    eq_(findRow_('Provenance', 'ma_bai', '2026-10-04a').data.kenh, 'email');
    has_s_(rows_('ConversionLog').filter(function (c) { return c.ma_bai === '2026-10-04a'; })[0].noi_dung, 'Tác giả đề nghị mức A');
    ok_(auditHas_('thêm bài', '2026-10-04a, 2026-10-04b'));
    eq_(call_(login_(A.T1), 'addSubmission', sub({ tac_gia: { id: p.tac_gia_id }, bai: [sub({}).bai[1]] })).bai[0].ma_bai, '2026-10-05a');
    eq_(call_(login_(A.T1), 'addSubmission', sub({ bai: [sub({}).bai[1]] })).bai[0].ma_bai, '2026-10-06a');
    eq_(rows_('Authors').filter(function (a) { return a.ten_in === 'Tác Giả Mới Thử'; }).length, 1, 'không nhân đôi tác giả (cùng tên, đơn vị)');
    eq_(findRow_('Problems', 'ma_bai', '2026-10-06a').data.tac_gia_id, p.tac_gia_id);
    ['PB', 'BTK'].forEach(function (rl) {
      setUsers_({ QT: 'Quản trị', T1: rl, T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'addSubmission', sub({})); }, 'Không có quyền');
    });
  });
  test_('17.2', 'Thêm bài: thiếu chủ đề / đề trống / tháng sai / ảnh sai loại → từ chối, không thêm gì (cả hồ sơ)', 'QT', function () {
    var tok = login_(A.QT), n = rows_('Problems').length;
    throws_(function () { call_(tok, 'addSubmission', sub({ bai: [sub({}).bai[0], { chu_de: '', de_bai: 'x' }] })); }, 'Bài 2: chọn chủ đề');
    throws_(function () { call_(tok, 'addSubmission', sub({ bai: [{ chu_de: 'SH', de_bai: '  ' }] })); }, 'đề bài trống');
    throws_(function () { call_(tok, 'addSubmission', sub({ thang: '2026-13' })); }, 'NNNN-TT');
    throws_(function () { call_(tok, 'addSubmission', sub({ bai: [{ chu_de: 'SH', de_bai: 'x', anh: [{ name: 'a.exe', b64: b64s('MZ'), noi: 'de' }] }] })); }, 'chỉ nhận ảnh');
    throws_(function () { call_(tok, 'addSubmission', sub({ bai: [{ chu_de: 'SH', de_bai: 'x', anh: [{ name: 'gia.png', b64: b64s('<svg/>'), noi: 'de' }] }] })); }, 'không phải ảnh PNG');
    throws_(function () { call_(tok, 'addSubmission', sub({ bai: [{ chu_de: 'SH', de_bai: 'x', anh: [{ name: 'gia.jpg', b64: PNG_1, noi: 'de' }] }] })); }, 'không phải ảnh JPG');
    throws_(function () { call_(tok, 'addSubmission', sub({ bai: [{ chu_de: 'SH', de_bai: 'x', anh: [{ name: 'x.svg', b64: b64s('<svg onload="x()"></svg>'), noi: 'de' }] }] })); }, 'mã chạy được');
    throws_(function () { call_(tok, 'addSubmission', sub({ tac_gia: {} })); }, 'Tên tác giả');
    eq_(rows_('Problems').length, n, 'không thêm gì');
  });
  test_('17.3', 'Ảnh khi thêm bài: ảnh của đề vào cột Hình (in kèm đề), ảnh lời giải chèn cuối lời giải (không in); hiện trên trang; khoá kỳ chỉ đóng gói ảnh của đề, SVG gọi không đuôi', 'QT', function () {
    withFolders(function (ex, fig) {
      var tok = login_(A.QT);
      var r = call_(tok, 'addSubmission', sub({ bai: [{ chu_de: 'HH', de_bai: 'Đề có hình.', loi_giai: 'Lời giải.',
        anh: [{ name: 'cau-hinh.svg', b64: b64s(SVG_A), noi: 'de' }, { name: 'dap-an.png', b64: PNG_1, noi: 'lg' }] }] }));
      var ma = r.bai[0].ma_bai, p = findRow_('Problems', 'ma_bai', ma).data;
      eq_(p.hinh, ma + '-1.svg');
      has_s_(p.loi_giai, '\\includegraphics[width=0.6\\textwidth]{' + ma + '-2.png}');
      eq_(p.loi_giai_goc, p.loi_giai, 'bản gốc = bản lúc thêm');
      var h = call_(tok, 'getProblem', { ma_bai: ma }).hinh;
      eq_(Object.keys(h.pics).sort(), [ma + '-1.svg', ma + '-2.png']);
      ok_(/^data:image\/svg\+xml;base64,/.test(h.pics[ma + '-1.svg']) && /^data:image\/png;base64,/.test(h.pics[ma + '-2.png']));
      eq_(call_(tok, 'figures').items.filter(function (x) { return x.ma_bai === ma; }).map(function (x) { return x.noi; }), ['ảnh (đề)', 'ảnh (trong lời giải)']);
      TEST_CONF.BOARD_LAYOUT = 'A';
      call_(tok, 'newBoard', { so: '12/2026' }); call_(tok, 'place', { so: '12/2026', vi_tri: 1, ma_bai: ma }); call_(tok, 'submitBoard', { so: '12/2026' });
      setUsers_({ QT: 'Quản trị', T1: 'TBT', T2: 'PB' }); call_(login_(A.T1), 'approveBoard', { so: '12/2026' });
      var au = findRow_('Authors', 'tac_gia_id', p.tac_gia_id); ok_(au, 'có tác giả');
      var c = call_(tok, 'closeIssue', { so: '12/2026', bat_dau: '1', xac_nhan: true });
      var z = zipNames(c.url);
      eq_(Object.keys(z).sort(), ['de-ra-ky-nay-12-2026.tex', 'pic/' + ma + '-1.svg'], 'ảnh lời giải không vào gói');
      var t = z['de-ra-ky-nay-12-2026.tex'].getDataAsString();
      has_s_(t, '\\includegraphics[width=0.45\\textwidth]{' + ma + '-1}'); lacks_(t, '-2.png');
    });
  });
  test_('17.4', 'Thêm ảnh cho bài đã có: phải đúng phiên bản; ảnh đề vào cột Hình, ảnh lời giải vào lời giải; có lịch sử; cột Hình là TikZ thì không thêm ảnh đề; PB không thêm được', 'T1', function () {
    withFolders(function (ex, fig) {
      setUsers_({ QT: 'Quản trị', T1: 'NCB', T2: 'PB' });
      var tok = login_(A.T1), v = Number(findRow_('Problems', 'ma_bai', 'TEST-02').data.phien_ban);
      throws_(function () { call_(tok, 'uploadPictures', { ma_bai: 'TEST-02', phien_ban: v - 1, files: [{ name: 'a.png', b64: PNG_1, noi: 'de' }] }); }, 'người khác sửa');
      var r = call_(tok, 'uploadPictures', { ma_bai: 'TEST-02', phien_ban: v, files: [{ name: 'a.png', b64: PNG_1, noi: 'de' }, { name: 'b.svg', b64: b64s(SVG_A), noi: 'lg' }] });
      eq_(r.names, ['TEST-02-1.png', 'TEST-02-2.svg']); eq_(r.phien_ban, v + 2);
      var p = findRow_('Problems', 'ma_bai', 'TEST-02').data;
      eq_(p.hinh, 'TEST-02-1.png'); has_s_(p.loi_giai, '{TEST-02-2.svg}');
      eq_(rows_('Revisions').map(function (x) { return x.truong; }), ['hinh', 'loi_giai']);
      setP('TEST-03', { hinh: '\\begin{tikzpicture}\\draw (0,0)--(1,0);\\end{tikzpicture}' });
      var v3 = Number(findRow_('Problems', 'ma_bai', 'TEST-03').data.phien_ban);
      throws_(function () { call_(tok, 'uploadPictures', { ma_bai: 'TEST-03', phien_ban: v3, files: [{ name: 'a.png', b64: PNG_1, noi: 'de' }] }); }, 'mã TikZ');
      setUsers_({ QT: 'Quản trị', T1: 'PB', T2: 'PB' });
      throws_(function () { call_(login_(A.T1), 'uploadPictures', { ma_bai: 'TEST-02', phien_ban: v + 2, files: [{ name: 'a.png', b64: PNG_1, noi: 'de' }] }); }, 'Không có quyền');
    });
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
 *   THU-01 → giao T1;  THU-02 → giao T1 và T2;  THU-03…THU-10 → không giao ai.  T1, T2 được đặt vai trò PB.
 *   10 bài (4 mức B, 6 mức A) — đủ một bảng chọn bài theo bố cục mặc định (B14, B15).
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
      var cols = SCHEMA[name], iMa = cols.indexOf('ma_bai'), iKy = cols.indexOf('ky'), iSo = cols.indexOf('so');
      if (iMa < 0 && iKy < 0 && iSo < 0) return;
      var sh = sheet_(name), n = sh.getLastRow();
      if (n < 2) return;
      var vals = sh.getRange(2, 1, n - 1, cols.length).getValues();
      for (var r = vals.length - 1; r >= 0; r--) {
        var practice = (iMa >= 0 && String(vals[r][iMa]).indexOf(PRACTICE_PREFIX) === 0) || (iKy >= 0 && String(vals[r][iKy]) === PRACTICE_ROUND) ||
                       (iKy >= 0 && String(vals[r][iKy]).indexOf(PRACTICE_PREFIX) === 0) || (iSo >= 0 && String(vals[r][iSo]).indexOf(PRACTICE_PREFIX) === 0);
        if (practice) { sh.deleteRow(r + 2); removed++; }
      }
    });
  });
  var t = now_();
  [['THU-01', 'ĐS', 'Bài luyện 1 (bịa, để kiểm thử): Cho $a,b>0$ và $a+b=2$. Chứng minh $ab\\le 1$.', 'Theo AM-GM, $ab\\le\\left(\\frac{a+b}{2}\\right)^2=1$.'],
   ['THU-02', 'HH', 'Bài luyện 2 (bịa, để kiểm thử): Tam giác $ABC$ vuông tại $A$. Chứng minh $BC^2=AB^2+AC^2$.', 'Định lý Pythagore.\n\n$$BC^2=AB^2+AC^2.$$'],
   ['THU-03', 'SH', 'Bài luyện 3 (bịa, để kiểm thử): Tìm số nguyên dương $n$ nhỏ nhất để $n^2+1$ chia hết cho $5$.', '$n=2$.'],
   // THU-04…THU-10: cho đủ một bảng chọn bài 10 vị trí (4 B, 6 A) — không giao phản biện
   ['THU-04', 'TH', 'Bài luyện 4 (bịa, để kiểm thử): Có bao nhiêu cách xếp $3$ bạn vào $3$ ghế?', '$3!=6$.'],
   ['THU-05', 'SH', 'Bài luyện 5 (bịa, để kiểm thử): Chứng minh $n^3-n$ chia hết cho $6$ với mọi số nguyên $n$.', '$n^3-n=(n-1)n(n+1)$.', 'A'],
   ['THU-06', 'ĐS', 'Bài luyện 6 (bịa, để kiểm thử): Giải phương trình $x^2-5x+6=0$.', '$x=2$ hoặc $x=3$.', 'A'],
   ['THU-07', 'HH', 'Bài luyện 7 (bịa, để kiểm thử): Hình vuông cạnh $2$ có đường chéo dài bao nhiêu?', '$2\\sqrt2$.', 'A'],
   ['THU-08', 'TH', 'Bài luyện 8 (bịa, để kiểm thử): Có bao nhiêu tập con của tập $\\{1,2,3\\}$?', '$2^3=8$.', 'A'],
   ['THU-09', 'ĐS', 'Bài luyện 9 (bịa, để kiểm thử): Cho $x>0$. Chứng minh $x+\\frac1x\\ge 2$.', 'AM-GM.', 'A'],
   ['THU-10', 'SH', 'Bài luyện 10 (bịa, để kiểm thử): Tìm ước chung lớn nhất của $12$ và $18$.', '$6$.', 'A']]
  .forEach(function (b) {
    append_('Problems', { ma_bai: b[0], chu_de: b[1], muc: b[4] || 'B', trang_thai: 'Mới', loai: 'thử', tac_gia_id: 'THU-TG',
                          de_bai: b[2], loi_giai: b[3], de_bai_goc: b[2], loi_giai_goc: b[3], phien_ban: 1, cap_nhat: t, nguoi_cap_nhat: 'resetPractice' });
    append_('Provenance', { ma_bai: b[0], thu_muc: '(bài luyện)', tep_goc: 'Tác Giả Luyện Tập - ' + b[0] + '.docx', kenh: 'kiểm thử' });
  });
  var tg = findRow_('Authors', 'tac_gia_id', 'THU-TG'), tgRow = { tac_gia_id: 'THU-TG', ten_in: 'Tác Giả Luyện Tập', don_vi: 'Trường Luyện Tập (bịa)', lien_he: '' };
  if (tg) update_('Authors', tg.row, tgRow); else append_('Authors', tgRow);
  append_('Rounds', { ky: PRACTICE_ROUND, trang_thai: 'mở', han_phan_bien: textDate_(addDays_(today_(), 14)), ghi_chu: 'kỳ luyện tập cho kiểm thử' });
  [['THU-01', users[0]], ['THU-02', users[0]], ['THU-02', users[1]]].forEach(function (a) {
    append_('Assignments', { ky: PRACTICE_ROUND, ma_bai: a[0], email: a[1], giao_luc: t });
  });
  users.slice(0, 2).forEach(function (u, k) {
    var hit = findRow_('Users', 'email', u);
    if (hit) update_('Users', hit.row, { vai_tro: 'PB', hoat_dong: true });
    else append_('Users', { email: u, ten: 'Tài khoản thử ' + (k + 1), vai_tro: 'PB', hoat_dong: true, ghi_chu: 'kiểm thử' });
  });
  var msg = 'Đã đặt lại bài luyện tập (xoá ' + removed + ' dòng cũ): THU-01 → ' + users[0] + '; THU-02 → ' + users[0] + ', ' + users[1] + '; THU-03…THU-10 → không ai.';
  audit_(Session.getEffectiveUser().getEmail(), 'resetPractice', msg);
  Logger.log(msg);
  return msg;
}
