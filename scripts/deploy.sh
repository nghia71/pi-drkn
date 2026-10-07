#!/usr/bin/env bash
# Đẩy mã lên Apps Script và cập nhật đúng bản triển khai cũ (địa chỉ web không đổi).
# Cần: clasp đã đăng nhập (clasp login), apps/signin/.clasp.json và apps/main/.clasp.json (xem docs/setup.md),
#      deploy.local.env (không commit) chứa SIGNIN_DEPLOYMENT_ID và MAIN_DEPLOYMENT_ID.
set -euo pipefail
cd "$(dirname "$0")/.."

python3 scripts/guard.py --all
node tests/render.test.js

# giao diện cần pi-render.js dưới dạng tệp HTML của Apps Script
{ echo '<script>'; cat shared/pi-render.js; echo '</script>'; } > apps/main/ui/RenderJs.html

[ -f deploy.local.env ] && source deploy.local.env
msg="${1:-$(git log -1 --format=%h' '%s 2>/dev/null || echo update)}"

for app in signin main; do
  var="$(echo "$app" | tr a-z A-Z)_DEPLOYMENT_ID"
  dep="${!var:-}"
  echo "== $app"
  (cd "apps/$app" && clasp push --force)
  if [ -n "$dep" ]; then
    (cd "apps/$app" && clasp deploy -i "$dep" -d "$msg")
  else
    echo "   (chưa có $var trong deploy.local.env — tạo bản triển khai đầu tiên:)"
    (cd "apps/$app" && clasp deploy -d "$msg")
    echo "   → chép ID triển khai vừa in ra vào deploy.local.env: $var=…"
  fi
done
