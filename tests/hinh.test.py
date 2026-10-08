#!/usr/bin/env python3
"""Kiểm thử tools/hinh/build.py (hình bịa): mã hình khớp máy chủ (Fig.gs), kiểm tra tệp, dựng SVG thật khi máy có xelatex + dvisvgm."""
import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location('hinh', os.path.join(ROOT, 'tools', 'hinh', 'build.py'))
H = importlib.util.module_from_spec(spec)
spec.loader.exec_module(H)
fails = []


def case(name, cond):
    if not cond:
        fails.append(name)


# cùng giá trị với kịch bản 16.1 trong apps/main/Tests.gs — đổi cách tính mã ở một bên thì cả hai phải đổi
SIMPLE = '\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}'
case('mã hình khớp máy chủ', H.key(SIMPLE) == '1435a39e5123382b')
case('mã không phụ thuộc NFC/NFD và \\r\\n', H.key('\\begin{tikzpicture}\r\n\\node{Điểm};\r\n\\end{tikzpicture}') ==
     H.key('\\begin{tikzpicture}\n\\node{Đie\u0302\u0309m};\n\\end{tikzpicture}'))
case('tên đúng, nội dung khớp', H.check('tikz-1435a39e5123382b.tex', SIMPLE) == ('1435a39e5123382b', None))
case('mã không khớp nội dung', 'không khớp' in (H.check('tikz-0000000000000000.tex', SIMPLE)[1] or ''))
case('tên sai dạng', 'tên tệp' in (H.check('hinh.tex', SIMPLE)[1] or ''))
bad = '\\begin{tikzpicture}\\input{/etc/hostname}\\end{tikzpicture}'
case('lệnh đọc tệp bị chặn', 'không được phép' in (H.check('tikz-%s.tex' % H.key(bad), bad)[1] or ''))
bad = '\\begin{tikzpicture}\\node{^^5cinput};\\end{tikzpicture}'
case('mã ^^ bị chặn', 'không được phép' in (H.check('tikz-%s.tex' % H.key(bad), bad)[1] or ''))
two = SIMPLE + SIMPLE
case('hai khối trong một tệp bị từ chối', H.check('tikz-%s.tex' % H.key(two), two)[1] is not None)

if shutil.which('xelatex') and shutil.which('dvisvgm'):
    d = tempfile.mkdtemp()
    good = '\\begin{tikzpicture}\n\\draw (0,0) node[left]{$A$} -- (2,0) node[right]{Điểm $B$};\n\\end{tikzpicture}'
    line = '\\begin{tikzpicture}\\draw[very thick] (0,0) -- (3,1) circle (1);\\end{tikzpicture}'   # không có chữ: SVG chỉ còn nét vẽ
    broken = '\\begin{tikzpicture}\\draw (0,0) -- ;\\end{tikzpicture}'
    zp = os.path.join(d, 'hinh-chua-dung.zip')
    with zipfile.ZipFile(zp, 'w') as z:
        z.writestr('tikz-%s.tex' % H.key(good), good)
        z.writestr('tikz-%s.tex' % H.key(broken), broken)
        z.writestr('tikz-%s.tex' % H.key(line), line)
        z.writestr('danh-sach.txt', 'x')
    r = subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'hinh', 'build.py'), zp], capture_output=True, text=True)
    out = os.path.join(d, 'hinh-svg.zip')
    case('dựng được hình đúng, báo hình lỗi: ' + r.stdout[-300:], os.path.exists(out) and 'LỖI tikz-' + H.key(broken) in r.stdout)
    if os.path.exists(out):
        z = zipfile.ZipFile(out)
        case('zip chỉ có SVG của hình đúng', sorted(z.namelist()) == sorted(['tikz-%s.svg' % H.key(good), 'tikz-%s.svg' % H.key(line)]))
        svg = z.read('tikz-%s.svg' % H.key(good)).decode('utf-8')
        lsvg = z.read('tikz-%s.svg' % H.key(line)).decode('utf-8')
        # nét vẽ của TikZ phải có trong SVG (với trình điều khiển mặc định của XeLaTeX, dvisvgm chỉ giữ lại chữ)
        case('SVG có nét vẽ, không chỉ chữ', lsvg.count('<path') >= 1 and '<use' not in lsvg and svg.count('<path') > 3)
        case('SVG: chữ thành đường nét, không có script', '<svg' in svg and '<text' not in svg and '<script' not in svg)
    shutil.rmtree(d)
    extra = ' (có dựng thật)'
else:
    extra = ' (máy không có xelatex/dvisvgm — bỏ qua dựng thật)'

if fails:
    print('LỖI: ' + '; '.join(fails))
    sys.exit(1)
print('hinh/build.py: mọi trường hợp đều đạt' + extra)
