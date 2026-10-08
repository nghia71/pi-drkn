# Bàn giao hệ thống Đề ra kỳ này cho Pi

Sau khi bàn giao, **Pi sở hữu cả ba phần**: mã nguồn (GitHub), ứng dụng và dữ liệu (Google), các khoá bí mật.
Người xây hệ thống chỉ còn quyền nào Pi muốn cho. Không có gì phải viết lại; địa chỉ web người dùng đang dùng có thể giữ nguyên.

Thời gian: khoảng một buổi. Cần một người của Pi quen dùng Terminal (hoặc để chúng tôi làm giúp — mục 8).
Toàn cảnh hệ thống: slide `docs/guide/kientruc.tex`; cài đặt từ đầu: `docs/setup.md`.

## 1. Những gì được bàn giao

| Phần | Nằm ở đâu | Cách chuyển |
|---|---|---|
| Mã nguồn | GitHub `nghia71/pi-drkn` (công khai) | chuyển kho sang tổ chức GitHub của Pi (mục 3) |
| Dựng hình tự động | GitHub `nghia71/pi-drkn-hinh` (riêng tư) | chuyển kho; mã thông báo mới (mục 3) |
| Ứng dụng chính, ứng dụng đăng nhập | hai dự án Apps Script (Drive của chủ hiện tại) | chuyển quyền sở hữu trên Drive, triển khai lại bằng tài khoản Pi (mục 4, 5) |
| Dữ liệu | Sheet **Pi ĐRKN — dữ liệu** | chuyển quyền sở hữu (giữ nguyên mã Sheet) |
| Kiểm thử | Sheet **Pi ĐRKN — kiểm thử** | chuyển quyền sở hữu |
| Hình, ảnh | thư mục **Pi ĐRKN — hình** và các tệp bên trong | chuyển quyền sở hữu thư mục **và các tệp** |
| Gói chế bản | thư mục **Pi ĐRKN — chế bản** | như trên |
| Sao lưu | thư mục **Pi ĐRKN — sao lưu** | như trên (hoặc để Pi bắt đầu bản sao lưu mới) |
| Cấu hình, bí mật | Script properties của hai dự án | đi theo dự án; đổi `SECRET`, `GITHUB_TOKEN` (mục 6) |
| Trigger (nhắc hạn, kiểm thử, sao lưu, dựng hình) | thuộc **người tạo** | chủ cũ xoá, chủ mới cài lại (mục 5) |
| Thư gửi người dùng | gửi từ tài khoản chủ của ứng dụng | tự đổi sang tài khoản Pi sau mục 5 |

## 2. Pi chuẩn bị

1. **Tài khoản Google của Pi** dùng làm chủ hệ thống (ví dụ một địa chỉ Gmail riêng cho Đề ra kỳ này, hoặc tài khoản Google Workspace
   của Pi). Bật **xác minh 2 bước**; số điện thoại và email khôi phục là của tổ chức; **hai người** của Pi biết cách vào.
2. **Tổ chức GitHub của Pi** (miễn phí): github.com → New organization. Hai người làm Owner, bật bắt buộc xác minh 2 bước
   (Settings → Authentication security).
3. **Một máy** (Mac hoặc Linux) có: git, Node.js, `npm i -g @google/clasp`; MacTeX nếu cần dựng gói chế bản / hình bằng tay.

## 3. Mã nguồn (GitHub)

1. Chủ hiện tại: kho `pi-drkn` → Settings → General → *Danger Zone* → **Transfer ownership** → tên tổ chức của Pi.
   Làm tương tự với `pi-drkn-hinh` (kho riêng tư vẫn riêng tư). Địa chỉ cũ tự chuyển hướng sang địa chỉ mới.
2. Trong kho `pi-drkn-hinh`, sửa `.github/workflows/dung-hinh.yml`: dòng `repository: nghia71/pi-drkn` → `repository: <tổ chức>/pi-drkn`.
3. Trên máy: `git clone https://github.com/<tổ chức>/pi-drkn`, `cd pi-drkn`, `npm install`, `scripts/test-all.sh` — phải đạt hết.
4. Mã thông báo mới cho dựng hình: GitHub → Settings → Developer settings → Fine-grained tokens → *Resource owner* = tổ chức của Pi,
   chỉ kho `pi-drkn-hinh`, quyền **Contents: Read and write**, hạn tối đa 1 năm (ghi lịch đổi). Giữ để dùng ở mục 6.
5. Kho `pi-drkn` (Settings → Rules): bảo vệ nhánh `main` — chỉ gộp qua Pull request, kiểm thử trên GitHub phải đạt.

## 4. Google: chuyển quyền sở hữu

Chủ hiện tại làm, tài khoản Pi chấp nhận. Mã (ID) của Sheet, thư mục, dự án **không đổi**, nên mọi cấu hình vẫn đúng.

1. Drive của chủ hiện tại: chọn từng mục ở bảng mục 1 → Share → thêm tài khoản Pi (Editor) → mở lại Share → cạnh tài khoản Pi chọn
   **Transfer ownership**. Tài khoản Pi nhận thư, bấm **Accept**.
2. **Thư mục**: chuyển thư mục chưa chuyển các tệp bên trong — mở thư mục, chọn tất cả tệp (⌘A), Share → Transfer ownership.
3. **Hai dự án Apps Script** cũng là tệp trên Drive (biểu tượng Apps Script): chuyển như trên.
4. Không chuyển được (ví dụ khác tổ chức Google Workspace): tài khoản Pi cài mới theo `docs/setup.md` mục 2–6, rồi chép dữ liệu:
   File → Make a copy Sheet dữ liệu, tải thư mục hình lên Drive của Pi; đặt `SHEET_ID`, `FIG_FOLDER_ID` theo bản mới.
   Cách này đổi địa chỉ web — gửi địa chỉ mới cho mọi người.

## 5. Chạy ứng dụng bằng tài khoản Pi

1. Chủ cũ: mở mỗi dự án → *Triggers* (đồng hồ ở thanh trái) → xoá mọi trigger của mình (nhắc hạn `sendReminders`,
   `autoTests`, `autoTestsNext`, `dongBoHinh`). Hoặc chạy `removeAutoTests` trước khi chuyển.
2. Trên máy của Pi: `clasp login` bằng **tài khoản Pi**.
3. Tạo `apps/main/.clasp.json` và `apps/signin/.clasp.json`, mỗi tệp một dòng:
   `{"scriptId":"<Script ID>","rootDir":"."}` — Script ID ở Project Settings → IDs của từng dự án.
4. Tạo `deploy.local.env` với hai ID triển khai đang dùng (Deploy → Manage deployments của từng dự án):
   `SIGNIN_DEPLOYMENT_ID=…` và `MAIN_DEPLOYMENT_ID=…`. Ba tệp này **không bao giờ** vào kho mã.
5. `scripts/deploy.sh` → mã được đẩy và bản triển khai cũ được cập nhật bằng tài khoản Pi (địa chỉ web giữ nguyên).
6. Mỗi dự án: Deploy → Manage deployments → kiểm tra *Execute as* là **tài khoản Pi**. Nếu vẫn là chủ cũ: Edit → Execute as: Me → Deploy.
   (Không bấm *New deployment* — sẽ ra địa chỉ mới.)
7. Dự án chính, bằng tài khoản Pi, lần lượt Run: `backupNow` (cho phép mọi quyền khi Google hỏi), `installReminderTrigger`,
   `installAutoTests`. Dự án đăng nhập: Run `checkConfig` → "Cấu hình đúng".

## 6. Bí mật và cấu hình

1. **Đổi `SECRET`** (khoá ký liên kết đăng nhập): một chuỗi ngẫu nhiên mới (ví dụ `openssl rand -base64 32` trong Terminal), đặt **cùng giá trị**
   vào Script properties của **cả hai** dự án. Mọi phiên đang mở hết hiệu lực; người dùng bấm *Đăng nhập lại*.
2. Dự án chính: `GITHUB_REPO` = `<tổ chức>/pi-drkn-hinh`, `GITHUB_TOKEN` = mã thông báo ở mục 3.4.
3. `TEST_USERS` = hai tài khoản thử của Pi (nếu đổi), rồi chạy `setupTests` nếu Sheet kiểm thử mới.
4. Tab `Users` của Sheet dữ liệu: thêm tài khoản Pi với vai trò `Quản trị`; chủ cũ: bỏ, hoặc giữ vai trò Pi muốn.

## 7. Kiểm tra sau bàn giao

- [ ] `scripts/test-all.sh` đạt trên máy của Pi; `scripts/deploy.sh` chạy hết.
- [ ] Mở **địa chỉ đăng nhập** bằng một tài khoản của mỗi vai trò: vào được, thấy đúng phần của mình.
- [ ] *Triggers* của dự án chính chỉ có trigger của tài khoản Pi (`sendReminders`, `autoTests`).
- [ ] Kỳ luyện tập (`resetPractice`): gửi thư mời → thư đến, người gửi là tài khoản Pi.
- [ ] Trang Hình → *Dựng ngay* với một hình thử → hình hiện sau vài phút; kho `pi-drkn-hinh` → Actions xanh.
- [ ] Sáng hôm sau: thư mục **Pi ĐRKN — sao lưu** có bản của ngày; không có thư báo lỗi kiểm thử hay sao lưu.

## 8. Chúng tôi làm giúp

Nếu Pi muốn, người xây hệ thống (Nghĩa) làm toàn bộ các bước trên, khoảng một buổi, qua một cuộc gọi chia sẻ màn hình. Pi cần:
1. tạo tài khoản Google của Pi và tổ chức GitHub (mục 2);
2. thêm Nghĩa làm thành viên **tạm thời** của tổ chức GitHub (Owner, để chuyển kho và cài đặt);
3. có mặt trong cuộc gọi để bấm **Accept** các yêu cầu chuyển quyền trên Google và tự đăng nhập tài khoản Pi khi chạy
   `clasp login` và cho phép quyền — **Pi giữ mật khẩu**, Nghĩa không cần biết.

Xong việc và kiểm tra (mục 7): Pi xoá Nghĩa khỏi tổ chức GitHub, khỏi các mục chia sẻ trên Drive và (nếu muốn) khỏi tab `Users`.
Từ đó mọi thay đổi do Pi quyết định; Nghĩa có thể tiếp tục góp mã qua Pull request nếu Pi cho phép.
