// Kiểm thử từ bên ngoài (không đăng nhập Google): hai địa chỉ web không để lộ gì cho người chưa đăng nhập.
// Chạy trên máy quản trị (cần deploy.local.env): node tests/http.test.js
'use strict';
const fs = require('fs'), path = require('path');
const envFile = path.join(__dirname, '..', 'deploy.local.env');
if (!fs.existsSync(envFile)) { console.log('bỏ qua: không có deploy.local.env'); process.exit(0); }
const env = {};
fs.readFileSync(envFile, 'utf8').split('\n').forEach(l => { const m = l.match(/^\s*(\w+)=(.*)$/); if (m) env[m[1]] = m[2].trim(); });
const url = id => 'https://script.google.com/macros/s/' + id + '/exec';
const SIGNIN = url(env.SIGNIN_DEPLOYMENT_ID), MAIN = url(env.MAIN_DEPLOYMENT_ID);

const cases = [
  ['H1', 'Người chưa đăng nhập Google mở trang đăng nhập → bị chuyển sang trang đăng nhập của Google', SIGNIN],
  ['H2', 'Người chưa đăng nhập Google mở thẳng ứng dụng chính → bị chuyển sang Google, không thấy dữ liệu', MAIN],
  ['H3', 'Liên kết giả mạo (chữ ký bịa) khi chưa đăng nhập Google → vẫn chỉ thấy trang đăng nhập của Google',
    MAIN + '?u=' + encodeURIComponent('ai-do@example.com') + '&t=' + Date.now() + '&s=chu-ky-bia']
];
const LEAKS = ['Đề ra kỳ này', 'TOKEN', 'ma_bai', 'de_bai', 'Không xác thực', 'chưa có vai trò'];

(async () => {
  let fails = 0, skipped = 0;
  for (const [id, title, u] of cases) {
    try {
      let r;
      try { r = await fetch(u, { redirect: 'manual' }); }
      catch (net) { skipped++; console.log('BỎ QUA ' + id + ' — không kết nối được Google từ máy này (' + (net.cause && net.cause.code || net.message) + ')'); continue; }
      const loc = r.headers.get('location') || '';
      const body = await r.text();
      // Google trả về chuyển hướng tới trang đăng nhập, hoặc (đôi khi) chính trang đăng nhập với mã 200
      const toGoogle = (r.status >= 300 && r.status < 400 && /accounts\.google\.com|ServiceLogin|signin/i.test(loc)) ||
                       (r.status === 200 && /accounts\.google\.com/.test(body) && /ServiceLogin|signin|Sign in/i.test(body));
      const leak = LEAKS.filter(s => body.includes(s));
      if (!toGoogle) throw new Error('mã ' + r.status + ', chuyển tới: ' + (loc || '(không)'));
      if (leak.length) throw new Error('nội dung lộ: ' + leak.join(', '));
      console.log('ok   ' + id + ' ' + title);
    } catch (e) { fails++; console.log('LỖI  ' + id + ' ' + title + '\n       ' + e.message); }
  }
  console.log(fails ? fails + ' lỗi' : skipped ? 'bỏ qua ' + skipped + ' (không có mạng tới Google)' : 'tất cả ' + cases.length + ' trường hợp đều đạt');
  process.exit(fails ? 1 : 0);
})();
