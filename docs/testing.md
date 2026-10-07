# Kiểm thử hệ thống Đề ra kỳ này

Mục đích: xác nhận điều mà mỗi người — Quản trị, người chuẩn bị bài, phản biện, người lạ — **thật sự thấy và làm được**,
chỉ với quyền mà người đó có. Không phải để săn lỗi mới, mà để mỗi lần sửa mã không làm hỏng điều đã đúng.

## Ba lớp kiểm thử

| Lớp | Chạy ở đâu | Cách chạy | Thời gian |
|---|---|---|---|
| 1. Trên máy | máy quản trị, không cần Google | `scripts/test-all.sh` (tự chạy trong `scripts/deploy.sh` và trên GitHub) | ~10 giây |
| 2. Trên Google | dự án Apps Script thật, Sheet kiểm thử riêng | trình soạn thảo dự án chính → `runAllTests` → Run | 3–6 phút |
| 3. Bằng tay | trình duyệt, ba tài khoản Google thật | làm theo các bài B1–B10 dưới đây | ~30 phút |

Lớp 1 và 2 chạy **cùng một bộ kịch bản** (`apps/main/Tests.gs`, 57 kịch bản): lớp 1 trên bản mô phỏng Apps Script
(`tools/gas-sim`), lớp 2 trên Google thật. Lớp 1 cũng kiểm tra kho mã không chứa dữ liệu (`scripts/guard.py`),
bộ hiển thị công thức (`tests/render.test.js`) và hai địa chỉ web nhìn từ bên ngoài (`tests/http.test.js`).
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
Bốn phần, mỗi phần phải báo đạt: chặn dữ liệu · bộ hiển thị (11 trường hợp) · máy chủ mô phỏng (57 kịch bản) ·
từ bên ngoài (3 trường hợp: người chưa đăng nhập Google chỉ thấy trang đăng nhập của Google, kể cả khi dùng liên kết giả).
`scripts/deploy.sh` tự chạy ba phần đầu và **không đẩy mã** nếu có lỗi.

## Lớp 2 — trên Google

Trình soạn thảo dự án chính → chọn `runAllTests` → Run. Kết quả: Execution log (mỗi dòng ĐẠT/LỖI) và tab "Kết quả"
của Sheet kiểm thử. Nếu log báo **TẠM DỪNG** (Apps Script giới hạn 6 phút mỗi lần chạy), bấm Run lần nữa — bộ kiểm thử chạy tiếp
từ chỗ dừng. Chạy riêng một nhóm: `runTests('3')`; một kịch bản: `runTests('3.6')` (chọn hàm `runTests` không truyền được tham số
từ nút Run — dùng `runAllTests`, hoặc tạm thêm một hàm gọi `runTests('3')`).

Khi nào chạy: sau mỗi lần `scripts/deploy.sh` có thay đổi phía máy chủ, và trước mỗi kỳ chọn bài.

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
| 11.1 | resetPractice tạo 3 bài luyện + kỳ K-THU, chạy lại không nhân đôi, không chạm bài thật | QT |
| 11.2 | Bài luyện chỉ hiện với Quản trị và người được giao; TBT/NCB không thấy | T1+T2 |

**12. Hàm quản trị**

| Mã | Kịch bản | Tài khoản |
|---|---|---|
| 12.1 | Khách trên trang web không gọi được setUser, setup, nhập, vá, kiểm thử, resetPractice | T1 |

<!-- bảng tự sinh: hết -->

Mỗi kịch bản bắt đầu từ dữ liệu bịa mới (5 bài TEST-01…05, một tác giả bịa, kỳ đang mở K-MO, kỳ đã đóng K-DONG).
Kiểm thử đăng nhập đi đúng đường của người dùng thật: tạo liên kết đã ký như ứng dụng đăng nhập, gọi trang chính, lấy phiên trong trang,
rồi gọi API như giao diện.

Bộ kịch bản đã được thử ngược: cố ý gỡ từng lớp bảo vệ (ẩn tác giả, chặn HTML, chặn công thức trong ô, chặn tài khoản ngưng,
hạn 10 phút, kiểm tra phiên bản khi sửa, kiểm tra quyền trước khi tra bài, chặn gọi hàm quản trị từ trang web)
thì đúng các kịch bản tương ứng báo LỖI.

## Lớp 3 — bằng tay, ba tài khoản thật

### Bài luyện tập và nút đặt lại

Trình soạn thảo dự án chính → chọn `resetPractice` → Run. Việc này:
- xoá mọi dòng THU-… và kỳ K-THU cũ, rồi tạo lại ba bài luyện (bịa) THU-01 (ĐS), THU-02 (HH), THU-03 (SH);
- mở kỳ luyện tập K-THU: THU-01 → T1; THU-02 → T1 và T2; THU-03 → không ai;
- đặt T1, T2 làm PB.

Không bài thật nào bị đụng tới. Ban biên tập (TBT, NCB…) không thấy bài luyện; chỉ Quản trị và người được giao thấy.
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
**Bạn sẽ thấy.** "Địa chỉ … chưa có vai trò trong hệ thống. Hãy liên hệ Phụ trách chuyên mục." Không thấy bài nào.
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

---

## Những gì chưa kiểm thử được (vì chưa có)

- Quy trình kỳ chọn bài: mở kỳ, phân công, chấm, đóng kỳ thành shortlist (đang dựng — sẽ thêm kịch bản khi có).
- Gửi email thông báo.
- Hai người ghi thật sự cùng một lúc trên Google (khoá ghi của Apps Script) — chỉ kiểm thử được phần "người lưu sau được báo".
