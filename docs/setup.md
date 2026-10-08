# Cài đặt (một lần, bằng tài khoản quản trị)

Mọi bước làm trên máy của quản trị. Không bước nào đưa dữ liệu lên GitHub.

## 1. Công cụ
```
brew install node            # hoặc tải Node.js LTS từ nodejs.org
npm i -g @google/clasp
clasp login                  # mở trình duyệt, đăng nhập đúng tài khoản quản trị
```
Bật Google Apps Script API: https://script.google.com/home/usersettings → "Google Apps Script API: On".

Trong thư mục kho mã:
```
git config core.hooksPath .githooks     # bật hook chặn dữ liệu trước mỗi commit
```

## 2. Tạo hai dự án Apps Script
```
cd apps/main   && clasp create --type webapp --title "Pi – Đề ra kỳ này" --rootDir . && cd ../..
cd apps/signin && clasp create --type webapp --title "Pi – Đề ra kỳ này (đăng nhập)" --rootDir . && cd ../..
git checkout -- apps/main/appsscript.json apps/signin/appsscript.json   # clasp create có thể ghi đè tệp cấu hình
```
Tên của dự án đăng nhập hiện trên màn hình xin quyền của Google, nên giữ tên trên.
Hai tệp `.clasp.json` vừa tạo chứa mã dự án; chúng bị `.gitignore` chặn.

## 3. Đẩy mã và tạo bản triển khai đầu tiên
```
scripts/deploy.sh
```
Lần đầu, script tạo bản triển khai và in ra hai ID. Tạo tệp `deploy.local.env` (không commit):
```
SIGNIN_DEPLOYMENT_ID=…
MAIN_DEPLOYMENT_ID=…
```
Từ đó mỗi lần cập nhật chỉ chạy `scripts/deploy.sh` — địa chỉ web giữ nguyên.
Không bao giờ dùng nút "New deployment" trong trình soạn thảo (tạo địa chỉ mới).

## 4. Khởi tạo dữ liệu (dự án chính)
Mở dự án chính (`clasp open-script` trong `apps/main`) → chọn hàm `setup` → Run → cho phép quyền.
Execution log in ra: địa chỉ Sheet và **SECRET**.

## 5. Cấu hình dự án đăng nhập
Mở dự án đăng nhập → Project Settings → Script properties → thêm đúng hai khoá:
- `SECRET` = giá trị vừa in ở bước 4
- `B_URL` = địa chỉ /exec của dự án chính (lấy ở Deploy → Manage deployments; không chép từ thanh địa chỉ, không có `/u/0/`)

Chạy hàm `checkConfig` để kiểm tra.

Trong dự án **chính**, thêm Script property `SIGNIN_URL` = địa chỉ /exec của dự án đăng nhập
(để trang "hết hạn" có nút Đăng nhập lại).

## 6. Người dùng
Mở Sheet → tab `Users` → mỗi người một dòng: `email`, `ten`, `vai_tro` (TBT, PT, NCB, PB, VP, BTK, Quản trị —
nhiều vai trò cách nhau dấu phẩy), `hoat_dong` = TRUE.
Gửi cho mọi người **địa chỉ /exec của dự án đăng nhập**. Lần đầu, Google hỏi cho phép ứng dụng biết email → bấm Cho phép.

## 7. Nhập dữ liệu ban đầu (nếu có)
Trên máy: `python3 tools/convert/stage.py pi-drkn-import-ky10.json <các tệp bản ghi…>` (tệp ra là dữ liệu thật — để ngoài kho mã).
Tải tệp lên Drive của tài khoản quản trị (không chia sẻ), rồi trong dự án chính chạy `importLatest`.
Một lần chạy nhập **mọi** tệp tên `pi-drkn-import…` chưa nhập xong (cũ trước, mới sau); tệp đã nhập xong được ghi nhớ
(Script property `IMPORT_DONE_<id>`) và lần sau bỏ qua. Nếu log báo TẠM DỪNG (sắp hết 6 phút) thì chạy lại.
Bài đã có (cùng mã) thì bỏ qua, nên chạy thừa cũng không sao.

## Kiểm thử trước khi đẩy
```
python3 scripts/guard.py --all
node tests/render.test.js
python3 tools/render-test/check.py <tệp nhập.json>      # hiển thị hàng loạt, dữ liệu không rời máy
```

## 8. Bản vá dữ liệu (kết quả đọc kiểm tra, sửa lỗi chép…)
Chuẩn bị tệp `pi-drkn-patch-….json` (ngoài kho mã), tải lên Drive của tài khoản quản trị (không chia sẻ), rồi trong dự án chính
chạy `applyPatchLatest`. Chạy lại an toàn (thao tác đã áp dụng không lặp lại). Sửa đổi chỉ chạm bản biên tập, có ghi
Corrections + Revisions; bản gốc của tác giả không đổi. Dạng tệp: xem đầu `apps/main/Patch.gs`.

## 9. Kỳ phản biện: thư mời và nhắc hạn
Thư mời và thư nhắc gửi từ tài khoản quản trị (MailApp; tài khoản Gmail thường được khoảng 100 người nhận mỗi ngày —
hệ thống kiểm tra hạn mức trước khi gửi). Thư chỉ có tên kỳ, số bài, hạn và đường dẫn đăng nhập.
Cài một lần, sau lần triển khai có tính năng này:
1. Dự án chính → chạy `setup` (thêm cột `moi_luc`, `nhac` vào tab Assignments; dữ liệu giữ nguyên).
2. Chạy `installReminderTrigger` → cho phép quyền mới ("chạy khi bạn vắng mặt"). Từ đó `sendReminders` chạy mỗi ngày.

Script properties (không bắt buộc):
- `REMINDER_DAYS` — số ngày trước hạn thì nhắc, cách nhau dấu phẩy (mặc định `3,1`);
- `REMINDER_HOUR` — giờ chạy nhắc mỗi ngày (mặc định `8`; đổi thì chạy lại `installReminderTrigger`);
- `TIMEZONE` — múi giờ tính ngày (mặc định `Asia/Ho_Chi_Minh`).

## 10. Bảng chọn bài
Sau lần triển khai có tính năng này: chạy `setup` (tạo tab `Issues`, thêm cột `trang_thai_truoc`, `muc_truoc` vào tab Shortlist).
Script property (không bắt buộc) `BOARD_LAYOUT` — mức của từng vị trí theo thứ tự in, cách nhau dấu phẩy;
mặc định `B,B,B,B,A,A,A,A,A,A` (4 bài B rồi 6 bài A).

## 11. Khoá kỳ và gói chế bản cho BTK
Sau lần triển khai có tính năng này: chạy `setup` (thêm cột `khoa_luc`, `tep` vào tab Issues).
- Trên trang **Bảng chọn bài**, bảng đã được TBT duyệt có nút **Khoá kỳ…** (PT, TBT, Quản trị): gõ hoặc nhận số in bắt đầu
  (gợi ý = số lớn nhất trong Published + 1; lần đầu Published trống thì gõ, ví dụ `1041`), xem thứ tự, dòng tác giả, lưu ý, tải `.tex` xem trước,
  rồi bấm Khoá kỳ hai lần. Khoá xong: Published có số in, các bài thành PL, bảng "đã khoá" (không mở lại được).
- Gói `.zip` (tệp `.tex` chỉ có đề bài + `pic/`) được lưu vào thư mục Drive **Pi ĐRKN — chế bản** của tài khoản triển khai
  (tạo lần đầu, mã thư mục ghi ở Script property `EXPORT_FOLDER_ID`). Hình ảnh (không phải TikZ) lấy theo tên tệp ở cột `hinh`
  trong thư mục hình (`FIG_FOLDER_ID`); hình không tìm thấy được báo ngay khi khoá.
- Chia sẻ thư mục chế bản cho BTK (quyền xem) nếu BTK cần tải gói trên Drive; BTK cũng tải lại được tệp `.tex` trên trang (nút **Tải tệp .tex**).
- Dựng PDF xem trước ở máy (Apps Script không chạy được XeLaTeX). Cần MacTeX (hoặc TeX Live):
  ```
  python3 tools/khoaky/build.py ~/Downloads/de-ra-ky-nay-10-2026.zip
  ```
  Công cụ kiểm tra tệp (UTF-8, NFC, không có "Lời giải" hay email trong thân tệp, hình có đủ), biên dịch hai lượt với
  `templates/dinhdang.tex` (tệp định dạng cột của Pi; dùng tệp khác: `--dinhdang đường/dẫn`) rồi ghi `de-ra-ky-nay-10-2026-btk.zip`
  (.tex, pic/, .pdf) cạnh tệp vào. Gửi gói này cho BTK. Không biên dịch đề chưa đăng trên các trang LaTeX trực tuyến.

## 12. Hình (dựng TikZ thành SVG)
Thư mục hình **Pi ĐRKN — hình** (Script property `FIG_FOLDER_ID`, do `setup` tạo) giữ ảnh của bài và SVG đã dựng (`tikz-<mã>.svg`).
Nút **Hình** ở đầu trang (NCB, PT, Quản trị):
1. **Tải các hình chưa dựng (.zip)** — mỗi hình một tệp `tikz-<mã>.tex` và `danh-sach.txt` (hình nào của bài nào).
2. Trên máy Mac (MacTeX có sẵn `xelatex` và `dvisvgm`):
   ```
   python3 tools/hinh/build.py ~/Downloads/hinh-chua-dung.zip
   ```
   Công cụ kiểm tra từng tệp (mã khớp nội dung, không có lệnh đọc/ghi tệp), dựng bằng `templates/hinh-mau.tex` (gói, thư viện TikZ
   và lệnh tắt như `dinhdang.tex` của Pi; chữ chuyển thành đường nét nên SVG không cần phông), ghi `hinh-svg.zip` cạnh tệp vào.
   Hình lỗi được báo (dòng `LỖI …`), hình khác vẫn được dựng; mỗi hình tối đa 60 giây.
3. **Tải SVG lên** `hinh-svg.zip` — hình hiện ngay trên trang bài (cả với phản biện được giao).
Không dựng hình của đề chưa đăng trên các trang LaTeX trực tuyến. Giai đoạn 2 (sau này): GitHub Actions trong một kho **riêng tư**.

## 13. Kiểm thử
Xem `docs/testing.md`. Cài một lần: Script property `TEST_USERS` (hai tài khoản thử) rồi chạy `setupTests`.
