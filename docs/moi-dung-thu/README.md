# Mời dùng thử

Mẫu thư và việc chuẩn bị cho đợt dùng thử. **Tên, email thật, đường dẫn đăng nhập không ghi vào kho** — điền vào chỗ `{{…}}`
khi soạn thư (Gmail), không commit bản đã điền.

| Tệp | Dùng khi |
|---|---|
| `thu-chinh.md` | thư đầu tiên, gửi người quyết định (TBT/PT): hệ thống là gì, ai tham gia, lịch, mỗi người nhận gì / làm gì, bàn giao |
| `thu-vai-tro.md` | sau khi người quyết định đồng ý: mỗi người một thư theo vai trò, cc người quyết định |

## Quản trị chuẩn bị trước khi gửi (khoảng 30 phút)

1. `scripts/deploy.sh` bản mới nhất; thư kiểm thử sau triển khai không báo lỗi.
2. Hướng dẫn PDF đã có ở bản phát hành `huong-dan` (GitHub tự dựng khi gộp vào `main`) — mở thử từng đường dẫn trong thư.
3. Sheet dữ liệu → tab `Users`: mỗi người một dòng (email, tên, vai trò, `hoat_dong` = TRUE). Email cơ quan chạy trên Google
   (kiểm tra: `dig +short MX <tên miền>` có `google.com`) dùng được ngay; email khác: người đó tạo tài khoản Google bằng chính email ấy.
4. Script property `PRACTICE_USERS` = email những người dùng thử (cách nhau dấu phẩy) — để họ thấy 10 bài luyện tập THU-01…10.
   Chạy `resetPractice` (tạo lại bài luyện, kỳ luyện K-THU). Hết đợt dùng thử: xoá `PRACTICE_USERS`.
5. Thử đăng nhập bằng **một** tài khoản của người dùng thử (hoặc nhờ một người thử trước) — nếu gặp „Truy cập bị chặn",
   xem `docs/huong-dan` slide „Trước khi bắt đầu".
6. Điền thư, đọc lại các đường dẫn, gửi. Theo dõi: thư tóm tắt góp ý và lỗi mỗi sáng (`docs/setup.md` mục 16).

## Đường dẫn (cố định)

- Hướng dẫn theo vai trò: `https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-<vai>.pdf`
  — `<vai>`: `pt` (Phụ trách chuyên mục), `tbt` (Tổng biên tập), `ncb` (Người chuẩn bị bài), `pb` (Phản biện), `vp` (Văn phòng),
  `btk` (Ban trình bày), `quantri` (Quản trị).
- Ảnh từng bước của mọi quy trình: `https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-anh.zip`
- Kiến trúc, triển khai, bàn giao: `docs/guide/kientruc.tex` (slide), `docs/handover.md`, `docs/setup.md` (trong kho mã).
- Đường dẫn đăng nhập: địa chỉ /exec của ứng dụng đăng nhập (`SIGNIN_URL`) — chỉ gửi qua thư, không đăng công khai.
