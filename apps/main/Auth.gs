/**
 * Danh tính: App A ký "email|t" bằng SECRET; ở đây kiểm tra chữ ký (≤ 10 phút) rồi cấp một
 * phiên làm việc (token ngẫu nhiên, lưu trong CacheService 6 giờ). Mọi lời gọi API đều kèm token.
 */
var LINK_TTL_MS = 10 * 60 * 1000;
var SESSION_TTL_S = 6 * 60 * 60;

function verifyEntry_(p) {
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || !p || !p.u || !p.t || !p.s) return null;
  var expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p.u + '|' + p.t, secret));
  if (!safeEqual_(expected, p.s)) return null;
  var age = Date.now() - Number(p.t);
  if (!(age >= -60000 && age < LINK_TTL_MS)) return null;
  return String(p.u).toLowerCase();
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function newSession_(email) {
  var tok = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('s:' + tok, JSON.stringify({ email: email, viewAs: null }), SESSION_TTL_S);
  return tok;
}

/** Trả về {email, roles, effectiveRoles} hoặc ném lỗi nếu phiên hết hạn / không có vai trò. */
function who_(token) {
  var raw = token && CacheService.getScriptCache().get('s:' + token);
  if (!raw) throw new Error('Phiên làm việc đã hết hạn — hãy vào lại từ đường dẫn đăng nhập.');
  var s = JSON.parse(raw);
  var u = findRow_('Users', 'email', s.email);
  if (!u || u.data.hoat_dong === false || String(u.data.hoat_dong).toUpperCase() === 'FALSE') throw new Error('Tài khoản chưa có vai trò trong hệ thống.');
  var roles = String(u.data.vai_tro).split(',').map(function (r) { return r.trim(); }).filter(String);
  // "Xem như vai trò…": chỉ Quản trị, chỉ để thử giao diện
  var eff = (s.viewAs && roles.indexOf('Quản trị') >= 0) ? [s.viewAs] : roles;
  return { email: s.email, name: u.data.ten, roles: roles, eff: eff, token: token };
}

function has_(w, list) { return w.eff.some(function (r) { return list.indexOf(r) >= 0; }); }
function need_(w, list) { if (!has_(w, list)) throw new Error('Không có quyền (cần: ' + list.join('/') + ').'); }

function setViewAs_(w, role) {
  if (w.roles.indexOf('Quản trị') < 0) throw new Error('Chỉ Quản trị.');
  if (role && ROLES.indexOf(role) < 0) throw new Error('Vai trò không hợp lệ.');
  CacheService.getScriptCache().put('s:' + w.token, JSON.stringify({ email: w.email, viewAs: role || null }), SESSION_TTL_S);
  audit_(w.email, 'viewAs', role || '(tắt)');
  return true;
}
