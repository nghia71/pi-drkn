# Hướng dẫn theo vai trò (slide)

Mỗi vai trò một bộ slide: `pb` (Phản biện), `ncb` (Người chuẩn bị bài), `pt` (Phụ trách chuyên mục), `tbt` (Tổng biên tập),
`vp` (Văn phòng), `btk` (Ban trình bày), `quantri` (Quản trị). Người xem được gọi là „thầy cô".

```
scripts/test-all.sh          # chạy kiểm thử giao diện: chụp ảnh, đánh số các bước (out/ui/)
docs/huong-dan/build.sh      # dựng <vai>/slides.pdf (pdflatex, hai lượt; hộp tràn = lỗi)
```

Ảnh và chữ của từng bước **không viết tay**: kiểm thử giao diện (`tests/ui/run.js`) chụp trang thật với dữ liệu bịa, đánh số các bước
trên ảnh, ghi `out/ui/<tên>.slide.png` (cắt sát quanh các bước), `<tên>.cap.tex` (chú thích), `<tên>.steps.tex` (các bước).
Slide gọi `\manhinh{<tên>}{tiêu đề}` (kiểu trong `pi-hd.sty`). Giao diện đổi → chạy lại hai lệnh trên, slide tự khớp; một bước không còn
tìm thấy trên trang thì kiểm thử báo lỗi.

Slide dịch bằng **pdflatex** (T5 + Latin Modern) để dùng thẳng cho video bằng quy trình của kho `lps67` (`video-lectures/_shared`).
Video làm sau cùng, khi hướng dẫn đã ổn định: thêm `script.md` (lời đọc, mỗi slide một mục), `voice.json`, `rebuild.sh` vào thư mục
của vai trò — tạo âm thanh là bước duy nhất tốn tiền.

## Đường dẫn để gửi người dùng
Mỗi lần giao diện hoặc hướng dẫn đổi trên `main`, GitHub (`.github/workflows/huong-dan.yml`) dựng lại và cập nhật bản phát hành
**huong-dan** — đường dẫn không đổi:
`https://github.com/<chủ kho>/pi-drkn/releases/download/huong-dan/huong-dan-<vai>.pdf` với `<vai>` là pb, ncb, pt, tbt, vp, btk, quantri;
`…/huong-dan-anh.zip`: mọi ảnh chụp từng bước và trang `ui/index.html`.
