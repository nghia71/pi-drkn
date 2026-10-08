/**
 * Mô hình dữ liệu: mỗi bảng là một tab của Google Sheet. Cột đầu tiên là khoá.
 * Văn bản đề/lời giải là LaTeX "sạch" — mọi ghi chú nằm ở các bảng thuộc tính (Provenance, Corrections,
 * Checks, Conflicts), không bao giờ nằm trong văn bản. Xem docs/data-model.md.
 */
var SCHEMA = {
  Problems: ['ma_bai', 'ma_tam', 'chu_de', 'muc', 'trang_thai', 'dang', 'so_in', 'loai', 'tac_gia_id',
             'de_bai', 'loi_giai', 'de_bai_goc', 'loi_giai_goc', 'hinh', 'phien_ban', 'cap_nhat', 'nguoi_cap_nhat'],
  Provenance: ['ma_bai', 'thu_muc', 'thu_muc_id', 'tep_goc', 'ngay_nhan', 'kenh', 'ban_trung_gian',
               'lich_su_vong', 'doi_chieu', 'tom_tat_doi_chieu'],
  Corrections: ['id', 'ma_bai', 'vi_tri', 'truoc', 'sau', 'ly_do', 'trang_thai', 'nguoi', 'ngay'],
  Checks: ['id', 'ma_bai', 'noi_dung', 'trang_thai', 'nguoi', 'ngay', 'ket_qua'],   // ket_qua: ghi khi đóng (thêm 2026-10)
  Conflicts: ['id', 'ma_bai', 'loai', 'mo_ta', 'cach_giai_quyet', 'trang_thai', 'nguoi', 'ngay'],
  ConversionLog: ['id', 'ma_bai', 'noi_dung', 'ngay'],
  Authors: ['tac_gia_id', 'ten_in', 'don_vi', 'lien_he', 'ghi_chu'],            // hạn chế: VP, PT, TBT, Quản trị
  Users: ['email', 'ten', 'vai_tro', 'hoat_dong', 'ghi_chu'],
  Rounds: ['ky', 'trang_thai', 'm', 'han_phan_bien', 'khoa_luc', 'ghi_chu', 'mo_loi_giai'],   // mo_loi_giai: lúc PT cho phản biện xem lời giải (thêm 2026-10)
  Shortlist: ['ky', 'ma_bai', 'vi_tri', 'phuong_an', 'quyet_dinh', 'nguoi', 'ngay', 'trang_thai_truoc', 'muc_truoc'],   // bảng chọn bài (Board.gs)
  Issues: ['so', 'trang_thai', 'nguoi_duyet', 'duyet_luc', 'ghi_chu', 'khoa_luc', 'tep'],                                         // thêm 2026-10; khoa_luc, tep: khoá kỳ (Close.gs)
  Assignments: ['ky', 'ma_bai', 'email', 'giao_luc', 'han', 'xong', 'moi_luc', 'nhac'],   // moi_luc, nhac: thêm 2026-10
  Reviews: ['id', 'ky', 'ma_bai', 'email', 'muc_de_nghi', 'diem', 'nhan_xet', 'ngay'],
  Comments: ['id', 'ma_bai', 'email', 'tra_loi_cho', 'noi_dung', 'ngay'],
  Published: ['ma_bai', 'so_tap_chi', 'so_in', 'ngay'],
  Revisions: ['id', 'ma_bai', 'truong', 'phien_ban', 'cu', 'moi', 'email', 'ngay'],
  Audit: ['ngay', 'email', 'hanh_dong', 'chi_tiet'],
  Feedback: ['id', 'ngay', 'email', 'vai', 'trang', 'diem', 'noi_dung', 'trang_thai'],          // nút Góp ý (Feedback.gs); trang_thai: Quản trị ghi
  Errors: ['ngay', 'email', 'vai', 'trang', 'loi', 'chi_tiet', 'trinh_duyet']                    // lỗi người dùng gặp trên trang (Feedback.gs)
};

/** Loại xung đột được phép (Nghĩa, 2026-10-06) — mỗi xung đột một dòng riêng. */
var CONFLICT_TYPES = ['số hiệu', 'mức', 'bản chép khác nhau', 'trùng bài', 'đề và lời giải không khớp', 'tác giả', 'trạng thái'];
var STATUSES = ['Mới', 'SL', 'SL-OK', 'SL-Fail', 'Không SL', 'PL'];
/** Không SL: không đủ điều kiện vào danh sách sơ bộ, không cần xem nữa (Nghĩa, 2026-10-08). Hai trạng thái loại này phải ghi lý do;
 *  bài ở đó không giao phản biện, không xếp vào bảng chọn bài, không hiện trong danh sách mặc định. */
var REASON_STATUSES = ['Không SL', 'SL-Fail'];
var TOPICS = ['ĐS', 'SH', 'HH', 'TH'];
var ROLES = ['TBT', 'PT', 'NCB', 'PB', 'VP', 'BTK', 'Quản trị'];

/* Các danh sách trạng thái dưới đây là quy ước của ban biên tập — đổi ở đây, không rải trong mã. */
var CHECK_STATUSES = ['mở', 'xong'];
var CONFLICT_STATUSES = ['mở', 'chờ TBT', 'đã giải quyết'];
/** Xung đột loại này chỉ TBT ghi cách giải quyết (người khác chỉ chuyển sang "chờ TBT"). */
var TBT_CONFLICTS = ['mức', 'tác giả', 'trùng bài'];
/** Sửa nội dung toán: dòng Corrections mới mang trạng thái đầu tiên. */
/** Phiếu phản biện: đề nghị của phản biện (cột Reviews.diem) và mức đề nghị (Reviews.muc_de_nghi). */
var REVIEW_RECOMMENDATIONS = ['chọn', 'sửa rồi chọn', 'không chọn'];
var LEVELS = ['A', 'B'];
var CORRECTION_STATUSES = ['chờ tác giả xác nhận', 'tác giả đồng ý', 'tác giả không đồng ý', 'đã sửa ở bản biên tập'];
