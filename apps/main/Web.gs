/** Cửa vào web: kiểm tra chữ ký của App A, cấp phiên, trả trang giao diện. */
function doGet(e) {
  var email = verifyEntry_(e && e.parameter);
  if (!email) {
    return HtmlService.createHtmlOutput('<div style="font:16px system-ui;padding:24px">' +
      '<p>Không xác thực được. Hãy vào hệ thống từ <b>đường dẫn đăng nhập</b> (đường dẫn chỉ có hiệu lực 10 phút).</p></div>')
      .setTitle('Pi — Đề ra kỳ này');
  }
  var u = findRow_('Users', 'email', email);
  if (!u) {
    audit_(email, 'từ chối', 'chưa có vai trò');
    return HtmlService.createHtmlOutput('<div style="font:16px system-ui;padding:24px"><p>Địa chỉ ' + email.replace(/</g, '&lt;') +
      ' chưa có vai trò trong hệ thống. Hãy liên hệ Phụ trách chuyên mục.</p></div>').setTitle('Pi — Đề ra kỳ này');
  }
  var t = HtmlService.createTemplateFromFile('ui/Index');
  t.token = newSession_(email);
  audit_(email, 'đăng nhập', '');
  return t.evaluate().setTitle('Pi — Đề ra kỳ này').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include_(name) { return HtmlService.createHtmlOutputFromFile(name).getContent(); }
