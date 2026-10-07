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
Mở dự án chính (`clasp open` trong `apps/main`) → chọn hàm `setup` → Run → cho phép quyền.
Execution log in ra: địa chỉ Sheet và **SECRET**.

## 5. Cấu hình dự án đăng nhập
Mở dự án đăng nhập → Project Settings → Script properties → thêm đúng hai khoá:
- `SECRET` = giá trị vừa in ở bước 4
- `B_URL` = địa chỉ /exec của dự án chính (lấy ở Deploy → Manage deployments; không chép từ thanh địa chỉ, không có `/u/0/`)

Chạy hàm `checkConfig` để kiểm tra.

## 6. Người dùng
Mở Sheet → tab `Users` → mỗi người một dòng: `email`, `ten`, `vai_tro` (TBT, PT, NCB, PB, VP, BTK, Quản trị —
nhiều vai trò cách nhau dấu phẩy), `hoat_dong` = TRUE.
Gửi cho mọi người **địa chỉ /exec của dự án đăng nhập**. Lần đầu, Google hỏi cho phép ứng dụng biết email → bấm Cho phép.

## 7. Nhập dữ liệu ban đầu (nếu có)
Trên máy: `python3 tools/convert/stage.py pi-drkn-import-ky10.json <các tệp bản ghi…>` (tệp ra là dữ liệu thật — để ngoài kho mã).
Tải tệp lên Drive của tài khoản quản trị (không chia sẻ), rồi trong dự án chính chạy `importLatest`
nhiều lần cho tới khi log báo "xong". Bài đã có thì bỏ qua.

## Kiểm thử trước khi đẩy
```
python3 scripts/guard.py --all
node tests/render.test.js
python3 tools/render-test/check.py <tệp nhập.json>      # hiển thị hàng loạt, dữ liệu không rời máy
```
