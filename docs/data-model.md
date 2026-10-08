# Mô hình dữ liệu

Định nghĩa cột: `apps/main/Schema.gs`. Mỗi tab là một bảng; cột đầu là khoá.

## Mã bài
`YYYY-MM-NN` + chữ cái: năm-tháng-số thứ tự hồ sơ trong tháng của Văn phòng + thứ tự bài trong hồ sơ
(ví dụ `2026-06-10a`). Mã không bao giờ đổi. Thuộc tính đổi theo vòng đời và được hiển thị kèm mã:
chủ đề (ĐS/SH/HH/TH), mức (A/B), trạng thái (Mới / SL / SL-OK / SL-Fail / PL), đăng (Pi tháng/năm · số in P…).
Bài chưa xác định được hồ sơ gốc dùng mã tạm (ví dụ `SL09-1042`), ghi trong cột `ma_tam`.

## Bảng
| Tab | Nội dung |
|---|---|
| Problems | đề, lời giải (bản biên tập, LaTeX sạch) + bản gốc của tác giả; phiên bản (khoá lạc quan) |
| Provenance | hồ sơ gốc, thư mục Drive, ngày nhận, kênh, các bản trung gian, lịch sử các vòng, đối chiếu nguyên bản |
| Corrections | mỗi sửa đổi một dòng |
| Checks | mục "cần kiểm tra" |
| Conflicts | xung đột có loại: số hiệu, mức, bản chép khác nhau, trùng bài, đề và lời giải không khớp, tác giả, trạng thái |
| ConversionLog | thay đổi thuần cách gõ khi chuyển đổi |
| Authors | tên in, đơn vị; `lien_he` hạn chế |
| Users | email, vai trò |
| Rounds, Shortlist, Assignments, Reviews, Comments | kỳ phản biện (cả lúc mở lời giải), bảng chọn bài, phân công phản biện, phiếu, thảo luận theo bài |
| Issues | bảng chọn bài theo số báo: trạng thái (đang chọn, chờ duyệt, đã duyệt, đã khoá), người duyệt, lúc khoá, gói chế bản |
| Published | bài đã đăng: số tạp chí, số in (ghi khi khoá kỳ) |
| Revisions, Audit | lịch sử sửa, nhật ký truy cập |

## Ai thấy gì
| Vai trò | Thấy | Sửa |
|---|---|---|
| TBT, PT | mọi bài, tác giả, liên hệ | trạng thái, xung đột, mục kiểm tra (PT: đề/lời giải) |
| NCB | mọi bài, tác giả (không liên hệ) | đề/lời giải (bản biên tập), sửa đổi, kiểm tra, xung đột |
| VP | mọi bài, tác giả, liên hệ | nhập bài |
| BTK | mọi bài | — (tải tệp .tex của số đã khoá) |
| PB | chỉ bài được giao trong kỳ đang mở; không thấy tác giả khi BLIND_REVIEW=true | nhận xét |
| Quản trị | mọi thứ; "Xem như vai trò…" để thử giao diện | người dùng, nhập hàng loạt |

**Hai loại sửa** (chọn khi bấm Lưu): *sửa nhỏ* (chính tả, định dạng, bổ sung dữ liệu thiếu) chỉ ghi Revisions;
*sửa nội dung toán* (công thức, đáp số, lập luận) bắt buộc ghi vị trí và lý do, thêm một dòng Corrections
"chờ tác giả xác nhận" — đoạn trước/sau được tách tự động từ hai bản. Đổi trạng thái sửa đổi không tự đổi văn bản.

**Quyết định trên trang bài** (NCB, PT, TBT, Quản trị): thêm/đóng mục cần kiểm tra (đóng phải ghi `ket_qua`),
thêm xung đột, ghi cách giải quyết; xung đột loại *mức, tác giả, trùng bài* chỉ TBT đặt "đã giải quyết", người khác chuyển "chờ TBT".
Đổi trạng thái bài: PT, TBT, Quản trị. Các danh sách trạng thái nằm ở đầu `apps/main/Schema.gs` (CHECK_STATUSES, CONFLICT_STATUSES,
TBT_CONFLICTS, CORRECTION_STATUSES) — đổi quy ước thì sửa ở đó. Mọi thao tác được ghi vào Audit (ai, khi nào).

**Lời giải và phản biện** (Nghĩa, 2026-10-08): phản biện tự giải trước — máy chủ KHÔNG gửi lời giải (cả hình trong lời giải) cho
phản biện cho tới khi PT hoặc TBT bấm "Mở lời giải cho phản biện" ở kỳ đó (`Rounds.mo_loi_giai` = lúc mở; đóng lại được).
Sau đó phản biện vẫn nhận xét tiếp; PT đóng kỳ rồi chọn bài trên Bảng chọn bài.

**Thêm bài trên trang web** (Intake.gs; VP, NCB, PT, TBT, Quản trị): mã = tháng nhận + thư mục kế tiếp còn trống + a, b…; bài Mới,
phiên bản 1, bản gốc = văn bản lúc thêm; Provenance (thư mục, tệp gốc, ngày, kênh), ConversionLog (ai thêm, mức tác giả đề nghị, ảnh).
Ảnh của đề: tên trong cột Hình; ảnh lời giải: `\includegraphics{…}` cuối lời giải.

**Danh sách bài**: mặc định chỉ bài đang xử lý (Mới, SL); sắp xếp mới nhận trước (thư mục mới trước, trong thư mục a, b…),
cần xử lý trước, chủ đề rồi mức, hoặc theo mã; mỗi lần hiện 30 bài ("Xem thêm"). Phản biện thấy mọi bài được giao.

**Kỳ phản biện** (tab Rounds, Assignments, Reviews): PT, Quản trị mở kỳ (tên, hạn), giao bài cho người có vai trò PB,
gửi thư mời, đổi hạn, đóng kỳ; TBT, NCB xem tiến độ. Phản biện điền **Phiếu phản biện** (mức đề nghị A/B; đề nghị
chọn / sửa rồi chọn / không chọn; nhận xét) — một phiếu cho mỗi kỳ, bài, người; lưu lại thì thay phiếu cũ — rồi **đánh dấu xong**
(khoá phiếu). Phản biện chỉ thấy phiếu của mình; TBT, PT, NCB, Quản trị thấy mọi phiếu kèm email.
Thảo luận: phản biện thấy nhận xét của nhau nhưng **ẩn danh** ("Bạn", "Phản biện 1, 2…", "Ban biên tập"; không có email).
Ngày hạn được lưu như chữ `NNNN-TT-NN` (không để Sheets đổi thành kiểu ngày). Cột `nhac` ghi các mốc đã nhắc (ví dụ `3,1`).

**Bảng chọn bài** (tab Issues, Shortlist): mỗi số báo (ví dụ `10/2026`) một bảng, các vị trí theo thứ tự in, mức của vị trí theo
`BOARD_LAYOUT`. PT, Quản trị lập bảng, xếp/bỏ/đổi chỗ, gửi TBT; TBT duyệt hoặc trả lại (bắt buộc ghi lý do); PT, TBT, Quản trị mở lại.
Khi TBT duyệt: các bài được chọn thành SL-OK và nhận mức của vị trí (trạng thái, mức cũ ghi ở `trang_thai_truoc`, `muc_truoc`);
mở lại một bảng đã duyệt thì trả các bài về như cũ. Bài không được chọn giữ nguyên trạng thái (thường là SL) — còn dùng cho số sau;
SL-Fail chỉ khi TBT loại hẳn. Một bài chỉ nằm trong một bảng.
Số báo, tên kỳ dạng `10/2026` được lưu như chữ (Sheets không đổi thành ngày); mọi ghi sửa chỉ ghi đúng các ô thay đổi.

**Khoá kỳ** (Close.gs; quy ước của Nghĩa, 2026-10-07): từ bảng đã duyệt, PT/TBT/Quản trị đánh số in và khoá.
Số in bắt đầu gợi ý = số lớn nhất trong Published + 1 (sửa được trước khi xác nhận); số trong một kỳ liên tiếp; không dùng lại số đã có.
Thứ tự in: mức B rồi mức A; trong mỗi mức Số học, Đại số, Hình học, Tổ hợp; cùng chủ đề theo vị trí trên bảng. Khoá: mỗi bài một dòng Published
(`ma_bai`, `so_tap_chi`, `so_in` dạng `P1041`, `ngay`), Problems: `trang_thai` = PL, `so_in`, `dang` = số báo; Issues: `trang_thai` = "đã khoá",
`khoa_luc`, `tep` (đường dẫn gói chế bản). Tệp `.tex` CHỈ có đề bài theo mẫu cột của Pi (`\setcounter{stthuc}{số đầu − 1}`, mỗi bài
`\thachthuc (Mức $B$)`, đề thụt 2 dấu cách, `\item` thụt 4, hình TikZ đặt ngay trong `center`, hình ảnh trong `pic/`, dòng tác giả
`\textit{Tên in (Đơn vị)}` canh phải) — không lời giải, ghi chú biên tập, mục kiểm tra, xung đột, nguồn gốc hay liên hệ. Chặn khoá khi thiếu
tên in của tác giả hoặc đề trống; mục cần kiểm tra, xung đột còn mở, cảnh báo hiển thị, ít bài hơn bố cục thì phải đánh dấu đã xem.

**Hình vẽ** (quy ước của Nghĩa, 2026-10-07):
1. Bài cũ, đã qua vài vòng mà mất hình: vẽ lại và hiển thị.
2. Bài mới, hình dựng được từ văn bản mà không mâu thuẫn với đề hay lời giải: vẽ.
3. Bài mới, hình không dựng được từ văn bản hoặc mâu thuẫn: ghi một mục **Cần kiểm tra** (Checks) cho bài.

Cột `Problems.hinh` (Fig.gs): hoặc mã TikZ (một hay nhiều khối `tikzpicture`, không gì khác), hoặc tên tệp ảnh `.png/.jpg/.pdf`
trong thư mục hình (`FIG_FOLDER_ID`), mỗi dòng một tên. Sửa như đề bài (NCB, PT, Quản trị; phiên bản, lịch sử; không nhận lệnh đọc/ghi tệp).
Khối `tikzpicture` trong đề bài, lời giải cũng là hình. Mỗi khối có **mã** = 16 ký tự đầu của SHA-256 (UTF-8, NFC, xuống dòng `\n`)
của chính khối; SVG đã dựng lưu trong thư mục hình tên `tikz-<mã>.svg`. Sửa TikZ thì mã đổi — trang hiện "chưa dựng" cho tới khi có SVG
mới, không bao giờ hiện hình cũ cho mã mới. Trang web hiện SVG/ảnh bằng `<img src="data:…">` (trình duyệt không chạy mã trong ảnh);
SVG tải lên phải đúng tên của một hình đang có và không chứa mã chạy được, nội dung nhúng hay liên kết ra ngoài.
Khi khoá kỳ: TikZ đặt ngay trong tệp `.tex`, ảnh vào `pic/`.

Thêm cột vào mô hình: chỉ thêm ở **cuối** tab; chạy lại `setup()` để ghi tiêu đề cột mới (dữ liệu cũ giữ nguyên).

Lịch sử sửa đề/lời giải (tab Revisions) chỉ những vai trò thấy mọi bài xem được — PB không xem, vì các bản trước gần với bản gốc của tác giả.
Sửa dùng khoá lạc quan: gửi kèm `phien_ban` đang xem; nếu người khác vừa lưu thì bị từ chối, không ghi đè. Lưu mà không đổi gì thì không tạo phiên bản mới.
