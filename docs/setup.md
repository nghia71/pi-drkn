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
Riêng thao tác `replace` (tác giả gửi bản mới thay bài đã nộp): giữ mã bài, bản biên tập và bản gốc đều thành bản mới, bản cũ còn
trong lịch sử sửa; bài đã có phiếu phản biện hoặc đang ở bảng chọn bài thì có thêm một mục cần kiểm tra; không thay bài đã đăng.

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
Không dựng hình của đề chưa đăng trên các trang LaTeX trực tuyến.

**Dựng tự động (giai đoạn 2, `FigCloud.gs`)** — GitHub Actions trong một kho **riêng tư** dựng thay cho bước 2 ở trên:
1. GitHub → New repository → tên `pi-drkn-hinh`, **Private** → chép vào kho hai tệp `.github/workflows/dung-hinh.yml` và `README.md`
   (bản mẫu: kho `pi-drkn-hinh` hiện có; việc dựng dùng `tools/hinh/build.py` và `templates/hinh-mau.tex` của kho mã công khai).
2. GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained** → chỉ kho `pi-drkn-hinh`, quyền
   **Contents: Read and write**, hạn tối đa 1 năm (ghi lịch đổi).
3. Dự án chính → Project Settings → Script properties: `GITHUB_REPO` = `<chủ>/pi-drkn-hinh`, `GITHUB_TOKEN` = mã vừa tạo.
4. Sau `scripts/deploy.sh`: trình soạn thảo → chạy một hàm bất kỳ (ví dụ `installAutoTests`) để cho phép quyền mới
   "Connect to an external service" (gọi GitHub).
Từ đó: lưu bài có TikZ → sau ~1 phút hệ thống gửi mã TikZ của hình chưa dựng lên `hang-doi/`; GitHub Actions dựng (~2 phút) →
`svg/` hoặc `loi/`; hệ thống tự kiểm tra lại mỗi 3 phút, lấy SVG về thư mục hình, xoá tệp khỏi kho. Trang Hình: mục "Dựng tự động"
(số hình đang chờ, nút **Dựng ngay**), hình lỗi hiện kèm thông báo của LaTeX. Trigger kiểm thử tự động (mục 14) đồng bộ thêm mỗi giờ
(hình đến từ nhập / bản vá). Chỉ mã TikZ rời khỏi Google — quy định dữ liệu mục 6.
Dựng tay (bước 1–3 ở trên) vẫn dùng được bất cứ lúc nào. Thôi: xoá hai Script properties.

## 13. Thêm bài trên trang web, ảnh của bài
Sau lần triển khai có tính năng này: chạy `setup` (thêm cột `mo_loi_giai` vào tab Rounds).
- Nút **Thêm bài** (VP, NCB, PT, TBT, Quản trị): một hồ sơ = các bài cùng tác giả gửi cùng lúc. Mã bài = tháng nhận + số thư mục kế tiếp
  còn trống (hệ thống tự chọn) + a, b, … Tác giả: chọn người đã có hoặc thêm mới (liên hệ chỉ vào tab Authors). Mỗi bài: tải tệp `.tex`
  (tự bỏ dòng tiêu đề "Bài toán …", tách tại "Lời giải"; đoán chủ đề, mức từ tên tệp kiểu `2026-10-sh-a.tex`), sửa lại nếu cần, xem trước.
- **Ảnh** (SVG, PNG, JPG, PDF; tối đa 3 MB), khi thêm bài hoặc nút **Thêm ảnh…** ở mục Hình của bài: mỗi ảnh chọn **hình của đề**
  (cột Hình — in kèm đề khi khoá kỳ) hoặc **minh hoạ lời giải** (chèn cuối lời giải — không bao giờ in vào cột Đề ra kỳ này).
  Ảnh lưu trong thư mục hình tên `<mã bài>-<n>.<đuôi>`. Hình vẽ GeoGebra/Inkscape: xuất SVG (hoặc PNG); ảnh minh hoạ: JPG/PNG.
  PDF không hiện trên trang (chỉ dùng khi in). Khi khoá kỳ, ảnh SVG của đề được `tools/khoaky/build.py` chuyển sang PDF —
  cần `rsvg-convert` (Mac: `brew install librsvg`).

## 14. Kiểm thử
Xem `docs/testing.md`. Cài một lần: Script property `TEST_USERS` (hai tài khoản thử) rồi chạy `setupTests`.
Rồi chạy `installAutoTests` (một lần): kiểm thử tự chạy sau mỗi lần triển khai và mỗi đêm; chỉ có thư khi có lỗi. Cùng trigger này sao lưu dữ liệu mỗi đêm (mục 15).
Trên máy, cho kiểm thử giao diện: `npm install` (một lần); kiểm thử dùng Google Chrome đã cài trên máy (hoặc Chromium của `npx playwright install chromium`).

## 15. Sao lưu và khôi phục
Trigger mỗi giờ của `installAutoTests` (mục 14) sao lưu **mỗi ngày một lần**, lần chạy đầu tiên sau `BACKUP_HOUR` giờ
(Script property, mặc định 1 giờ sáng giờ Việt Nam): một bản sao của Sheet dữ liệu tên `Pi ĐRKN — dữ liệu — sao lưu NNNN-TT-NN`
trong thư mục Drive **Pi ĐRKN — sao lưu** (tạo tự động; chỉ tài khoản chủ thấy). Giữ `BACKUP_KEEP` bản mới nhất (mặc định 30),
bản cũ hơn vào Thùng rác. Sao lưu không được thì có thư gửi tài khoản chủ. Sao lưu ngay (ví dụ trước khi nhập, vá dữ liệu lớn):
trình soạn thảo → `backupNow` → Run.

Khôi phục (Sheet dữ liệu bị xoá nhầm, hỏng dữ liệu):
1. Drive → **Pi ĐRKN — sao lưu** → chọn bản của ngày cần → Make a copy → đổi tên thành `Pi ĐRKN — dữ liệu`.
2. Mở bản vừa tạo, chép mã trong địa chỉ (đoạn giữa `/d/` và `/edit`).
3. Dự án chính → Project Settings → Script properties → `SHEET_ID` = mã đó. Có hiệu lực ngay, không cần triển khai lại.
4. Giữ Sheet cũ (đổi tên thành `… — hỏng NNNN-TT-NN`) cho tới khi chắc mọi thứ đúng. Việc làm sau thời điểm sao lưu phải làm lại.
Ảnh và hình (thư mục **Pi ĐRKN — hình**), gói chế bản không nằm trong bản sao — chúng là tệp Drive, có Thùng rác 30 ngày của Drive.

## 16. Góp ý và lỗi người dùng gặp
Nút **Góp ý** ở đầu mọi trang (mọi người): mức dễ dùng 1–5 (không bắt buộc), lời góp ý, kèm trang đang xem → tab `Feedback`.
Lỗi người dùng gặp trên trang (thao tác bị từ chối, lỗi JavaScript) được ghi tự động vào tab `Errors` (ai, vai trò, trang, lỗi,
trình duyệt; mỗi người tối đa 20 dòng mỗi giờ). Hai tab tự tạo lần đầu dùng, không cần chạy lại `setup`.
Quản trị: hộp Góp ý → **Xem góp ý và lỗi đã nhận** (đổi trạng thái góp ý: mới, đã xem, đã sửa, không làm).
Mỗi sáng (Script property `DIGEST_HOUR`, mặc định 7 giờ) trigger của `installAutoTests` gửi tài khoản chủ **một thư tóm tắt**
góp ý và lỗi mới (lỗi gộp theo loại, ai gặp); không có gì mới thì không gửi. Thư có đường dẫn vào hệ thống nếu đã đặt `SIGNIN_URL` (mục 5).

## 17. Dùng thử: bài luyện tập và bài thật
- **Bài luyện tập** (THU-01…10, bịa): người dùng thử thấy khi email của họ ở Script property `PRACTICE_USERS` (mục 14, `docs/testing.md`).
  Trang **Kỳ phản biện** → mục *Luyện tập* → **Đặt lại bài luyện tập** (Quản trị, PT, TBT đang dùng thử): xoá mọi việc đã làm trên
  bài luyện (phiếu, thảo luận, sửa, trạng thái, kỳ và bảng chỉ gồm bài luyện), đưa mười bài về như mới; bài thật không bị đụng.
- **Dùng thử trên bài thật** (`Trial.gs`): trang Kỳ phản biện → mục *Dùng thử trên bài thật* (Quản trị) → **Bắt đầu dùng thử**:
  hệ thống chụp toàn bộ Sheet dữ liệu (bản sao trong thư mục sao lưu); mọi trang hiện dòng „Đang dùng thử". Mọi người làm việc như thật.
  **Đưa về như trước khi dùng thử** (Quản trị hoặc TBT, làm được nhiều lần): thay bài, kỳ, bảng, phiếu, thảo luận, lịch sử… bằng bản
  chụp; **giữ** người dùng (`Users`), nhật ký (`Audit`), góp ý (`Feedback`), lỗi (`Errors`); trước khi đưa về, chụp trạng thái hiện tại
  (đưa về cũng hoàn tác được: mục 15 với bản „trước khi đưa về"). **Kết thúc dùng thử** (Quản trị): giữ mọi thay đổi, hoặc đưa về rồi kết thúc.
  Không đưa về được: thư đã gửi (thư mời, nhắc hạn) và tệp trên Drive (ảnh, gói chế bản) — vô hại.
  Lưu ý: việc làm thật trong lúc dùng thử (ví dụ Văn phòng nhập bài mới thật) cũng bị đưa về — nhập bài thật sau khi kết thúc,
  hoặc kết thúc bằng „giữ mọi thay đổi".
