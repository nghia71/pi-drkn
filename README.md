# pi-drkn

Hệ thống quản lý bài đề xuất cho chuyên mục **Thách thức Toán học — Đề ra kỳ này** của Tạp chí Pi:
nhập bài → kho đề → phản biện trên web → bảng chọn bài → khoá kỳ (xuất .tex cho chế bản).
Chạy hoàn toàn trên Google (Google Sheet + Apps Script), không tốn phí.

A problem-management system for Pi Journal's monthly challenge column, built on Google Sheets + Apps Script.

## Dữ liệu KHÔNG nằm trong kho mã này

Kho mã này chỉ chứa **mã chương trình**. Đề bài, lời giải, tên và thông tin liên hệ tác giả,
nhận xét phản biện… nằm trong Google Sheet và thư mục Drive riêng tư của tài khoản quản trị,
chỉ người đã đăng nhập và có vai trò mới xem được qua ứng dụng web.

- Không bao giờ commit dữ liệu thật: thư mục `data/`, tệp `.json/.docx/.doc/.pdf/.png…` của bài đề xuất đều bị chặn
  (`.gitignore` + hook `pre-commit` + kiểm tra tự động trên GitHub, xem `scripts/guard.py`).
- Không có mã định danh hay bí mật trong mã: ID của Sheet/thư mục, ID triển khai, khoá `SECRET`
  được lưu trong *Script properties* của dự án Apps Script (đặt bằng hàm `setup`).
- Bài kiểm thử chỉ dùng **bài toán bịa** (`tests/fixtures`).
- Biên dịch hình TikZ (nếu dùng GitHub Actions) chạy trong một kho **riêng tư** khác, vì có nội dung bài.

## Cấu trúc

```
apps/signin/      Ứng dụng đăng nhập (chạy dưới quyền người truy cập, chỉ xin quyền đọc email)
apps/main/        Ứng dụng chính (chạy dưới quyền chủ sở hữu; Sheet, quyền theo vai trò, trang web)
apps/main/ui/     Giao diện (HTML/JS), gồm pi-render.js: hiển thị LaTeX + macro của Pi bằng MathJax
tools/convert/    Công cụ chạy trên máy: chuyển .docx/.doc (MathType, công thức Word) sang LaTeX
tools/render-test Kiểm tra hiển thị hàng loạt bằng trình duyệt không giao diện
scripts/          guard.py (chặn dữ liệu), deploy.sh
docs/             Hướng dẫn cài đặt, chính sách dữ liệu, mô hình dữ liệu
tests/            Kiểm thử với bài bịa
```

## Cài đặt

Xem `docs/setup.md`. Tóm tắt: `npm i -g @google/clasp` → `clasp login` → tạo hai dự án Apps Script →
chạy `setup()` một lần → `scripts/deploy.sh`. Mọi lần cập nhật sau chỉ cần `scripts/deploy.sh`
(giữ nguyên địa chỉ web).

## Vai trò

TBT (Tổng biên tập), PT (Phụ trách chuyên mục), NCB (Người chuẩn bị bài), PB (Phản biện),
VP (Văn phòng, nhập bài), BTK (Chế bản), Quản trị. Ai thấy gì: `docs/data-model.md`.
