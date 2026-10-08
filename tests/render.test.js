// Kiểm thử bộ hiển thị với BÀI BỊA (tests/fixtures). Chạy: node tests/render.test.js
var assert = require('assert');
var R = require('../shared/pi-render.js');
var fx = require('./fixtures/render-cases.json');
var fails = 0;
fx.forEach(function (c) {
  var out = R.render(c.src, c.opts);
  try {
    (c.contains || []).forEach(function (s) { assert(out.html.indexOf(s) >= 0, 'thiếu: ' + s + '\n' + out.html); });
    (c.absent || []).forEach(function (s) { assert(out.html.indexOf(s) < 0, 'không được có: ' + s + '\n' + out.html); });
    assert.strictEqual(out.warnings.length, c.warnings || 0, 'số cảnh báo: ' + JSON.stringify(out.warnings));
    console.log('ok  -', c.name);
  } catch (e) { fails++; console.log('FAIL-', c.name, '\n   ', e.message); }
});
if (fails) { console.log(fails + ' lỗi'); process.exit(1); }
console.log('tất cả ' + fx.length + ' trường hợp đều đạt');
