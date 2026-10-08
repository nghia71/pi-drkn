# Kiểm thử hệ thống Đề ra kỳ này

Mục đích: xác nhận điều mà mỗi người — Quản trị, người chuẩn bị bài, phản biện, người lạ — **thật sự thấy và làm được**,
chỉ với quyền mà người đó có. Không phải để săn lỗi mới, mà để mỗi lần sửa mã không làm hỏng điều đã đúng.

## Ba lớp kiểm thử

| Lớp | Chạy ở đâu | Cách chạy | Thời gian |
|---|---|---|---|
| 1. Trên máy | máy quản trị, không cần Google | `scripts/test-all.sh` — **tự chạy** trong `scripts/deploy.sh` (lỗi thì không đẩy mã) và trên GitHub mỗi lần đẩy | ~2 phút |
| 2. Trên Google | dự án Apps Script thật, Sheet kiểm thử riêng | **tự chạy** (`installAutoTests`, một lần): `runSmoke` sau mỗi lần triển khai, toàn bộ mỗi đêm; thư chỉ khi có lỗi | 3–4 phút / ~30 phút |
| 3. Bằng tay | trình duyệt, tài khoản Google thật | chỉ những gì máy không làm được — bảng ở đầu Lớp 3 | ~30 phút, một lần |

Lớp 1 và 2 chạy **cùng một bộ kịch bản** (`apps/main/Tests.gs`, 118 kịch bản): lớp 1 trên bản mô phỏng Apps Script
(`tools/gas-sim`), lớp 2 trên Google thật. Lớp 1 cũng kiểm tra kho mã không chứa dữ liệu (`scripts/guard.py`),
bộ hiển thị công thức (`tests/render.test.js`), **giao diện** (`tests/ui/run.js`: trang thật trong Chromium, mỗi vai trò một cửa sổ, đi hết
các quy trình — xem dưới) và hai địa chỉ web nhìn từ bên ngoài (`tests/http.test.js`).
Lớp 3 là những gì máy không làm thay được: màn hình xin quyền của Google, đăng nhập thật bằng từng tài khoản,
công thức hiện ra trên màn hình, điện thoại.

Mọi kịch bản tự động dùng **dữ liệu bịa**. Lớp 2 ghi vào Sheet "Pi ĐRKN — kiểm thử", không chạm Sheet thật.
Lớp 3 dùng ba **bài luyện tập** THU-01…03 nằm trong Sheet thật nhưng chỉ Quản trị và người được giao thấy.

## Tài khoản

| Vai | Tài khoản | Dùng để |
|---|---|---|
| QT | nghia71 (chủ hệ thống) | Quản trị: thấy mọi thứ, "xem như vai trò…", chạy kiểm thử |
| T1 | mcc.tst1 | phản biện được giao THU-01 và THU-02 |
| T2 | mcc.tsttwo | phản biện thứ hai, chỉ được giao THU-02 |
| LẠ | một tài khoản Google bất kỳ không có trong tab Users | thử bị từ chối |

Trong kiểm thử tự động, vai trò của T1, T2 được đổi theo từng kịch bản (PB, NCB, TBT, PT, VP, BTK…) — chỉ trong Sheet kiểm thử.

**Trước khi làm bất cứ bài nào bằng tay, nhìn ảnh đại diện ở góc phải và dòng "Xin chào …" để chắc đang dùng đúng tài khoản.**
Mỗi tài khoản thử dùng một cửa sổ riêng tư riêng (Safari: File → New Private Window), chỉ đăng nhập đúng một tài khoản.

## Cài đặt một lần

1. Dự án chính → Project Settings → Script properties → thêm `TEST_USERS` = địa chỉ đầy đủ của T1 và T2, cách nhau dấu phẩy.
2. Trình soạn thảo dự án chính → chọn `setupTests` → Run. Execution log in địa chỉ Sheet "Pi ĐRKN — kiểm thử".

## Lớp 1 — trên máy

```
scripts/test-all.sh
```
Các phần, mỗi phần phải báo đạt: chặn dữ liệu · bộ hiển thị · máy chủ mô phỏng (118 kịch bản) · gói chế bản và hình (cần MacTeX) ·
giao diện · từ bên ngoài (người chưa đăng nhập Google chỉ thấy trang đăng nhập của Google, kể cả khi dùng liên kết giả).
`scripts/deploy.sh` tự chạy chặn dữ liệu, bộ hiển thị, máy chủ mô phỏng, giao diện và **không đẩy mã** nếu có lỗi.

### Giao diện (tests/ui/run.js)

Cài một lần trên máy: `npm install`. Trình duyệt: Google Chrome đã cài trên máy được dùng tự động; hoặc `npx playwright install chromium`. Không có trình duyệt thì phần này được bỏ qua, không báo lỗi.
Trang thật (`ui/Index.html`) chạy trong Chromium, nối vào máy chủ trên bản mô phỏng, **dữ liệu bịa** (bài năm 2030, địa chỉ @example.com).
Mỗi vai trò một cửa sổ (Quản trị, PT, TBT, NCB, BTK, hai PB) đi hết: danh sách (lọc, sắp xếp, xem thêm / thu gọn, xem như PB) · thêm bài
(tệp .tex, ảnh của đề / lời giải, tác giả mới) · sửa đề, xem trước, hai người cùng sửa, sửa nội dung toán, huỷ, lịch sử · mục cần kiểm tra,
xung đột · Không SL có lý do · kỳ phản biện (mở, xoá kỳ mở nhầm, giao, thư mời, phiếu, ẩn danh, mã độc trong nhận xét, mở lời giải, đóng kỳ) ·
hình TikZ (sửa, chặn \input, tải mã nguồn, tải SVG lên) · bảng chọn bài (xếp, gửi, trả lại, duyệt) · khoá kỳ (số in, .tex chỉ có đề) ·
BTK · điện thoại (không cuộn ngang) · chế độ tối. Sai một bước → báo lỗi, mã thoát 1; trang có lỗi JavaScript hay hộp thoại bật lên cũng là lỗi.

Mỗi lần chạy (không có `--no-shots`) còn chụp màn hình từng bước và ghép thành **trang hướng dẫn bằng hình**: `out/ui/index.html`
(mở bằng trình duyệt; thư mục `out/` không vào kho). Ảnh luôn khớp với giao diện hiện tại vì được chụp lại mỗi lần.

## Lớp 2 — trên Google

**Tự động** (cài một lần): trình soạn thảo dự án chính → chọn `installAutoTests` → Run. Một trigger mỗi giờ:
- thấy bản triển khai mới (`scripts/deploy.sh` ghi mã bản vào `Build.gs`) → chạy `runSmoke`;
- lúc `TEST_HOUR` giờ mỗi đêm (Script property, mặc định 2) → chạy toàn bộ.
**Chỉ gửi thư khi có lỗi** (danh sách kịch bản hỏng) — không có thư nghĩa là đạt; muốn xem: tab "Kết quả" của Sheet kiểm thử.
Mỗi đoạn 6 phút xong thì tự hẹn đoạn tiếp sau 1 phút cho tới hết. Thôi: `removeAutoTests`. Không cần chạy tay sau mỗi lần triển khai.

**Bằng tay** (khi muốn xem ngay): trình soạn thảo dự án chính → chọn `runAllTests` → Run. Kết quả: Execution log (mỗi dòng ĐẠT/LỖI) và tab "Kết quả"
của Sheet kiểm thử. Nếu log báo **TẠM DỪNG** (Apps Script giới hạn 6 phút mỗi lần chạy), bấm Run lần nữa — bộ kiểm thử chạy tiếp
từ chỗ dừng. Chạy riêng một nhóm: `runTests('3')`; một kịch bản: `runTests('3.6')` (chọn hàm `runTests` không truyền được tham số
từ nút Run — dùng `runAllTests`, hoặc tạm thêm một hàm gọi `runTests('3')`).

### Chạy gì, khi nào

Toàn bộ (~118 kịch bản) mất khoảng 30 phút trên Google (mỗi kịch bản dựng lại Sheet kiểm thử) — không cần chạy tay sau mỗi thay đổi.
Lớp 1 đã chạy **đủ** mọi kịch bản trên bản mô phỏng trước mỗi lần đẩy mã; lớp 2 chỉ để bắt chỗ Google khác bản mô phỏng.

| Khi nào | Chạy | Thời gian |
|---|---|---|
| Sau mỗi lần `scripts/deploy.sh` | tự động: `runSmoke` — mỗi phần chính một kịch bản, trong vòng một giờ; thư chỉ khi có lỗi | 3–4 phút |
| Mỗi đêm | tự động: toàn bộ; thư chỉ khi có lỗi | ~30 phút |
| Muốn biết ngay một phần (bảng dưới) | bằng tay, ví dụ một hàm tạm `function t() { runTests('13,14'); }` | vài phút |
| Trước khi khoá kỳ | xem thư đêm qua (không có thư = đạt) | — |

| Tệp sửa | Nhóm |
|---|---|
| `Auth.gs`, `Web.gs` (đăng nhập, phiên) | 1, 2, 7, 12 |
| `Api.gs` (xem, sửa, nhận xét, trạng thái) | 3, 4, 5, 6, 9 |
| `Rounds.gs` (kỳ phản biện, phiếu, thư) | 13 (và 3.4, 3.12) |
| `Board.gs` | 14 |
| `Close.gs` | 15, 16.7, 17.3 |
| `Fig.gs` | 16 |
| `Intake.gs` | 17 |
| `Import.gs`, `Patch.gs` | 8 |
| `resetPractice` (trong `Tests.gs`) | 11 |
| `Db.gs`, `Schema.gs`, `Setup.gs` (dùng chung) | toàn bộ |
| chỉ `ui/` (giao diện) | lớp 1 là đủ (10.1 nếu sửa bộ hiển thị) — rồi xem bằng mắt |

Nhiều nhóm một lúc: `runTests('3,13')`; nhóm và kịch bản lẫn nhau: `runTests('6,13.12')`.

### Danh sách kịch bản tự động
<!-- bảng tự sinh: bắt đầu -->

**1. Vào hệ thống**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 1.1 | Liên kết đăng nhập đúng đưa người dùng vào hệ thống | QT |
| 1.2 | Chữ ký bị sửa thì bị từ chối | LẠ |
| 1.3 | Lấy chữ ký của T1 để vào bằng địa chỉ QT thì bị từ chối | T1 |
| 1.4 | Liên kết quá 10 phút bị từ chối và có nút Đăng nhập lại | QT |
| 1.5 | Đồng hồ lệch vài giây vẫn vào được; liên kết "từ tương lai" 5 phút bị từ chối | QT |
| 1.6 | Mở thẳng địa chỉ ứng dụng chính (không có liên kết) bị từ chối | LẠ |
| 1.7 | Người lạ (không có trong Users) bị từ chối và ghi nhật ký | LẠ |
| 1.8 | Tài khoản tạm ngưng (hoat_dong = FALSE) bị từ chối | T1 |
| 1.9 | Có dòng trong Users nhưng chưa có vai trò thì bị từ chối | T1 |
| 1.10 | Email gõ tay có chữ hoa/khoảng trắng trong Users vẫn nhận ra | T1 |

**2. Phiên làm việc**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 2.1 | Token bịa không gọi được API | LẠ |
| 2.2 | Bị tạm ngưng giữa chừng: lời gọi tiếp theo bị từ chối ngay | T1 |
| 2.3 | Đổi vai trò có hiệu lực ngay, không cần đăng nhập lại | T1 |
| 2.4 | Hai người đăng nhập cùng lúc có phiên riêng | T1+T2 |

**3. Ai thấy gì**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 3.1 | Quản trị thấy mọi bài kèm tên tác giả | QT |
| 3.2 | TBT, PT, VP xem được liên hệ tác giả; NCB, BTK thì không | T1 |
| 3.3 | Phản biện khi chưa có kỳ nào mở: không thấy bài nào | T1 |
| 3.4 | Phản biện chỉ thấy bài được giao trong kỳ đang mở | T1+T2 |
| 3.5 | Phản biện mở bài không được giao — và bài không tồn tại — nhận cùng một câu từ chối | T2 |
| 3.6 | Chấm ẩn danh: dữ liệu gửi cho phản biện không chứa tên tác giả ở bất cứ đâu | T1 |
| 3.7 | Tắt chấm ẩn danh (BLIND_REVIEW=false): phản biện thấy tên tác giả, vẫn không thấy nguồn/xung đột | T1 |
| 3.8 | Phản biện không nhận bản gốc của tác giả, mục cần kiểm tra, sửa đổi | T1 |
| 3.9 | Bộ lọc chủ đề / mức / trạng thái | QT |
| 3.10 | Phân công gõ email có chữ hoa vẫn có hiệu lực | T2 |
| 3.11 | Người có hai vai trò (PB + NCB) nhận quyền rộng hơn | T1 |
| 3.12 | Tải gộp (bundle) cho trang: đúng như từng bài — phản biện chỉ bài được giao, ẩn danh; không có bản gốc | T1+QT |

**4. Sửa đề / lời giải**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 4.1 | Người chuẩn bị bài sửa đề: phiên bản tăng, lưu lịch sử, bản gốc không đổi | T1 |
| 4.2 | Hai người sửa cùng lúc: người lưu sau được báo, không ghi đè | T1+T2 |
| 4.3 | PB, TBT, VP, BTK không sửa được đề | T1 |
| 4.4 | Không ai sửa được bản gốc của tác giả hay trường khác qua API | QT |
| 4.5 | Sửa bài không tồn tại bị từ chối | QT |
| 4.6 | Lịch sử sửa: người chuẩn bị bài xem được (mới nhất trước); phản biện không xem được, kể cả bài được giao | T1+T2 |
| 4.7 | Lưu mà không đổi gì: phiên bản giữ nguyên, không thêm lịch sử | T1 |
| 4.8 | Văn bản quá dài (gần giới hạn một ô của Sheets) bị từ chối, bài không đổi | QT |
| 4.9 | Sửa đề hay đổi trạng thái không biến ô khác bắt đầu bằng "=" thành công thức | T1 |
| 4.10 | Người chuẩn bị bài không sửa được bài luyện tập (không thấy thì không sửa) | T1 |
| 4.11 | Mỗi lần sửa được ghi vào nhật ký (ai, bài, phiên bản) | T1 |
| 4.12 | Sửa nội dung toán: phải có vị trí và lý do; ghi một dòng Sửa đổi "chờ tác giả xác nhận" với đoạn trước/sau | T1 |
| 4.13 | Sửa nhỏ (mặc định) không tạo dòng Sửa đổi | T1 |
| 4.14 | Đoạn trước/sau của sửa đổi chỉ gồm chỗ khác nhau và vài chữ quanh đó | QT |

**5. Thảo luận**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 5.1 | Phản biện nhận xét bài được giao; người khác cùng được giao và quản trị thấy nhận xét | T1+T2 |
| 5.2 | Phản biện không nhận xét được bài không được giao | T2 |
| 5.3 | Nhận xét trống hoặc quá dài bị từ chối | T1 |
| 5.4 | Nhận xét chứa mã độc (<script>, <img onerror>) được lưu nguyên văn nhưng hiển thị vô hại | T1 |
| 5.5 | Nhận xét bắt đầu bằng "=" được lưu như chữ, không thành công thức trong Sheet | T1 |

**6. Mục cần kiểm tra, xung đột, trạng thái**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 6.1 | NCB và TBT thêm mục cần kiểm tra; PB, VP, BTK thì không | T1 |
| 6.2 | Xung đột phải thuộc một trong 7 loại | QT |
| 6.3 | Đổi trạng thái: PT, TBT, Quản trị được; NCB, PB không; trạng thái lạ bị từ chối; có nhật ký | T1 |
| 6.4 | Thao tác không có trong API bị từ chối | QT |
| 6.5 | Đóng mục cần kiểm tra: phải ghi kết quả; NCB, TBT được; PB, VP không; danh sách bớt một chấm | T1 |
| 6.6 | Xung đột mức / tác giả / trùng bài: chỉ TBT ghi cách giải quyết, người khác chỉ chuyển "chờ TBT" | T1 |
| 6.7 | Trạng thái sửa đổi (tác giả đồng ý / không đồng ý): NCB, TBT được; PB không; trạng thái lạ bị từ chối; văn bản không đổi | T1 |
| 6.8 | Thêm mục / xung đột / đổi trạng thái cho bài không tồn tại, bài không được thấy, hoặc nội dung trống: bị từ chối | T1 |
| 6.9 | Trang bài cho biết người xem được làm gì (đổi trạng thái, mục kiểm tra, quyết định của TBT) | T1 |
| 6.10 | Không SL / SL-Fail: phải ghi lý do (lưu thành mục đã đóng của bài); bài Không SL không giao phản biện, không xếp vào bảng; đổi lại được | QT |

**7. Xem như vai trò**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 7.1 | Quản trị "xem như PB" thấy đúng như phản biện, rồi trở lại | QT |
| 7.2 | Người không phải Quản trị không dùng được "xem như" | T1 |
| 7.3 | Vai trò lạ bị từ chối | QT |

**8. Nhập hàng loạt và bản vá**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 8.1 | Nhập hàng loạt hai lần: lần hai bỏ qua hết, tác giả không bị nhân đôi | QT |
| 8.2 | Bản vá: sửa đúng một chỗ, ghi Corrections + Revisions, giữ bản gốc; chạy lại không nhân đôi | QT |
| 8.3 | Bản vá không rõ chỗ sửa (0 hoặc nhiều chỗ khớp) thì báo lỗi, không đổi gì | QT |
| 8.4 | Bản vá sửa đề không biến ô khác bắt đầu bằng "=" thành công thức | QT |
| 8.5 | Nhập: một lần chạy nhập mọi tệp chờ (cũ trước), chạy lại thì báo không còn tệp; tệp mới sau đó được nhập riêng | QT |
| 8.6 | Bản vá "tác giả thay bài": giữ mã, đề/lời giải và bản gốc là bản mới, lịch sử giữ bản cũ; phiếu cũ → mục cần kiểm tra; chạy lại không đổi; bài đã đăng thì không thay | QT |

**9. Nhật ký truy cập**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 9.1 | Mỗi lần mở bài đều ghi vào nhật ký (ai, bài nào) | T1 |

**10. Bộ hiển thị trong Apps Script**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 10.1 | Bộ hiển thị: macro của Pi, công thức, chặn HTML | QT |

**11. Bài luyện tập**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 11.1 | resetPractice tạo 10 bài luyện (4 B, 6 A) + kỳ K-THU, chạy lại không nhân đôi, không chạm bài thật | QT |
| 11.2 | Bài luyện chỉ hiện với Quản trị và người được giao; TBT/NCB không thấy | T1+T2 |
| 11.3 | Hai tài khoản thử (TEST_USERS) mang vai trò ban biên tập thấy mọi bài luyện (B14, B15); với vai trò PB chỉ thấy bài được giao; người khác không thấy | T1+T2 |
| 11.4 | Người dùng thử (PRACTICE_USERS) mang vai trò ban biên tập thấy bài luyện; bỏ khỏi danh sách thì không thấy | T1 |
| 11.5 | Nút Đặt lại bài luyện tập: xoá mọi việc trên bài THU (phiếu, thảo luận, sửa) và kỳ / bảng chỉ gồm bài THU (kể cả tên tự đặt); kỳ, bảng có bài thật giữ nguyên; chỉ Quản trị, PT, TBT đang dùng thử | T1 |

**12. Hàm quản trị**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 12.1 | Khách trên trang web không gọi được setUser, setup, nhập, vá, kiểm thử, resetPractice | T1 |
| 12.2 | Cài đặt lại trên Sheet cũ: tab thiếu cột mới ở cuối (Checks.ket_qua) được thêm tiêu đề, dữ liệu giữ nguyên | QT |
| 12.3 | Sao lưu: bản sao Sheet vào thư mục sao lưu, đủ các tab và dữ liệu; chạy lại cùng ngày thay bản cũ; giữ BACKUP_KEEP bản mới nhất; chỉ chủ chạy tay được | QT |

**13. Kỳ phản biện**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 13.1 | PT mở kỳ: tên trùng, hạn sai dạng hoặc đã qua bị từ chối; chỉ PT, Quản trị mở được; hạn lưu như chữ | T1 |
| 13.2 | Giao bài: chỉ cho người có vai trò PB đang hoạt động; không trùng; không giao vào kỳ đã đóng; PB thấy bài kèm hạn | T1+T2 |
| 13.3 | Thư mời: mỗi phản biện một thư, không có đề / tên tác giả; gửi lại không gửi trùng; thiếu hạn mức thì không gửi gì | QT |
| 13.4 | Phiếu phản biện: chỉ người được giao; phải chọn đề nghị; lưu lại thay phiếu cũ; phản biện khác không thấy; TBT thấy mọi phiếu | T1+T2 |
| 13.5 | Đánh dấu xong: cần phiếu trước; đã xong thì khoá phiếu; bỏ đánh dấu được; PT thấy tiến độ | T1 |
| 13.6 | Nhắc hạn: đúng 3 và 1 ngày trước hạn (đổi được bằng REMINDER_DAYS); mỗi mốc một lần; không nhắc người đã xong hoặc chưa mời | T1+T2 |
| 13.7 | Đóng kỳ: phản biện không còn thấy bài, không nộp phiếu; không giao thêm; chỉ PT, Quản trị đóng được | T1 |
| 13.8 | Thảo luận ẩn danh: phản biện thấy "Bạn", "Phản biện 1", "Ban biên tập" — không có email nào; ban biên tập thấy email | T1+T2 |
| 13.9 | Bỏ giao bài: phản biện mất quyền xem, phiếu đã nộp vẫn giữ; trang Kỳ phản biện của PB chỉ có bài của mình | T1 |
| 13.10 | Đổi hạn: chỉ PT, Quản trị; ngày sai bị từ chối; mốc nhắc tính theo hạn mới | QT |
| 13.11 | Kỳ phản biện tên "10/2026" (dạng ngày) vẫn giữ nguyên chữ qua giao bài, thư mời, đóng kỳ | QT |
| 13.12 | Lời giải: phản biện KHÔNG nhận lời giải (cả trong tải gộp) cho tới khi PT/TBT mở cho kỳ; mở rồi thì thấy; đóng lại thì ẩn; NCB, PB không mở được; ban biên tập luôn thấy | T1 |
| 13.13 | Xoá kỳ: chỉ kỳ chưa có phiếu (xoá cả phân công); kỳ có phiếu chỉ đóng được; chỉ PT, Quản trị | T1 |

**14. Bảng chọn bài**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 14.1 | PT lập bảng cho một số báo; số "10/2026" lưu như chữ; bố cục mặc định 4 bài B rồi 6 bài A; NCB, TBT, PB không lập được | T1 |
| 14.2 | Xếp bài: vị trí ngoài bố cục, bài đã đăng, bài ở bảng khác bị từ chối; đặt vào chỗ có bài thì thay; đặt lại bài đã có thì chuyển chỗ | QT |
| 14.3 | Gửi TBT: phải đủ bài; khi chờ duyệt không sửa được; TBT trả lại phải ghi lý do; số báo không bị đổi thành ngày | T1 |
| 14.4 | TBT duyệt: bài được chọn thành SL-OK và nhận mức của vị trí; bài khác giữ nguyên; PT không duyệt được | T1 |
| 14.5 | Mở lại sau khi duyệt để thay bài: trạng thái, mức trả về như trước; bài bị thay giữ trạng thái cũ; duyệt lại thì bài mới thành SL-OK | T1 |
| 14.6 | Đổi chỗ hai vị trí: thứ tự đổi, mức đi theo vị trí | QT |
| 14.7 | Trang bảng chọn bài: mỗi bài kèm tóm tắt phiếu phản biện, chấm kiểm tra/xung đột và bảng đang giữ bài | QT |

**15. Khoá kỳ**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 15.1 | Xem trước khoá kỳ: chỉ bảng đã duyệt; thứ tự B rồi A, trong mức SH, ĐS, HH, TH; Published trống thì không gợi ý số; NCB, PB, BTK không xem được | QT |
| 15.2 | Số in gợi ý = số lớn nhất trong Published + 1 | QT |
| 15.3 | Khoá kỳ: phải xác nhận lưu ý; ghi Published, bài thành PL kèm số in; bảng "đã khoá", không mở lại, không sửa, không khoá lần hai | T1 |
| 15.4 | Số in trùng với Published hoặc không hợp lệ bị từ chối, không ghi gì | QT |
| 15.5 | Thiếu tên tác giả để in hoặc đề trống thì chặn khoá (dù đã xác nhận) | QT |
| 15.6 | Tệp .tex: chỉ đề bài, theo mẫu cột (setcounter, thụt dòng, dòng tác giả); không lời giải, ghi chú, liên hệ; **đậm**/*nghiêng* ngoài công thức; NFC | QT |
| 15.7 | Hình: TikZ đặt ngay trong tệp; hình ảnh vào pic/ của zip; hình thiếu được báo; BTK tải lại được tệp của số đã khoá | QT |

**16. Hình**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 16.1 | Mã hình (SHA-256 của khối TikZ) khớp tools/hinh/build.py; không phụ thuộc NFC/NFD, \\r\\n | QT |
| 16.2 | Sửa cột Hình: TikZ hoặc tên tệp ảnh; nội dung lạ, lệnh đọc tệp, khối lệch, tên lạ bị từ chối, bài không đổi; PB không sửa được | T1 |
| 16.3 | Trang bài: hình TikZ hiện SVG khi đã dựng (cả khối trong đề bài), "chưa dựng" khi sửa TikZ; ảnh theo tên; tên thiếu được báo; phản biện được giao cũng thấy | T1 |
| 16.4 | Trang Hình: liệt kê hình TikZ (đề, lời giải, cột Hình) và ảnh, đã dựng chưa; chỉ NCB, PT, Quản trị | T1 |
| 16.5 | Tải mã nguồn: zip gồm tikz-<mã>.tex (đúng khối) và danh sách; mặc định chỉ hình chưa dựng; không còn gì thì báo 0 | QT |
| 16.6 | Tải SVG lên: chỉ nhận tikz-<mã>.svg của hình đang có; chặn SVG có mã chạy được hoặc liên kết ngoài; tải lại thì thay; PB, TBT không tải được | T1 |
| 16.7 | Khoá kỳ: cột Hình nhiều tên ảnh → mỗi ảnh một \\includegraphics, cả hai vào pic/ | QT |
| 16.8 | Dựng hình tự động (GitHub, kho giả): gửi đúng mã TikZ của hình chưa dựng, không gửi lại; lấy SVG về thư mục hình, ghi lỗi dựng, chặn SVG có mã chạy được; dọn kho; chưa cài thì không làm gì; PB không bấm được | T1 |

**17. Thêm bài**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 17.1 | Thêm bài: mã = tháng + thư mục kế tiếp còn trống + a, b; tác giả mới (liên hệ chỉ ở Authors); Provenance, nhật ký; NCB, TBT, VP thêm được; PB, BTK thì không | T1 |
| 17.2 | Thêm bài: thiếu chủ đề / đề trống / tháng sai / ảnh sai loại → từ chối, không thêm gì (cả hồ sơ) | QT |
| 17.3 | Ảnh khi thêm bài: ảnh của đề vào cột Hình (in kèm đề), ảnh lời giải chèn cuối lời giải (không in); hiện trên trang; khoá kỳ chỉ đóng gói ảnh của đề, SVG gọi không đuôi | QT |
| 17.4 | Thêm ảnh cho bài đã có: phải đúng phiên bản; ảnh đề vào cột Hình, ảnh lời giải vào lời giải; có lịch sử; cột Hình là TikZ thì không thêm ảnh đề; PB không thêm được | T1 |

**18. **

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 18.1 | Góp ý: mọi người đã vào hệ thống gửi được (mức 1–5 không bắt buộc, kèm trang đang xem, vai trò); trống hoặc mức lạ bị từ chối; chữ bắt đầu bằng "=" lưu như chữ; người chưa vào thì không | T1 |
| 18.3 | Trang Góp ý: chỉ Quản trị xem góp ý và lỗi (mới nhất trước), đổi trạng thái góp ý; người khác bị từ chối | QT |
| 18.4 | Thư tóm tắt mỗi sáng: góp ý và lỗi mới (lỗi gộp theo loại, ai gặp); không có gì mới thì không gửi; mỗi ngày một lần | QT |

**19. **

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 19.1 | Dùng thử: Quản trị bắt đầu (chụp dữ liệu, mọi trang biết đang dùng thử); đưa về: bài, kỳ, bảng, thảo luận như trước; GIỮ người dùng, nhật ký, góp ý, lỗi; số báo "10/2026" vẫn là chữ; chụp trạng thái trước khi đưa về | QT |
| 19.2 | Kết thúc dùng thử: giữ mọi thay đổi, hoặc đưa về rồi kết thúc; sau đó không còn dòng báo, không đưa về được nữa; chỉ Quản trị bắt đầu / kết thúc; TBT đưa về được; người khác không | QT |

<!-- bảng tự sinh: hết -->

Mỗi kịch bản bắt đầu từ dữ liệu bịa mới (5 bài TEST-01…05, một tác giả bịa, kỳ đang mở K-MO, kỳ đã đóng K-DONG).
Kiểm thử đăng nhập đi đúng đường của người dùng thật: tạo liên kết đã ký như ứng dụng đăng nhập, gọi trang chính, lấy phiên trong trang,
rồi gọi API như giao diện.

Bộ kịch bản đã được thử ngược: cố ý gỡ từng lớp bảo vệ (ẩn tác giả, chặn HTML, chặn công thức trong ô, chặn tài khoản ngưng,
hạn 10 phút, kiểm tra phiên bản khi sửa, kiểm tra quyền trước khi tra bài, chặn gọi hàm quản trị từ trang web)
thì đúng các kịch bản tương ứng báo LỖI.

## Lớp 3 — bằng tay, ba tài khoản thật

Phần lớn các bài dưới đây đã **tự động** (lớp 1: giao diện + máy chủ mô phỏng; lớp 2: trên Google). Bằng tay chỉ còn những gì cần
Google thật, hộp thư thật, máy Mac hay điện thoại thật — làm **một lần** để quen hệ thống, rồi chỉ làm lại khi phần đó thay đổi.

| Bài | Đã tự động | Còn làm tay |
|---|---|---|
| B1 | 1.1–1.10 | màn hình xin quyền của Google, đăng nhập thật |
| B2, B3, B4 | giao diện mục 5; 3.4, 5.1, 5.4, 5.5 | — |
| B5 | 1.7 | người lạ thật qua Google (một lần) |
| B6 | 2.2 | — |
| B7 | — | trình duyệt có nhiều tài khoản Google: nhìn dòng "Xin chào" |
| B8 | 1.4 | — |
| B9 | giao diện mục 1; 7.1–7.3 | — |
| B10 | bộ hiển thị; giao diện mục 9 | công thức của **bài thật**, trên điện thoại thật |
| B11, B12 | giao diện mục 3, 4; nhóm 4, 6 | — |
| B13 | giao diện mục 5; nhóm 13 | thư mời và thư nhắc **đến hộp thư thật** (bước 3–4, 8) |
| B14 | giao diện mục 7; nhóm 14 | — |
| B15 | giao diện mục 8; nhóm 15; tests/khoaky.test.py | gói trên Drive → `tools/khoaky/build.py` trên Mac, xem PDF (bước 6) |
| B16 | giao diện mục 6; nhóm 16; tests/hinh.test.py | dựng hình thật trên Mac (bước 4) — hoặc tự động qua GitHub (setup.md) |
| B17 | giao diện mục 2, 5; nhóm 17 | — |

### Bài luyện tập và nút đặt lại

Trình soạn thảo dự án chính → chọn `resetPractice` → Run. Việc này:
- xoá mọi dòng THU-… (bài, bảng chọn bài, số in đã ghi…) và kỳ K-THU cũ, rồi tạo lại mười bài luyện (bịa) THU-01 … THU-10
  (THU-01…THU-04 mức B, THU-05…THU-10 mức A — đủ một bảng chọn bài 10 vị trí);
- mở kỳ luyện tập K-THU: THU-01 → T1; THU-02 → T1 và T2; THU-03 … THU-10 → không ai;
- bài luyện chỉ hiện với Quản trị, với người được giao, và với hai tài khoản thử (TEST_USERS) khi họ mang vai trò ban biên tập
  (PT, TBT, NCB, VP, BTK) — vì thế ở B14, B15 T1 (PT), T2 (TBT) thấy đủ THU-01 … THU-10; người thật của ban biên tập không thấy bài luyện;
- đặt T1, T2 làm PB.

Không bài thật nào bị đụng tới. Ban biên tập (TBT, NCB…) không thấy bài luyện; chỉ Quản trị và người được giao thấy.
Đợt dùng thử với người thật: thêm email của họ vào Script property `PRACTICE_USERS` (cách nhau dấu phẩy) — với vai trò ban biên tập
họ thấy đủ mười bài luyện; xoá khi xong (`docs/moi-dung-thu/README.md`).
**Chạy `resetPractice` trước mỗi buổi kiểm thử tay.**

Địa chỉ dùng trong mọi bài: **đường dẫn đăng nhập** (địa chỉ /exec của dự án đăng nhập). Không dùng địa chỉ của ứng dụng chính.

---

### B1 — Phản biện đăng nhập lần đầu
**Tình huống.** Một phản biện mới nhận đường dẫn qua email và mở lần đầu.
**Trước khi bắt đầu.** `resetPractice`. Nếu T1 đã từng cho phép ứng dụng: myaccount.google.com → Security → Third-party apps →
"Pi – Đề ra kỳ này (đăng nhập)" → Remove access (để thấy lại màn hình xin quyền).
**Các bước.**
1. *(T1, cửa sổ riêng tư)* Đăng nhập Google bằng T1, mở đường dẫn đăng nhập.
2. *(T1)* Màn hình Google "… wants to access your Google Account": chỉ xin **xem địa chỉ email**. Bấm Allow/Continue.
3. *(T1)* Trang "Xin chào <T1>" và nút **Vào hệ thống**. Bấm nút.
**Vì sao quan trọng.** Đây là cửa vào của mọi người; Google chỉ cho ứng dụng biết email, không gì khác.
**Bạn sẽ thấy.** Danh sách đúng hai bài THU-01 và THU-02, không có tên tác giả; dòng trên cùng ghi "<T1> · PB"; không có ô "Vai trò thật".

### B2 — Phản biện thứ hai chỉ thấy bài của mình
**Tình huống.** Hai phản biện cùng kỳ, mỗi người một phần.
**Các bước.**
1. *(T2, cửa sổ riêng tư khác)* Đăng nhập Google bằng T2, mở đường dẫn đăng nhập, bấm Vào hệ thống.
2. *(T2)* Mở THU-02.
**Vì sao quan trọng.** Phản biện không được thấy bài không giao cho mình.
**Bạn sẽ thấy.** Chỉ THU-02. Trang bài có đề, lời giải, phần Thảo luận; **không có** "Nguồn & chỉnh sửa", không có tên tác giả.

### B3 — Hai phản biện trao đổi về cùng một bài
**Các bước.**
1. *(T1)* Mở THU-02, gõ nhận xét: `Bước cuối nên viết rõ $BC^2=AB^2+AC^2$.` → Gửi nhận xét.
2. *(T2)* Mở lại THU-02 (← Danh sách rồi mở lại).
3. *(QT, cửa sổ thường)* Vào hệ thống, mở THU-02.
**Vì sao quan trọng.** Thảo luận theo từng bài thay cho chuỗi email.
**Bạn sẽ thấy.** T2 và QT đều thấy nhận xét của T1, công thức hiện đẹp (không còn dấu $).

### B4 — Nhận xét có mã độc không làm gì được
**Các bước.**
1. *(T1)* Mở THU-01, gửi nhận xét: `<img src=x onerror=alert(1)> <b>thử</b>`
2. *(T1)* Gửi thêm một nhận xét bắt đầu bằng dấu bằng: `=1+1`
3. *(QT)* Mở THU-01.
**Vì sao quan trọng.** Nếu đoạn mã chạy được trong trang của Quản trị, nó có thể thao tác bằng quyền Quản trị.
**Bạn sẽ thấy.** Nhận xét hiện nguyên văn như chữ (thấy cả `<img …>` và `<b>`); **không** có hộp thông báo nào bật lên.
Nhận xét thứ hai hiện đúng `=1+1`; trong Sheet, tab Comments, ô đó là chữ, không phải công thức (không hiện 2).

### B5 — Người không có trong hệ thống
**Các bước.**
1. *(LẠ, cửa sổ riêng tư)* Mở đường dẫn đăng nhập, cho phép, bấm Vào hệ thống.
**Bạn sẽ thấy.** "Địa chỉ … chưa có vai trò trong hệ thống. Hãy liên hệ người đã mời thầy cô (Quản trị hoặc Phụ trách chuyên mục)…" Không thấy bài nào.
Tab Audit có dòng "từ chối" với địa chỉ đó.

### B6 — Tạm ngưng một phản biện đang làm việc
**Các bước.**
1. *(T2)* Đang ở trong hệ thống (B2).
2. *(QT)* Sheet → tab Users → dòng của T2 → `hoat_dong` = FALSE.
3. *(T2)* Bấm ← Danh sách.
4. *(QT)* Đặt lại `hoat_dong` = TRUE (hoặc chạy `resetPractice`).
**Vì sao quan trọng.** Khi rút quyền một người, quyền mất ngay, không đợi người đó thoát ra.
**Bạn sẽ thấy.** Bước 3: thông báo đỏ "Tài khoản chưa có vai trò trong hệ thống." và danh sách không tải được.

### B7 — Đăng nhập nhầm tài khoản
**Tình huống.** Trình duyệt đăng nhập nhiều tài khoản Google cùng lúc.
**Các bước.**
1. *(QT, cửa sổ thường đã có cả QT và T1)* Mở đường dẫn đăng nhập.
**Vì sao quan trọng.** Google có thể dùng tài khoản mặc định thay vì tài khoản người dùng nghĩ.
**Bạn sẽ thấy.** Dòng "Xin chào …" cho biết đang vào bằng tài khoản nào. Nếu sai: đóng trang, dùng cửa sổ riêng tư
chỉ đăng nhập đúng tài khoản. (Hệ thống không tự chọn tài khoản — người dùng phải nhìn dòng này.)

### B8 — Liên kết hết hạn
**Các bước.**
1. *(T1)* Vào hệ thống, để nguyên tab hơn 10 phút.
2. *(T1)* Tải lại trang (⌘R).
3. *(T1)* Bấm **Đăng nhập lại**.
**Bạn sẽ thấy.** Bước 2: "Phiên vào hệ thống đã hết hạn hoặc không hợp lệ…" và nút Đăng nhập lại. Bước 3: về trang "Xin chào", vào lại bình thường.
(Phiên đang mở vẫn dùng được 6 giờ nếu không tải lại trang.)

### B9 — Quản trị xem như phản biện
**Các bước.**
1. *(QT)* Ô "Vai trò thật" → chọn "Xem như PB".
2. *(QT)* Chọn lại "Vai trò thật".
**Bạn sẽ thấy.** Bước 1: dòng trên cùng ghi PB; danh sách chỉ còn các bài giao cho QT (thường là không có) và không có tên tác giả.
Bước 2: thấy lại mọi bài.

### B10 — Công thức và thuộc tính của bài thật
**Các bước.**
1. *(QT)* Mở 2026-07-06a, SL09-1047, 2026-09-11a, 2026-06-02a.
2. *(QT)* Mở "Nguồn & chỉnh sửa" của 2026-09-11a.
3. *(QT, điện thoại)* Mở đường dẫn đăng nhập trên điện thoại, xem một bài có công thức dài.
**Bạn sẽ thấy.** Công thức hiện đầy đủ, không có dòng "Cảnh báo hiển thị". Ở 2026-09-11a: mục Sửa đổi có dòng
"4∛6/3 → 2∛6/3 … chờ tác giả xác nhận" (sau khi áp dụng bản vá đọc kiểm tra). Trên điện thoại: đọc được, công thức dài cuộn ngang được.

### B11 — Sửa đề, xem trước, hai người cùng sửa, lịch sử
**Tình huống.** Người chuẩn bị bài sửa văn bản trên trang; một người khác lưu trước.
**Trước khi bắt đầu.** `resetPractice`. Dùng QT trong **hai tab** (mỗi tab vào từ đường dẫn đăng nhập — mỗi tab là một phiên riêng).
**Các bước.**
1. *(QT, tab 1)* Mở THU-01. Dưới mã bài có dòng "Phiên bản 1 · sửa lần cuối …". Bấm **Sửa** cạnh "Đề bài".
2. *(QT, tab 1)* Trong ô bên trái, thêm vào cuối đề: ` Khi nào có dấu bằng?` và một công thức `$a=b=1$`. Ô bên phải hiện công thức sau chưa tới 1 giây.
3. *(QT, tab 2)* Mở THU-01, bấm **Sửa** cạnh "Đề bài", gõ thêm một chữ bất kỳ (chưa lưu).
4. *(QT, tab 1)* Bấm **Lưu**.
5. *(QT, tab 2)* Bấm **Lưu**.
6. *(QT, tab 2)* Bấm **Lưu** lần nữa.
7. *(QT, tab 1)* Bấm **Sửa** cạnh "Lời giải", gõ một chữ, bấm **Huỷ**, rồi bấm **Huỷ** lần nữa.
8. *(QT, tab 1)* Mở "Nguồn & chỉnh sửa" → cuối mục, bấm **Xem lịch sử** → mở dòng trên cùng.
9. *(QT)* Sheet → tab Problems, dòng THU-01: cột `de_bai_goc` không đổi.
10. *(T1)* Mở THU-01: không có nút Sửa, không có "Nguồn & chỉnh sửa".
**Vì sao quan trọng.** Hai người sửa cùng lúc không được ghi đè lặng lẽ; mọi lần sửa có dấu vết; bản gốc của tác giả không đổi.
**Bạn sẽ thấy.** Bước 4: đề mới hiện, dòng trên ghi "Phiên bản 2". Bước 5: thông báo đỏ "Bài vừa được người khác sửa (phiên bản 2) — bản của bạn CHƯA được lưu",
chữ trong ô vẫn còn, bên dưới có khung vàng so sánh (chữ bỏ gạch đỏ, chữ thêm tô xanh). Bước 6: lưu được, "Phiên bản 3".
Bước 7: lần Huỷ đầu nhắc "Có thay đổi chưa lưu — bấm Huỷ lần nữa để bỏ"; lần hai trở lại như cũ, không có phiên bản mới.
Bước 8: hai dòng (phiên bản 3, 2), mỗi dòng ghi ai, khi nào và phần khác nhau.

### B12 — Sửa nội dung toán, mục cần kiểm tra, xung đột, trạng thái
**Tình huống.** Người chuẩn bị bài sửa một đáp số, đóng một mục cần kiểm tra, chuyển xung đột mức cho TBT; TBT quyết định.
**Trước khi bắt đầu.** Sau lần triển khai có tính năng này: chạy `setup()` một lần (thêm cột `ket_qua` vào tab Checks).
`resetPractice`. *(QT)* Sheet → tab Users → đặt vai trò T1 = `PB, NCB`, T2 = `PB, TBT` (giữ PB để vẫn thấy bài luyện được giao; THU-02 giao cho cả hai).
**Các bước.**
1. *(T1)* Mở THU-02 → **Sửa** cạnh "Lời giải" → trong công thức cuối, đổi `AB^2+AC^2` thành `AC^2+AB^2` → chọn **Sửa nội dung toán** → bấm Lưu khi chưa ghi gì.
2. *(T1)* Ghi Vị trí `kết luận`, Lý do `thử nghiệm` → Lưu. Mở "Nguồn & chỉnh sửa".
3. *(T1)* Ở dòng sửa đổi vừa có, đổi ô trạng thái thành "tác giả đồng ý".
4. *(T1)* **+ Thêm mục cần kiểm tra**: `Kiểm tra lại bước AM-GM` → Thêm. Rồi **Đóng…** mục đó, để trống ô Kết quả → Đóng mục; ghi `đã kiểm tra` → Đóng mục.
5. *(T1)* **+ Thêm xung đột**: loại `mức`, mô tả `Tác giả đề nghị A` → Thêm. Bấm **Ghi quyết định…** của xung đột đó.
6. *(T1)* Chọn "chờ TBT" → Lưu. ← Danh sách.
7. *(T2)* Mở THU-02 → ô **Trạng thái** dưới mã bài → `SL` → Đổi trạng thái. Mở "Nguồn & chỉnh sửa" → **Ghi quyết định…** ở xung đột mức → "đã giải quyết", ghi `Mức B` → Lưu.
8. *(QT)* `resetPractice` (trả T1, T2 về PB).
**Vì sao quan trọng.** Sửa nội dung toán luôn để lại một dòng Sửa đổi có lý do; quyết định về mức là của TBT.
**Bạn sẽ thấy.** Bước 1: dòng nhắc "cần ghi Vị trí và Lý do", không lưu. Bước 2: mục Sửa đổi có dòng "lời giải, kết luận: … → … (thử nghiệm; chờ tác giả xác nhận)".
Bước 3: trạng thái đổi, văn bản không đổi. Bước 4: Kết quả trống bị báo đỏ; sau đó mục hiện [xong] và "⇒ đã kiểm tra", nút Mở lại.
Bước 5: ô trạng thái chỉ có "mở" và "chờ TBT" (không có "đã giải quyết"). Bước 6: trên danh sách, THU-02 có chấm "xung đột mở".
Bước 7: chip trạng thái đổi thành SL; ô trạng thái của TBT có "đã giải quyết"; sau khi lưu, chấm "xung đột mở" của THU-02 biến mất.

### B13 — Kỳ phản biện: mở kỳ, giao bài, thư mời, phiếu, nhắc hạn, đóng kỳ
**Tình huống.** PT mở một kỳ, giao bài cho hai phản biện; họ điền phiếu và trao đổi ẩn danh; PT theo dõi rồi đóng kỳ.
**Trước khi bắt đầu.** Sau lần triển khai có tính năng này: `setup()` và `installReminderTrigger()` (mục 9 của setup.md).
`resetPractice` (T1, T2 là PB; kỳ K-THU có hạn 14 ngày nữa).
**Các bước.**
1. *(QT)* Nút **Kỳ phản biện** → Mở kỳ mới: tên `PB-THU-2`, hạn = 3 ngày nữa **theo giờ Việt Nam** (dòng đầu trang ghi "hôm nay là …";
   sau khi mở, kỳ phải hiện "còn 3 ngày") → Mở kỳ.
2. *(QT)* Ở kỳ PB-THU-2: giao THU-03 cho T1, rồi THU-03 cho T2, rồi THU-01 cho T1 (ô Giao bài / cho / Giao).
3. *(QT)* Bấm **Gửi thư mời (2 người chưa mời)**.
4. *(T1, T2)* Mở hộp thư của mình.
5. *(T1)* Vào hệ thống. Danh sách: THU-03 có chip "hạn …· chưa có phiếu". Mở THU-03 → Phiếu phản biện: bấm Lưu phiếu khi chưa chọn đề nghị;
   rồi chọn mức B, đề nghị "sửa rồi chọn", nhận xét có công thức `$x>0$` → Lưu phiếu → **Đánh dấu đã xong**. Gửi một nhận xét ở Thảo luận.
6. *(T2)* Mở THU-03: xem Thảo luận; gửi một nhận xét.
7. *(QT)* Mở THU-03: mục **Phiếu phản biện (1)**; Thảo luận. Rồi **Kỳ phản biện**.
8. *(QT)* Trình soạn thảo → chạy `sendReminders`. Chạy lần nữa.
9. *(QT)* Kỳ PB-THU-2 → **Đóng kỳ…** → bấm lần nữa. *(T1)* ← Danh sách (hoặc vào lại).
**Vì sao quan trọng.** Thay chuỗi email phân công / nhắc hạn; phiếu có cấu trúc để lập bảng chọn bài; phản biện trao đổi mà không lộ danh tính.
**Bạn sẽ thấy.** Bước 3: hai thư (T1 nhận MỘT thư cho 2 bài); nút thành "0 người chưa mời"; cột Mời có ✓.
Bước 4: thư "Mời phản biện kỳ PB-THU-2" có số bài, hạn, đường dẫn đăng nhập — không có đề, mã bài hay tên tác giả.
Bước 5: lần đầu nhắc "Hãy chọn đề nghị"; sau khi xong, phiếu bị khoá và có nút "Bỏ đánh dấu xong"; chip thành "đã xong".
Bước 6: nhận xét của T1 ghi **Phản biện 1**, của mình ghi **Bạn**; không thấy email của ai; không có mục Phiếu phản biện của người khác.
Bước 7: QT thấy phiếu của T1 kèm email; Thảo luận có email thật; bảng kỳ: 3 phân công · 1 phiếu · 1 xong.
Bước 8: lần 1 gửi thư "Nhắc: còn 3 ngày" cho T1 (còn THU-01) và T2 — không gửi cho bài đã xong; cột Đã nhắc "3 ngày"; lần 2 không gửi gì.
Execution log giải thích từng kỳ: "Hôm nay … (Asia/Ho_Chi_Minh)", "Kỳ PB-THU-2: hạn …, còn 3 ngày → nhắc 2 người (bỏ qua: …)".
Nếu log ghi "còn 2 ngày" (hoặc 4): hạn chưa đúng 3 ngày theo giờ Việt Nam — dùng **Lưu hạn** để sửa rồi chạy lại.
Bước 9: kỳ hiện "đóng", không còn nút; T1 không còn thấy THU-03 (vẫn thấy THU-01, THU-02 của kỳ K-THU).

### B14 — Bảng chọn bài: lập, xếp, gửi, trả lại, duyệt, mở lại
**Tình huống.** PT xếp bài cho một số báo; TBT trả lại một lần rồi duyệt; sau đó cần thay bài. Chỉ dùng **bài luyện** — không động tới bài thật.
**Trước khi bắt đầu.** Sau lần triển khai có tính năng này: `setup()` (mục 10 của setup.md).
`resetPractice` (tạo đủ 10 bài luyện THU-01 … THU-10). Sheet → tab Users → T1 = `PT`, T2 = `TBT`. Không cần đổi `BOARD_LAYOUT` (bố cục mặc định 4 B, 6 A).
**Các bước.**
1. *(T1)* Nút **Bảng chọn bài** → Lập bảng cho số báo `THU-99/2026` (số báo bắt đầu bằng THU- là bảng luyện).
2. *(T1)* Vị trí 1 chọn **THU-02**, vị trí 2 chọn **THU-01**, vị trí 3 → 10 lần lượt chọn THU-03 … THU-10 (chỉ chọn bài THU-…; danh sách có cả bài thật).
   Nút **Gửi TBT duyệt** chỉ bấm được khi đủ 10 bài — bên cạnh nút ghi vị trí còn trống.
3. *(T1)* Bấm ↓ ở vị trí 1 (đổi chỗ); bấm × ở vị trí 2 rồi chọn lại THU-02. Bấm **Gửi TBT duyệt**.
4. *(T2)* **Bảng chọn bài** → **Trả lại…**, ghi `Đổi chỗ hai bài` → Trả lại.
5. *(T1)* Mở lại trang Bảng chọn bài: thấy ghi chú; đổi chỗ; Gửi TBT duyệt.
6. *(T2)* **Duyệt** → bấm lần nữa. ← Danh sách: THU-01, THU-02 có chip SL-OK.
7. *(T2)* **Mở lại để sửa…** → bấm lần nữa. ← Danh sách.
8. *(QT)* `resetPractice` (xoá bảng THU-99/2026, đưa mười bài luyện về như mới, đặt lại vai trò T1, T2).
**Vì sao quan trọng.** Bảng chọn bài thay danh sách gửi qua email; quyết định của TBT được ghi lại và trạng thái bài đi theo quyết định.
**Bạn sẽ thấy.** Bước 2: cột Phiếu phản biện tóm tắt các phiếu; cột Lưu ý báo bài còn mục cần kiểm tra / xung đột / khác mức.
Bước 3: sau khi gửi, không còn ô chọn hay nút sửa. Bước 6: nút đổi thành "Bấm lần nữa để duyệt…"; sau khi duyệt, mười bài là SL-OK; THU-01…THU-04 mức B, THU-05…THU-10 mức A (mức của vị trí).
Bước 7: mười bài trở về trạng thái Mới. VP, NCB, BTK (nếu thử) chỉ xem được bảng, không có nút.

### B15 — Khoá kỳ: số in, tệp .tex chỉ có đề bài, gói chế bản
**Tình huống.** Bảng của một số báo đã được TBT duyệt; TBT khoá kỳ, đánh số in; BTK nhận tệp; Nghĩa dựng PDF xem trước. Chỉ dùng **bài luyện**.
**Trước khi bắt đầu.** Sau lần triển khai có tính năng này: `setup()` (mục 11 của setup.md). `resetPractice`. Sheet → tab Users → T1 = `PT`, T2 = `TBT`.
Làm B14 bước 1–3 và 6 (lập bảng THU-99/2026, xếp đủ THU-01 … THU-10, gửi, TBT duyệt). *(QT)* Mở THU-05 → thêm một mục cần kiểm tra.
**Các bước.**
1. *(T2)* **Bảng chọn bài** → **Khoá kỳ…**. Ô Số in bắt đầu: có gợi ý nếu Published đã có số; nếu trống, gõ `9001` → **Đánh lại số**.
2. *(T2)* Xem bảng: thứ tự P9001 … P9010; dòng tác giả *Tác Giả Luyện Tập (Trường Luyện Tập (bịa))*; lưu ý THU-05 còn mục cần kiểm tra.
3. *(T2)* **Tải .tex xem trước** → mở tệp bằng trình soạn thảo: chỉ có đề bài, không có lời giải.
4. *(T2)* Bấm **Khoá kỳ** khi chưa đánh dấu "Tôi đã xem các lưu ý" ← bị nhắc. Đánh dấu → bấm → bấm lần nữa.
5. *(T2)* Bảng hiện "đã khoá", không còn nút Mở lại. Danh sách: mười bài có chip PL. Sheet → tab Published: mười dòng THU-…, số in P9001 … P9010.
6. *(QT)* Drive → thư mục **Pi ĐRKN — chế bản** → tải `de-ra-ky-nay-THU-99-2026.zip`. Trên máy Mac:
   `python3 tools/khoaky/build.py ~/Downloads/de-ra-ky-nay-THU-99-2026.zip` → mở `…-btk.zip`, xem PDF.
7. *(QT)* Sheet → tab Users → T1 = `BTK`. *(T1)* **Bảng chọn bài** → **Tải tệp .tex** (cùng nội dung bước 3).
8. *(QT)* `resetPractice` (xoá bảng, dòng Published của bài luyện, đưa bài về như mới). Xoá tệp zip luyện tập trong thư mục chế bản.
**Vì sao quan trọng.** Số in không được trùng hay nhảy; tệp gửi BTK không bao giờ mang lời giải, ghi chú hay thông tin liên hệ.
**Bạn sẽ thấy.** Bước 1: nút Khoá kỳ chỉ bấm được khi có số in. Bước 4: nút đổi thành "Bấm lần nữa: ghi số in P9001–P9010, chuyển 10 bài sang PL…".
Bước 6: công cụ in "Số bài: 10 — P9001 đến P9010" và "Đã ghi …-btk.zip"; PDF theo mẫu cột Đề ra kỳ này, mức B trước, mức A sau.
Khi thử mở lại hay khoá lần hai: bị từ chối. NCB, PB, VP không có nút Khoá kỳ.

### B16 — Hình: sửa TikZ, dựng SVG ở máy, tải lên, hình hiện trên trang
**Tình huống.** NCB vẽ lại hình cho một bài (quy ước 1, 2); hình được dựng ở máy và hiện cho cả phản biện. Chỉ dùng **bài luyện**.
**Trước khi bắt đầu.** Sau lần triển khai có tính năng này. `resetPractice`. Sheet → tab Users → T1 = `NCB` (T2 giữ `PB` — được giao THU-02). Tải lại trang.
**Các bước.**
1. *(T1)* Mở **THU-02** → mục **Hình** → **Sửa**. Dán:
   `\begin{tikzpicture}\draw (0,0) node[below]{$A$} -- (4,0) node[below]{$B$} -- (0,3) node[above]{$C$} -- cycle;\end{tikzpicture}`
   ← Ô xem trước: "[hình TikZ — chưa dựng]". Bấm **Lưu** (Sửa nhỏ).
2. *(T1)* Thử lưu lại với `\input{x}` chèn vào trong khối ← bị từ chối ("không được dùng lệnh \input"); bấm Huỷ hai lần.
3. *(T1)* Nút **Hình** (đầu trang): THU-02 · hình · chưa dựng. Bấm **Tải các hình chưa dựng (.zip)**.
4. *(QT, trên Mac)* `python3 tools/hinh/build.py ~/Downloads/hinh-chua-dung.zip` ← "Đã dựng 1 hình → …/hinh-svg.zip".
5. *(T1)* Trang Hình → chọn `hinh-svg.zip` → **Tải SVG lên** ← "Đã lưu 1 hình"; danh sách trống (bỏ đánh dấu "Chỉ hiện…" để thấy "đã dựng").
6. *(T1)* Mở THU-02: thấy tam giác ABC. *(T2)* Mở THU-02: cũng thấy hình, không có nút Sửa, không có nút Hình.
7. *(T1)* Sửa hình: đổi `(4,0)` thành `(5,0)` → Lưu ← mục Hình lại "chưa dựng"; trang Hình liệt kê hình mới.
8. *(QT)* `resetPractice`. (Tệp `tikz-….svg` luyện tập còn trong thư mục hình — vô hại, xoá được.)
**Vì sao quan trọng.** Hình vẽ lại phải hiện đúng phiên bản TikZ đang lưu; dựng hình không đưa đề ra khỏi máy của ban biên tập.
**Bạn sẽ thấy.** Bước 6: hình trắng nền, chữ A, B, C rõ; trên điện thoại hình thu vừa màn hình. Bước 7: hình cũ không còn hiện.

### B17 — Thêm bài trên trang, ảnh của đề / lời giải, lời giải ẩn với phản biện
**Tình huống.** NCB thêm trực tiếp hai bài (không qua VP) kèm ảnh; phản biện chỉ thấy lời giải sau khi PT mở. Dùng **bài bịa**, tác giả bịa.
**Trước khi bắt đầu.** Sau lần triển khai có tính năng này: `setup()` (mục 13 của setup.md). `resetPractice`. Users → T1 = `NCB`.
Chuẩn bị trên máy: một tệp `thu-sh-a.tex` gồm dòng `\textbf{Bài toán 1. Thử}`, một đề ngắn (vd. `Tính $1+1$.`), dòng `\textbf{Lời giải.}`, một lời giải;
một ảnh PNG hoặc SVG bất kỳ.
**Các bước.**
1. *(T1)* Nút **Thêm bài** ← thấy "Thư mục sẽ cấp: NNNN-TT-NN". Tác giả mới: `Tác Giả Thử`, đơn vị `Trường Thử`, liên hệ `thu@example.com`.
2. *(T1)* Bài 1: tải `thu-sh-a.tex` ← đề, lời giải tách sẵn, không còn dòng tiêu đề; chủ đề Số học, mức A tự điền. **+ Thêm một bài nữa**:
   gõ tay đề, lời giải, chọn chủ đề; chọn ảnh → không chọn chỗ đặt rồi bấm Thêm ← bị nhắc; chọn "minh hoạ lời giải".
3. *(T1)* **Thêm vào danh sách** → bấm lần nữa ← "Đã thêm: …a, …b". Mở bài b: ảnh hiện cuối lời giải, mục Hình trống.
4. *(T1)* Bài a → **Thêm ảnh…** → chọn ảnh, "hình của đề" → Tải lên ← ảnh hiện ở mục Hình; Lịch sử sửa có dòng "hình".
5. *(QT)* Sheet → tab Authors: có `Tác Giả Thử` với liên hệ; tab Problems: liên hệ không có trong bài.
6. *(QT)* **Kỳ phản biện** → kỳ K-THU: "Lời giải cho phản biện: chưa mở". *(T2, PB)* mở THU-02 ← mục Lời giải: "(chưa mở — hãy tự giải trước…)".
7. *(QT)* **Mở lời giải cho phản biện…** → bấm lần nữa. *(T2)* tải lại THU-02 ← thấy lời giải. *(QT)* **Đóng lời giải lại…** ← T2 lại không thấy.
8. *(QT)* Danh sách: ô trạng thái mặc định "Đang xử lý (Mới, SL)"; chọn "Mọi trạng thái" ← thêm bài SL-OK/PL; thử các kiểu sắp xếp.
9. *(QT)* Xoá hai bài thử khỏi tab Problems, Provenance, ConversionLog (dòng có mã của chúng) và tác giả thử; xoá ảnh `…-1.png` trong thư mục hình. `resetPractice`.
**Vì sao quan trọng.** Bài đến thẳng ban biên tập vẫn có mã, nguồn, tác giả đúng quy ước; ảnh lộ đáp án không bao giờ vào bản in; phản biện tự giải trước.

---

## Những gì chưa kiểm thử được (vì chưa có)

- Trigger nhắc hạn chạy thật lúc 8 giờ sáng: kiểm thử tự động gọi thẳng `sendReminders` với ngày giả; trên Google, xem trang Executions sau một ngày.
- Hai người ghi thật sự cùng một lúc trên Google (khoá ghi của Apps Script) — chỉ kiểm thử được phần "người lưu sau được báo".
