#!/usr/bin/env node
/*
 * KIỂM THỬ GIAO DIỆN — trang thật (apps/main/ui/Index.html) trong Chromium, nối vào máy chủ chạy trên bản mô phỏng (tools/gas-sim).
 * Mỗi vai trò một cửa sổ riêng, đi hết các quy trình: danh sách, thêm bài, chuẩn bị bài, trạng thái, kỳ phản biện, phản biện,
 * hình, bảng chọn bài, khoá kỳ, điện thoại, chế độ tối. Mỗi bước vừa KIỂM TRA (sai thì báo lỗi, mã thoát 1) vừa CHỤP MÀN HÌNH;
 * ảnh ghép thành trang hướng dẫn out/ui/index.html (thư mục out/ không vào kho).
 *
 *   node tests/ui/run.js              chạy, kiểm tra, chụp ảnh
 *   node tests/ui/run.js --no-shots   chỉ kiểm tra (nhanh hơn)
 *
 * Cần: npm install (playwright, mathjax) và một trình duyệt: Google Chrome đã cài trên máy (tự dùng), hoặc npx playwright install chromium.
 * Dữ liệu: toàn bộ BỊA (bài, tác giả, địa chỉ @example.com) — không có bài thật nào.
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const REPO = path.resolve(__dirname, '..', '..'), APP = path.join(REPO, 'apps', 'main');
const OUT = path.join(REPO, 'out', 'ui');
const SHOTS = process.argv.indexOf('--no-shots') < 0;

let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require('/opt/node-tools/node_modules/playwright').chromium; }
  catch (e2) { console.log('bỏ qua: chưa cài playwright (npm install && npx playwright install chromium)'); process.exit(0); }
}
const MJ = path.join(REPO, 'node_modules', 'mathjax', 'es5');
const { loadApp } = require(path.join(REPO, 'tools', 'gas-sim', 'sim'));

/* ---------------- máy chủ mô phỏng + dữ liệu bịa ---------------- */
const QT = 'quantri@example.com', PT = 'pt@example.com', TBT = 'tbt@example.com', NCB = 'ncb@example.com',
      VP = 'vp@example.com', BTK = 'btk@example.com', PB1 = 'pb1@example.com', PB2 = 'pb2@example.com';
const e = loadApp(APP, { owner: QT, sheetsApi: false });
const c = e.ctx;
e.props.TEST_USERS = 'khongdung1@example.com,khongdung2@example.com';
c.setupTests();
c.DB_OVERRIDE = e.props.TEST_SHEET_ID;
c.TEST_CONF = { SECRET: crypto.randomUUID() + crypto.randomUUID(), BLIND_REVIEW: 'true', SIGNIN_URL: 'https://example.com/dang-nhap', TEST_USERS: '',
                FIG_FOLDER_ID: c.DriveApp.createFolder('hinh (thử)').getId(), EXPORT_FOLDER_ID: c.DriveApp.createFolder('chế bản (thử)').getId() };
c.TEST_OUTBOX = [];
const now = c.now_();
c.putRows_('Users', [[QT, 'Quản trị'], [PT, 'PT'], [TBT, 'TBT'], [NCB, 'NCB'], [VP, 'VP'], [BTK, 'BTK'], [PB1, 'PB'], [PB2, 'PB']]
  .map(([email, vai_tro]) => ({ email, ten: '', vai_tro, hoat_dong: true, ghi_chu: 'thử giao diện' })));
c.putRows_('Authors', [{ tac_gia_id: 'G1', ten_in: 'Trần Văn Bịa', don_vi: 'Trường Giả Định', lien_he: 'bia@example.com' },
                       { tac_gia_id: 'G2', ten_in: 'Lê Thị Thử', don_vi: 'Câu lạc bộ Toán Mẫu', lien_he: '' }]);
// đề bịa, đủ đa dạng để thấy công thức; năm 2030 cho khỏi lẫn với mã thật
const FX = require(path.join(REPO, 'tests', 'fixtures', 'ui-problems.json'));   // đề BỊA
const TPL = FX.mau;
const probs = [];
for (let k = 1; k <= 40; k++) {
  const t = TPL[k % TPL.length], f = String(1 + ((k - 1) >> 1) % 9).padStart(2, '0'), x = 'ab'[(k - 1) % 2];
  probs.push({ ma_bai: '2030-0' + (1 + Math.floor((k - 1) / 18)) + '-' + f + x, chu_de: t[0], muc: k % 3 ? 'A' : 'B', trang_thai: k % 4 === 0 ? 'SL' : 'Mới', loai: 'sáng tác',
               tac_gia_id: k % 2 ? 'G1' : 'G2', de_bai: t[1].replace(/%K/g, String(k + 2)), loi_giai: t[2].replace(/%K/g, String(k + 2)), phien_ban: 1,
               cap_nhat: now, nguoi_cap_nhat: 'dữ liệu thử' });
}
const P = probs;
// mười bài SL cho bảng chọn bài: 4 mức B, 6 mức A (mã riêng, tháng 12)
const BOARD = [];
for (let k = 1; k <= 10; k++) {
  const t = TPL[k % TPL.length];
  BOARD.push({ ma_bai: '2030-12-' + String(k).padStart(2, '0') + 'a', chu_de: t[0], muc: k <= 4 ? 'B' : 'A', trang_thai: 'SL', loai: 'sáng tác', tac_gia_id: 'G1',
               de_bai: t[1].replace(/%K/g, String(k + 4)), loi_giai: t[2].replace(/%K/g, String(k + 4)), phien_ban: 1, cap_nhat: now, nguoi_cap_nhat: 'dữ liệu thử' });
}
const DONE = [['2030-07-01a', 'SL-OK'], ['2030-07-02a', 'PL'], ['2030-07-03a', 'SL-Fail']].map(([ma, tt], i) =>
  ({ ma_bai: ma, chu_de: TPL[i][0], muc: 'A', trang_thai: tt, loai: 'sáng tác', tac_gia_id: 'G2', de_bai: TPL[i][1].replace(/%K/g, '7'), loi_giai: 'x', phien_ban: 1 }));
const ALLP = P.concat(BOARD, DONE).map(p => Object.assign({ de_bai_goc: p.de_bai, loi_giai_goc: p.loi_giai }, p));
c.putRows_('Problems', ALLP);
c.putRows_('Provenance', ALLP.map(p => ({ ma_bai: p.ma_bai, thu_muc: p.ma_bai.slice(0, 10) + ' (thư mục thử)', tep_goc: 'bai-thu.tex', ngay_nhan: p.ma_bai.slice(0, 7) + '-01', kenh: 'email' })));
['Corrections', 'Checks', 'Conflicts', 'ConversionLog', 'Rounds', 'Assignments', 'Shortlist', 'Issues', 'Reviews', 'Comments', 'Published', 'Revisions', 'Audit']
  .forEach(t => c.putRows_(t, []));
const OPEN = P.filter(p => p.trang_thai === 'Mới' || p.trang_thai === 'SL').length + BOARD.length;   // bài "đang xử lý"
const [P1, P2, P3, P4] = P.filter(p => p.trang_thai === 'Mới').map(p => p.ma_bai);

/* ---------------- trang ---------------- */
const read = f => fs.readFileSync(path.join(APP, f + '.html'), 'utf8');
const RENDER = '<script>\n' + fs.readFileSync(path.join(REPO, 'shared', 'pi-render.js'), 'utf8') + '</script>\n';
function pageHtml(email) {
  const tok = c.login_(email);
  const me = c.api(tok, 'me', {});
  const stub = `<script>window.__pending = 0;
  window.google = { script: { history: { push(){}, replace(){}, setChangeHandler(){} }, get run() {
    let ok = () => {}, bad = () => {};
    const r = { withSuccessHandler(f) { ok = f; return r; }, withFailureHandler(f) { bad = f; return r; },
      api(t, m, a) { window.__pending++; window.__api(t, m, a).then(x => { window.__pending--; x.err ? bad(new Error(x.err)) : ok(x.v); }); } };
    return r; } } };</script>`;
  return read('ui/Index').replace("<?!= include_('ui/Styles') ?>", read('ui/Styles')).replace("<?!= include_('ui/RenderJs') ?>", RENDER)
    .replace("<?!= include_('ui/Icons') ?>", read('ui/Icons')).replace('<?= token ?>', JSON.stringify(tok))
    .replace('<?= meJson ?>', JSON.stringify(JSON.stringify(me))).replace('<head>', '<head>' + stub);
}

const fails = [], tour = [];
let chapter = '', step = '';
function check(cond, msg) { if (!cond) { fails.push(chapter + ' › ' + step + ': ' + msg); console.log('  LỖI ' + msg); } }
function section(t, intro) { chapter = t; tour.push({ chapter: t, intro: intro || '' }); console.log('== ' + t); }

let br, mathjax = fs.existsSync(path.join(MJ, 'tex-chtml.js'));
async function open(email, opt) {
  const ctx = await br.newContext(Object.assign({ viewport: { width: 1180, height: 860 }, acceptDownloads: true, locale: 'vi-VN', timezoneId: 'Asia/Ho_Chi_Minh' }, opt || {}));
  const pg = await ctx.newPage();
  pg.errs = []; pg.who = email;
  pg.on('pageerror', x => pg.errs.push(String(x)));
  pg.on('console', m => { if (m.type() === 'error') pg.errs.push(m.text()); });
  pg.on('dialog', d => { pg.errs.push('hộp thoại bật lên: ' + d.message()); d.dismiss(); });
  await ctx.route('https://cdn.jsdelivr.net/npm/mathjax@3/**', r => {
    const rel = new URL(r.request().url()).pathname.replace(/^\/npm\/mathjax@3\/es5\//, '');
    const f = path.join(MJ, rel);
    if (mathjax && f.startsWith(MJ) && fs.existsSync(f)) r.fulfill({ path: f }); else r.abort();
  });
  await ctx.exposeFunction('__api', (t, m, a) => { try { return { v: JSON.parse(JSON.stringify(c.api(t, m, a) ?? null)) }; } catch (x) { return { err: x.message }; } });
  await pg.setContent(pageHtml(email), { waitUntil: 'load' });
  await idle(pg);
  return pg;
}
/** Chờ mọi lời gọi máy chủ xong, trang vẽ lại, công thức dựng xong. */
async function idle(pg, ms) {
  await pg.waitForFunction(() => window.__pending === 0, null, { timeout: 15000 });
  await pg.waitForTimeout(ms || 120);
  await pg.evaluate(() => (window.MathJax && MathJax.typesetPromise ? MathJax.typesetPromise().catch(() => {}) : null)).catch(() => {});
  await pg.waitForFunction(() => window.__pending === 0, null, { timeout: 15000 });
}
/**
 * Chụp màn hình cho trang hướng dẫn. marks = các bước đánh số: [{sel, t, has?, next?}] — khung cam + số trên phần tử,
 * cùng số ở danh sách bước dưới ảnh. Không thấy phần tử được chú thích → báo lỗi (hướng dẫn luôn khớp giao diện).
 */
async function shot(pg, name, caption, full, marks) {
  if (!SHOTS) return;
  await idle(pg); await clearToasts(pg);
  const file = String(tour.filter(x => x.img).length + 1).padStart(2, '0') + '-' + name + '.png';
  const ann = marks && marks.length ? await annotate(pg, marks) : { miss: [], out: false };
  ann.miss.forEach(m => check(false, 'chú thích ảnh ' + name + ': không thấy ' + m));
  const fullPage = full !== false || ann.out;
  if (fullPage) await pg.evaluate(() => window.scrollTo(0, 0));     // thanh đầu trang (sticky) nằm ở đầu ảnh, không ở giữa
  await pg.screenshot({ path: path.join(OUT, file), fullPage });
  await pg.evaluate(() => { const a = document.getElementById('__ann'); if (a) a.remove(); });
  tour.push({ img: file, caption, who: pg.who, view: pg.viewportSize().width < 600 ? 'điện thoại' : '', steps: (marks || []).map(m => m.t) });
}
async function annotate(pg, marks) {
  return pg.evaluate(ms => {
    const lay = document.createElement('div'); lay.id = '__ann';
    lay.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;z-index:99999;pointer-events:none';
    document.body.appendChild(lay);
    const miss = []; let top = 1e9, bot = 0;
    ms.forEach((m, i) => {
      let els = Array.from(document.querySelectorAll(m.sel)).filter(e => e.getClientRects().length);
      if (m.has) els = els.filter(e => e.textContent.includes(m.has));
      const el = els[0];
      if (!el) { miss.push(m.sel + (m.has ? ' «' + m.has + '»' : '')); return; }
      const r = el.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom;
      if (m.next && el.nextElementSibling) { const q = el.nextElementSibling.getBoundingClientRect(); L = Math.min(L, q.left); T = Math.min(T, q.top); R = Math.max(R, q.right); B = Math.max(B, q.bottom); }
      const x = L + scrollX - 5, y = T + scrollY - 5, w = R - L + 10, h = B - T + 10;
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;border:3px solid #e8590c;border-radius:10px;box-shadow:0 0 0 2px rgba(255,255,255,.85)`;
      const n = document.createElement('div'); n.textContent = i + 1;
      n.style.cssText = `position:absolute;left:${Math.max(2, x - 13)}px;top:${Math.max(2, y - 13)}px;width:26px;height:26px;border-radius:50%;background:#e8590c;color:#fff;` +
                        'font:700 14px/26px system-ui,sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.45)';
      lay.append(box, n); top = Math.min(top, Math.max(0, y - 13)); bot = Math.max(bot, y + h);
    });
    return { miss, out: top < scrollY || bot > scrollY + innerHeight };
  }, marks);
}
const text = (pg, sel) => pg.$eval(sel, el => el.innerText).catch(() => '');
const count = (pg, sel) => pg.$$eval(sel, x => x.length);
const toastText = pg => pg.$$eval('#toasts div', x => x.map(d => d.textContent).join(' | ')).catch(() => '');
async function clearToasts(pg) { await pg.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; }); }
async function openProb(pg, ma) { await pg.evaluate(m => { nav({ ma: m }); openProblem(m); }, ma); await idle(pg, 200); }
async function tab(pg, id) { await pg.click('#' + id); await idle(pg, 200); }
async function twice(pg, sel) { await pg.click(sel); await idle(pg); await pg.click(sel); await idle(pg, 200); }

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
  br = await launchBrowser();
  const pages = [];
  const O = async (email, opt) => { const p = await open(email, opt); pages.push(p); return p; };

  /* ---------- 1. Danh sách ---------- */
  section('1. Danh sách bài', 'Mở hệ thống: danh sách mặc định chỉ có bài đang xử lý (Mới, SL), mỗi lần 30 bài; lọc theo chủ đề, mức, trạng thái; sắp xếp.');
  const qt = await O(QT);
  step = 'mặc định';
  check((await count(qt, '#list .card')) === 30, 'trang đầu phải có 30 bài');
  check((await text(qt, '#list .sm-t')).indexOf('30 / ' + OPEN) >= 0, 'dòng "Đang hiện 30 / ' + OPEN + '"');
  check(!(await text(qt, '#list')).includes('PL'), 'bài đã đăng không hiện mặc định');
  await qt.waitForTimeout(1300);
  check((await count(qt, '#list .tx.clip')) === 0 && (await count(qt, '#list .clip-more')) === 0, 'bài ngắn hiện trọn, không bị làm mờ');
  await shot(qt, 'danh-sach', 'Quản trị mở hệ thống: danh sách bài đang xử lý (Mới, SL), 30 bài đầu. Mỗi bài: mã, chủ đề, mức, trạng thái, tác giả.', false, [{"sel": "nav.tabs", "t": "Các trang — mỗi người chỉ thấy trang của vai trò mình"}, {"sel": ".fbar", "t": "Lọc theo chủ đề, mức, trạng thái; chọn cách sắp xếp"}, {"sel": "#list article .code", "t": "Bấm mã bài để mở bài"}, {"sel": "#view-as", "t": "Quản trị: \"xem như\" một vai trò khác để kiểm tra"}]);
  step = 'xem thêm / thu gọn';
  await qt.click('#list button:has-text("Xem thêm")'); await idle(qt);
  check((await count(qt, '#list .card')) === Math.min(60, OPEN), 'Xem thêm: thêm 30 bài');
  check((await count(qt, '#list button:has-text("Thu gọn")')) === 1, 'có nút Thu gọn');
  await openProb(qt, P1); await tab(qt, 'go-list');
  check((await count(qt, '#list .card')) === 30, 'bấm thẻ Danh sách: về 30 bài đầu');
  step = 'lọc';
  await qt.selectOption('#f-status', ''); await idle(qt);
  check((await text(qt, '#list .sm-t')).indexOf(String(ALLP.length)) >= 0, 'Mọi trạng thái: đủ ' + ALLP.length + ' bài');
  await qt.selectOption('#f-topic', 'HH'); await qt.selectOption('#f-sort', 'ma'); await idle(qt);
  const codes = await qt.$$eval('#list .card .code', x => x.map(a => a.textContent));
  check(codes.length > 0 && codes.every((x, i) => !i || codes[i - 1] <= x), 'sắp theo mã A→Z');
  await shot(qt, 'loc', 'Lọc: chủ đề Hình học, mọi trạng thái, sắp theo mã. Nhãn trạng thái có màu, biểu tượng và chữ (SL-OK, PL, SL-Fail…).', false, [{"sel": "#f-topic", "t": "Chọn chủ đề"}, {"sel": "#f-status", "t": "\"Mọi trạng thái\": thêm bài đã chọn, đã loại, đã đăng"}, {"sel": "#f-sort", "t": "Sắp xếp theo mã"}, {"sel": "#list article .head", "t": "Nhãn: chủ đề, mức, trạng thái (màu + biểu tượng + chữ)"}]);
  await qt.selectOption('#f-topic', ''); await qt.selectOption('#f-status', '_mo'); await qt.selectOption('#f-sort', 'moi'); await idle(qt);
  step = 'xem như PB';
  await qt.selectOption('#view-as', 'PB'); await idle(qt, 300);
  check((await text(qt, '#me')).includes('PB'), 'dòng trên cùng ghi PB');
  check((await count(qt, '#list .card')) === 0, 'xem như PB: không thấy bài nào (Quản trị không được giao)');
  check(await qt.$eval('#go-rounds', b => b.hidden), 'xem như PB: không có thẻ Kỳ phản biện');
  await qt.selectOption('#view-as', ''); await idle(qt, 300);
  check((await count(qt, '#list .card')) === 30, 'trở lại vai trò thật');

  /* ---------- 2. Thêm bài ---------- */
  section('2. Thêm bài trên trang', 'NCB (hoặc VP, PT, TBT) thêm trực tiếp một hồ sơ: tác giả mới, hai bài, ảnh của đề (in kèm đề) và ảnh minh hoạ lời giải (không in).');
  const ncb = await O(NCB);
  step = 'thẻ mục theo vai trò';
  for (const [id, vis] of [['go-rounds', 1], ['go-boards', 1], ['go-figs', 1], ['go-add', 1]]) check(!(await ncb.$eval('#' + id, b => b.hidden)) === !!vis, 'NCB thấy thẻ ' + id);
  await tab(ncb, 'go-add');
  const next = await text(ncb, '#a-next');
  check(/^\d{4}-\d{2}-\d{2}$/.test(next), 'thư mục sẽ cấp có dạng NNNN-TT-NN: ' + next);
  step = 'điền hồ sơ';
  await ncb.fill('#add [data-k=ten]', 'Phạm Thị Mới'); await ncb.fill('#add [data-k=dv]', 'Trường Thử Nghiệm');
  await ncb.fill('#add [data-k=lh]', 'tacgiamoi@example.com');
  const tex = FX.tep_tex;
  await ncb.setInputFiles('.nb[data-i="0"] [data-k=tex]', { name: 'tac-gia-sh-a.tex', mimeType: 'text/plain', buffer: Buffer.from(tex) });
  await ncb.waitForFunction(() => document.querySelector('.nb[data-i="0"] [data-k=de]').value.length > 0);
  check(await ncb.$eval('.nb[data-i="0"] [data-k=chu_de]', s => s.value) === 'SH', 'tên tệp …-sh-a.tex → chủ đề Số học');
  check(await ncb.$eval('.nb[data-i="0"] [data-k=muc]', s => s.value) === 'A', 'tên tệp …-a.tex → mức A');
  check(!(await ncb.$eval('.nb[data-i="0"] [data-k=de]', t => t.value)).includes('Bài toán'), 'bỏ dòng tiêu đề "Bài toán"');
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150" viewBox="0 0 240 150"><rect width="240" height="150" fill="#fff"/>' +
    '<polygon points="20,130 220,130 60,20" fill="none" stroke="#175f37" stroke-width="3"/><text x="12" y="146" font-size="16">A</text>' +
    '<text x="222" y="146" font-size="16">B</text><text x="56" y="16" font-size="16">C</text></svg>';
  await ncb.setInputFiles('.nb[data-i="0"] [data-k=anh]', { name: 'tam-giac.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) });
  await ncb.selectOption('.nb[data-i="0"] [data-noi="0"]', 'de');
  await ncb.click('[data-a=more]');
  await ncb.selectOption('.nb[data-i="1"] [data-k=chu_de]', 'HH');
  await ncb.fill('.nb[data-i="1"] [data-k=de]', FX.bai_go_tay.de);
  await ncb.fill('.nb[data-i="1"] [data-k=lg]', FX.bai_go_tay.lg);
  const PNG = await ncb.screenshot({ clip: { x: 0, y: 0, width: 160, height: 90 } });
  await ncb.setInputFiles('.nb[data-i="1"] [data-k=anh]', { name: 'minh-hoa.png', mimeType: 'image/png', buffer: PNG });
  await idle(ncb, 500);
  await ncb.click('[data-a=save]'); await idle(ncb);
  check((await toastText(ncb)).includes('Chọn chỗ đặt'), 'ảnh chưa chọn chỗ đặt: bị nhắc');
  await ncb.selectOption('.nb[data-i="1"] [data-noi="0"]', 'lg'); await clearToasts(ncb);
  await ncb.click('[data-a=save]'); await idle(ncb);
  check((await text(ncb, '[data-a=save]')).startsWith('Bấm lần nữa'), 'nút Thêm cần bấm hai lần');
  await shot(ncb, 'them-bai', 'Thêm bài: tệp .tex của tác giả tự tách thành đề và lời giải; chủ đề, mức lấy từ tên tệp; mỗi ảnh chọn chỗ đặt. Nút "Thêm vào danh sách" bấm hai lần.', true, [{"sel": "#add [data-k=thang]", "t": "Tháng nhận — thư mục sẽ cấp được tính tự động"}, {"sel": "#add [data-k=tg]", "t": "Chọn tác giả đã có, hoặc để trống và ghi tác giả mới bên dưới"}, {"sel": ".nb[data-i=\"0\"] [data-k=tex]", "t": "Tải tệp .tex của tác giả: tự tách đề và lời giải"}, {"sel": ".nb[data-i=\"0\"] [data-noi=\"0\"]", "t": "Mỗi ảnh: đặt ở đề (in kèm đề) hay minh hoạ lời giải (không in)"}, {"sel": "[data-a=more]", "t": "Thêm một bài nữa của cùng tác giả"}, {"sel": "[data-a=save]", "t": "Thêm vào danh sách — bấm hai lần"}]);
  await ncb.click('[data-a=save]'); await idle(ncb, 300);
  const added = await ncb.$$eval('#a-res .code', x => x.map(a => a.textContent));
  check(added.length === 2 && added[0] === next + 'a' && added[1] === next + 'b', 'đã thêm hai bài ' + next + 'a, b: ' + added);
  await shot(ncb, 'da-them', 'Đã thêm hai bài; mã = tháng + thư mục kế tiếp + a, b. Liên hệ của tác giả chỉ lưu ở hồ sơ tác giả, không vào đề.', false, [{"sel": "#a-res", "t": "Mã bài vừa cấp — bấm để mở bài"}]);
  step = 'xem bài vừa thêm';
  await openProb(ncb, next + 'a');
  check((await count(ncb, '#sec-hinh img')) === 1, 'ảnh của đề hiện ở mục Hình');
  await shot(ncb, 'bai-moi-a', 'Bài a: đề bài đóng khung (phần sẽ in), ảnh của đề ở mục Hình, lời giải để trơn bên dưới.', true, [{"sel": "#sec-de_bai .tx.de", "t": "Đề bài (phần sẽ in) — đóng khung"}, {"sel": "#sec-hinh", "t": "Ảnh của đề"}, {"sel": "#sec-loi_giai", "t": "Lời giải — chữ trơn, không in"}, {"sel": "#sec-de_bai [data-edit]", "t": "Sửa đề"}]);
  await openProb(ncb, next + 'b');
  check((await count(ncb, '#sec-loi_giai img')) === 1, 'ảnh lời giải hiện cuối lời giải');
  check((await text(ncb, '#sec-hinh')).includes('không có hình'), 'bài b: mục Hình trống');
  check(!(await text(ncb, '#page')).includes('tacgiamoi@example.com'), 'liên hệ tác giả không hiện cho NCB');

  /* ---------- 3. Chuẩn bị bài ---------- */
  section('3. Chuẩn bị bài: sửa, hai người cùng sửa, lịch sử, mục cần kiểm tra, xung đột', 'Người chuẩn bị bài (NCB) sửa đề / lời giải trên trang, xem trước công thức ngay; mọi lần sửa có lịch sử; không ai ghi đè lặng lẽ lên người khác.');
  step = 'sửa đề';
  const ncb2 = await O(NCB);
  await openProb(ncb, P1); await openProb(ncb2, P1);
  await ncb.click('#sec-de_bai [data-edit]'); await ncb2.click('#sec-de_bai [data-edit]');
  await ncb.fill('#sec-de_bai textarea', (await ncb.$eval('#sec-de_bai textarea', t => t.value)) + ' Khi nào xảy ra dấu bằng $a=b=c=1$?');
  await idle(ncb, 700);
  check((await text(ncb, '#sec-de_bai .pv')).includes('Khi nào xảy ra dấu bằng'), 'ô xem trước cập nhật khi gõ');
  await shot(ncb, 'sua-de', 'Sửa đề: mã LaTeX bên trái, xem trước bên phải (công thức dựng ngay khi gõ). Chọn "Sửa nhỏ" hay "Sửa nội dung toán".', false, [{"sel": "#sec-de_bai textarea", "t": "Gõ / sửa LaTeX"}, {"sel": "#sec-de_bai .pv", "t": "Xem trước ngay khi gõ"}, {"sel": "#sec-de_bai .kind", "t": "Chọn: Sửa nhỏ, hay Sửa nội dung toán (phải ghi vị trí, lý do)"}, {"sel": "#sec-de_bai [data-a=save]", "t": "Lưu (hoặc Huỷ)"}]);
  await ncb.click('#sec-de_bai [data-a=save]'); await idle(ncb, 300);
  check((await text(ncb, '#ver')).startsWith('Phiên bản 2'), 'lưu: phiên bản 2');
  step = 'hai người cùng sửa';
  await ncb2.fill('#sec-de_bai textarea', (await ncb2.$eval('#sec-de_bai textarea', t => t.value)) + ' (bản của người thứ hai)');
  await ncb2.click('#sec-de_bai [data-a=save]'); await idle(ncb2, 400);
  check((await toastText(ncb2)).includes('người khác sửa'), 'người lưu sau được báo');
  check((await count(ncb2, '#sec-de_bai .newer .conf')) === 1, 'khung so sánh với bản mới nhất');
  check((await ncb2.$eval('#sec-de_bai textarea', t => t.value)).includes('người thứ hai'), 'chữ đang gõ vẫn còn');
  await shot(ncb2, 'hai-nguoi-sua', 'Hai người cùng sửa: người lưu sau được báo, bản đang gõ vẫn còn trong ô; khung vàng so sánh với bản vừa lưu (gạch đỏ: bỏ, xanh: thêm).', false, [{"sel": "#sec-de_bai .newer .conf", "t": "Người khác vừa lưu: so sánh (gạch đỏ: bỏ, xanh: thêm)"}, {"sel": "#sec-de_bai textarea", "t": "Bản của bạn vẫn còn — gộp phần cần giữ"}, {"sel": "#sec-de_bai [data-a=save]", "t": "Lưu lần nữa"}]);
  await clearToasts(ncb2);
  await ncb2.click('#sec-de_bai [data-a=save]'); await idle(ncb2, 300);
  check((await text(ncb2, '#ver')).startsWith('Phiên bản 3'), 'lưu lần nữa: phiên bản 3');
  step = 'sửa nội dung toán';
  await ncb.close(); pages.splice(pages.indexOf(ncb), 1);
  const ncbA = ncb2;
  await ncbA.click('#sec-loi_giai [data-edit]');
  await ncbA.fill('#sec-loi_giai textarea', (await ncbA.$eval('#sec-loi_giai textarea', t => t.value)) + ' Đáp số: $3$.');
  await ncbA.check('#sec-loi_giai input[value=noi_dung]');
  await ncbA.click('#sec-loi_giai [data-a=save]'); await idle(ncbA);
  check((await text(ncbA, '#sec-loi_giai .st')).includes('Vị trí'), 'sửa nội dung toán: phải ghi Vị trí và Lý do');
  await ncbA.fill('#sec-loi_giai [data-f=vi_tri]', 'kết luận'); await ncbA.fill('#sec-loi_giai [data-f=ly_do]', 'thử nghiệm giao diện');
  await ncbA.click('#sec-loi_giai [data-a=save]'); await idle(ncbA, 300);
  await ncbA.click('#props summary'); await idle(ncbA);
  check((await text(ncbA, '#props')).includes('kết luận'), 'mục Sửa đổi có dòng mới');
  step = 'huỷ hai lần';
  await ncbA.click('#sec-loi_giai [data-edit]'); await ncbA.type('#sec-loi_giai textarea', 'x');
  await ncbA.click('#sec-loi_giai [data-a=cancel]');
  check((await text(ncbA, '#sec-loi_giai .st')).includes('Huỷ lần nữa'), 'Huỷ lần đầu: nhắc còn thay đổi');
  await ncbA.click('#sec-loi_giai [data-a=cancel]'); await idle(ncbA);
  check((await count(ncbA, '#sec-loi_giai textarea')) === 0, 'Huỷ lần hai: đóng ô sửa');
  step = 'mục cần kiểm tra';
  await ncbA.click('[data-act=check-new]'); await ncbA.fill('.inl[data-for=check-new] textarea', 'Kiểm tra lại trường hợp dấu bằng');
  await ncbA.click('.inl[data-for=check-new] [data-k=ok]'); await idle(ncbA, 300);
  await ncbA.click('[data-act=check-close]'); await ncbA.click('.inl [data-k=ok]'); await idle(ncbA);
  check((await toastText(ncbA)).length > 0, 'đóng mục mà không ghi kết quả: bị từ chối');
  await clearToasts(ncbA);
  await ncbA.fill('.inl textarea', 'đã kiểm tra, đúng'); await ncbA.click('.inl [data-k=ok]'); await idle(ncbA, 300);
  check((await text(ncbA, '#props')).includes('⇒ đã kiểm tra, đúng'), 'mục đã đóng kèm kết quả');
  step = 'xung đột';
  await ncbA.click('[data-act=confl-new]');
  await ncbA.selectOption('.inl[data-for=confl-new] select', 'mức'); await ncbA.fill('.inl[data-for=confl-new] textarea', 'Tác giả đề nghị mức A, NCB thấy mức B');
  await ncbA.click('.inl[data-for=confl-new] [data-k=ok]'); await idle(ncbA, 300);
  await ncbA.click('[data-act=confl-edit]'); await idle(ncbA);
  const opts = await ncbA.$$eval('.inl select[data-k=trang_thai] option', x => x.map(o => o.textContent));
  check(!opts.includes('đã giải quyết'), 'xung đột mức: NCB không đặt được "đã giải quyết"');
  await ncbA.click('.inl [data-k=ok]'); await idle(ncbA, 300);
  await ncbA.click('#hist-load'); await idle(ncbA, 300);
  check((await count(ncbA, '#hist details.rev')) >= 3, 'lịch sử có các lần sửa');
  await ncbA.$$eval('#hist details.rev', d => { if (d[0]) d[0].open = true; });
  await shot(ncbA, 'nguon-chinh-sua', 'Mục "Nguồn & chỉnh sửa": sửa đổi nội dung toán (chờ tác giả xác nhận), mục cần kiểm tra đã đóng kèm kết quả, xung đột mức chờ TBT, lịch sử từng phiên bản.', true, [{"sel": "#props h4", "t": "Sửa đổi: vị trí, trước → sau, lý do; trạng thái \"chờ tác giả xác nhận\"", "has": "Sửa đổi", "next": 1}, {"sel": "#props h4", "t": "Cần kiểm tra: đóng mục phải ghi kết quả", "has": "Cần kiểm tra", "next": 1}, {"sel": "#props h4", "t": "Xung đột mức: NCB chuyển \"chờ TBT\", TBT quyết định", "has": "Xung đột", "next": 1}, {"sel": "#hist", "t": "Lịch sử sửa: từng phiên bản, phần khác nhau"}]);

  /* ---------- 4. Trạng thái ---------- */
  section('4. Trạng thái bài', 'PT, TBT đổi trạng thái. "Không SL" (không vào shortlist, thôi xem) và "SL-Fail" phải ghi lý do.');
  const pt = await O(PT);
  step = 'Không SL';
  check((await count(ncbA, '#st-sel')) === 0, 'NCB không đổi được trạng thái');
  await openProb(pt, P2);
  await pt.selectOption('#st-sel', 'Không SL'); await pt.click('[data-act=status]'); await idle(pt);
  await pt.click('.inl[data-for=st] [data-k=ok]'); await idle(pt);
  check((await toastText(pt)).length > 0, 'Không SL mà không có lý do: bị từ chối');
  await clearToasts(pt);
  await pt.fill('.inl[data-for=st] textarea', 'Trùng ý với một bài đã đăng');
  await shot(pt, 'khong-sl', 'Chuyển sang "Không SL": phải ghi lý do; lý do được lưu thành một mục đã đóng trong "Nguồn & chỉnh sửa".', false, [{"sel": "#st-sel", "t": "Chọn trạng thái"}, {"sel": "[data-act=status]", "t": "Đổi trạng thái"}, {"sel": ".inl[data-for=st] textarea", "t": "Không SL / SL-Fail: ghi lý do (bắt buộc)"}, {"sel": ".inl[data-for=st] [data-k=ok]", "t": "Xác nhận"}]);
  await pt.click('.inl[data-for=st] [data-k=ok]'); await idle(pt, 300);
  check((await text(pt, '#page .head')).includes('Không SL'), 'nhãn Không SL');
  for (const ma of [P1, P3]) { await openProb(pt, ma); await pt.selectOption('#st-sel', 'SL'); await pt.click('[data-act=status]'); await idle(pt, 300); }
  check((await text(pt, '#page .head')).includes('SL'), 'chuyển SL');

  /* ---------- 5. Kỳ phản biện ---------- */
  section('5. Kỳ phản biện', 'PT mở kỳ, giao bài cho phản biện, gửi thư mời; phản biện tự giải trước (chưa thấy lời giải), điền phiếu, trao đổi ẩn danh; PT mở lời giải, rồi đóng kỳ.');
  await tab(pt, 'go-rounds');
  const today = await pt.$eval('#r-han', i => i.min);
  const plus = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  step = 'mở kỳ, xoá kỳ mở nhầm';
  for (const ky of ['PB-THU-1', 'PB-NHAM']) {
    await pt.fill('#r-ky', ky); await pt.fill('#r-han', plus(today, 10)); await pt.click('[data-r=open]'); await idle(pt, 300);
  }
  check((await count(pt, '.rd')) === 2, 'hai kỳ đang mở');
  check((await text(pt, '.rd[data-ky="PB-THU-1"] .head')).includes('còn 10 ngày'), 'hạn: còn 10 ngày');
  await twice(pt, '.rd[data-ky="PB-NHAM"] [data-r=del]');
  check((await count(pt, '.rd[data-ky="PB-NHAM"]')) === 0, 'xoá kỳ mở nhầm (chưa có phiếu)');
  step = 'giao bài, thư mời';
  for (const [ma, pb] of [[P1, PB1], [P1, PB2], [P3, PB1]]) {
    await pt.selectOption('.rd[data-ky="PB-THU-1"] select[data-k=ma]', ma); await pt.selectOption('.rd[data-ky="PB-THU-1"] select[data-k=pb]', pb);
    await pt.click('.rd[data-ky="PB-THU-1"] [data-r=assign]'); await idle(pt, 300);
  }
  check((await count(pt, '.rd[data-ky="PB-THU-1"] table.as tr')) === 4, 'ba phân công');
  c.TEST_OUTBOX = [];
  await pt.click('.rd[data-ky="PB-THU-1"] [data-r=invite]'); await idle(pt, 300);
  check(c.TEST_OUTBOX.length === 2, 'hai thư mời (mỗi phản biện một thư): ' + c.TEST_OUTBOX.length);
  const mails = JSON.stringify(c.TEST_OUTBOX);
  check(!mails.includes('Trần Văn Bịa') && !mails.includes('Lê Thị Thử') && !mails.includes('$'), 'thư mời không có tên tác giả hay đề bài');
  await shot(pt, 'ky-phan-bien', 'Trang Kỳ phản biện (PT): hạn, số phân công / phiếu / xong; giao bài; gửi thư mời (mỗi người một thư, không có đề hay tên tác giả); lời giải "chưa mở".', true, [{"sel": "#r-ky", "t": "Mở kỳ mới: tên, hạn"}, {"sel": ".rd[data-ky=\"PB-THU-1\"] select[data-k=ma]", "t": "Giao bài: chọn bài, chọn phản biện, bấm Giao"}, {"sel": ".rd[data-ky=\"PB-THU-1\"] [data-r=invite]", "t": "Gửi thư mời (mỗi người một thư)"}, {"sel": ".rd[data-ky=\"PB-THU-1\"] [data-r=sol]", "t": "Mở lời giải khi phản biện đã tự giải"}, {"sel": ".rd[data-ky=\"PB-THU-1\"] [data-r=close]", "t": "Hết hạn: đóng kỳ (bấm hai lần)"}]);
  step = 'phản biện 1';
  const pb1 = await O(PB1);
  for (const id of ['go-rounds', 'go-boards', 'go-figs', 'go-add']) check(await pb1.$eval('#' + id, b => b.hidden), 'PB không thấy thẻ ' + id);
  check((await count(pb1, '#list .card')) === 2, 'PB chỉ thấy hai bài được giao');
  const pbList = await text(pb1, '#list');
  check(!pbList.includes('Trần Văn Bịa') && !pbList.includes('Lê Thị Thử'), 'PB không thấy tên tác giả');
  check(pbList.includes('chưa có phiếu'), 'nhãn hạn / chưa có phiếu');
  await shot(pb1, 'pb-danh-sach', 'Phản biện chỉ thấy bài được giao, không có tên tác giả; nhãn cho biết hạn và đã có phiếu chưa. Không có thẻ nào khác.', false, [{"sel": "#list article .chip.w", "t": "Hạn phản biện, đã có phiếu chưa"}, {"sel": "#list article .code", "t": "Mở bài"}]);
  await openProb(pb1, P1);
  check((await text(pb1, '#sec-loi_giai')).includes('chưa mở'), 'lời giải chưa mở cho phản biện');
  check((await count(pb1, '#props')) === 0, 'PB không có "Nguồn & chỉnh sửa"');
  await pb1.click('.rv [data-act=rv-save]'); await idle(pb1);
  check((await text(pb1, '.rv .st')).includes('Hãy chọn đề nghị'), 'phiếu: phải chọn đề nghị');
  await pb1.selectOption('.rv select', 'B'); await pb1.check('.rv input[value="sửa rồi chọn"]');
  await pb1.fill('.rv textarea', 'Lời giải cần xét riêng trường hợp $a=b=c$. Đề hay, hợp với mức B.');
  await pb1.click('.rv [data-act=rv-save]'); await idle(pb1, 300);
  await pb1.click('.rv [data-act=rv-done]'); await idle(pb1, 300);
  check((await count(pb1, '.rv [data-act=rv-undo]')) === 1, 'đã đánh dấu xong: phiếu khoá');
  await pb1.fill('#cm-new', 'Bước 2 cần nói rõ vì sao $a+b+c=3$ dẫn tới $abc\\le 1$.'); await pb1.click('#cm-send'); await idle(pb1, 300);
  await pb1.fill('#cm-new', '<img src=x onerror=alert(1)> <b>thử mã độc</b>'); await pb1.click('#cm-send'); await idle(pb1, 300);
  check((await text(pb1, '#cm')).includes('<img src=x onerror=alert(1)>'), 'nhận xét có mã độc hiện nguyên văn như chữ');
  await shot(pb1, 'pb-phieu', 'Phản biện: đề bài, lời giải "chưa mở — hãy tự giải trước", phiếu phản biện (mức, đề nghị, nhận xét), đánh dấu xong; thảo luận. Nhận xét có mã độc chỉ hiện như chữ.', true, [{"sel": "#sec-loi_giai", "t": "Lời giải chưa mở: tự giải trước"}, {"sel": ".rv select", "t": "Mức đề nghị"}, {"sel": ".rv .rec", "t": "Đề nghị: chọn / sửa rồi chọn / không chọn"}, {"sel": ".rv textarea", "t": "Nhận xét, rồi Lưu phiếu"}, {"sel": ".rv [data-act=rv-undo]", "t": "Đánh dấu đã xong (phiếu khoá; bỏ đánh dấu để sửa)"}, {"sel": "#cm-new", "t": "Thảo luận với ban biên tập, phản biện khác"}]);
  step = 'phản biện 2: ẩn danh';
  const pb2 = await O(PB2);
  await openProb(pb2, P1);
  const pb2Page = await text(pb2, '#page');
  check(pb2Page.includes('Phản biện 1') && !pb2Page.includes('@'), 'PB2 thấy "Phản biện 1", không thấy email nào');
  check(!(await text(pb2, '#list')).includes(P3), 'PB2 không thấy bài không được giao');
  await pb2.fill('#cm-new', 'Tôi đồng ý với Phản biện 1.'); await pb2.click('#cm-send'); await idle(pb2, 300);
  await shot(pb2, 'pb2-an-danh', 'Phản biện thứ hai: thấy nhận xét của người kia dưới tên "Phản biện 1", của mình là "Bạn", của ban biên tập là "Ban biên tập" — không có email nào.', true, [{"sel": "#cm .cm", "t": "Nhận xét của phản biện khác: ẩn danh", "has": "Phản biện 1", "next": 0}, {"sel": "#cm .cm.pb", "t": "Nhận xét của bạn", "has": "Bạn", "next": 0}, {"sel": "#cm-new", "t": "Viết nhận xét (công thức $…$)"}]);
  step = 'mở lời giải';
  await tab(pt, 'go-rounds');
  await twice(pt, '.rd[data-ky="PB-THU-1"] [data-r=sol]');
  check((await text(pt, '.rd[data-ky="PB-THU-1"]')).includes('đã mở'), 'lời giải đã mở');
  await openProb(pb1, P3); await openProb(pb1, P1);
  check(!(await text(pb1, '#sec-loi_giai')).includes('chưa mở') && (await count(pb1, '#sec-loi_giai .tx.lg')) === 1, 'PB thấy lời giải sau khi mở');
  await shot(pb1, 'pb-loi-giai', 'Sau khi PT bấm "Mở lời giải cho phản biện" (bấm hai lần): phản biện thấy lời giải và vẫn nhận xét tiếp.', true, [{"sel": "#sec-loi_giai .tx.lg", "t": "Lời giải hiện sau khi PT mở"}]);
  step = 'ban biên tập xem phiếu';
  await openProb(pt, P1);
  await pt.click('details.rvs summary'); await idle(pt);
  check((await text(pt, 'details.rvs')).includes(PB1), 'PT thấy phiếu kèm email');
  check((await text(pt, '#cm')).includes(PB1), 'ban biên tập thấy email trong thảo luận');
  await shot(pt, 'pt-xem-phieu', 'Ban biên tập mở bài: phiếu phản biện (mức, đề nghị) và thảo luận kèm email; nhận xét của phản biện viền nâu, của ban biên tập viền xanh.', true, [{"sel": "details.rvs", "t": "Phiếu phản biện: mức, đề nghị, nhận xét, email"}, {"sel": "#cm", "t": "Thảo luận kèm email: phản biện viền nâu, ban biên tập viền xanh"}]);
  step = 'NCB, TBT chỉ xem kỳ';
  await tab(ncbA, 'go-rounds');
  check((await count(ncbA, '[data-r=close],[data-r=assign]')) === 0, 'NCB chỉ xem tiến độ kỳ');
  step = 'đóng kỳ';
  await tab(pt, 'go-rounds');
  await twice(pt, '.rd[data-ky="PB-THU-1"] [data-r=close]');
  check((await text(pt, 'details.closed-rounds summary')).includes('Kỳ đã đóng (1)'), 'kỳ đã đóng gộp vào "Kỳ đã đóng"');
  await pb1.evaluate(() => loadList()); await idle(pb1);
  check((await count(pb1, '#list .card')) === 0, 'đóng kỳ: phản biện không còn thấy bài');

  /* ---------- 6. Hình ---------- */
  section('6. Hình vẽ TikZ', 'NCB vẽ lại hình bằng TikZ; hình được dựng thành SVG trên máy (tools/hinh/build.py) rồi tải lên trang Hình.');
  step = 'sửa hình';
  const TIKZ = '\\begin{tikzpicture}\\draw (0,0) node[below]{$A$} -- (4,0) node[below]{$B$} -- (0,3) node[above]{$C$} -- cycle;\\end{tikzpicture}';
  await openProb(ncbA, P4);
  await ncbA.click('#sec-hinh [data-edit]'); await ncbA.fill('#sec-hinh textarea', TIKZ); await idle(ncbA, 600);
  check((await text(ncbA, '#sec-hinh .pv')).includes('chưa dựng'), 'xem trước: "chưa dựng"');
  await ncbA.click('#sec-hinh [data-a=save]'); await idle(ncbA, 300);
  await ncbA.click('#sec-hinh [data-edit]'); await ncbA.fill('#sec-hinh textarea', TIKZ.replace('\\draw', '\\input{x}\\draw'));
  await ncbA.click('#sec-hinh [data-a=save]'); await idle(ncbA);
  check((await toastText(ncbA)).includes('input'), 'TikZ có \\input bị từ chối');
  await clearToasts(ncbA);
  await ncbA.click('#sec-hinh [data-a=cancel]'); await ncbA.click('#sec-hinh [data-a=cancel]'); await idle(ncbA);
  step = 'trang Hình';
  await tab(ncbA, 'go-figs');
  check((await text(ncbA, '#figs table')).includes(P4) && (await text(ncbA, '#figs table')).includes('chưa dựng'), 'trang Hình: bài có hình chưa dựng');
  const [dl] = await Promise.all([ncbA.waitForEvent('download'), ncbA.click('[data-f=src]')]);
  const zip = fs.readFileSync(await dl.path());
  const key = c.figKey_(TIKZ);
  check(zip.includes(Buffer.from('tikz-' + key + '.tex')), 'zip mã nguồn có tikz-' + key + '.tex');
  await shot(ncbA, 'hinh', 'Trang Hình: các hình TikZ chưa dựng; tải mã nguồn (.zip) → dựng trên máy → tải SVG lên. Không dựng hình của đề chưa đăng trên trang LaTeX trực tuyến.', true, [{"sel": "[data-f=src]", "t": "Tải mã các hình chưa dựng (.zip)"}, {"sel": "#figs ol li", "t": "Dựng trên máy (MacTeX)", "has": "build.py", "next": 0}, {"sel": "#f-up", "t": "Chọn hinh-svg.zip"}, {"sel": "[data-f=up]", "t": "Tải SVG lên"}, {"sel": "#figs table", "t": "Hình chưa dựng / đã dựng"}]);
  const FIGSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="160" viewBox="-10 -10 200 160"><path d="M0,130 L160,130 L0,10 Z" fill="none" stroke="#000" stroke-width="1.5"/>' +
    '<text x="-8" y="146" font-size="14">A</text><text x="160" y="146" font-size="14">B</text><text x="-6" y="6" font-size="14">C</text></svg>';
  await ncbA.setInputFiles('#f-up', { name: 'tikz-' + key + '.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(FIGSVG) });
  await ncbA.click('[data-f=up]'); await idle(ncbA, 300);
  check((await text(ncbA, '#f-res')).includes('Đã lưu 1 hình'), 'tải SVG lên: đã lưu');
  await openProb(ncbA, P4);
  check((await count(ncbA, '#sec-hinh img, #sec-hinh svg:not(.ic)')) >= 1, 'hình hiện trên trang bài');
  await shot(ncbA, 'hinh-tren-trang', 'Sau khi tải SVG lên: hình hiện ngay trên trang bài (cho cả phản biện được giao).', false, [{"sel": "#sec-hinh", "t": "Hình đã dựng hiện ngay trên trang bài"}]);
  step = 'dựng tự động (GitHub giả)';
  const TIKZ2 = TIKZ.replace('(4,0)', '(5,0)');
  await openProb(ncbA, P3);
  await ncbA.click('#sec-hinh [data-edit]'); await ncbA.fill('#sec-hinh textarea', TIKZ2); await ncbA.click('#sec-hinh [data-a=save]'); await idle(ncbA, 300);
  const gh = c.TEST_CONF.GH_FAKE = c.fakeGitHub_();
  await tab(ncbA, 'go-figs');
  check((await text(ncbA, '#figs')).includes('Dựng tự động'), 'có mục Dựng tự động khi đã cài GitHub');
  await ncbA.click('[data-f=sync]'); await idle(ncbA, 300);
  check((await text(ncbA, '#f-sync')).includes('gửi 1 hình'), 'Dựng ngay: gửi một hình: ' + (await text(ncbA, '#f-sync')));
  const k2 = c.figKey_(TIKZ2);
  check(gh.files()['hang-doi/tikz-' + k2 + '.tex'] === TIKZ2, 'kho chỉ nhận mã TikZ của hình');
  gh.workflow({ a: FIGSVG }, { a: k2 });          // như GitHub Actions dựng xong
  await ncbA.click('[data-f=sync]'); await idle(ncbA, 300);
  check((await text(ncbA, '#f-sync')).includes('Đã lấy 1 hình'), 'lấy SVG về');
  await shot(ncbA, 'dung-tu-dong', 'Dựng tự động (GitHub, kho riêng tư): hình mới hay vừa sửa được dựng sau vài phút, không cần làm gì; nút "Dựng ngay" để khỏi chờ. Hình lỗi hiện kèm thông báo của LaTeX.', false, [{"sel": "[data-f=sync]", "t": "Dựng ngay (không cần chờ)"}, {"sel": "#f-sync", "t": "Kết quả: đã lấy / đã gửi / đang dựng"}]);
  delete c.TEST_CONF.GH_FAKE;

  /* ---------- 7. Bảng chọn bài ---------- */
  section('7. Bảng chọn bài', 'PT xếp 10 bài (4 mức B, 6 mức A) cho một số báo và gửi TBT; TBT trả lại (có lý do) hoặc duyệt — bài được chọn thành SL-OK.');
  await tab(pt, 'go-boards');
  await pt.fill('#b-so', '12/2030'); await pt.click('[data-b=new]'); await idle(pt, 300);
  step = 'xếp bài';
  check(await pt.$eval('[data-b=submit]', b => b.disabled), 'chưa đủ bài: chưa gửi được');
  for (let i = 0; i < 10; i++) { await pt.selectOption('select[data-pos="' + (i + 1) + '"]', BOARD[i].ma_bai); await idle(pt, 200); }
  check(!(await pt.$eval('[data-b=submit]', b => b.disabled)), 'đủ 10 bài: gửi được');
  await pt.click('[data-b=down][data-pos="1"]'); await idle(pt, 300);
  await shot(pt, 'bang-chon-bai', 'Bảng chọn bài: mỗi vị trí có mức; cột Phiếu phản biện tóm tắt các phiếu, cột Lưu ý báo bài còn mục cần kiểm tra / xung đột / khác mức; ↑ ↓ đổi chỗ, × bỏ bài.', true, [{"sel": "#b-so", "t": "Lập bảng cho một số báo"}, {"sel": ".bd table.as", "t": "Xếp bài vào từng vị trí (mức của vị trí)"}, {"sel": "[data-b=down][data-pos=\"2\"]", "t": "↑ ↓ đổi chỗ, × bỏ bài"}, {"sel": "[data-b=submit]", "t": "Đủ bài: Gửi TBT duyệt"}]);
  await pt.click('[data-b=submit]'); await idle(pt, 300);
  step = 'TBT trả lại';
  const tbt = await O(TBT);
  await tab(tbt, 'go-boards');
  await tbt.click('[data-b=return]'); await tbt.fill('.inl textarea', 'Đổi chỗ hai bài đầu'); await tbt.click('.inl [data-k=ok]'); await idle(tbt, 300);
  check((await text(tbt, '.bd .head')).includes('đang chọn'), 'trả lại: bảng về "đang chọn"');
  await tab(pt, 'go-list'); await tab(pt, 'go-boards');
  check((await text(pt, '.bd')).includes('Đổi chỗ hai bài đầu'), 'PT thấy lý do trả lại');
  await pt.click('[data-b=up][data-pos="2"]'); await idle(pt, 300); await pt.click('[data-b=submit]'); await idle(pt, 300);
  step = 'TBT duyệt';
  await tab(tbt, 'go-list'); await tab(tbt, 'go-boards');
  await shot(tbt, 'tbt-duyet', 'TBT mở bảng đang chờ duyệt: Duyệt (bấm hai lần) hoặc Trả lại (phải ghi lý do, PT sẽ thấy).', false, [{"sel": "[data-b=approve]", "t": "Duyệt — bấm hai lần; bài thành SL-OK"}, {"sel": "[data-b=return]", "t": "Hoặc Trả lại, ghi lý do cho PT"}]);
  await twice(tbt, '[data-b=approve]');
  check((await text(tbt, '.bd .head')).includes('đã duyệt'), 'bảng đã duyệt');
  await tab(tbt, 'go-list'); await tbt.selectOption('#f-status', 'SL-OK'); await idle(tbt);
  check((await count(tbt, '#list .card')) >= 10, 'mười bài thành SL-OK');
  await tbt.selectOption('#f-status', '_mo');

  /* ---------- 8. Khoá kỳ ---------- */
  section('8. Khoá kỳ và gói chế bản', 'TBT khoá kỳ: đánh số in, ghi vào Published, bài chuyển PL; tệp .tex chỉ có đề bài cho BTK.');
  await tab(tbt, 'go-boards');
  await tbt.click('[data-b=close]'); await idle(tbt, 300);
  check(await tbt.$eval('.kk [data-k=lock]', b => b.disabled), 'chưa có số in: chưa khoá được');
  await tbt.fill('.kk [data-k=start]', '9001'); await tbt.click('.kk [data-k=redo]'); await idle(tbt, 300);
  check((await text(tbt, '.kk table')).includes('P9001') && (await text(tbt, '.kk table')).includes('P9010'), 'số in P9001–P9010');
  const [dt] = await Promise.all([tbt.waitForEvent('download'), tbt.click('.kk [data-k=dl]')]);
  const texOut = fs.readFileSync(await dt.path(), 'utf8');
  const body = texOut.split('\\begin{document}')[1] || '';   // phần đầu tệp định nghĩa \\lgi — chỉ xét thân tệp
  check(/\\thachthuc/.test(body) && !/Lời giải|\\lgi\b/.test(body) && !body.includes('@'), '.tex chỉ có đề bài, không lời giải, không liên hệ');
  check(texOut.includes('Trần Văn Bịa'), '.tex có dòng tác giả');
  await shot(tbt, 'khoa-ky', 'Khoá kỳ: số in bắt đầu (gợi ý = số lớn nhất đã in + 1), thứ tự in, dòng tác giả, lưu ý; tải .tex xem trước; Khoá kỳ bấm hai lần, không hoàn tác được.', true, [{"sel": ".kk [data-k=start]", "t": "Số in bắt đầu"}, {"sel": ".kk [data-k=redo]", "t": "Đánh lại số"}, {"sel": ".kk table", "t": "Thứ tự in, dòng tác giả, lưu ý"}, {"sel": ".kk [data-k=dl]", "t": "Tải .tex xem trước"}, {"sel": ".kk [data-k=lock]", "t": "Khoá kỳ — bấm hai lần, không hoàn tác được"}]);
  if (await tbt.$('.kk [data-k=ack]')) await tbt.check('.kk [data-k=ack]');
  await twice(tbt, '.kk [data-k=lock]');
  check((await text(tbt, '.bd .head')).includes('đã khoá'), 'bảng đã khoá');
  check((await count(tbt, '[data-b=reopen]')) === 0, 'đã khoá: không mở lại được');
  step = 'BTK';
  const btk = await O(BTK);
  await tab(btk, 'go-boards');
  check((await count(btk, '[data-b=tex]')) === 1 && (await count(btk, '[data-b=new],[data-b=close],[data-b=approve]')) === 0, 'BTK chỉ tải tệp .tex');
  await shot(btk, 'btk', 'BTK (chế bản) chỉ xem bảng và tải tệp .tex của số đã khoá; gói đầy đủ (.tex + hình) nằm trong thư mục chế bản trên Drive.', false, [{"sel": "[data-b=tex]", "t": "Tải tệp .tex của số đã khoá"}]);

  /* ---------- 9. Điện thoại, chế độ tối ---------- */
  section('9. Điện thoại và chế độ tối', 'Cùng trang trên điện thoại (390 px) và khi máy đặt chế độ tối.');
  const ph = await O(PB2, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ph.evaluate(() => loadList()); await idle(ph);
  const qtp = await O(QT, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  check(!(await qtp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'điện thoại: không cuộn ngang (danh sách)');
  await shot(qtp, 'dien-thoai-danh-sach', 'Điện thoại: danh sách.', false);
  await openProb(qtp, P1);
  check(!(await qtp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'điện thoại: không cuộn ngang (trang bài)');
  await shot(qtp, 'dien-thoai-bai', 'Điện thoại: trang bài (công thức dài cuộn ngang riêng trong khung).', false);
  const dk = await O(QT, { colorScheme: 'dark' });
  await openProb(dk, P1);
  await shot(dk, 'che-do-toi', 'Chế độ tối (theo cài đặt của máy).', false);

  /* ---------- tổng kết ---------- */
  for (const p of pages) for (const x of p.errs) fails.push('lỗi trên trang của ' + p.who + ': ' + x);
  await br.close();
  if (SHOTS) writeTour();
  if (!mathjax) console.log('(chưa có node_modules/mathjax — công thức không dựng trong ảnh; chạy npm install)');
  if (fails.length) { console.log('\nGIAO DIỆN: ' + fails.length + ' lỗi:\n  ' + fails.join('\n  ')); process.exit(1); }
  console.log('giao diện: mọi bước đều đạt' + (SHOTS ? ' — ảnh và hướng dẫn: out/ui/index.html' : ''));
})().catch(x => { console.error('GIAO DIỆN DỪNG ở ' + chapter + ' › ' + step + ':', x.message || x); process.exit(1); });

/** Chromium của Playwright nếu đã tải (npx playwright install chromium); không có thì dùng Google Chrome đã cài trên máy. */
async function launchBrowser() {
  const own = fs.existsSync('/opt/pw-browsers/chromium') && !process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: '/opt/pw-browsers/chromium' } : {};
  try { return await chromium.launch(own); }
  catch (e) {
    if (!/Executable doesn't exist|playwright install/i.test(String(e.message))) throw e;
    try { const b = await chromium.launch({ channel: 'chrome' }); console.log('(dùng Google Chrome của máy)'); return b; }
    catch (e2) { console.log('bỏ qua: không có trình duyệt — cài Google Chrome, hoặc: npx playwright install chromium'); process.exit(0); }
  }
}

function writeTour() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let h = '', toc = '', n = 0;
  tour.forEach(t => {
    if (t.chapter) { n++; toc += '<li><a href="#c' + n + '">' + esc(t.chapter) + '</a></li>'; h += '<h2 id="c' + n + '">' + esc(t.chapter) + '</h2><p class="intro">' + esc(t.intro) + '</p>'; return; }
    h += '<figure' + (t.view ? ' class="phone"' : '') + '><img loading="lazy" src="' + t.img + '" alt=""><figcaption><span class="who">' + esc(t.who) +
         (t.view ? ' · ' + t.view : '') + '</span>' + esc(t.caption) +
         (t.steps.length ? '<ol class="steps">' + t.steps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>' : '') + '</figcaption></figure>';
  });
  fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Đề ra kỳ này — quy trình bằng hình</title><style>
:root{--bg:#f6f6f2;--fg:#1d1d1b;--mut:#5f5f58;--acc:#175f37;--card:#fff;--line:#deded6}
@media (prefers-color-scheme:dark){:root{--bg:#161715;--fg:#e9e9e4;--mut:#a3a39b;--acc:#6cc08f;--card:#20211f;--line:#34352f}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 80px}h1{font-size:26px;margin:0 0 4px}h2{margin:48px 0 4px;color:var(--acc);font-size:21px}
.intro,.sub{color:var(--mut);margin:0 0 16px}figure{margin:0 0 28px;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
figure img{display:block;width:100%;height:auto;border-bottom:1px solid var(--line)}figure.phone{max-width:420px}
figcaption{padding:10px 14px}.who{display:inline-block;font:12px ui-monospace,monospace;color:var(--acc);margin-right:8px}
ol{columns:2;color:var(--mut)}ol.steps{columns:1;color:var(--fg);list-style:none;padding:0;margin:8px 0 0;counter-reset:s}
ol.steps li{counter-increment:s;margin:4px 0;padding-left:34px;position:relative}
ol.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:24px;height:24px;border-radius:50%;background:#e8590c;color:#fff;font:700 13px/24px system-ui,sans-serif;text-align:center}a{color:var(--acc)}@media (max-width:640px){ol{columns:1}}
</style></head><body><main><h1>Đề ra kỳ này — quy trình bằng hình</h1>
<p class="sub">Ảnh chụp tự động từ trang thật (kiểm thử giao diện, tests/ui/run.js), dữ liệu bịa. Tạo lúc ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.</p>
<ol>${toc}</ol>${h}</main></body></html>`);
}
