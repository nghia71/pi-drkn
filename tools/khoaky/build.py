#!/usr/bin/env python3
"""
Dựng gói chế bản "Đề ra kỳ này" cho BTK từ tệp xuất khi khoá kỳ.

  python3 tools/khoaky/build.py ~/Downloads/de-ra-ky-nay-10-2026.zip
  python3 tools/khoaky/build.py de-ra-ky-nay-10-2026.zip --dinhdang /đường/dẫn/dinhdang.tex --out ~/Desktop

Đầu vào: tệp zip lưu trong thư mục Drive "Pi ĐRKN — chế bản" (một .tex + pic/), hoặc một tệp .tex.
Việc làm:
  1. kiểm tra tệp .tex: UTF-8 hợp lệ (cả bằng iconv nếu máy có), dạng NFC, không có BOM; báo nếu thấy dấu hiệu
     không phải đề bài (Lời giải, địa chỉ email) hoặc hình được gọi mà không có trong pic/;
  2. biên dịch bằng XeLaTeX (hai lượt) với structure/dinhdang.tex (mặc định: templates/dinhdang.tex trong kho);
  3. ghi <tên>-btk.zip gồm: <tên>.tex, pic/ (nếu có), <tên>.pdf (bản xem trước).

Máy cần TeX Live có xelatex (MacTeX trên máy Mac). Mọi thứ chạy tại máy — không gửi đề đi đâu (quy định dữ liệu, mục 6).
Thư mục làm việc tạm bị xoá khi xong. Mã thoát khác 0 nếu không dựng được.
"""
import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DINHDANG = os.path.normpath(os.path.join(HERE, '..', '..', 'templates', 'dinhdang.tex'))


def fail(msg):
    print('LỖI: ' + msg, file=sys.stderr)
    sys.exit(1)


def unpack(src, work):
    """Giải nén an toàn: chỉ nhận một .tex ở gốc và các tệp trong pic/. Trả về (tên .tex, danh sách hình)."""
    if src.lower().endswith('.tex'):
        shutil.copy(src, os.path.join(work, os.path.basename(src)))
        return os.path.basename(src), []
    if not zipfile.is_zipfile(src):
        fail('không phải tệp zip hay .tex: ' + src)
    texs, pics = [], []
    with zipfile.ZipFile(src) as z:
        for info in z.infolist():
            name = info.filename
            if info.is_dir():
                continue
            parts = name.split('/')
            if name.startswith('/') or '..' in parts or '\\' in name:
                fail('đường dẫn lạ trong zip: ' + name)
            if len(parts) == 1 and name.lower().endswith('.tex'):
                texs.append(name)
            elif len(parts) == 2 and parts[0] == 'pic' and parts[1]:
                pics.append(parts[1])
            else:
                print('bỏ qua tệp không thuộc gói: ' + name)
                continue
            dest = os.path.join(work, *parts)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with z.open(info) as a, open(dest, 'wb') as b:
                shutil.copyfileobj(a, b)
    if len(texs) != 1:
        fail('zip phải có đúng một tệp .tex ở gốc (có %d)' % len(texs))
    return texs[0], pics


def check_text(path, pics):
    """Trả về (lỗi, lưu ý)."""
    errors, notes = [], []
    raw = open(path, 'rb').read()
    if raw.startswith(b'\xef\xbb\xbf'):
        errors.append('tệp bắt đầu bằng BOM')
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError as e:
        return ['không phải UTF-8 hợp lệ (byte %d)' % e.start], notes
    if shutil.which('iconv'):
        r = subprocess.run(['iconv', '-f', 'UTF-8', '-t', 'UTF-8', path], capture_output=True)
        if r.returncode != 0:
            errors.append('iconv báo lỗi mã hoá: ' + r.stderr.decode('utf-8', 'replace').strip())
    if not unicodedata.is_normalized('NFC', text):
        errors.append('chữ chưa ở dạng NFC (dấu tiếng Việt tách rời) — xuất lại từ hệ thống')
    body = text.split('\\begin{document}', 1)[-1]
    n = len(re.findall(r'^\\thachthuc\b', body, re.M))
    m = re.search(r'\\setcounter\{stthuc\}\{(\d+)\}', body)
    if not n:
        errors.append('không có bài nào (\\thachthuc)')
    elif m:
        first = int(m.group(1)) + 1
        print('Số bài: %d — P%d đến P%d' % (n, first, first + n - 1))
    if re.search(r'\\lgi\b|Lời giải', body):
        notes.append('thân tệp có "Lời giải" — gói cho BTK chỉ gồm đề bài, hãy xem lại')
    if re.search(r'[\w.+-]+@[\w-]+\.[\w.]+', body):
        notes.append('thân tệp có dạng địa chỉ email — không đưa thông tin liên hệ vào bản in')
    have = set(pics)
    for name in re.findall(r'\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}', body):
        if name not in have and not any(p.startswith(name + '.') for p in have):
            notes.append('hình "%s" được gọi nhưng không có trong pic/' % name)
    return errors, notes


def svg_to_pdf(work, pics):
    """Ảnh SVG (vẽ bằng GeoGebra, Inkscape…) → PDF cùng tên: tệp .tex gọi \\includegraphics{tên} không đuôi.
    Cần rsvg-convert (Mac: brew install librsvg). Trả về danh sách PDF đã tạo (vào gói cho BTK)."""
    svgs = [p for p in pics if p.lower().endswith('.svg')]
    if not svgs:
        return []
    if not shutil.which('rsvg-convert'):
        fail('có ảnh SVG (%s) — cần rsvg-convert để chuyển sang PDF (Mac: brew install librsvg)' % ', '.join(svgs))
    out = []
    for p in svgs:
        pdf = p[:-4] + '.pdf'
        r = subprocess.run(['rsvg-convert', '-f', 'pdf', '-o', os.path.join(work, 'pic', pdf), os.path.join(work, 'pic', p)],
                           capture_output=True, timeout=120)
        if r.returncode != 0:
            fail('không chuyển được %s sang PDF: %s' % (p, r.stderr.decode('utf-8', 'replace').strip()[:300]))
        out.append(pdf)
    return out


def compile_pdf(work, tex, dinhdang):
    os.makedirs(os.path.join(work, 'structure'), exist_ok=True)
    shutil.copy(dinhdang, os.path.join(work, 'structure', 'dinhdang.tex'))
    if not shutil.which('xelatex'):
        fail('không tìm thấy xelatex (cài MacTeX hoặc TeX Live)')
    # XeLaTeX tìm phông theo TÊN trong phông của hệ thống; phông nằm trong TeX (MacTeX) thì không thấy theo tên.
    # Gói fontawesome (dinhdang.tex gọi) dùng tên "FontAwesome" → bảo fontspec tìm theo TÊN TỆP FontAwesome.otf (kpathsea thấy).
    # Không sửa dinhdang.tex của Pi: chỉ thêm móc trước khi đọc tệp (cần LaTeX từ 2020-10, MacTeX 2021 trở đi).
    pre = ('\\ifdefined\\AddToHook\\AddToHook{package/fontspec/after}{\\defaultfontfeatures[FontAwesome]{Extension=.otf}}\\fi'
           '\\input{%s}' % tex)
    for k in (1, 2):
        r = subprocess.run(['xelatex', '-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape',
                            '-jobname=' + tex[:-4], pre], cwd=work, capture_output=True, timeout=300)
        if r.returncode != 0:
            log = open(os.path.join(work, tex[:-4] + '.log'), encoding='utf-8', errors='replace').read().splitlines()
            errs = []
            for i, ln in enumerate(log):
                if ln.startswith('!'):
                    errs += [x for x in log[i:i + 4] if x.strip()]
                elif ln.startswith('l.'):
                    errs.append(ln)
            fail('XeLaTeX dừng ở lượt %d:\n  ' % k + '\n  '.join(errs[:16] or log[-20:]) +
                 '\n  (bản ghi đầy đủ: chạy lại với --giu để giữ thư mục làm việc)')
    log = open(os.path.join(work, tex[:-4] + '.log'), encoding='utf-8', errors='replace').read()
    warn = []
    miss = sorted(set(re.findall(r'Missing character: There is no (\S+)', log)))
    if miss:
        warn.append('phông thiếu ký tự: ' + ' '.join(miss))
    over = len(re.findall(r'^Overfull \\hbox', log, re.M))
    if over:
        warn.append('%d dòng tràn lề (Overfull \\hbox)' % over)
    for ln in log.splitlines():
        if ln.startswith('LaTeX Warning:') and 'Rerun' not in ln:
            warn.append(ln)
    return warn


def main():
    ap = argparse.ArgumentParser(description='Dựng gói chế bản Đề ra kỳ này (.tex + pic/ + PDF) cho BTK.')
    ap.add_argument('src', help='tệp zip xuất khi khoá kỳ (hoặc tệp .tex)')
    ap.add_argument('--dinhdang', default=DEFAULT_DINHDANG, help='structure/dinhdang.tex của Pi (mặc định: templates/dinhdang.tex)')
    ap.add_argument('--out', help='thư mục ghi gói (mặc định: cùng chỗ với tệp vào)')
    ap.add_argument('--strict', action='store_true', help='coi mọi lưu ý là lỗi')
    ap.add_argument('--giu', action='store_true', help='giữ thư mục làm việc tạm (để xem bản ghi .log khi lỗi)')
    a = ap.parse_args()
    if not os.path.isfile(a.src):
        fail('không có tệp ' + a.src)
    if not os.path.isfile(a.dinhdang):
        fail('không có tệp định dạng ' + a.dinhdang)
    out_dir = os.path.abspath(a.out or os.path.dirname(os.path.abspath(a.src)))
    work = tempfile.mkdtemp(prefix='khoaky-')
    try:
        tex, pics = unpack(os.path.abspath(a.src), work)
        errors, notes = check_text(os.path.join(work, tex), pics)
        if errors:
            fail('tệp .tex không dùng được:\n  ' + '\n  '.join(errors))
        pics += svg_to_pdf(work, pics)
        notes += compile_pdf(work, tex, a.dinhdang)
        for n in notes:
            print('LƯU Ý: ' + n)
        if notes and a.strict:
            fail('còn %d lưu ý (--strict)' % len(notes))
        base = tex[:-4]
        dest = os.path.join(out_dir, base + '-btk.zip')
        with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
            z.write(os.path.join(work, tex), tex)
            for p in sorted(pics):
                z.write(os.path.join(work, 'pic', p), 'pic/' + p)
            z.write(os.path.join(work, base + '.pdf'), base + '.pdf')
        print('Đã ghi ' + dest + (' (%d lưu ý)' % len(notes) if notes else ''))
    finally:
        if a.giu:
            print('Thư mục làm việc: ' + work)
        else:
            shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
