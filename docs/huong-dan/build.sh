#!/usr/bin/env bash
# Dựng slide hướng dẫn theo vai trò: docs/huong-dan/<vai>/slides.pdf.
# Ảnh và các bước lấy từ out/ui/ — chạy kiểm thử giao diện trước (scripts/test-all.sh hoặc node tests/ui/run.js).
set -euo pipefail
cd "$(dirname "$0")"
[ -f ../../out/ui/danh-sach.slide.png ] || node ../../tests/ui/run.js
for d in pb ncb pt tbt vp btk quantri; do
  (cd "$d" && pdflatex -interaction=nonstopmode -halt-on-error slides.tex >/dev/null && pdflatex -interaction=nonstopmode -halt-on-error slides.tex >/dev/null) \
    || { echo "LỖI: $d/slides.tex — xem $d/slides.log"; exit 1; }
  n=$(grep -cE '^Overfull' "$d/slides.log" || true)
  [ "$n" = "0" ] || { echo "LỖI: $d — $n hộp tràn (Overfull)"; exit 1; }
  echo "$d/slides.pdf: $(pdfinfo "$d/slides.pdf" | awk '/Pages/{print $2}') trang"
done
