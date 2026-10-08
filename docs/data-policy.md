# Chính sách dữ liệu

1. **Kho mã chỉ chứa mã.** Đề, lời giải, hình, tên/liên hệ tác giả, nhận xét phản biện, danh sách người dùng chỉ nằm
   trong Google Sheet và Drive riêng của tài khoản quản trị. `scripts/guard.py` (hook trước commit + kiểm tra trên GitHub)
   chặn tệp dữ liệu, số điện thoại, email, chuỗi số dài, ID Google và khoá bí mật.
2. **Không bịa, không sửa lén.** Bản gốc của tác giả được giữ nguyên (chuyển đổi cơ học). Mọi sửa đổi nằm ở bản biên tập
   và được ghi lại (vị trí, trước, sau, lý do, ai, khi, trạng thái). Văn bản đề/lời giải không chứa ghi chú;
   nguồn gốc, sửa đổi, mục cần kiểm tra, xung đột là các thuộc tính riêng của bài.
3. **Nghi ngờ thì ghi, không tự sửa.** Lỗi nghi ngờ khi chuyển đổi → "cần kiểm tra"; người chuẩn bị bài quyết định,
   có thể hỏi tác giả qua Văn phòng/Phụ trách chuyên mục.
4. **Xung đột** (số hiệu, mức, bản chép khác nhau, trùng bài, đề–lời giải không khớp, tác giả, trạng thái) mỗi cái một dòng,
   ghi cách giải quyết nếu có.
5. **Thông tin cá nhân** (điện thoại, email, tài khoản ngân hàng, số giấy tờ, địa chỉ nhà) không đưa vào hệ thống, trừ
   cột `lien_he` của tab Authors (chỉ VP, PT, TBT, Quản trị xem). Thông tin của học sinh chưa đủ 18 tuổi cũng vậy.
6. **Không dùng dịch vụ ngoài** (trình biên dịch LaTeX trực tuyến, AI công cộng…) với bài chưa đăng.
   Ngoại lệ đã duyệt (Nghĩa, 2026-10-08): dựng hình tự động gửi **mã TikZ của hình** (không có đề, lời giải, tác giả) vào kho GitHub
   **riêng tư** của Pi (`GITHUB_REPO`), dựng bằng GitHub Actions; SVG lấy về thì tệp trong kho bị xoá (lịch sử commit vẫn giữ mã TikZ —
   kho phải luôn riêng tư; xoá kho khi thôi dùng).
7. Mỗi lần xem/sửa bài được ghi vào tab Audit.
8. **Phản biện chỉ nhận văn bản đã biên tập và thảo luận** của bài được giao — không nhận nguồn, tên tệp, xung đột, sửa đổi,
   bản gốc (những thứ có thể lộ tác giả).
9. Văn bản người dùng gõ (đề, nhận xét) là dữ liệu: khi hiển thị, mọi thẻ HTML bị vô hiệu; khi ghi vào Sheet, nội dung bắt đầu
   bằng `=`, `+`, `-`, `@` được lưu như chữ, không thành công thức.
10. Các hàm chạy từ trình soạn thảo (setup, setUser, nhập, vá, kiểm thử) từ chối mọi lời gọi không phải của chủ dự án,
    kể cả khi gọi từ trang web.
