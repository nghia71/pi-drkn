/**
 * Áp dụng "bản vá" dữ liệu (chỉ Quản trị, chạy từ trình soạn thảo): kết quả đọc kiểm tra, mục cần kiểm tra,
 * sửa đổi có ghi chép… chuẩn bị thành tệp JSON "pi-drkn-patch-….json", tải lên Drive RIÊNG rồi chạy applyPatchLatest().
 * Chạy lại an toàn: mỗi thao tác đã áp dụng được đánh dấu (PATCH_<id> = số thao tác đã xong).
 *
 * {id, mo_ta, nguoi, ops:[…]}, mỗi op một trong:
 *   {op:'check',      ma_bai, noi_dung}
 *   {op:'conflict',   ma_bai, loai, mo_ta, cach_giai_quyet?, trang_thai?}
 *   {op:'review',     ma_bai, ky, diem, muc_de_nghi?, nhan_xet}
 *   {op:'correction', ma_bai, truong:'de_bai'|'loi_giai', truoc, sau, vi_tri, ly_do, trang_thai}
 *        — thay ĐÚNG MỘT chỗ "truoc" trong bản biên tập; bản gốc của tác giả không đổi; ghi Corrections + Revisions.
 *   {op:'closeCheck', ma_bai, chua, trang_thai}  — đóng mục cần kiểm tra có nội dung chứa "chua".
 */
function applyPatchLatest() {
  adminOnly_();
  var it = DriveApp.searchFiles("title contains 'pi-drkn-patch' and trashed = false"), best = null;
  while (it.hasNext()) { var f = it.next(); if (!best || f.getLastUpdated() > best.getLastUpdated()) best = f; }
  if (!best) throw new Error('Không thấy tệp pi-drkn-patch….json trong Drive.');
  Logger.log('Tệp: ' + best.getName());
  return applyPatch_(JSON.parse(best.getBlob().getDataAsString('UTF-8')), Session.getEffectiveUser().getEmail());
}

function applyPatch_(patch, who) {
  if (!patch || !patch.id || !patch.ops) throw new Error('Tệp vá không đúng dạng.');
  var props = PropertiesService.getScriptProperties(), key = 'PATCH_' + patch.id;
  var done = Number(props.getProperty(key) || 0), t0 = Date.now(), errors = [];
  var nguoi = patch.nguoi || who;
  var known = {};
  rows_('Problems').forEach(function (p) { known[p.ma_bai] = true; });
  for (var i = done; i < patch.ops.length && Date.now() - t0 < 4 * 60 * 1000; i++) {
    var o = patch.ops[i];
    try {
      if (!known[o.ma_bai]) throw new Error('không có bài ' + o.ma_bai);
      applyOp_(o, nguoi, who);
    } catch (e) { errors.push('#' + i + ' ' + o.op + ' ' + o.ma_bai + ': ' + e.message); }
    props.setProperty(key, String(i + 1));
  }
  var msg = (i >= patch.ops.length ? 'xong' : 'chưa xong — chạy lại') + ': ' + i + '/' + patch.ops.length +
            (errors.length ? ' — ' + errors.length + ' lỗi:\n' + errors.join('\n') : '');
  audit_(who, 'vá dữ liệu', patch.id + ' ' + msg);
  Logger.log(msg);
  return msg;
}

function applyOp_(o, nguoi, who) {
  switch (o.op) {
    case 'check':
      append_('Checks', { id: newId_(), ma_bai: o.ma_bai, noi_dung: o.noi_dung, trang_thai: 'mở', nguoi: nguoi, ngay: now_() }); return;
    case 'conflict':
      if (CONFLICT_TYPES.indexOf(o.loai) < 0) throw new Error('loại xung đột không hợp lệ: ' + o.loai);
      append_('Conflicts', { id: newId_(), ma_bai: o.ma_bai, loai: o.loai, mo_ta: o.mo_ta, cach_giai_quyet: o.cach_giai_quyet || '',
                             trang_thai: o.trang_thai || 'mở', nguoi: nguoi, ngay: now_() }); return;
    case 'review':
      append_('Reviews', { id: newId_(), ky: o.ky, ma_bai: o.ma_bai, email: '', muc_de_nghi: o.muc_de_nghi || '', diem: o.diem,
                           nhan_xet: o.nhan_xet, ngay: now_() }); return;
    case 'correction': return applyCorrection_(o, who);
    case 'closeCheck':
      var hit = rows_('Checks').filter(function (c) { return c.ma_bai === o.ma_bai && String(c.noi_dung).indexOf(o.chua) >= 0; });
      if (hit.length !== 1) throw new Error('tìm thấy ' + hit.length + ' mục cần kiểm tra khớp "' + o.chua + '" (cần đúng 1)');
      update_('Checks', hit[0]._row, { trang_thai: o.trang_thai || 'xong' }); return;
    default: throw new Error('op không hỗ trợ');
  }
}

/** Sửa bản biên tập: "truoc" phải xuất hiện đúng một lần; nếu "sau" đã có mặt và "truoc" không còn thì coi như đã sửa. */
function applyCorrection_(o, who) {
  if (['de_bai', 'loi_giai'].indexOf(o.truong) < 0) throw new Error('truong phải là de_bai hoặc loi_giai');
  withLock_(function () {
    var hit = findRow_('Problems', 'ma_bai', o.ma_bai), text = String(hit.data[o.truong] || '');
    var n = text.split(o.truoc).length - 1;
    if (n === 0 && text.indexOf(o.sau) >= 0) return;            // đã áp dụng trước đó
    if (n !== 1) throw new Error('"' + o.truoc + '" xuất hiện ' + n + ' lần trong ' + o.truong + ' (cần đúng 1)');
    writeText_(hit, o.truong, text.replace(o.truoc, function () { return o.sau; }), who);
    sheet_('Corrections').appendRow(rowOf_('Corrections', { id: newId_(), ma_bai: o.ma_bai, vi_tri: o.vi_tri, truoc: o.truoc, sau: o.sau,
      ly_do: o.ly_do, trang_thai: o.trang_thai || 'đã sửa ở bản biên tập', nguoi: who, ngay: now_() }));
  });
}
