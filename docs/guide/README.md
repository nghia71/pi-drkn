# Hướng dẫn sử dụng (slide)

Nguồn của tệp `HuongDan_DeRaKyNay_ban-thu.pdf` (Beamer, XeLaTeX, phông TeX Gyre Heros + DejaVu Sans).

```
cd docs/guide && xelatex -interaction=nonstopmode -halt-on-error main.tex && xelatex -interaction=nonstopmode -halt-on-error main.tex
```
(`-interaction=nonstopmode -halt-on-error`: gặp lỗi thì dừng và báo, không đứng chờ ở dấu `?`. Nếu đã kẹt ở `?`: gõ `X` rồi Enter.)
Phông được gọi theo tên tệp (`texgyreheros-*.otf`, `DejaVuSans.ttf`) nên chỉ cần TeX Live / MacTeX, không cần cài phông vào hệ thống.

`p1.tex` phần chung 1–3 · `p2.tex` phần chung 4–8 · `p3.tex` theo vai trò, sự cố, việc sắp có.
Khi một tính năng xong: bỏ nhãn `\soon` / mục "Sắp có trên trang web" tương ứng và viết lại phần "Việc của bạn bây giờ".

`kientruc.tex` — bộ slide **kiến trúc, triển khai từ đầu, bàn giao** (cho người kỹ thuật của Pi), cùng phông và kiểu với hướng dẫn sử dụng:
```
cd docs/guide && xelatex -interaction=nonstopmode -halt-on-error kientruc.tex && xelatex -interaction=nonstopmode -halt-on-error kientruc.tex
```
Khi kiến trúc đổi (thành phần mới, Script property mới, trigger mới): sửa slide tương ứng cùng lúc với mã.
