/**
 * DỰNG HÌNH TỰ ĐỘNG (giai đoạn 2): GitHub Actions trong kho RIÊNG TƯ (Script properties GITHUB_REPO, GITHUB_TOKEN).
 *
 *   1. Hệ thống đẩy mã TikZ của các hình chưa dựng lên hang-doi/tikz-<mã>.tex — chỉ khối tikzpicture, không có đề, lời giải hay tác giả.
 *   2. GitHub Actions (kho riêng, .github/workflows/dung-hinh.yml) dựng bằng tools/hinh/build.py → svg/tikz-<mã>.svg hoặc loi/tikz-<mã>.txt.
 *   3. Hệ thống lấy SVG về thư mục hình (kiểm tra như khi tải lên tay), ghi nhận lỗi, xoá các tệp đó khỏi kho.
 *
 * Chạy khi: lưu một bài có TikZ (hẹn sau 1 phút), nút "Dựng ngay" ở trang Hình, mỗi giờ (trigger kiểm thử tự động), và tự hẹn lại
 * mỗi 3 phút khi còn hình đang chờ GitHub. Chưa đặt GITHUB_REPO / GITHUB_TOKEN thì không làm gì — dựng tay như cũ (tools/hinh/build.py).
 * Mã thông báo: fine-grained, chỉ kho đó, quyền Contents đọc/ghi. Kiểm thử thay GitHub bằng TEST_CONF.GH_FAKE.
 */
var FIG_SYNC_HANDLER = 'dongBoHinh';
var FIG_SYNC_STATE = 'FIG_CLOUD_STATE';      // {cho: [mã đang chờ GitHub], loi: {mã: lỗi}, luc, lan}
var FIG_SYNC_MAX_ROUNDS = 10;                // ~30 phút chờ GitHub rồi thôi tự hẹn

function figCloudOn_() { return TEST_CONF ? !!TEST_CONF.GH_FAKE : !!(conf_('GITHUB_REPO') && conf_('GITHUB_TOKEN')); }
// trạng thái: Script property; khi kiểm thử thì giữ trong TEST_CONF (không đụng property thật)
function figCloudState_() {
  if (TEST_CONF) return JSON.parse(TEST_CONF.FIG_CLOUD_STATE || '{}');
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(FIG_SYNC_STATE) || '{}'); } catch (e) { return {}; }
}
function figCloudSave_(s) {
  if (TEST_CONF) { TEST_CONF.FIG_CLOUD_STATE = JSON.stringify(s); return; }
  PropertiesService.getScriptProperties().setProperty(FIG_SYNC_STATE, JSON.stringify(s));
}

/** Một lời gọi GitHub REST. GET không có (404) → null. */
function gh_(method, path, body) {
  if (TEST_CONF && TEST_CONF.GH_FAKE) return TEST_CONF.GH_FAKE(method, path, body);
  var res = UrlFetchApp.fetch('https://api.github.com/repos/' + conf_('GITHUB_REPO') + path, {
    method: method, muteHttpExceptions: true, contentType: 'application/json', payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + conf_('GITHUB_TOKEN'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  var code = res.getResponseCode(), txt = res.getContentText();
  if (code === 404 && method === 'get') return null;
  if (code >= 300) throw new Error('GitHub trả lời ' + code + ' (' + method.toUpperCase() + ' ' + path + '): ' + txt.slice(0, 200));
  return txt ? JSON.parse(txt) : {};
}
function ghList_(dir) { return (gh_('get', '/contents/' + dir + '?ref=main') || []).filter(function (f) { return f.type === 'file'; }); }
function ghText_(path) {
  var f = gh_('get', '/contents/' + path + '?ref=main');
  return f ? Utilities.newBlob(Utilities.base64Decode(String(f.content).replace(/\s/g, ''))).getDataAsString('UTF-8') : null;
}
/** Một commit: changes = {đường dẫn: nội dung | null (xoá)}. Người khác vừa đẩy (GitHub Actions) thì đọc lại và thử lần nữa. */
function ghCommit_(changes, msg) {
  var paths = Object.keys(changes);
  if (!paths.length) return;
  for (var k = 0; ; k++) {
    var base = gh_('get', '/git/ref/heads/main').object.sha, commit = gh_('get', '/git/commits/' + base);
    var tree = gh_('post', '/git/trees', { base_tree: commit.tree.sha, tree: paths.map(function (p) {
      return changes[p] == null ? { path: p, mode: '100644', type: 'blob', sha: null } : { path: p, mode: '100644', type: 'blob', content: changes[p] }; }) });
    var c = gh_('post', '/git/commits', { message: msg, tree: tree.sha, parents: [base] });
    try { gh_('patch', '/git/refs/heads/main', { sha: c.sha, force: false }); return; }
    catch (e) { if (k >= 2) throw e; }
  }
}

/** Mọi khối TikZ của mọi bài: mã → mã nguồn (không theo người xem — việc của hệ thống). */
function allTikz_() {
  var out = {};
  rows_('Problems').forEach(function (p) {
    [p.de_bai, p.loi_giai, p.hinh].forEach(function (t) { tikzBlocks_(t).forEach(function (b) { out[figKey_(b)] = b; }); });
  });
  return out;
}

/**
 * Đồng bộ với kho GitHub: lấy SVG / lỗi đã dựng về, đẩy hình chưa dựng lên. Trả về {lay: [mã], gui: [mã], cho: [mã], loi: {mã: lỗi}}.
 * Gọi lặp lại không sao: hình đang chờ không bị đẩy hai lần; SVG của hình không còn trong bài nào chỉ bị xoá khỏi kho.
 */
function syncFigures_() {
  if (!figCloudOn_()) return { tat: true };
  var tikz = allTikz_(), idx = figIndex_(), folder = figFolder_(), st = figCloudState_();
  var loi = st.loi || {}, changes = {}, lay = [], gui = [];
  ghList_('svg').forEach(function (f) {
    var m = f.name.match(/^tikz-([0-9a-f]{16})\.svg$/);
    changes[f.path] = null;
    if (!m || !tikz[m[1]] || idx[f.name]) return;
    var text = ghText_(f.path), err = text == null ? 'không đọc được' : text.length > FIG_SVG_MAX_ ? 'tệp quá lớn' : svgError_(text);
    if (err) { loi[m[1]] = 'SVG không nhận: ' + err; return; }
    idx[f.name] = folder.createFile(Utilities.newBlob(text, 'image/svg+xml', f.name));
    delete loi[m[1]];
    lay.push(m[1]);
  });
  ghList_('loi').forEach(function (f) {
    var m = f.name.match(/^tikz-([0-9a-f]{16})\.txt$/);
    changes[f.path] = null;
    if (m && tikz[m[1]] && !idx['tikz-' + m[1] + '.svg']) loi[m[1]] = String(ghText_(f.path) || 'lỗi').trim().slice(0, 500);
  });
  var waiting = {};
  ghList_('hang-doi').forEach(function (f) { var m = f.name.match(/^tikz-([0-9a-f]{16})\.tex$/); if (m) waiting[m[1]] = true; });
  Object.keys(tikz).forEach(function (k) {
    if (idx['tikz-' + k + '.svg'] || loi[k] || waiting[k]) return;
    changes['hang-doi/tikz-' + k + '.tex'] = tikz[k];
    waiting[k] = true; gui.push(k);
  });
  Object.keys(loi).forEach(function (k) { if (!tikz[k]) delete loi[k]; });   // hình đã sửa / bỏ: quên lỗi cũ
  ghCommit_(changes, gui.length ? 'Chờ dựng ' + gui.length + ' hình' : 'Đã lấy ' + lay.length + ' hình');
  var cho = Object.keys(waiting);
  st = { cho: cho, loi: loi, luc: now_(), lan: cho.length ? (gui.length || lay.length ? 0 : (st.lan || 0) + 1) : 0 };
  figCloudSave_(st);
  if (lay.length || gui.length) audit_('hệ thống', 'dựng hình (GitHub)', 'lấy ' + lay.length + ', gửi ' + gui.length + ', chờ ' + cho.length);
  return { lay: lay, gui: gui, cho: cho, loi: loi, lan: st.lan };
}

/** Hẹn đồng bộ sau n phút (thay lần hẹn cũ). Lỗi tạo trigger không làm hỏng việc đang làm. */
function scheduleFigSync_(minutes) {
  if (!figCloudOn_() || (TEST_CONF && !TEST_CONF.GH_TRIGGERS)) return false;
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === FIG_SYNC_HANDLER) ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger(FIG_SYNC_HANDLER).timeBased().after(minutes * 60 * 1000).create();
    return true;
  } catch (e) { return false; }
}

/** Trigger hẹn giờ: đồng bộ; còn hình chờ GitHub thì hẹn lại sau 3 phút (tối đa FIG_SYNC_MAX_ROUNDS lần không có gì mới). */
function dongBoHinh(e) {
  if (!fromTrigger_(e)) adminOnly_();
  var r = syncFigures_();
  if (r.cho && r.cho.length && r.lan < FIG_SYNC_MAX_ROUNDS) scheduleFigSync_(3);
}

/** Lời gọi có đến từ một trigger của dự án không (mã trigger không lộ ra ngoài, nên không giả được qua google.script.run). */
function fromTrigger_(e) {
  if (!e || !e.triggerUid) return false;
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(e.triggerUid); });
}

/** Nút "Dựng ngay" ở trang Hình (NCB, PT, Quản trị). */
function figureSync_(w) {
  need_(w, FIG_MANAGERS);
  if (!figCloudOn_()) throw new Error('Chưa bật dựng hình tự động (Script properties GITHUB_REPO, GITHUB_TOKEN — docs/setup.md mục 12).');
  var r = syncFigures_();
  if (r.cho.length) scheduleFigSync_(3);
  return r;
}

/** Sau khi lưu văn bản có TikZ: hẹn đồng bộ sau 1 phút (không làm chậm lần lưu). */
function figTouched_(text) { if (/\\begin\{tikzpicture\}/.test(String(text || ''))) scheduleFigSync_(1); }
