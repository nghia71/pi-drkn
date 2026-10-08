/**
 * HÌNH (giai đoạn 1). Quy ước của Nghĩa, 2026-10-07: bài cũ mất hình → vẽ lại; bài mới dựng được hình từ văn bản → vẽ;
 * không dựng được / mâu thuẫn → một mục Cần kiểm tra.
 *
 *  - Cột Problems.hinh: hoặc mã TikZ (một hay nhiều khối tikzpicture), hoặc tên tệp ảnh (mỗi dòng một tên) trong thư mục hình.
 *    Khối tikzpicture nằm trong đề bài, lời giải cũng được dựng như vậy.
 *  - Mỗi khối TikZ có một MÃ = 16 ký tự đầu của SHA-256 (UTF-8, NFC, xuống dòng \n) của chính khối. SVG lưu trong thư mục
 *    hình (FIG_FOLDER_ID) tên tikz-<mã>.svg. Sửa TikZ thì mã đổi: trang hiện "chưa dựng" cho tới khi có SVG mới — không bao giờ
 *    hiện hình cũ cho mã mới.
 *  - Dựng SVG ở máy: trang "Hình" → tải các hình chưa dựng (.zip) → tools/hinh/build.py → tải hinh-svg.zip lên trang "Hình".
 *    Giai đoạn 2 (FigCloud.gs): GitHub Actions trong một kho RIÊNG TƯ dựng tự động. Không bao giờ dựng hình của đề chưa đăng trên dịch vụ công cộng.
 *  - Trang web hiện SVG/ảnh bằng <img src="data:…">: trình duyệt không chạy mã trong ảnh; SVG tải lên vẫn được kiểm tra.
 */
var FIG_MANAGERS = EDITORS;                    // NCB, PT, Quản trị: tải mã nguồn hình, tải SVG lên
var TIKZ_RE_ = /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g;
var PIC_NAME_RE_ = /^[\w][\w .\-]*\.(png|jpe?g|pdf|svg)$/i;
var INCLUDE_RE_ = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
/** Tên ảnh gọi bằng \includegraphics{…} trong một văn bản (đề bài, lời giải). */
function includedPics_(text) { var out = [], m; INCLUDE_RE_.lastIndex = 0; while ((m = INCLUDE_RE_.exec(String(text || '')))) out.push(m[1].trim()); return out; }
var FIG_SVG_MAX_ = 600 * 1024, FIG_PIC_MAX_ = 3 * 1024 * 1024;
var FIG_DANGER_RE_ = /\\(input|include|openin|openout|write|immediate|read|catcode|directlua|special|usepackage|documentclass|newwrite|newread|includegraphics|pgfimage|lstinputlisting|verbatiminput)\b|\^\^/;

function figNorm_(s) { return String(s == null ? '' : s).normalize('NFC').replace(/\r\n?/g, '\n'); }
function tikzBlocks_(text) { return figNorm_(text).match(TIKZ_RE_) || []; }
function figKey_(block) {
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, figNorm_(block), Utilities.Charset.UTF_8);
  return d.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 16);
}
/** Cột hinh: true nếu là TikZ; nếu không: danh sách tên tệp ảnh. */
function hinhKind_(hinh) {
  var t = figNorm_(hinh).trim();
  if (!t) return { tikz: false, pics: [] };
  if (t.indexOf('\\begin{tikzpicture}') >= 0) return { tikz: true, pics: [] };
  return { tikz: false, pics: t.split('\n').map(function (x) { return x.trim(); }).filter(String) };
}

/** Kiểm tra cột hinh trước khi lưu. Trả về lỗi (chuỗi) hoặc ''. */
function hinhError_(hinh) {
  var t = figNorm_(hinh).trim(), k = hinhKind_(t);
  if (!t) return '';
  if (k.tikz) {
    var nb = (t.match(/\\begin\{tikzpicture\}/g) || []).length, ne = (t.match(/\\end\{tikzpicture\}/g) || []).length;
    if (nb !== ne) return 'Số \\begin{tikzpicture} và \\end{tikzpicture} không bằng nhau.';
    var rest = t.replace(TIKZ_RE_, '').trim();
    if (rest) return 'Ngoài các khối tikzpicture không được có gì khác (ghi chú để ở mục Cần kiểm tra).';
    var bad = t.match(FIG_DANGER_RE_);
    if (bad) return 'Hình không được dùng lệnh ' + bad[0] + '.';
    return '';
  }
  var wrong = k.pics.filter(function (n) { return !PIC_NAME_RE_.test(n); });
  if (wrong.length) return 'Cột Hình: hoặc mã TikZ, hoặc tên tệp ảnh (.svg, .png, .jpg, .pdf), mỗi dòng một tên — không hiểu: ' + wrong.join(', ');
  return '';
}

/* ---------------- kho hình (thư mục FIG_FOLDER_ID) ---------------- */

var FIG_INDEX_ = null;
function figFolder_() {
  var id = conf_('FIG_FOLDER_ID');
  if (!id) throw new Error('Chưa có thư mục hình (Script property FIG_FOLDER_ID) — chạy setup().');
  return DriveApp.getFolderById(id);
}
/** tên tệp → tệp, trong thư mục hình (một lần cho mỗi lời gọi). */
function figIndex_() {
  if (FIG_INDEX_ && FIG_INDEX_.id === conf_('FIG_FOLDER_ID')) return FIG_INDEX_.files;
  var files = {}, it = figFolder_().getFiles();
  while (it.hasNext()) { var f = it.next(); files[f.getName()] = f; }
  FIG_INDEX_ = { id: conf_('FIG_FOLDER_ID'), files: files };
  return files;
}
function figReset_() { FIG_INDEX_ = null; }

function dataUri_(file, max) {
  var name = file.getName().toLowerCase(), type = /\.svg$/.test(name) ? 'image/svg+xml' : /\.png$/.test(name) ? 'image/png' :
             /\.jpe?g$/.test(name) ? 'image/jpeg' : '';
  if (!type) return '';
  var bytes = file.getBlob().getBytes();
  if (bytes.length > max) return '';
  return 'data:' + type + ';base64,' + Utilities.base64Encode(bytes);
}

/**
 * Hình cho trang bài: figs = {khối TikZ (đã chuẩn hoá) → data URI SVG}; pics = {tên tệp → data URI} (ảnh có trong thư mục hình);
 * thieu = tên tệp ảnh không tìm thấy. Lỗi Drive không làm hỏng trang (hình hiện "chưa dựng").
 */
function figsFor_(p) {
  var out = { figs: {}, pics: {}, thieu: [] };
  var picNames = hinhKind_(p.hinh).pics.concat(includedPics_(p.de_bai), includedPics_(p.loi_giai));
  var hasFig = [p.de_bai, p.loi_giai, p.hinh].some(function (t) { return /\\begin\{tikzpicture\}/.test(String(t || '')); }) || picNames.length;
  if (!hasFig || !conf_('FIG_FOLDER_ID')) return out;           // bài không có hình: không đụng tới Drive
  try {
    var idx = figIndex_(), cache = CacheService.getScriptCache();
    [p.de_bai, p.loi_giai, p.hinh].forEach(function (t) {
      tikzBlocks_(t).forEach(function (b) {
        var k = figKey_(b), f = idx['tikz-' + k + '.svg'];
        if (!f || out.figs[b]) return;
        var uri = null;
        try { uri = cache.get('fig:' + k + ':' + f.getId()); } catch (e) { uri = null; }
        if (!uri) {
          uri = dataUri_(f, FIG_SVG_MAX_);
          try { if (uri && uri.length < 90000) cache.put('fig:' + k + ':' + f.getId(), uri, 21600); } catch (e) { /* bộ nhớ tạm đầy */ }
        }
        if (uri) out.figs[b] = uri;
      });
    });
    picNames.forEach(function (n) {
      var f = idx[n];
      if (out.pics[n] || out.thieu.indexOf(n) >= 0) return;
      if (!f) { out.thieu.push(n); return; }
      var uri = dataUri_(f, FIG_PIC_MAX_);
      if (uri) out.pics[n] = uri;
    });
  } catch (e) { out.loi = String(e.message || e); }
  return out;
}

/* ---------------- trang "Hình" ---------------- */

/** Mọi khối TikZ của các bài người xem thấy được: bài, nơi (đề / lời giải / hình), mã, đã dựng chưa. */
function figureList_(w) {
  var assigned = assignedSet_(w), idx = figIndex_(), out = [];
  rows_('Problems').forEach(function (p) {
    if (!canSee_(w, p.ma_bai, assigned)) return;
    [['de_bai', 'đề bài'], ['loi_giai', 'lời giải'], ['hinh', 'hình']].forEach(function (f) {
      tikzBlocks_(p[f[0]]).forEach(function (b, i) {
        var k = figKey_(b);
        out.push({ ma_bai: p.ma_bai, trang_thai: p.trang_thai, noi: f[1] + (i ? ' (' + (i + 1) + ')' : ''), ma: k,
                   da_dung: !!idx['tikz-' + k + '.svg'], src: b });
      });
    });
    hinhKind_(p.hinh).pics.forEach(function (n) {
      out.push({ ma_bai: p.ma_bai, trang_thai: p.trang_thai, noi: 'ảnh (đề)', ten: n, da_dung: !!idx[n] });
    });
    includedPics_(p.de_bai).concat(includedPics_(p.loi_giai)).forEach(function (n, i, all) {
      if (all.indexOf(n) !== i) return;
      out.push({ ma_bai: p.ma_bai, trang_thai: p.trang_thai, noi: 'ảnh (trong ' + (includedPics_(p.de_bai).indexOf(n) >= 0 ? 'đề bài' : 'lời giải') + ')', ten: n, da_dung: !!idx[n] });
    });
  });
  return out;
}

function figuresView_(w) {
  need_(w, FIG_MANAGERS);
  var st = figCloudOn_() ? figCloudState_() : null, loi = (st && st.loi) || {};
  return { items: figureList_(w).map(function (x) { var y = {}; for (var k in x) if (k !== 'src') y[k] = x[k]; if (x.ma && loi[x.ma] && !x.da_dung) y.loi = loi[x.ma]; return y; }),
           cloud: st ? { cho: (st.cho || []).length, luc: st.luc || '' } : null };
}

/** Zip mã nguồn các hình TikZ (mặc định: chỉ hình chưa dựng) để dựng ở máy bằng tools/hinh/build.py. */
function figureSources_(w, a) {
  need_(w, FIG_MANAGERS);
  var all = a && a.tat_ca === true, seen = {}, blobs = [], lines = [];
  figureList_(w).forEach(function (x) {
    if (!x.src || (x.da_dung && !all)) return;
    lines.push('tikz-' + x.ma + '.tex\t' + x.ma_bai + '\t' + x.noi);
    if (seen[x.ma]) return;
    seen[x.ma] = true;
    blobs.push(Utilities.newBlob(x.src, 'text/x-tex', 'tikz-' + x.ma + '.tex'));
  });
  if (!blobs.length) return { n: 0 };
  blobs.push(Utilities.newBlob('Hình cần dựng — tools/hinh/build.py <tệp zip này>\n' + lines.join('\n') + '\n', 'text/plain', 'danh-sach.txt'));
  var zip = Utilities.zip(blobs, 'hinh-chua-dung.zip');
  audit_(w.email, 'tải mã nguồn hình', blobs.length - 1 + ' hình');
  return { n: blobs.length - 1, ten: 'hinh-chua-dung.zip', b64: Utilities.base64Encode(zip.getBytes()) };
}

/** SVG có vẻ an toàn để lưu (trang chỉ hiện qua <img>, nhưng tệp còn được mở ở nơi khác). Trả về lỗi hoặc ''. */
function svgError_(text) {
  if (!/<svg[\s>]/.test(text)) return 'không phải SVG';
  if (/<script|<foreignObject|<iframe|<object|<embed|<!ENTITY|javascript:|\son[a-z]+\s*=/i.test(text)) return 'có mã chạy được hoặc nội dung nhúng';
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(text)) return 'có liên kết ra ngoài tệp';
  return '';
}

/**
 * Tải SVG lên: a.files = [{name, b64}] — mỗi tệp là tikz-<mã>.svg hoặc một zip chứa các tệp đó (hinh-svg.zip của build.py).
 * Chỉ nhận mã của một hình TikZ đang có trong các bài người tải thấy được; thay SVG cũ cùng tên.
 */
function uploadFigures_(w, a) {
  need_(w, FIG_MANAGERS);
  var files = (a && a.files) || [];
  if (!files.length) throw new Error('Chưa chọn tệp.');
  var known = {};
  figureList_(w).forEach(function (x) { if (x.ma) known[x.ma] = x.ma_bai; });
  var entries = [];
  files.forEach(function (f) {
    var bytes = Utilities.base64Decode(String(f.b64 || '')), name = String(f.name || '');
    if (/\.zip$/i.test(name)) {
      Utilities.unzip(Utilities.newBlob(bytes, 'application/zip', name)).forEach(function (b) {
        entries.push({ name: b.getName().split('/').pop(), bytes: b.getBytes() });
      });
    } else entries.push({ name: name.split('/').pop(), bytes: bytes });
  });
  var saved = [], skipped = [], folder = figFolder_(), idx = figIndex_();
  entries.forEach(function (e) {
    var m = e.name.match(/^tikz-([0-9a-f]{16})\.svg$/);
    if (!m) { if (!/^\./.test(e.name)) skipped.push({ ten: e.name, ly_do: 'tên không phải tikz-<mã>.svg' }); return; }
    if (!known[m[1]]) { skipped.push({ ten: e.name, ly_do: 'không có hình TikZ nào mang mã này (TikZ đã sửa sau khi tải?)' }); return; }
    if (e.bytes.length > FIG_SVG_MAX_) { skipped.push({ ten: e.name, ly_do: 'tệp quá lớn' }); return; }
    var text = Utilities.newBlob(e.bytes).getDataAsString('UTF-8'), err = svgError_(text);
    if (err) { skipped.push({ ten: e.name, ly_do: err }); return; }
    if (idx[e.name]) idx[e.name].setTrashed(true);
    idx[e.name] = folder.createFile(Utilities.newBlob(e.bytes, 'image/svg+xml', e.name));
    saved.push({ ten: e.name, ma_bai: known[m[1]] });
  });
  if (saved.length) audit_(w.email, 'tải hình lên', saved.map(function (s) { return s.ma_bai + ' ' + s.ten; }).join(', '));
  return { saved: saved, skipped: skipped };
}
