// In bảng kịch bản tự động (từ apps/main/Tests.gs) vào docs/testing.md giữa hai dấu mốc. Chạy: node tools/gen-test-table.js
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'apps/main/Tests.gs'), 'utf8');
const groups = { 1: 'Vào hệ thống', 2: 'Phiên làm việc', 3: 'Ai thấy gì', 4: 'Sửa đề / lời giải', 5: 'Thảo luận',
  6: 'Mục cần kiểm tra, xung đột, trạng thái', 7: 'Xem như vai trò', 8: 'Nhập hàng loạt và bản vá', 9: 'Nhật ký truy cập',
  10: 'Bộ hiển thị trong Apps Script', 11: 'Bài luyện tập', 12: 'Hàm quản trị', 13: 'Kỳ phản biện', 14: 'Bảng chọn bài', 15: 'Khoá kỳ' };
const re = /test_\('([\d.]+)', '((?:[^'\\]|\\.)*)', '([^']*)'/g;
const rows = []; let m;
while ((m = re.exec(src))) rows.push([m[1], m[2].replace(/\\'/g, "'"), m[3]]);
rows.sort((a, b) => { const x = a[0].split('.').map(Number), y = b[0].split('.').map(Number); return x[0] - y[0] || x[1] - y[1]; });
let out = '', cur = null;
rows.forEach(r => {
  const g = r[0].split('.')[0];
  if (g !== cur) { cur = g; out += '\n**' + g + '. ' + (groups[g] || '') + '**\n\n| Mã | Kịch bản | Tài khoản |\n|---|---|---|\n'; }
  out += '| ' + r[0] + ' | ' + r[1].replace(/\|/g, '\\|') + ' | ' + r[2] + ' |\n';
});
const doc = path.join(root, 'docs/testing.md');
let d = fs.readFileSync(doc, 'utf8');
const a = '<!-- bảng tự sinh: bắt đầu -->', b = '<!-- bảng tự sinh: hết -->';
d = d.replace(new RegExp(a + '[\\s\\S]*?' + b), a + '\n' + out + '\n' + b).replace(/\b\d+ kịch bản\b/g, rows.length + ' kịch bản');
fs.writeFileSync(doc, d);
console.log(rows.length + ' kịch bản');
