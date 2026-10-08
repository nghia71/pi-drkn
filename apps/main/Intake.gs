/**
 * THÊM BÀI trên trang web (VP, NCB, PT, TBT, Quản trị) — đường nhận bài trực tiếp, không qua nhập hàng loạt.
 * Quy ước (Nghĩa, 2026-10-08):
 *  - Mã bài YYYY-MM-NN + chữ (a, b, …): NN = số thư mục kế tiếp CÒN TRỐNG của tháng nhận — hệ thống tự chọn, không gõ tay.
 *  - Tác giả: chọn người đã có hoặc thêm mới (tên in, đơn vị; liên hệ chỉ ghi vào Authors.lien_he — không vào đề, lời giải).
 *  - Ảnh (SVG, PNG, JPG, PDF) lưu trong thư mục hình tên <mã bài>-<n>.<đuôi>; mỗi ảnh hoặc là hình của ĐỀ (cột Hình — in kèm đề
 *    khi khoá kỳ) hoặc hình minh hoạ LỜI GIẢI (chèn cuối lời giải bằng \includegraphics — không bao giờ in vào cột Đề ra kỳ này).
 *  - Bài mới: trạng thái Mới, phiên bản 1; bản gốc của tác giả = văn bản lúc thêm.
 */
var INTAKE_ROLES = ['VP', 'NCB', 'PT', 'TBT', 'Quản trị'];
var PIC_TYPES_ = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', pdf: 'application/pdf' };
var INTAKE_CHANNELS = ['trực tiếp (ban biên tập)', 'email', 'bưu điện', 'khác'];

/** Dữ liệu cho biểu mẫu: tác giả đã có (tên, đơn vị), chủ đề, tháng hiện tại và mã sẽ cấp. */
function intakeForm_(w) {
  need_(w, INTAKE_ROLES);
  var thang = today_().slice(0, 7);
  return { thang: thang, ma_tiep: nextFolder_(thang), topics: TOPICS, levels: LEVELS, kenh: INTAKE_CHANNELS,
           authors: rows_('Authors').filter(function (a) { return String(a.tac_gia_id).indexOf('THU-') !== 0; })
             .map(function (a) { return { id: a.tac_gia_id, ten_in: a.ten_in, don_vi: a.don_vi }; })
             .sort(function (x, y) { return String(x.ten_in).localeCompare(String(y.ten_in), 'vi'); }) };
}

/** Thư mục kế tiếp còn trống của tháng: "2026-10" → "2026-10-03" nếu đã có 01, 02. */
function nextFolder_(thang) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang)) throw new Error('Tháng nhận phải có dạng NNNN-TT, ví dụ 2026-10.');
  var max = 0, re = new RegExp('^' + thang + '-(\\d{2})[a-z]$');
  rows_('Problems').forEach(function (p) { var m = String(p.ma_bai).match(re); if (m && Number(m[1]) > max) max = Number(m[1]); });
  if (max >= 99) throw new Error('Tháng ' + thang + ' đã hết số thư mục.');
  return thang + '-' + ('0' + (max + 1)).slice(-2);
}

/** Ảnh tải lên: kiểm tra loại theo nội dung (không tin đuôi tệp), kích thước, SVG không có mã chạy được. Trả về {ext, bytes} hoặc ném lỗi. */
function checkPicture_(f) {
  var name = String(f.name || ''), ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1];
  ext = ext && ext.toLowerCase();
  if (!PIC_TYPES_[ext]) throw new Error(name + ': chỉ nhận ảnh SVG, PNG, JPG hoặc PDF.');
  var bytes = Utilities.base64Decode(String(f.b64 || ''));
  if (!bytes.length) throw new Error(name + ': tệp trống.');
  if (bytes.length > FIG_PIC_MAX_) throw new Error(name + ': tệp quá lớn (tối đa 3 MB).');
  var b = function (i) { return bytes[i] & 255; };
  var ok = ext === 'svg' ? true : ext === 'png' ? (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47)
         : ext === 'pdf' ? (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46)
         : (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF);
  if (!ok) throw new Error(name + ': nội dung không phải ảnh ' + ext.toUpperCase() + '.');
  if (ext === 'svg') {
    if (bytes.length > FIG_SVG_MAX_) throw new Error(name + ': SVG quá lớn.');
    var err = svgError_(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
    if (err) throw new Error(name + ': SVG ' + err + '.');
  }
  return { ext: ext === 'jpeg' ? 'jpg' : ext, bytes: bytes };
}

/** Lưu ảnh của bài vào thư mục hình (tên <mã>-<n>.<đuôi>, n kế tiếp còn trống). Trả về tên tệp. */
function savePicture_(ma, pic) {
  var idx = figIndex_(), n = 1;
  while (Object.keys(PIC_TYPES_).some(function (e) { return idx[ma + '-' + n + '.' + e]; })) n++;
  var name = ma + '-' + n + '.' + pic.ext;
  idx[name] = figFolder_().createFile(Utilities.newBlob(pic.bytes, PIC_TYPES_[pic.ext], name));
  return name;
}
/** Đoạn chèn ảnh minh hoạ vào cuối lời giải. */
function solutionPicture_(name) { return '\\begin{center}\n\\includegraphics[width=0.6\\textwidth]{' + name + '}\n\\end{center}'; }

/**
 * Thêm một hồ sơ (một hay nhiều bài cùng tác giả): a = {thang, kenh, tac_gia: {id} | {ten_in, don_vi, lien_he},
 *   bai: [{chu_de, muc_de_xuat, loai, de_bai, loi_giai, tep_goc, anh: [{name, b64, noi: 'de'|'lg'}]}]}.
 */
function addSubmission_(w, a) {
  need_(w, INTAKE_ROLES);
  var bai = (a && a.bai) || [];
  if (!bai.length) throw new Error('Chưa có bài nào.');
  if (bai.length > 26) throw new Error('Một hồ sơ tối đa 26 bài.');
  var kenh = INTAKE_CHANNELS.indexOf(a.kenh) >= 0 ? a.kenh : INTAKE_CHANNELS[0];
  // kiểm tra hết TRƯỚC khi ghi: hoặc thêm đủ, hoặc không thêm gì
  var items = bai.map(function (b, i) {
    var label = 'Bài ' + (i + 1) + ': ';
    if (TOPICS.indexOf(b.chu_de) < 0) throw new Error(label + 'chọn chủ đề.');
    var de = String(b.de_bai || '').normalize('NFC').trim(), lg = String(b.loi_giai || '').normalize('NFC').trim();
    if (!de) throw new Error(label + 'đề bài trống.');
    if (de.length > MAX_TEXT_ || lg.length > MAX_TEXT_) throw new Error(label + 'văn bản quá dài.');
    if (b.muc_de_xuat && LEVELS.indexOf(b.muc_de_xuat) < 0) throw new Error(label + 'mức đề nghị không hợp lệ.');
    var pics = (b.anh || []).map(function (f) {
      try { var p = checkPicture_(f); p.noi = f.noi === 'lg' ? 'lg' : 'de'; p.goc = String(f.name); return p; }
      catch (e) { throw new Error(label + e.message); }
    });
    return { chu_de: b.chu_de, muc: b.muc_de_xuat || '', loai: b.loai === 'sưu tầm' ? 'sưu tầm' : 'sáng tác', de: de, lg: lg,
             tep: shortText_(b.tep_goc, 'Tên tệp', 200, false), pics: pics };
  });
  var tg = a.tac_gia || {}, author;
  if (tg.id) {
    var hit = findRow_('Authors', 'tac_gia_id', tg.id);
    if (!hit) throw new Error('Không có tác giả này.');
    author = hit.data;
  } else {
    var ten = shortText_(tg.ten_in, 'Tên tác giả (để in)', 200, true), dv = shortText_(tg.don_vi, 'Đơn vị', 300, false);
    author = { ten_in: ten, don_vi: dv, lien_he: shortText_(tg.lien_he, 'Liên hệ', 500, false) };
  }
  var t = now_(), ngay = today_(), who = w.email;
  var res = withLock_(function () {
    var folder = nextFolder_(String(a.thang || ngay.slice(0, 7)));
    if (!author.tac_gia_id) {
      var same = rows_('Authors').filter(function (x) { return x.ten_in === author.ten_in && String(x.don_vi) === author.don_vi; })[0];
      if (same) author = same;
      else { author.tac_gia_id = newId_(); append_('Authors', { tac_gia_id: author.tac_gia_id, ten_in: author.ten_in, don_vi: author.don_vi,
                                                                lien_he: author.lien_he, ghi_chu: 'thêm trên trang web bởi ' + who + ', ' + ngay }); }
    }
    return items.map(function (it, i) {
      var ma = folder + String.fromCharCode(97 + i), hinh = [], lg = it.lg, saved = [];
      it.pics.forEach(function (p) {
        var name = savePicture_(ma, p);
        saved.push(p.goc + ' → ' + name);
        if (p.noi === 'lg') lg += (lg ? '\n\n' : '') + solutionPicture_(name); else hinh.push(name);
      });
      append_('Problems', { ma_bai: ma, ma_tam: '', chu_de: it.chu_de, muc: '', trang_thai: 'Mới', loai: it.loai, tac_gia_id: author.tac_gia_id,
                            de_bai: it.de, loi_giai: lg, de_bai_goc: it.de, loi_giai_goc: lg, hinh: hinh.join('\n'), phien_ban: 1,
                            cap_nhat: t, nguoi_cap_nhat: who });
      append_('Provenance', { ma_bai: ma, thu_muc: folder + ' (thêm trên trang web)', tep_goc: it.tep || '', ngay_nhan: ngay, kenh: kenh });
      var log = 'Thêm trên trang web bởi ' + who + ' (' + kenh + ').' + (it.muc ? ' Tác giả đề nghị mức ' + it.muc + '.' : '') +
                (saved.length ? ' Ảnh: ' + saved.join('; ') + '.' : '');
      append_('ConversionLog', { id: newId_(), ma_bai: ma, noi_dung: log, ngay: t });
      return { ma_bai: ma, anh: saved.length };
    });
  });
  READ_MEMO_ = READ_MEMO_ && {};
  audit_(who, 'thêm bài', res.map(function (r) { return r.ma_bai; }).join(', ') + ' — tác giả ' + author.ten_in);
  figTouched_(items.map(function (b) { return b.de + '\n' + b.lg; }).join('\n'));
  return { bai: res };
}

/**
 * Thêm ảnh cho một bài đã có (NCB, PT, Quản trị): a = {ma_bai, phien_ban, files: [{name, b64, noi: 'de'|'lg'}]}.
 * Ảnh của đề → thêm tên vào cột Hình; ảnh lời giải → chèn cuối lời giải. Ghi phiên bản và lịch sử như sửa đề.
 */
function uploadPictures_(w, a) {
  need_(w, EDITORS);
  if (!canSee_(w, a.ma_bai, assignedSet_(w))) throw new Error('Không có quyền sửa bài này.');
  var pics = (a.files || []).map(function (f) { var p = checkPicture_(f); p.noi = f.noi === 'lg' ? 'lg' : 'de'; p.goc = String(f.name); return p; });
  if (!pics.length) throw new Error('Chưa chọn ảnh.');
  var res = withLock_(function () {
    var hit = findRow_('Problems', 'ma_bai', a.ma_bai);
    if (!hit) throw new Error('Không có bài');
    if (Number(a.phien_ban) !== Number(hit.data.phien_ban || 0)) throw new Error('Bài vừa được người khác sửa (phiên bản ' + hit.data.phien_ban + ') — tải lại trang rồi thêm ảnh.');
    var kind = hinhKind_(hit.data.hinh);
    if (kind.tikz && pics.some(function (p) { return p.noi === 'de'; })) throw new Error('Cột Hình đang là mã TikZ — ảnh của đề không thêm vào cùng chỗ được (chọn "lời giải" hoặc bỏ TikZ trước).');
    var names = [], hinh = kind.pics.slice(), lg = String(hit.data.loi_giai || '');
    pics.forEach(function (p) { var n = savePicture_(a.ma_bai, p); names.push(n); if (p.noi === 'lg') lg += (lg ? '\n\n' : '') + solutionPicture_(n); else hinh.push(n); });
    var r = null;
    if (hinh.join('\n') !== figNorm_(hit.data.hinh).trim()) { r = writeText_(hit, 'hinh', hinh.join('\n'), w.email); hit = findRow_('Problems', 'ma_bai', a.ma_bai); }
    if (lg !== String(hit.data.loi_giai || '')) r = writeText_(hit, 'loi_giai', lg, w.email);
    return { names: names, phien_ban: r.phien_ban };
  });
  audit_(w.email, 'thêm ảnh', a.ma_bai + ': ' + res.names.join(', '));
  return res;
}
