// Chạy bộ kiểm thử phía máy chủ (apps/main/Tests.gs) trên máy, bằng bộ mô phỏng Apps Script.
// Không cần mạng, không chạm Google. Dùng trước khi triển khai: node tools/gas-sim/run-tests.js [nhóm]
'use strict';
const fs = require('fs'), path = require('path');
const { loadApp } = require('./sim');
const root = path.join(__dirname, '..', '..');
const appDir = path.join(root, 'apps', 'main');
// giao diện cần pi-render.js dưới dạng tệp HTML (giống scripts/deploy.sh)
fs.writeFileSync(path.join(appDir, 'ui', 'RenderJs.html'), '<script>\n' + fs.readFileSync(path.join(root, 'shared', 'pi-render.js'), 'utf8') + '</script>\n');

// Chạy hai lần: không có và có dịch vụ nâng cao Sheets (đọc nhiều tab một lần) — hai đường đọc dữ liệu phải cho cùng kết quả.
let fails = 0, last = '';
for (const sheetsApi of [false, true]) {
  const e = loadApp(appDir, { owner: 'quantri@example.com', verbose: !!process.env.VERBOSE, sheetsApi });
  e.props.TEST_USERS = 'thu1@example.com,thu2@example.com';
  e.ctx.setupTests();
  let msg, rounds = 0;
  do {   // mô phỏng việc chạy lại khi "TẠM DỪNG"
    msg = e.ctx.runTests(process.argv[2] || '');
    rounds++;
  } while (/TẠM DỪNG/.test(msg) && rounds < 5);
  const sh = e.spreadsheets[e.props.TEST_SHEET_ID].getSheetByName('Kết quả');
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  console.log('--- ' + (sheetsApi ? 'có' : 'không có') + ' dịch vụ Sheets');
  rows.forEach(r => {
    if (r[3] !== 'ĐẠT') fails++;
    if (r[3] !== 'ĐẠT' || process.env.VERBOSE) console.log((r[3] === 'ĐẠT' ? 'ok   ' : 'LỖI  ') + r[0] + ' ' + r[1] + ' [' + r[2] + ']' + (r[4] ? '\n       ' + r[4] : ''));
  });
  console.log(msg); last = msg;
}
process.exit(fails ? 1 : 0);
