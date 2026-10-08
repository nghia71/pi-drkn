# Mời dùng thử

Mẫu thư và việc của Quản trị cho đợt dùng thử. **Tên, email thật, đường dẫn đăng nhập không ghi vào kho** — điền vào chỗ `{{…}}`
khi soạn thư (Gmail), không commit bản đã điền.

| Tệp | Dùng khi |
|---|---|
| `thu-chinh.md` | thư đầu tiên, gửi người quyết định (TBT/PT): hệ thống là gì, ai tham gia, lịch, dùng thử không sợ sai, an toàn, bàn giao |
| `thu-vai-tro.md` | sau khi người quyết định đồng ý: mỗi người một thư theo vai trò, cc người quyết định |

## Trước khi gửi thư chính (khoảng 30 phút)

1. Gộp Pull request vào `main`, chờ việc **huong-dan** trên GitHub xanh, mở thử bảy đường dẫn PDF (bên dưới). Triển khai từ `main`:
   `git pull`, `scripts/test-all.sh`, `scripts/deploy.sh`. Kiểm thử sau triển khai chỉ gửi thư khi có lỗi — xem tab „Kết quả" của Sheet kiểm thử.
2. Script properties của dự án chính có `SIGNIN_URL` (thư mời, nút Đăng nhập lại, thư tóm tắt cần nó). Đã chạy `installReminderTrigger`
   và `installAutoTests` (sao lưu mỗi đêm, thư tóm tắt góp ý mỗi sáng): sáng hôm sau thư mục „Pi ĐRKN — sao lưu" có bản của ngày.
3. Thử đăng nhập bằng **email của người quyết định** (nhờ họ, hoặc một tài khoản cùng tên miền): vào được thì ghi „đã thử vào được"
   trong thư; gặp „Truy cập bị chặn" thì dùng Gmail cá nhân (thư mục 4.3).

## Trước khi gửi thư theo vai trò

4. Sheet dữ liệu → tab `Users`: mỗi người một dòng — `email`, `ten`, `vai_tro` ghi bằng **mã**: `TBT`, `PT`, `NCB`, `PB`, `VP`, `BTK`,
   `Quản trị` (nhiều vai trò cách nhau dấu phẩy; tên đầy đủ như „Tổng biên tập" không được nhận), `hoat_dong` = TRUE.
   Phản biện dùng một tài khoản riêng, không kiêm NCB (để thử chấm ẩn danh).
5. Script property `PRACTICE_USERS` = email những người dùng thử (cách nhau dấu phẩy) — người có vai trò ban biên tập thấy mười bài luyện.
   **Không** ghi email người thật vào `TEST_USERS`: hàm `resetPractice` trong trình soạn thảo đặt hai người đầu của `TEST_USERS` thành PB.
   Đặt lại bài luyện cho đợt thử: nút *Đặt lại bài luyện tập* trên trang Kỳ phản biện (không đổi vai trò của ai).
6. Phản biện dùng thử thấy bài luyện **khi được giao**: Phụ trách chuyên mục (hoặc Quản trị) mở kỳ `THU-KY-1`, giao vài bài THU-… cho họ.
   Mỗi lần Đặt lại, giao lại.
7. Trang Kỳ phản biện → **Bắt đầu dùng thử** (chụp toàn bộ dữ liệu). Báo những người khác trong ban biên tập đã có tài khoản: dòng
   „Đang dùng thử" nghĩa là việc làm trên trang có thể bị đưa về.
8. Điền và gửi thư theo vai trò (cc người quyết định). Theo dõi: thư tóm tắt góp ý và lỗi mỗi sáng (`docs/setup.md` mục 16).

## Trong đợt thử

- Không chạy `importLatest`, `applyPatchLatest` (nhập, vá): đưa về như trước không xoá dấu „đã nhập / đã vá" trong Script properties.
- Không khoá kỳ cho số thật. Khoá bảng luyện tập (THU-…) để Ban trình bày thử được; trước lần khoá kỳ thật đầu tiên, bấm Đặt lại bài
  luyện tập (số in của bảng luyện bị xoá, không đẩy số thật lên).

## Kết thúc đợt thử (họp tổng kết)

9. Trang Kỳ phản biện → **Kết thúc dùng thử**: giữ mọi thay đổi, hoặc đưa về rồi kết thúc.
10. Xoá `PRACTICE_USERS`; bấm Đặt lại bài luyện tập lần cuối (hoặc để nguyên — bài THU chỉ Quản trị thấy).
11. Tab `Users`: `hoat_dong` = FALSE cho người không tiếp tục.
12. Thư mục „Pi ĐRKN — sao lưu": xoá các bản „trước dùng thử", „trước khi đưa về" khi không cần nữa (chúng không tự xoá như bản sao lưu đêm).
    Thư mục „Pi ĐRKN — chế bản": xoá gói của bảng luyện tập.

## Đường dẫn (cố định, có sau khi gộp vào `main`)

- Hướng dẫn theo vai trò: `https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-<vai>.pdf`
  — `<vai>`: `pt` (Phụ trách chuyên mục), `tbt` (Tổng biên tập), `ncb` (Người chuẩn bị bài), `pb` (Phản biện), `vp` (Văn phòng),
  `btk` (Ban trình bày), `quantri` (Quản trị).
- Ảnh từng bước của mọi quy trình: `https://github.com/nghia71/pi-drkn/releases/download/huong-dan/huong-dan-anh.zip`
- Kiến trúc, triển khai, bàn giao: `https://github.com/nghia71/pi-drkn/releases/download/huong-dan/kien-truc.pdf`;
  `docs/setup.md`, `docs/handover.md` trong kho mã.
- Đường dẫn đăng nhập: địa chỉ /exec của ứng dụng đăng nhập (`SIGNIN_URL`) — chỉ gửi qua thư, không đăng công khai.
