#!/usr/bin/env python3
"""stage.py — gom các bản ghi đã chuyển đổi thành MỘT tệp JSON để nhập bằng importBatch() (apps/main/Import.gs).

Dùng: python3 tools/convert/stage.py <ra.json> <vào1.json> [<vào2.json> …]
Đầu vào: mảng bản ghi theo một trong hai dạng đã dùng khi chuẩn bị dữ liệu thử kỳ 10/2026
  - dạng "nhóm A" (trích từ Overleaf: ma_tam, de_bai, loi_giai, nguon{…}, sua_doi, can_kiem_tra, xung_dot, gop_y)
  - dạng "nhóm B" (chuyển từ hồ sơ Drive: ma_bai, thu_muc, tep_goc, tac_gia, de_bai, loi_giai, can_kiem_tra, xung_dot, …)
Bản ghi "không phải đề" / "thư mục rỗng" được bỏ qua. Lần cuối dò thông tin cá nhân; nếu thấy thì DỪNG.
Tệp ra là dữ liệu thật: để ngoài kho mã (thư mục data/ đã bị chặn) và tải lên Drive riêng của quản trị.
"""
import json, re, sys

PERSONAL = [re.compile(r'(?<![\w.])(?:\+?84|0)(?:[\s.\-]?\d){9,10}(?!\d)'), re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+'),
            re.compile(r'(?<![\w.])\d{11,16}(?![\w.])')]


def split_author(s):
    s = (s or '').strip()
    m = re.match(r'^(.*?)\s*\((.*)\)\s*$', s)
    return (m.group(1).strip(), m.group(2).strip()) if m else (s, '')


def from_a(r):
    n = r['nguon']
    code = r.get('ma_bai') or r['ma_tam']
    name, unit = split_author(r['tac_gia'])
    return {
        'problem': {'ma_bai': code, 'ma_tam': r['ma_tam'], 'chu_de': r['chu_de'], 'muc': r['muc'], 'trang_thai': 'SL-Fail',
                    'loai': 'sáng tác', 'de_bai': r['de_bai'], 'loi_giai': r['loi_giai'], 'de_bai_goc': '', 'loi_giai_goc': ''},
        'author': {'ten_in': name, 'don_vi': unit},
        'provenance': {'thu_muc': n.get('thu_muc_drive') or '', 'tep_goc': n.get('tep_goc') or '', 'ngay_nhan': n.get('ngay_nhan') or '',
                       'kenh': n.get('kenh') or '', 'ban_trung_gian': n.get('ban_trung_gian') or [], 'lich_su_vong': n.get('lich_su_vong') or [],
                       'doi_chieu': r.get('doi_chieu_nguyen_ban', 'chưa'), 'tom_tat_doi_chieu': r.get('tom_tat_doi_chieu', '')},
        'corrections': r.get('sua_doi') or [], 'checks': r.get('can_kiem_tra') or [],
        'conflicts': r.get('xung_dot') or [], 'log': [], 'reviews': r.get('gop_y') or []}


def from_b(r):
    name, unit = split_author(r.get('tac_gia'))
    return {
        'problem': {'ma_bai': r['ma_bai'], 'ma_tam': '', 'chu_de': r.get('chu_de') or '', 'muc': '', 'trang_thai': 'Mới',
                    'loai': r.get('loai') or '', 'de_bai': r.get('de_bai') or '', 'loi_giai': r.get('loi_giai') or '',
                    'de_bai_goc': r.get('de_bai') or '', 'loi_giai_goc': r.get('loi_giai') or '', 'hinh': r.get('hinh') or ''},
        'author': {'ten_in': name, 'don_vi': unit},
        'provenance': {'thu_muc': r.get('thu_muc') or '', 'thu_muc_id': r.get('thu_muc_id') or '',
                       'tep_goc': [t.get('ten') for t in r.get('tep_goc', [])], 'ngay_nhan': r.get('ngay_nhan') or '',
                       'kenh': 'hồ sơ Văn phòng (Drive)', 'doi_chieu': 'là bản gốc (chuyển đổi trực tiếp)',
                       'tom_tat_doi_chieu': r.get('ghi_chu_nguon') or '',
                       'lich_su_vong': [], 'ban_trung_gian': []},
        'corrections': [], 'checks': r.get('can_kiem_tra') or [], 'conflicts': r.get('xung_dot') or [],
        'log': r.get('nhat_ky_chuyen_doi') or [], 'muc_tac_gia_de_xuat': r.get('muc_tac_gia_de_xuat')}


def main():
    out, ins = sys.argv[1], sys.argv[2:]
    items = []
    for f in ins:
        for r in json.load(open(f, encoding='utf8')):
            if r.get('loai') in ('không phải đề', 'thư mục rỗng'):
                continue
            items.append(from_a(r) if 'ma_tam' in r and 'nguon' in r else from_b(r))
    text = json.dumps(items, ensure_ascii=False)
    for rx in PERSONAL:
        m = rx.search(text)
        if m:
            sys.exit('DỪNG: có vẻ còn thông tin cá nhân: …%s…' % text[max(0, m.start() - 40):m.end() + 10])
    codes = [i['problem']['ma_bai'] for i in items]
    dup = {c for c in codes if codes.count(c) > 1}
    if dup:
        sys.exit('DỪNG: mã bài trùng: %s' % ', '.join(sorted(dup)))
    open(out, 'w', encoding='utf8').write(json.dumps(items, ensure_ascii=False, indent=1))
    print('%d bài → %s' % (len(items), out))


if __name__ == '__main__':
    main()
