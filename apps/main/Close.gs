/**
 * KHOÁ KỲ: từ một bảng chọn bài đã duyệt — đánh số in P…, xuất tệp .tex (CHỈ ĐỀ BÀI) theo mẫu cột "Đề ra kỳ này" của Pi
 * cho chế bản (BTK), ghi tab Published, chuyển bài sang PL. (Quy ước của Nghĩa, 2026-10-07.)
 *
 *  - Số in bắt đầu: gợi ý = số lớn nhất đã có trong Published + 1; PT/TBT sửa được trước khi xác nhận. Published trống thì phải gõ.
 *  - Số trong một kỳ liên tiếp; không dùng lại số đã có trong Published.
 *  - Thứ tự in: mức B rồi mức A; trong mỗi mức: Số học, Đại số, Hình học, Tổ hợp; cùng chủ đề thì theo vị trí trên bảng chọn bài.
 *  - Tệp xuất: chỉ đề bài + dòng tác giả (tên in, đơn vị). Không lời giải, không ghi chú biên tập, không liên hệ.
 *  - Chặn khi thiếu dòng tác giả; các lưu ý khác (mục cần kiểm tra, xung đột mở, cảnh báo hiển thị, ít bài hơn bố cục) phải xác nhận.
 *  - Kết quả: một tệp zip (.tex + pic/) trong thư mục Drive "Pi ĐRKN — chế bản" của tài khoản quản trị; biên dịch PDF ở máy
 *    bằng tools/khoaky/build.py (Apps Script không chạy được XeLaTeX).
 */
var CLOSERS = ['PT', 'TBT', 'Quản trị'];
var PRINT_TOPIC_ORDER = ['SH', 'ĐS', 'HH', 'TH'];
var PRINT_LEVEL_ORDER = ['B', 'A'];

/** Phần đầu tệp cột (giữ nguyên như mẫu của Pi; dinhdang.tex là tệp của Pi, BTK có sẵn). */
var TEX_HEADER_ = [
  '\\input{structure/dinhdang}',
  '',
  '\\newcounter{stthuc}',
  '\\newcommand{\\thachthuc}{\\refstepcounter{stthuc}%',
  '\\par\\noindent{{\\color{thachthuctoanhoc}\\sffamily\\bfseries P\\arabic{stthuc}.}}',
  '}',
  '%Viết tắt',
  '\\newcommand{\\kck}{khi và chỉ khi\\;}',
  '\\newcommand{\\dtr}{đường tròn\\;}',
  '\\newcommand{\\Dtr}{Đường tròn\\;}',
  '\\newcommand{\\lgi}{{\\bf Lời giải.}}',
  '\\newcommand{\\dtrj}{đường tròn.}',
  '\\newcommand{\\dth}{đường thẳng\\;}',
  '\\newcommand{\\dthj}{đường thẳng.}',
  '\\newcommand{\\dthp}{đường thẳng,}',
  '\\newcommand{\\dgl}{được gọi là\\;}',
  '\\newcommand{\\Dth}{Đường thẳng\\;}',
  '\\newcommand{\\vt}{vectơ\\;}',
  '\\newcommand{\\Vt}{Vectơ\\;}',
  '\\newcommand{\\ptr}{phương trình\\;}',
  '\\newcommand{\\dkh}{đường kính\\;}',
  '\\newcommand{\\Dpcm}{Điều phải chứng minh.}',
  '\\newcommand{\\dpcm}{điều phải chứng minh\\;}',
  '\\newcommand{\\Dpcmj}{Điều phải chứng minh.}',
  '\\newcommand{\\dpcmj}{điều phải chứng minh.}',
  '\\newcommand{\\cmr}{Chứng minh rằng\\;}',
  '% Lệnh tắt',
  '\\newcommand{\\vto}[1]{\\ensuremath{\\overrightarrow{#1}}}',
  '\\newcommand{\\lhop}[1]{\\ensuremath{\\overline{#1}}}',
  '\\newcommand{\\goc}[1]{\\ensuremath{\\widehat{#1}}}',
  '\\def\\cung#1{\\stackrel{\\textstyle\\frown}{#1}}',
  '\\def\\cungdh#1{\\stackrel{\\textstyle\\curvearrowright}{#1}}',
  '\\def\\n{\\newline}',
  '\\raggedbottom',
  '',
  '\\usepackage{mathrsfs}',
  ''
].join('\n');

/* ---------------- số in ---------------- */

function printNum_(s) { var m = String(s || '').match(/^\s*P?\s*(\d+)\s*$/i); return m ? Number(m[1]) : null; }
function usedPrintNums_() {
  var u = {};
  rows_('Published').forEach(function (r) { var n = printNum_(r.so_in); if (n) u[n] = r.ma_bai; });
  return u;
}
function suggestStart_() {
  var max = 0;
  Object.keys(usedPrintNums_()).forEach(function (k) { if (Number(k) > max) max = Number(k); });
  return max ? max + 1 : null;
}

/* ---------------- dựng nội dung ---------------- */

/** Bộ hiển thị (ui/RenderJs) chạy trong Apps Script — để báo "cảnh báo hiển thị" giống trên trang web. */
var PI_RENDER_ = null;
function piRender_() {
  if (!PI_RENDER_) {
    var js = HtmlService.createHtmlOutputFromFile('ui/RenderJs').getContent().replace(/<\/?script[^>]*>/g, '');
    var box = {};
    (new Function('root', 'var module;' + js.replace(/\}\)\(this\);\s*$/, '})(root);')))(box);
    PI_RENDER_ = box.PiRender;
  }
  return PI_RENDER_;
}

var MATH_RE_ = /\$\$[\s\S]*?\$\$|\$(?:\\.|[^$\\])+\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\\begin\{(equation|align|gather|multline|eqnarray|aligned|array|cases)\*?\}[\s\S]*?\\end\{\1\*?\}/g;

/**
 * Văn bản đề (LaTeX sạch, có thể còn vài dấu Markdown từ khâu chuyển .docx) → thân đề cho tệp cột:
 * **đậm** → \textbf{…}, *nghiêng* → \emph{…} (chỉ ngoài công thức); thụt 2 dấu cách, \item thụt 4. Trả kèm cảnh báo.
 */
function texBody_(src) {
  var warn = [], text = String(src || '').normalize('NFC').replace(/\r\n?/g, '\n');
  var out = '', last = 0, m;
  MATH_RE_.lastIndex = 0;
  var prose = function (t) {
    t = t.replace(/\*\*([^*\n]+?)\*\*/g, '\\textbf{$1}').replace(/(^|[^\\*])\*([^*\n]+?)\*(?!\*)/g, '$1\\emph{$2}');
    if (/(^|[^\\])%/.test(t)) warn.push('có dấu % chưa thoát (LaTeX hiểu là chú thích)');
    if (/!\[[^\]]*\]\([^)]*\)/.test(t)) warn.push('còn ảnh dạng Markdown trong đề');
    if (/^\s*>\s/m.test(t)) warn.push('còn dòng trích dẫn Markdown (">") trong đề');
    return t;
  };
  while ((m = MATH_RE_.exec(text))) { out += prose(text.slice(last, m.index)) + m[0]; last = m.index + m[0].length; }
  out += prose(text.slice(last));
  var lines = out.split('\n').map(function (l) {
    var t = l.replace(/^\s+/, '').replace(/\s+$/, '');
    if (!t) return '';
    return (/^\\item\b/.test(t) ? '    ' : '  ') + t;
  });
  while (lines.length && !lines[0]) lines.shift();
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return { tex: lines.join('\n').replace(/\n{3,}/g, '\n\n'), warnings: warn };
}

/** Thứ tự in của các bài trên bảng (đã duyệt): mức B rồi A; trong mức: SH, ĐS, HH, TH; cùng chủ đề theo vị trí. */
function printOrder_(rows) {
  var rank = function (list, v) { var k = list.indexOf(v); return k < 0 ? list.length : k; };
  return rows.slice().sort(function (x, y) {
    return rank(PRINT_LEVEL_ORDER, x.muc) - rank(PRINT_LEVEL_ORDER, y.muc) ||
           rank(PRINT_TOPIC_ORDER, x.chu_de) - rank(PRINT_TOPIC_ORDER, y.chu_de) || x.vi_tri - y.vi_tri;
  });
}

/** Mọi thứ cần cho xem trước / khoá: thứ tự, dòng tác giả, khối hình, lưu ý (chặn và cần xác nhận). */
function closePlan_(so) {
  var hit = issueRow_(so);
  var openChecks = countBy_('Checks', function (c) { return c.trang_thai !== 'xong'; });
  var openConfl = countBy_('Conflicts', function (c) { return String(c.trang_thai).indexOf('mở') >= 0 || String(c.trang_thai).indexOf('chờ') >= 0; });
  var authors = {};
  rows_('Authors').forEach(function (a) { authors[a.tac_gia_id] = a; });
  var R = piRender_(), blockers = [], warnings = [], pics = [];
  var items = boardRows_(so).map(function (r) {
    var p = findRow_('Problems', 'ma_bai', r.ma_bai).data, a = authors[p.tac_gia_id], notes = [];
    var it = { ma_bai: p.ma_bai, muc: p.muc || r.phuong_an, chu_de: p.chu_de, vi_tri: Number(r.vi_tri), de_bai: p.de_bai, hinh: String(p.hinh || '').trim() };
    if (!a || !String(a.ten_in || '').trim()) { blockers.push(p.ma_bai + ': thiếu tên tác giả để in'); it.tac_gia = ''; }
    else it.tac_gia = String(a.ten_in).trim() + (String(a.don_vi || '').trim() ? ' (' + String(a.don_vi).trim() + ')' : '');
    if (!String(p.de_bai || '').trim()) blockers.push(p.ma_bai + ': đề bài trống');
    if (openChecks[p.ma_bai]) notes.push('còn ' + openChecks[p.ma_bai] + ' mục cần kiểm tra');
    if (openConfl[p.ma_bai]) notes.push('còn ' + openConfl[p.ma_bai] + ' xung đột mở');
    var rw = R.render(String(p.de_bai || '')).warnings;
    if (rw.length) notes.push('cảnh báo hiển thị: ' + rw.join('; '));
    var tb = texBody_(p.de_bai);
    it.tex = tb.tex;
    tb.warnings.forEach(function (x) { notes.push(x); });
    hinhKind_(it.hinh).pics.forEach(function (n) { pics.push(n); });
    it.notes = notes;
    notes.forEach(function (n) { warnings.push(p.ma_bai + ': ' + n); });
    return it;
  });
  var planned = boardLayout_().length;
  if (items.length < planned) warnings.push('Bảng có ' + items.length + ' bài, ít hơn bố cục (' + planned + ').');
  if (!items.length) blockers.push('Bảng không có bài nào.');
  return { issue: hit, items: printOrder_(items), blockers: blockers, warnings: warnings, pics: pics };
}

/** Tệp cột hoàn chỉnh (UTF-8, NFC). start = số in của bài đầu tiên. */
function buildTex_(so, start, items) {
  var parts = [TEX_HEADER_,
    '% Đề ra kỳ này — Pi ' + so + ' — P' + start + '–P' + (start + items.length - 1) + '. Chỉ đề bài (xuất từ hệ thống Đề ra kỳ này).',
    '\\begin{document}',
    '\\setcounter{stthuc}{' + (start - 1) + '}',
    '\\pagestyle{thachthuctoanhoc}',
    '\\everymath{\\color{thachthuctoanhoc}}',
    '\\def\\mauchu{thachthuctoanhoc}',
    '\\graphicspath{{pic/}}',
    ''];
  var topicName = { SH: 'Số học', 'ĐS': 'Đại số', HH: 'Hình học', TH: 'Tổ hợp' };
  items.forEach(function (it, k) {
    parts.push('%%% ---- P' + (start + k) + ' — Mức ' + it.muc + ' — ' + (topicName[it.chu_de] || it.chu_de || '') + ' — ' + it.ma_bai);
    parts.push('\\thachthuc (Mức $' + it.muc + '$)');
    parts.push(it.tex);
    if (it.hinh) {
      var hk = hinhKind_(it.hinh);
      parts.push('\\begin{center}');
      parts.push(hk.tikz ? figNorm_(it.hinh).trim()
                         : hk.pics.map(function (n) { return '\\includegraphics[width=0.45\\textwidth]{' + n + '}'; }).join('\\quad\n'));
      parts.push('\\end{center}');
    }
    parts.push('\\begin{flushright}');
    parts.push('\\textit{' + it.tac_gia + '}');
    parts.push('\\end{flushright}');
    parts.push('');
  });
  parts.push('\\end{document}', '');
  return parts.join('\n').normalize('NFC');
}

/* ---------------- API ---------------- */

/** Xem trước khoá kỳ: thứ tự, số in gợi ý, tệp .tex, lưu ý. Không ghi gì. */
function closePreview_(w, a) {
  need_(w, CLOSERS);
  var plan = closePlan_(a.so), st = plan.issue.data.trang_thai;
  if (st !== 'đã duyệt') throw new Error('Chỉ khoá được bảng đã được TBT duyệt (bảng số ' + a.so + ' đang "' + st + '").');
  var start = a.bat_dau ? printNum_(a.bat_dau) : suggestStart_();
  return {
    so: a.so, goi_y: suggestStart_(), bat_dau: start, blockers: plan.blockers, warnings: plan.warnings,
    items: plan.items.map(function (it, k) { return { ma_bai: it.ma_bai, muc: it.muc, chu_de: it.chu_de, vi_tri: it.vi_tri, tac_gia: it.tac_gia,
                                                         so_in: start ? 'P' + (start + k) : '', notes: it.notes }; }),
    tex: start ? buildTex_(a.so, start, plan.items) : ''
  };
}

/**
 * Khoá kỳ: a = {so, bat_dau, xac_nhan}. Kiểm tra lại mọi điều kiện ngay lúc ghi (không tin bản xem trước của trình duyệt).
 */
function closeIssue_(w, a) {
  need_(w, CLOSERS);
  var start = printNum_(a.bat_dau);
  if (!start || start < 1) throw new Error('Số in bắt đầu phải là số nguyên dương (ví dụ 1041 hoặc P1041).');
  var res = withLock_(function () {
    READ_MEMO_ = READ_MEMO_ && {};
    var plan = closePlan_(a.so), iss = plan.issue;
    if (iss.data.trang_thai !== 'đã duyệt') throw new Error('Chỉ khoá được bảng đã được TBT duyệt.');
    if (plan.blockers.length) throw new Error('Chưa khoá được: ' + plan.blockers.join('; '));
    if (plan.warnings.length && a.xac_nhan !== true) throw new Error('Còn ' + plan.warnings.length + ' lưu ý — cần xác nhận đã xem trước khi khoá.');
    var used = usedPrintNums_(), clash = [];
    plan.items.forEach(function (it, k) { if (used[start + k]) clash.push('P' + (start + k) + ' (' + used[start + k] + ')'); });
    if (clash.length) throw new Error('Số in đã dùng: ' + clash.join(', ') + '.');
    var tex = buildTex_(a.so, start, plan.items), t = now_();
    var file = saveExport_(a.so, tex, plan.pics);
    plan.items.forEach(function (it, k) {
      var no = 'P' + (start + k);
      sheet_('Published').appendRow(rowOf_('Published', { ma_bai: it.ma_bai, so_tap_chi: "'" + a.so, so_in: no, ngay: t }));
      var p = findRow_('Problems', 'ma_bai', it.ma_bai);
      update_('Problems', p.row, { trang_thai: 'PL', so_in: no, dang: "'" + a.so, cap_nhat: t, nguoi_cap_nhat: w.email });
    });
    update_('Issues', iss.row, { trang_thai: 'đã khoá', khoa_luc: t, tep: file.url });
    return { so_in: plan.items.map(function (it, k) { return it.ma_bai + ' → P' + (start + k); }), url: file.url, name: file.name,
             missing_pics: file.missing };
  });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(w.email, 'khoá kỳ', a.so + ': ' + res.so_in.join(', '));
  return res;
}

/** Tệp xuất đã lưu của một bảng đã khoá (đường dẫn Drive của tài khoản quản trị) và nội dung .tex để tải lại. */
function exportOf_(w, a) {
  need_(w, CLOSERS.concat(['BTK']));
  var iss = issueRow_(a.so).data;
  if (iss.trang_thai !== 'đã khoá') throw new Error('Bảng số ' + a.so + ' chưa khoá.');
  var rows = rows_('Published').filter(function (r) { return String(r.so_tap_chi) === String(a.so); });
  var nums = rows.map(function (r) { return printNum_(r.so_in); }).filter(Boolean).sort(function (x, y) { return x - y; });
  var plan = closePlan_(a.so);
  var byNo = {}; rows.forEach(function (r) { byNo[r.ma_bai] = printNum_(r.so_in); });
  var items = plan.items.slice().sort(function (x, y) { return (byNo[x.ma_bai] || 0) - (byNo[y.ma_bai] || 0); });
  return { url: iss.tep, tex: nums.length ? buildTex_(a.so, nums[0], items) : '' };
}

/** Lưu zip (.tex + pic/) vào thư mục chế bản của tài khoản quản trị. Hình là tên tệp trong thư mục hình (FIG_FOLDER_ID). */
function saveExport_(so, tex, pics) {
  var base = 'de-ra-ky-nay-' + String(so).replace(/[^\w.-]+/g, '-');
  var blobs = [Utilities.newBlob(tex, 'text/x-tex', base + '.tex')], missing = [];
  var figId = conf_('FIG_FOLDER_ID');
  pics.forEach(function (name) {
    var f = null;
    try { var it = figId ? DriveApp.getFolderById(figId).getFilesByName(name) : null; f = it && it.hasNext() ? it.next() : null; } catch (e) { f = null; }
    if (f) blobs.push(f.getBlob().setName('pic/' + name)); else missing.push(name);
  });
  var zip = Utilities.zip(blobs, base + '.zip');
  var folder = exportFolder_();
  var file = folder.createFile(zip);
  return { url: file.getUrl(), name: base + '.zip', id: file.getId(), missing: missing };
}

function exportFolder_() {
  var props = PropertiesService.getScriptProperties(), id = (TEST_CONF && TEST_CONF.EXPORT_FOLDER_ID) || props.getProperty('EXPORT_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* đã xoá: tạo lại */ } }
  var f = DriveApp.createFolder('Pi ĐRKN — chế bản');
  if (TEST_CONF) TEST_CONF.EXPORT_FOLDER_ID = f.getId(); else props.setProperty('EXPORT_FOLDER_ID', f.getId());
  return f;
}
