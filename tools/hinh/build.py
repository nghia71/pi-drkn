#!/usr/bin/env python3
"""
Dựng hình TikZ thành SVG cho trang web (giai đoạn 1: chạy tại máy — không gửi đề đi đâu, quy định dữ liệu mục 6).

  python3 tools/hinh/build.py ~/Downloads/hinh-chua-dung.zip
  python3 tools/hinh/build.py hinh-chua-dung.zip --out ~/Desktop --mau templates/hinh-mau.tex

Đầu vào: tệp zip tải từ trang "Hình" (mỗi hình một tệp tikz-<mã>.tex chứa đúng một khối tikzpicture), hoặc một thư mục chứa các tệp đó.
Mã <mã> = 16 ký tự đầu của SHA-256 (UTF-8, NFC, xuống dòng \\n) của khối — trùng với cách máy chủ tính (Fig.gs), nên SVG
tự khớp với đúng phiên bản hình; sửa TikZ thì mã đổi, trang web hiện "chưa dựng" cho tới khi tải SVG mới.
Việc làm: kiểm tra (mã, lệnh nguy hiểm), XeLaTeX (standalone, templates/hinh-mau.tex) → dvisvgm (chữ thành đường nét)
→ ghi hinh-svg.zip (tikz-<mã>.svg) cạnh tệp vào. Hình lỗi được báo, các hình khác vẫn được dựng. Tải hinh-svg.zip lên trang "Hình".
Cần: TeX Live / MacTeX có xelatex và dvisvgm.
"""
import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_MAU = os.path.normpath(os.path.join(HERE, '..', '..', 'templates', 'hinh-mau.tex'))
TIMEOUT = 60
NAME_RE = re.compile(r'^tikz-([0-9a-f]{16})\.tex$')
BLOCK_RE = re.compile(r'\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}')
# đọc/ghi tệp, chạy lệnh ngoài, đổi mã ký tự: không có lý do để một hình làm những việc này
MARK_RE = re.compile(r'^%%HINH%%[ \t]*$', re.M)
DANGER_RE = re.compile(r'\\(input|include|openin|openout|write|immediate|read|catcode|directlua|special|usepackage|documentclass|'
                       r'newwrite|newread|includegraphics|pgfimage|lstinputlisting|verbatiminput)\b|\^\^')


def norm(s):
    return unicodedata.normalize('NFC', s.replace('\r\n', '\n').replace('\r', '\n'))


def key(block):
    return hashlib.sha256(norm(block).encode('utf-8')).hexdigest()[:16]


def check(name, text):
    """Trả về (mã, lỗi)."""
    m = NAME_RE.match(name)
    if not m:
        return None, 'tên tệp không đúng dạng tikz-<16 ký tự>.tex'
    t = norm(text)
    if not BLOCK_RE.fullmatch(t):
        return None, 'tệp phải chứa đúng một khối \\begin{tikzpicture}…\\end{tikzpicture}'
    if t.count('\\begin{tikzpicture}') != 1:
        return None, 'tikzpicture lồng nhau hoặc nhiều khối'
    d = DANGER_RE.search(t)
    if d:
        return None, 'có lệnh không được phép trong hình: ' + d.group(0)
    k = key(t)
    if k != m.group(1):
        return None, 'mã trong tên tệp không khớp nội dung (tệp đã bị sửa sau khi tải?)'
    return k, None


def compile_one(work, k, block, mau):
    d = os.path.join(work, k)
    os.makedirs(d)
    with open(os.path.join(d, 'h.tex'), 'w', encoding='utf-8') as f:
        f.write(MARK_RE.sub(lambda _: block, mau, count=1))
    try:
        r = subprocess.run(['xelatex', '-no-pdf', '-interaction=nonstopmode', '-halt-on-error', '-no-shell-escape', 'h.tex'],
                           cwd=d, capture_output=True, stdin=subprocess.DEVNULL, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return None, 'XeLaTeX chạy quá %d giây (vòng lặp vô hạn trong TikZ?)' % TIMEOUT
    if r.returncode != 0:
        log = open(os.path.join(d, 'h.log'), encoding='utf-8', errors='replace').read().splitlines()
        errs = []
        for i, ln in enumerate(log):
            if ln.startswith('!'):
                errs += [x for x in log[i:i + 3] if x.strip()]
        return None, 'XeLaTeX: ' + (' | '.join(errs[:6]) or 'lỗi (xem bản ghi)')
    try:
        r = subprocess.run(['dvisvgm', '--no-fonts', '--exact-bbox', '-o', 'h.svg', 'h.xdv'], cwd=d, capture_output=True,
                           stdin=subprocess.DEVNULL, timeout=TIMEOUT)
    except subprocess.TimeoutExpired:
        return None, 'dvisvgm chạy quá %d giây' % TIMEOUT
    svg = os.path.join(d, 'h.svg')
    if r.returncode != 0 or not os.path.exists(svg):
        return None, 'dvisvgm: ' + r.stderr.decode('utf-8', 'replace').strip()[-300:]
    return svg, None


def inputs(src):
    """Danh sách (tên, nội dung) từ zip hoặc thư mục; bỏ qua tệp khác (danh-sach.txt…)."""
    out = []
    if os.path.isdir(src):
        for n in sorted(os.listdir(src)):
            if n.endswith('.tex'):
                out.append((n, open(os.path.join(src, n), encoding='utf-8').read()))
        return out
    if not zipfile.is_zipfile(src):
        sys.exit('LỖI: không phải zip hay thư mục: ' + src)
    with zipfile.ZipFile(src) as z:
        for info in z.infolist():
            n = info.filename
            if info.is_dir() or '/' in n or '\\' in n or not n.endswith('.tex'):
                continue
            out.append((n, z.read(info).decode('utf-8')))
    return out


def main():
    ap = argparse.ArgumentParser(description='Dựng hình TikZ thành SVG cho trang web Đề ra kỳ này.')
    ap.add_argument('src', help='zip tải từ trang Hình (hoặc thư mục các tệp tikz-<mã>.tex)')
    ap.add_argument('--mau', default=DEFAULT_MAU, help='tệp mẫu (mặc định: templates/hinh-mau.tex)')
    ap.add_argument('--out', help='thư mục ghi hinh-svg.zip (mặc định: cùng chỗ với tệp vào)')
    a = ap.parse_args()
    for tool in ('xelatex', 'dvisvgm'):
        if not shutil.which(tool):
            sys.exit('LỖI: không tìm thấy ' + tool + ' (cài MacTeX hoặc TeX Live)')
    mau = open(a.mau, encoding='utf-8').read()
    if not MARK_RE.search(mau):
        sys.exit('LỖI: tệp mẫu thiếu dòng %%HINH%%')
    items = inputs(os.path.abspath(a.src))
    if not items:
        sys.exit('LỖI: không có tệp tikz-<mã>.tex nào')
    out_dir = os.path.abspath(a.out or (a.src if os.path.isdir(a.src) else os.path.dirname(os.path.abspath(a.src))))
    work = tempfile.mkdtemp(prefix='hinh-')
    ok, bad = [], []
    try:
        for name, text in items:
            k, err = check(name, text)
            if err:
                bad.append((name, err))
                continue
            svg, err = compile_one(work, k, norm(text), mau)
            if err:
                bad.append((name, err))
            else:
                ok.append((k, svg))
        if ok:
            dest = os.path.join(out_dir, 'hinh-svg.zip')
            with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as z:
                for k, svg in ok:
                    z.write(svg, 'tikz-%s.svg' % k)
            print('Đã dựng %d hình → %s' % (len(ok), dest))
        for name, err in bad:
            print('LỖI ' + name + ': ' + err)
        if not ok:
            sys.exit(1)
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()
