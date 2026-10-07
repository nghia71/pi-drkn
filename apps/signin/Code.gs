/**
 * Ứng dụng đăng nhập (App A).
 * Chạy dưới quyền NGƯỜI TRUY CẬP, chỉ xin quyền đọc địa chỉ email (userinfo.email).
 * Google cho biết người đang dùng là ai; ứng dụng ký (HMAC-SHA256) "email|thời điểm" bằng khoá chung
 * và chuyển sang ứng dụng chính (App B), nơi chữ ký được kiểm tra (hiệu lực 10 phút).
 *
 * Script properties (đặt ở Project Settings → Script properties, không bao giờ ghi vào mã):
 *   SECRET  — khoá chung, giống hệt khoá của App B
 *   B_URL   — địa chỉ /exec của App B
 */
function doGet() {
  var email = (Session.getActiveUser().getEmail() || '').toLowerCase();
  var p = PropertiesService.getScriptProperties();
  var secret = p.getProperty('SECRET'), bUrl = p.getProperty('B_URL');
  if (!secret || !bUrl) return page_('<p>Ứng dụng chưa được cấu hình (thiếu SECRET hoặc B_URL).</p>');
  if (!email) return page_('<p>Không đọc được địa chỉ email. Hãy đăng nhập Google và cho phép ứng dụng biết email của bạn.</p>');
  var t = String(Date.now());
  var sig = sign_(email + '|' + t, secret);
  var url = bUrl + '?u=' + encodeURIComponent(email) + '&t=' + t + '&s=' + encodeURIComponent(sig);
  // chuyển thẳng, có nút dự phòng nếu trình duyệt chặn
  return page_('<p>Đang vào hệ thống với địa chỉ <b>' + escape_(email) + '</b>…</p>' +
    '<p><a target="_top" href="' + escape_(url) + '">Bấm vào đây nếu không tự chuyển</a></p>' +
    '<script>window.top.location.href=' + JSON.stringify(url) + ';</script>');
}

/** Chạy từ trình soạn thảo (Run → checkConfig) để kiểm tra cấu hình; Script properties đặt ở Project Settings. */
function checkConfig() {
  var p = PropertiesService.getScriptProperties();
  var secret = p.getProperty('SECRET'), bUrl = p.getProperty('B_URL') || '';
  var ok = !!secret && /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(bUrl);
  Logger.log(ok ? 'Cấu hình đúng.' : 'Thiếu SECRET hoặc B_URL sai dạng (phải là …/macros/s/…/exec, không có /u/0/).');
  return ok;
}

function sign_(msg, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(msg, secret));
}
function escape_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function page_(body) {
  return HtmlService.createHtmlOutput('<div style="font:16px system-ui,sans-serif;padding:24px">' + body + '</div>')
    .setTitle('Pi — Đề ra kỳ này');
}
