/** Cửa vào web: kiểm tra chữ ký của App A, cấp phiên, trả trang giao diện. */
function doGet(e) {
  var email = verifyEntry_(e && e.parameter);
  if (!email) {
    // Đường dẫn đã hết hạn (tải lại trang, dấu trang cũ…) hoặc bị sửa: đưa về trang đăng nhập.
    var signin = conf_('SIGNIN_URL');
    var btn = signin ? '<p><a target="_top" href="' + signin.replace(/"/g, '&quot;') + '" style="display:inline-block;padding:10px 20px;' +
      'background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none;font-weight:600">Đăng nhập lại</a></p>' : '';
    return HtmlService.createHtmlOutput('<div style="font:16px system-ui,sans-serif;padding:24px">' +
      '<p>Phiên vào hệ thống đã hết hạn hoặc không hợp lệ. Hãy vào lại từ <b>đường dẫn đăng nhập</b>.</p>' + btn + '</div>')
      .setTitle('Pi — Đề ra kỳ này');
  }
  var u = activeUser_(email);
  if (!u) {
    audit_(email, 'từ chối', 'chưa có vai trò');
    return HtmlService.createHtmlOutput('<div style="font:16px system-ui;padding:24px"><p>Địa chỉ ' + email.replace(/</g, '&lt;') +
      ' chưa có vai trò trong hệ thống. Hãy liên hệ Phụ trách chuyên mục.</p></div>').setTitle('Pi — Đề ra kỳ này');
  }
  var t = HtmlService.createTemplateFromFile('ui/Index');
  t.token = newSession_(email);
  var roles = String(u.data.vai_tro).split(',').map(function (r) { return r.trim(); }).filter(String);
  t.meJson = JSON.stringify({ email: email, name: u.data.ten, roles: roles, eff: roles });   // khỏi gọi 'me' lần đầu
  audit_(email, 'đăng nhập', '');
  return t.evaluate().setTitle('Pi — Đề ra kỳ này').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
