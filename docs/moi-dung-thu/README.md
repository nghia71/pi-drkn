# Mời dùng thử — việc của Quản trị

Hai mẫu thư:

- `thu-chinh.md` — thư giới thiệu cho người quyết định (Tổng biên tập / Phụ trách chuyên mục): hệ thống là gì, trông thế nào
  (hướng dẫn có ảnh), đề nghị dùng thử, xin họ đồng ý và cho biết email. **Chưa có đường dẫn đăng nhập.**
- `thu-vai-tro.md` — thư mở tài khoản, có đường dẫn đăng nhập: gửi người quyết định khi họ đồng ý (hoặc muốn xem thử),
  rồi gửi từng người khác (cc người quyết định).

Chép mẫu vào Gmail, thay các chỗ `{{…}}` (tên, email, đường dẫn đăng nhập…). Bản đã điền **không** đưa vào kho mã.

---

## A. Gửi thư giới thiệu (khoảng 10 phút)

1. **Mã mới nhất đã triển khai.** Trên Mac, trong thư mục `pi-drkn`: `git pull`, rồi `scripts/test-all.sh`, rồi `scripts/deploy.sh`.
2. **Hai cài đặt một lần** (dự án Apps Script chính):
   - *Project Settings → Script properties* có dòng `SIGNIN_URL` = địa chỉ trang đăng nhập.
   - *Triggers* (biểu tượng đồng hồ) có `sendReminders` và `autoTests`. Thiếu thì chạy `installReminderTrigger`, `installAutoTests` (Run).
3. **Điền thư `thu-chinh.md` và gửi.** Chờ họ trả lời: đồng ý (hay muốn xem thử), danh sách người, email muốn dùng.

## B. Khi người quyết định đồng ý: mở tài khoản cho họ

1. Sheet *Pi ĐRKN — dữ liệu* → tab `Users` → thêm một dòng: email họ cho · tên · `TBT, PT` · `TRUE`.
2. *Script properties* → `PRACTICE_USERS` = email đó (để họ thấy mười bài luyện tập).
3. Vào hệ thống → trang *Kỳ phản biện* → **Bắt đầu dùng thử** (lưu bản sao toàn bộ dữ liệu — để mọi việc đưa về được).
4. Tự mở đường dẫn đăng nhập trong cửa sổ ẩn danh: vào được, đầu trang có dòng „Đang dùng thử".
5. Gửi họ thư `thu-vai-tro.md` (bỏ dòng cc).

Họ trả lời „Truy cập bị chặn" kèm một Gmail: sửa email ở tab `Users` và ở `PRACTICE_USERS`, báo họ vào lại bằng đúng đường dẫn cũ.

## C. Mời từng người khác (theo danh sách người quyết định đồng ý)

1. Tab `Users`: mỗi người một dòng — email · tên · vai trò · `TRUE`. Vai trò ghi bằng **mã** (nhiều vai trò cách nhau dấu phẩy):

   | Mã | Vai trò |
   |---|---|
   | `TBT` | Tổng biên tập |
   | `PT` | Phụ trách chuyên mục |
   | `NCB` | Người chuẩn bị bài |
   | `PB` | Phản biện — dùng một tài khoản riêng, không kiêm NCB (để thử chấm ẩn danh) |
   | `VP` | Văn phòng |
   | `BTK` | Ban trình bày |
   | `Quản trị` | Quản trị |

2. `PRACTICE_USERS`: thêm email của họ (cách nhau dấu phẩy). Đừng dùng `TEST_USERS` cho người thật — đó là tài khoản của bộ kiểm thử.
3. Có phản biện: mở kỳ phản biện `THU-KY-1`, giao vài bài THU-… cho họ (phản biện chỉ thấy bài được giao).
4. Người khác trong ban biên tập đã có tài khoản (ngoài đợt thử): báo họ dòng „Đang dùng thử" nghĩa là việc làm trên trang có thể bị đưa về.
5. Gửi mỗi người một thư theo mẫu `thu-vai-tro.md`, cc người quyết định.

## D. Trong ba tuần dùng thử

- Mỗi sáng đọc **thư tóm tắt góp ý và lỗi** (chỉ đến khi có điều mới).
- **Không bấm Khoá kỳ cho số báo thật.** Khoá số luyện tập (tên THU-…) thì được — để Ban trình bày thử.
- Trước lần khoá kỳ thật đầu tiên: bấm **Đặt lại bài luyện tập** (xoá số in của số luyện tập).
- Sau mỗi lần ai đó bấm **Đưa về**: xem lại trang Kỳ phản biện — phân công trở về như lúc bắt đầu.
- Nhập, vá dữ liệu bị khoá tự động cho tới khi kết thúc dùng thử.

## E. Kết thúc (sau buổi họp tổng kết)

1. Trang *Kỳ phản biện* → **Kết thúc dùng thử**: giữ mọi thay đổi, hoặc đưa về rồi kết thúc.
2. Xoá `PRACTICE_USERS`.
3. Tab `Users`: ai không tiếp tục thì đổi `TRUE` thành `FALSE`.
4. Drive: trong *Pi ĐRKN — sao lưu* xoá các bản „trước dùng thử", „trước khi đưa về" (chúng không tự xoá); trong *Pi ĐRKN — chế bản*
   xoá gói của số luyện tập.

---

## Đường dẫn để dán vào thư

Hướng dẫn theo vai trò (PDF, có ảnh từng bước; tự cập nhật khi hướng dẫn đổi):

| Vai trò | Đường dẫn |
|---|---|
| Tổng biên tập | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-tbt.pdf |
| Phụ trách chuyên mục | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-pt.pdf |
| Người chuẩn bị bài | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-ncb.pdf |
| Phản biện | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-pb.pdf |
| Văn phòng | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-vp.pdf |
| Ban trình bày | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-btk.pdf |
| Quản trị | https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-quantri.pdf |

- Ảnh từng bước của mọi quy trình: https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-anh.zip
- Kiến trúc, triển khai, bàn giao: https://github.com/nghia71/pi-drkn/releases/download/huong-dan/kien-truc.pdf
- Đường dẫn đăng nhập (giá trị của `SIGNIN_URL`): chỉ gửi qua thư, không đăng ở nơi công khai.
