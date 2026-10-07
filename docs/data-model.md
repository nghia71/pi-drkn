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
