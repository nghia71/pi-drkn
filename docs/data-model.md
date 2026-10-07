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
| Rounds, Shortlist, Assignments, Reviews, Comments | vòng chọn bài, phân công phản biện, nhận xét, thảo luận theo bài |
| Published | bài đã đăng: số tạp chí, số in |
| Revisions, Audit | lịch sử sửa, nhật ký truy cập |

## Ai thấy gì
| Vai trò | Thấy | Sửa |
|---|---|---|
| TBT, PT | mọi bài, tác giả, liên hệ | trạng thái, xung đột, mục kiểm tra (PT: đề/lời giải) |
| NCB | mọi bài, tác giả (không liên hệ) | đề/lời giải (bản biên tập), sửa đổi, kiểm tra, xung đột |
| VP | mọi bài, tác giả, liên hệ | nhập bài |
| BTK | mọi bài | — (xuất bản khoá kỳ) |
| PB | chỉ bài được giao trong kỳ đang mở; không thấy tác giả khi BLIND_REVIEW=true | nhận xét |
| Quản trị | mọi thứ; "Xem như vai trò…" để thử giao diện | người dùng, nhập hàng loạt |

**Hai loại sửa** (chọn khi bấm Lưu): *sửa nhỏ* (chính tả, định dạng, bổ sung dữ liệu thiếu) chỉ ghi Revisions;
*sửa nội dung toán* (công thức, đáp số, lập luận) bắt buộc ghi vị trí và lý do, thêm một dòng Corrections
"chờ tác giả xác nhận" — đoạn trước/sau được tách tự động từ hai bản. Đổi trạng thái sửa đổi không tự đổi văn bản.

**Quyết định trên trang bài** (NCB, PT, TBT, Quản trị): thêm/đóng mục cần kiểm tra (đóng phải ghi `ket_qua`),
thêm xung đột, ghi cách giải quyết; xung đột loại *mức, tác giả, trùng bài* chỉ TBT đặt "đã giải quyết", người khác chuyển "chờ TBT".
Đổi trạng thái bài: PT, TBT, Quản trị. Các danh sách trạng thái nằm ở đầu `apps/main/Schema.gs` (CHECK_STATUSES, CONFLICT_STATUSES,
TBT_CONFLICTS, CORRECTION_STATUSES) — đổi quy ước thì sửa ở đó. Mọi thao tác được ghi vào Audit (ai, khi nào).

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

**Hình vẽ** (quy ước của Nghĩa, 2026-10-07; dựng hình ở mục "Hình" sau này):
1. Bài cũ, đã qua vài vòng mà mất hình: vẽ lại và hiển thị.
2. Bài mới, hình dựng được từ văn bản mà không mâu thuẫn với đề hay lời giải: vẽ.
3. Bài mới, hình không dựng được từ văn bản hoặc mâu thuẫn: ghi một mục **Cần kiểm tra** (Checks) cho bài.

Thêm cột vào mô hình: chỉ thêm ở **cuối** tab; chạy lại `setup()` để ghi tiêu đề cột mới (dữ liệu cũ giữ nguyên).

Lịch sử sửa đề/lời giải (tab Revisions) chỉ những vai trò thấy mọi bài xem được — PB không xem, vì các bản trước gần với bản gốc của tác giả.
Sửa dùng khoá lạc quan: gửi kèm `phien_ban` đang xem; nếu người khác vừa lưu thì bị từ chối, không ghi đè. Lưu mà không đổi gì thì không tạo phiên bản mới.
