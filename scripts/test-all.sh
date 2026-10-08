#!/usr/bin/env bash
# Chạy mọi kiểm thử chạy được trên máy (không cần Google): chặn dữ liệu, bộ hiển thị, bộ kiểm thử máy chủ (mô phỏng), giao diện
# (scripts/test-all.sh --no-shots: không chụp ảnh hướng dẫn),
# rồi kiểm thử từ bên ngoài với hai địa chỉ web thật (nếu có deploy.local.env và mạng).
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== 1. chặn dữ liệu";            python3 scripts/guard.py --all
echo "== 2. bộ hiển thị";              node tests/render.test.js | tail -1
echo "== 3. máy chủ (mô phỏng)";       node tools/gas-sim/run-tests.js | tail -1
echo "== 4. gói chế bản (build.py)";     python3 -I tests/khoaky.test.py
echo "== 5. hình (tools/hinh)";            python3 -I tests/hinh.test.py
echo "== 6. giao diện (Chromium)";        node tests/ui/run.js "$@" | grep -v "^== "
echo "== 7. từ bên ngoài (địa chỉ thật)"; node tests/http.test.js
